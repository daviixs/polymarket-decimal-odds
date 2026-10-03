(function initializeMoneyExtractor(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});
  const NUMBER = "(?:\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const USD_PATTERN = new RegExp(
    `(?<![\\p{L}\\p{N}+\\-])(?:(?:US\\s*\\$|\\$|USD\\s*)\\s*(${NUMBER})([kmb])?(?![\\p{L}\\p{N}])|(${NUMBER})\\s*¢)`,
    "giu",
  );
  const USD_MARKER = /(?:\bUSD\b|US\s*\$|\$)/iu;

  function normalizeNumber(raw) {
    let value = raw.replace(/\s/g, "");
    const comma = value.lastIndexOf(",");
    const dot = value.lastIndexOf(".");

    if (comma >= 0 && dot >= 0) {
      const decimalSeparator = comma > dot ? "," : ".";
      const groupingSeparator = decimalSeparator === "," ? "." : ",";
      value = value.split(groupingSeparator).join("").replace(decimalSeparator, ".");
    } else if (comma >= 0 || dot >= 0) {
      const separator = comma >= 0 ? "," : ".";
      const parts = value.split(separator);
      const isGroupedInteger = parts.length > 1 && parts.at(-1).length === 3;
      value = isGroupedInteger ? parts.join("") : `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
    }

    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }

  extension.extractUsdAmounts = function extractUsdAmounts(text) {
    return [...String(text ?? "").matchAll(USD_PATTERN)].map((match) => {
      if (match[1] !== undefined) {
        const amount = normalizeNumber(match[1]);
        const scale = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[match[2]?.toLowerCase()] ?? 1;
        return amount === null ? null : amount * scale;
      }
      const cents = normalizeNumber(match[3]);
      return cents === null ? null : cents / 100;
    });
  };

  extension.getSingleUsdAmount = function getSingleUsdAmount(text) {
    const amounts = extension.extractUsdAmounts(text);
    return amounts.length === 1 && Number.isFinite(amounts[0]) && amounts[0] >= 0
      ? amounts[0]
      : null;
  };

  extension.hasExplicitUsdMarker = function hasExplicitUsdMarker(text) {
    return USD_MARKER.test(String(text ?? ""));
  };

  extension.parseInputAmount = function parseInputAmount(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const amount = normalizeNumber(value.trim());
    return amount !== null && amount >= 0 ? amount : null;
  };
})(globalThis);
