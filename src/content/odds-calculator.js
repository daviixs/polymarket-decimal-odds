(function initializeOddsCalculator(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});

  extension.calculateDecimalOdds = function calculateDecimalOdds(price) {
    if (!Number.isFinite(price) || price <= 0 || price > 1) return null;
    return 1 / price;
  };

  extension.formatDecimalOdds = function formatDecimalOdds(price, locale) {
    const odds = extension.calculateDecimalOdds(price);
    if (odds === null) return null;

    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(odds);
  };
})(globalThis);
