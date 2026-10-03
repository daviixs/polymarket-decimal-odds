import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";

let converterSource;
let extractorSource;

before(async () => {
  [converterSource, extractorSource] = await Promise.all([
    readFile(new URL("../src/content/currency-converter.js", import.meta.url), "utf8"),
    readFile(new URL("../src/content/money-extractor.js", import.meta.url), "utf8"),
  ]);
});

function createExtension() {
  const dom = new JSDOM("<!doctype html><html lang='pt-BR'><body></body></html>", { runScripts: "outside-only" });
  dom.window.eval(converterSource);
  dom.window.eval(extractorSource);
  return { dom, extension: dom.window.PolyOdds };
}

test("converts USD to BRL and formats Brazilian currency", () => {
  const { dom, extension } = createExtension();
  const rate = 5.35;
  for (const [usd, expected] of [[0.1, 0.535], [0.36, 1.926], [1, 5.35], [10, 53.5], [100, 535]]) {
    assert.ok(Math.abs(extension.convertUsdToBrl(usd, rate) - expected) < 1e-10);
  }
  assert.equal(extension.formatBrl(1.926, "pt-BR"), "R$ 1,93");
  assert.equal(extension.formatBrl(53.5, "pt-BR"), "R$ 53,50");
  assert.equal(extension.formatBrl(53.5, "en-US"), "R$ 53,50");
  dom.window.close();
});

test("rejects invalid amount and exchange-rate values", () => {
  const { dom, extension } = createExtension();
  for (const amount of [null, undefined, NaN, Infinity, -1]) {
    assert.equal(extension.convertUsdToBrl(amount, 5.35), null);
  }
  for (const rate of [null, undefined, NaN, Infinity, 0, -5]) {
    assert.equal(extension.convertUsdToBrl(10, rate), null);
  }
  assert.equal(extension.formatBrl(-1), null);
  assert.equal(extension.formatBrl(NaN), null);
  dom.window.close();
});

test("recognizes explicit USD amounts and contract cents only", () => {
  const { dom, extension } = createExtension();
  assert.equal(extension.getSingleUsdAmount("US$ 0.10"), 0.1);
  assert.equal(extension.getSingleUsdAmount("$0.36"), 0.36);
  assert.equal(extension.getSingleUsdAmount("USD 1.00"), 1);
  assert.equal(extension.getSingleUsdAmount("$10.00"), 10);
  assert.equal(extension.getSingleUsdAmount("$100.00"), 100);
  assert.equal(extension.getSingleUsdAmount("36¢"), 0.36);
  assert.equal(extension.getSingleUsdAmount("$1,234.56"), 1234.56);
  assert.equal(extension.getSingleUsdAmount("-$10.00"), null);
  assert.equal(extension.getSingleUsdAmount("36%"), null);
  assert.equal(extension.getSingleUsdAmount("2.78x"), null);
  assert.equal(extension.getSingleUsdAmount("10 shares"), null);
  assert.equal(extension.getSingleUsdAmount("Market 1790991600"), null);
  assert.equal(extension.getSingleUsdAmount("$10.00 · $5.00"), null);
  assert.equal(extension.getSingleUsdAmount(""), null);
  assert.equal(extension.getSingleUsdAmount(undefined), null);
  dom.window.close();
});

test("only treats a numeric input as USD when its context explicitly says USD", () => {
  const { dom, extension } = createExtension();
  const input = dom.window.document.createElement("input");
  input.value = "10.00";
  assert.equal(extension.parseInputAmount(input.value), 10);
  assert.equal(extension.hasExplicitUsdMarker("Investment in USD"), true);
  assert.equal(extension.hasExplicitUsdMarker("Shares"), false);
  assert.equal(extension.parseInputAmount("not a number"), null);
  dom.window.close();
});

test("marks rate older than four days stale and rejects future rate dates", () => {
  const { dom, extension } = createExtension();
  const now = Date.parse("2026-10-02T12:00:00Z");
  assert.equal(extension.isCurrencyRateFresh({ rate: 5.35, rateDate: "2026-10-01" }, now), true);
  assert.equal(extension.isCurrencyRateFresh({ rate: 5.35, rateDate: "2026-09-28" }, now), false);
  assert.equal(extension.isCurrencyRateFresh({ rate: 5.35, rateDate: "2026-10-03" }, now), false);
  dom.window.close();
});
