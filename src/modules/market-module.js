const { getMarketSnapshot } = require("../market");

function formatNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

module.exports = {
  id: "market",
  label: "시장 데이터",
  description: "빗썸 현물 가격과 바이낸스 글로벌 기준 가격을 비교합니다.",
  required: true,
  defaultEnabled: true,
  async collect(input) {
    const snapshot = await getMarketSnapshot(input.symbol, {
      timeframe: input.timeframe
    });

    return {
      summary: `${snapshot.symbol} 빗썸 현재가 ${formatNumber(snapshot.bithumb.priceKrw)} KRW, 글로벌 환산가 ${formatNumber(snapshot.benchmark.priceKrw)} KRW, 차이 ${snapshot.premiumPct.toFixed(2)}%`,
      data: snapshot
    };
  },
  formatForPrompt(snapshot) {
    return `
[시장 데이터]
- 종목: ${snapshot.symbol} (${snapshot.label})
- 조회 시각: ${snapshot.fetchedAt}
- 차트 타임프레임: ${snapshot.timeframe}
- 빗썸 현재가(KRW): ${snapshot.bithumb.priceKrw}
- 빗썸 24시간 등락률(%): ${snapshot.bithumb.change24hPct}
- 빗썸 24시간 거래량: ${snapshot.bithumb.volume24h}
- 빗썸 24시간 거래대금(KRW): ${snapshot.bithumb.value24hKrw}
- 빗썸 최우선 호가(KRW): ${snapshot.bithumb.bidKrw} / ${snapshot.bithumb.askKrw}
- 빗썸 호가 스프레드(KRW): ${snapshot.orderbook.spreadKrw}
- 빗썸 호가 잔량 합계(매수/매도): ${snapshot.orderbook.totalBidUnits} / ${snapshot.orderbook.totalAskUnits}
- 글로벌 기준 거래소: ${snapshot.benchmark.exchange}
- 글로벌 현재가(USDT): ${snapshot.benchmark.priceUsdt}
- 글로벌 KRW 환산가: ${snapshot.benchmark.priceKrw}
- 글로벌 24시간 등락률(%): ${snapshot.benchmark.change24hPct}
- 글로벌 최우선 호가(USDT): ${snapshot.benchmark.bidUsdt} / ${snapshot.benchmark.askUsdt}
- USDT/KRW 추정치: ${snapshot.usdtKrw}
- 가격 차이(%): ${snapshot.premiumPct}
- 최근 체결 10건:
${snapshot.recentTrades
  .slice(0, 10)
  .map(
    (trade) =>
      `  - ${trade.timestamp} | ${trade.side} | P:${trade.priceKrw} Q:${trade.quantity} V:${trade.valueKrw}`
  )
  .join("\n")}
- 최근 캔들:
${snapshot.candles
  .map(
    (candle) =>
      `  - ${new Date(candle.timestamp).toISOString()} | O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`
  )
  .join("\n")}
`.trim();
  }
};
