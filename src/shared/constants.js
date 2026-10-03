(function initializePolyOdds(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});

  extension.defaults = Object.freeze({
    enabled: true,
    showInlineOdds: true,
    currencyEnabled: true,
  });
  extension.storageKeys = Object.freeze(["enabled", "showInlineOdds", "currencyEnabled"]);
  extension.currencyRateStorageKey = "usdBrlRate";
  extension.currencyStatusStorageKey = "usdBrlStatus";
  extension.oddsAttribute = "data-pmo-odds";
  extension.currencyAttribute = "data-pmo-currency";
  extension.priceControlSelector = "button, a, [role='button']";
})(globalThis);
