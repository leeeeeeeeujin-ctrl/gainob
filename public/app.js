const state = {
  snapshot: null,
  intelligence: null,
  modules: [],
  activeViewId: "overviewView",
  account: null,
  coins: [],
  timeframes: [],
  marketSearchTerm: "",
  resizeObserver: null,
  aiAnnotations: [],
  chartGeometry: null,
  chartViewport: null
};

const elements = {
  coinSelect: document.querySelector("#coinSelect"),
  timeframeSelect: document.querySelector("#timeframeSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
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
  briefingView: "AI 브리핑",
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
    elements.styleInput.value = saved.style || "";
    elements.riskRuleInput.value = saved.riskRule || "";
    elements.watchItemsInput.value = saved.watchItems || "";
    elements.noteInput.value = saved.note || "";
    elements.focusQuestionInput.value = saved.focusQuestion || "";
    elements.overlayToggle.checked = saved.overlayEnabled ?? true;
    state.activeViewId = saved.activeViewId || state.activeViewId;
    state.marketSearchTerm = saved.marketSearchTerm || "";
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
      style: elements.styleInput.value,
      riskRule: elements.riskRuleInput.value,
      watchItems: elements.watchItemsInput.value,
      note: elements.noteInput.value,
      focusQuestion: elements.focusQuestionInput.value,
      activeViewId: state.activeViewId,
      selectedCoin: elements.coinSelect.value || "BTC",
      selectedTimeframe: elements.timeframeSelect.value || "1h",
      marketSearchTerm: state.marketSearchTerm,
      overlayEnabled: elements.overlayToggle.checked
    })
  );
}

function setAnalysisMessage(message) {
  elements.analysisOutput.textContent = message;
  elements.analysisOutputMirror.textContent = message;
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
  if (!elements.overlayToggle.checked) {
    return [];
  }

  return state.aiAnnotations.length ? state.aiAnnotations : state.snapshot?.annotations || [];
}

function renderAnnotationList() {
  const annotations = getActiveAnnotations();
  const sourceLabel = state.aiAnnotations.length ? "AI 주석" : "기본 주석";

  elements.annotationSummary.textContent = annotations.length
    ? `${sourceLabel} ${annotations.length}개를 차트 위에 표시 중입니다.`
    : "표시 가능한 주석이 없습니다.";

  elements.annotationList.innerHTML = annotations.length
    ? annotations
        .map(
          (annotation) => `
            <div class="annotation-row">
              <strong>${escapeHtml(annotation.label || annotation.type)}</strong>
              <span>${escapeHtml(annotation.reason || "근거 없음")}</span>
              <span>${escapeHtml(annotation.type)}</span>
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
    if (!state.snapshot || !state.chartViewport) {
      return;
    }

    state.chartViewport.isDragging = true;
    state.chartViewport.dragOriginX = event.clientX;
    state.chartViewport.dragStartIndex = state.chartViewport.startIndex;
    elements.chartHost.classList.add("is-dragging");
    elements.chartHost.setPointerCapture?.(event.pointerId);
  });

  elements.chartHost.addEventListener("pointermove", (event) => {
    if (!state.snapshot || !state.chartViewport?.isDragging || !state.chartGeometry?.candleGap) {
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
    if (!state.snapshot) {
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
  } catch (_error) {
    renderAccount(null);
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
  state.aiAnnotations = [];
  state.chartGeometry = null;
  savePersonalSettings();
  setAnalysisMessage("시세를 불러오는 중입니다...");

  try {
    const [snapshot, intelligence] = await Promise.all([
      fetchJson(`/api/market?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`),
      fetchJson(`/api/intelligence?symbol=${encodeURIComponent(symbol)}`)
    ]);
    renderSnapshot(snapshot);
    renderIntelligence(intelligence);
    renderModuleStatus(null);
    setAnalysisMessage("AI 분석을 요청하면 여기에 결과가 표시됩니다.");
  } catch (error) {
    setAnalysisMessage(error.message);
  }
}

async function analyze() {
  savePersonalSettings();
  setAnalysisMessage("AI에 데이터를 보내 분석 중입니다...");

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

    state.aiAnnotations = Array.isArray(payload.annotations) ? payload.annotations : [];
    renderAnnotationList();
    renderChartOverlay();
    renderModuleStatus(payload.context);
    setAnalysisMessage(payload.analysis);
    setActiveView("briefingView");
  } catch (error) {
    setAnalysisMessage(error.message);
  }
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

  elements.coinSelect.value = button.dataset.symbolRow;
  renderMarketSymbolList();
  refreshMarket();
});
elements.timeframeShortcutList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shortcut-timeframe]");

  if (!button) {
    return;
  }

  elements.timeframeSelect.value = button.dataset.shortcutTimeframe;
  renderTimeframeButtons();
  refreshMarket();
});
elements.overlayToggle.addEventListener("change", () => {
  savePersonalSettings();
  renderAnnotationList();
  renderChartOverlay();
});
elements.registerButton.addEventListener("click", registerAccount);
elements.loginButton.addEventListener("click", loginAccount);
elements.logoutButton.addEventListener("click", logoutAccount);
elements.deleteAccountButton.addEventListener("click", deleteAccount);
elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.viewTarget);
  });
});

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

Promise.all([loadCoins(), loadModules(), loadAccount()])
  .then(() => {
    setActiveView(state.activeViewId);
    return refreshMarket();
  })
  .catch((error) => {
    setAnalysisMessage(error.message);
  });
