import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";

let dom;
let extension;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  const source = await readFile(new URL("../src/content/price-extractor.js", import.meta.url), "utf8");
  dom.window.eval(source);
  extension = dom.window.PolyOdds;
});

test("parses prices represented as percent, cents, or dollar values", () => {
  assert.equal(extension.parsePriceText("Brasil 36%"), 0.36);
  assert.equal(extension.parsePriceText("Brasil 36¢"), 0.36);
  assert.equal(extension.parsePriceText("Brasil $0.36"), 0.36);
  assert.equal(extension.parsePriceText("Brasil $0,36"), 0.36);
});

test("rejects zero, absent, malformed, ambiguous, and out-of-range prices", () => {
  for (const text of ["Yes 0%", "Yes", "Yes 101%", "Yes $1.25", "Yes 50% 50¢", "Yes 2.00x"]) {
    assert.equal(extension.parsePriceText(text), null, text);
  }
  assert.equal(extension.getCandidatePrice(dom.window.document.createElement("button")), null);
});

test("extracts a price only from a control with one identifiable outcome", () => {
  const document = dom.window.document;
  const yes = document.createElement("button");
  yes.innerHTML = "Yes <strong>36%</strong>";
  const buy = document.createElement("button");
  buy.textContent = "Buy 36%";
  const several = document.createElement("a");
  several.textContent = "Yes 36% / No 64%";
  const accessible = document.createElement("button");
  accessible.textContent = "Yes";
  accessible.setAttribute("aria-label", "Yes 36%" );

  document.body.append(yes, buy, several, accessible);
  assert.equal(extension.getCandidatePrice(yes).price, 0.36);
  assert.equal(extension.getCandidatePrice(buy), null);
  assert.equal(extension.getCandidatePrice(several), null);
  assert.equal(extension.getCandidatePrice(accessible).price, 0.36);
});
