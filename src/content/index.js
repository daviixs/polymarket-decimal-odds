(function startPolyOdds(root) {
  const extension = root.PolyOdds;
  if (!extension || root.__polyOddsStarted) return;
  root.__polyOddsStarted = true;

  let observerController;
  let preferences = { ...extension.defaults };

  async function loadPreferences() {
    try {
      const stored = await chrome.storage.sync.get(extension.storageKeys);
      preferences = Object.fromEntries(extension.storageKeys.map((key) => [
        key,
        stored[key] ?? extension.defaults[key],
      ]));
    } catch {
      preferences = { ...extension.defaults };
    }
  }

  async function loadCurrencyRate() {
    try {
      const stored = await chrome.storage.local.get(extension.currencyRateStorageKey);
      return stored[extension.currencyRateStorageKey] ?? null;
    } catch {
      return null;
    }
  }

  async function start() {
    await loadPreferences();
    const currencyRate = await loadCurrencyRate();
    observerController = extension.createPriceObserver({
      document,
      preferences,
      locale: navigator.language || document.documentElement.lang,
      currencyRate,
    });

    chrome.runtime.sendMessage({ type: "PMO_ENSURE_USD_BRL" }).catch(() => {});

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;
      const next = {};
      for (const key of extension.storageKeys) {
        if (changes[key]) next[key] = changes[key].newValue;
      }
      if (Object.keys(next).length) observerController.updatePreferences(next);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[extension.currencyRateStorageKey]) return;
      observerController.updateCurrencyRate(changes[extension.currencyRateStorageKey].newValue ?? null);
    });

    window.addEventListener("popstate", () => observerController.scan());
    window.addEventListener("hashchange", () => observerController.scan());
  }

  start();
})(globalThis);
