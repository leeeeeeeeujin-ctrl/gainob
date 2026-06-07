const DAY_MS = 24 * 60 * 60 * 1000;

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function point(timestamp, value) {
  return {
    timestamp: new Date(timestamp).toISOString(),
    value: round(value, 4)
  };
}

function buildSeries({ days = 180, start, drift = 0, wave = 1, noise = 0 }) {
  const now = Date.now();

  return Array.from({ length: days }, (_, index) => {
    const progress = index / Math.max(days - 1, 1);
    const cyclic = Math.sin(progress * Math.PI * 4) * wave;
    const shorterCycle = Math.cos(progress * Math.PI * 11) * noise;
    const value = start + drift * progress + cyclic + shorterCycle;

    return point(now - (days - index - 1) * DAY_MS, value);
  });
}

function latest(series) {
  return series.at(-1)?.value ?? null;
}

function movingAverage(series, window) {
  const values = series.slice(-window).map((item) => item.value);
  if (!values.length) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 4);
}

function changePct(series, periods) {
  const current = latest(series);
  const previous = series.at(-1 - periods)?.value;

  if (current === null || previous === undefined || previous === 0) {
    return null;
  }

  return round(((current - previous) / previous) * 100, 2);
}

function classifyRotation(current, ma20, ma50, ma200) {
  if ([current, ma20, ma50, ma200].some((value) => value === null || value === undefined)) {
    return "Neutral";
  }

  if (current > ma20 && ma20 > ma50 && ma50 > ma200) {
    return "Bullish";
  }

  if (current < ma20 && ma20 < ma50 && ma50 < ma200) {
    return "Bearish";
  }

  return "Neutral";
}

function buildMetric({ id, label, unit, series, description }) {
  return {
    id,
    label,
    unit,
    current: latest(series),
    changes: {
      "1d": changePct(series, 1),
      "1w": changePct(series, 7),
      "1m": changePct(series, 30),
      "3m": changePct(series, 90)
    },
    description,
    series
  };
}

function buildRotation({ id, label, unit, series }) {
  const current = latest(series);
  const ma20 = movingAverage(series, 20);
  const ma50 = movingAverage(series, 50);
  const ma200 = movingAverage(series, 200);

  return {
    id,
    label,
    unit,
    current,
    ma20,
    ma50,
    ma200,
    status: classifyRotation(current, ma20, ma50, ma200),
    series
  };
}

function buildFlow({ id, label, unit, series, description }) {
  const current = latest(series);
  const sum30d = round(series.slice(-30).reduce((sum, item) => sum + item.value, 0), 2);
  const sum90d = round(series.slice(-90).reduce((sum, item) => sum + item.value, 0), 2);

  return {
    id,
    label,
    unit,
    current,
    sum30d,
    sum90d,
    description,
    series
  };
}

function buildCapitalFlowSummary({ btcDominance, ethBtc, solEth, stablecoinCap, btcEtfFlow, ethEtfFlow }) {
  const lines = [];
  const btcDomChange = btcDominance.changes["1m"];
  const stableCapChange = stablecoinCap.changes["1m"];

  if (btcDomChange !== null) {
    lines.push(`BTC Dominance는 1개월 기준 ${btcDomChange >= 0 ? "상승" : "하락"} 중입니다.`);
  }

  lines.push(`ETH/BTC는 ${ethBtc.status === "Bullish" ? "강세" : ethBtc.status === "Bearish" ? "약세" : "중립"} 구조입니다.`);
  lines.push(`SOL/ETH는 ${solEth.status === "Bullish" ? "강세" : solEth.status === "Bearish" ? "약세" : "중립"} 구조입니다.`);

  if (stableCapChange !== null) {
    lines.push(`Stablecoin Market Cap은 1개월 기준 ${stableCapChange >= 0 ? "증가" : "감소"}했습니다.`);
  }

  const btcEtfTone = btcEtfFlow.sum30d > 0 ? "순유입" : btcEtfFlow.sum30d < 0 ? "순유출" : "중립";
  const ethEtfTone = ethEtfFlow.sum30d > 0 ? "순유입" : ethEtfFlow.sum30d < 0 ? "순유출" : "중립";
  lines.push(`BTC ETF 30일 흐름은 ${btcEtfTone}, ETH ETF 30일 흐름은 ${ethEtfTone}입니다.`);

  const interpretation =
    stableCapChange > 0 && ethBtc.status === "Bullish"
      ? "현재 구조는 현금성 유동성 확대와 ETH 상대강도 회복을 함께 점검하는 국면으로 해석됩니다."
      : stableCapChange > 0
        ? "현재 구조는 유동성은 개선되지만 알트 확산 신호는 아직 제한적인 국면으로 해석됩니다."
        : "현재 구조는 신규 유동성 확대보다 관망과 방어적 자금 흐름을 우선 점검하는 국면으로 해석됩니다.";

  lines.push(interpretation);

  return lines;
}

/**
 * LiquidityDashboardProvider contract.
 *
 * Future real providers should implement:
 * - getBTCDominance()
 * - getETHBTC()
 * - getSOLETH()
 * - getStablecoinMarketCap()
 * - getETFNetFlow(asset: "BTC" | "ETH")
 */
function createMockLiquidityDashboardProvider() {
  return {
    async getBTCDominance() {
      return buildSeries({ days: 210, start: 52.8, drift: -1.4, wave: 0.85, noise: 0.2 });
    },
    async getETHBTC() {
      return buildSeries({ days: 210, start: 0.050, drift: -0.004, wave: 0.002, noise: 0.0008 });
    },
    async getSOLETH() {
      return buildSeries({ days: 210, start: 2.55, drift: 0.25, wave: 0.18, noise: 0.05 });
    },
    async getStablecoinMarketCap() {
      return buildSeries({ days: 210, start: 154_000_000_000, drift: 9_500_000_000, wave: 1_600_000_000, noise: 450_000_000 });
    },
    async getETFNetFlow(asset) {
      const isBtc = asset === "BTC";
      return buildSeries({
        days: 180,
        start: isBtc ? 95_000_000 : 18_000_000,
        drift: isBtc ? 35_000_000 : -12_000_000,
        wave: isBtc ? 140_000_000 : 42_000_000,
        noise: isBtc ? 35_000_000 : 14_000_000
      });
    }
  };
}

async function buildLiquidityDashboardSnapshot(provider = createMockLiquidityDashboardProvider()) {
  const [btcDominanceSeries, ethBtcSeries, solEthSeries, stablecoinCapSeries, btcEtfSeries, ethEtfSeries] =
    await Promise.all([
      provider.getBTCDominance(),
      provider.getETHBTC(),
      provider.getSOLETH(),
      provider.getStablecoinMarketCap(),
      provider.getETFNetFlow("BTC"),
      provider.getETFNetFlow("ETH")
    ]);

  const btcDominance = buildMetric({
    id: "btc-dominance",
    label: "BTC Dominance",
    unit: "%",
    series: btcDominanceSeries,
    description: "전체 암호화폐 시가총액 중 BTC 비중"
  });
  const stablecoinCap = buildMetric({
    id: "stablecoin-market-cap",
    label: "Stablecoin Market Cap",
    unit: "USD",
    series: stablecoinCapSeries,
    description: "시장에 남아 있는 현금성 암호화폐 유동성"
  });
  const ethBtc = buildRotation({ id: "eth-btc", label: "ETH/BTC", unit: "ratio", series: ethBtcSeries });
  const solEth = buildRotation({ id: "sol-eth", label: "SOL/ETH", unit: "ratio", series: solEthSeries });
  const btcEtfFlow = buildFlow({
    id: "btc-etf-net-flow",
    label: "BTC ETF Net Flow",
    unit: "USD/day",
    series: btcEtfSeries,
    description: "Mock daily net creation/redemption flow"
  });
  const ethEtfFlow = buildFlow({
    id: "eth-etf-net-flow",
    label: "ETH ETF Net Flow",
    unit: "USD/day",
    series: ethEtfSeries,
    description: "Mock daily net creation/redemption flow"
  });

  return {
    asOf: new Date().toISOString(),
    provider: {
      id: "mock",
      name: "Mock Liquidity Dashboard Provider",
      mode: "mock",
      note: "MVP uses deterministic mock data. Replace this provider with public data providers later."
    },
    scope: {
      purpose: "briefing",
      excludes: ["price_prediction", "trade_signal"]
    },
    marketRegime: [btcDominance],
    cycleRotation: [ethBtc, solEth],
    cryptoLiquidity: [stablecoinCap],
    etfFlows: [btcEtfFlow, ethEtfFlow],
    capitalFlowSummary: buildCapitalFlowSummary({
      btcDominance,
      ethBtc,
      solEth,
      stablecoinCap,
      btcEtfFlow,
      ethEtfFlow
    })
  };
}

module.exports = {
  buildLiquidityDashboardSnapshot,
  createMockLiquidityDashboardProvider
};
