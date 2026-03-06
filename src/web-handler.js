const express = require("express");
const path = require("path");
const { analyzeContext } = require("./ai");
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
const { getDatabaseStatus, query } = require("./db");
const { getIntelligenceSnapshot } = require("./intelligence");
const { createModuleContext } = require("./core/module-context");
const { getMarketSnapshot, getMultiTimeframeMarketPacket, getSupportedCoins, getSupportedTimeframes } = require("./market");
const modules = require("./modules");

const moduleContext = createModuleContext(modules);
const app = express();

async function getCoinLabel(symbol) {
  const coins = await getSupportedCoins();
  return coins.find((coin) => coin.symbol === symbol)?.label || symbol;
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
      }
    ]
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

    const candles = Number(request.query.candles || 24);
    const trades = Number(request.query.trades || 20);
    const orderbookDepth = Number(request.query.orderbookDepth || 20);
    const start = request.query.start;
    const end = request.query.end;
    const payload = await buildConciseMarketSnapshot(snapshot, { candles, trades, orderbookDepth, start, end });
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

    const provider = String(request.body.provider || "auto").trim().toLowerCase();
    const openAiModel = String(request.body.openAiModel || "").trim();
    const geminiModel = String(request.body.geminiModel || "").trim();
    const openAiKey = String(request.body.openAiKey || "").trim();
    const geminiKey = String(request.body.geminiKey || "").trim();

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
      manualAnnotations
    };
    const promptSections = moduleContext.buildPromptSections(analysisContext);
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
    const marketModule = context.modules.find((module) => module.id === "market" && module.status === "ok");
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
