const { spawn } = require("node:child_process");

const port = Number(process.env.PORT || 3310);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
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
  const child = spawn(process.execPath, ["src/server.js"], {
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
    const market = await fetchJson("/api/market/BTC");
    const analyze = await postJson("/api/analyze", {
      symbol: "BTC",
      modules: ["market", "profile", "journal"],
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

    console.log(
      JSON.stringify(
        {
          health,
          coinsCount: coins.coins.length,
          modules: modules.modules.map((module) => module.id),
          market: {
            symbol: market.symbol,
            premiumPct: market.premiumPct,
            bithumbPriceKrw: market.bithumb.priceKrw,
            benchmarkPriceKrw: market.benchmark.priceKrw
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
