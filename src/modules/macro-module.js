const { getIntelligenceSnapshot } = require("../intelligence");

function getSharedIntelligence(input) {
  if (!input.__intelligencePromise) {
    input.__intelligencePromise = getIntelligenceSnapshot(input.symbol, input.label);
  }

  return input.__intelligencePromise;
}

module.exports = {
  id: "macro",
  label: "매크로 통계",
  description: "바이낸스 파생 통계와 글로벌 도미넌스 데이터를 수집합니다.",
  required: false,
  defaultEnabled: true,
  async collect(input) {
    const snapshot = await getSharedIntelligence(input);

    return {
      summary: `BTC 도미넌스 ${snapshot.macroStats.btcDominancePct.toFixed(2)}%, 바이낸스 24h 거래대금 ${snapshot.binanceStats.quoteVolume24hUsdt.toFixed(0)} USDT`,
      data: {
        fetchedAt: snapshot.fetchedAt,
        binanceStats: snapshot.binanceStats,
        macroStats: snapshot.macroStats
      }
    };
  },
  formatForPrompt(data) {
    return `
[매크로 통계]
- 수집 시각: ${data.fetchedAt}
- BTC 도미넌스(%): ${data.macroStats.btcDominancePct}
- ETH 도미넌스(%): ${data.macroStats.ethDominancePct}
- 전체 시총(USD): ${data.macroStats.totalMarketCapUsd}
- 전체 거래대금(USD): ${data.macroStats.totalVolumeUsd}
- 활성 코인 수: ${data.macroStats.activeCryptocurrencies}
- 바이낸스 24h 거래대금(USDT): ${data.binanceStats.quoteVolume24hUsdt}
- 바이낸스 24h 체결 수: ${data.binanceStats.tradeCount24h}
- 바이낸스 평균 체결 금액(USDT): ${data.binanceStats.avgTradeValueUsdt}
- 바이낸스 6h 모멘텀(%): ${data.binanceStats.momentum6hPct}
- 바이낸스 24h 모멘텀(%): ${data.binanceStats.momentum24hPct}
- 바이낸스 일중 변동폭(%): ${data.binanceStats.intradayRangePct}
`.trim();
  }
};
