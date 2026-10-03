(function initializeObserver(root) {
  const extension = (root.PolyOdds = root.PolyOdds || {});

  extension.createPriceObserver = function createPriceObserver({ document, preferences, locale, currencyRate = null }) {
    const candidateSelector = extension.priceControlSelector;
    let observer;
    let scheduled = false;
    const pendingCandidates = new Set();
    const pendingCurrencySources = new Set();
    const currencyBadges = new WeakMap();
    let currencyExpiryTimer = null;

    const hasCurrencyOutputAncestor = (node) => {
      const element = node.nodeType === 1 ? node : node.parentElement;
      return Boolean(element?.closest(`[${extension.currencyAttribute}], [${extension.oddsAttribute}]`));
    };

    function removeCurrencySource(source) {
      currencyBadges.get(source)?.remove();
      currencyBadges.delete(source);
    }

    function placeCurrencyOutput(source, anchor, amountUsd) {
      if (!currencyRate || !extension.isCurrencyRateFresh(currencyRate)) {
        removeCurrencySource(source);
        return;
      }
      const amountBrl = extension.convertUsdToBrl(amountUsd, currencyRate.rate);
      if (amountBrl === null || !anchor?.parentNode) {
        removeCurrencySource(source);
        return;
      }

      let badge = currencyBadges.get(source);
      const nextBadge = extension.createCurrencyOutput(document, amountBrl, currencyRate, locale);
      if (!badge) {
        badge = nextBadge;
        currencyBadges.set(source, badge);
      } else {
        badge.textContent = nextBadge.textContent;
        badge.setAttribute("aria-label", nextBadge.getAttribute("aria-label"));
        badge.title = nextBadge.title;
      }
      if (badge.parentNode !== anchor.parentNode || badge.previousSibling !== anchor) {
        anchor.parentNode.insertBefore(badge, anchor.nextSibling);
      }
    }

    function scheduleCurrencyExpiry() {
      if (currencyExpiryTimer !== null) document.defaultView.clearTimeout(currencyExpiryTimer);
      if (!currencyRate || !extension.isCurrencyRateFresh(currencyRate)) {
        extension.removeAllCurrency(document);
        return;
      }
      const expiry = Date.parse(`${currencyRate.rateDate}T00:00:00Z`) + 4 * 24 * 60 * 60 * 1000;
      currencyExpiryTimer = document.defaultView.setTimeout(() => {
        currencyExpiryTimer = null;
        if (!extension.isCurrencyRateFresh(currencyRate)) extension.removeAllCurrency(document);
        else scheduleCurrencyExpiry();
      }, Math.max(0, expiry - Date.now() + 5));
    }

    function getElementTextWithoutAnnotations(element) {
      const clone = element.cloneNode(true);
      clone.querySelectorAll?.(`[${extension.currencyAttribute}], [${extension.oddsAttribute}]`).forEach((node) => node.remove());
      return clone.textContent?.replace(/\s+/g, " ").trim() ?? "";
    }

    function processCurrencySource(source) {
      if (!source?.isConnected) return;
      if (!preferences.currencyEnabled || !extension.isCurrencyRateFresh(currencyRate)) {
        removeCurrencySource(source);
        return;
      }

      if (source.nodeType === 3) {
        const amount = extension.getSingleUsdAmount(source.nodeValue);
        if (amount === null || !source.parentElement) {
          removeCurrencySource(source);
          return;
        }
        placeCurrencyOutput(source, source, amount);
        return;
      }

      const amount = extension.getSingleUsdAmount(getElementTextWithoutAnnotations(source));
      if (amount === null) {
        removeCurrencySource(source);
        return;
      }
      placeCurrencyOutput(source, source, amount);
    }

    function collectCurrencyWithin(node) {
      if (node.nodeType === 3) {
        queueCurrencySource(node);
        return;
      }
      if (node.nodeType !== 1 || hasCurrencyOutputAncestor(node)) return;

      if (node.matches(candidateSelector)) pendingCurrencySources.add(node);
      node.querySelectorAll(candidateSelector).forEach((control) => pendingCurrencySources.add(control));
      const walker = document.createTreeWalker(node, document.defaultView.NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) queueCurrencySource(walker.currentNode);
    }

    function queueCurrencySource(node) {
      if (!node || hasCurrencyOutputAncestor(node)) return;
      const element = node.nodeType === 1 ? node : node.parentElement;
      const control = element?.closest(candidateSelector);
      if (control) {
        pendingCurrencySources.add(control);
      } else if (node.nodeType === 3) {
        pendingCurrencySources.add(node);
      }
    }

    function removeSourcesWithin(node) {
      if (node.nodeType === 3) {
        removeCurrencySource(node);
        return;
      }
      if (node.nodeType !== 1) return;
      removeCurrencySource(node);
      if (node.matches(candidateSelector)) extension.removeOdds(node);
      node.querySelectorAll("input, button, a, [role='button']").forEach(removeCurrencySource);
      node.querySelectorAll(candidateSelector).forEach(extension.removeOdds);
      const walker = document.createTreeWalker(node, document.defaultView.NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) removeCurrencySource(walker.currentNode);
    }

    function collectWithin(node) {
      if (node.nodeType !== 1) return;
      if (node.matches(candidateSelector)) pendingCandidates.add(node);
      node.querySelectorAll(candidateSelector).forEach((candidate) => pendingCandidates.add(candidate));
    }

    function queueClosestCandidate(node) {
      const element = node.nodeType === 1 ? node : node.parentElement;
      const candidate = element?.closest(candidateSelector);
      if (candidate) pendingCandidates.add(candidate);
    }

    function processCandidates() {
      scheduled = false;
      const candidates = [...pendingCandidates];
      pendingCandidates.clear();
      const currencySources = [...pendingCurrencySources];
      pendingCurrencySources.clear();

      for (const candidate of candidates) {
        if (!candidate.isConnected) continue;
        if (!preferences.enabled || !preferences.showInlineOdds) {
          extension.removeOdds(candidate);
          continue;
        }

        const extracted = extension.getCandidatePrice(candidate);
        if (!extracted) {
          extension.removeOdds(candidate);
          continue;
        }
        extension.renderOdds(candidate, extracted.price, locale);
      }

      for (const source of currencySources) processCurrencySource(source);
    }

    function scheduleProcessing() {
      if (scheduled) return;
      scheduled = true;
      (document.defaultView.requestAnimationFrame || document.defaultView.setTimeout)(processCandidates);
    }

    function handleMutations(records) {
      for (const record of records) {
        if (hasCurrencyOutputAncestor(record.target)) continue;
        if (record.type === "childList" && record.addedNodes.length > 0
          && [...record.addedNodes].every((node) => node.nodeType === 1
            && (node.matches(`[${extension.currencyAttribute}], [${extension.oddsAttribute}]`)
              || node.closest?.(`[${extension.currencyAttribute}], [${extension.oddsAttribute}]`)))) {
          continue;
        }

        queueClosestCandidate(record.target);
        if (record.type === "childList") {
          record.removedNodes.forEach(removeSourcesWithin);
          record.addedNodes.forEach((node) => {
            collectWithin(node);
            collectCurrencyWithin(node);
          });
        } else if (record.type === "characterData") {
          queueCurrencySource(record.target);
        } else if (record.type === "attributes") queueCurrencySource(record.target);
      }
      scheduleProcessing();
    }

    function scanDocument() {
      collectWithin(document.documentElement);
      collectCurrencyWithin(document.documentElement);
      scheduleProcessing();
    }

    observer = new document.defaultView.MutationObserver(handleMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder"],
    });

    scheduleCurrencyExpiry();
    scanDocument();

    return {
      scan: scanDocument,
      updatePreferences(nextPreferences) {
        preferences = { ...preferences, ...nextPreferences };
        if (!preferences.enabled || !preferences.showInlineOdds) {
          extension.removeAllOdds(document);
        } else {
          scanDocument();
        }
        if (!preferences.currencyEnabled) {
          extension.removeAllCurrency(document);
        } else {
          scanDocument();
        }
      },
      updateCurrencyRate(nextRate) {
        currencyRate = nextRate;
        scheduleCurrencyExpiry();
        if (!preferences.currencyEnabled || !extension.isCurrencyRateFresh(currencyRate)) {
          extension.removeAllCurrency(document);
        } else {
          scanDocument();
        }
      },
      disconnect() {
        observer.disconnect();
        if (currencyExpiryTimer !== null) document.defaultView.clearTimeout(currencyExpiryTimer);
        pendingCandidates.clear();
        pendingCurrencySources.clear();
      },
    };
  };
})(globalThis);
