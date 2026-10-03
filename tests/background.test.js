import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../src/background/service-worker.js", import.meta.url), "utf8");

function createService(fetchImpl) {
  const storage = {};
  const listeners = {};
  const chrome = {
    storage: { local: {
      get: async (keys) => Object.fromEntries(keys.filter((key) => key in storage).map((key) => [key, storage[key]])),
      set: async (values) => Object.assign(storage, values),
    } },
    alarms: {
      get: async () => null,
      create: async () => {},
      onAlarm: { addListener: (listener) => { listeners.alarm = listener; } },
    },
    runtime: {
      onInstalled: { addListener: (listener) => { listeners.installed = listener; } },
      onStartup: { addListener: (listener) => { listeners.startup = listener; } },
      onMessage: { addListener: (listener) => { listeners.message = listener; } },
    },
  };
  runInNewContext(source, { chrome, fetch: fetchImpl, AbortSignal, Date, Error, Number, Object, Promise, String, RegExp });
  return {
    storage,
    send(message) {
      return new Promise((resolve) => {
        const keepAlive = listeners.message(message, {}, resolve);
        if (!keepAlive) resolve(undefined);
      });
    },
  };
}

test("caches valid Frankfurter rates, respects cooldown, and preserves cache on failures", async () => {
  let requests = 0;
  const today = new Date().toISOString().slice(0, 10);
  let response = { date: today, base: "USD", quote: "BRL", rate: 5.205 };
  let shouldFail = false;
  const service = createService(async (url) => {
    requests += 1;
    assert.equal(url, "https://api.frankfurter.dev/v2/rate/usd/brl");
    if (shouldFail) throw new Error("offline");
    return { ok: true, status: 200, json: async () => response };
  });

  const first = await service.send({ type: "PMO_ENSURE_USD_BRL" });
  assert.equal(first.reason, "updated");
  assert.equal(first.rate.rate, 5.205);
  assert.equal(service.storage.usdBrlRate.rateDate, today);
  assert.equal(requests, 1);

  service.storage.usdBrlStatus.lastAttemptAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  const cached = await service.send({ type: "PMO_ENSURE_USD_BRL" });
  assert.equal(cached.reason, "cached");
  assert.equal(requests, 1);

  service.storage.usdBrlStatus.lastAttemptAt = new Date().toISOString();
  const limited = await service.send({ type: "PMO_REFRESH_USD_BRL" });
  assert.equal(limited.reason, "cooldown");
  assert.equal(requests, 1);

  service.storage.usdBrlStatus.lastAttemptAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  shouldFail = true;
  const offline = await service.send({ type: "PMO_REFRESH_USD_BRL" });
  assert.equal(offline.reason, "error");
  assert.equal(offline.rate.rate, 5.205);
  assert.equal(service.storage.usdBrlRate.rate, 5.205);
  assert.equal(service.storage.usdBrlStatus.state, "error");

  service.storage.usdBrlStatus.lastAttemptAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  shouldFail = false;
  response = { date: today, base: "USD", quote: "BRL", rate: 0 };
  const invalid = await service.send({ type: "PMO_REFRESH_USD_BRL" });
  assert.equal(invalid.reason, "error");
  assert.equal(invalid.rate.rate, 5.205);
  assert.equal(service.storage.usdBrlRate.rate, 5.205);
});
