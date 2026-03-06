const state = {
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
  manualAnnotations: [],
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
  chartViewport: null
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
  chartHost: document.querySelector(".chart-host"),
  chartCanvas: document.querySelector("#chartCanvas"),
  chartOverlay: document.querySelector("#chartOverlay"),
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
    state.activeViewId = saved.activeViewId || state.activeViewId;
    state.marketSearchTerm = saved.marketSearchTerm || "";
    state.floatingPanel.x = Number.isFinite(saved.floatingX) ? saved.floatingX : null;
    state.floatingPanel.y = Number.isFinite(saved.floatingY) ? saved.floatingY : null;
    state.floatingPanel.minimized = Boolean(saved.floatingMinimized);
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
  elements.chatContextMeta.textContent = `현재 대화 기준: ${symbol} · ${timeframe}${title}. 대화 중 AI는 이 종목 컨텍스트와 최근 대화를 함께 사용합니다.`;
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
    .map(
      (message) => `
        <article class="chat-message ${message.sender === "ai" ? "is-ai" : "is-user"}">
          <header>
            <strong>${message.sender === "ai" ? "AI" : "나"}</strong>
            <span>${message.created_at ? formatShortTime(message.created_at) : "방금"}</span>
          </header>
          <div class="chat-message-body">${escapeHtml(message.content || "")}</div>
        </article>
      `
    )
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
  updateChatContextMeta();
}

async function loadConversations() {
  if (!state.account?.authenticated) {
    state.currentConversationId = null;
    state.conversations = [];
    state.chatMessages = [];
    renderConversationList();
    renderChatMessages();
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
      renderConversationList();
      renderChatMessages();
      updateChatContextMeta();
    }
  } catch (_error) {
    state.currentConversationId = null;
    state.conversations = [];
    state.chatMessages = [];
    renderConversationList();
    renderChatMessages();
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
    state.chatMessages.push({ sender: "user", content, created_at: new Date().toISOString() });
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
      state.chatMessages.push({ sender: "ai", content: payload.ai.content, created_at: payload.ai.createdAt });
      renderChatMessages();
      setAnalysisMessage(payload.ai.content || "AI 응답이 생성되었습니다.");
      setFloatingBriefingMeta("AI 응답 완료");
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
  state.floatingHistoryOpen = false;
  renderConversationList();
  renderChatMessages();
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
    renderConversationList();
    renderChatMessages();
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
  const automated = elements.overlayToggle.checked ? state.aiAnnotations.length ? state.aiAnnotations : state.snapshot?.annotations || [] : [];
  return [...state.manualAnnotations, ...automated];
}

function renderAnnotationList() {
  const annotations = getActiveAnnotations();
  const manualCount = state.manualAnnotations.length;
  const automatedCount = Math.max(annotations.length - manualCount, 0);

  elements.annotationSummary.textContent = annotations.length
    ? `수동 ${manualCount}개 / 자동 ${automatedCount}개를 차트 위에 표시 중입니다.`
    : "표시 가능한 주석이 없습니다.";

  elements.annotationList.innerHTML = annotations.length
    ? annotations
        .map(
          (annotation) => `
            <div class="annotation-row">
              <strong>${escapeHtml(annotation.label || annotation.type)}</strong>
              <span>${escapeHtml(annotation.reason || "근거 없음")}</span>
              <span>${escapeHtml(annotation.type)}${annotation.source ? ` · ${annotation.source}` : ""}</span>
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

function ensureChartInteractions() {
  if (state.resizeObserver || !elements.chartHost) {
    return;
  }

  const releaseDrag = () => {
    if (!state.chartViewport) {
      return;
    }

    state.chartViewport.isDragging = false;
    elements.chartHost.classList.remove("is-dragging");
    setChartHint("드래그로 이동, 휠로 확대/축소, 더블클릭으로 초기화");
  };

  elements.chartHost.addEventListener("pointerdown", (event) => {
    if (!state.snapshot || !state.chartViewport || state.drawingTool !== "move") {
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
    });
    state.resizeObserver.observe(elements.chartHost);
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
    price: Number(price.toFixed(2))
  };
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
  if (state.drawingTool === "move" || !state.snapshot || !state.chartGeometry) {
    return;
  }

  const point = readChartPoint(event.clientX, event.clientY);

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
    setChartHint(state.drawingTool === "line" ? "끝점을 한 번 더 클릭하세요." : "구간의 반대쪽을 클릭하세요.");
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
  }
}

function clearManualAnnotations() {
  state.manualAnnotations = [];
  state.pendingDrawing = null;
  renderAnnotationList();
  renderChartOverlay();
  setChartHint("수동 드로잉을 모두 비웠습니다.");
}

function renderChartOverlay() {
  const annotations = getActiveAnnotations();

  if (!state.snapshot || state.activeViewId !== "marketView" || !state.chartGeometry || !annotations.length) {
    elements.chartOverlay.innerHTML = "";
    return;
  }

  const width = elements.chartHost.clientWidth;
  const height = elements.chartHost.clientHeight;
  const { candles, left, plotWidth, priceTop, priceHeight, minPrice, maxPrice } = state.chartGeometry;

  elements.chartOverlay.setAttribute("viewBox", `0 0 ${width} ${height}`);

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

  elements.chartOverlay.innerHTML = annotations
    .map((annotation) => {
      if (annotation.type === "line" && annotation.from && annotation.to) {
        const x1 = timeToX(annotation.from.time);
        const x2 = timeToX(annotation.to.time);
        const y1 = priceToY(annotation.from.price);
        const y2 = priceToY(annotation.to.price);

        if ([x1, x2, y1, y2].some((value) => value === null || value === undefined)) {
          return "";
        }

        return `
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeHtml(annotation.color || "#0ea5a0")}" stroke-width="2.2" />
          <text x="${clamp(x2 + 6, 12, width - 120)}" y="${Math.max(y2 - 6, 12)}" fill="#d7e2eb" font-size="11">${escapeHtml(annotation.label || "line")}</text>
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
          <rect x="${x}" y="${y}" width="${Math.max(rectWidth, 6)}" height="${Math.max(rectHeight, 6)}" fill="${escapeHtml(annotation.color || "rgba(14,165,160,0.14)")}" stroke="${escapeHtml(annotation.lineColor || annotation.color || "#0ea5a0")}" stroke-width="1.5" rx="6" ry="6" />
          <text x="${clamp(x + 6, 12, width - 120)}" y="${Math.max(y + 14, 12)}" fill="#d7e2eb" font-size="11">${escapeHtml(annotation.label || "zone")}</text>
        `;
      }

      if (annotation.type === "marker") {
        const x = timeToX(annotation.time);
        const y = priceToY(annotation.price);

        if ([x, y].some((value) => value === null || value === undefined)) {
          return "";
        }

        return `
          <circle cx="${x}" cy="${y}" r="5" fill="${escapeHtml(annotation.color || "#0ea5a0")}" />
          <text x="${clamp(x + 8, 12, width - 120)}" y="${Math.max(y - 8, 12)}" fill="#d7e2eb" font-size="11">${escapeHtml(annotation.label || "marker")}</text>
        `;
      }

      return "";
    })
    .join("");
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
    elements.chartOverlay.innerHTML = "";
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
}

function renderMarketWorkspace(snapshot) {
  const timeframeLabel =
    state.timeframes.find((timeframe) => timeframe.id === snapshot.timeframe)?.label || snapshot.timeframe;

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
  renderAnnotationList();
  renderTimeframeButtons();
  renderMarketSymbolList();
  renderChart(snapshot);
}

function renderSnapshot(snapshot) {
  state.snapshot = snapshot;
  resetChartViewport(snapshot);
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
  updateChatContextMeta();
  state.aiAnnotations = [];
  state.chartGeometry = null;
  savePersonalSettings();
  setAnalysisMessage("시세를 먼저 불러오는 중입니다...");
  setFloatingBriefingMeta("시장 데이터 로딩 중");

  try {
    const snapshot = await fetchJson(
      `/api/market?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
    );

    if (requestId !== state.latestMarketRequestId) {
      return;
    }

    renderSnapshot(snapshot);
    renderModuleStatus(null);
    elements.macroStatsOutput.innerHTML = renderStatRows([["불러오는 중", "시장 통계 대기"]]);
    elements.newsStatsOutput.innerHTML = renderStatRows([["불러오는 중", "뉴스 통계 대기"]]);
    setAnalysisMessage("차트는 준비되었습니다. 뉴스와 매크로 통계를 이어서 불러오는 중입니다.");
    setFloatingBriefingMeta(`${snapshot.symbol} · ${snapshot.timeframe} 준비됨`);

    fetchJson(`/api/intelligence?symbol=${encodeURIComponent(symbol)}`)
      .then((intelligence) => {
        if (requestId !== state.latestMarketRequestId) {
          return;
        }

        renderIntelligence(intelligence);
        setAnalysisMessage("AI 분석을 요청하면 여기에 결과가 표시됩니다.");
        setFloatingBriefingMeta(`${snapshot.symbol} · intelligence ready`);
      })
      .catch((error) => {
        if (requestId !== state.latestMarketRequestId) {
          return;
        }

        elements.macroStatsOutput.innerHTML = renderStatRows([["로드 실패", error.message]]);
        elements.newsStatsOutput.innerHTML = renderStatRows([["로드 실패", error.message]]);
        setFloatingBriefingMeta(`${snapshot.symbol} · 일부 통계 지연`);
      });
  } catch (error) {
    setAnalysisMessage(error.message);
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
elements.chartHost.addEventListener("click", handleDrawingClick);
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
  const button = event.target.closest("[data-drawing-tool]");

  if (!button) {
    return;
  }

  state.drawingTool = button.dataset.drawingTool;
  state.pendingDrawing = null;
  renderDrawingTools();
  setChartHint(
    state.drawingTool === "move"
      ? "드래그로 이동, 휠로 확대/축소, 더블클릭으로 초기화"
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
elements.overlayToggle.addEventListener("change", () => {
  savePersonalSettings();
  renderAnnotationList();
  renderChartOverlay();
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
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    sendChatMessage();
  }
});
elements.floatingChatPromptInput?.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
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
