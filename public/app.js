const state = {
  briefing: null,
  directionScan: null,
  snapshot: null,
  intelligence: null,
  modules: [],
  activeViewId: "overviewView",
  account: null,
  history: [],
  coins: [],
  timeframes: [],
  marketSearchTerm: "",
  latestMarketRequestId: 0,
  resizeObserver: null,
  aiAnnotations: [],
  overlayIndicatorAnnotations: [],
  overlaySignals: [],
  overlayBias: null,
  manualAnnotations: [],
  focusRegion: null,
  savedFocusRegion: null,
  annotationSourceMap: {},
  selectedAnnotationSource: null,
  overlaySelection: {
    active: false,
    start: null,
    current: null,
    handledPointerUp: false,
    pointerId: null
  },
  overlaySelectionMode: true,
  overlayIndicators: {
    range: true,
    midpoint: true,
    vwap: true,
    trend: false,
    breakout: true,
    pressure: true,
    volume: true
  },
  drawingTool: "move",
  pendingDrawing: null,
  currentConversationId: null,
  conversations: [],
  chatMessages: [],
  chatBusy: false,
  floatingHistoryOpen: false,
  floatingPanel: {
    x: null,
    y: null,
    minimized: false,
    dragging: false,
    offsetX: 0,
    offsetY: 0
  },
  chartGeometry: null,
  chartViewport: null,
  chartNavigator: {
    geometry: null,
    dragMode: null,
    pointerId: null,
    originX: 0,
    startIndex: 0,
    visibleCount: 0
  }
};

const elements = {
  coinSelect: document.querySelector("#coinSelect"),
  timeframeSelect: document.querySelector("#timeframeSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  aiProviderSelect: document.querySelector("#aiProviderSelect"),
  aliasInput: document.querySelector("#aliasInput"),
  styleInput: document.querySelector("#styleInput"),
  riskRuleInput: document.querySelector("#riskRuleInput"),
  watchItemsInput: document.querySelector("#watchItemsInput"),
  noteInput: document.querySelector("#noteInput"),
  focusQuestionInput: document.querySelector("#focusQuestionInput"),
  overlayToggle: document.querySelector("#overlayToggle"),
  overlaySelectionModeButton: document.querySelector("#overlaySelectionModeButton"),
  marketSearchInput: document.querySelector("#marketSearchInput"),
  marketSymbolList: document.querySelector("#marketSymbolList"),
  marketHeadline: document.querySelector("#marketHeadline"),
  marketBrowserMeta: document.querySelector("#marketBrowserMeta"),
  selectedMarketMeta: document.querySelector("#selectedMarketMeta"),
  selectedLocalMeta: document.querySelector("#selectedLocalMeta"),
  timeframeShortcutList: document.querySelector("#timeframeShortcutList"),
  drawingToolList: document.querySelector("#drawingToolList"),
  undoDrawingButton: document.querySelector("#undoDrawingButton"),
  clearDrawingsButton: document.querySelector("#clearDrawingsButton"),
  resetChartViewButton: document.querySelector("#resetChartViewButton"),
  chartInteractionHint: document.querySelector("#chartInteractionHint"),
  moduleList: document.querySelector("#moduleList"),
  moduleStatus: document.querySelector("#moduleStatus"),
  primaryMetricLabel: document.querySelector("#primaryMetricLabel"),
  secondaryMetricLabel: document.querySelector("#secondaryMetricLabel"),
  premiumMetricLabel: document.querySelector("#premiumMetricLabel"),
  bithumbPrice: document.querySelector("#bithumbPrice"),
  bithumbChange: document.querySelector("#bithumbChange"),
  benchmarkPrice: document.querySelector("#benchmarkPrice"),
  benchmarkChange: document.querySelector("#benchmarkChange"),
  premium: document.querySelector("#premium"),
  usdtKrw: document.querySelector("#usdtKrw"),
  fetchedAt: document.querySelector("#fetchedAt"),
  marketDetails: document.querySelector("#marketDetails"),
  marketDetailsMirror: document.querySelector("#marketDetailsMirror"),
  macroStatsOutput: document.querySelector("#macroStatsOutput"),
  newsStatsOutput: document.querySelector("#newsStatsOutput"),
  directionScannerMeta: document.querySelector("#directionScannerMeta"),
  directionScannerList: document.querySelector("#directionScannerList"),
  analysisOutput: document.querySelector("#analysisOutput"),
  analysisOutputMirror: document.querySelector("#analysisOutputMirror"),
  chatContextMeta: document.querySelector("#chatContextMeta"),
  conversationList: document.querySelector("#conversationList"),
  chatMessageList: document.querySelector("#chatMessageList"),
  chatPromptInput: document.querySelector("#chatPromptInput"),
  sendChatButton: document.querySelector("#sendChatButton"),
  newConversationButton: document.querySelector("#newConversationButton"),
  deleteConversationButton: document.querySelector("#deleteConversationButton"),
  floatingChatMessages: document.querySelector("#floatingChatMessages"),
  floatingChatPromptInput: document.querySelector("#floatingChatPromptInput"),
  floatingSendChatButton: document.querySelector("#floatingSendChatButton"),
  floatingConversationList: document.querySelector("#floatingConversationList"),
  floatingBriefingPanel: document.querySelector("#floatingBriefingPanel"),
  floatingBriefingHeader: document.querySelector("#floatingBriefingHeader"),
  floatingBriefingBody: document.querySelector("#floatingBriefingBody"),
  floatingBriefingMeta: document.querySelector("#floatingBriefingMeta"),
  floatingBriefingHistoryButton: document.querySelector("#floatingBriefingHistoryButton"),
  floatingBriefingOpenButton: document.querySelector("#floatingBriefingOpenButton"),
  floatingBriefingMinimizeButton: document.querySelector("#floatingBriefingMinimizeButton"),
  historyMeta: document.querySelector("#historyMeta"),
  historyList: document.querySelector("#historyList"),
  orderbookOutput: document.querySelector("#orderbookOutput"),
  orderbookMeta: document.querySelector("#orderbookMeta"),
  tradesOutput: document.querySelector("#tradesOutput"),
  tradeMeta: document.querySelector("#tradeMeta"),
  annotationList: document.querySelector("#annotationList"),
  annotationSummary: document.querySelector("#annotationSummary"),
  overlayAnalysisStatus: document.querySelector("#overlayAnalysisStatus"),
  overlayIndicatorList: document.querySelector("#overlayIndicatorList"),
  overlaySignalList: document.querySelector("#overlaySignalList"),
  overlayBiasCard: document.querySelector("#overlayBiasCard"),
  overlayAnnotationSource: document.querySelector("#overlayAnnotationSource"),
  overlayAnalyzeButton: document.querySelector("#overlayAnalyzeButton"),
  overlayChatButton: document.querySelector("#overlayChatButton"),
  overlayIndicatorsOnlyButton: document.querySelector("#overlayIndicatorsOnlyButton"),
  overlayUseVisibleRangeButton: document.querySelector("#overlayUseVisibleRangeButton"),
  overlayRestoreSelectionButton: document.querySelector("#overlayRestoreSelectionButton"),
  overlayClearSelectionButton: document.querySelector("#overlayClearSelectionButton"),
  chartHost: document.querySelector(".chart-host"),
  chartCanvas: document.querySelector("#chartCanvas"),
  chartAiOverlay: document.querySelector("#chartAiOverlay"),
  chartDrawingOverlay: document.querySelector("#chartDrawingOverlay"),
  chartSelectionOverlay: document.querySelector("#chartSelectionOverlay"),
  chartNavigator: document.querySelector("#chartNavigator"),
  chartNavigatorMeta: document.querySelector("#chartNavigatorMeta"),
  chartMeta: document.querySelector("#chartMeta"),
  chartSymbolChip: document.querySelector("#chartSymbolChip"),
  chartTimeframeChip: document.querySelector("#chartTimeframeChip"),
  chartPriceChip: document.querySelector("#chartPriceChip"),
  chartComparisonChip: document.querySelector("#chartComparisonChip"),
  accountStatus: document.querySelector("#accountStatus"),
  accountAiProviderSelect: document.querySelector("#accountAiProviderSelect"),
  accountOpenAiKeyInput: document.querySelector("#accountOpenAiKeyInput"),
  accountGeminiKeyInput: document.querySelector("#accountGeminiKeyInput"),
  storedKeySummary: document.querySelector("#storedKeySummary"),
  storedKeyList: document.querySelector("#storedKeyList"),
  saveAiSettingsButton: document.querySelector("#saveAiSettingsButton"),
  aiSettingsStatus: document.querySelector("#aiSettingsStatus"),
  authUsernameInput: document.querySelector("#authUsernameInput"),
  authDisplayNameInput: document.querySelector("#authDisplayNameInput"),
  authPasswordInput: document.querySelector("#authPasswordInput"),
  deletePasswordInput: document.querySelector("#deletePasswordInput"),
  registerButton: document.querySelector("#registerButton"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  deleteAccountButton: document.querySelector("#deleteAccountButton"),
  viewTitle: document.querySelector("#viewTitle"),
  navButtons: Array.from(document.querySelectorAll("[data-view-target]")),
  views: Array.from(document.querySelectorAll("[data-view]"))
};

const viewTitles = {
  overviewView: "전체 요약",
  marketView: "시장 화면",
  briefingView: "AI 채팅",
  journalView: "저널",
  contextView: "개인 설정",
  settingsView: "설정",
  accountView: "계정"
};

const CHART_DRAWING_ENABLED = false;
const CHART_AI_OVERLAY_ENABLED = true;

const OVERLAY_INDICATOR_DEFS = [
  { id: "range", label: "고저 범위" },
  { id: "midpoint", label: "중앙선" },
  { id: "vwap", label: "VWAP" },
  { id: "trend", label: "구간 추세" },
  { id: "breakout", label: "돌파/이탈" },
  { id: "pressure", label: "위꼬리/아래꼬리" },
  { id: "volume", label: "거래량 스파이크" }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatKrw(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatUsdt(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits
  }).format(Number(value || 0));
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  const numeric = Number(value || 0);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatNumber(numeric, 2)}%`;
}

function formatSignedNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  const numeric = Number(value || 0);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatNumber(numeric, maximumFractionDigits)}`;
}

function formatShortTime(value) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function loadPersonalSettings() {
  try {
    const raw = localStorage.getItem("coin-ai-briefing:personal-settings");

    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);
    elements.aliasInput.value = saved.alias || "";
    elements.aiProviderSelect.value = saved.aiProvider || "auto";
    elements.styleInput.value = saved.style || "";
    elements.riskRuleInput.value = saved.riskRule || "";
    elements.watchItemsInput.value = saved.watchItems || "";
    elements.noteInput.value = saved.note || "";
    elements.focusQuestionInput.value = saved.focusQuestion || "";
    elements.overlayToggle.checked = saved.overlayEnabled ?? true;
    state.overlaySelectionMode = saved.overlaySelectionMode ?? true;
    state.activeViewId = saved.activeViewId || state.activeViewId;
    state.marketSearchTerm = saved.marketSearchTerm || "";
    state.floatingPanel.x = Number.isFinite(saved.floatingX) ? saved.floatingX : null;
    state.floatingPanel.y = Number.isFinite(saved.floatingY) ? saved.floatingY : null;
    state.floatingPanel.minimized = Boolean(saved.floatingMinimized);
    const savedOverlayIndicators = saved.overlayIndicators || {};
    state.overlayIndicators = {
      ...state.overlayIndicators,
      ...savedOverlayIndicators
    };
    state.savedFocusRegion = normalizeFocusRegion(saved.focusRegion);
    elements.marketSearchInput.value = state.marketSearchTerm;

    if (saved.selectedCoin) {
      elements.coinSelect.dataset.initialValue = saved.selectedCoin;
    }

    if (saved.selectedTimeframe) {
      elements.timeframeSelect.dataset.initialValue = saved.selectedTimeframe;
    }
  } catch (_error) {
    localStorage.removeItem("coin-ai-briefing:personal-settings");
  }
}

function savePersonalSettings() {
  localStorage.setItem(
    "coin-ai-briefing:personal-settings",
    JSON.stringify({
      alias: elements.aliasInput.value,
      aiProvider: elements.aiProviderSelect.value || "auto",
      style: elements.styleInput.value,
      riskRule: elements.riskRuleInput.value,
      watchItems: elements.watchItemsInput.value,
      note: elements.noteInput.value,
      focusQuestion: elements.focusQuestionInput.value,
      activeViewId: state.activeViewId,
      selectedCoin: elements.coinSelect.value || "BTC",
      selectedTimeframe: elements.timeframeSelect.value || "1h",
      marketSearchTerm: state.marketSearchTerm,
      overlayEnabled: elements.overlayToggle.checked,
      overlaySelectionMode: state.overlaySelectionMode,
      overlayIndicators: state.overlayIndicators,
      focusRegion: state.savedFocusRegion || state.focusRegion,
      floatingX: state.floatingPanel.x,
      floatingY: state.floatingPanel.y,
      floatingMinimized: state.floatingPanel.minimized
    })
  );
}

function setAnalysisMessage(message) {
  elements.analysisOutput.textContent = message;
  elements.analysisOutputMirror.textContent = message;
}

function setAiSettingsStatus(message) {
  elements.aiSettingsStatus.textContent = message;
}

function setStoredKeySummary(message) {
  if (elements.storedKeySummary) {
    elements.storedKeySummary.textContent = message;
  }
}

function setOverlayAnalysisStatus(message) {
  if (elements.overlayAnalysisStatus) {
    elements.overlayAnalysisStatus.textContent = message;
  }
}

function renderOverlaySelectionModeButton() {
  if (!elements.overlaySelectionModeButton) {
    return;
  }

  const active = Boolean(CHART_AI_OVERLAY_ENABLED && elements.overlayToggle?.checked && state.overlaySelectionMode);
  elements.overlaySelectionModeButton.classList.toggle("is-active", active);
  elements.overlaySelectionModeButton.disabled = !CHART_AI_OVERLAY_ENABLED || !elements.overlayToggle?.checked;
  elements.overlaySelectionModeButton.textContent = active ? "구간 선택 중" : "구간 선택 모드";
}

function syncChartFeatureAvailability() {
  const drawingControl = elements.drawingToolList?.closest(".quick-control");
  const overlayToggleControl = elements.overlayToggle?.closest(".overlay-toggle");
  const overlayPanel = elements.overlayAnalysisStatus?.closest(".overlay-analysis-panel");
  const annotationPanel = elements.annotationList?.closest(".panel-card");

  if (drawingControl) {
    drawingControl.hidden = !CHART_DRAWING_ENABLED;
  }

  if (overlayToggleControl) {
    overlayToggleControl.hidden = !CHART_AI_OVERLAY_ENABLED;
  }

  if (overlayPanel) {
    overlayPanel.hidden = !CHART_AI_OVERLAY_ENABLED;
  }

  if (annotationPanel) {
    annotationPanel.hidden = !CHART_DRAWING_ENABLED && !CHART_AI_OVERLAY_ENABLED;
  }

  if (elements.overlayToggle) {
    if (!CHART_AI_OVERLAY_ENABLED) {
      elements.overlayToggle.checked = false;
    }
    elements.overlayToggle.disabled = !CHART_AI_OVERLAY_ENABLED;
  }

  if (!CHART_DRAWING_ENABLED) {
    state.drawingTool = "move";
    state.pendingDrawing = null;
    state.manualAnnotations = [];
  }

  if (!CHART_DRAWING_ENABLED && !CHART_AI_OVERLAY_ENABLED) {
    state.focusRegion = null;
  }

  if (!CHART_AI_OVERLAY_ENABLED) {
    state.overlaySelectionMode = false;
    state.aiAnnotations = [];
    state.overlayIndicatorAnnotations = [];
    state.overlaySignals = [];
    state.overlayBias = null;
    state.selectedAnnotationSource = null;
  }

  renderOverlaySelectionModeButton();
}

function isOverlaySelectionMode() {
  return Boolean(CHART_AI_OVERLAY_ENABLED && elements.overlayToggle?.checked && state.overlaySelectionMode && state.drawingTool === "move");
}

function updateChartOverlayMode() {
  if (!elements.chartHost) {
    return;
  }

  elements.chartHost.classList.toggle("is-overlay-mode", Boolean(CHART_AI_OVERLAY_ENABLED && elements.overlayToggle?.checked));
  elements.chartHost.classList.toggle("is-selecting", isOverlaySelectionMode() || state.overlaySelection.active);
  if (elements.chartSelectionOverlay) {
    const active = isOverlaySelectionMode() || state.overlaySelection.active;
    elements.chartSelectionOverlay.classList.toggle("is-active", active);
    elements.chartSelectionOverlay.classList.toggle("is-dragging", Boolean(state.overlaySelection.active));
    elements.chartSelectionOverlay.setAttribute("aria-hidden", active ? "false" : "true");
  }
  renderOverlaySelectionModeButton();
}

function renderOverlayIndicatorControls() {
  if (!elements.overlayIndicatorList) {
    return;
  }

  elements.overlayIndicatorList.innerHTML = OVERLAY_INDICATOR_DEFS
    .map(
      (indicator) => `
        <button
          class="overlay-indicator-chip ${state.overlayIndicators[indicator.id] ? "is-active" : ""}"
          data-overlay-indicator="${indicator.id}"
          type="button"
        >
          ${escapeHtml(indicator.label)}
        </button>
      `
    )
    .join("");
}

function renderOverlaySignalList() {
  if (!elements.overlaySignalList) {
    return;
  }

  if (!state.overlaySignals.length) {
    elements.overlaySignalList.innerHTML = '<div class="overlay-signal-card is-neutral"><strong>신호 대기</strong><span>구간을 선택하면 상승/하락 신호를 요약합니다.</span></div>';
    return;
  }

  elements.overlaySignalList.innerHTML = state.overlaySignals
    .map(
      (signal) => `
        <article class="overlay-signal-card is-${escapeHtml(signal.tone || "neutral")}">
          <strong>${escapeHtml(signal.label)}</strong>
          <span>${escapeHtml(signal.value || "-")}</span>
          <span>${escapeHtml(signal.reason || "")}</span>
        </article>
      `
    )
    .join("");
}

function renderOverlayBiasCard() {
  if (!elements.overlayBiasCard) {
    return;
  }

  if (!state.overlayBias) {
    elements.overlayBiasCard.innerHTML = '<div class="overlay-bias-card is-neutral"><strong>현재 바이어스 없음</strong><span>구간을 선택하면 상승/하락 우위를 종합합니다.</span></div>';
    return;
  }

  elements.overlayBiasCard.innerHTML = `
    <div class="overlay-bias-card is-${escapeHtml(state.overlayBias.tone || "neutral")}">
      <strong>${escapeHtml(state.overlayBias.label || "현재 바이어스")}</strong>
      <span>${escapeHtml(state.overlayBias.summary || "")}</span>
      <span>${escapeHtml(state.overlayBias.reason || "")}</span>
    </div>
  `;
}

function renderOverlayAnnotationSource() {
  if (!elements.overlayAnnotationSource) {
    return;
  }

  const source = state.selectedAnnotationSource;
  if (!source) {
    elements.overlayAnnotationSource.innerHTML = '<div class="overlay-annotation-source"><strong>주석 출처</strong><span>AI 주석을 클릭하면 어떤 메시지에서 생성됐는지 표시합니다.</span></div>';
    return;
  }

  elements.overlayAnnotationSource.innerHTML = `
    <div class="overlay-annotation-source">
      <strong>${escapeHtml(source.label || "주석 출처")}</strong>
      <span>${escapeHtml(source.createdAtLabel || "")}</span>
      <div class="overlay-annotation-source-body">${escapeHtml(source.fullMessage || source.messagePreview || "")}</div>
      <button class="button ghost overlay-source-jump" data-jump-chat-message-id="${escapeHtml(source.messageId || "")}" type="button">해당 메시지로 이동</button>
    </div>
  `;
}

function buildOverlaySignals(snapshot, focusRegion) {
  const regionCandles = getRegionCandles(snapshot, focusRegion);

  if (!regionCandles.length) {
    return [];
  }

  const firstCandle = regionCandles[0];
  const lastCandle = regionCandles[regionCandles.length - 1];
  const highest = Math.max(...regionCandles.map((candle) => Number(candle.high || 0)));
  const lowest = Math.min(...regionCandles.map((candle) => Number(candle.low || 0)));
  const range = Math.max(highest - lowest, 0.0001);
  const netChangePct = ((Number(lastCandle.close || 0) - Number(firstCandle.open || 0)) / Math.max(Number(firstCandle.open || 1), 1)) * 100;
  const closeLocation = ((Number(lastCandle.close || 0) - lowest) / range) * 100;
  const positiveCloseCount = regionCandles.filter((candle) => Number(candle.close || 0) >= Number(candle.open || 0)).length;
  const controlPct = (positiveCloseCount / Math.max(regionCandles.length, 1)) * 100;
  const averageVolume = regionCandles.reduce((sum, candle) => sum + Number(candle.volume || 0), 0) / Math.max(regionCandles.length, 1);
  const lastVolumeRatio = Number(lastCandle.volume || 0) / Math.max(averageVolume, 0.0001);
  const upperWickTotal = regionCandles.reduce((sum, candle) => sum + Math.max(Number(candle.high || 0) - Math.max(Number(candle.open || 0), Number(candle.close || 0)), 0), 0);
  const lowerWickTotal = regionCandles.reduce((sum, candle) => sum + Math.max(Math.min(Number(candle.open || 0), Number(candle.close || 0)) - Number(candle.low || 0), 0), 0);
  const bodyControlTone = netChangePct > 1.2 && closeLocation >= 65 && controlPct >= 55 ? "bullish" : netChangePct < -1.2 && closeLocation <= 35 && controlPct <= 45 ? "bearish" : "neutral";
  const wickTone = lowerWickTotal > upperWickTotal * 1.18 ? "bullish" : upperWickTotal > lowerWickTotal * 1.18 ? "bearish" : "neutral";
  const volumeTone = lastVolumeRatio >= 1.6 && netChangePct > 0 ? "bullish" : lastVolumeRatio >= 1.6 && netChangePct < 0 ? "bearish" : "neutral";
  const priorCandles = regionCandles.slice(0, -1);
  const priorHigh = priorCandles.length ? Math.max(...priorCandles.map((candle) => Number(candle.high || 0))) : highest;
  const priorLow = priorCandles.length ? Math.min(...priorCandles.map((candle) => Number(candle.low || 0))) : lowest;
  const breakoutTone = Number(lastCandle.close || 0) > priorHigh ? "bullish" : Number(lastCandle.close || 0) < priorLow ? "bearish" : "neutral";
  const midpoint = lowest + range / 2;
  const reclaimTone = Number(lastCandle.low || 0) < midpoint && Number(lastCandle.close || 0) > midpoint
    ? "bullish"
    : Number(lastCandle.high || 0) > midpoint && Number(lastCandle.close || 0) < midpoint
      ? "bearish"
      : "neutral";
  const bodySizeSum = regionCandles.reduce(
    (sum, candle) => sum + Math.abs(Number(candle.close || 0) - Number(candle.open || 0)),
    0
  );
  const wickSizeSum = upperWickTotal + lowerWickTotal;
  const absorptionTone = wickSizeSum > bodySizeSum * 1.15
    ? lowerWickTotal > upperWickTotal
      ? "bullish"
      : "bearish"
    : "neutral";

  return [
    {
      label: "구간 방향",
      value: formatPct(netChangePct),
      tone: bodyControlTone,
      reason: "시작 시가 대비 종료 종가 변화"
    },
    {
      label: "종가 위치",
      value: `${formatNumber(closeLocation, 1)} / 100`,
      tone: closeLocation >= 70 ? "bullish" : closeLocation <= 30 ? "bearish" : "neutral",
      reason: "고저 범위 안에서 마지막 종가 위치"
    },
    {
      label: "캔들 주도권",
      value: `${formatNumber(controlPct, 0)}% 양봉`,
      tone: controlPct >= 58 ? "bullish" : controlPct <= 42 ? "bearish" : "neutral",
      reason: "구간 내 양봉 비중"
    },
    {
      label: "꼬리 압력",
      value: lowerWickTotal > upperWickTotal ? "아래꼬리 우세" : upperWickTotal > lowerWickTotal ? "위꼬리 우세" : "균형",
      tone: wickTone,
      reason: "매수/매도 거절 흔적 추정"
    },
    {
      label: "거래량 참여",
      value: `${formatNumber(lastVolumeRatio, 2)}x`,
      tone: volumeTone,
      reason: "마지막 봉 거래량 / 구간 평균"
    },
    {
      label: "돌파 상태",
      value: breakoutTone === "bullish" ? "직전 구간 상단 돌파" : breakoutTone === "bearish" ? "직전 구간 하단 이탈" : "아직 범위 내부",
      tone: breakoutTone,
      reason: "마지막 종가 기준"
    },
    {
      label: "리클레임/실패",
      value: reclaimTone === "bullish" ? "중앙값 리클레임" : reclaimTone === "bearish" ? "중앙값 재이탈" : "중립",
      tone: reclaimTone,
      reason: `선택 구간 중간값 ${formatNumber(midpoint, 2)} 기준 종가 복귀 여부`
    },
    {
      label: "흡수/분배",
      value: absorptionTone === "bullish" ? "저가 흡수" : absorptionTone === "bearish" ? "고가 분배" : "방향성 약함",
      tone: absorptionTone,
      reason: "꼬리 총합 대비 몸통 총합으로 체결 흡수 성격 추정"
    }
  ];
}

function buildOverlayBias(signals) {
  if (!Array.isArray(signals) || !signals.length) {
    return null;
  }

  const signalWeights = {
    "구간 방향": 2.2,
    "종가 위치": 1.4,
    "캔들 주도권": 1.2,
    "꼬리 압력": 1,
    "거래량 참여": 1.3,
    "돌파 상태": 2,
    "리클레임/실패": 1.6,
    "흡수/분배": 1.4
  };

  const score = signals.reduce((sum, signal) => {
    const weight = signalWeights[signal.label] || 1;
    if (signal.tone === "bullish") {
      return sum + weight;
    }
    if (signal.tone === "bearish") {
      return sum - weight;
    }
    return sum;
  }, 0);

  const tone = score >= 2.5 ? "bullish" : score <= -2.5 ? "bearish" : "neutral";
  const label = tone === "bullish" ? "현재 바이어스: 상승 우위" : tone === "bearish" ? "현재 바이어스: 하락 우위" : "현재 바이어스: 중립";
  const bullishCount = signals.filter((signal) => signal.tone === "bullish").length;
  const bearishCount = signals.filter((signal) => signal.tone === "bearish").length;
  const summary = `점수 ${formatNumber(score, 1)} · 강세 ${bullishCount} / 약세 ${bearishCount}`;
  const dominantSignals = signals
    .filter((signal) => signal.tone === tone && tone !== "neutral")
    .sort((left, right) => (signalWeights[right.label] || 1) - (signalWeights[left.label] || 1));
  const strongest = dominantSignals[0] || signals.find((signal) => signal.tone !== "neutral");

  return {
    tone,
    label,
    summary,
    reason: strongest ? `${strongest.label}: ${strongest.reason}` : "유의미한 방향 신호가 부족합니다."
  };
}

function getRegionCandles(snapshot, focusRegion) {
  if (!snapshot?.candles?.length || !focusRegion) {
    return [];
  }

  return snapshot.candles.filter(
    (candle) => Number(candle.timestamp) >= focusRegion.startTime && Number(candle.timestamp) <= focusRegion.endTime
  );
}

function buildOverlayIndicatorAnnotations(snapshot, focusRegion) {
  const regionCandles = getRegionCandles(snapshot, focusRegion);

  if (!regionCandles.length || !focusRegion) {
    return [];
  }

  const firstCandle = regionCandles[0];
  const lastCandle = regionCandles[regionCandles.length - 1];
  const highest = Math.max(...regionCandles.map((candle) => Number(candle.high || 0)));
  const lowest = Math.min(...regionCandles.map((candle) => Number(candle.low || 0)));
  const midpoint = (highest + lowest) / 2;
  const vwapNumerator = regionCandles.reduce(
    (sum, candle) => sum + ((Number(candle.high || 0) + Number(candle.low || 0) + Number(candle.close || 0)) / 3) * Number(candle.volume || 0),
    0
  );
  const totalVolume = regionCandles.reduce((sum, candle) => sum + Number(candle.volume || 0), 0);
  const vwap = totalVolume ? vwapNumerator / totalVolume : midpoint;
  const priorCandles = regionCandles.slice(0, -1);
  const priorHigh = priorCandles.length ? Math.max(...priorCandles.map((candle) => Number(candle.high || 0))) : highest;
  const priorLow = priorCandles.length ? Math.min(...priorCandles.map((candle) => Number(candle.low || 0))) : lowest;
  const averageVolume = totalVolume / Math.max(regionCandles.length, 1);
  const upperWick = Math.max(Number(lastCandle.high || 0) - Math.max(Number(lastCandle.open || 0), Number(lastCandle.close || 0)), 0);
  const lowerWick = Math.max(Math.min(Number(lastCandle.open || 0), Number(lastCandle.close || 0)) - Number(lastCandle.low || 0), 0);
  const annotations = [];

  if (state.overlayIndicators.range) {
    annotations.push(
      {
        id: `indicator-range-high-${focusRegion.id}`,
        type: "line",
        source: "indicator",
        label: "구간 고점",
        reason: `선택 구간 최고가 ${formatNumber(highest, 2)}`,
        color: "#f87171",
        from: { time: firstCandle.timestamp, price: highest },
        to: { time: lastCandle.timestamp, price: highest }
      },
      {
        id: `indicator-range-low-${focusRegion.id}`,
        type: "line",
        source: "indicator",
        label: "구간 저점",
        reason: `선택 구간 최저가 ${formatNumber(lowest, 2)}`,
        color: "#34d399",
        from: { time: firstCandle.timestamp, price: lowest },
        to: { time: lastCandle.timestamp, price: lowest }
      }
    );
  }

  if (state.overlayIndicators.midpoint) {
    annotations.push({
      id: `indicator-midpoint-${focusRegion.id}`,
      type: "line",
      source: "indicator",
      label: "구간 중앙선",
      reason: `고점/저점 중앙값 ${formatNumber(midpoint, 2)}`,
      color: "#fbbf24",
      from: { time: firstCandle.timestamp, price: midpoint },
      to: { time: lastCandle.timestamp, price: midpoint }
    });
  }

  if (state.overlayIndicators.vwap) {
    annotations.push({
      id: `indicator-vwap-${focusRegion.id}`,
      type: "line",
      source: "indicator",
      label: "구간 VWAP",
      reason: `거래량 가중 평균가 ${formatNumber(vwap, 2)}`,
      color: "#60a5fa",
      from: { time: firstCandle.timestamp, price: vwap },
      to: { time: lastCandle.timestamp, price: vwap }
    });
  }

  if (state.overlayIndicators.trend) {
    annotations.push({
      id: `indicator-trend-${focusRegion.id}`,
      type: "line",
      source: "indicator",
      label: "구간 추세",
      reason: `구간 시작 종가 ${formatNumber(firstCandle.close, 2)} -> 종료 종가 ${formatNumber(lastCandle.close, 2)}`,
      color: "#c084fc",
      from: { time: firstCandle.timestamp, price: Number(firstCandle.close || 0) },
      to: { time: lastCandle.timestamp, price: Number(lastCandle.close || 0) }
    });
  }

  if (state.overlayIndicators.breakout) {
    if (Number(lastCandle.close || 0) > priorHigh) {
      annotations.push({
        id: `indicator-breakout-up-${focusRegion.id}`,
        type: "marker",
        source: "indicator",
        label: "상단 돌파",
        reason: `마지막 종가가 직전 고점 ${formatNumber(priorHigh, 2)} 위`,
        color: "#22c55e",
        time: lastCandle.timestamp,
        price: Number(lastCandle.close || 0)
      });
    } else if (Number(lastCandle.close || 0) < priorLow) {
      annotations.push({
        id: `indicator-breakout-down-${focusRegion.id}`,
        type: "marker",
        source: "indicator",
        label: "하단 이탈",
        reason: `마지막 종가가 직전 저점 ${formatNumber(priorLow, 2)} 아래`,
        color: "#ef4444",
        time: lastCandle.timestamp,
        price: Number(lastCandle.close || 0)
      });
    }
  }

  if (state.overlayIndicators.pressure) {
    annotations.push({
      id: `indicator-pressure-${focusRegion.id}`,
      type: "marker",
      source: "indicator",
      label: lowerWick > upperWick ? "매수 거절 방어" : upperWick > lowerWick ? "매도 거절 압력" : "꼬리 균형",
      reason: lowerWick > upperWick ? "아래꼬리가 더 길어 저가 방어 흔적" : upperWick > lowerWick ? "위꼬리가 더 길어 상단 매도 압력" : "상하 꼬리 균형",
      color: lowerWick > upperWick ? "#34d399" : upperWick > lowerWick ? "#f87171" : "#94a3b8",
      time: lastCandle.timestamp,
      price: lowerWick > upperWick ? Number(lastCandle.low || 0) : Number(lastCandle.high || 0)
    });
  }

  if (state.overlayIndicators.volume && Number(lastCandle.volume || 0) >= averageVolume * 1.6) {
    annotations.push({
      id: `indicator-volume-${focusRegion.id}`,
      type: "marker",
      source: "indicator",
      label: "거래량 스파이크",
      reason: `평균 대비 ${formatNumber(Number(lastCandle.volume || 0) / Math.max(averageVolume, 0.0001), 2)}배`,
      color: "#38bdf8",
      time: lastCandle.timestamp,
      price: Number(lastCandle.close || 0)
    });
  }

  return annotations;
}

function refreshOverlayIndicators() {
  state.overlayIndicatorAnnotations = state.focusRegion && state.snapshot ? buildOverlayIndicatorAnnotations(state.snapshot, state.focusRegion) : [];
  state.overlaySignals = state.focusRegion && state.snapshot ? buildOverlaySignals(state.snapshot, state.focusRegion) : [];
  state.overlayBias = buildOverlayBias(state.overlaySignals);
  renderAnnotationList();
  renderOverlaySignalList();
  renderOverlayBiasCard();
  renderOverlayAnnotationSource();
  renderChartOverlay();
}

function seedOverlayChatPrompt() {
  const prompt = `${elements.coinSelect.value} ${elements.timeframeSelect.value} 기준으로 방금 선택한 구간의 상승/하락 신호, 돌파 여부, 거래량 참여, 위꼬리/아래꼬리 해석을 설명해줘.`;
  if (elements.chatPromptInput) {
    elements.chatPromptInput.value = prompt;
  }
  if (elements.floatingChatPromptInput) {
    elements.floatingChatPromptInput.value = prompt;
  }
}

async function requestOverlayAnalysis() {
  if (!state.snapshot || !state.focusRegion || !elements.overlayToggle?.checked) {
    return;
  }

  setOverlayAnalysisStatus("선택 구간 분석 중");

  try {
    const payload = await fetchJson("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildAnalysisPayload())
    });

    state.aiAnnotations = Array.isArray(payload.annotations) ? payload.annotations : [];
    refreshOverlayIndicators();
    setAnalysisMessage(payload.analysis || "선택 구간 분석이 완료되었습니다.");
    setOverlayAnalysisStatus("선택 구간 분석 완료");
  } catch (error) {
    setAnalysisMessage(error.message);
    setOverlayAnalysisStatus("선택 구간 분석 실패");
  }
}

function renderStoredKeyList(keys = {}) {
  if (!elements.storedKeyList) {
    return;
  }

  const aiSettings = state.account?.aiSettings || {};
  const items = [
    {
      provider: "openai",
      label: "GPT",
      masked: keys.openai?.masked,
      present: Boolean(keys.openai?.present),
      model: aiSettings.openAiModel || "gpt-4.1-mini"
    },
    {
      provider: "gemini",
      label: "Gemini",
      masked: keys.gemini?.masked,
      present: Boolean(keys.gemini?.present),
      model: aiSettings.geminiModel || "gemini-2.5-flash"
    }
  ];

  elements.storedKeyList.innerHTML = items
    .map(
      (item) => `
        <article class="stored-key-row ${item.present ? "is-present" : "is-empty"}">
          <div class="stored-key-copy">
            <strong>${item.label}</strong>
            <span>${item.present ? `${escapeHtml(item.masked)} · 기본 모델 ${escapeHtml(item.model)}` : "저장된 키 없음"}</span>
          </div>
          <div class="stored-key-actions">
            <button class="button ghost stored-key-delete" data-provider="${item.provider}" type="button" ${item.present ? "" : "disabled"}>삭제</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadStoredKeys() {
  if (!state.account?.authenticated) {
    setStoredKeySummary("로그인 후 저장된 키 목록을 확인할 수 있습니다.");
    renderStoredKeyList({});
    return;
  }

  try {
    const payload = await fetchJson("/api/account/keys");
    const openAi = payload.keys?.openai;
    const gemini = payload.keys?.gemini;
    setStoredKeySummary(
      `저장된 키 · GPT ${openAi?.present ? openAi.masked : "없음"} / Gemini ${
        gemini?.present ? gemini.masked : "없음"
      }`
    );
    renderStoredKeyList(payload.keys || {});
  } catch (_error) {
    setStoredKeySummary("저장된 키 상태를 불러오지 못했습니다.");
    renderStoredKeyList({});
  }
}

function updateChatContextMeta() {
  if (!elements.chatContextMeta) {
    return;
  }

  const symbol = elements.coinSelect?.value || "BTC";
  const timeframe = elements.timeframeSelect?.value || "1h";
  const currentConversation = state.conversations.find((item) => item.id === state.currentConversationId);
  const title = currentConversation?.title ? ` · ${currentConversation.title}` : "";
  const focusRegionLabel = state.focusRegion ? " · 질문 구간 선택됨" : "";
  elements.chatContextMeta.textContent = `현재 대화 기준: ${symbol} · ${timeframe}${title}${focusRegionLabel}. 대화 중 AI는 이 종목 컨텍스트와 최근 대화를 함께 사용합니다.`;
}

function parseMessageMeta(meta) {
  if (!meta) {
    return null;
  }

  if (typeof meta === "string") {
    try {
      return JSON.parse(meta);
    } catch (_error) {
      return null;
    }
  }

  return typeof meta === "object" ? meta : null;
}

function buildAnnotationSourceMap(messages = state.chatMessages) {
  return (Array.isArray(messages) ? messages : []).reduce((map, message, index) => {
    const meta = parseMessageMeta(message.meta);
    const annotations = Array.isArray(meta?.annotations) ? meta.annotations : [];
    if (!annotations.length) {
      return map;
    }

    const messageId = message.id || `chat-message-${index}`;
    const createdAtLabel = message.created_at ? formatShortTime(message.created_at) : "방금";
    const messagePreview = String(message.content || "").trim().slice(0, 140) || "AI 응답";
    const fullMessage = String(message.content || "").trim() || "AI 응답";

    annotations.forEach((annotation) => {
      const annotationId = annotation?.id || annotation?.label;
      if (!annotationId) {
        return;
      }

      map[annotationId] = {
        messageId,
        label: annotation.label || "AI 주석",
        messagePreview,
        fullMessage,
        createdAtLabel
      };
    });

    return map;
  }, {});
}

function focusLinkedChatMessage(messageId) {
  if (!messageId) {
    return;
  }

  [elements.chatMessageList, elements.floatingChatMessages].forEach((container) => {
    const target = container?.querySelector?.(`[data-chat-message-id="${CSS.escape(messageId)}"]`);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("is-linked");
    window.setTimeout(() => target.classList.remove("is-linked"), 1600);
  });
}

function normalizeFocusRegion(region) {
  if (!region || typeof region !== "object") {
    return null;
  }

  const startTime = Number(region.startTime);
  const endTime = Number(region.endTime);
  const minPrice = Number(region.minPrice);
  const maxPrice = Number(region.maxPrice);

  if (![startTime, endTime, minPrice, maxPrice].every(Number.isFinite)) {
    return null;
  }

  return {
    id: region.id || "focus-region",
    type: "zone",
    role: "focus-region",
    source: "focus",
    symbol: String(region.symbol || elements.coinSelect?.value || "").toUpperCase(),
    timeframe: String(region.timeframe || elements.timeframeSelect?.value || "1h").toLowerCase(),
    label: region.label || "질문 구간",
    reason: region.reason || "이번 질문에서 우선 해석할 범위",
    color: region.color || "rgba(96, 165, 250, 0.16)",
    lineColor: region.lineColor || "#60a5fa",
    startTime: Math.min(startTime, endTime),
    endTime: Math.max(startTime, endTime),
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice: Math.max(minPrice, maxPrice)
  };
}

function clearFocusRegion(options = {}) {
  const { message = "선택 구간을 해제했습니다.", preserveStatus = false } = options;
  state.focusRegion = null;
  state.aiAnnotations = [];
  state.overlayIndicatorAnnotations = [];
  state.overlaySignals = [];
  state.overlayBias = null;
  state.annotationSourceMap = {};
  state.selectedAnnotationSource = null;
  savePersonalSettings();
  renderAnnotationList();
  renderOverlaySignalList();
  renderOverlayBiasCard();
  renderOverlayAnnotationSource();
  renderChartOverlay();
  renderChartNavigator(state.snapshot);
  updateChatContextMeta();
  if (!preserveStatus) {
    setOverlayAnalysisStatus(message);
  }
}

function buildFocusRegionFromVisibleRange(snapshot) {
  const visibleCandles = getVisibleCandles(snapshot);
  if (!visibleCandles.length) {
    return null;
  }

  return {
    id: `visible-focus-${Date.now()}`,
    label: "현재 화면 구간",
    reason: "현재 보이는 차트 범위를 기준으로 생성",
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    startTime: Number(visibleCandles[0].timestamp),
    endTime: Number(visibleCandles[visibleCandles.length - 1].timestamp),
    minPrice: Math.min(...visibleCandles.map((candle) => Number(candle.low || 0))),
    maxPrice: Math.max(...visibleCandles.map((candle) => Number(candle.high || 0)))
  };
}

function buildFocusRegionFromSelection(snapshot, startPoint, endPoint) {
  if (!snapshot?.candles?.length || !startPoint || !endPoint) {
    return null;
  }

  const startTime = Math.min(Number(startPoint.time), Number(endPoint.time));
  const endTime = Math.max(Number(startPoint.time), Number(endPoint.time));
  const regionCandles = snapshot.candles.filter(
    (candle) => Number(candle.timestamp) >= startTime && Number(candle.timestamp) <= endTime
  );

  if (!regionCandles.length) {
    return null;
  }

  const rawMinPrice = Math.min(Number(startPoint.price), Number(endPoint.price));
  const rawMaxPrice = Math.max(Number(startPoint.price), Number(endPoint.price));
  const priceDistance = Math.abs(Number(endPoint.price) - Number(startPoint.price));
  const candleMinPrice = Math.min(...regionCandles.map((candle) => Number(candle.low || 0)));
  const candleMaxPrice = Math.max(...regionCandles.map((candle) => Number(candle.high || 0)));
  const useCandleRange = priceDistance < Math.max((candleMaxPrice - candleMinPrice) * 0.08, 0.5);

  return {
    id: `focus-${Date.now()}`,
    label: "AI 분석 구간",
    reason: "오버레이 드래그 선택",
    color: "rgba(96, 165, 250, 0.16)",
    lineColor: "#60a5fa",
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    startTime,
    endTime,
    minPrice: useCandleRange ? candleMinPrice : rawMinPrice,
    maxPrice: useCandleRange ? candleMaxPrice : rawMaxPrice
  };
}

function restoreSavedFocusRegion(snapshot) {
  const saved = normalizeFocusRegion(state.savedFocusRegion);
  if (!saved) {
    return false;
  }

  if ((saved.symbol && saved.symbol !== snapshot.symbol) || (saved.timeframe && saved.timeframe !== snapshot.timeframe)) {
    return false;
  }

  const regionCandles = getRegionCandles(snapshot, saved);
  if (!regionCandles.length) {
    return false;
  }

  state.focusRegion = saved;
  refreshOverlayIndicators();
  return true;
}

function syncConversationVisualState(messages = state.chatMessages) {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const latestFocusRegion = normalizedMessages
    .slice()
    .reverse()
    .map((message) => normalizeFocusRegion(parseMessageMeta(message.meta)?.focusRegion))
    .find(Boolean);
  const latestAiAnnotations = normalizedMessages
    .slice()
    .reverse()
    .map((message) => parseMessageMeta(message.meta)?.annotations)
    .find((annotations) => Array.isArray(annotations));

  state.focusRegion = latestFocusRegion || null;
  state.savedFocusRegion = latestFocusRegion || state.savedFocusRegion;
  state.aiAnnotations = Array.isArray(latestAiAnnotations) ? latestAiAnnotations : [];
  state.annotationSourceMap = buildAnnotationSourceMap(normalizedMessages);
  state.selectedAnnotationSource = null;
  refreshOverlayIndicators();
  updateChatContextMeta();
}

function renderChatMessages() {
  if (!elements.chatMessageList && !elements.floatingChatMessages) {
    return;
  }

  const emptyMessage = "대화를 시작하면 메시지가 여기에 표시됩니다.";

  if (!state.chatMessages.length) {
    if (elements.chatMessageList) {
      elements.chatMessageList.innerHTML = emptyMessage;
    }
    if (elements.floatingChatMessages) {
      elements.floatingChatMessages.innerHTML = emptyMessage;
    }
    return;
  }

  const html = state.chatMessages
    .map((message, index) => {
      const messageId = message.id || `chat-message-${index}`;
      return `
        <article class="chat-message ${message.sender === "ai" ? "is-ai" : "is-user"}" data-chat-message-id="${escapeHtml(messageId)}">
          <header>
            <strong>${message.sender === "ai" ? "AI" : "나"}</strong>
            <span>${message.created_at ? formatShortTime(message.created_at) : "방금"}</span>
          </header>
          <div class="chat-message-body">${escapeHtml(message.content || "")}</div>
        </article>
      `;
    })
    .join("");

  if (elements.chatMessageList) {
    elements.chatMessageList.innerHTML = html;
    elements.chatMessageList.scrollTop = elements.chatMessageList.scrollHeight;
  }
  if (elements.floatingChatMessages) {
    elements.floatingChatMessages.innerHTML = html;
    elements.floatingChatMessages.scrollTop = elements.floatingChatMessages.scrollHeight;
  }
}

function renderConversationList() {
  const html = !state.conversations.length
    ? "대화 내역이 없습니다."
    : state.conversations
    .map(
      (conversation) => `
        <button class="floating-conversation-item ${conversation.id === state.currentConversationId ? "is-active" : ""}" data-conversation-id="${conversation.id}" type="button">
          <strong>${escapeHtml(conversation.title || `${conversation.symbol || "시장"} 대화`)}</strong>
          <span>${escapeHtml(conversation.symbol || "-")} · ${escapeHtml(conversation.timeframe || "-")}</span>
        </button>
      `
    )
    .join("");

  if (elements.conversationList) {
    elements.conversationList.innerHTML = html;
  }

  if (!elements.floatingConversationList) {
    return;
  }

  elements.floatingConversationList.hidden = !state.floatingHistoryOpen;
  if (!state.floatingHistoryOpen) {
    return;
  }

  elements.floatingConversationList.innerHTML = html;
}

async function loadConversation(conversationId) {
  const payload = await fetchJson(`/api/conversations/${encodeURIComponent(conversationId)}`);
  state.currentConversationId = conversationId;
  state.chatMessages = payload.messages || [];
  renderConversationList();
  renderChatMessages();
  syncConversationVisualState(state.chatMessages);
}

async function loadConversations() {
  if (!state.account?.authenticated) {
    state.currentConversationId = null;
    state.conversations = [];
    state.chatMessages = [];
    state.aiAnnotations = [];
    state.overlayIndicatorAnnotations = [];
    state.overlaySignals = [];
    state.overlayBias = null;
    state.focusRegion = null;
    state.annotationSourceMap = {};
    state.selectedAnnotationSource = null;
    renderConversationList();
    renderChatMessages();
    renderAnnotationList();
    renderOverlaySignalList();
    renderOverlayBiasCard();
    renderOverlayAnnotationSource();
    renderChartOverlay();
    updateChatContextMeta();
    return;
  }

  try {
    const payload = await fetchJson("/api/conversations");
    state.conversations = payload.conversations || [];
    renderConversationList();
    const firstConversation = state.conversations[0];
    if (firstConversation?.id) {
      await loadConversation(firstConversation.id);
    } else {
      state.currentConversationId = null;
      state.chatMessages = [];
      state.aiAnnotations = [];
      state.overlayIndicatorAnnotations = [];
      state.overlaySignals = [];
      state.overlayBias = null;
      state.focusRegion = null;
      state.annotationSourceMap = {};
      state.selectedAnnotationSource = null;
      renderConversationList();
      renderChatMessages();
      renderAnnotationList();
      renderOverlaySignalList();
      renderOverlayBiasCard();
      renderOverlayAnnotationSource();
      renderChartOverlay();
      updateChatContextMeta();
    }
  } catch (_error) {
    state.currentConversationId = null;
    state.conversations = [];
    state.chatMessages = [];
    state.aiAnnotations = [];
    state.overlayIndicatorAnnotations = [];
    state.overlaySignals = [];
    state.overlayBias = null;
    state.focusRegion = null;
    state.annotationSourceMap = {};
    state.selectedAnnotationSource = null;
    renderConversationList();
    renderChatMessages();
    renderAnnotationList();
    renderOverlaySignalList();
    renderOverlayBiasCard();
    renderOverlayAnnotationSource();
    renderChartOverlay();
    updateChatContextMeta();
  }
}

async function ensureConversation() {
  if (state.currentConversationId) {
    return state.currentConversationId;
  }

  const symbol = elements.coinSelect.value || "BTC";
  const timeframe = elements.timeframeSelect.value || "1h";
  const title = `${symbol} ${timeframe} 대화`;
  const payload = await fetchJson("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title, symbol, timeframe })
  });
  state.currentConversationId = payload.conversation.id;
  state.conversations = [payload.conversation, ...state.conversations];
  state.chatMessages = [];
  renderConversationList();
  renderChatMessages();
  updateChatContextMeta();
  return state.currentConversationId;
}

async function sendChatMessage(source = "main") {
  if (!state.account?.authenticated) {
    setAnalysisMessage("로그인 후 AI 채팅을 사용할 수 있습니다.");
    setActiveView("accountView");
    return;
  }

  const promptElement = source === "floating" ? elements.floatingChatPromptInput : elements.chatPromptInput;
  const mirrorElement = source === "floating" ? elements.chatPromptInput : elements.floatingChatPromptInput;
  const content = String(promptElement?.value || "").trim();
  if (!content || state.chatBusy) {
    return;
  }

  state.chatBusy = true;
  if (elements.sendChatButton) {
    elements.sendChatButton.disabled = true;
  }
  if (elements.floatingSendChatButton) {
    elements.floatingSendChatButton.disabled = true;
  }

  try {
    const conversationId = await ensureConversation();
    const currentConversation = state.conversations.find((item) => item.id === conversationId);
    const defaultTitle = `${elements.coinSelect.value || "시장"} ${elements.timeframeSelect.value || "1h"} 대화`;
    if (currentConversation && (!currentConversation.title || currentConversation.title === defaultTitle)) {
      currentConversation.title = content.slice(0, 36) || defaultTitle;
      renderConversationList();
      updateChatContextMeta();
    }
    state.chatMessages.push({
      sender: "user",
      content,
      created_at: new Date().toISOString(),
      meta: state.focusRegion ? { focusRegion: state.focusRegion } : null
    });
    renderChatMessages();
    if (promptElement) {
      promptElement.value = "";
    }
    if (mirrorElement) {
      mirrorElement.value = "";
    }
    setFloatingBriefingMeta("AI 응답 생성 중");

    const payload = await fetchJson(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content,
        askAi: true,
        provider: elements.aiProviderSelect.value || "auto",
        symbol: elements.coinSelect.value,
        timeframe: elements.timeframeSelect.value,
        focusRegion: state.focusRegion,
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
      })
    });

    if (payload.ai) {
      state.chatMessages.push({
        sender: "ai",
        content: payload.ai.content,
        created_at: payload.ai.createdAt,
        meta: payload.ai.meta || null
      });
      state.aiAnnotations = Array.isArray(payload.ai.annotations) ? payload.ai.annotations : [];
      renderChatMessages();
      renderAnnotationList();
      renderChartOverlay();
      setAnalysisMessage(payload.ai.content || "AI 응답이 생성되었습니다.");
      setFloatingBriefingMeta(payload.ai.error ? "AI 응답 실패" : "AI 응답 완료");
    }
  } catch (error) {
    setAnalysisMessage(error.message);
    setFloatingBriefingMeta("AI 채팅 실패");
  } finally {
    state.chatBusy = false;
    if (elements.sendChatButton) {
      elements.sendChatButton.disabled = false;
    }
    if (elements.floatingSendChatButton) {
      elements.floatingSendChatButton.disabled = false;
    }
  }
}

async function createNewConversation() {
  state.currentConversationId = null;
  state.chatMessages = [];
  state.aiAnnotations = [];
  state.overlayIndicatorAnnotations = [];
  state.overlaySignals = [];
  state.overlayBias = null;
  state.focusRegion = null;
  state.annotationSourceMap = {};
  state.selectedAnnotationSource = null;
  state.floatingHistoryOpen = false;
  renderConversationList();
  renderChatMessages();
  renderAnnotationList();
  renderOverlaySignalList();
  renderOverlayBiasCard();
  renderOverlayAnnotationSource();
  renderChartOverlay();
  updateChatContextMeta();
  elements.chatPromptInput?.focus();
}

async function deleteCurrentConversation() {
  if (!state.currentConversationId) {
    return;
  }

  const confirmed = window.confirm("현재 대화를 삭제할까요?");
  if (!confirmed) {
    return;
  }

  try {
    await fetchJson(`/api/conversations/${encodeURIComponent(state.currentConversationId)}`, {
      method: "DELETE"
    });
    state.conversations = state.conversations.filter((item) => item.id !== state.currentConversationId);
    state.currentConversationId = null;
    state.chatMessages = [];
    state.aiAnnotations = [];
    state.overlayIndicatorAnnotations = [];
    state.overlaySignals = [];
    state.overlayBias = null;
    state.focusRegion = null;
    state.annotationSourceMap = {};
    state.selectedAnnotationSource = null;
    renderConversationList();
    renderChatMessages();
    renderAnnotationList();
    renderOverlaySignalList();
    renderOverlayBiasCard();
    renderOverlayAnnotationSource();
    renderChartOverlay();
    updateChatContextMeta();
    setFloatingBriefingMeta("대화 삭제 완료");
  } catch (error) {
    setAnalysisMessage(error.message);
  }
}

async function deleteStoredKey(provider) {
  if (!state.account?.authenticated) {
    setAiSettingsStatus("로그인 후 키를 삭제할 수 있습니다.");
    return;
  }

  try {
    await fetchJson(`/api/account/keys?provider=${encodeURIComponent(provider)}`, {
      method: "DELETE"
    });
    await loadAccount();
    setAiSettingsStatus(`${provider === "openai" ? "GPT" : "Gemini"} 키를 삭제했습니다.`);
  } catch (error) {
    setAiSettingsStatus(error.message);
  }
}

function renderHistory(items = state.history) {
  state.history = items;
  elements.historyMeta.textContent = `최근 ${formatNumber(items.length, 0)}건`;
  elements.historyList.innerHTML = items.length
    ? items
        .map((item) => {
          const snapshotPrice = item.snapshot?.primary?.priceUsdt;
          const preview = String(item.analysis || "").trim().slice(0, 180);
          return `
            <article class="history-card">
              <div class="history-card-head">
                <strong>${escapeHtml(item.symbol)} · ${escapeHtml(item.timeframe || "-")}</strong>
                <span>${escapeHtml(new Date(item.createdAt).toLocaleString("ko-KR"))}</span>
              </div>
              <div class="history-card-meta">
                <span>${escapeHtml(item.provider || "AI")} ${escapeHtml(item.model || "")}</span>
                <span>수동 ${formatNumber(item.manualAnnotations?.length || 0, 0)} / AI ${formatNumber(
                  item.aiAnnotations?.length || 0,
                  0
                )}</span>
                <span>${snapshotPrice ? `당시가 ${formatUsdt(snapshotPrice)}` : "당시 스냅샷 없음"}</span>
              </div>
              <p class="history-card-body">${escapeHtml(preview || "분석 내용 없음")}</p>
            </article>
          `;
        })
        .join("")
    : "로그인 후 분석 기록이 여기에 쌓입니다.";
}

function renderFactsHtml(snapshot) {
  const timeframeLabel =
    state.timeframes.find((timeframe) => timeframe.id === snapshot.timeframe)?.label || snapshot.timeframe;
  const rows = [
    ["메인 거래소", `${snapshot.primary.exchange} ${snapshot.primary.market}`],
    ["차트 타임프레임", timeframeLabel],
    ["바이낸스 현재가", formatUsdt(snapshot.primary.priceUsdt)],
    ["바이낸스 24h 등락", formatPct(snapshot.primary.change24hPct)],
    ["바이낸스 24h 고가", formatUsdt(snapshot.primary.high24hUsdt)],
    ["바이낸스 24h 저가", formatUsdt(snapshot.primary.low24hUsdt)],
    ["바이낸스 24h 거래량", formatNumber(snapshot.primary.volume24h, 4)],
    ["바이낸스 24h 거래대금", formatUsdt(snapshot.primary.quoteVolume24hUsdt)],
    ["바이낸스 호가", `${formatUsdt(snapshot.primary.bidUsdt)} / ${formatUsdt(snapshot.primary.askUsdt)}`],
    ["호가 스프레드", formatUsdt(snapshot.orderbook.spreadUsdt)],
    [
      "호가 잔량 합계",
      `${formatNumber(snapshot.orderbook.totalBidUnits, 4)} / ${formatNumber(snapshot.orderbook.totalAskUnits, 4)}`
    ],
    ["빗썸 비교", snapshot.local.available ? formatKrw(snapshot.local.priceKrw) : "미지원"],
    ["빗썸 24h 등락", snapshot.local.available ? formatPct(snapshot.local.change24hPct) : "-"],
    ["가격 괴리", snapshot.local.available ? formatPct(snapshot.comparison.premiumPct) : "미지원"],
    ["USDT/KRW", formatKrw(snapshot.usdtKrw)]
  ];

  return rows
    .map(
      ([label, value]) => `
        <div class="fact-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `
    )
    .join("");
}

function renderStatRows(rows) {
  return rows
    .map(
      ([label, value]) => `
        <div class="fact-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `
    )
    .join("");
}

function renderIntelligence(intelligence) {
  state.intelligence = intelligence;

  const macroRows = [
    ["BTC 도미넌스", `${formatNumber(intelligence.macroStats.btcDominancePct, 2)}%`],
    ["ETH 도미넌스", `${formatNumber(intelligence.macroStats.ethDominancePct, 2)}%`],
    ["바이낸스 24h 거래대금", formatUsdt(intelligence.binanceStats.quoteVolume24hUsdt)],
    ["평균 체결 금액", formatUsdt(intelligence.binanceStats.avgTradeValueUsdt)],
    ["6h 모멘텀", formatPct(intelligence.binanceStats.momentum6hPct)],
    ["24h 모멘텀", formatPct(intelligence.binanceStats.momentum24hPct)]
  ];
  const newsRows = [
    ["총 기사 수", `${formatNumber(intelligence.newsStats.articleCount, 0)}건`],
    ["24시간 기사 수", `${formatNumber(intelligence.newsStats.recent24hCount, 0)}건`],
    ["72시간 기사 수", `${formatNumber(intelligence.newsStats.recent72hCount, 0)}건`],
    ["평균 톤", formatNumber(intelligence.newsStats.averageTone, 2)],
    ["최신 기사", intelligence.newsStats.latestHeadline || "-"],
    [
      "주요 출처",
      intelligence.newsStats.topDomains.map((item) => `${item.domain}(${item.count})`).join(", ") || "-"
    ]
  ];

  elements.macroStatsOutput.innerHTML = renderStatRows(macroRows);
  elements.newsStatsOutput.innerHTML = renderStatRows(newsRows);
}

function renderBriefing(briefing) {
  state.briefing = briefing;

  const macroRows = [
    ["기준 시각", new Date(briefing.fetchedAt || Date.now()).toLocaleString("ko-KR")],
    ["BTC 도미넌스", briefing.btc_dominance === null ? "-" : `${formatNumber(briefing.btc_dominance, 2)}%`],
    ["ETH 도미넌스", briefing.eth_dominance === null ? "-" : `${formatNumber(briefing.eth_dominance, 2)}%`],
    ["전체 시총", briefing.total_marketcap_usd === null ? "-" : formatUsdt(briefing.total_marketcap_usd)],
    ["전체 거래대금", briefing.total_volume_usd === null ? "-" : formatUsdt(briefing.total_volume_usd)],
    ["시장 톤", briefing.macro || "-"]
  ];

  const summaryRows = [
    ["현재가", briefing.price === null ? "-" : formatUsdt(briefing.price)],
    ["빗썸 비교가", briefing.bithumb_price === null ? "미지원" : formatKrw(briefing.bithumb_price)],
    ["가격 괴리", briefing.premium === null ? "-" : formatPct(briefing.premium)],
    ["호가 스프레드", briefing.spread_usdt === null ? "-" : formatUsdt(briefing.spread_usdt)],
    ["호가 불균형", briefing.depth_imbalance_pct === null ? "-" : formatPct(briefing.depth_imbalance_pct)],
    ["매물 압력", briefing.wall_pressure || "-"],
    ["최신 헤드라인", briefing.news_summary || "기사 요약 없음"]
  ];

  elements.macroStatsOutput.innerHTML = renderStatRows(macroRows);
  elements.newsStatsOutput.innerHTML = renderStatRows(summaryRows);
}

function renderDirectionScan(scanPayload) {
  state.directionScan = scanPayload;

  const breadth = scanPayload.breadth || {};
  const dominance = scanPayload.dominance || {};
  const storageLabel = scanPayload.storage?.enabled
    ? `DB 추적 ${scanPayload.storage.persistedSymbols || 0}개`
    : "DB 추적 비활성";
  elements.directionScannerMeta.textContent = `기준 ${scanPayload.timeframe} · 상방 ${breadth.upCount || 0} / 하방 ${breadth.downCount || 0} · ${storageLabel}`;

  if (!Array.isArray(scanPayload.leaders) || !scanPayload.leaders.length) {
    elements.directionScannerList.innerHTML = "방향성 후보가 없습니다.";
    return;
  }

  const summaryLine = `시장 폭 ${breadth.tone || "balanced"} · BTC 도미 ${
    dominance.btc === null || dominance.btc === undefined ? "-" : `${formatNumber(dominance.btc, 2)}%`
  }`;

  elements.directionScannerList.innerHTML = [
    `<div class="scanner-subline">${escapeHtml(summaryLine)}</div>`,
    ...scanPayload.leaders.map((candidate) => {
      const timeframes = candidate.timeframes || {};
      const reasons = Array.isArray(candidate.reasons) ? candidate.reasons.join(" · ") : "복수 신호 혼조";
      const trustReasons = Array.isArray(candidate.trustReasons) ? candidate.trustReasons.join(" · ") : "";
      const scoreDeltaClass = Number(candidate.scoreDelta || 0) > 0 ? "up" : Number(candidate.scoreDelta || 0) < 0 ? "down" : "";
      const trustDeltaClass = Number(candidate.trustDelta || 0) > 0 ? "up" : Number(candidate.trustDelta || 0) < 0 ? "down" : "";

      return `
        <article class="scanner-item">
          <div class="scanner-item-main">
            <div class="scanner-item-head">
              <strong>${escapeHtml(candidate.symbol)}</strong>
              <span>${escapeHtml(candidate.label || candidate.symbol)}</span>
              <span class="scanner-badge is-${escapeHtml(candidate.tone || "neutral")}">${escapeHtml(candidate.bias || "중립")}</span>
            </div>
            <div class="scanner-meta-row">
              <span class="scanner-trust is-${escapeHtml(candidate.trustTone || "medium")}">신뢰도 ${escapeHtml(formatNumber(candidate.trustScore, 0))} · ${escapeHtml(candidate.trustLabel || "중")}</span>
              <span class="scanner-delta ${scoreDeltaClass}">점수 변화 ${escapeHtml(formatSignedNumber(candidate.scoreDelta, 2))}</span>
              <span class="scanner-delta ${trustDeltaClass}">신뢰도 변화 ${escapeHtml(formatSignedNumber(candidate.trustDelta, 0))}</span>
            </div>
            <div class="scanner-subline">
              15m ${escapeHtml(formatPct(timeframes["15m"]))} · 1h ${escapeHtml(formatPct(timeframes["1h"]))} · 4h ${escapeHtml(formatPct(timeframes["4h"]))} · 1d ${escapeHtml(formatPct(timeframes["1d"]))}
            </div>
            <div class="scanner-reasons">${escapeHtml(reasons)}</div>
            <div class="scanner-trust-notes">${escapeHtml(trustReasons || "거래대금, 호가 두께, 데이터 커버리지를 반영합니다.")}</div>
          </div>
          <div class="scanner-metrics">
            <div class="scanner-score">${escapeHtml(formatNumber(candidate.score, 2))}</div>
            <div class="scanner-subline">현재가 ${escapeHtml(formatUsdt(candidate.priceUsdt))}</div>
            <div class="scanner-subline">24h ${escapeHtml(formatPct(candidate.change24hPct))}</div>
            <div class="scanner-subline">호가 ${escapeHtml(formatPct(candidate.orderbookImbalancePct))}</div>
          </div>
        </article>
      `;
    })
  ].join("");
}

function setChartHint(message) {
  elements.chartInteractionHint.textContent = message;
}

function updateFloatingBriefingState() {
  elements.floatingBriefingPanel.classList.toggle("is-minimized", state.floatingPanel.minimized);
  elements.floatingBriefingPanel.classList.toggle("is-dragging", state.floatingPanel.dragging);
  elements.floatingBriefingMinimizeButton.textContent = state.floatingPanel.minimized ? "펼치기" : "접기";

  if (Number.isFinite(state.floatingPanel.x) && Number.isFinite(state.floatingPanel.y)) {
    elements.floatingBriefingPanel.style.right = "auto";
    elements.floatingBriefingPanel.style.bottom = "auto";
    elements.floatingBriefingPanel.style.left = `${state.floatingPanel.x}px`;
    elements.floatingBriefingPanel.style.top = `${state.floatingPanel.y}px`;
  } else {
    elements.floatingBriefingPanel.style.left = "";
    elements.floatingBriefingPanel.style.top = "";
    elements.floatingBriefingPanel.style.right = "";
    elements.floatingBriefingPanel.style.bottom = "";
  }
}

function setFloatingBriefingMeta(message) {
  elements.floatingBriefingMeta.textContent = message;
}

function clampFloatingPanelPosition(nextX, nextY) {
  const panelWidth = elements.floatingBriefingPanel.offsetWidth || 420;
  const panelHeight = elements.floatingBriefingPanel.offsetHeight || 280;

  return {
    x: clamp(nextX, 8, Math.max(window.innerWidth - panelWidth - 8, 8)),
    y: clamp(nextY, 8, Math.max(window.innerHeight - panelHeight - 8, 8))
  };
}

function ensureFloatingBriefingInteractions() {
  if (!elements.floatingBriefingHeader || elements.floatingBriefingHeader.dataset.bound === "true") {
    return;
  }

  const stopDrag = () => {
    if (!state.floatingPanel.dragging) {
      return;
    }

    state.floatingPanel.dragging = false;
    updateFloatingBriefingState();
    savePersonalSettings();
  };

  elements.floatingBriefingHeader.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) {
      return;
    }

    const rect = elements.floatingBriefingPanel.getBoundingClientRect();
    state.floatingPanel.dragging = true;
    state.floatingPanel.offsetX = event.clientX - rect.left;
    state.floatingPanel.offsetY = event.clientY - rect.top;
    state.floatingPanel.x = rect.left;
    state.floatingPanel.y = rect.top;
    elements.floatingBriefingHeader.setPointerCapture?.(event.pointerId);
    updateFloatingBriefingState();
  });

  elements.floatingBriefingHeader.addEventListener("pointermove", (event) => {
    if (!state.floatingPanel.dragging) {
      return;
    }

    const next = clampFloatingPanelPosition(
      event.clientX - state.floatingPanel.offsetX,
      event.clientY - state.floatingPanel.offsetY
    );
    state.floatingPanel.x = next.x;
    state.floatingPanel.y = next.y;
    updateFloatingBriefingState();
  });

  elements.floatingBriefingHeader.addEventListener("pointerup", stopDrag);
  elements.floatingBriefingHeader.addEventListener("pointercancel", stopDrag);
  elements.floatingBriefingHeader.addEventListener("pointerleave", stopDrag);
  elements.floatingBriefingHeader.dataset.bound = "true";
}

function getDefaultVisibleCount(timeframe, totalCandles) {
  const defaults = {
    "15m": 72,
    "1h": 96,
    "4h": 84,
    "1d": 120,
    "1w": 80
  };

  return clamp(defaults[timeframe] || 72, 20, Math.max(totalCandles, 20));
}

function resetChartViewport(snapshot) {
  if (!snapshot?.candles?.length) {
    state.chartViewport = null;
    return;
  }

  const visibleCount = getDefaultVisibleCount(snapshot.timeframe, snapshot.candles.length);
  state.chartViewport = {
    startIndex: Math.max(snapshot.candles.length - visibleCount, 0),
    visibleCount,
    isDragging: false,
    dragOriginX: 0,
    dragStartIndex: 0
  };
}

function getVisibleCandles(snapshot) {
  if (!snapshot?.candles?.length) {
    return [];
  }

  if (!state.chartViewport) {
    resetChartViewport(snapshot);
  }

  const visibleCount = clamp(state.chartViewport.visibleCount, 20, snapshot.candles.length);
  const maxStartIndex = Math.max(snapshot.candles.length - visibleCount, 0);
  const startIndex = clamp(state.chartViewport.startIndex, 0, maxStartIndex);

  state.chartViewport.startIndex = startIndex;
  state.chartViewport.visibleCount = visibleCount;

  return snapshot.candles.slice(startIndex, startIndex + visibleCount);
}

function getActiveAnnotations() {
  const automated = elements.overlayToggle.checked
    ? state.aiAnnotations.length
      ? state.aiAnnotations
      : state.snapshot?.annotations || []
    : [];
  const indicators = elements.overlayToggle.checked ? state.overlayIndicatorAnnotations : [];
  return [...state.manualAnnotations, ...automated, ...indicators, ...(state.focusRegion ? [state.focusRegion] : [])];
}

function renderAnnotationList() {
  if (!CHART_DRAWING_ENABLED && !CHART_AI_OVERLAY_ENABLED) {
    elements.annotationSummary.textContent = "차트는 현재 읽기 전용입니다.";
    elements.annotationList.innerHTML = "드로잉과 AI 오버레이는 임시 비활성화 상태입니다.";
    return;
  }

  const annotations = getActiveAnnotations();
  const manualCount = state.manualAnnotations.length;
  const focusCount = state.focusRegion ? 1 : 0;
  const automatedCount = Math.max(annotations.length - manualCount - focusCount, 0);

  elements.annotationSummary.textContent = annotations.length
    ? `수동 ${manualCount}개 / 자동 ${automatedCount}개${focusCount ? " / 질문 구간 1개" : ""}를 차트 위에 표시 중입니다.`
    : "표시 가능한 주석이 없습니다.";

  elements.annotationList.innerHTML = annotations.length
    ? annotations
        .map(
          (annotation) => `
            <div class="annotation-row">
              <strong>${escapeHtml(annotation.label || annotation.type)}</strong>
              <span>${escapeHtml(annotation.reason || "근거 없음")}</span>
              <span>${escapeHtml(annotation.type)}${annotation.source ? ` · ${annotation.source === "indicator" ? "signal" : annotation.source}` : " · ai"}</span>
            </div>
          `
        )
        .join("")
    : "AI가 차트 위에 그릴 선/구간/마커가 아직 없습니다.";
}

function renderMarketSymbolList() {
  const searchTerm = state.marketSearchTerm.trim().toLowerCase();
  const currentSymbol = elements.coinSelect.value;
  const filtered = state.coins.filter((coin) => {
    if (!searchTerm) {
      return true;
    }

    return coin.symbol.toLowerCase().includes(searchTerm) || coin.pair.toLowerCase().includes(searchTerm);
  });

  const prioritized = filtered
    .slice()
    .sort((left, right) => {
      if (left.symbol === currentSymbol) {
        return -1;
      }

      if (right.symbol === currentSymbol) {
        return 1;
      }

      return right.quoteVolume24hUsdt - left.quoteVolume24hUsdt;
    })
    .slice(0, 80);

  elements.marketBrowserMeta.textContent = `${formatNumber(filtered.length, 0)} / ${formatNumber(
    state.coins.length,
    0
  )} symbols · USDT Spot`;

  if (!prioritized.length) {
    elements.marketSymbolList.innerHTML = `<div class="market-empty">검색 조건에 맞는 심볼이 없습니다.</div>`;
    return;
  }

  elements.marketSymbolList.innerHTML = prioritized
    .map(
      (coin) => `
        <button class="market-symbol-row ${coin.symbol === currentSymbol ? "is-active" : ""}" data-symbol-row="${coin.symbol}" type="button">
          <span class="market-symbol-main">
            <strong>${escapeHtml(coin.symbol)}</strong>
            <small>${escapeHtml(coin.pair)}</small>
          </span>
          <span class="market-symbol-stats">
            <em>${formatUsdt(coin.lastPriceUsdt)}</em>
            <small class="${coin.change24hPct >= 0 ? "up" : "down"}">${formatPct(coin.change24hPct)}</small>
          </span>
          <span class="market-symbol-meta">
            <small>${formatNumber(coin.quoteVolume24hUsdt / 1_000_000, 0)}M</small>
            <small>${coin.localSupported ? "빗썸 비교" : "비교 없음"}</small>
          </span>
        </button>
      `
    )
    .join("");
}

function renderTimeframeButtons() {
  const currentTimeframe = elements.timeframeSelect.value;

  elements.timeframeShortcutList.innerHTML = state.timeframes
    .map(
      (timeframe) => `
        <button class="shortcut-button ${timeframe.id === currentTimeframe ? "is-active" : ""}" data-shortcut-timeframe="${timeframe.id}" type="button">
          ${escapeHtml(timeframe.label)}
        </button>
      `
    )
    .join("");
}

function renderDrawingTools() {
  Array.from(elements.drawingToolList.querySelectorAll("[data-drawing-tool]")).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.drawingTool === state.drawingTool);
  });
}

function setFocusRegion(region) {
  state.focusRegion = normalizeFocusRegion(region);
  state.savedFocusRegion = state.focusRegion;
  state.pendingDrawing = null;
  savePersonalSettings();
  refreshOverlayIndicators();
  renderAnnotationList();
  renderChartOverlay();
  renderChartNavigator(state.snapshot);
  updateChatContextMeta();
  setOverlayAnalysisStatus("선택 구간이 업데이트되었습니다. AI 재분석 또는 채팅 전송을 선택할 수 있습니다.");
}

function removeAnnotationById(annotationId) {
  if (!annotationId) {
    return false;
  }

  if (state.focusRegion?.id === annotationId) {
    clearFocusRegion({ preserveStatus: true });
    return true;
  }

  const nextManualAnnotations = state.manualAnnotations.filter((annotation) => annotation.id !== annotationId);
  if (nextManualAnnotations.length !== state.manualAnnotations.length) {
    state.manualAnnotations = nextManualAnnotations;
    return true;
  }

  const nextAiAnnotations = state.aiAnnotations.filter((annotation) => annotation.id !== annotationId);
  if (nextAiAnnotations.length !== state.aiAnnotations.length) {
    state.aiAnnotations = nextAiAnnotations;
    return true;
  }

  return false;
}

function renderOrderbook(snapshot) {
  const totalDepth = Math.max(snapshot.orderbook.totalBidUnits, snapshot.orderbook.totalAskUnits, 0.0001);
  const asks = snapshot.orderbook.asks.slice().reverse().slice(0, 10);
  const bids = snapshot.orderbook.bids.slice(0, 10);

  const spreadHtml = `
    <div class="orderbook-spread">
      <strong>${formatUsdt(snapshot.orderbook.spreadUsdt)} spread</strong>
      <span>매수 ${formatNumber(snapshot.orderbook.totalBidUnits, 4)} / 매도 ${formatNumber(snapshot.orderbook.totalAskUnits, 4)}</span>
    </div>
  `;

  const sideHtml = (title, side, levels) => `
    <div class="orderbook-side">
      <div class="orderbook-label">
        <span>${escapeHtml(title)}</span>
        <span>${levels.length} levels</span>
      </div>
      ${levels
        .map((level) => {
          const share = (level.quantity / totalDepth) * 100;
          return `
            <div class="orderbook-row ${side}" style="--depth:${share.toFixed(2)}%">
              <span class="orderbook-price">${formatNumber(level.price, 2)}</span>
              <span class="orderbook-quantity">${formatNumber(level.quantity, 4)}</span>
              <span class="orderbook-share">${formatNumber(share, 1)}%</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  elements.orderbookOutput.innerHTML = [spreadHtml, sideHtml("ASK", "ask", asks), sideHtml("BID", "bid", bids)].join("");
  elements.orderbookMeta.textContent = `${snapshot.orderbook.asks.length + snapshot.orderbook.bids.length} levels`;
}

function renderTrades(snapshot) {
  elements.tradeMeta.textContent = `${Math.min(snapshot.recentTrades.length, 20)} prints`;
  elements.tradesOutput.innerHTML = snapshot.recentTrades.length
    ? snapshot.recentTrades
        .slice(0, 20)
        .map(
          (trade) => `
            <div class="trade-row ${trade.side}">
              <span class="trade-time">${escapeHtml(formatShortTime(trade.timestamp))}</span>
              <span class="trade-size">${formatNumber(trade.quantity, 4)}</span>
              <span class="trade-price">${formatNumber(trade.priceUsdt, 2)}</span>
            </div>
          `
        )
        .join("")
    : "최근 체결 데이터를 불러오지 못했습니다.";
}

function readNavigatorIndex(clientX) {
  if (!state.chartNavigator.geometry || !elements.chartNavigator) {
    return null;
  }

  const rect = elements.chartNavigator.getBoundingClientRect();
  const relativeX = clamp(clientX - rect.left - state.chartNavigator.geometry.left, 0, state.chartNavigator.geometry.plotWidth);
  const ratio = relativeX / Math.max(state.chartNavigator.geometry.plotWidth, 1);

  return clamp(
    Math.round(ratio * Math.max(state.chartNavigator.geometry.totalCandles - 1, 0)),
    0,
    Math.max(state.chartNavigator.geometry.totalCandles - 1, 0)
  );
}

function renderChartNavigator(snapshot) {
  if (!elements.chartNavigator) {
    return;
  }

  if (!snapshot?.candles?.length || !state.chartViewport) {
    elements.chartNavigator.innerHTML = "";
    state.chartNavigator.geometry = null;
    if (elements.chartNavigatorMeta) {
      elements.chartNavigatorMeta.textContent = "전체 데이터가 준비되면 현재 보는 범위를 조정할 수 있습니다.";
    }
    return;
  }

  const width = elements.chartNavigator.clientWidth || 0;
  const height = elements.chartNavigator.clientHeight || 88;

  if (width < 120) {
    window.requestAnimationFrame(() => renderChartNavigator(snapshot));
    return;
  }

  const candles = snapshot.candles || [];
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const plotWidth = Math.max(width - padding.left - padding.right, 40);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 30);
  const lows = candles.map((candle) => Number(candle.low || 0));
  const highs = candles.map((candle) => Number(candle.high || 0));
  const closes = candles.map((candle) => Number(candle.close || 0));
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const maxStartIndex = Math.max(candles.length - state.chartViewport.visibleCount, 0);
  const viewportStartIndex = clamp(state.chartViewport.startIndex, 0, maxStartIndex);
  const viewportWidth = Math.max((state.chartViewport.visibleCount / Math.max(candles.length, 1)) * plotWidth, 18);
  const viewportX = padding.left + (viewportStartIndex / Math.max(candles.length - 1, 1)) * plotWidth;
  const linePath = closes
    .map((close, index) => {
      const x = padding.left + (index / Math.max(candles.length - 1, 1)) * plotWidth;
      const y = padding.top + plotHeight - ((close - minPrice) / Math.max(maxPrice - minPrice, 1)) * plotHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const focusRegion = state.focusRegion;
  let focusRect = "";
  if (focusRegion) {
    const focusStartIndex = candles.findIndex((candle) => Number(candle.timestamp) >= Number(focusRegion.startTime));
    const reverseEndIndex = [...candles].reverse().findIndex((candle) => Number(candle.timestamp) <= Number(focusRegion.endTime));
    const focusEndIndex = reverseEndIndex === -1 ? -1 : candles.length - 1 - reverseEndIndex;

    if (focusStartIndex >= 0 && focusEndIndex >= focusStartIndex) {
      const focusX = padding.left + (focusStartIndex / Math.max(candles.length - 1, 1)) * plotWidth;
      const focusWidth = Math.max(((focusEndIndex - focusStartIndex + 1) / Math.max(candles.length, 1)) * plotWidth, 6);
      focusRect = `<rect x="${focusX}" y="${padding.top}" width="${focusWidth}" height="${plotHeight}" fill="rgba(96, 165, 250, 0.12)" rx="8" ry="8" />`;
    }
  }

  elements.chartNavigator.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="차트 구간 네비게이터">
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
      <path d="${linePath}" fill="none" stroke="rgba(111, 227, 215, 0.52)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      ${focusRect}
      <rect x="${viewportX}" y="${padding.top}" width="${viewportWidth}" height="${plotHeight}" fill="rgba(255,255,255,0.08)" stroke="#f8fafc" stroke-width="1.4" rx="8" ry="8"></rect>
      <rect x="${viewportX - 2}" y="${padding.top + 8}" width="4" height="${Math.max(plotHeight - 16, 12)}" fill="#f8fafc" rx="2" ry="2"></rect>
      <rect x="${viewportX + viewportWidth - 2}" y="${padding.top + 8}" width="4" height="${Math.max(plotHeight - 16, 12)}" fill="#f8fafc" rx="2" ry="2"></rect>
    </svg>
  `;

  state.chartNavigator.geometry = {
    left: padding.left,
    plotWidth,
    totalCandles: candles.length,
    viewportX,
    viewportWidth
  };

  if (elements.chartNavigatorMeta) {
    const endIndex = Math.min(viewportStartIndex + state.chartViewport.visibleCount, candles.length);
    elements.chartNavigatorMeta.textContent = `표시 구간 ${viewportStartIndex + 1} - ${endIndex} / 전체 ${candles.length}봉`;
  }
}

function ensureChartInteractions() {
  if (state.resizeObserver || !elements.chartHost) {
    return;
  }

  const beginOverlaySelection = (event) => {
    if (!state.snapshot || !state.chartViewport || state.drawingTool !== "move" || !isOverlaySelectionMode()) {
      return false;
    }

    const point = readChartPoint(event.clientX, event.clientY);
    if (!point) {
      return false;
    }

    state.overlaySelection.active = true;
    state.overlaySelection.start = point;
    state.overlaySelection.current = point;
    state.overlaySelection.handledPointerUp = false;
    state.overlaySelection.pointerId = event.pointerId ?? null;
    elements.chartHost.classList.add("is-selecting");
    elements.chartSelectionOverlay?.setPointerCapture?.(event.pointerId);
    setChartHint("드래그해서 분석할 구간을 지정하세요.");
    renderChartOverlay();
    updateChartOverlayMode();
    return true;
  };

  const updateOverlaySelection = (event) => {
    if (!state.overlaySelection.active) {
      return false;
    }

    if (state.overlaySelection.pointerId !== null && event?.pointerId !== undefined && state.overlaySelection.pointerId !== event.pointerId) {
      return false;
    }

    const point = readChartPoint(event.clientX, event.clientY);
    if (!point) {
      return false;
    }

    state.overlaySelection.current = point;
    renderChartOverlay();
    return true;
  };

  const finishOverlaySelection = (event) => {
    if (!state.overlaySelection.active) {
      return false;
    }

    if (state.overlaySelection.pointerId !== null && event?.pointerId !== undefined && state.overlaySelection.pointerId !== event.pointerId) {
      return false;
    }

    const start = state.overlaySelection.start;
    const current = state.overlaySelection.current;
    const pointerId = state.overlaySelection.pointerId;
    state.overlaySelection.active = false;
    state.overlaySelection.handledPointerUp = Boolean(start && current);
    state.overlaySelection.pointerId = null;
    elements.chartHost.classList.remove("is-selecting");
    if (pointerId !== null) {
      elements.chartSelectionOverlay?.releasePointerCapture?.(pointerId);
    }

    if (start && current) {
      const timeDistance = Math.abs(Number(current.time) - Number(start.time));
      if (timeDistance > 0) {
        const region = buildFocusRegionFromSelection(state.snapshot, start, current);
        if (region) {
          setFocusRegion(region);
        }
        requestOverlayAnalysis();
      } else {
        setOverlayAnalysisStatus("최소 두 개 이상의 봉을 가로질러 드래그해야 구간이 설정됩니다.");
      }
    }

    state.overlaySelection.start = null;
    state.overlaySelection.current = null;
    renderChartOverlay();
    updateChartOverlayMode();
    return true;
  };

  if (elements.chartSelectionOverlay && elements.chartSelectionOverlay.dataset.bound !== "true") {
    elements.chartSelectionOverlay.addEventListener("pointerdown", (event) => {
      if (!beginOverlaySelection(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    });

    elements.chartSelectionOverlay.addEventListener("pointermove", (event) => {
      if (!updateOverlaySelection(event)) {
        return;
      }

      event.preventDefault();
    });

    const releaseOverlaySelection = (event) => {
      if (!finishOverlaySelection(event)) {
        return;
      }

      event.preventDefault?.();
      event.stopPropagation?.();
    };

    elements.chartSelectionOverlay.addEventListener("pointerup", releaseOverlaySelection);
    elements.chartSelectionOverlay.addEventListener("pointercancel", releaseOverlaySelection);
    elements.chartSelectionOverlay.addEventListener("pointerleave", releaseOverlaySelection);
    elements.chartSelectionOverlay.dataset.bound = "true";
  }

  if (elements.chartNavigator && elements.chartNavigator.dataset.bound !== "true") {
    const releaseNavigator = (event) => {
      if (state.chartNavigator.pointerId !== null && event?.pointerId !== undefined && state.chartNavigator.pointerId !== event.pointerId) {
        return;
      }

      state.chartNavigator.dragMode = null;
      state.chartNavigator.pointerId = null;
      elements.chartNavigator.classList.remove("is-dragging", "is-resizing");
    };

    elements.chartNavigator.addEventListener("pointerdown", (event) => {
      if (!state.snapshot || !state.chartViewport || !state.chartNavigator.geometry) {
        return;
      }

      const rect = elements.chartNavigator.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const { viewportX, viewportWidth } = state.chartNavigator.geometry;
      const handleThreshold = 12;

      state.chartNavigator.pointerId = event.pointerId;
      state.chartNavigator.originX = event.clientX;
      state.chartNavigator.startIndex = state.chartViewport.startIndex;
      state.chartNavigator.visibleCount = state.chartViewport.visibleCount;

      if (Math.abs(offsetX - viewportX) <= handleThreshold) {
        state.chartNavigator.dragMode = "resize-left";
        elements.chartNavigator.classList.add("is-resizing");
      } else if (Math.abs(offsetX - (viewportX + viewportWidth)) <= handleThreshold) {
        state.chartNavigator.dragMode = "resize-right";
        elements.chartNavigator.classList.add("is-resizing");
      } else if (offsetX >= viewportX && offsetX <= viewportX + viewportWidth) {
        state.chartNavigator.dragMode = "pan";
        elements.chartNavigator.classList.add("is-dragging");
      } else {
        const nextIndex = readNavigatorIndex(event.clientX);
        const nextStartIndex = clamp(
          Math.round((nextIndex ?? 0) - state.chartViewport.visibleCount / 2),
          0,
          Math.max(state.snapshot.candles.length - state.chartViewport.visibleCount, 0)
        );
        state.chartViewport.startIndex = nextStartIndex;
        renderChart(state.snapshot);
        renderChartOverlay();
        renderChartNavigator(state.snapshot);
        return;
      }

      elements.chartNavigator.setPointerCapture?.(event.pointerId);
    });

    elements.chartNavigator.addEventListener("pointermove", (event) => {
      if (!state.snapshot || !state.chartViewport || !state.chartNavigator.dragMode || !state.chartNavigator.geometry) {
        return;
      }

      const candleGap = state.chartNavigator.geometry.plotWidth / Math.max(state.chartNavigator.geometry.totalCandles, 1);
      const deltaCandles = Math.round((event.clientX - state.chartNavigator.originX) / Math.max(candleGap, 1));
      const totalCandles = state.snapshot.candles.length;

      if (state.chartNavigator.dragMode === "pan") {
        const maxStartIndex = Math.max(totalCandles - state.chartViewport.visibleCount, 0);
        state.chartViewport.startIndex = clamp(state.chartNavigator.startIndex + deltaCandles, 0, maxStartIndex);
      }

      if (state.chartNavigator.dragMode === "resize-left") {
        const nextStartIndex = clamp(
          state.chartNavigator.startIndex + deltaCandles,
          0,
          state.chartNavigator.startIndex + state.chartNavigator.visibleCount - 20
        );
        state.chartViewport.startIndex = nextStartIndex;
        state.chartViewport.visibleCount = clamp(
          state.chartNavigator.visibleCount - (nextStartIndex - state.chartNavigator.startIndex),
          20,
          totalCandles - nextStartIndex
        );
      }

      if (state.chartNavigator.dragMode === "resize-right") {
        state.chartViewport.visibleCount = clamp(
          state.chartNavigator.visibleCount + deltaCandles,
          20,
          totalCandles - state.chartNavigator.startIndex
        );
        state.chartViewport.startIndex = clamp(
          state.chartNavigator.startIndex,
          0,
          Math.max(totalCandles - state.chartViewport.visibleCount, 0)
        );
      }

      renderChart(state.snapshot);
      renderChartOverlay();
      renderChartNavigator(state.snapshot);
    });

    elements.chartNavigator.addEventListener("pointerup", releaseNavigator);
    elements.chartNavigator.addEventListener("pointercancel", releaseNavigator);
    elements.chartNavigator.addEventListener("pointerleave", releaseNavigator);
    elements.chartNavigator.dataset.bound = "true";
  }

  const releaseDrag = () => {
    if (!state.chartViewport) {
      return;
    }

    state.chartViewport.isDragging = false;
    elements.chartHost.classList.remove("is-dragging");
    setChartHint(isOverlaySelectionMode() ? "드래그해서 분석할 구간을 지정하세요." : "드래그로 이동, 휠로 확대/축소, 더블클릭으로 초기화");
  };

  elements.chartHost.addEventListener("pointerdown", (event) => {
    if (!state.snapshot || !state.chartViewport || state.drawingTool !== "move") {
      return;
    }

    if (isOverlaySelectionMode()) {
      return;
    }

    state.chartViewport.isDragging = true;
    state.chartViewport.dragOriginX = event.clientX;
    state.chartViewport.dragStartIndex = state.chartViewport.startIndex;
    elements.chartHost.classList.add("is-dragging");
    elements.chartHost.setPointerCapture?.(event.pointerId);
  });

  elements.chartHost.addEventListener("pointermove", (event) => {
    if (!state.snapshot || !state.chartViewport?.isDragging || !state.chartGeometry?.candleGap || state.drawingTool !== "move") {
      return;
    }

    const deltaCandles = Math.round((event.clientX - state.chartViewport.dragOriginX) / state.chartGeometry.candleGap);
    const maxStartIndex = Math.max(state.snapshot.candles.length - state.chartViewport.visibleCount, 0);
    state.chartViewport.startIndex = clamp(state.chartViewport.dragStartIndex - deltaCandles, 0, maxStartIndex);
    setChartHint(`이동 중 · ${state.chartViewport.startIndex + 1}번째 봉부터 표시`);
    renderChart(state.snapshot);
    renderChartOverlay();
  });

  elements.chartHost.addEventListener("pointerup", releaseDrag);
  elements.chartHost.addEventListener("pointerleave", releaseDrag);
  elements.chartHost.addEventListener("pointercancel", releaseDrag);

  elements.chartHost.addEventListener(
    "wheel",
    (event) => {
      if (!state.snapshot || !state.chartViewport || !state.chartGeometry) {
        return;
      }

      if (state.drawingTool !== "move") {
        return;
      }

      event.preventDefault();

      const direction = event.deltaY > 0 ? 1 : -1;
      const currentCount = state.chartViewport.visibleCount;
      const nextCount = clamp(currentCount + direction * 8, 20, state.snapshot.candles.length);

      if (nextCount === currentCount) {
        return;
      }

      const hostRect = elements.chartHost.getBoundingClientRect();
      const relativeX = clamp(event.clientX - hostRect.left - state.chartGeometry.left, 0, state.chartGeometry.plotWidth);
      const focusRatio = relativeX / Math.max(state.chartGeometry.plotWidth, 1);
      const focusIndex = state.chartViewport.startIndex + Math.round(focusRatio * (currentCount - 1));
      const nextStartIndex = clamp(
        Math.round(focusIndex - focusRatio * (nextCount - 1)),
        0,
        Math.max(state.snapshot.candles.length - nextCount, 0)
      );

      state.chartViewport.visibleCount = nextCount;
      state.chartViewport.startIndex = nextStartIndex;
      setChartHint(`${nextCount}봉 표시 중`);
      renderChart(state.snapshot);
      renderChartOverlay();
    },
    { passive: false }
  );

  elements.chartHost.addEventListener("dblclick", () => {
    if (!state.snapshot || state.drawingTool !== "move") {
      return;
    }

    resetChartViewport(state.snapshot);
    setChartHint("차트 뷰를 기본값으로 초기화했습니다.");
    renderChart(state.snapshot);
    renderChartOverlay();
  });

  if (typeof ResizeObserver === "function") {
    state.resizeObserver = new ResizeObserver(() => {
      if (!state.snapshot || state.activeViewId !== "marketView") {
        return;
      }

      renderChart(state.snapshot);
      renderChartOverlay();
      renderChartNavigator(state.snapshot);
    });
    state.resizeObserver.observe(elements.chartHost);
    if (elements.chartNavigator) {
      state.resizeObserver.observe(elements.chartNavigator);
    }
  }
}

function readChartPoint(clientX, clientY) {
  if (!state.chartGeometry || !state.chartHost || !state.chartGeometry.candles?.length) {
    return null;
  }

  const hostRect = elements.chartHost.getBoundingClientRect();
  const relativeX = clamp(clientX - hostRect.left - state.chartGeometry.left, 0, state.chartGeometry.plotWidth);
  const relativeY = clamp(
    clientY - hostRect.top - state.chartGeometry.priceTop,
    0,
    state.chartGeometry.priceHeight
  );
  const index = clamp(
    Math.round(relativeX / Math.max(state.chartGeometry.candleGap, 1) - 0.5),
    0,
    state.chartGeometry.candles.length - 1
  );
  const candle = state.chartGeometry.candles[index];
  const priceRatio = 1 - relativeY / Math.max(state.chartGeometry.priceHeight, 1);
  const price =
    state.chartGeometry.minPrice + (state.chartGeometry.maxPrice - state.chartGeometry.minPrice) * priceRatio;

  return {
    time: candle.timestamp,
    price: Number(price.toFixed(2)),
    x: relativeX + state.chartGeometry.left,
    y: relativeY + state.chartGeometry.priceTop
  };
}

function handleDrawingPlacement(clientX, clientY, eventTarget = null) {
  if (state.drawingTool === "move" || !state.snapshot || !state.chartGeometry) {
    return;
  }

  if (eventTarget?.closest?.("[data-annotation-id]")) {
    return;
  }

  const point = readChartPoint(clientX, clientY);

  if (!point) {
    return;
  }

  if (state.drawingTool === "marker") {
    pushManualAnnotation({
      type: "marker",
      label: "사용자 마커",
      reason: "사용자 수동 표시",
      color: "#f59e0b",
      time: point.time,
      price: point.price
    });
    return;
  }

  if (!state.pendingDrawing) {
    state.pendingDrawing = point;
    setChartHint(
      state.drawingTool === "line"
        ? "끝점을 한 번 더 클릭하세요."
        : state.drawingTool === "question-zone"
          ? "질문 구간의 반대쪽을 클릭하세요."
          : "구간의 반대쪽을 클릭하세요."
    );
    return;
  }

  const start = state.pendingDrawing;
  const end = point;

  if (state.drawingTool === "line") {
    pushManualAnnotation({
      type: "line",
      label: "사용자 선",
      reason: "사용자 수동 추세선",
      color: "#f59e0b",
      from: start,
      to: end
    });
    return;
  }

  if (state.drawingTool === "zone") {
    pushManualAnnotation({
      type: "zone",
      label: "사용자 구간",
      reason: "사용자 수동 구간",
      color: "rgba(245, 158, 11, 0.14)",
      lineColor: "#f59e0b",
      startTime: Math.min(start.time, end.time),
      endTime: Math.max(start.time, end.time),
      minPrice: Math.min(start.price, end.price),
      maxPrice: Math.max(start.price, end.price)
    });
    return;
  }

  if (state.drawingTool === "question-zone") {
    setFocusRegion({
      id: `focus-${Date.now()}`,
      label: "질문 구간",
      reason: "이번 질문에서 우선 해석할 범위",
      color: "rgba(96, 165, 250, 0.16)",
      lineColor: "#60a5fa",
      startTime: Math.min(start.time, end.time),
      endTime: Math.max(start.time, end.time),
      minPrice: Math.min(start.price, end.price),
      maxPrice: Math.max(start.price, end.price)
    });
    setChartHint("질문 구간을 지정했습니다. 다음 채팅에서 AI가 이 범위를 우선 해석합니다.");
  }
}

function pushManualAnnotation(annotation) {
  state.manualAnnotations.push({
    ...annotation,
    id: annotation.id || `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    source: "manual"
  });
  state.pendingDrawing = null;
  renderAnnotationList();
  renderChartOverlay();
  setChartHint("수동 드로잉을 추가했습니다. AI 분석 시 함께 전달됩니다.");
}

function handleDrawingClick(event) {
  handleDrawingPlacement(event.clientX, event.clientY, event.target);
}

function clearManualAnnotations() {
  state.manualAnnotations = [];
  state.pendingDrawing = null;
  clearFocusRegion({ message: "선택 구간과 수동 드로잉을 모두 비웠습니다.", preserveStatus: true });
  renderAnnotationList();
  renderChartOverlay();
  updateChatContextMeta();
  setChartHint("수동 드로잉을 모두 비웠습니다.");
}

function renderAnnotationsToLayer(target, annotations, geometry, sourceMap = {}) {
  if (!target) {
    return;
  }

  const width = elements.chartHost.clientWidth;
  const height = elements.chartHost.clientHeight;
  const { candles, left, plotWidth, priceTop, priceHeight, minPrice, maxPrice } = geometry;

  target.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const priceToY = (price) => {
    const ratio = (Number(price) - minPrice) / Math.max(maxPrice - minPrice, 1);
    return priceTop + priceHeight - ratio * priceHeight;
  };
  const timeToX = (time) => {
    if (!candles.length) {
      return null;
    }

    const firstTime = candles[0].timestamp;
    const lastTime = candles.at(-1).timestamp;
    const ratio = (Number(time) - firstTime) / Math.max(lastTime - firstTime, 1);
    return left + clamp(ratio, 0, 1) * plotWidth;
  };

  target.innerHTML = annotations
    .map((annotation) => {
      const isIndicator = annotation.source === "indicator";
      const isManual = annotation.source === "manual" || annotation.source === "focus";
      const sourceInfo = sourceMap[annotation.id || annotation.label] || null;
      const sourceAttrs = sourceInfo
        ? ` data-chat-message-id="${escapeHtml(sourceInfo.messageId)}" data-annotation-source-label="${escapeHtml(
            sourceInfo.label || "AI 주석"
          )}"`
        : "";
      const labelColor = isIndicator ? "#b8e1ff" : isManual ? "#ffd089" : "#d7e2eb";
      const dash = isIndicator ? "5 4" : annotation.role === "focus-region" ? "6 4" : "none";
      const strokeWidth = annotation.role === "focus-region" ? "2" : isIndicator ? "1.7" : "2.2";

      if (annotation.type === "line" && annotation.from && annotation.to) {
        const x1 = timeToX(annotation.from.time);
        const x2 = timeToX(annotation.to.time);
        const y1 = priceToY(annotation.from.price);
        const y2 = priceToY(annotation.to.price);

        if ([x1, x2, y1, y2].some((value) => value === null || value === undefined)) {
          return "";
        }

        return `
          <line data-annotation-id="${escapeHtml(annotation.id || annotation.label || "line")}"${sourceAttrs} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeHtml(annotation.color || "#0ea5a0")}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" opacity="${isIndicator ? "0.92" : "1"}" />
          <text data-annotation-id="${escapeHtml(annotation.id || annotation.label || "line")}"${sourceAttrs} x="${clamp(x2 + 6, 12, width - 120)}" y="${Math.max(y2 - 6, 12)}" fill="${labelColor}" font-size="11">${escapeHtml(annotation.label || "line")}</text>
        `;
      }

      if (annotation.type === "zone") {
        const startX = timeToX(annotation.startTime);
        const endX = timeToX(annotation.endTime);
        const minY = priceToY(annotation.maxPrice);
        const maxY = priceToY(annotation.minPrice);

        if ([startX, endX, minY, maxY].some((value) => value === null || value === undefined)) {
          return "";
        }

        const x = Math.min(startX, endX);
        const y = Math.min(minY, maxY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(maxY - minY);

        return `
          <rect data-annotation-id="${escapeHtml(annotation.id || annotation.label || "zone")}"${sourceAttrs} x="${x}" y="${y}" width="${Math.max(rectWidth, 6)}" height="${Math.max(rectHeight, 6)}" fill="${escapeHtml(annotation.color || "rgba(14,165,160,0.14)")}" stroke="${escapeHtml(annotation.lineColor || annotation.color || "#0ea5a0")}" stroke-width="${annotation.role === "focus-region" ? "2" : isIndicator ? "1.7" : "1.5"}" stroke-dasharray="${dash}" rx="6" ry="6" opacity="${isIndicator ? "0.9" : "1"}" />
          <text data-annotation-id="${escapeHtml(annotation.id || annotation.label || "zone")}"${sourceAttrs} x="${clamp(x + 6, 12, width - 120)}" y="${Math.max(y + 14, 12)}" fill="${labelColor}" font-size="11">${escapeHtml(annotation.label || "zone")}</text>
        `;
      }

      if (annotation.type === "marker") {
        const x = timeToX(annotation.time);
        const y = priceToY(annotation.price);

        if ([x, y].some((value) => value === null || value === undefined)) {
          return "";
        }

        return `
          <circle data-annotation-id="${escapeHtml(annotation.id || annotation.label || "marker")}"${sourceAttrs} cx="${x}" cy="${y}" r="${isIndicator ? "4.3" : "5"}" fill="${escapeHtml(annotation.color || "#0ea5a0")}" opacity="${isIndicator ? "0.92" : "1"}" />
          <text data-annotation-id="${escapeHtml(annotation.id || annotation.label || "marker")}"${sourceAttrs} x="${clamp(x + 8, 12, width - 120)}" y="${Math.max(y - 8, 12)}" fill="${labelColor}" font-size="11">${escapeHtml(annotation.label || "marker")}</text>
        `;
      }

      return "";
    })
    .join("");
}

function renderChartOverlay() {
  if (!CHART_DRAWING_ENABLED && !CHART_AI_OVERLAY_ENABLED) {
    if (elements.chartAiOverlay) {
      elements.chartAiOverlay.innerHTML = "";
    }
    if (elements.chartDrawingOverlay) {
      elements.chartDrawingOverlay.innerHTML = "";
    }
    return;
  }

  const selectionActive = Boolean(state.overlaySelection.active);
  const drawingAnnotations = [...state.manualAnnotations, ...(!selectionActive && state.focusRegion ? [state.focusRegion] : [])];
  const automatedAnnotations = [
    ...(CHART_AI_OVERLAY_ENABLED && elements.overlayToggle.checked
      ? selectionActive
        ? []
        : state.aiAnnotations.length
        ? state.aiAnnotations
        : isOverlaySelectionMode() && !state.focusRegion
          ? []
          : state.snapshot?.annotations || []
      : []),
    ...(CHART_AI_OVERLAY_ENABLED && elements.overlayToggle.checked && !selectionActive ? state.overlayIndicatorAnnotations : [])
  ];
  const sourceMap = state.annotationSourceMap || {};

  if (!state.snapshot || state.activeViewId !== "marketView" || !state.chartGeometry) {
    if (elements.chartAiOverlay) {
      elements.chartAiOverlay.innerHTML = "";
    }
    if (elements.chartDrawingOverlay) {
      elements.chartDrawingOverlay.innerHTML = "";
    }
    return;
  }

  const width = elements.chartHost.clientWidth;
  const height = elements.chartHost.clientHeight;
  const { candles, left, plotWidth, priceTop, priceHeight, minPrice, maxPrice } = state.chartGeometry;

  const priceToY = (price) => {
    const ratio = (Number(price) - minPrice) / Math.max(maxPrice - minPrice, 1);
    return priceTop + priceHeight - ratio * priceHeight;
  };
  const timeToX = (time) => {
    if (!candles.length) {
      return null;
    }

    const firstTime = candles[0].timestamp;
    const lastTime = candles.at(-1).timestamp;
    const ratio = (Number(time) - firstTime) / Math.max(lastTime - firstTime, 1);
    return left + clamp(ratio, 0, 1) * plotWidth;
  };

  const selectionRect = state.overlaySelection.active && state.overlaySelection.start && state.overlaySelection.current
    ? (() => {
        const startX = timeToX(state.overlaySelection.start.time);
        const endX = timeToX(state.overlaySelection.current.time);
        const startY = priceToY(state.overlaySelection.start.price);
        const endY = priceToY(state.overlaySelection.current.price);

        if ([startX, endX, startY, endY].some((value) => value === null || value === undefined)) {
          return "";
        }

        return `
          <rect x="${Math.min(startX, endX)}" y="${Math.min(startY, endY)}" width="${Math.max(Math.abs(endX - startX), 6)}" height="${Math.max(Math.abs(endY - startY), 6)}" fill="rgba(96, 165, 250, 0.14)" stroke="#60a5fa" stroke-width="1.8" stroke-dasharray="6 4" rx="6" ry="6" />
        `;
      })()
    : "";

  const pendingDrawingPreview = state.pendingDrawing && state.drawingTool !== "move"
    ? (() => {
        const x = timeToX(state.pendingDrawing.time);
        const y = priceToY(state.pendingDrawing.price);

        if ([x, y].some((value) => value === null || value === undefined)) {
          return "";
        }

        return `
          <circle cx="${x}" cy="${y}" r="5.5" fill="#f59e0b" opacity="0.95" />
          <circle cx="${x}" cy="${y}" r="11" fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4 3" />
          <text x="${clamp(x + 10, 12, width - 120)}" y="${Math.max(y - 10, 12)}" fill="#ffd089" font-size="11">${escapeHtml(state.drawingTool === "question-zone" ? "질문 구간 시작" : "드로잉 시작점")}</text>
        `;
      })()
    : "";

  if (elements.chartAiOverlay) {
    renderAnnotationsToLayer(elements.chartAiOverlay, automatedAnnotations, state.chartGeometry, sourceMap);
  }

  if (elements.chartDrawingOverlay) {
    renderAnnotationsToLayer(elements.chartDrawingOverlay, drawingAnnotations, state.chartGeometry);
    elements.chartDrawingOverlay.innerHTML += selectionRect + pendingDrawingPreview;
  }
}

function renderChart(snapshot) {
  if (state.activeViewId !== "marketView") {
    return;
  }

  const hostWidth = elements.chartHost?.clientWidth || 0;
  const hostHeight = elements.chartHost?.clientHeight || 0;

  if (hostWidth < 120 || hostHeight < 220) {
    window.requestAnimationFrame(() => renderChart(snapshot));
    return;
  }

  ensureChartInteractions();

  const visibleCandles = getVisibleCandles(snapshot);

  if (!visibleCandles.length) {
    state.chartGeometry = null;
    elements.chartCanvas.innerHTML = "";
    if (elements.chartAiOverlay) {
      elements.chartAiOverlay.innerHTML = "";
    }
    if (elements.chartDrawingOverlay) {
      elements.chartDrawingOverlay.innerHTML = "";
    }
    return;
  }

  const padding = { top: 14, right: 82, bottom: 24, left: 12 };
  const innerHeight = hostHeight - padding.top - padding.bottom;
  const volumeHeight = Math.max(innerHeight * 0.19, 48);
  const separatorGap = 14;
  const priceHeight = Math.max(innerHeight - volumeHeight - separatorGap, 120);
  const priceTop = padding.top;
  const volumeTop = priceTop + priceHeight + separatorGap;
  const plotWidth = Math.max(hostWidth - padding.left - padding.right, 80);
  const candleGap = plotWidth / Math.max(visibleCandles.length, 1);
  const candleWidth = Math.max(Math.min(candleGap * 0.56, 12), 3);

  const lows = visibleCandles.map((candle) => candle.low);
  const highs = visibleCandles.map((candle) => candle.high);
  const maxVolume = Math.max(...visibleCandles.map((candle) => candle.volume), 1);
  const minLow = Math.min(...lows);
  const maxHigh = Math.max(...highs);
  const pricePadding = (maxHigh - minLow || snapshot.primary.priceUsdt * 0.02 || 1) * 0.12;
  const minPrice = Math.max(minLow - pricePadding, 0);
  const maxPrice = maxHigh + pricePadding;

  const yForPrice = (price) => {
    const ratio = (price - minPrice) / Math.max(maxPrice - minPrice, 1);
    return priceTop + priceHeight - ratio * priceHeight;
  };
  const yForVolume = (volume) => volumeTop + volumeHeight - (volume / Math.max(maxVolume, 1)) * volumeHeight;
  const xForIndex = (index) => padding.left + candleGap * index + candleGap / 2;

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = priceTop + priceHeight * ratio;
    const price = maxPrice - (maxPrice - minPrice) * ratio;
    return `
      <line x1="${padding.left}" y1="${y}" x2="${padding.left + plotWidth}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <text x="${padding.left + plotWidth + 10}" y="${y + 4}" fill="#96a7b5" font-size="11">${escapeHtml(formatNumber(price, 2))}</text>
    `;
  }).join("");

  const timeLabels = visibleCandles
    .filter(
      (_candle, index) =>
        index === 0 ||
        index === visibleCandles.length - 1 ||
        index % Math.max(Math.floor(visibleCandles.length / 4), 1) === 0
    )
    .map((candle, index, collection) => {
      const candleIndex = visibleCandles.findIndex((entry) => entry.timestamp === candle.timestamp);
      const x = xForIndex(candleIndex);
      const anchor = index === 0 ? "start" : index === collection.length - 1 ? "end" : "middle";
      const timeLabel =
        snapshot.timeframe === "1w" || snapshot.timeframe === "1d"
          ? new Date(candle.timestamp).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
          : formatShortTime(candle.timestamp);

      return `<text x="${x}" y="${hostHeight - 4}" text-anchor="${anchor}" fill="#96a7b5" font-size="11">${escapeHtml(timeLabel)}</text>`;
    })
    .join("");

  const candleSvg = visibleCandles
    .map((candle, index) => {
      const x = xForIndex(index);
      const openY = yForPrice(candle.open);
      const closeY = yForPrice(candle.close);
      const highY = yForPrice(candle.high);
      const lowY = yForPrice(candle.low);
      const isUp = candle.close >= candle.open;
      const color = isUp ? "#09b9b3" : "#ef6257";
      const bodyY = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);
      const volumeY = yForVolume(candle.volume);
      const volumeHeightPx = volumeTop + volumeHeight - volumeY;

      return `
        <line x1="${x}" y1="${highY}" x2="${x}" y2="${lowY}" stroke="${color}" stroke-width="1.4" />
        <rect x="${x - candleWidth / 2}" y="${bodyY}" width="${candleWidth}" height="${bodyHeight}" fill="${color}" rx="1.5" ry="1.5" />
        <rect x="${x - candleWidth / 2}" y="${volumeY}" width="${candleWidth}" height="${Math.max(volumeHeightPx, 1)}" fill="${isUp ? "rgba(9,185,179,0.58)" : "rgba(239,98,87,0.58)"}" rx="1" ry="1" />
      `;
    })
    .join("");

  const currentLineY = yForPrice(snapshot.primary.priceUsdt);
  const currentLine = `
    <line x1="${padding.left}" y1="${currentLineY}" x2="${padding.left + plotWidth}" y2="${currentLineY}" stroke="rgba(111, 227, 215, 0.45)" stroke-width="1" stroke-dasharray="5 4" />
    <text x="${padding.left + plotWidth + 10}" y="${currentLineY - 6}" fill="#6fe3d7" font-size="11">NOW ${escapeHtml(formatNumber(snapshot.primary.priceUsdt, 2))}</text>
  `;

  elements.chartCanvas.innerHTML = `
    <svg viewBox="0 0 ${hostWidth} ${hostHeight}" width="100%" height="100%" role="img" aria-label="${escapeHtml(snapshot.symbol)} candle chart">
      <rect x="0" y="0" width="${hostWidth}" height="${hostHeight}" fill="transparent" />
      ${gridLines}
      <line x1="${padding.left}" y1="${volumeTop - 8}" x2="${padding.left + plotWidth}" y2="${volumeTop - 8}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <text x="${padding.left}" y="${volumeTop - 14}" fill="#96a7b5" font-size="11">Vol ${escapeHtml(formatNumber(maxVolume, 2))}</text>
      ${currentLine}
      ${candleSvg}
      ${timeLabels}
    </svg>
  `;

  state.chartGeometry = {
    candles: visibleCandles,
    left: padding.left,
    plotWidth,
    priceTop,
    priceHeight,
    minPrice,
    maxPrice,
    candleGap
  };

  window.requestAnimationFrame(renderChartOverlay);
  window.requestAnimationFrame(() => renderChartNavigator(snapshot));
}

function renderMarketWorkspace(snapshot) {
  const timeframeLabel =
    state.timeframes.find((timeframe) => timeframe.id === snapshot.timeframe)?.label || snapshot.timeframe;

  syncChartFeatureAvailability();

  elements.marketHeadline.textContent = `${snapshot.symbol} / ${snapshot.pair}`;
  elements.chartMeta.textContent = `Binance Spot · ${timeframeLabel}`;
  elements.selectedMarketMeta.textContent = `${snapshot.primary.market} · ${formatUsdt(snapshot.primary.priceUsdt)}`;
  elements.selectedLocalMeta.textContent = snapshot.local.available
    ? `빗썸 ${formatKrw(snapshot.local.priceKrw)} · 괴리 ${formatPct(snapshot.comparison.premiumPct)}`
    : "빗썸 비교 없음";

  elements.chartSymbolChip.textContent = snapshot.primary.market;
  elements.chartTimeframeChip.textContent = timeframeLabel;
  elements.chartPriceChip.textContent = formatUsdt(snapshot.primary.priceUsdt);
  elements.chartComparisonChip.textContent = snapshot.local.available
    ? `빗썸 괴리 ${formatPct(snapshot.comparison.premiumPct)}`
    : "빗썸 미지원";

  renderOrderbook(snapshot);
  renderTrades(snapshot);
  renderDrawingTools();
  renderOverlayIndicatorControls();
  renderOverlaySignalList();
  renderOverlayBiasCard();
  renderOverlayAnnotationSource();
  updateChartOverlayMode();
  setOverlayAnalysisStatus(
    CHART_AI_OVERLAY_ENABLED && elements.overlayToggle.checked
      ? state.focusRegion
        ? "선택 구간이 활성화되어 있습니다. 지표 토글을 바꾸면 즉시 반영됩니다."
        : state.overlaySelectionMode
          ? "구간 선택 모드입니다. 차트를 드래그해 AI 분석 범위를 지정하세요."
          : "오버레이는 켜져 있습니다. 구간 선택 모드를 켜거나 현재 화면 선택을 사용하세요."
      : "차트는 현재 읽기 전용입니다."
  );
  renderAnnotationList();
  renderTimeframeButtons();
  renderMarketSymbolList();
  renderChart(snapshot);
}

function renderSnapshot(snapshot) {
  state.snapshot = snapshot;
  resetChartViewport(snapshot);
  if (state.focusRegion && ((state.focusRegion.symbol && state.focusRegion.symbol !== snapshot.symbol) || (state.focusRegion.timeframe && state.focusRegion.timeframe !== snapshot.timeframe))) {
    clearFocusRegion({ preserveStatus: true });
  }
  const factsHtml = renderFactsHtml(snapshot);

  elements.primaryMetricLabel.textContent = "바이낸스 현재가";
  elements.secondaryMetricLabel.textContent = snapshot.local.available ? "빗썸 비교가" : "빗썸 비교";
  elements.premiumMetricLabel.textContent = "가격 괴리";
  elements.bithumbPrice.textContent = formatUsdt(snapshot.primary.priceUsdt);
  elements.bithumbChange.textContent = `24h ${formatPct(snapshot.primary.change24hPct)}`;
  elements.benchmarkPrice.textContent = snapshot.local.available ? formatKrw(snapshot.local.priceKrw) : "미지원";
  elements.benchmarkChange.textContent = snapshot.local.available
    ? `Bithumb ${formatPct(snapshot.local.change24hPct)}`
    : "국내 비교 종목 없음";
  elements.premium.textContent = snapshot.local.available ? formatPct(snapshot.comparison.premiumPct) : "미지원";
  elements.premium.className =
    snapshot.local.available && snapshot.comparison.premiumPct >= 0 ? "positive" : "negative";
  elements.usdtKrw.textContent = `USDT/KRW ${formatKrw(snapshot.usdtKrw)}`;
  elements.fetchedAt.textContent = new Date(snapshot.fetchedAt).toLocaleString("ko-KR");
  elements.marketDetails.innerHTML = factsHtml;
  elements.marketDetailsMirror.innerHTML = factsHtml;

  renderMarketWorkspace(snapshot);
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
          <span>${escapeHtml(module.label)}</span>
          <small>${escapeHtml(module.description)}</small>
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
      return `<div class="module-result ${module.status}"><strong>${escapeHtml(module.label)}</strong><span>${escapeHtml(message)}</span></div>`;
    })
    .join("");
}

function renderAccount(account) {
  state.account = account;

  if (!account) {
    elements.accountStatus.textContent = "계정 상태를 불러오지 못했습니다.";
    return;
  }

  elements.accountStatus.innerHTML = `
    <strong>${account.authenticated ? "로그인됨" : "로그인 전"}</strong>
    <span>${escapeHtml(account.message)}</span>
    <span>서버 준비 상태: ${account.serverReady ? "ready" : "pending"}</span>
    <span>연결 제공자: ${escapeHtml(account.provider || "미설정")}</span>
  `;

  if (account.user?.username) {
    elements.authUsernameInput.value = account.user.username;
    elements.authDisplayNameInput.value = account.user.display_name || "";
  }

  const aiSettings = account.aiSettings || {
    provider: "auto",
    openAiModel: "gpt-4.1-mini",
    geminiModel: "gemini-2.5-flash",
    hasOpenAiKey: false,
    hasGeminiKey: false
  };

  elements.accountAiProviderSelect.value = aiSettings.provider || "auto";
  elements.accountOpenAiKeyInput.value = "";
  elements.accountGeminiKeyInput.value = "";
  if (account.authenticated) {
    elements.aiProviderSelect.value = aiSettings.provider || "auto";
  }
  setStoredKeySummary(
    `저장 상태 · GPT ${aiSettings.hasOpenAiKey ? "있음" : "없음"} (${aiSettings.openAiModel || "기본"}) / Gemini ${
      aiSettings.hasGeminiKey ? "있음" : "없음"
    } (${aiSettings.geminiModel || "기본"})`
  );
  setAiSettingsStatus(
    account.authenticated
      ? `저장 상태 · GPT 키 ${aiSettings.hasOpenAiKey ? "있음" : "없음"} / Gemini 키 ${
          aiSettings.hasGeminiKey ? "있음" : "없음"
        }`
      : "로그인 후 계정별 AI 설정을 저장할 수 있습니다."
  );
}

function setActiveView(viewId) {
  state.activeViewId = viewId;
  elements.views.forEach((view) => {
    const isActive = view.id === viewId;
    view.hidden = !isActive;
    view.classList.toggle("is-active", isActive);
  });
  elements.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === viewId);
  });
  elements.viewTitle.textContent = viewTitles[viewId] || "Gainob";
  savePersonalSettings();

  if (viewId === "marketView" && state.snapshot) {
    window.requestAnimationFrame(() => {
      renderMarketWorkspace(state.snapshot);
      renderChartOverlay();
    });
  }
}

function getEnabledModules() {
  return Array.from(elements.moduleList.querySelectorAll("input[type='checkbox']"))
    .filter((input) => input.checked || input.disabled)
    .map((input) => input.value);
}

function buildAnalysisPayload() {
  return {
    symbol: elements.coinSelect.value,
    timeframe: elements.timeframeSelect.value,
    provider: elements.aiProviderSelect.value || "auto",
    manualAnnotations: state.manualAnnotations,
    focusRegion: state.focusRegion,
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

function formatAiHeading(provider, model) {
  if (!provider) {
    return "[AI]";
  }

  const providerLabel =
    provider === "openai" ? "GPT" : provider === "gemini" ? "Gemini" : provider === "auto" ? "Auto" : "AI";

  return model ? `[${providerLabel} · ${model}]` : `[${providerLabel}]`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "요청에 실패했습니다.");
  }

  return payload;
}

function buildAuthPayload() {
  return {
    username: elements.authUsernameInput.value,
    displayName: elements.authDisplayNameInput.value,
    password: elements.authPasswordInput.value
  };
}

async function loadCoins() {
  const payload = await fetchJson("/api/coins");
  state.coins = payload.coins || [];
  state.timeframes = payload.timeframes || [];

  elements.coinSelect.innerHTML = state.coins
    .map((coin) => `<option value="${coin.symbol}">${coin.symbol}</option>`)
    .join("");
  elements.timeframeSelect.innerHTML = state.timeframes
    .map((timeframe) => `<option value="${timeframe.id}">${timeframe.label}</option>`)
    .join("");

  const initialCoin = elements.coinSelect.dataset.initialValue || "BTC";
  const initialTimeframe = elements.timeframeSelect.dataset.initialValue || "1h";

  if (state.coins.some((coin) => coin.symbol === initialCoin)) {
    elements.coinSelect.value = initialCoin;
  } else if (state.coins[0]) {
    elements.coinSelect.value = state.coins[0].symbol;
  }

  if (state.timeframes.some((timeframe) => timeframe.id === initialTimeframe)) {
    elements.timeframeSelect.value = initialTimeframe;
  }

  renderTimeframeButtons();
  renderMarketSymbolList();
}

async function loadModules() {
  const payload = await fetchJson("/api/modules");
  renderModules(payload.modules);
}

async function loadAccount() {
  try {
    const payload = await fetchJson("/api/session");
    renderAccount(payload);
    await loadHistory();
    await loadStoredKeys();
    await loadConversations();
  } catch (_error) {
    renderAccount(null);
    renderHistory([]);
    renderChatMessages();
  }
}

async function loadHistory() {
  if (!state.account?.authenticated) {
    renderHistory([]);
    return;
  }

  try {
    const payload = await fetchJson("/api/history");
    renderHistory(payload.items || []);
  } catch (_error) {
    renderHistory([]);
  }
}

async function saveAiSettings() {
  if (!state.account?.authenticated) {
    setAiSettingsStatus("먼저 로그인해야 계정별 AI 설정을 저장할 수 있습니다.");
    return;
  }

  try {
    const payload = await fetchJson("/api/account/ai-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider: elements.accountAiProviderSelect.value || "auto",
        openAiKey: elements.accountOpenAiKeyInput.value,
        geminiKey: elements.accountGeminiKeyInput.value
      })
    });

    const mergedAccount = {
      ...(state.account || {}),
      aiSettings: payload.aiSettings
    };
    state.account = mergedAccount;
    renderAccount(mergedAccount);
    elements.aiProviderSelect.value = payload.aiSettings.provider || "auto";
    savePersonalSettings();
    setAiSettingsStatus(
      `저장 완료 · GPT 키 ${payload.aiSettings.hasOpenAiKey ? "있음" : "없음"} / Gemini 키 ${
        payload.aiSettings.hasGeminiKey ? "있음" : "없음"
      }`
    );
  } catch (error) {
    setAiSettingsStatus(error.message);
  }
}

async function registerAccount() {
  try {
    const payload = await fetchJson("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildAuthPayload())
    });

    elements.authPasswordInput.value = "";
    renderAccount({
      ...(state.account || {}),
      authenticated: true,
      provider: "internal",
      serverReady: true,
      user: payload.user,
      message: `${payload.user.display_name} 계정이 생성되고 로그인되었습니다.`
    });
    await loadAccount();
  } catch (error) {
    renderAccount({
      ...(state.account || {}),
      authenticated: false,
      user: null,
      message: error.message,
      serverReady: state.account?.serverReady || false,
      provider: "internal"
    });
  }
}

async function loginAccount() {
  try {
    const payload = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildAuthPayload())
    });

    elements.authPasswordInput.value = "";
    renderAccount({
      ...(state.account || {}),
      authenticated: true,
      provider: "internal",
      serverReady: true,
      user: payload.user,
      message: `${payload.user.display_name} 계정으로 로그인되었습니다.`
    });
    await loadAccount();
  } catch (error) {
    renderAccount({
      ...(state.account || {}),
      authenticated: false,
      user: null,
      message: error.message,
      serverReady: state.account?.serverReady || false,
      provider: "internal"
    });
  }
}

async function logoutAccount() {
  try {
    await fetchJson("/api/auth/logout", {
      method: "POST"
    });

    elements.authPasswordInput.value = "";
    renderAccount({
      ...(state.account || {}),
      authenticated: false,
      user: null,
      provider: "internal",
      serverReady: true,
      message: "로그아웃되었습니다."
    });
    renderHistory([]);
    await loadAccount();
  } catch (error) {
    renderAccount({
      ...(state.account || {}),
      message: error.message
    });
  }
}

async function deleteAccount() {
  if (!state.account?.authenticated || !state.account?.user?.username) {
    renderAccount({
      ...(state.account || {}),
      message: "먼저 로그인한 뒤 탈퇴할 수 있습니다."
    });
    return;
  }

  const confirmed = window.confirm(
    `${state.account.user.username} 계정을 삭제합니다. 저장된 프로필과 저널도 함께 삭제됩니다. 계속할까요?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await fetchJson("/api/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: elements.deletePasswordInput.value
      })
    });

    elements.authPasswordInput.value = "";
    elements.deletePasswordInput.value = "";
    renderAccount({
      ...(state.account || {}),
      authenticated: false,
      user: null,
      provider: "internal",
      serverReady: true,
      message: "계정이 삭제되었습니다."
    });
    renderHistory([]);
    await loadAccount();
  } catch (error) {
    renderAccount({
      ...(state.account || {}),
      message: error.message
    });
  }
}

async function refreshMarket() {
  const symbol = elements.coinSelect.value;
  const timeframe = elements.timeframeSelect.value || "1h";
  const requestId = state.latestMarketRequestId + 1;
  state.latestMarketRequestId = requestId;
  state.aiAnnotations = [];
  state.overlayIndicatorAnnotations = [];
  state.overlaySignals = [];
  state.focusRegion = null;
  state.chartGeometry = null;
  updateChatContextMeta();
  savePersonalSettings();
  setAnalysisMessage("시세를 먼저 불러오는 중입니다...");
  setFloatingBriefingMeta("시장 데이터 로딩 중");

  try {
    const [briefing, directionScan] = await Promise.all([
      fetchJson(`/api/public/briefing?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`),
      fetchJson(`/api/public/direction?timeframe=${encodeURIComponent(timeframe)}&limit=5&universe=10`)
    ]);

    if (requestId !== state.latestMarketRequestId) {
      return;
    }

    renderSnapshot(briefing.market);
    renderBriefing(briefing);
    renderDirectionScan(directionScan);
    renderModuleStatus(null);
    setAnalysisMessage("공개 브리핑과 시장 스냅샷을 불러왔습니다. 이제 이 데이터를 기준으로 코인 대화를 이어갈 수 있습니다.");
    setFloatingBriefingMeta(`${briefing.symbol} · ${briefing.timeframe} · public briefing ready`);
  } catch (error) {
    state.briefing = null;
    state.directionScan = null;
    setAnalysisMessage(error.message);
    elements.macroStatsOutput.innerHTML = renderStatRows([["로드 실패", error.message]]);
    elements.newsStatsOutput.innerHTML = renderStatRows([["로드 실패", error.message]]);
    elements.directionScannerMeta.textContent = "Multi-signal";
    elements.directionScannerList.innerHTML = error.message;
    setFloatingBriefingMeta("시장 데이터 로드 실패");
  }
}

async function analyze() {
  savePersonalSettings();
  setActiveView("briefingView");
  updateChatContextMeta();
  if (!elements.chatPromptInput.value.trim()) {
    const seedPrompt = `${elements.coinSelect.value} ${elements.timeframeSelect.value} 기준으로 지금 상태를 내 투자 스타일과 메모를 반영해서 설명해줘.`;
    elements.chatPromptInput.value = seedPrompt;
    if (elements.floatingChatPromptInput) {
      elements.floatingChatPromptInput.value = seedPrompt;
    }
  }
  elements.chatPromptInput.focus();
  setFloatingBriefingMeta("대화 입력 대기 중");
}

elements.refreshButton.addEventListener("click", refreshMarket);
elements.analyzeButton.addEventListener("click", analyze);
elements.resetChartViewButton.addEventListener("click", () => {
  if (!state.snapshot) {
    return;
  }

  resetChartViewport(state.snapshot);
  setChartHint("차트 뷰를 기본값으로 초기화했습니다.");
  renderChart(state.snapshot);
  renderChartOverlay();
});
elements.floatingBriefingOpenButton.addEventListener("click", () => {
  setActiveView("briefingView");
});
elements.floatingBriefingHistoryButton?.addEventListener("click", () => {
  state.floatingHistoryOpen = !state.floatingHistoryOpen;
  renderConversationList();
});
elements.floatingBriefingMinimizeButton.addEventListener("click", () => {
  state.floatingPanel.minimized = !state.floatingPanel.minimized;
  updateFloatingBriefingState();
  savePersonalSettings();
});
elements.chartHost.addEventListener("click", (event) => {
  if (!CHART_DRAWING_ENABLED) {
    return;
  }

  if (state.drawingTool === "move") {
    return;
  }

  if (state.overlaySelection.handledPointerUp) {
    state.overlaySelection.handledPointerUp = false;
    return;
  }

  handleDrawingClick(event);
});
elements.chartHost.addEventListener("contextmenu", (event) => {
  if (!CHART_DRAWING_ENABLED && !CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  const annotationElement = event.target.closest?.("[data-annotation-id]");

  if (!annotationElement) {
    return;
  }

  event.preventDefault();

  if (!removeAnnotationById(annotationElement.getAttribute("data-annotation-id"))) {
    return;
  }

  state.pendingDrawing = null;
  renderAnnotationList();
  renderChartOverlay();
  updateChatContextMeta();
  setChartHint("선택한 주석을 제거했습니다.");
});
elements.marketSearchInput.addEventListener("input", (event) => {
  state.marketSearchTerm = event.target.value;
  savePersonalSettings();
  renderMarketSymbolList();
});
elements.marketSymbolList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-symbol-row]");

  if (!button) {
    return;
  }

  clearManualAnnotations();
  elements.coinSelect.value = button.dataset.symbolRow;
  renderMarketSymbolList();
  refreshMarket();
});
elements.timeframeShortcutList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shortcut-timeframe]");

  if (!button) {
    return;
  }

  clearManualAnnotations();
  elements.timeframeSelect.value = button.dataset.shortcutTimeframe;
  renderTimeframeButtons();
  refreshMarket();
});
elements.drawingToolList.addEventListener("click", (event) => {
  if (!CHART_DRAWING_ENABLED) {
    return;
  }

  const button = event.target.closest("[data-drawing-tool]");

  if (!button) {
    return;
  }

  state.drawingTool = button.dataset.drawingTool;
  state.pendingDrawing = null;
  renderDrawingTools();
  updateChartOverlayMode();
  setChartHint(
    state.drawingTool === "move"
      ? isOverlaySelectionMode()
        ? "드래그로 분석 구간 선택, 휠로 확대/축소"
        : "드래그로 이동, 휠로 확대/축소, 더블클릭으로 초기화"
      : `${button.textContent.trim()} 도구 선택됨. 차트 위를 클릭해 표시하세요.`
  );
});
elements.undoDrawingButton.addEventListener("click", () => {
  state.manualAnnotations.pop();
  state.pendingDrawing = null;
  renderAnnotationList();
  renderChartOverlay();
  setChartHint("마지막 수동 드로잉을 제거했습니다.");
});
elements.clearDrawingsButton.addEventListener("click", clearManualAnnotations);
elements.overlaySelectionModeButton?.addEventListener("click", () => {
  if (!CHART_AI_OVERLAY_ENABLED || !elements.overlayToggle?.checked) {
    return;
  }

  state.overlaySelectionMode = !state.overlaySelectionMode;
  savePersonalSettings();
  updateChartOverlayMode();
  setOverlayAnalysisStatus(
    state.overlaySelectionMode
      ? "구간 선택 모드 활성화. 차트를 드래그해 AI 분석 범위를 지정하세요."
      : "구간 선택 모드 해제. 드래그로 화면 이동을 사용할 수 있습니다."
  );
  setChartHint(
    state.overlaySelectionMode
      ? "드래그로 분석 구간 선택, 휠로 확대/축소"
      : "드래그로 이동, 휠로 확대/축소, 더블클릭으로 초기화"
  );
});
elements.overlayToggle.addEventListener("change", () => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  state.overlaySelectionMode = elements.overlayToggle.checked ? true : false;
  if (elements.overlayToggle.checked && !state.focusRegion) {
    state.aiAnnotations = [];
    state.annotationSourceMap = {};
  }
  savePersonalSettings();
  updateChartOverlayMode();
  renderOverlayIndicatorControls();
  if (elements.overlayToggle.checked && state.focusRegion) {
    refreshOverlayIndicators();
    requestOverlayAnalysis();
    setOverlayAnalysisStatus("오버레이 분석 모드 활성화");
    setChartHint("드래그해서 분석할 구간을 지정하세요.");
  } else if (elements.overlayToggle.checked) {
    setOverlayAnalysisStatus("오버레이 활성화. 기본값은 구간 선택 모드입니다.");
    setChartHint("드래그로 분석 구간 선택, 휠로 확대/축소");
  } else {
    renderAnnotationList();
    renderOverlaySignalList();
    renderOverlayBiasCard();
    renderOverlayAnnotationSource();
    renderChartOverlay();
    setOverlayAnalysisStatus("AI 오버레이를 켜면 차트를 드래그해서 영역 분석을 시작할 수 있습니다.");
  }
});
elements.overlayIndicatorList?.addEventListener("click", (event) => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  const button = event.target.closest("[data-overlay-indicator]");
  if (!button) {
    return;
  }

  const indicatorId = button.dataset.overlayIndicator;
  state.overlayIndicators[indicatorId] = !state.overlayIndicators[indicatorId];
  savePersonalSettings();
  renderOverlayIndicatorControls();
  refreshOverlayIndicators();
  setOverlayAnalysisStatus(
    state.focusRegion
      ? `${button.textContent.trim()} ${state.overlayIndicators[indicatorId] ? "표시" : "숨김"}`
      : `${button.textContent.trim()} 옵션을 저장했습니다. 구간 선택 후 바로 반영됩니다.`
  );
});
elements.overlayAnalyzeButton?.addEventListener("click", () => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  requestOverlayAnalysis();
});
elements.overlayUseVisibleRangeButton?.addEventListener("click", () => {
  if (!CHART_AI_OVERLAY_ENABLED || !state.snapshot) {
    return;
  }

  const region = buildFocusRegionFromVisibleRange(state.snapshot);
  if (!region) {
    setOverlayAnalysisStatus("현재 화면 범위를 구간으로 만들 수 없습니다.");
    return;
  }

  setFocusRegion(region);
});
elements.overlayRestoreSelectionButton?.addEventListener("click", () => {
  if (!CHART_AI_OVERLAY_ENABLED || !state.snapshot) {
    return;
  }

  if (!restoreSavedFocusRegion(state.snapshot)) {
    setOverlayAnalysisStatus("현재 종목/타임프레임에 복원할 저장 구간이 없습니다.");
    return;
  }

  renderAnnotationList();
  renderChartOverlay();
  renderChartNavigator(state.snapshot);
  updateChatContextMeta();
  setOverlayAnalysisStatus("저장된 구간을 복원했습니다.");
});
elements.overlayClearSelectionButton?.addEventListener("click", () => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  clearFocusRegion();
});
elements.overlayIndicatorsOnlyButton?.addEventListener("click", () => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  refreshOverlayIndicators();
  setOverlayAnalysisStatus("선택 구간 지표만 다시 계산했습니다.");
});
elements.overlayChatButton?.addEventListener("click", async () => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  if (!state.focusRegion) {
    setOverlayAnalysisStatus("먼저 구간을 선택하세요.");
    return;
  }

  seedOverlayChatPrompt();
  setActiveView("briefingView");
  if (state.account?.authenticated) {
    await sendChatMessage();
  } else {
    elements.chatPromptInput?.focus();
    setAnalysisMessage("로그인 후 구간 분석을 채팅으로 바로 전송할 수 있습니다.");
  }
});
elements.chartAiOverlay?.addEventListener("click", (event) => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  const target = event.target.closest("[data-chat-message-id]");
  if (!target) {
    return;
  }

  const messageId = target.dataset.chatMessageId;
  const annotationId = target.dataset.annotationId;
  state.selectedAnnotationSource = annotationId ? state.annotationSourceMap[annotationId] || null : null;
  renderOverlayAnnotationSource();
  focusLinkedChatMessage(messageId);
});
elements.overlayAnnotationSource?.addEventListener("click", (event) => {
  if (!CHART_AI_OVERLAY_ENABLED) {
    return;
  }

  const button = event.target.closest("[data-jump-chat-message-id]");
  if (!button) {
    return;
  }

  focusLinkedChatMessage(button.dataset.jumpChatMessageId);
});
elements.registerButton.addEventListener("click", registerAccount);
elements.loginButton.addEventListener("click", loginAccount);
elements.logoutButton.addEventListener("click", logoutAccount);
elements.deleteAccountButton.addEventListener("click", deleteAccount);
elements.saveAiSettingsButton.addEventListener("click", saveAiSettings);
elements.sendChatButton?.addEventListener("click", sendChatMessage);
elements.floatingSendChatButton?.addEventListener("click", () => sendChatMessage("floating"));
elements.newConversationButton?.addEventListener("click", createNewConversation);
elements.storedKeyList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-provider]");
  if (!button) {
    return;
  }

  deleteStoredKey(button.dataset.provider);
});
elements.floatingConversationList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-conversation-id]");
  if (!button) {
    return;
  }

  await loadConversation(button.dataset.conversationId);
  state.floatingHistoryOpen = false;
  renderConversationList();
});
elements.conversationList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-conversation-id]");
  if (!button) {
    return;
  }

  await loadConversation(button.dataset.conversationId);
});
elements.deleteConversationButton?.addEventListener("click", deleteCurrentConversation);
elements.chatPromptInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});
elements.floatingChatPromptInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage("floating");
  }
});
elements.chatPromptInput?.addEventListener("input", () => {
  if (elements.floatingChatPromptInput && document.activeElement === elements.chatPromptInput) {
    elements.floatingChatPromptInput.value = elements.chatPromptInput.value;
  }
});
elements.floatingChatPromptInput?.addEventListener("input", () => {
  if (elements.chatPromptInput && document.activeElement === elements.floatingChatPromptInput) {
    elements.chatPromptInput.value = elements.floatingChatPromptInput.value;
  }
});
elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.viewTarget);
  });
});

[
  elements.aiProviderSelect,
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
updateFloatingBriefingState();
ensureFloatingBriefingInteractions();

Promise.all([loadCoins(), loadModules(), loadAccount()])
  .then(() => {
    setActiveView(state.activeViewId);
    updateChatContextMeta();
    return refreshMarket();
  })
  .catch((error) => {
    setAnalysisMessage(error.message);
  });
