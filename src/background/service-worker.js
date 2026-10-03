(function initializeCurrencyService(root) {
  const RATE_KEY = "usdBrlRate";
  const STATUS_KEY = "usdBrlStatus";
  const REFRESH_ALARM = "usd-brl-refresh";
  const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const MANUAL_COOLDOWN_MS = 15 * 60 * 1000;
  let inFlightRefresh;

  async function readCache() {
    const stored = await chrome.storage.local.get([RATE_KEY, STATUS_KEY]);
    return {
      rate: stored[RATE_KEY] ?? null,
      status: stored[STATUS_KEY] ?? { state: "idle", lastAttemptAt: null },
    };
  }

  function isValidRateResponse(data) {
    return data
      && data.base === "USD"
      && data.quote === "BRL"
      && typeof data.date === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      && Number.isFinite(Date.parse(`${data.date}T00:00:00Z`))
      && new Date(`${data.date}T00:00:00Z`).toISOString().slice(0, 10) === data.date
      && Date.parse(`${data.date}T00:00:00Z`) <= Date.now()
      && Number.isFinite(data.rate)
      && data.rate > 0;
  }

  async function refreshRate({ force = false } = {}) {
    if (inFlightRefresh) return inFlightRefresh;
    inFlightRefresh = performRefresh({ force });
    try {
      return await inFlightRefresh;
    } finally {
      inFlightRefresh = null;
    }
  }

  async function performRefresh({ force }) {
    const now = Date.now();
    const { rate, status } = await readCache();
    const lastAttempt = Date.parse(status.lastAttemptAt ?? "") || 0;

    if (now - lastAttempt < MANUAL_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "cooldown",
        retryAt: new Date(lastAttempt + MANUAL_COOLDOWN_MS).toISOString(),
        rate,
        status,
      };
    }

    const fetchedAt = Date.parse(rate?.fetchedAt ?? "") || 0;
    if (!force && rate && now - fetchedAt < UPDATE_INTERVAL_MS) {
      return { ok: true, reason: "cached", rate, status };
    }

    const attemptAt = new Date(now).toISOString();
    const loadingStatus = { state: "loading", lastAttemptAt: attemptAt, error: null };
    await chrome.storage.local.set({ [STATUS_KEY]: loadingStatus });

    try {
      const response = await fetch("https://api.frankfurter.dev/v2/rate/usd/brl", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!isValidRateResponse(data)) throw new Error("Resposta de câmbio inválida");

      const updatedRate = {
        base: "USD",
        quote: "BRL",
        rate: data.rate,
        rateDate: data.date,
        fetchedAt: new Date().toISOString(),
      };
      const successStatus = {
        state: "ok",
        lastAttemptAt: attemptAt,
        error: null,
      };
      await chrome.storage.local.set({ [RATE_KEY]: updatedRate, [STATUS_KEY]: successStatus });
      return { ok: true, reason: "updated", rate: updatedRate, status: successStatus };
    } catch (error) {
      const failedStatus = {
        state: "error",
        lastAttemptAt: attemptAt,
        error: error instanceof Error ? error.message : "Falha de rede",
      };
      await chrome.storage.local.set({ [STATUS_KEY]: failedStatus });
      return { ok: false, reason: "error", rate, status: failedStatus };
    }
  }

  async function ensureScheduledRefresh() {
    const existing = await chrome.alarms.get(REFRESH_ALARM);
    if (!existing) {
      await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 24 * 60 });
    }
  }

  chrome.runtime.onInstalled.addListener(() => {
    void ensureScheduledRefresh();
    void refreshRate();
  });

  chrome.runtime.onStartup.addListener(() => {
    void ensureScheduledRefresh();
    void refreshRate();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM) void refreshRate();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PMO_REFRESH_USD_BRL") {
      refreshRate({ force: true }).then(sendResponse);
      return true;
    }
    if (message?.type === "PMO_ENSURE_USD_BRL") {
      refreshRate().then(sendResponse);
      return true;
    }
    return false;
  });
})(globalThis);
