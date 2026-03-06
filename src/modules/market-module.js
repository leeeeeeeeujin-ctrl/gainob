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
      summary: `${snapshot.symbol} 바이낸스 현재가 ${formatNumber(snapshot.primary.priceUsdt)} USDT, 빗썸 비교 ${snapshot.local.available ? `${formatNumber(snapshot.local.priceKrw)} KRW / 괴리 ${snapshot.local.premiumPct.toFixed(2)}%` : "미지원"}`,
      data: snapshot
    };
  },
  formatForPrompt(snapshot) {
    return `
[시장 데이터]
- 종목: ${snapshot.symbol} (${snapshot.label})
- 조회 시각: ${snapshot.fetchedAt}
- 차트 타임프레임: ${snapshot.timeframe}
- 메인 거래소: ${snapshot.primary.exchange}
- 메인 현재가(USDT): ${snapshot.primary.priceUsdt}
- 메인 KRW 환산가: ${snapshot.primary.priceKrw}
- 메인 24시간 등락률(%): ${snapshot.primary.change24hPct}
- 메인 24시간 거래량: ${snapshot.primary.volume24h}
- 메인 24시간 거래대금(USDT): ${snapshot.primary.quoteVolume24hUsdt}
- 메인 최우선 호가(USDT): ${snapshot.primary.bidUsdt} / ${snapshot.primary.askUsdt}
- 메인 호가 스프레드(USDT): ${snapshot.orderbook.spreadUsdt}
- 메인 호가 잔량 합계(매수/매도): ${snapshot.orderbook.totalBidUnits} / ${snapshot.orderbook.totalAskUnits}
- 빗썸 비교 가능 여부: ${snapshot.local.available ? "가능" : "불가"}
- 빗썸 현재가(KRW): ${snapshot.local.priceKrw}
- 빗썸 24시간 등락률(%): ${snapshot.local.change24hPct}
- USDT/KRW 추정치: ${snapshot.usdtKrw}
- 가격 차이(%): ${snapshot.comparison.premiumPct}
- 최근 체결 10건:
${snapshot.recentTrades
  .slice(0, 10)
  .map(
    (trade) =>
      `  - ${trade.timestamp} | ${trade.side} | P:${trade.priceUsdt} Q:${trade.quantity} V:${trade.valueUsdt}`
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
