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
const { getMarketSnapshot, getSupportedCoins, getSupportedTimeframes } = require("./market");
const modules = require("./modules");

const moduleContext = createModuleContext(modules);
const app = express();

async function getCoinLabel(symbol) {
  const coins = await getSupportedCoins();
  return coins.find((coin) => coin.symbol === symbol)?.label || symbol;
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

app.get("/api/session", async (request, response) => {
  const database = await getDatabaseStatus();
  const user = database.connected ? await getAuthenticatedUser(request) : null;

  response.json({
    authenticated: Boolean(user),
    provider: "internal",
    user,
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
    const context = await moduleContext.collect({
      symbol,
      label: await getCoinLabel(symbol),
      timeframe: String(request.body.timeframe || "1h").toLowerCase(),
      moduleIds: request.body.modules,
      profile: request.body.profile,
      journal: request.body.journal
    });
    const promptSections = moduleContext.buildPromptSections(context);
    const result = await analyzeContext(context, promptSections);
    const marketModule = context.modules.find((module) => module.id === "market" && module.status === "ok");

    response.json({
      context,
      snapshot: marketModule?.data || null,
      ...result
    });
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
