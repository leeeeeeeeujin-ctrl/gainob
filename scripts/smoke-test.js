const baseUrl = process.env.BASE_URL || "http://localhost:3000";

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

async function main() {
  const health = await fetchJson("/api/health");
  const coins = await fetchJson("/api/coins");
  const market = await fetchJson("/api/market/BTC");
  const analyze = await postJson("/api/analyze", {
    symbol: "BTC",
    note: "스모크 테스트"
  });

  console.log(JSON.stringify({
    health,
    coinsCount: coins.coins.length,
    market: {
      symbol: market.symbol,
      premiumPct: market.premiumPct,
      bithumbPriceKrw: market.bithumb.priceKrw,
      benchmarkPriceKrw: market.benchmark.priceKrw
    },
    analyzeOk: analyze.ok,
    analyzePreview: analyze.analysis.slice(0, 80)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
