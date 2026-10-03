(function initializePriceExtractor(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});
  const PRICE_PATTERN = /(?<![\w.])(?:(?:US\s*)?\$\s*(\d{1,2}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{1,2})?)\s*(%|¢))(?![\w.])/giu;
  const IGNORED_LABELS = new Set([
    "buy",
    "sell",
    "trade",
    "price",
    "odds",
    "probability",
    "volume",
    "yes price",
    "no price",
  ]);
  const ACTION_WORDS = /\b(?:buy|sell|trade|price|odds|probability)\b/giu;

  function parseLocalizedNumber(value) {
    const normalized = value.replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  extension.parsePriceText = function parsePriceText(text) {
    const matches = [...String(text ?? "").matchAll(PRICE_PATTERN)];
    if (matches.length !== 1) return null;

    const match = matches[0];
    if (match[1] !== undefined) {
      const value = parseLocalizedNumber(match[1]);
      return value !== null && value > 0 && value <= 1 ? value : null;
    }

    const value = parseLocalizedNumber(match[2]);
    if (value === null || value <= 0) return null;

    const normalizedValue = match[3] === "%" || match[3] === "¢"
      ? value / 100
      : value;
    return normalizedValue > 0 && normalizedValue <= 1 ? normalizedValue : null;
  };

  extension.hasOutcomeLabel = function hasOutcomeLabel(text, priceMatch) {
    if (!priceMatch) return false;

    const label = String(text ?? "")
      .replace(priceMatch[0], " ")
      .replace(ACTION_WORDS, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLocaleLowerCase();

    return label.length > 0 && !IGNORED_LABELS.has(label);
  };

  extension.getCandidatePrice = function getCandidatePrice(control) {
    if (!control?.isConnected) return null;

    const cloned = control.cloneNode(true);
    cloned.querySelectorAll?.(`[${extension.oddsAttribute}]`).forEach((node) => node.remove());
    const text = cloned.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const visibleMatches = [...text.matchAll(PRICE_PATTERN)];
    if (visibleMatches.length > 1) return null;

    const sources = visibleMatches.length === 1
      ? [text]
      : [control.getAttribute("aria-label"), control.getAttribute("title")].filter(Boolean);

    for (const source of sources) {
      const matches = [...source.matchAll(PRICE_PATTERN)];
      if (matches.length !== 1 || !extension.hasOutcomeLabel(source, matches[0])) continue;
      const price = extension.parsePriceText(matches[0][0]);
      if (price !== null) return { price, outcomeLabel: source.replace(matches[0][0], " ").trim() };
    }
    return null;
  };
})(globalThis);
