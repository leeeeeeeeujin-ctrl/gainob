require("dotenv").config({ path: ".env", override: false });

const { spawn } = require("node:child_process");

const port = Number(process.env.SMOKE_PORT || 3310);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
let sessionCookie = "";

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: sessionCookie
      ? {
          Cookie: sessionCookie
        }
      : undefined
  });
  const setCookie = response.headers.getSetCookie?.()?.[0];

  if (setCookie) {
    sessionCookie = setCookie.split(";")[0];
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie
        ? {
            Cookie: sessionCookie
          }
        : {})
    },
    body: JSON.stringify(body)
  });
  const setCookie = response.headers.getSetCookie?.()?.[0];

  if (setCookie) {
    sessionCookie = setCookie.split(";")[0];
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetchJson("/api/health");
      return;
    } catch (_error) {
      await delay(250);
    }
  }

  throw new Error("Server did not start in time.");
}

async function main() {
  const child = spawn(process.execPath, ["src/dev-runner.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: "ignore"
  });

  try {
    await waitForServer();

    const health = await fetchJson("/api/health");
    const coins = await fetchJson("/api/coins");
    const modules = await fetchJson("/api/modules");
    const username = `smoke_${Date.now()}`;
    const register = await postJson("/api/auth/register", {
      username,
      displayName: "Smoke User",
      password: "smoke123"
    });
    const session = await fetchJson("/api/session");
    const market = await fetchJson("/api/market?symbol=BTC&timeframe=1h");
    const intelligence = await fetchJson("/api/intelligence?symbol=BTC");
    const analyze = await postJson("/api/analyze", {
      symbol: "BTC",
      modules: ["market", "macro", "news", "profile", "journal"],
      profile: {
        alias: "smoke-user",
        style: "거래량 기반 단기 스윙",
        riskRule: "급등 추격 금지",
        watchItems: "가격 괴리와 거래대금"
      },
      journal: {
        note: "스모크 테스트",
        focusQuestion: "과열 여부 확인"
      }
    });
    await postJson("/api/auth/delete-account", {
      password: "smoke123"
    });
    const sessionAfterDelete = await fetchJson("/api/session");

    console.log(
      JSON.stringify(
        {
          health,
          coinsCount: coins.coins.length,
          modules: modules.modules.map((module) => module.id),
          registeredUser: register.user.username,
          session: {
            authenticated: session.authenticated,
            serverReady: session.serverReady,
            username: session.user?.username || null
          },
          sessionAfterDelete: {
            authenticated: sessionAfterDelete.authenticated,
            username: sessionAfterDelete.user?.username || null
          },
          market: {
            symbol: market.symbol,
            premiumPct: market.premiumPct,
            bithumbPriceKrw: market.bithumb.priceKrw,
            benchmarkPriceKrw: market.benchmark.priceKrw
          },
          intelligence: {
            btcDominancePct: intelligence.macroStats.btcDominancePct,
            newsCount: intelligence.newsStats.articleCount,
            recent24hNewsCount: intelligence.newsStats.recent24hCount
          },
          analyzeOk: analyze.ok,
          contextModules: analyze.context.modules.map((module) => ({
            id: module.id,
            status: module.status
          })),
          analyzePreview: analyze.analysis.slice(0, 80)
        },
        null,
        2
      )
    );
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
