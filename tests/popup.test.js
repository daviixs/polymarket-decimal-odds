import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";

test("loads persisted settings and saves user changes", async () => {
  const html = await readFile(new URL("../src/popup/popup.html", import.meta.url), "utf8");
  const constants = await readFile(new URL("../src/shared/constants.js", import.meta.url), "utf8");
  const converter = await readFile(new URL("../src/content/currency-converter.js", import.meta.url), "utf8");
  const popup = await readFile(new URL("../src/popup/popup.js", import.meta.url), "utf8");
  const values = { enabled: false, showInlineOdds: true, currencyEnabled: false };
  const writes = [];
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "chrome-extension://test/src/popup/popup.html" });
  dom.window.chrome = {
    runtime: { getManifest: () => ({ version: "1.1.1" }), sendMessage: async () => ({ ok: true }) },
    storage: { sync: {
      get: async (keys) => Object.fromEntries(keys.map((key) => [key, values[key]])),
      set: async (update) => { writes.push(update); Object.assign(values, update); },
    }, local: { get: async () => ({}) }, onChanged: { addListener() {} } },
  };
  dom.window.eval(constants);
  dom.window.eval(converter);
  dom.window.eval(popup);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const enabled = dom.window.document.getElementById("enabled");
  const inline = dom.window.document.getElementById("show-inline-odds");
  const currency = dom.window.document.getElementById("currency-enabled");
  assert.equal(enabled.checked, false);
  assert.equal(inline.checked, true);
  assert.equal(currency.checked, false);
  assert.equal(dom.window.document.getElementById("status-text").textContent, "Conversões desativadas");
  assert.equal(dom.window.document.getElementById("version").textContent, "v1.1.1");

  enabled.checked = true;
  enabled.dispatchEvent(new dom.window.Event("change"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ enabled: true }]);
  assert.equal(values.enabled, true);
  currency.checked = true;
  currency.dispatchEvent(new dom.window.Event("change"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ enabled: true }, { currencyEnabled: true }]);
  assert.equal(values.showInlineOdds, true);
  dom.window.close();
});
