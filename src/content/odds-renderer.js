(function initializeOddsRenderer(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});
  const oddsBadges = new WeakMap();

  extension.renderOdds = function renderOdds(control, price, locale) {
    if (!control?.isConnected) return;

    const formattedOdds = extension.formatDecimalOdds(price, locale);
    if (formattedOdds === null) {
      oddsBadges.get(control)?.remove();
      oddsBadges.delete(control);
      control.querySelectorAll(`[${extension.oddsAttribute}]`).forEach((node) => node.remove());
      return;
    }

    let badge = oddsBadges.get(control);
    control.querySelectorAll(`:scope > [${extension.oddsAttribute}]`).forEach((node) => node.remove());
    if (!badge) {
      badge = control.ownerDocument.createElement("span");
      badge.setAttribute(extension.oddsAttribute, "");
      badge.className = "pmo-decimal-odds";
      oddsBadges.set(control, badge);
    }

    const text = `Odd ${formattedOdds}`;
    if (badge.textContent !== text) badge.textContent = text;
    badge.setAttribute("aria-label", `Odd decimal ${formattedOdds}`);
    if (badge.parentNode !== control.parentNode || badge.previousElementSibling !== control) {
      control.insertAdjacentElement("afterend", badge);
    }
  };

  extension.removeOdds = function removeOdds(control) {
    if (!control) return;
    oddsBadges.get(control)?.remove();
    oddsBadges.delete(control);
    control.querySelectorAll?.(`[${extension.oddsAttribute}]`).forEach((node) => node.remove());
  };

  extension.removeAllOdds = function removeAllOdds(document) {
    document.querySelectorAll(`[${extension.oddsAttribute}]`).forEach((node) => node.remove());
  };

  extension.createCurrencyOutput = function createCurrencyOutput(document, amountBrl, rate, locale) {
    const output = document.createElement("span");
    const formatted = extension.formatBrl(amountBrl);
    const fetchedAt = new Date(rate.fetchedAt).toLocaleString(locale);
    output.setAttribute(extension.currencyAttribute, "");
    output.className = "pmo-currency-equivalent";
    output.textContent = ` · ${formatted}`;
    output.setAttribute("aria-label", `Equivalente estimado: ${formatted}`);
    output.title = `Estimativa com USD/BRL ${rate.rate.toFixed(4)}; taxa de ${rate.rateDate}; consultada em ${fetchedAt}.`;
    return output;
  };

  extension.removeAllCurrency = function removeAllCurrency(document) {
    document.querySelectorAll(`[${extension.currencyAttribute}]`).forEach((node) => node.remove());
  };
})(globalThis);
