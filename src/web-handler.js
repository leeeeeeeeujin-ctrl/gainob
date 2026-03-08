const express = require("express");
const fs = require("fs");
const path = require("path");
const { analyzeContext, requestAiText } = require("./ai");
const {
  buildExpiredSessionCookie,
  buildSessionCookie,
  createSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  hashToken,
  shouldUseSecureCookies,
  verifyPassword
} = require("./auth");
const { getDatabaseStatus, hasDatabaseConfig, query } = require("./db");
const { getIntelligenceSnapshot } = require("./intelligence");
const { createModuleContext } = require("./core/module-context");
const { getMarketSnapshot, getMultiTimeframeMarketPacket, getSupportedCoins, getSupportedTimeframes } = require("./market");
const modules = require("./modules");
const { getBinancePublicMetrics } = require("./onchain");

const moduleContext = createModuleContext(modules);
const app = express();

// Enable CORS for public API endpoints so external tools (browsers, parsers) can fetch them
app.use((req, res, next) => {
  try {
    if (String(req.path || "").startsWith("/api/public/")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
    }
  } catch (e) {
    // ignore
  }

  next();
});

// simple in-memory cache for intelligence (macro) to reduce latency on /api/public/market
const macroCache = new Map();
const MACRO_CACHE_TTL_MS = 15_000; // keep macro stats for 15s

async function fetchAndCacheIntelligence(symbol, label) {
  const key = String(symbol).toUpperCase();
  try {
    const payload = await getIntelligenceSnapshot(symbol, label);
    macroCache.set(key, {
      value: payload,
      expiresAt: Date.now() + MACRO_CACHE_TTL_MS
    });
    return payload;
  } catch (err) {
    // on error, clear or keep existing stale value
    const existing = macroCache.get(key);
    if (existing && existing.expiresAt > Date.now() - MACRO_CACHE_TTL_MS * 2) {
      return existing.value;
    }
    throw err;
  }
}

function getCachedIntelligence(symbol) {
  const key = String(symbol).toUpperCase();
  const entry = macroCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

async function getCoinLabel(symbol) {
  const coins = await getSupportedCoins();
  return coins.find((coin) => coin.symbol === symbol)?.label || symbol;
}

const SYMBOL_ALIASES = {
  비트코인: 'BTC',
  비트: 'BTC',
  이더리움: 'ETH',
  이더: 'ETH',
  리플: 'XRP',
  솔라나: 'SOL',
  솔: 'SOL',
  도지: 'DOGE',
  에이다: 'ADA'
};

async function inferSymbolFromText(text, fallbackSymbol = "") {
  const symbols = await inferSymbolsFromText(text, fallbackSymbol ? [fallbackSymbol] : []);
  return symbols[0] || fallbackSymbol;
}

async function inferSymbolsFromText(text, fallbackSymbols = []) {
  const raw = String(text || '');
  if (!raw) {
    return fallbackSymbols;
  }

  const rawUpper = raw.toUpperCase();
  const coins = await getSupportedCoins();
  const found = new Set();

  for (const coin of coins) {
    const symbol = String(coin.symbol || '').toUpperCase();
    if (symbol && rawUpper.includes(symbol)) {
      found.add(symbol);
    }
  }

  for (const [alias, symbol] of Object.entries(SYMBOL_ALIASES)) {
    if (raw.includes(alias)) {
      found.add(symbol);
    }
  }

  for (const symbol of fallbackSymbols) {
    if (symbol) {
      found.add(String(symbol).toUpperCase());
    }
  }

  return Array.from(found);
}

function isMacroPrompt(text) {
  const raw = String(text || '').toLowerCase();
  return [
    '도미넌스',
    'dominance',
    'btc dominance',
    'eth dominance',
    '시총',
    'market cap',
    '시장 전체',
    '알트장',
    '비트 도미',
    '거시'
  ].some((keyword) => raw.includes(keyword));
}

function normalizeConversationTimeframe(value, fallbackTimeframe = '1h') {
  const raw = String(value || '').toLowerCase();
  return ['15m', '1h', '4h', '1d', '1w'].includes(raw) ? raw : fallbackTimeframe;
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch (_error) {
    return null;
  }
}

async function normalizeRequestedSymbols(symbols, fallbackSymbols = []) {
  const coins = await getSupportedCoins();
  const supported = new Set(coins.map((coin) => String(coin.symbol || '').toUpperCase()));
  const merged = [...(Array.isArray(symbols) ? symbols : []), ...fallbackSymbols];
  const normalized = [];

  for (const symbol of merged) {
    const value = String(symbol || '').toUpperCase().trim();
    if (!value || !supported.has(value) || normalized.includes(value)) {
      continue;
    }
    normalized.push(value);
    if (normalized.length >= 4) {
      break;
    }
  }

  return normalized;
}

function buildConversationPlannerPrompt({
  content,
  chatHistory,
  conversationSymbol,
  timeframe,
  inferredSymbols,
  wantsMacro
}) {
  const recentHistory = (Array.isArray(chatHistory) ? chatHistory : [])
    .slice(-6)
    .map((item) => `- ${item.sender === 'ai' ? 'AI' : 'USER'}: ${item.content || ''}`)
    .join('\n');
  const supportedSymbols = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA'].join(', ');

  return `
너는 암호화폐 채팅용 데이터 요청 플래너다.
목표는 최종 답변을 쓰는 것이 아니라, 답변 전에 서버가 어떤 데이터를 먼저 가져와야 하는지 결정하는 것이다.
반드시 JSON 객체만 반환하고 설명, 코드블록, 마크다운은 쓰지 마라.

반환 형식:
{"needMacro":true,"symbols":["BTC","ETH"],"timeframe":"4h","focus":"비교 포인트 한 줄"}

규칙:
- needMacro는 도미넌스, 시총, 시장 전체 흐름, 알트장, 거시 질문이면 true.
- symbols에는 실제로 조회가 필요한 종목만 넣어라. 최대 4개.
- 사용자가 여러 종목을 비교하면 모두 포함해라.
- 종목이 명시되지 않았지만 대화 문맥상 현재 종목이 유력하면 conversationSymbol을 써도 된다.
- timeframe은 15m, 1h, 4h, 1d, 1w 중 하나만 써라.
- 지원 종목 예시: ${supportedSymbols}
- 종목이 전혀 필요 없는 완전한 매크로 질문이면 symbols는 빈 배열로 둘 수 있다.

[현재 대화 기본값]
- conversationSymbol: ${conversationSymbol || '없음'}
- timeframe: ${timeframe}
- inferredSymbols: ${(inferredSymbols || []).join(', ') || '없음'}
- heuristicMacro: ${wantsMacro ? 'true' : 'false'}

[최근 대화]
${recentHistory || '- 없음'}

[이번 사용자 메시지]
${content}
`.trim();
}

async function planConversationDataRequests({
  content,
  chatHistory,
  conversationSymbol,
  timeframe,
  inferredSymbols,
  wantsMacro,
  aiOptions
}) {
  const fallbackSymbols = await normalizeRequestedSymbols(inferredSymbols, conversationSymbol ? [conversationSymbol] : []);
  const fallbackPlan = {
    needMacro: wantsMacro,
    symbols: fallbackSymbols,
    timeframe: normalizeConversationTimeframe(timeframe, '1h'),
    focus: ''
  };

  const plannerPrompt = buildConversationPlannerPrompt({
    content,
    chatHistory,
    conversationSymbol,
    timeframe,
    inferredSymbols: fallbackSymbols,
    wantsMacro
  });
  const plannerResult = await requestAiText(plannerPrompt, aiOptions);

  if (!plannerResult.ok || !plannerResult.text) {
    return fallbackPlan;
  }

  const parsed = extractJsonObject(plannerResult.text);
  if (!parsed || typeof parsed !== 'object') {
    return fallbackPlan;
  }

  const requestedSymbols = await normalizeRequestedSymbols(parsed.symbols, fallbackSymbols);

  return {
    needMacro: Boolean(parsed.needMacro) || wantsMacro,
    symbols: requestedSymbols,
    timeframe: normalizeConversationTimeframe(parsed.timeframe, fallbackPlan.timeframe),
    focus: String(parsed.focus || '').trim()
  };
}

function buildMacroPromptSection(macroSnapshot) {
  return `
[시장 전체 매크로]
- BTC 도미넌스(%): ${macroSnapshot.macroStats.btcDominancePct}
- ETH 도미넌스(%): ${macroSnapshot.macroStats.ethDominancePct}
- 전체 시총(USD): ${macroSnapshot.macroStats.totalMarketCapUsd}
- 전체 거래대금(USD): ${macroSnapshot.macroStats.totalVolumeUsd}
- 시총 변화 24h(%): ${macroSnapshot.macroStats.marketCapChange24hUsd}
`.trim();
}

function buildComparisonPromptSection(comparisonSnapshots) {
  return `
[다중 종목 비교]
${comparisonSnapshots
  .map(
    (snapshot) =>
      `- ${snapshot.symbol}: 가격 ${snapshot.primary.priceUsdt} USDT | 24h ${snapshot.primary.change24hPct}% | 거래대금 ${snapshot.primary.quoteVolume24hUsdt} USDT | 스프레드 ${snapshot.orderbook.spreadUsdt}`
  )
  .join('\n')}
`.trim();
}

function inferTimeframeFromText(text, fallbackTimeframe = "1h") {
  const raw = String(text || "").toLowerCase();
  if (raw.includes("15m") || raw.includes("15분")) return "15m";
  if (raw.includes("4h") || raw.includes("4시간")) return "4h";
  if (raw.includes("1d") || raw.includes("일봉") || raw.includes("하루")) return "1d";
  if (raw.includes("1w") || raw.includes("주봉") || raw.includes("주간")) return "1w";
  if (raw.includes("1h") || raw.includes("1시간")) return "1h";
  return fallbackTimeframe;
}

function formatPublicBriefingText(briefing) {
  const lines = [
    `공개 브리핑`,
    `종목: ${briefing.symbol} (${briefing.label})`,
    `타임프레임: ${briefing.timeframe}`,
    `조회 시각: ${briefing.fetchedAt}`,
    ``,
    `[시장]`,
    `- 바이낸스 현재가: ${briefing.price} USDT`,
    `- 바이낸스 24h 등락: ${briefing.market.primary.change24hPct}%`,
    `- 바이낸스 거래대금: ${briefing.market.primary.quoteVolume24hUsdt} USDT`,
    `- 바이낸스 호가: ${briefing.market.primary.bidUsdt} / ${briefing.market.primary.askUsdt}`,
    `- 빗썸 비교가: ${briefing.market.local.available ? `${briefing.bithumb_price} KRW` : "미지원"}`,
    `- 가격 괴리: ${briefing.premium ?? "미지원"}%`,
    ``,
    `[호가/매물벽]`,
    `- 스프레드: ${briefing.spread_usdt} USDT`,
    `- 호가 불균형: ${briefing.depth_imbalance_pct}%`,
    `- 매물 압력: ${briefing.wall_pressure}`,
    `- 주요 매수벽: ${
      briefing.bid_wall_price ? `${briefing.bid_wall_price} USDT / ${briefing.bid_wall_value_usdt} USDT` : "없음"
    }`,
    `- 주요 매도벽: ${
      briefing.ask_wall_price ? `${briefing.ask_wall_price} USDT / ${briefing.ask_wall_value_usdt} USDT` : "없음"
    }`,
    ``,
    `[매크로]`,
    `- BTC 도미넌스: ${briefing.btc_dominance}%`,
    `- ETH 도미넌스: ${briefing.eth_dominance}%`,
    `- 글로벌 시총: ${briefing.total_marketcap_usd} USD`,
    `- 글로벌 시총 변동(24h): ${briefing.intelligence.macroStats.marketCapChange24hUsd}%`,
    ``,
    `[뉴스]`,
    `- 기사 수: ${briefing.intelligence.newsStats.articleCount}`,
    `- 24시간 기사 수: ${briefing.intelligence.newsStats.recent24hCount}`,
    `- 최신 기사: ${briefing.intelligence.newsStats.latestHeadline || "없음"}`,
    ``,
    `[차트 주석]`,
    ...briefing.market.annotations.slice(0, 6).map((annotation) => `- ${annotation.type} | ${annotation.label} | ${annotation.reason || "근거 없음"}`)
  ];

  if (briefing.intelligence.errors?.length) {
    lines.push("", "[오류]", ...briefing.intelligence.errors.map((error) => `- ${error}`));
  }

  return lines.join("\n");
}

function getRequestBaseUrl(request) {
  const forwardedProto = String(request.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || request.protocol || "https";
  return `${protocol}://${request.get("host")}`;
}

function buildPublicEndpointDocs(baseUrl = "") {
  return {
    name: "Gainob Public Data API",
    description: "ChatGPT 같은 외부 도구가 읽기 쉬운 공개 스냅샷 엔드포인트입니다. 개인 계정 데이터와 저장된 히스토리는 포함하지 않습니다.",
    endpoints: [
      {
        path: `${baseUrl}/api/public`,
        method: "GET",
        query: {},
        returns: "공개 API 설명서 JSON"
      },
      {
        path: `${baseUrl}/api/public/briefing?symbol=BTC&timeframe=1h`,
        method: "GET",
        query: {
          symbol: "조회할 심볼. 예: BTC, ETH, SOL",
          timeframe: "15m | 1h | 4h | 1d | 1w",
          format: "json 또는 text"
        },
        returns:
          "바이낸스 메인 시세, 빗썸 비교가, 호가/매물벽 요약, 매크로/뉴스 요약, 차트 주석이 포함된 공개 브리핑"
      },
      {
        path: `${baseUrl}/api/public/market?symbol=BTC&timeframe=1h`,
        method: "GET",
        query: {
          symbol: "조회할 심볼. 예: BTC, ETH, SOL",
          timeframe: "15m | 1h | 4h | 1d | 1w",
          concise: "true|false (기본 true; 긴 배열을 축소하여 반환)",
          start: "시작 시각(ISO 또는 epoch ms) - 이 시점 이후의 캔들/거래만 반환",
          end: "종료 시각(ISO 또는 epoch ms) - 이 시점 이전의 캔들/거래만 반환",
          orderbookDepth: "호가 배열 길이 제한 (기본 20)",
          candles: "반환할 캔들 개수 (기본 24)",
          trades: "반환할 최근 거래 개수 (기본 20)"
        },
        returns: "간결한 마켓 스냅샷 (가격, 요약 캔들, 호가 요약 등)"
      },
      {
        path: `${baseUrl}/api/public/liquidity?symbol=BTC`,
        method: "GET",
        query: { symbol: "조회할 심볼. 예: BTC" },
        returns: "호가/유동성 요약 (스프레드, 매물벽, 불균형 등)"
      },
      {
        path: `${baseUrl}/api/public/structure?symbol=BTC`,
        method: "GET",
        query: { symbol: "조회할 심볼. 예: BTC" },
        returns: "다중 타임프레임 요약 및 차트 주석(간결화)"
      },
      {
        path: `${baseUrl}/api/public/direction?timeframe=1h&limit=5&universe=10`,
        method: "GET",
        query: {
          timeframe: "기준 타임프레임. 예: 1h",
          limit: "표시할 상위 후보 수 (기본 5)",
          universe: "스캔할 코인 수 (기본 10)"
        },
        returns: "도미넌스, 시장 폭, 복수 신호 점수 기반 상위/하위 후보 스캐너"
      },
      {
        path: `${baseUrl}/api/public/sector-flow?timeframe=1h&universe=24`,
        method: "GET",
        query: {
          timeframe: "기준 타임프레임. 예: 1h",
          universe: "섹터 집계에 포함할 상위 거래대금 코인 수 (기본 24)"
        },
        returns: "L1, 밈, 결제, 거래소, DeFi, AI/Data 등 섹터 단위 유동성/방향성 집계"
      },
      {
        path: `${baseUrl}/api/public/opportunity?timeframe=1h&universe=24&limit=6`,
        method: "GET",
        query: {
          timeframe: "기준 타임프레임. 예: 1h",
          universe: "기회 후보 계산에 포함할 상위 거래대금 코인 수 (기본 24)",
          limit: "각 버킷에서 보여줄 후보 수 (기본 6)"
        },
        returns: "추세 추종 후보, 반등 감시 후보, 회피 후보를 섹터/호가/점수 변화 기준으로 묶은 기회 스캔"
      },
      {
        path: `${baseUrl}/api/public/direction/history?symbol=BTC&timeframe=1h&limit=24`,
        method: "GET",
        query: {
          symbol: "조회할 심볼. 예: BTC",
          timeframe: "기준 타임프레임. 예: 1h",
          limit: "가져올 이력 수 (기본 24)"
        },
        returns: "저장된 방향 점수 및 신뢰도 이력"
      },
      {
        path: `${baseUrl}/api/public/overlay?symbol=BTC&timeframe=1h&candles=96`,
        method: "GET",
        query: {
          symbol: "조회할 심볼. 예: BTC",
          timeframe: "15m | 1h | 4h | 1d | 1w",
          start: "구간 시작 시각(ISO 또는 epoch ms)",
          end: "구간 종료 시각(ISO 또는 epoch ms)",
          candles: "start/end가 없을 때 최근 몇 개 봉을 기준으로 계산할지",
          indicators: "표시할 지표 id 목록. 예: range,midpoint,vwap,breakout,pressure,volume"
        },
        returns: "AI 오버레이용 구간 지표, 신호, 바이어스, 계산에 사용된 범위 정보"
      }
    ]
  };
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parsePublicTimeValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && /^\d+$/.test(String(value))) {
    return numeric;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function formatSignedPct(value, digits = 2) {
  const numeric = Number(value || 0);
  const fixed = numeric.toFixed(digits);
  return `${numeric > 0 ? "+" : ""}${fixed}%`;
}

function formatFixedNumber(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

const PUBLIC_OVERLAY_INDICATOR_DEFAULTS = {
  range: true,
  midpoint: true,
  vwap: true,
  trend: false,
  breakout: true,
  pressure: true,
  volume: true
};

function getDefaultOverlayVisibleCount(timeframe, totalCandles) {
  const defaults = {
    "15m": 72,
    "1h": 96,
    "4h": 84,
    "1d": 120,
    "1w": 80
  };

  return clampNumber(defaults[timeframe] || 72, 20, Math.max(totalCandles, 20));
}

function parseOverlayIndicatorSelection(value) {
  if (!value) {
    return { ...PUBLIC_OVERLAY_INDICATOR_DEFAULTS };
  }

  const selected = new Set(
    String(value)
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  return Object.fromEntries(
    Object.keys(PUBLIC_OVERLAY_INDICATOR_DEFAULTS).map((key) => [key, selected.has(key)])
  );
}

function getOverlayRegionCandles(snapshot, focusRegion) {
  if (!snapshot?.candles?.length || !focusRegion) {
    return [];
  }

  return snapshot.candles.filter(
    (candle) => Number(candle.timestamp) >= Number(focusRegion.startTime) && Number(candle.timestamp) <= Number(focusRegion.endTime)
  );
}

function buildPublicOverlayIndicatorSegments(regionCandles) {
  if (!Array.isArray(regionCandles) || !regionCandles.length) {
    return [];
  }

  const segmentCount = regionCandles.length >= 96 ? 5 : regionCandles.length >= 72 ? 4 : regionCandles.length >= 48 ? 3 : regionCandles.length >= 24 ? 2 : 1;
  const segments = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const startIndex = Math.floor((index * regionCandles.length) / segmentCount);
    const endIndex = Math.floor(((index + 1) * regionCandles.length) / segmentCount);
    const candles = regionCandles.slice(startIndex, Math.max(endIndex, startIndex + 1));

    if (!candles.length) {
      continue;
    }

    segments.push({
      index: segments.length + 1,
      candles,
      isSegmented: segmentCount > 1,
      isLast: index === segmentCount - 1
    });
  }

  return segments;
}

function buildPublicOverlayRegion(snapshot, options = {}) {
  const candles = Array.isArray(snapshot?.candles) ? snapshot.candles : [];
  if (!candles.length) {
    throw new Error("Overlay region requires candle data.");
  }

  const startTime = parsePublicTimeValue(options.start);
  const endTime = parsePublicTimeValue(options.end);
  let regionCandles = candles.slice();
  let mode = "visible-default";

  if (startTime !== null || endTime !== null) {
    if (startTime !== null) {
      regionCandles = regionCandles.filter((candle) => Number(candle.timestamp) >= startTime);
    }
    if (endTime !== null) {
      regionCandles = regionCandles.filter((candle) => Number(candle.timestamp) <= endTime);
    }
    mode = "custom-range";
  } else {
    const visibleCount = clampNumber(Number(options.candles || getDefaultOverlayVisibleCount(snapshot.timeframe, candles.length)), 20, candles.length);
    regionCandles = candles.slice(-visibleCount);
  }

  if (!regionCandles.length) {
    throw new Error("No candles matched the requested overlay range.");
  }

  return {
    id: `public-overlay-${snapshot.symbol}-${snapshot.timeframe}`,
    type: "zone",
    role: "focus-region",
    source: "focus",
    label: mode === "custom-range" ? "요청 구간" : "현재 화면 기준 구간",
    reason: mode === "custom-range" ? "공개 API에서 지정한 범위" : "공개 API 기본 visible 범위",
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    startTime: Number(regionCandles[0].timestamp),
    endTime: Number(regionCandles[regionCandles.length - 1].timestamp),
    minPrice: Math.min(...regionCandles.map((candle) => Number(candle.low || 0))),
    maxPrice: Math.max(...regionCandles.map((candle) => Number(candle.high || 0))),
    candleCount: regionCandles.length,
    mode
  };
}

function buildPublicOverlaySignals(snapshot, focusRegion) {
  const regionCandles = getOverlayRegionCandles(snapshot, focusRegion);

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
  const bodySizeSum = regionCandles.reduce((sum, candle) => sum + Math.abs(Number(candle.close || 0) - Number(candle.open || 0)), 0);
  const wickSizeSum = upperWickTotal + lowerWickTotal;
  const absorptionTone = wickSizeSum > bodySizeSum * 1.15
    ? lowerWickTotal > upperWickTotal
      ? "bullish"
      : "bearish"
    : "neutral";

  return [
    { label: "구간 방향", value: formatSignedPct(netChangePct), tone: bodyControlTone, reason: "시작 시가 대비 종료 종가 변화", raw: formatFixedNumber(netChangePct, 2) },
    { label: "종가 위치", value: `${formatFixedNumber(closeLocation, 1)} / 100`, tone: closeLocation >= 70 ? "bullish" : closeLocation <= 30 ? "bearish" : "neutral", reason: "고저 범위 안에서 마지막 종가 위치", raw: formatFixedNumber(closeLocation, 1) },
    { label: "캔들 주도권", value: `${formatFixedNumber(controlPct, 0)}% 양봉`, tone: controlPct >= 58 ? "bullish" : controlPct <= 42 ? "bearish" : "neutral", reason: "구간 내 양봉 비중", raw: formatFixedNumber(controlPct, 1) },
    { label: "꼬리 압력", value: lowerWickTotal > upperWickTotal ? "아래꼬리 우세" : upperWickTotal > lowerWickTotal ? "위꼬리 우세" : "균형", tone: wickTone, reason: "매수/매도 거절 흔적 추정", raw: { upperWickTotal: formatFixedNumber(upperWickTotal, 4), lowerWickTotal: formatFixedNumber(lowerWickTotal, 4) } },
    { label: "거래량 참여", value: `${formatFixedNumber(lastVolumeRatio, 2)}x`, tone: volumeTone, reason: "마지막 봉 거래량 / 구간 평균", raw: formatFixedNumber(lastVolumeRatio, 3) },
    { label: "돌파 상태", value: breakoutTone === "bullish" ? "직전 구간 상단 돌파" : breakoutTone === "bearish" ? "직전 구간 하단 이탈" : "아직 범위 내부", tone: breakoutTone, reason: "마지막 종가 기준" },
    { label: "리클레임/실패", value: reclaimTone === "bullish" ? "중앙값 리클레임" : reclaimTone === "bearish" ? "중앙값 재이탈" : "중립", tone: reclaimTone, reason: `선택 구간 중간값 ${formatFixedNumber(midpoint, 2)} 기준 종가 복귀 여부`, raw: formatFixedNumber(midpoint, 2) },
    { label: "흡수/분배", value: absorptionTone === "bullish" ? "저가 흡수" : absorptionTone === "bearish" ? "고가 분배" : "방향성 약함", tone: absorptionTone, reason: "꼬리 총합 대비 몸통 총합으로 체결 흡수 성격 추정" }
  ];
}

function buildPublicOverlayBias(signals) {
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
    if (signal.tone === "bullish") return sum + weight;
    if (signal.tone === "bearish") return sum - weight;
    return sum;
  }, 0);

  const tone = score >= 2.5 ? "bullish" : score <= -2.5 ? "bearish" : "neutral";
  const label = tone === "bullish" ? "현재 바이어스: 상승 우위" : tone === "bearish" ? "현재 바이어스: 하락 우위" : "현재 바이어스: 중립";
  const bullishCount = signals.filter((signal) => signal.tone === "bullish").length;
  const bearishCount = signals.filter((signal) => signal.tone === "bearish").length;
  const dominantSignals = signals.filter((signal) => signal.tone === tone && tone !== "neutral").sort((left, right) => (signalWeights[right.label] || 1) - (signalWeights[left.label] || 1));
  const strongest = dominantSignals[0] || signals.find((signal) => signal.tone !== "neutral");

  return {
    tone,
    label,
    score: formatFixedNumber(score, 1),
    summary: `점수 ${formatFixedNumber(score, 1)} · 강세 ${bullishCount} / 약세 ${bearishCount}`,
    reason: strongest ? `${strongest.label}: ${strongest.reason}` : "유의미한 방향 신호가 부족합니다."
  };
}

function buildPublicOverlayIndicatorAnnotations(snapshot, focusRegion, enabledIndicators = PUBLIC_OVERLAY_INDICATOR_DEFAULTS) {
  const regionCandles = getOverlayRegionCandles(snapshot, focusRegion);

  if (!regionCandles.length || !focusRegion) {
    return [];
  }

  const segments = buildPublicOverlayIndicatorSegments(regionCandles);
  const annotations = [];

  segments.forEach((segment) => {
    const segmentCandles = segment.candles;
    const firstCandle = segmentCandles[0];
    const lastCandle = segmentCandles[segmentCandles.length - 1];
    const highest = Math.max(...segmentCandles.map((candle) => Number(candle.high || 0)));
    const lowest = Math.min(...segmentCandles.map((candle) => Number(candle.low || 0)));
    const midpoint = (highest + lowest) / 2;
    const vwapNumerator = segmentCandles.reduce((sum, candle) => sum + ((Number(candle.high || 0) + Number(candle.low || 0) + Number(candle.close || 0)) / 3) * Number(candle.volume || 0), 0);
    const totalVolume = segmentCandles.reduce((sum, candle) => sum + Number(candle.volume || 0), 0);
    const vwap = totalVolume ? vwapNumerator / totalVolume : midpoint;
    const priorCandles = segmentCandles.slice(0, -1);
    const priorHigh = priorCandles.length ? Math.max(...priorCandles.map((candle) => Number(candle.high || 0))) : highest;
    const priorLow = priorCandles.length ? Math.min(...priorCandles.map((candle) => Number(candle.low || 0))) : lowest;
    const averageVolume = totalVolume / Math.max(segmentCandles.length, 1);
    const upperWick = Math.max(Number(lastCandle.high || 0) - Math.max(Number(lastCandle.open || 0), Number(lastCandle.close || 0)), 0);
    const lowerWick = Math.max(Math.min(Number(lastCandle.open || 0), Number(lastCandle.close || 0)) - Number(lastCandle.low || 0), 0);
    const suffix = segment.isSegmented ? ` ${segment.index}` : "";

    if (enabledIndicators.range) {
      annotations.push(
        { id: `indicator-range-high-${focusRegion.id}-${segment.index}`, type: "line", source: "indicator", label: `고점${suffix}`, reason: `세그먼트 ${segment.index} 최고가 ${formatFixedNumber(highest, 2)}`, color: "#f87171", from: { time: firstCandle.timestamp, price: highest }, to: { time: lastCandle.timestamp, price: highest } },
        { id: `indicator-range-low-${focusRegion.id}-${segment.index}`, type: "line", source: "indicator", label: `저점${suffix}`, reason: `세그먼트 ${segment.index} 최저가 ${formatFixedNumber(lowest, 2)}`, color: "#34d399", from: { time: firstCandle.timestamp, price: lowest }, to: { time: lastCandle.timestamp, price: lowest } }
      );
    }

    if (enabledIndicators.midpoint) {
      annotations.push({ id: `indicator-midpoint-${focusRegion.id}-${segment.index}`, type: "line", source: "indicator", label: `중앙${suffix}`, reason: `세그먼트 ${segment.index} 중앙값 ${formatFixedNumber(midpoint, 2)}`, color: "#fbbf24", from: { time: firstCandle.timestamp, price: midpoint }, to: { time: lastCandle.timestamp, price: midpoint } });
    }

    if (enabledIndicators.vwap) {
      annotations.push({ id: `indicator-vwap-${focusRegion.id}-${segment.index}`, type: "line", source: "indicator", label: `VWAP${suffix}`, reason: `세그먼트 ${segment.index} 거래량 가중 평균가 ${formatFixedNumber(vwap, 2)}`, color: "#60a5fa", from: { time: firstCandle.timestamp, price: vwap }, to: { time: lastCandle.timestamp, price: vwap } });
    }

    if (enabledIndicators.trend) {
      annotations.push({ id: `indicator-trend-${focusRegion.id}-${segment.index}`, type: "line", source: "indicator", label: `추세${suffix}`, reason: `세그먼트 ${segment.index} 종가 ${formatFixedNumber(firstCandle.close, 2)} -> ${formatFixedNumber(lastCandle.close, 2)}`, color: "#c084fc", from: { time: firstCandle.timestamp, price: Number(firstCandle.close || 0) }, to: { time: lastCandle.timestamp, price: Number(lastCandle.close || 0) } });
    }

    if (enabledIndicators.breakout) {
      if (Number(lastCandle.close || 0) > priorHigh) {
        annotations.push({ id: `indicator-breakout-up-${focusRegion.id}-${segment.index}`, type: "marker", source: "indicator", label: `상단 돌파${suffix}`, reason: `세그먼트 ${segment.index} 종가가 직전 고점 ${formatFixedNumber(priorHigh, 2)} 위`, color: "#22c55e", time: lastCandle.timestamp, price: Number(lastCandle.close || 0) });
      } else if (Number(lastCandle.close || 0) < priorLow) {
        annotations.push({ id: `indicator-breakout-down-${focusRegion.id}-${segment.index}`, type: "marker", source: "indicator", label: `하단 이탈${suffix}`, reason: `세그먼트 ${segment.index} 종가가 직전 저점 ${formatFixedNumber(priorLow, 2)} 아래`, color: "#ef4444", time: lastCandle.timestamp, price: Number(lastCandle.close || 0) });
      }
    }

    if (enabledIndicators.pressure) {
      annotations.push({ id: `indicator-pressure-${focusRegion.id}-${segment.index}`, type: "marker", source: "indicator", label: lowerWick > upperWick ? `매수 방어${suffix}` : upperWick > lowerWick ? `매도 압력${suffix}` : `꼬리 균형${suffix}`, reason: lowerWick > upperWick ? `세그먼트 ${segment.index} 아래꼬리 우세` : upperWick > lowerWick ? `세그먼트 ${segment.index} 위꼬리 우세` : `세그먼트 ${segment.index} 꼬리 균형`, color: lowerWick > upperWick ? "#34d399" : upperWick > lowerWick ? "#f87171" : "#94a3b8", time: lastCandle.timestamp, price: lowerWick > upperWick ? Number(lastCandle.low || 0) : Number(lastCandle.high || 0) });
    }

    if (enabledIndicators.volume && Number(lastCandle.volume || 0) >= averageVolume * 1.6) {
      annotations.push({ id: `indicator-volume-${focusRegion.id}-${segment.index}`, type: "marker", source: "indicator", label: `거래량 스파이크${suffix}`, reason: `세그먼트 ${segment.index} 평균 대비 ${formatFixedNumber(Number(lastCandle.volume || 0) / Math.max(averageVolume, 0.0001), 2)}배`, color: "#38bdf8", time: lastCandle.timestamp, price: Number(lastCandle.close || 0) });
    }
  });

  return annotations;
}

function scoreFromChange(changePct, divisor, min, max) {
  return clampNumber(Number(changePct || 0) / divisor, min, max);
}

function classifyDirectionBias(score) {
  if (score >= 4.2) {
    return { tone: "strong-up", label: "강한 상승 우위" };
  }
  if (score >= 2.1) {
    return { tone: "up", label: "상승 우위" };
  }
  if (score <= -4.2) {
    return { tone: "strong-down", label: "강한 하락 우위" };
  }
  if (score <= -2.1) {
    return { tone: "down", label: "하락 우위" };
  }
  return { tone: "neutral", label: "중립" };
}

function classifyTrustLevel(score) {
  if (score >= 75) {
    return { tone: "high", label: "상" };
  }
  if (score >= 55) {
    return { tone: "medium", label: "중" };
  }
  return { tone: "low", label: "하" };
}

function isStablecoinLikeCoin(coin) {
  const symbol = String(coin?.symbol || "").toUpperCase();
  const price = Number(coin?.lastPriceUsdt || 0);
  const change24hPct = Math.abs(Number(coin?.change24hPct || 0));
  const explicitStableSymbols = new Set(["USDT", "USDC", "FDUSD", "TUSD", "BUSD", "USDP", "DAI", "USD1", "USDE", "PYUSD"]);

  if (explicitStableSymbols.has(symbol)) {
    return true;
  }

  return /USD|EUR|TRY/.test(symbol) && price >= 0.85 && price <= 1.15 && change24hPct <= 1.5;
}

function isMissingRelationError(error) {
  return error?.code === "42P01" || String(error?.message || "").includes("market_direction_history");
}

function buildTrustProfile(packet, medianQuoteVolume, medianDepthValue) {
  const quoteVolume = Number(packet.primary?.quoteVolume24hUsdt || 0);
  const depthValue = Number(packet.orderbook?.totalBidValueUsdt || 0) + Number(packet.orderbook?.totalAskValueUsdt || 0);
  const openInterest = Number(packet.openInterest || 0);
  const coverageCount = (packet.multiTimeframes || []).filter((item) => Number.isFinite(Number(item?.changePct))).length;
  const localSupported = Boolean(packet.local?.available || packet.comparison?.premiumPct !== null);
  const volumeScore = medianQuoteVolume > 0
    ? clampNumber(Math.log10((quoteVolume + 1) / (medianQuoteVolume + 1)) * 18 + 18, 2, 34)
    : clampNumber(Math.log10(quoteVolume + 1) * 4, 2, 24);
  const depthScore = medianDepthValue > 0
    ? clampNumber(Math.log10((depthValue + 1) / (medianDepthValue + 1)) * 16 + 16, 2, 28)
    : clampNumber(Math.log10(depthValue + 1) * 3.5, 2, 20);
  const openInterestScore = openInterest > 0 ? clampNumber(Math.log10(openInterest + 1) * 2.6, 2, 12) : 0;
  const coverageScore = clampNumber(coverageCount * 4, 4, 16);
  const localSupportScore = localSupported ? 8 : 0;
  const lowVolumePenalty = medianQuoteVolume > 0 && quoteVolume < medianQuoteVolume * 0.18 ? 10 : 0;
  const lowDepthPenalty = medianDepthValue > 0 && depthValue < medianDepthValue * 0.18 ? 10 : 0;
  const trustScore = clampNumber(
    24 + volumeScore + depthScore + openInterestScore + coverageScore + localSupportScore - lowVolumePenalty - lowDepthPenalty,
    8,
    98
  );
  const trust = classifyTrustLevel(trustScore);
  const trustReasons = [];

  if (quoteVolume >= medianQuoteVolume * 1.2) {
    trustReasons.push("24h 거래대금 상위권");
  } else if (lowVolumePenalty) {
    trustReasons.push("거래대금 낮음");
  }

  if (depthValue >= medianDepthValue * 1.1) {
    trustReasons.push("호가 두께 양호");
  } else if (lowDepthPenalty) {
    trustReasons.push("호가 두께 얕음");
  }

  if (openInterest > 0) {
    trustReasons.push("파생 데이터 존재");
  }

  if (localSupported) {
    trustReasons.push("국내 비교 가능");
  }

  if (!trustReasons.length) {
    trustReasons.push("기본 데이터 커버리지 기준");
  }

  return {
    trustScore: Number(trustScore.toFixed(0)),
    trustTone: trust.tone,
    trustLabel: trust.label,
    trustReasons: trustReasons.slice(0, 4)
  };
}

function buildDirectionCandidate(packet, medianQuoteVolume, medianDepthValue) {
  const timeframeMap = new Map((packet.multiTimeframes || []).map((item) => [item.timeframe, item]));
  const tf15m = timeframeMap.get("15m");
  const tf1h = timeframeMap.get("1h");
  const tf4h = timeframeMap.get("4h");
  const tf1d = timeframeMap.get("1d");
  const requested = timeframeMap.get(packet.requestedTimeframe) || tf1h || tf4h || tf15m || tf1d || null;

  const change15mScore = scoreFromChange(tf15m?.changePct, 1.1, -1.2, 1.2);
  const change1hScore = scoreFromChange(tf1h?.changePct, 1.6, -1.5, 1.5);
  const change4hScore = scoreFromChange(tf4h?.changePct, 2.8, -1.8, 1.8);
  const change1dScore = scoreFromChange(tf1d?.changePct, 4.2, -2.1, 2.1);
  const orderbookScore = clampNumber(Number(packet.orderbook?.imbalancePct || 0) / 25, -1.2, 1.2);
  const premiumScore = clampNumber(Number(packet.comparison?.premiumPct || 0) / 1.2, -0.5, 0.5);
  const fundingScore = packet.fundingRate === null || packet.fundingRate === undefined
    ? 0
    : clampNumber(Number(packet.fundingRate || 0) * 20000, -0.45, 0.45);
  const volumeScore = medianQuoteVolume > 0
    ? clampNumber(Math.log10((Number(packet.primary?.quoteVolume24hUsdt || 0) + 1) / (medianQuoteVolume + 1)) * 1.1, -0.65, 0.65)
    : 0;

  const totalScore =
    change15mScore * 0.8 +
    change1hScore * 1.2 +
    change4hScore * 1.7 +
    change1dScore * 2.2 +
    orderbookScore * 1.15 +
    premiumScore * 0.4 +
    fundingScore * 0.4 +
    volumeScore * 0.6;

  const bias = classifyDirectionBias(totalScore);
  const trustProfile = buildTrustProfile(packet, medianQuoteVolume, medianDepthValue);
  const reasons = [];

  if ((tf4h?.changePct || 0) > 1.5) {
    reasons.push(`4h 강세 ${Number(tf4h.changePct).toFixed(2)}%`);
  } else if ((tf4h?.changePct || 0) < -1.5) {
    reasons.push(`4h 약세 ${Number(tf4h.changePct).toFixed(2)}%`);
  }

  if ((tf1d?.changePct || 0) > 2.5) {
    reasons.push(`일봉 우호 ${Number(tf1d.changePct).toFixed(2)}%`);
  } else if ((tf1d?.changePct || 0) < -2.5) {
    reasons.push(`일봉 약세 ${Number(tf1d.changePct).toFixed(2)}%`);
  }

  if ((packet.orderbook?.imbalancePct || 0) >= 18) {
    reasons.push(`호가 우위 ${Number(packet.orderbook.imbalancePct).toFixed(1)}%`);
  } else if ((packet.orderbook?.imbalancePct || 0) <= -18) {
    reasons.push(`매도 압력 ${Number(packet.orderbook.imbalancePct).toFixed(1)}%`);
  }

  if ((packet.primary?.quoteVolume24hUsdt || 0) > medianQuoteVolume * 1.35) {
    reasons.push("거래대금 상위권");
  }

  if (packet.fundingRate !== null && packet.fundingRate !== undefined) {
    reasons.push(`펀딩 ${Number(packet.fundingRate).toFixed(5)}`);
  }

  if (!reasons.length) {
    reasons.push("복수 신호 혼조");
  }

  return {
    symbol: packet.symbol,
    label: packet.label,
    pair: packet.pair,
    timeframe: packet.requestedTimeframe,
    requestedTrend: requested?.trend || "flat",
    bias: bias.label,
    tone: bias.tone,
    score: Number(totalScore.toFixed(2)),
    priceUsdt: packet.primary?.priceUsdt || null,
    change24hPct: packet.primary?.change24hPct || null,
    premiumPct: packet.comparison?.premiumPct || null,
    orderbookImbalancePct: packet.orderbook?.imbalancePct || null,
    quoteVolume24hUsdt: packet.primary?.quoteVolume24hUsdt || null,
    fundingRate: packet.fundingRate ?? null,
    openInterest: packet.openInterest ?? null,
    trustScore: trustProfile.trustScore,
    trustTone: trustProfile.trustTone,
    trustLabel: trustProfile.trustLabel,
    trustReasons: trustProfile.trustReasons,
    timeframes: {
      "15m": tf15m?.changePct ?? null,
      "1h": tf1h?.changePct ?? null,
      "4h": tf4h?.changePct ?? null,
      "1d": tf1d?.changePct ?? null
    },
    reasons: reasons.slice(0, 4)
  };
}

const SECTOR_DEFINITIONS = [
  {
    id: "majors",
    label: "Majors",
    symbols: ["BTC", "ETH"]
  },
  {
    id: "layer1",
    label: "L1 / Infra",
    symbols: ["SOL", "ADA", "AVAX", "DOT", "ATOM", "NEAR", "APT", "SUI", "SEI", "TRX", "TON", "ALGO", "KAS", "HBAR"]
  },
  {
    id: "payments",
    label: "Payments",
    symbols: ["XRP", "XLM", "LTC", "BCH", "XMR", "DASH"]
  },
  {
    id: "meme",
    label: "Meme",
    symbols: ["DOGE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI", "BRETT", "TRUMP"]
  },
  {
    id: "exchange",
    label: "Exchange",
    symbols: ["BNB", "OKB", "CRO", "KCS", "BGB", "GT"]
  },
  {
    id: "defi",
    label: "DeFi / Yield",
    symbols: ["UNI", "AAVE", "MKR", "CRV", "COMP", "SNX", "SUSHI", "CAKE", "PENDLE", "ENA", "ONDO", "JUP"]
  },
  {
    id: "ai",
    label: "AI / Data",
    symbols: ["TAO", "RNDR", "RENDER", "FET", "AGIX", "WLD", "GRT", "ARKM"]
  },
  {
    id: "gaming",
    label: "Gaming / NFT",
    symbols: ["IMX", "GALA", "SAND", "MANA", "AXS", "RON", "BEAM"]
  }
];

const SYMBOL_TO_SECTOR = new Map(
  SECTOR_DEFINITIONS.flatMap((sector) => sector.symbols.map((symbol) => [symbol, sector]))
);

function getSectorDefinitionForSymbol(symbol) {
  const sector = SYMBOL_TO_SECTOR.get(String(symbol || "").toUpperCase());
  return sector || { id: "other", label: "Other", symbols: [] };
}

function buildSectorFlowPayload(candidates, timeframe, universe) {
  const grouped = new Map();

  for (const candidate of candidates) {
    const sector = getSectorDefinitionForSymbol(candidate.symbol);
    const key = sector.id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        sector: sector.id,
        label: sector.label,
        members: []
      });
    }
    grouped.get(key).members.push(candidate);
  }

  const sectors = Array.from(grouped.values())
    .map((entry) => {
      const members = entry.members.slice().sort((left, right) => right.quoteVolume24hUsdt - left.quoteVolume24hUsdt);
      const totalWeight = members.reduce((sum, member) => sum + Math.max(Math.log10(Number(member.quoteVolume24hUsdt || 0) + 1), 1), 0);
      const weightedScore = members.reduce(
        (sum, member) => sum + member.score * Math.max(Math.log10(Number(member.quoteVolume24hUsdt || 0) + 1), 1),
        0
      ) / Math.max(totalWeight, 1);
      const weightedImbalance = members.reduce(
        (sum, member) => sum + Number(member.orderbookImbalancePct || 0) * Math.max(Math.log10(Number(member.quoteVolume24hUsdt || 0) + 1), 1),
        0
      ) / Math.max(totalWeight, 1);
      const weightedChange = members.reduce(
        (sum, member) => sum + Number(member.change24hPct || 0) * Math.max(Math.log10(Number(member.quoteVolume24hUsdt || 0) + 1), 1),
        0
      ) / Math.max(totalWeight, 1);
      const averageTrustScore = members.reduce((sum, member) => sum + Number(member.trustScore || 0), 0) / Math.max(members.length, 1);
      const dominant = members.slice().sort((left, right) => right.score - left.score)[0] || null;
      const weakest = members.slice().sort((left, right) => left.score - right.score)[0] || null;
      const bias = classifyDirectionBias(weightedScore);
      const positiveCount = members.filter((member) => member.score >= 2.1).length;
      const negativeCount = members.filter((member) => member.score <= -2.1).length;
      const neutralCount = Math.max(members.length - positiveCount - negativeCount, 0);

      return {
        sector: entry.sector,
        label: entry.label,
        timeframe,
        memberCount: members.length,
        totalQuoteVolume24hUsdt: Number(members.reduce((sum, member) => sum + Number(member.quoteVolume24hUsdt || 0), 0).toFixed(2)),
        averageScore: Number(weightedScore.toFixed(2)),
        averageChange24hPct: Number(weightedChange.toFixed(2)),
        averageOrderbookImbalancePct: Number(weightedImbalance.toFixed(2)),
        averageTrustScore: Number(averageTrustScore.toFixed(0)),
        bias: bias.label,
        tone: bias.tone,
        breadth: {
          positiveCount,
          negativeCount,
          neutralCount
        },
        leader: dominant
          ? {
              symbol: dominant.symbol,
              score: dominant.score,
              bias: dominant.bias,
              change24hPct: dominant.change24hPct,
              orderbookImbalancePct: dominant.orderbookImbalancePct
            }
          : null,
        laggard: weakest
          ? {
              symbol: weakest.symbol,
              score: weakest.score,
              bias: weakest.bias,
              change24hPct: weakest.change24hPct,
              orderbookImbalancePct: weakest.orderbookImbalancePct
            }
          : null,
        members: members.slice(0, 6).map((member) => ({
          symbol: member.symbol,
          score: member.score,
          bias: member.bias,
          trustScore: member.trustScore,
          change24hPct: member.change24hPct,
          orderbookImbalancePct: member.orderbookImbalancePct,
          quoteVolume24hUsdt: member.quoteVolume24hUsdt
        }))
      };
    })
    .sort((left, right) => right.averageScore - left.averageScore);

  return {
    timeframe,
    universe,
    sectors,
    summary: {
      leaderSector: sectors[0] || null,
      weakestSector: sectors[sectors.length - 1] || null,
      riskTone:
        sectors.filter((sector) => sector.averageScore >= 2.1).length > sectors.filter((sector) => sector.averageScore <= -2.1).length
          ? "risk-on-lean"
          : sectors.filter((sector) => sector.averageScore <= -2.1).length > sectors.filter((sector) => sector.averageScore >= 2.1).length
            ? "risk-off-lean"
            : "mixed"
    }
  };
}

async function buildPublicSectorFlow(timeframe, options = {}) {
  const universe = Math.min(Math.max(Number(options.universe || 24), 8), 48);
  const coins = (await getSupportedCoins())
    .filter((coin) => !isStablecoinLikeCoin(coin))
    .slice(0, universe);
  const packets = await Promise.allSettled(
    coins.map((coin) => getMultiTimeframeMarketPacket(coin.symbol, { timeframe }))
  );

  const successfulPackets = packets
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  const quoteVolumes = successfulPackets
    .map((packet) => Number(packet.primary?.quoteVolume24hUsdt || 0))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const medianQuoteVolume = quoteVolumes.length ? quoteVolumes[Math.floor(quoteVolumes.length / 2)] : 0;
  const depthValues = successfulPackets
    .map((packet) => Number(packet.orderbook?.totalBidValueUsdt || 0) + Number(packet.orderbook?.totalAskValueUsdt || 0))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const medianDepthValue = depthValues.length ? depthValues[Math.floor(depthValues.length / 2)] : 0;

  const candidates = successfulPackets
    .map((packet) => buildDirectionCandidate(packet, medianQuoteVolume, medianDepthValue))
    .sort((left, right) => right.score - left.score);

  return buildSectorFlowPayload(candidates, timeframe, universe);
}

function buildOpportunityReasonList(candidate, sectorSummary, mode) {
  const reasons = [];
  if (sectorSummary?.label) {
    reasons.push(`섹터 ${sectorSummary.label} 평균 ${sectorSummary.averageScore}`);
  }
  if (Number.isFinite(Number(candidate.scoreDelta))) {
    reasons.push(`점수 변화 ${candidate.scoreDelta > 0 ? "+" : ""}${candidate.scoreDelta}`);
  }
  if (Number.isFinite(Number(candidate.orderbookImbalancePct))) {
    reasons.push(`호가 ${Number(candidate.orderbookImbalancePct).toFixed(1)}%`);
  }
  if (candidate.trustScore) {
    reasons.push(`신뢰도 ${candidate.trustScore}`);
  }
  if (mode === "rebound" && Number(candidate.change24hPct) < 0) {
    reasons.push(`24h 낙폭 ${Number(candidate.change24hPct).toFixed(2)}%`);
  }
  return reasons.slice(0, 4);
}

function buildOpportunityBuckets(candidates, sectorFlow) {
  const sectorBySymbol = new Map();
  for (const sector of sectorFlow?.sectors || []) {
    for (const member of sector.members || []) {
      sectorBySymbol.set(member.symbol, sector);
    }
  }

  const withSector = candidates.map((candidate) => ({
    ...candidate,
    sector: sectorBySymbol.get(candidate.symbol) || null
  }));

  const momentumCandidates = withSector
    .filter((candidate) => candidate.score >= -0.5 && candidate.trustScore >= 60)
    .map((candidate) => {
      const sectorScore = Number(candidate.sector?.averageScore || 0);
      const value =
        candidate.score * 1.4 +
        clampNumber(Number(candidate.orderbookImbalancePct || 0) / 15, -2, 2) +
        clampNumber(Number(candidate.scoreDelta || 0), -2.5, 2.5) * 0.9 +
        clampNumber(sectorScore / 2.5, -2, 2) +
        clampNumber((Number(candidate.trustScore || 0) - 50) / 18, -1, 2);
      return {
        symbol: candidate.symbol,
        sector: candidate.sector?.label || "Other",
        setup: value >= 4.5 ? "추세 추종 우선" : value >= 3 ? "강한 상대강도 감시" : "상대강도 초기 감시",
        score: Number(value.toFixed(2)),
        bias: candidate.bias,
        reasons: buildOpportunityReasonList(candidate, candidate.sector, "momentum")
      };
    })
    .filter((candidate) => candidate.score >= 2.6)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const reboundCandidates = withSector
    .filter((candidate) => candidate.score <= -1 && candidate.score >= -7.5 && candidate.trustScore >= 55)
    .map((candidate) => {
      const sectorScore = Number(candidate.sector?.averageScore || 0);
      const value =
        clampNumber(Math.abs(candidate.score + 2.5), 0, 4) +
        clampNumber(Number(candidate.orderbookImbalancePct || 0) / 12, -2, 3) +
        clampNumber(Number(candidate.scoreDelta || 0), -2, 3) * 1.1 +
        clampNumber((Number(candidate.trustScore || 0) - 50) / 16, -1, 2) +
        clampNumber((sectorScore + 4) / 3.5, -2, 2);
      return {
        symbol: candidate.symbol,
        sector: candidate.sector?.label || "Other",
        setup: value >= 4.8 ? "반등 감시 우선" : value >= 3.2 ? "반등 조건부 감시" : "아직 약함",
        score: Number(value.toFixed(2)),
        bias: candidate.bias,
        reasons: buildOpportunityReasonList(candidate, candidate.sector, "rebound")
      };
    })
    .filter((candidate) => candidate.score >= 3.2)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const avoidCandidates = withSector
    .filter((candidate) => candidate.score <= -3)
    .map((candidate) => {
      const sectorScore = Number(candidate.sector?.averageScore || 0);
      const value =
        Math.abs(candidate.score) * 1.1 +
        clampNumber(Math.abs(Math.min(Number(candidate.orderbookImbalancePct || 0), 0)) / 16, 0, 4) +
        clampNumber(Math.abs(Math.min(Number(candidate.scoreDelta || 0), 0)), 0, 3) * 0.8 +
        clampNumber(Math.abs(Math.min(sectorScore, 0)) / 2.8, 0, 3);
      return {
        symbol: candidate.symbol,
        sector: candidate.sector?.label || "Other",
        risk: value >= 8 ? "회피 우선" : value >= 6 ? "공격 매수 주의" : "약세 경계",
        score: Number(value.toFixed(2)),
        bias: candidate.bias,
        reasons: buildOpportunityReasonList(candidate, candidate.sector, "avoid")
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return {
    momentumCandidates,
    reboundCandidates,
    avoidCandidates
  };
}

async function buildPublicOpportunityScan(timeframe, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 6), 3), 12);
  const universe = Math.min(Math.max(Number(options.universe || 24), limit), 48);
  const sectorFlow = await buildPublicSectorFlow(timeframe, { universe });
  const direction = await buildPublicDirectionScan(timeframe, {
    limit: Math.max(limit, 8),
    universe: Math.min(universe, 20)
  });

  const allCandidates = new Map();
  for (const candidate of [...direction.leaders, ...direction.laggards]) {
    allCandidates.set(candidate.symbol, candidate);
  }
  const sectorLeaders = (sectorFlow.sectors || []).flatMap((sector) => sector.members || []);
  for (const member of sectorLeaders) {
    if (!allCandidates.has(member.symbol)) {
      allCandidates.set(member.symbol, member);
    }
  }
  const normalizedBuckets = buildOpportunityBuckets(Array.from(allCandidates.values()), sectorFlow);

  return {
    fetchedAt: new Date().toISOString(),
    timeframe,
    universe,
    marketRegime: {
      breadthTone: direction.breadth.tone,
      sectorTone: sectorFlow.summary.riskTone,
      leaderSector: sectorFlow.summary.leaderSector?.label || null,
      weakestSector: sectorFlow.summary.weakestSector?.label || null
    },
    setups: {
      momentum: normalizedBuckets.momentumCandidates.slice(0, limit),
      rebound: normalizedBuckets.reboundCandidates.slice(0, limit),
      avoid: normalizedBuckets.avoidCandidates.slice(0, limit)
    },
    note: "확률형 감시 목록입니다. 추세 우위, 섹터 상대강도, 호가 불균형, 최근 점수 변화를 함께 반영했습니다."
  };
}

async function getLatestDirectionHistoryEntries(timeframe, symbols = []) {
  if (!hasDatabaseConfig() || !Array.isArray(symbols) || !symbols.length) {
    return new Map();
  }

  let result;
  try {
    result = await query(
      `
        select distinct on (symbol)
          symbol,
          timeframe,
          score,
          trust_score,
          created_at
        from market_direction_history
        where timeframe = $1
          and symbol = any($2::text[])
        order by symbol, created_at desc
      `,
      [timeframe, symbols]
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      return new Map();
    }
    throw error;
  }

  return new Map(
    result.rows.map((row) => [
      row.symbol,
      {
        score: Number(row.score || 0),
        trustScore: Number(row.trust_score || 0),
        createdAt: row.created_at
      }
    ])
  );
}

function attachDirectionHistory(candidate, previousEntry) {
  return {
    ...candidate,
    scoreDelta: previousEntry ? Number((candidate.score - previousEntry.score).toFixed(2)) : null,
    trustDelta: previousEntry ? Number((candidate.trustScore - previousEntry.trustScore).toFixed(0)) : null,
    previousCapturedAt: previousEntry?.createdAt || null
  };
}

async function persistDirectionHistoryEntries(timeframe, candidates, previousEntries) {
  if (!hasDatabaseConfig() || !Array.isArray(candidates) || !candidates.length) {
    return 0;
  }

  const cutoff = Date.now() - 5 * 60 * 1000;
  let persistedCount = 0;

  for (const candidate of candidates) {
    const previousEntry = previousEntries.get(candidate.symbol);
    if (previousEntry?.createdAt && new Date(previousEntry.createdAt).getTime() >= cutoff) {
      continue;
    }

    try {
      await query(
        `
          insert into market_direction_history (
            symbol,
            timeframe,
            score,
            trust_score,
            tone,
            bias,
            price_usdt,
            change_24h_pct,
            orderbook_imbalance_pct,
            quote_volume_24h_usdt,
            snapshot
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
        `,
        [
          candidate.symbol,
          timeframe,
          candidate.score,
          candidate.trustScore,
          candidate.tone,
          candidate.bias,
          candidate.priceUsdt,
          candidate.change24hPct,
          candidate.orderbookImbalancePct,
          candidate.quoteVolume24hUsdt,
          JSON.stringify(candidate)
        ]
      );
    } catch (error) {
      if (isMissingRelationError(error)) {
        return persistedCount;
      }
      throw error;
    }
    persistedCount += 1;
  }

  return persistedCount;
}

async function getDirectionHistory(symbol, timeframe, limit) {
  if (!hasDatabaseConfig()) {
    return [];
  }

  let result;
  try {
    result = await query(
      `
        select
          symbol,
          timeframe,
          score,
          trust_score,
          tone,
          bias,
          price_usdt,
          change_24h_pct,
          orderbook_imbalance_pct,
          quote_volume_24h_usdt,
          snapshot,
          created_at
        from market_direction_history
        where symbol = $1
          and timeframe = $2
        order by created_at desc
        limit $3
      `,
      [symbol, timeframe, limit]
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return result.rows.map((row) => ({
    symbol: row.symbol,
    timeframe: row.timeframe,
    score: Number(row.score || 0),
    trustScore: Number(row.trust_score || 0),
    tone: row.tone,
    bias: row.bias,
    priceUsdt: row.price_usdt === null ? null : Number(row.price_usdt),
    change24hPct: row.change_24h_pct === null ? null : Number(row.change_24h_pct),
    orderbookImbalancePct: row.orderbook_imbalance_pct === null ? null : Number(row.orderbook_imbalance_pct),
    quoteVolume24hUsdt: row.quote_volume_24h_usdt === null ? null : Number(row.quote_volume_24h_usdt),
    snapshot: parseJsonColumn(row.snapshot, null),
    createdAt: row.created_at
  }));
}

async function buildPublicDirectionScan(timeframe, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 5), 3), 12);
  const universe = Math.min(Math.max(Number(options.universe || 10), limit), 20);
  const coins = (await getSupportedCoins())
    .filter((coin) => !isStablecoinLikeCoin(coin))
    .slice(0, universe);
  const packets = await Promise.allSettled(
    coins.map((coin) => getMultiTimeframeMarketPacket(coin.symbol, { timeframe }))
  );

  const successfulPackets = packets
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  const quoteVolumes = successfulPackets
    .map((packet) => Number(packet.primary?.quoteVolume24hUsdt || 0))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const medianQuoteVolume = quoteVolumes.length ? quoteVolumes[Math.floor(quoteVolumes.length / 2)] : 0;
  const depthValues = successfulPackets
    .map((packet) => Number(packet.orderbook?.totalBidValueUsdt || 0) + Number(packet.orderbook?.totalAskValueUsdt || 0))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const medianDepthValue = depthValues.length ? depthValues[Math.floor(depthValues.length / 2)] : 0;

  const baseCandidates = successfulPackets
    .map((packet) => buildDirectionCandidate(packet, medianQuoteVolume, medianDepthValue))
    .sort((left, right) => right.score - left.score);
  const previousEntries = await getLatestDirectionHistoryEntries(
    timeframe,
    baseCandidates.map((candidate) => candidate.symbol)
  );
  const candidates = baseCandidates.map((candidate) => attachDirectionHistory(candidate, previousEntries.get(candidate.symbol)));
  let persistedSymbols = 0;

  try {
    persistedSymbols = await persistDirectionHistoryEntries(timeframe, candidates, previousEntries);
  } catch (_error) {
    persistedSymbols = 0;
  }

  const leaders = candidates.slice(0, limit);
  const laggards = [...candidates].reverse().slice(0, Math.min(3, limit));
  const upCount = candidates.filter((candidate) => candidate.score >= 2.1).length;
  const downCount = candidates.filter((candidate) => candidate.score <= -2.1).length;
  const neutralCount = Math.max(candidates.length - upCount - downCount, 0);

  let intelligence = getCachedIntelligence("BTC");
  if (!intelligence) {
    try {
      intelligence = await fetchAndCacheIntelligence("BTC", "BTC");
    } catch (_error) {
      intelligence = null;
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    timeframe,
    universeSize: candidates.length,
    breadth: {
      upCount,
      downCount,
      neutralCount,
      tone: upCount > downCount ? "risk-on" : downCount > upCount ? "risk-off" : "balanced"
    },
    dominance: intelligence
      ? {
          btc: intelligence.macroStats.btcDominancePct,
          eth: intelligence.macroStats.ethDominancePct,
          totalMarketcapUsd: intelligence.macroStats.totalMarketCapUsd,
          totalVolumeUsd: intelligence.macroStats.totalVolumeUsd
        }
      : {
          btc: null,
          eth: null,
          totalMarketcapUsd: null,
          totalVolumeUsd: null
        },
    storage: {
      enabled: hasDatabaseConfig(),
      persistedSymbols
    },
    leaders,
    laggards
  };
}

function summarizeAiSettings(profile) {
  return {
    provider: profile?.ai_provider || "auto",
    openAiModel: profile?.openai_model || "gpt-4.1-mini",
    geminiModel: profile?.gemini_model || "gemini-2.5-flash",
    hasOpenAiKey: Boolean(profile?.openai_api_key),
    hasGeminiKey: Boolean(profile?.gemini_api_key)
  };
}

function inferProviderFromKey(value) {
  const key = String(value || "").trim();

  if (!key) {
    return null;
  }

  if (key.startsWith("sk-") || key.startsWith("sk-proj-")) {
    return "openai";
  }

  if (key.startsWith("AIza")) {
    return "gemini";
  }

  return null;
}

function getDefaultModelForProvider(provider) {
  return provider === "gemini" ? "gemini-2.5-flash" : "gpt-4.1-mini";
}

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }

  return value;
}

function normalizeFocusRegionPayload(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const startTime = Number(input.startTime);
  const endTime = Number(input.endTime);
  const minPrice = Number(input.minPrice);
  const maxPrice = Number(input.maxPrice);

  if (![startTime, endTime, minPrice, maxPrice].every(Number.isFinite)) {
    return null;
  }

  return {
    id: String(input.id || "focus-region"),
    label: String(input.label || "질문 구간"),
    reason: String(input.reason || "사용자가 지정한 관심 구간"),
    startTime: Math.min(startTime, endTime),
    endTime: Math.max(startTime, endTime),
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice: Math.max(minPrice, maxPrice)
  };
}

function buildFocusRegionPromptSection(snapshot, focusRegion) {
  if (!snapshot || !focusRegion) {
    return "";
  }

  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  const regionCandles = candles.filter(
    (candle) => Number(candle.timestamp) >= focusRegion.startTime && Number(candle.timestamp) <= focusRegion.endTime
  );

  if (!regionCandles.length) {
    return `
[질문 구간 요약]
- 레이블: ${focusRegion.label}
- 시간 범위: ${focusRegion.startTime}~${focusRegion.endTime}
- 가격 범위: ${focusRegion.minPrice}~${focusRegion.maxPrice}
- 상태: 현재 보이는 캔들 범위와 겹치는 데이터가 충분하지 않음
`.trim();
  }

  const firstCandle = regionCandles[0];
  const lastCandle = regionCandles[regionCandles.length - 1];
  const highest = Math.max(...regionCandles.map((candle) => Number(candle.high || 0)));
  const lowest = Math.min(...regionCandles.map((candle) => Number(candle.low || 0)));
  const totalVolume = regionCandles.reduce((sum, candle) => sum + Number(candle.volume || 0), 0);
  const changePct = ((Number(lastCandle.close || 0) - Number(firstCandle.open || 0)) / Math.max(Number(firstCandle.open || 1), 1)) * 100;
  const currentPrice = Number(snapshot.primary?.priceUsdt || 0);
  const location = currentPrice > focusRegion.maxPrice ? "구간 상단 위" : currentPrice < focusRegion.minPrice ? "구간 하단 아래" : "구간 내부";

  return `
[질문 구간 요약]
- 레이블: ${focusRegion.label}
- 요청 이유: ${focusRegion.reason}
- 포함 캔들 수: ${regionCandles.length}
- 구간 시작/종료 시가-종가: ${firstCandle.open} -> ${lastCandle.close}
- 구간 고점/저점: ${highest} / ${lowest}
- 구간 변화율(%): ${changePct}
- 구간 거래량 합: ${totalVolume}
- 현재가의 구간 위치: ${location}
- 사용자가 지정한 가격 범위: ${focusRegion.minPrice}~${focusRegion.maxPrice}
`.trim();
}

async function getAuthenticatedUser(request) {
  const sessionToken = getSessionTokenFromRequest(request);

  if (!sessionToken) {
    return null;
  }

  const result = await query(
    `
      select
        u.id,
        u.username,
        coalesce(u.display_name, u.username) as display_name
      from app_sessions s
      join app_users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()
      limit 1
    `,
    [hashToken(sessionToken)]
  );

  return result.rows[0] || null;
}

async function getUserProfile(userId) {
  const result = await query(
    `
      select
        user_id,
        style,
        risk_rule,
        watch_items,
        ai_provider,
        openai_api_key,
        openai_model,
        gemini_api_key,
        gemini_model,
        updated_at
      from user_profiles
      where user_id = $1
      limit 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function insertAnalysisHistory(userId, payload) {
  await query(
    `
      insert into analysis_history (
        user_id,
        symbol,
        timeframe,
        provider,
        model,
        manual_annotations,
        ai_annotations,
        snapshot,
        context,
        analysis
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10)
    `,
    [
      userId,
      payload.symbol,
      payload.timeframe,
      payload.provider,
      payload.model,
      JSON.stringify(payload.manualAnnotations || []),
      JSON.stringify(payload.aiAnnotations || []),
      JSON.stringify(payload.snapshot || null),
      JSON.stringify(payload.context || null),
      payload.analysis || ""
    ]
  );
}

async function getAnalysisHistory(userId) {
  const result = await query(
    `
      select
        id,
        symbol,
        timeframe,
        provider,
        model,
        manual_annotations,
        ai_annotations,
        snapshot,
        context,
        analysis,
        created_at
      from analysis_history
      where user_id = $1
      order by created_at desc
      limit 30
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    provider: row.provider,
    model: row.model,
    manualAnnotations: parseJsonColumn(row.manual_annotations, []),
    aiAnnotations: parseJsonColumn(row.ai_annotations, []),
    snapshot: parseJsonColumn(row.snapshot, null),
    context: parseJsonColumn(row.context, null),
    analysis: row.analysis,
    createdAt: row.created_at
  }));
}

async function buildPublicBriefing(symbol, timeframe) {
  const label = await getCoinLabel(symbol);
  const [market, intelligence] = await Promise.all([
    getMarketSnapshot(symbol, { timeframe }),
    getIntelligenceSnapshot(symbol, label)
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    symbol,
    label,
    timeframe: market.timeframe,
    timestamp: Math.floor(Date.now() / 1000),
    price: market.primary.priceUsdt,
    bithumb_price: market.local.available ? market.local.priceKrw : null,
    premium: market.comparison.premiumPct,
    spread_usdt: market.orderbook.spreadUsdt,
    bid_depth_units: market.orderbook.totalBidUnits,
    ask_depth_units: market.orderbook.totalAskUnits,
    bid_depth_value_usdt: market.orderbook.totalBidValueUsdt,
    ask_depth_value_usdt: market.orderbook.totalAskValueUsdt,
    depth_imbalance_pct: market.orderbook.imbalancePct,
    wall_pressure: market.orderbook.wallPressure,
    bid_wall_price: market.orderbook.bidWall?.price || null,
    bid_wall_size: market.orderbook.bidWall?.quantity || null,
    bid_wall_value_usdt: market.orderbook.bidWall?.valueUsdt || null,
    ask_wall_price: market.orderbook.askWall?.price || null,
    ask_wall_size: market.orderbook.askWall?.quantity || null,
    ask_wall_value_usdt: market.orderbook.askWall?.valueUsdt || null,
    support_wall_price: market.orderbook.supportWallPrice,
    resistance_wall_price: market.orderbook.resistanceWallPrice,
    btc_dominance: intelligence.macroStats.btcDominancePct,
    eth_dominance: intelligence.macroStats.ethDominancePct,
    total_marketcap_usd: intelligence.macroStats.totalMarketCapUsd,
    total_volume_usd: intelligence.macroStats.totalVolumeUsd,
    macro: intelligence.binanceStats.momentum24hPct >= 0 ? "risk-on" : "risk-off",
    news_summary: intelligence.newsStats.latestHeadline || null,
    market,
    intelligence,
    usage: {
      note: "이 응답은 공개용이며 개인 계정 정보, 저장된 히스토리, 사용자별 AI 키는 포함하지 않습니다."
    }
  };
}

async function createUserSession(userId, request, response) {
  const sessionToken = createSessionToken();
  const tokenHash = hashToken(sessionToken);

  await query(
    `
      insert into app_sessions (user_id, token_hash, expires_at)
      values ($1, $2, now() + interval '30 days')
    `,
    [userId, tokenHash]
  );

  response.setHeader("Set-Cookie", buildSessionCookie(sessionToken, shouldUseSecureCookies(request)));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    now: new Date().toISOString()
  });
});

app.get("/api/coins", async (_request, response) => {
  const coins = await getSupportedCoins();

  response.json({
    coins,
    timeframes: getSupportedTimeframes(),
    localExchange: "Bithumb",
    primaryExchange: "Binance"
  });
});

app.get("/api/modules", (_request, response) => {
  response.json({
    modules: moduleContext.listModules()
  });
});

app.get("/api/public", (request, response) => {
  const baseUrl = getRequestBaseUrl(request);
  response.json(buildPublicEndpointDocs(baseUrl));
});

async function handlePublicBriefingRequest(request, response) {
  try {
    const symbol = String(request.params.symbol || request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const format = String(request.query.format || "json").toLowerCase();
    const briefing = await buildPublicBriefing(symbol, timeframe);

    if (format === "text") {
      response.type("text/plain; charset=utf-8").send(formatPublicBriefingText(briefing));
      return;
    }

    response.json(briefing);
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
}

app.get("/api/public/briefing", handlePublicBriefingRequest);
app.get("/api/public/briefing/:symbol", handlePublicBriefingRequest);

// Serve project README as a public endpoint to make docs machine-readable
app.get("/api/public/readme", (request, response) => {
  const readmePath = path.join(__dirname, "..", "README.md");

  fs.readFile(readmePath, "utf8", (err, data) => {
    if (err) {
      response.status(500).json({ error: "README not available" });
      return;
    }

    // Support JSON-safe delivery for parsers that block raw markdown
    const wantJson = String(request.query.format || "").toLowerCase() === "json";

    if (wantJson) {
      // Return as JSON with content field; callers can parse or sanitize safely
      response.type("application/json; charset=utf-8").json({ content: data });
      return;
    }

    // Default: return as markdown/plain text so browsers can render
    response.type("text/markdown; charset=utf-8").send(data);
  });
});

// Alias endpoint: /api/public/info (same content as /api/public/readme)
app.get("/api/public/info", (request, response) => {
  const readmePath = path.join(__dirname, "..", "README.md");

  fs.readFile(readmePath, "utf8", (err, data) => {
    if (err) {
      response.status(500).json({ error: "README not available" });
      return;
    }

    const wantJson = String(request.query.format || "").toLowerCase() === "json";

    if (wantJson) {
      response.type("application/json; charset=utf-8").json({ content: data });
      return;
    }

    response.type("text/markdown; charset=utf-8").send(data);
  });
});

async function buildConciseMarketSnapshot(snapshot, options = {}) {
  function parseTime(val) {
    if (val === undefined || val === null || val === "") return null;
    const n = Number(val);
    if (!Number.isNaN(n) && String(val).match(/^\d+$/)) return Number(val);
    const parsed = Date.parse(String(val));
    return Number.isNaN(parsed) ? null : parsed;
  }

  const concise = {
    symbol: snapshot.symbol,
    label: snapshot.label,
    fetchedAt: snapshot.fetchedAt,
    serverTime: snapshot.serverTime || Math.floor(Date.now() / 1000),
    timeframe: snapshot.timeframe,
    primary: snapshot.primary,
    local: snapshot.local,
    comparison: snapshot.comparison,
    orderbook: {
      bestBid: snapshot.orderbook.bestBid,
      bestAsk: snapshot.orderbook.bestAsk,
      spreadUsdt: snapshot.orderbook.spreadUsdt,
      totalBidValueUsdt: snapshot.orderbook.totalBidValueUsdt,
      totalAskValueUsdt: snapshot.orderbook.totalAskValueUsdt,
      imbalancePct: snapshot.orderbook.imbalancePct,
      wallPressure: snapshot.orderbook.wallPressure,
      bidWall: snapshot.orderbook.bidWall,
      askWall: snapshot.orderbook.askWall
    },
    annotations: snapshot.annotations || []
  };

  const conciseCandles = Number(options.candles || 24);
  const conciseTrades = Number(options.trades || 20);
  const orderbookDepth = Number(options.orderbookDepth || 20);

  const startTs = parseTime(options.start);
  const endTs = parseTime(options.end);

  let candles = (snapshot.candles || []).slice();
  let trades = (snapshot.recentTrades || []).slice();

  if (startTs || endTs) {
    if (startTs) candles = candles.filter((c) => c.timestamp >= startTs);
    if (endTs) candles = candles.filter((c) => c.timestamp <= endTs);
    if (startTs) trades = trades.filter((t) => new Date(t.timestamp).getTime() >= startTs);
    if (endTs) trades = trades.filter((t) => new Date(t.timestamp).getTime() <= endTs);
  }

  // limit arrays to avoid overly long payloads
  concise.candles = candles.slice(-conciseCandles);
  concise.recentTrades = trades.slice(-conciseTrades);

  // limit orderbook depth
  concise.orderbook.bids = (snapshot.orderbook?.bids || []).slice(0, orderbookDepth);
  concise.orderbook.asks = (snapshot.orderbook?.asks || []).slice(0, orderbookDepth);

  return concise;
}

app.get("/api/public/market", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const conciseFlag = String(request.query.concise || "true").toLowerCase() !== "false";
    const snapshot = await getMarketSnapshot(symbol, { timeframe });

    if (!conciseFlag) {
      response.json(snapshot);
      return;
    }
    // attach macro stats (btc/eth dominance, total marketcap) for convenience
    const label = await getCoinLabel(symbol);
    let intelligence = getCachedIntelligence(symbol);
    if (!intelligence) {
      // if no cached value, fetch synchronously (first request for this symbol)
      try {
        intelligence = await fetchAndCacheIntelligence(symbol, label);
      } catch (_err) {
        intelligence = null;
      }
    } else {
      // if cached but expired soon, refresh in background
      const key = String(symbol).toUpperCase();
      const entry = macroCache.get(key);
      if (entry && entry.expiresAt <= Date.now()) {
        // start background refresh without awaiting
        fetchAndCacheIntelligence(symbol, label).catch(() => {});
      }
    }

    const readmePath = path.join(__dirname, "..", "README.md");
    let readmeContent = null;
    try {
      readmeContent = fs.readFileSync(readmePath, "utf8");
    } catch (_e) {
      readmeContent = null;
    }

    const macroFields = intelligence
      ? {
          btc_dominance: intelligence.macroStats.btcDominancePct,
          eth_dominance: intelligence.macroStats.ethDominancePct,
          total_marketcap_usd: intelligence.macroStats.totalMarketCapUsd
        }
      : { btc_dominance: null, eth_dominance: null, total_marketcap_usd: null };

    if (!conciseFlag) {
      Object.assign(snapshot, macroFields);
      snapshot.readme = readmeContent;
      response.json(snapshot);
      return;
    }

    const candles = Number(request.query.candles || 24);
    const trades = Number(request.query.trades || 20);
    const orderbookDepth = Number(request.query.orderbookDepth || 20);
    const start = request.query.start;
    const end = request.query.end;
    const payload = await buildConciseMarketSnapshot(snapshot, { candles, trades, orderbookDepth, start, end });
    Object.assign(payload, macroFields);
    payload.readme = readmeContent;
    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

// New alias endpoint that returns the same market snapshot payload but named `snapshot` for clarity
app.get("/api/public/snapshot", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const conciseFlag = String(request.query.concise || "true").toLowerCase() !== "false";
    const snapshot = await getMarketSnapshot(symbol, { timeframe });

    // attach macro stats (btc/eth dominance, total marketcap) for convenience
    const label = await getCoinLabel(symbol);
    let intelligence = getCachedIntelligence(symbol);
    if (!intelligence) {
      try {
        intelligence = await fetchAndCacheIntelligence(symbol, label);
      } catch (_err) {
        intelligence = null;
      }
    } else {
      const key = String(symbol).toUpperCase();
      const entry = macroCache.get(key);
      if (entry && entry.expiresAt <= Date.now()) {
        fetchAndCacheIntelligence(symbol, label).catch(() => {});
      }
    }

    const readmePath = path.join(__dirname, "..", "README.md");
    let readmeContent = null;
    try {
      readmeContent = fs.readFileSync(readmePath, "utf8");
    } catch (_e) {
      readmeContent = null;
    }

    const macroFields = intelligence
      ? {
          btc_dominance: intelligence.macroStats.btcDominancePct,
          eth_dominance: intelligence.macroStats.ethDominancePct,
          total_marketcap_usd: intelligence.macroStats.totalMarketCapUsd
        }
      : { btc_dominance: null, eth_dominance: null, total_marketcap_usd: null };

    if (!conciseFlag) {
      Object.assign(snapshot, macroFields);
      snapshot.readme = readmeContent;
      response.json(snapshot);
      return;
    }

    const candles = Number(request.query.candles || 24);
    const trades = Number(request.query.trades || 20);
    const orderbookDepth = Number(request.query.orderbookDepth || 20);
    const start = request.query.start;
    const end = request.query.end;
    const payload = await buildConciseMarketSnapshot(snapshot, { candles, trades, orderbookDepth, start, end });
    Object.assign(payload, macroFields);
    payload.readme = readmeContent;
    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/liquidity", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const snapshot = await getMarketSnapshot(symbol, { timeframe });
    const orderbookDepth = Number(request.query.orderbookDepth || 20);
    const ob = snapshot.orderbook || {};

    response.json({
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      bestBid: ob.bestBid,
      bestAsk: ob.bestAsk,
      spreadUsdt: ob.spreadUsdt,
      totalBidUnits: ob.totalBidUnits,
      totalAskUnits: ob.totalAskUnits,
      totalBidValueUsdt: ob.totalBidValueUsdt,
      totalAskValueUsdt: ob.totalAskValueUsdt,
      imbalancePct: ob.imbalancePct,
      wallPressure: ob.wallPressure,
      bidWall: ob.bidWall,
      askWall: ob.askWall,
      bids: (ob.bids || []).slice(0, orderbookDepth),
      asks: (ob.asks || []).slice(0, orderbookDepth)
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/structure", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const packet = await getMultiTimeframeMarketPacket(symbol, { timeframe });

    const recentLimit = Number(request.query.recent || 12);
    const multi = (packet.multiTimeframes || []).map((m) => ({
      timeframe: m.timeframe,
      label: m.label,
      candleCount: m.candleCount,
      changePct: m.changePct,
      trend: m.trend,
      recentCandles: (m.recentCandles || []).slice(-recentLimit)
    }));

    response.json({
      symbol: packet.symbol,
      label: packet.label,
      fetchedAt: packet.fetchedAt,
      annotations: packet.annotations || [],
      multiTimeframes: multi
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/direction", async (request, response) => {
  try {
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const payload = await buildPublicDirectionScan(timeframe, {
      limit: request.query.limit,
      universe: request.query.universe
    });

    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/sector-flow", async (request, response) => {
  try {
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const payload = await buildPublicSectorFlow(timeframe, {
      universe: request.query.universe
    });

    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/opportunity", async (request, response) => {
  try {
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const payload = await buildPublicOpportunityScan(timeframe, {
      universe: request.query.universe,
      limit: request.query.limit
    });

    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/direction/history", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const limit = Math.min(Math.max(Number(request.query.limit || 24), 1), 200);
    const history = await getDirectionHistory(symbol, timeframe, limit);

    response.json({
      symbol,
      timeframe,
      history,
      storage: {
        enabled: hasDatabaseConfig()
      }
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/public/overlay", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const snapshot = await getMarketSnapshot(symbol, { timeframe });
    const focusRegion = buildPublicOverlayRegion(snapshot, {
      start: request.query.start,
      end: request.query.end,
      candles: request.query.candles
    });
    const enabledIndicators = parseOverlayIndicatorSelection(request.query.indicators);
    const signals = buildPublicOverlaySignals(snapshot, focusRegion);
    const bias = buildPublicOverlayBias(signals);
    const annotations = buildPublicOverlayIndicatorAnnotations(snapshot, focusRegion, enabledIndicators);

    response.json({
      symbol: snapshot.symbol,
      label: snapshot.label,
      timeframe: snapshot.timeframe,
      fetchedAt: snapshot.fetchedAt,
      focusRegion: {
        ...focusRegion,
        startAt: new Date(Number(focusRegion.startTime)).toISOString(),
        endAt: new Date(Number(focusRegion.endTime)).toISOString()
      },
      indicators: {
        enabled: enabledIndicators,
        annotations
      },
      signals,
      bias,
      usage: {
        note: "차트 AI 오버레이와 같은 구간 지표 계산 결과입니다.",
        query: {
          start: request.query.start || null,
          end: request.query.end || null,
          candles: request.query.candles ? Number(request.query.candles) : null,
          indicators: request.query.indicators || null
        }
      }
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSeoHead(title, description, url) {
  const t = escapeHtml(title || "");
  const d = escapeHtml(description || "");
  const u = escapeHtml(url || "");
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title || '',
    description: description || '',
    url: url || ''
  };
  const jsonLdStr = JSON.stringify(jsonLd);

  return `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${t}</title>
    <meta name="description" content="${d}">
    <meta name="robots" content="index,follow">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${t}">
    <meta property="og:description" content="${d}">
    <meta property="og:url" content="${u}">
    <link rel="canonical" href="${u}">
    <script type="application/ld+json">${jsonLdStr}</script>
  `;
}

// SEO-friendly public pages (server-side rendered) so search engines can index snapshots
app.get("/public/market", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || request.query.s || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const briefing = await buildPublicBriefing(symbol, timeframe);

    const title = `Market snapshot — ${briefing.symbol} ${briefing.label}`;
    const description = `Market snapshot for ${briefing.symbol} (${briefing.label}) — price ${briefing.price} USDT — timeframe ${briefing.timeframe}`;

    const pageUrl = getRequestBaseUrl(request) + request.originalUrl;
    const html = `<!doctype html><html lang="ko"><head>${buildSeoHead(title, description, pageUrl)}<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;line-height:1.4;padding:18px;max-width:980px;margin:auto;color:#0b0b0b}pre{white-space:pre-wrap;word-break:break-word;background:#f8f8f8;padding:12px;border-radius:6px;overflow:auto}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><h2>Summary</h2><ul><li>Price: ${escapeHtml(String(briefing.price))} USDT</li><li>Timeframe: ${escapeHtml(String(briefing.timeframe))}</li><li>Fetched: ${escapeHtml(String(briefing.fetchedAt))}</li><li>BTC Dominance: ${escapeHtml(String(briefing.btc_dominance))}%</li><li>ETH Dominance: ${escapeHtml(String(briefing.eth_dominance))}%</li></ul><h2>Market & Orderbook</h2><pre>${escapeHtml(JSON.stringify(briefing.market, null, 2))}</pre><h2>Intelligence</h2><pre>${escapeHtml(JSON.stringify(briefing.intelligence, null, 2))}</pre><h2>Notes</h2><pre>${escapeHtml(briefing.usage?.note || "")}</pre></body></html>`;

    response.type("text/html; charset=utf-8").send(html);
  } catch (err) {
    response.status(500).send("Error rendering market page: " + escapeHtml(err.message));
  }
});

app.get("/public/liquidity", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || request.query.s || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const snapshot = await getMarketSnapshot(symbol, { timeframe });
    const ob = snapshot.orderbook || {};

    const title = `Liquidity — ${symbol}`;
    const description = `Liquidity snapshot for ${symbol} — spread ${ob.spreadUsdt} USDT`;

    const pageUrl = getRequestBaseUrl(request) + request.originalUrl;
    const html = `<!doctype html><html lang="ko"><head>${buildSeoHead(title, description, pageUrl)}<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;padding:18px;max-width:980px;margin:auto}pre{white-space:pre-wrap;background:#f8f8f8;padding:12px;border-radius:6px}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><h2>Orderbook</h2><pre>${escapeHtml(JSON.stringify(ob, null, 2))}</pre></body></html>`;

    response.type("text/html; charset=utf-8").send(html);
  } catch (err) {
    response.status(500).send("Error rendering liquidity page: " + escapeHtml(err.message));
  }
});

app.get("/public/structure", async (request, response) => {
  try {
    const symbol = String(request.query.symbol || request.query.s || "BTC").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const packet = await getMultiTimeframeMarketPacket(symbol, { timeframe });

    const title = `Structure — ${symbol}`;
    const description = `Multi-timeframe structure for ${symbol}`;

    const pageUrl = getRequestBaseUrl(request) + request.originalUrl;
    const html = `<!doctype html><html lang="ko"><head>${buildSeoHead(title, description, pageUrl)}<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;padding:18px;max-width:980px;margin:auto}pre{white-space:pre-wrap;background:#f8f8f8;padding:12px;border-radius:6px}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><h2>Multi Timeframes</h2><pre>${escapeHtml(JSON.stringify(packet.multiTimeframes || packet, null, 2))}</pre></body></html>`;

    response.type("text/html; charset=utf-8").send(html);
  } catch (err) {
    response.status(500).send("Error rendering structure page: " + escapeHtml(err.message));
  }
});

// HTML-readable README for search engines (renders markdown as preformatted text)
app.get("/public/readme", (request, response) => {
  const readmePath = path.join(__dirname, "..", "README.md");

  try {
    const data = fs.readFileSync(readmePath, "utf8");
    const title = "Gainob — README";
    const description = "Project README and public API documentation.";
    const pageUrl = getRequestBaseUrl(request) + request.originalUrl;
    const html = `<!doctype html><html lang="en"><head>${buildSeoHead(title, description, pageUrl)}<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;padding:18px;max-width:980px;margin:auto}pre{white-space:pre-wrap;background:#fff;padding:12px;border-radius:6px;border:1px solid #eee}</style></head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(data)}</pre></body></html>`;

    response.type("text/html; charset=utf-8").send(html);
  } catch (err) {
    response.status(500).send("README not available");
  }
});

// Sitemap for search engines (basic dynamic sitemap)
app.get('/public/sitemap.xml', (req, res) => {
  const base = getRequestBaseUrl(req);
  const symbols = ['BTC','ETH','SOL'];
  const timeframes = ['1h'];
  const urls = [];

  urls.push(`${base}/public/readme`);
  urls.push(`${base}/public/market`);

  symbols.forEach((s) => {
    timeframes.forEach((tf) => {
      urls.push(`${base}/public/market?symbol=${s}&timeframe=${tf}`);
      urls.push(`${base}/public/liquidity?symbol=${s}`);
      urls.push(`${base}/public/structure?symbol=${s}`);
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url>\n    <loc>${escapeHtml(u)}</loc>\n  </url>`)
    .join('\n')}\n</urlset>`;

  res.type('application/xml; charset=utf-8').send(xml);
});

app.get("/api/session", async (request, response) => {
  const database = await getDatabaseStatus();
  const user = database.connected ? await getAuthenticatedUser(request) : null;
  const profile = database.connected && user ? await getUserProfile(user.id) : null;

  response.json({
    authenticated: Boolean(user),
    provider: "internal",
    user,
    aiSettings: summarizeAiSettings(profile),
    serverReady: database.connected,
    database,
    message: database.connected
      ? user
        ? `${user.display_name} 계정으로 로그인되어 있습니다.`
        : "DB 연결이 준비되었습니다. 자체 로그인과 계정 기능을 여기에 붙일 수 있습니다."
      : "DB 연결이 아직 준비되지 않았습니다."
  });
});

app.post("/api/auth/register", async (request, response) => {
  try {
    const username = String(request.body.username || "").trim().toLowerCase();
    const password = String(request.body.password || "");
    const displayName = String(request.body.displayName || "").trim();

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new Error("아이디는 영문 소문자, 숫자, 밑줄 조합 3~24자로 입력하세요.");
    }

    if (password.length < 6) {
      throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
    }

    const passwordHash = await hashPassword(password);
    const insertResult = await query(
      `
        insert into app_users (username, password_hash, display_name)
        values ($1, $2, $3)
        returning id, username, coalesce(display_name, username) as display_name
      `,
      [username, passwordHash, displayName || null]
    );
    const user = insertResult.rows[0];

    await query(
      `
        insert into user_profiles (user_id)
        values ($1)
        on conflict (user_id) do nothing
      `,
      [user.id]
    );

    await createUserSession(user.id, request, response);

    response.json({
      ok: true,
      user
    });
  } catch (error) {
    const isConflict = error.message.includes("duplicate key");

    response.status(isConflict ? 409 : 400).json({
      error: isConflict ? "이미 존재하는 아이디입니다." : error.message
    });
  }
});

app.get("/api/account/ai-settings", async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      throw new Error("로그인된 계정이 없습니다.");
    }

    const profile = await getUserProfile(user.id);
    response.json({
      ok: true,
      aiSettings: summarizeAiSettings(profile)
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

app.post("/api/account/ai-settings", async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      throw new Error("로그인된 계정이 없습니다.");
    }

    const requestedProvider = String(request.body.provider || "auto").trim().toLowerCase();
    const openAiKey = String(request.body.openAiKey || "").trim();
    const geminiKey = String(request.body.geminiKey || "").trim();
    const detectedOpenAi = inferProviderFromKey(openAiKey) === "openai";
    const detectedGemini = inferProviderFromKey(geminiKey) === "gemini";
    const provider =
      requestedProvider !== "auto"
        ? requestedProvider
        : detectedOpenAi
          ? "openai"
          : detectedGemini
            ? "gemini"
            : "auto";
    const openAiModel = String(request.body.openAiModel || getDefaultModelForProvider("openai")).trim();
    const geminiModel = String(request.body.geminiModel || getDefaultModelForProvider("gemini")).trim();

    await query(
      `
        insert into user_profiles (
          user_id,
          ai_provider,
          openai_api_key,
          openai_model,
          gemini_api_key,
          gemini_model,
          updated_at
        )
        values ($1, $2, nullif($3, ''), nullif($4, ''), nullif($5, ''), nullif($6, ''), now())
        on conflict (user_id) do update set
          ai_provider = excluded.ai_provider,
          openai_api_key = case when excluded.openai_api_key is not null then excluded.openai_api_key else user_profiles.openai_api_key end,
          openai_model = case when excluded.openai_model is not null then excluded.openai_model else user_profiles.openai_model end,
          gemini_api_key = case when excluded.gemini_api_key is not null then excluded.gemini_api_key else user_profiles.gemini_api_key end,
          gemini_model = case when excluded.gemini_model is not null then excluded.gemini_model else user_profiles.gemini_model end,
          updated_at = now()
      `,
      [user.id, provider || "auto", openAiKey, openAiModel, geminiKey, geminiModel]
    );

    const profile = await getUserProfile(user.id);
    response.json({
      ok: true,
      aiSettings: summarizeAiSettings(profile)
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

function maskKey(key) {
  if (!key) return null;
  const s = String(key);
  if (s.length <= 8) return '****' + s.slice(-4);
  return s.slice(0, 4) + '...' + s.slice(-4);
}

app.get('/api/account/keys', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });

    const profile = await getUserProfile(user.id);

    response.json({
      ok: true,
      user: { id: user.id, username: user.username, display_name: user.display_name },
      keys: {
        openai: profile?.openai_api_key ? { present: true, masked: maskKey(profile.openai_api_key) } : { present: false },
        gemini: profile?.gemini_api_key ? { present: true, masked: maskKey(profile.gemini_api_key) } : { present: false }
      }
    });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

app.delete('/api/account/keys', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });

    const provider = String(request.query.provider || request.body?.provider || '').toLowerCase();
    if (!['openai', 'gemini'].includes(provider)) {
      return response.status(400).json({ error: 'invalid_provider' });
    }

    const column = provider === 'openai' ? 'openai_api_key' : 'gemini_api_key';
    await query(`update user_profiles set ${column} = null where user_id = $1`, [user.id]);

    response.json({ ok: true, provider });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

// Conversations / chat storage for interactive AI dialogues
app.post('/api/conversations', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });

    const title = String(request.body.title || '').trim();
    const symbol = String(request.body.symbol || '').toUpperCase() || null;
    const timeframe = String(request.body.timeframe || '1h').toLowerCase();

    const result = await query(
      `insert into conversations(user_id, title, symbol, timeframe) values ($1,$2,$3,$4) returning id, created_at`,
      [user.id, title || null, symbol, timeframe]
    );

    response.json({ ok: true, conversation: { id: result.rows[0].id, title, symbol, timeframe, createdAt: result.rows[0].created_at } });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });

    const rows = await query(`select id, title, symbol, timeframe, created_at from conversations where user_id = $1 order by created_at desc limit 200`, [user.id]);
    response.json({ ok: true, conversations: rows.rows.map((r) => ({ id: r.id, title: r.title, symbol: r.symbol, timeframe: r.timeframe, createdAt: r.created_at })) });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });
    const id = String(request.params.id || '');

    const conv = await query(`select id, title, symbol, timeframe, created_at from conversations where id = $1 and user_id = $2 limit 1`, [id, user.id]);
    if (!conv.rows[0]) return response.status(404).json({ error: 'not_found' });

    const messages = await query(`select id, sender, content, meta, created_at from conversation_messages where conversation_id = $1 order by created_at asc`, [id]);

    response.json({ ok: true, conversation: conv.rows[0], messages: messages.rows });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations/:id/messages', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });
    const id = String(request.params.id || '');
    const content = String(request.body.content || '').trim();
    const askAi = Boolean(request.body.askAi);
    const focusRegion = normalizeFocusRegionPayload(request.body.focusRegion);

    const conv = await query(`select id, title, symbol, timeframe from conversations where id = $1 and user_id = $2 limit 1`, [id, user.id]);
    if (!conv.rows[0]) return response.status(404).json({ error: 'not_found' });

    // store user message
    const inserted = await query(
      `insert into conversation_messages(conversation_id, sender, content, meta) values ($1,$2,$3,$4) returning id, created_at`,
      [id, 'user', content, JSON.stringify({ focusRegion })]
    );

    const currentTitle = String(conv.rows[0].title || '').trim();
    const defaultTitle = `${conv.rows[0].symbol || "시장"} ${conv.rows[0].timeframe || "1h"} 대화`;
    if (!currentTitle || currentTitle === defaultTitle) {
      const nextTitle = content.slice(0, 36) || defaultTitle;
      await query(`update conversations set title = $1 where id = $2 and user_id = $3`, [nextTitle, id, user.id]);
    }

    let aiMessage = null;

    if (askAi) {
      try {
        // Let the AI first decide what internal data should be fetched for this turn.
        const inferredSymbols = await inferSymbolsFromText(content, [conv.rows[0].symbol || request.body.symbol || ''].filter(Boolean));
        const heuristicTimeframe = inferTimeframeFromText(content, conv.rows[0].timeframe || request.body.timeframe || '1h');
        const wantsMacro = isMacroPrompt(content);
        const profile = await getUserProfile(user.id);
        const aiOptions = {
          provider: request.body.provider,
          credentials: {
            provider: profile?.ai_provider,
            openAiKey: profile?.openai_api_key,
            openAiModel: profile?.openai_model,
            geminiKey: profile?.gemini_api_key,
            geminiModel: profile?.gemini_model
          },
          useEnvFallback: false
        };
        const recentMessages = await query(
          `select sender, content, created_at from conversation_messages where conversation_id = $1 order by created_at desc limit 12`,
          [id]
        );
        const chatHistory = recentMessages.rows
          .slice()
          .reverse()
          .map((row) => ({
            sender: row.sender,
            content: row.content,
            createdAt: row.created_at
          }));

        const plan = await planConversationDataRequests({
          content,
          chatHistory,
          conversationSymbol: conv.rows[0].symbol || request.body.symbol || '',
          timeframe: heuristicTimeframe,
          inferredSymbols,
          wantsMacro,
          aiOptions
        });
        const plannedSymbols = Array.isArray(plan.symbols) ? plan.symbols : [];
        const symbol = plannedSymbols[0] || inferredSymbols[0] || '';
        const timeframe = normalizeConversationTimeframe(plan.timeframe, heuristicTimeframe);
        const normalizedSymbol = String(symbol || '').toUpperCase();

        if (!normalizedSymbol) {
          if (!plan.needMacro) {
            throw new Error('대화에서 종목을 찾지 못했습니다. 종목 심볼 예: BTC, ETH, SOL 을 포함해 주세요.');
          }
        }

        const primarySymbol = normalizedSymbol || 'BTC';

        const context = await moduleContext.collect({
          symbol: primarySymbol,
          label: await getCoinLabel(primarySymbol),
          timeframe: String(timeframe).toLowerCase(),
          moduleIds: request.body.modules,
          profile: request.body.profile,
          journal: request.body.journal
        });
        context.userMessage = content;
        context.chatHistory = chatHistory;
        context.focusRegion = focusRegion;

        const extraSections = [];
        const marketModule = context.modules.find((module) => module.id === 'market' && module.status === 'ok');

        if (focusRegion && marketModule?.data) {
          extraSections.push(buildFocusRegionPromptSection(marketModule.data, focusRegion));
        }

        if (plan.needMacro) {
          try {
            const macroSnapshot = await getIntelligenceSnapshot('BTC', 'BTC');
            extraSections.push(buildMacroPromptSection(macroSnapshot));
          } catch (_macroError) {
            // ignore macro fetch failure
          }
        }

        const comparisonSymbols = plannedSymbols.slice(0, 4);
        if (comparisonSymbols.length > 1) {
          try {
            const comparisonSnapshots = await Promise.all(
              comparisonSymbols.map(async (comparisonSymbol) => getMarketSnapshot(comparisonSymbol, { timeframe }))
            );
            extraSections.push(buildComparisonPromptSection(comparisonSnapshots));
          } catch (_comparisonError) {
            // ignore comparison fetch failure
          }
        }

        if (plan.focus) {
          extraSections.push(`[이번 턴 데이터 요청 의도]\n- ${plan.focus}`);
        }

        const promptSections = [moduleContext.buildPromptSections({ ...context, manualAnnotations: [] }), ...extraSections]
          .filter(Boolean)
          .join('\n\n');
        const result = await analyzeContext(context, promptSections, aiOptions);

        // store AI response
        const aiInserted = await query(
          `insert into conversation_messages(conversation_id, sender, content, meta) values ($1,$2,$3,$4) returning id, created_at`,
          [
            id,
            'ai',
            result.analysis || result.analysisText || JSON.stringify(result),
            JSON.stringify({ provider: result.provider, model: result.model, annotations: result.annotations, toolPlan: plan, focusRegion })
          ]
        );

        aiMessage = {
          id: aiInserted.rows[0].id,
          sender: 'ai',
          content: result.analysis || result.analysisText || result.analysis || '',
          createdAt: aiInserted.rows[0].created_at,
          annotations: result.annotations,
          meta: { provider: result.provider, model: result.model, annotations: result.annotations, toolPlan: plan, focusRegion }
        };
      } catch (aiError) {
        const failureText = `AI 응답 생성에 실패했습니다: ${aiError.message}`;
        const aiInserted = await query(
          `insert into conversation_messages(conversation_id, sender, content, meta) values ($1,$2,$3,$4) returning id, created_at`,
          [id, 'ai', failureText, JSON.stringify({ error: true, message: aiError.message })]
        );
        aiMessage = {
          id: aiInserted.rows[0].id,
          sender: 'ai',
          content: failureText,
          createdAt: aiInserted.rows[0].created_at,
          error: true
        };
      }
    }

    response.json({ ok: true, messageId: inserted.rows[0].id, ai: aiMessage });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

app.delete('/api/conversations/:id', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'not_authenticated' });
    const id = String(request.params.id || '');

    await query(`delete from conversations where id = $1 and user_id = $2`, [id, user.id]);
    response.json({ ok: true });
  } catch (err) {
    response.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const username = String(request.body.username || "").trim().toLowerCase();
    const password = String(request.body.password || "");
    const result = await query(
      `
        select id, username, password_hash, coalesce(display_name, username) as display_name
        from app_users
        where username = $1
        limit 1
      `,
      [username]
    );
    const user = result.rows[0];

    if (!user) {
      throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    }

    await createUserSession(user.id, request, response);

    response.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name
      }
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

app.post("/api/auth/logout", async (request, response) => {
  const sessionToken = getSessionTokenFromRequest(request);

  if (sessionToken) {
    await query("delete from app_sessions where token_hash = $1", [hashToken(sessionToken)]);
  }

  response.setHeader("Set-Cookie", buildExpiredSessionCookie(shouldUseSecureCookies(request)));
  response.json({
    ok: true
  });
});

app.post("/api/auth/delete-account", async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    const password = String(request.body.password || "");

    if (!user) {
      throw new Error("로그인된 계정이 없습니다.");
    }

    if (!password) {
      throw new Error("계정 삭제 전 비밀번호를 다시 입력하세요.");
    }

    const result = await query(
      `
        select password_hash
        from app_users
        where id = $1
        limit 1
      `,
      [user.id]
    );
    const passwordHash = result.rows[0]?.password_hash || "";
    const isValidPassword = await verifyPassword(password, passwordHash);

    if (!isValidPassword) {
      throw new Error("비밀번호가 올바르지 않습니다.");
    }

    await query("delete from app_users where id = $1", [user.id]);
    response.setHeader("Set-Cookie", buildExpiredSessionCookie(shouldUseSecureCookies(request)));

    response.json({
      ok: true
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

app.get("/api/history", async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      response.json({
        ok: true,
        items: []
      });
      return;
    }

    response.json({
      ok: true,
      items: await getAnalysisHistory(user.id)
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

async function handleMarketRequest(request, response) {
  try {
    const symbol = String(request.params.symbol || request.query.symbol || "").toUpperCase();
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();
    const snapshot = await getMarketSnapshot(symbol, { timeframe });

    response.json(snapshot);
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
}

async function handleIntelligenceRequest(request, response) {
  try {
    const symbol = String(request.params.symbol || request.query.symbol || "").toUpperCase();
    const snapshot = await getIntelligenceSnapshot(symbol, await getCoinLabel(symbol));

    response.json(snapshot);
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
}

app.get("/api/market", handleMarketRequest);
app.get("/api/market/:symbol", handleMarketRequest);
app.get("/api/intelligence", handleIntelligenceRequest);
app.get("/api/intelligence/:symbol", handleIntelligenceRequest);

// Crawler-friendly scan endpoint: summary for many symbols with pagination
app.get("/api/scan", async (request, response) => {
  try {
    const symbolsParam = String(request.query.symbols || request.query.s || "").trim();
    const limit = Math.min(Number(request.query.limit || 50), 200);
    const offset = Math.max(Number(request.query.offset || 0), 0);
    const timeframe = String(request.query.timeframe || "1h").toLowerCase();

    let symbols = [];

    if (symbolsParam) {
      symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    } else {
      const coins = await getSupportedCoins();
      symbols = coins.map((c) => c.symbol).slice(offset, offset + limit);
    }

    const results = [];
    for (const sym of symbols) {
      try {
        const snap = await getMarketSnapshot(sym, { timeframe });
        results.push({
          symbol: snap.symbol,
          label: snap.label,
          pair: snap.pair,
          fetchedAt: snap.fetchedAt,
          serverTime: snap.serverTime,
          timeframe: snap.timeframe,
          priceUsdt: snap.primary?.priceUsdt || null,
          change24hPct: snap.primary?.change24hPct || null,
          spreadUsdt: snap.orderbook?.spreadUsdt || null,
          totalBidValueUsdt: snap.orderbook?.totalBidValueUsdt || null,
          totalAskValueUsdt: snap.orderbook?.totalAskValueUsdt || null,
          openInterest: snap.openInterest || null,
          fundingRate: snap.fundingRate || null,
          localSupported: snap.comparison?.localSupported || false
        });
      } catch (_err) {
        results.push({ symbol: sym, error: "failed" });
      }
    }

    // optional on-chain deposit metrics: only run when client asked and symbols param was provided
    const wantOnchain = String(request.query.onchain || "").toLowerCase() === "true";
    if (wantOnchain && symbolsParam) {
      try {
        const binanceMetrics = await getBinancePublicMetrics(symbols, String(request.query.timeframe || '1h'));
        for (const r of results) {
          if (r.symbol && binanceMetrics[r.symbol]) {
            r.binancePublic = binanceMetrics[r.symbol];
          }
        }
      } catch (_e) {
        // ignore onchain/binance failures
      }
    }

    response.json({ ok: true, count: results.length, results });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/context", async (request, response) => {
  try {
    const symbol = String(request.body.symbol || "").toUpperCase();
    const context = await moduleContext.collect({
      symbol,
      label: await getCoinLabel(symbol),
      timeframe: String(request.body.timeframe || "1h").toLowerCase(),
      moduleIds: request.body.modules,
      profile: request.body.profile,
      journal: request.body.journal
    });
    const marketModule = context.modules.find((module) => module.id === "market" && module.status === "ok");

    response.json({
      context,
      snapshot: marketModule?.data || null
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

app.post("/api/analyze", async (request, response) => {
  try {
    const symbol = String(request.body.symbol || "").toUpperCase();
    const user = await getAuthenticatedUser(request);

    if (!user) {
      response.json({
        ok: false,
        provider: null,
        model: null,
        annotations: [],
        analysis: "AI 분석은 로그인 후 계정에 저장한 GPT 또는 Gemini 키가 있을 때만 사용할 수 있습니다."
      });
      return;
    }

    const profile = await getUserProfile(user.id);
    const manualAnnotations = Array.isArray(request.body.manualAnnotations) ? request.body.manualAnnotations : [];
    const focusRegion = normalizeFocusRegionPayload(request.body.focusRegion);
    const context = await moduleContext.collect({
      symbol,
      label: await getCoinLabel(symbol),
      timeframe: String(request.body.timeframe || "1h").toLowerCase(),
      moduleIds: request.body.modules,
      profile: request.body.profile,
      journal: request.body.journal
    });
    const analysisContext = {
      ...context,
      manualAnnotations,
      focusRegion
    };
    const extraSections = [];
    const marketModule = context.modules.find((module) => module.id === "market" && module.status === "ok");
    if (focusRegion && marketModule?.data) {
      extraSections.push(buildFocusRegionPromptSection(marketModule.data, focusRegion));
    }
    const promptSections = [moduleContext.buildPromptSections(analysisContext), ...extraSections].filter(Boolean).join("\n\n");
    const result = await analyzeContext(analysisContext, promptSections, {
      provider: request.body.provider,
      credentials: {
        provider: profile?.ai_provider,
        openAiKey: profile?.openai_api_key,
        openAiModel: profile?.openai_model,
        geminiKey: profile?.gemini_api_key,
        geminiModel: profile?.gemini_model
      },
      useEnvFallback: false
    });
    const responsePayload = {
      context,
      snapshot: marketModule?.data || null,
      ...result
    };

    await insertAnalysisHistory(user.id, {
      symbol,
      timeframe: String(request.body.timeframe || "1h").toLowerCase(),
      provider: result.provider,
      model: result.model,
      manualAnnotations,
      aiAnnotations: result.annotations,
      snapshot: marketModule?.data || null,
      context,
      analysis: result.analysis
    });

    response.json(responsePayload);
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

function startServer(port = Number(process.env.PORT || 3000)) {
  return app.listen(port, () => {
    console.log(`coin-ai-briefing listening on http://localhost:${port}`);
  });
}

module.exports = app;
module.exports.startServer = startServer;
