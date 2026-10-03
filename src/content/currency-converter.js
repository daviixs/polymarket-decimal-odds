(function initializeCurrencyConverter(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});
  const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

  extension.isCurrencyRateFresh = function isCurrencyRateFresh(rate, now = Date.now()) {
    if (!rate || !Number.isFinite(rate.rate) || rate.rate <= 0) return false;
    const rateDate = Date.parse(`${rate.rateDate}T00:00:00Z`);
    const age = now - rateDate;
    const canonicalDate = Number.isFinite(rateDate)
      && new Date(rateDate).toISOString().slice(0, 10) === rate.rateDate;
    return canonicalDate && age >= 0 && age < FOUR_DAYS_MS;
  };

  extension.convertUsdToBrl = function convertUsdToBrl(amountUsd, rate) {
    if (!Number.isFinite(amountUsd) || amountUsd < 0) return null;
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const amountBrl = amountUsd * rate;
    return Number.isFinite(amountBrl) ? amountBrl : null;
  };

  extension.formatBrl = function formatBrl(amount) {
    if (!Number.isFinite(amount) || amount < 0) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };
})(globalThis);
