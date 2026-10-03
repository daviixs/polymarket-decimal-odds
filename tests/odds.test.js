import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";

let dom;
let extension;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  const sources = ["../src/content/odds-calculator.js", "../src/content/odds-renderer.js"];
  for (const path of sources) {
    dom.window.eval(await readFile(new URL(path, import.meta.url), "utf8"));
  }
  extension = dom.window.PolyOdds;
});

test("calculates decimal odds and formats two localized decimals", () => {
  const samples = [[0.1, 10], [0.25, 4], [0.36, 2.7777], [0.5, 2], [0.75, 1.3333], [1, 1]];
  for (const [price, expected] of samples) {
    assert.ok(Math.abs(extension.calculateDecimalOdds(price) - expected) < 0.0001);
  }
  assert.equal(extension.formatDecimalOdds(0.36, "pt-BR"), "2,78");
  assert.equal(extension.formatDecimalOdds(0.36, "en-US"), "2.78");
});

test("returns no odds for invalid values and rounds to two decimals", () => {
  for (const price of [0, -1, 1.01, Number.NaN, null]) {
    assert.equal(extension.calculateDecimalOdds(price), null);
    assert.equal(extension.formatDecimalOdds(price, "pt-BR"), null);
  }
  assert.equal(extension.formatDecimalOdds(0.4, "pt-BR"), "2,50");
});

test("updates one existing badge and does not duplicate it", () => {
  const button = dom.window.document.createElement("button");
  button.textContent = "Brasil 36%";
  dom.window.document.body.append(button);

  extension.renderOdds(button, 0.36, "pt-BR");
  extension.renderOdds(button, 0.5, "pt-BR");

  const badge = dom.window.document.querySelector(`[${extension.oddsAttribute}]`);
  assert.equal(button.querySelectorAll(`[${extension.oddsAttribute}]`).length, 0);
  assert.equal(dom.window.document.querySelectorAll(`[${extension.oddsAttribute}]`).length, 1);
  assert.equal(badge.textContent, "Odd 2,00");
  assert.equal(badge.previousElementSibling, button);
  assert.equal(button.textContent, "Brasil 36%");
});
