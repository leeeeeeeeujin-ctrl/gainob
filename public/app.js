const state = {
  snapshot: null,
  modules: []
};

const elements = {
  coinSelect: document.querySelector("#coinSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  aliasInput: document.querySelector("#aliasInput"),
  styleInput: document.querySelector("#styleInput"),
  riskRuleInput: document.querySelector("#riskRuleInput"),
  watchItemsInput: document.querySelector("#watchItemsInput"),
  noteInput: document.querySelector("#noteInput"),
  focusQuestionInput: document.querySelector("#focusQuestionInput"),
  moduleList: document.querySelector("#moduleList"),
  moduleStatus: document.querySelector("#moduleStatus"),
  bithumbPrice: document.querySelector("#bithumbPrice"),
  bithumbChange: document.querySelector("#bithumbChange"),
  benchmarkPrice: document.querySelector("#benchmarkPrice"),
  benchmarkChange: document.querySelector("#benchmarkChange"),
  premium: document.querySelector("#premium"),
  usdtKrw: document.querySelector("#usdtKrw"),
  fetchedAt: document.querySelector("#fetchedAt"),
  marketDetails: document.querySelector("#marketDetails"),
  candlesOutput: document.querySelector("#candlesOutput"),
  analysisOutput: document.querySelector("#analysisOutput")
};

function formatKrw(value) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function formatUsdt(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits
  }).format(value);
}

function formatPct(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, 2)}%`;
}

function loadPersonalSettings() {
  try {
    const raw = localStorage.getItem("coin-ai-briefing:personal-settings");

    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);
    elements.aliasInput.value = saved.alias || "";
    elements.styleInput.value = saved.style || "";
    elements.riskRuleInput.value = saved.riskRule || "";
    elements.watchItemsInput.value = saved.watchItems || "";
    elements.noteInput.value = saved.note || "";
    elements.focusQuestionInput.value = saved.focusQuestion || "";
  } catch (_error) {
    localStorage.removeItem("coin-ai-briefing:personal-settings");
  }
}

function savePersonalSettings() {
  localStorage.setItem(
    "coin-ai-briefing:personal-settings",
    JSON.stringify({
      alias: elements.aliasInput.value,
      style: elements.styleInput.value,
      riskRule: elements.riskRuleInput.value,
      watchItems: elements.watchItemsInput.value,
      note: elements.noteInput.value,
      focusQuestion: elements.focusQuestionInput.value
    })
  );
}

function setLoading(message) {
  elements.analysisOutput.textContent = message;
}

function renderFacts(snapshot) {
  const rows = [
    ["빗썸 고가", formatKrw(snapshot.bithumb.high24hKrw)],
    ["빗썸 저가", formatKrw(snapshot.bithumb.low24hKrw)],
    ["빗썸 24h 거래량", formatNumber(snapshot.bithumb.volume24h, 4)],
    ["빗썸 24h 거래대금", formatKrw(snapshot.bithumb.value24hKrw)],
    ["빗썸 호가", `${formatKrw(snapshot.bithumb.bidKrw)} / ${formatKrw(snapshot.bithumb.askKrw)}`],
    ["바이낸스 24h 고가", formatUsdt(snapshot.benchmark.high24hUsdt)],
    ["바이낸스 24h 저가", formatUsdt(snapshot.benchmark.low24hUsdt)],
    ["바이낸스 24h 거래량", formatNumber(snapshot.benchmark.volume24h, 4)],
    [
      "바이낸스 호가",
      `${formatUsdt(snapshot.benchmark.bidUsdt)} / ${formatUsdt(snapshot.benchmark.askUsdt)}`
    ]
  ];

  elements.marketDetails.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="fact-row">
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `
    )
    .join("");
}

function renderCandles(snapshot) {
  elements.candlesOutput.textContent = snapshot.candles.length
    ? snapshot.candles
        .map(
          (candle) =>
            `${new Date(candle.timestamp).toLocaleString("ko-KR")} | O ${formatNumber(candle.open)} | H ${formatNumber(candle.high)} | L ${formatNumber(candle.low)} | C ${formatNumber(candle.close)} | V ${formatNumber(candle.volume, 4)}`
        )
        .join("\n")
    : "캔들 데이터를 불러오지 못했습니다.";
}

function renderSnapshot(snapshot) {
  state.snapshot = snapshot;

  elements.bithumbPrice.textContent = formatKrw(snapshot.bithumb.priceKrw);
  elements.bithumbChange.textContent = `24h ${formatPct(snapshot.bithumb.change24hPct)}`;
  elements.benchmarkPrice.textContent = formatKrw(snapshot.benchmark.priceKrw);
  elements.benchmarkChange.textContent = `Binance ${formatPct(snapshot.benchmark.change24hPct)}`;
  elements.premium.textContent = formatPct(snapshot.premiumPct);
  elements.premium.className = snapshot.premiumPct >= 0 ? "positive" : "negative";
  elements.usdtKrw.textContent = `USDT/KRW ${formatKrw(snapshot.usdtKrw)}`;
  elements.fetchedAt.textContent = new Date(snapshot.fetchedAt).toLocaleString("ko-KR");

  renderFacts(snapshot);
  renderCandles(snapshot);
}

function renderModules(modules) {
  state.modules = modules;
  elements.moduleList.innerHTML = modules
    .map(
      (module) => `
        <label class="module-pill ${module.required ? "locked" : ""}">
          <input
            type="checkbox"
            value="${module.id}"
            ${module.defaultEnabled ? "checked" : ""}
            ${module.required ? "disabled" : ""}
          />
          <span>${module.label}</span>
          <small>${module.description}</small>
        </label>
      `
    )
    .join("");
}

function renderModuleStatus(context) {
  if (!context?.modules?.length) {
    elements.moduleStatus.textContent = "아직 수집 전입니다.";
    return;
  }

  elements.moduleStatus.innerHTML = context.modules
    .map((module) => {
      const message = module.error || module.summary || module.status;
      return `<div class="module-result ${module.status}"><strong>${module.label}</strong><span>${message}</span></div>`;
    })
    .join("");
}

function getEnabledModules() {
  return Array.from(elements.moduleList.querySelectorAll("input[type='checkbox']"))
    .filter((input) => input.checked || input.disabled)
    .map((input) => input.value);
}

function buildAnalysisPayload() {
  return {
    symbol: elements.coinSelect.value,
    modules: getEnabledModules(),
    profile: {
      alias: elements.aliasInput.value,
      style: elements.styleInput.value,
      riskRule: elements.riskRuleInput.value,
      watchItems: elements.watchItemsInput.value
    },
    journal: {
      note: elements.noteInput.value,
      focusQuestion: elements.focusQuestionInput.value
    }
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "요청에 실패했습니다.");
  }

  return payload;
}

async function loadCoins() {
  const payload = await fetchJson("/api/coins");

  elements.coinSelect.innerHTML = payload.coins
    .map((coin) => `<option value="${coin.symbol}">${coin.symbol} · ${coin.label}</option>`)
    .join("");
}

async function loadModules() {
  const payload = await fetchJson("/api/modules");
  renderModules(payload.modules);
}

async function refreshMarket() {
  const symbol = elements.coinSelect.value;
  setLoading("시세를 불러오는 중입니다...");

  try {
    const snapshot = await fetchJson(`/api/market/${symbol}`);
    renderSnapshot(snapshot);
    renderModuleStatus(null);
    elements.analysisOutput.textContent = "AI 분석을 요청하면 여기에 결과가 표시됩니다.";
  } catch (error) {
    elements.analysisOutput.textContent = error.message;
  }
}

async function analyze() {
  savePersonalSettings();
  setLoading("AI에 데이터를 보내 분석 중입니다...");

  try {
    const payload = await fetchJson("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildAnalysisPayload())
    });

    if (payload.snapshot) {
      renderSnapshot(payload.snapshot);
    }

    renderModuleStatus(payload.context);
    elements.analysisOutput.textContent = payload.analysis;
  } catch (error) {
    elements.analysisOutput.textContent = error.message;
  }
}

elements.refreshButton.addEventListener("click", refreshMarket);
elements.analyzeButton.addEventListener("click", analyze);

[
  elements.aliasInput,
  elements.styleInput,
  elements.riskRuleInput,
  elements.watchItemsInput,
  elements.noteInput,
  elements.focusQuestionInput
].forEach((element) => {
  element.addEventListener("input", savePersonalSettings);
});

loadPersonalSettings();

Promise.all([loadCoins(), loadModules()])
  .then(refreshMarket)
  .catch((error) => {
    elements.analysisOutput.textContent = error.message;
  });
