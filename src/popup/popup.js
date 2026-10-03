(function initializePopup(root) {
  const extension = root.PolyOdds;
  const enabledInput = document.getElementById("enabled");
  const inlineInput = document.getElementById("show-inline-odds");
  const currencyInput = document.getElementById("currency-enabled");
  const status = document.querySelector(".status");
  const statusText = document.getElementById("status-text");
  const error = document.getElementById("error");
  const rateValue = document.getElementById("rate-value");
  const rateUpdated = document.getElementById("rate-updated");
  const rateNote = document.getElementById("rate-note");
  const refreshButton = document.getElementById("refresh-rate");
  let cachedRate = null;
  let cachedRateStatus = null;
  document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

  function renderStatus() {
    const active = (enabledInput.checked && inlineInput.checked) || currencyInput.checked;
    status.classList.toggle("is-enabled", active);
    statusText.textContent = active ? "Ao menos uma conversão ativada" : "Conversões desativadas";
  }

  function renderRate() {
    if (!cachedRate) {
      rateValue.textContent = cachedRateStatus?.state === "loading" ? "Consultando cotação…" : "Cotação indisponível";
      rateUpdated.textContent = "A conversão em reais fica oculta sem uma taxa válida.";
      rateNote.textContent = cachedRateStatus?.state === "error"
        ? "Falha ao consultar a fonte. Tente novamente mais tarde."
        : "Fonte: Frankfurter · taxas diárias indicativas.";
      return;
    }

    const fresh = extension.isCurrencyRateFresh(cachedRate);
    const formattedRate = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(cachedRate.rate);
    const fetchedAt = Number.isFinite(Date.parse(cachedRate.fetchedAt))
      ? new Date(cachedRate.fetchedAt).toLocaleString("pt-BR")
      : "horário desconhecido";
    const rateDate = new Date(`${cachedRate.rateDate}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

    rateValue.textContent = `US$ 1 = R$ ${formattedRate}${fresh ? "" : " · desatualizada"}`;
    rateUpdated.textContent = `Data da taxa: ${rateDate} · Consultada: ${fetchedAt}`;
    if (cachedRateStatus?.state === "error") {
      rateNote.textContent = `A última consulta falhou. ${fresh ? "A taxa armazenada ainda é recente." : "As conversões na página estão ocultas."}`;
    } else {
      rateNote.textContent = fresh
        ? "Fonte: Frankfurter · taxas diárias indicativas. Valores estimados, sem tarifas, spread ou impostos."
        : "Taxa com mais de 4 dias: conversões ocultas na página. Fonte: Frankfurter.";
    }
  }

  async function loadRate() {
    try {
      const stored = await chrome.storage.local.get([
        extension.currencyRateStorageKey,
        extension.currencyStatusStorageKey,
      ]);
      cachedRate = stored[extension.currencyRateStorageKey] ?? null;
      cachedRateStatus = stored[extension.currencyStatusStorageKey] ?? null;
      renderRate();
    } catch {
      rateValue.textContent = "Não foi possível ler a cotação";
      rateUpdated.textContent = "Verifique o armazenamento da extensão.";
    }
  }

  async function savePreference(key, value) {
    error.hidden = true;
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch {
      error.hidden = false;
      const stored = await chrome.storage.sync.get(extension.storageKeys);
      enabledInput.checked = stored.enabled ?? extension.defaults.enabled;
      inlineInput.checked = stored.showInlineOdds ?? extension.defaults.showInlineOdds;
      currencyInput.checked = stored.currencyEnabled ?? extension.defaults.currencyEnabled;
      renderStatus();
    }
  }

  async function refreshRate() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Atualizando…";
    rateNote.textContent = "Consultando Frankfurter…";
    try {
      const result = await chrome.runtime.sendMessage({ type: "PMO_REFRESH_USD_BRL" });
      let notice = "";
      if (result?.reason === "cooldown") {
        const retryAt = new Date(result.retryAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        notice = `Limite de atualização manual. Tente novamente após ${retryAt}.`;
      } else if (!result?.ok) {
        notice = "Não foi possível atualizar. A última taxa válida foi preservada.";
      }
      await loadRate();
      if (notice) rateNote.textContent = notice;
    } catch {
      rateNote.textContent = "Falha de comunicação com o serviço da extensão.";
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "Atualizar";
    }
  }

  chrome.storage.sync.get(extension.storageKeys).then((stored) => {
    enabledInput.checked = stored.enabled ?? extension.defaults.enabled;
    inlineInput.checked = stored.showInlineOdds ?? extension.defaults.showInlineOdds;
    currencyInput.checked = stored.currencyEnabled ?? extension.defaults.currencyEnabled;
    renderStatus();
  }).catch(() => {
    enabledInput.checked = extension.defaults.enabled;
    inlineInput.checked = extension.defaults.showInlineOdds;
    currencyInput.checked = extension.defaults.currencyEnabled;
    renderStatus();
    error.hidden = false;
  });

  void loadRate();
  void chrome.runtime.sendMessage({ type: "PMO_ENSURE_USD_BRL" }).then(loadRate).catch(() => {});
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && (changes[extension.currencyRateStorageKey] || changes[extension.currencyStatusStorageKey])) {
      void loadRate();
    }
  });

  enabledInput.addEventListener("change", () => {
    renderStatus();
    void savePreference("enabled", enabledInput.checked);
  });
  inlineInput.addEventListener("change", () => {
    renderStatus();
    void savePreference("showInlineOdds", inlineInput.checked);
  });
  currencyInput.addEventListener("change", () => {
    renderStatus();
    void savePreference("currencyEnabled", currencyInput.checked);
  });
  refreshButton.addEventListener("click", () => void refreshRate());
})(globalThis);
