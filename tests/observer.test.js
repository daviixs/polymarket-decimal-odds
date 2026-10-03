import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";

let sourceFiles;

before(async () => {
  sourceFiles = await Promise.all([
    "../src/shared/constants.js",
    "../src/content/odds-calculator.js",
    "../src/content/price-extractor.js",
    "../src/content/currency-converter.js",
    "../src/content/money-extractor.js",
    "../src/content/odds-renderer.js",
    "../src/content/observer.js",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
});

async function createPage() {
  const dom = new JSDOM("<!doctype html><html lang='pt-BR'><body><button>Brasil 36%</button></body></html>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  sourceFiles.forEach((source) => dom.window.eval(source));
  const controller = dom.window.PolyOdds.createPriceObserver({
    document: dom.window.document,
    preferences: { enabled: true, showInlineOdds: true },
    locale: "pt-BR",
  });
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  return { dom, controller };
}

async function createCurrencyPage(html = "<button>Brasil $0.36</button>") {
  const sources = await Promise.all([
    "../src/shared/constants.js",
    "../src/content/odds-calculator.js",
    "../src/content/price-extractor.js",
    "../src/content/currency-converter.js",
    "../src/content/money-extractor.js",
    "../src/content/odds-renderer.js",
    "../src/content/observer.js",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const dom = new JSDOM(`<!doctype html><html lang='pt-BR'><body>${html}</body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  sources.forEach((source) => dom.window.eval(source));
  const rate = {
    base: "USD",
    quote: "BRL",
    rate: 5.35,
    rateDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
  };
  const controller = dom.window.PolyOdds.createPriceObserver({
    document: dom.window.document,
    preferences: { enabled: true, showInlineOdds: true, currencyEnabled: true },
    locale: "pt-BR",
    currencyRate: rate,
  });
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  return { dom, controller, rate };
}

test("updates a changed price without duplicating the badge", async () => {
  const { dom, controller } = await createPage();
  const button = dom.window.document.querySelector("button");
  assert.equal(dom.window.document.querySelector("[data-pmo-odds]")?.textContent, "Odd 2,78");

  button.firstChild.textContent = "Brasil 50%";
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  assert.equal(dom.window.document.querySelectorAll("[data-pmo-odds]").length, 1);
  assert.equal(dom.window.document.querySelector("[data-pmo-odds]")?.textContent, "Odd 2,00");

  controller.disconnect();
  dom.window.close();
});

test("renders odds beside the outcome control without changing its content", async () => {
  const { dom, controller } = await createPage();
  const button = dom.window.document.querySelector("button");
  const badge = dom.window.document.querySelector("[data-pmo-odds]");

  assert.equal(button.querySelector("[data-pmo-odds]"), null);
  assert.equal(button.textContent, "Brasil 36%");
  assert.equal(badge.textContent, "Odd 2,78");
  assert.equal(badge.previousElementSibling, button);

  controller.disconnect();
  dom.window.close();
});

test("removes inserted odds when disabled or when its source disappears", async () => {
  const { dom, controller } = await createPage();
  const button = dom.window.document.querySelector("button");
  controller.updatePreferences({ enabled: false });
  assert.equal(dom.window.document.querySelector("[data-pmo-odds]"), null);

  controller.updatePreferences({ enabled: true });
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  button.remove();
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  assert.equal(dom.window.document.querySelector("[data-pmo-odds]"), null);
  controller.disconnect();
  dom.window.close();
});

test("adds and updates one BRL estimate beside the original USD amount", async () => {
  const { dom, controller } = await createCurrencyPage();
  const button = dom.window.document.querySelector("button");
  let badge = dom.window.document.querySelector("[data-pmo-currency]");
  assert.equal(button.textContent.includes("$0.36"), true);
  assert.equal(dom.window.document.querySelector("[data-pmo-odds]")?.textContent, "Odd 2,78");
  assert.equal(badge.textContent, " · R$ 1,93");
  assert.equal(badge.previousSibling, button);
  assert.equal(badge.nextElementSibling?.getAttribute("data-pmo-odds"), "");

  button.firstChild.textContent = "Brasil $0.50";
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  badge = dom.window.document.querySelector("[data-pmo-currency]");
  assert.equal(badge.textContent, " · R$ 2,68");
  assert.equal(dom.window.document.querySelectorAll("[data-pmo-currency]").length, 1);
  assert.equal(dom.window.document.querySelectorAll("[data-pmo-odds]").length, 1);

  controller.disconnect();
  dom.window.close();
});

test("keeps odds independent, leaves inputs alone, and hides BRL for a stale rate", async () => {
  const { dom, controller } = await createCurrencyPage(
    '<button>Brasil 36%</button><label for="investment">Investment in USD</label><input id="investment" value="10.00">',
  );
  const button = dom.window.document.querySelector("button");
  const input = dom.window.document.querySelector("input");
  assert.equal(dom.window.document.querySelector("[data-pmo-odds]")?.textContent, "Odd 2,78");
  assert.equal(dom.window.document.querySelector("[data-pmo-currency]")?.textContent, " · R$ 53,50");
  assert.equal(input.value, "10.00");

  controller.updateCurrencyRate({
    rate: 5.35,
    rateDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
  });
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  assert.equal(dom.window.document.querySelector("[data-pmo-currency]")?.textContent, " · R$ 53,50");

  const label = dom.window.document.querySelector("label");
  label.textContent = "Investment amount";
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  assert.equal(dom.window.document.querySelector("[data-pmo-currency]"), null);
  label.textContent = "Investment in USD";
  await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
  assert.equal(dom.window.document.querySelector("[data-pmo-currency]")?.textContent, " · R$ 53,50");

  controller.updatePreferences({ currencyEnabled: false });
  assert.equal(dom.window.document.querySelector("[data-pmo-currency]"), null);
  assert.ok(dom.window.document.querySelector("[data-pmo-odds]"));
  controller.updatePreferences({ currencyEnabled: true });
  controller.updateCurrencyRate({ rate: 5.35, rateDate: "2020-01-01", fetchedAt: new Date().toISOString() });
  assert.equal(dom.window.document.querySelector("[data-pmo-currency]"), null);
  assert.ok(dom.window.document.querySelector("[data-pmo-odds]"));
  assert.equal(input.value, "10.00");
  controller.disconnect();
  dom.window.close();
});
