const BITHUMB_BASE_URL = "https://api.bithumb.com/public";
const BINANCE_BASE_URL = "https://data-api.binance.vision/api/v3";

const SUPPORTED_COINS = [
  { symbol: "BTC", label: "Bitcoin" },
  { symbol: "ETH", label: "Ethereum" },
  { symbol: "XRP", label: "XRP" },
  { symbol: "SOL", label: "Solana" },
  { symbol: "DOGE", label: "Dogecoin" },
  { symbol: "ADA", label: "Cardano" }
];

const SUPPORTED_TIMEFRAMES = [
  { id: "5m", label: "5m", bithumbInterval: "5m", candleLimit: 96 },
  { id: "30m", label: "30m", bithumbInterval: "30m", candleLimit: 72 },
  { id: "1h", label: "1h", bithumbInterval: "1h", candleLimit: 72 },
  { id: "6h", label: "6h", bithumbInterval: "6h", candleLimit: 60 }
];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchBithumbTicker(symbol) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/ticker/${symbol}_KRW`);

  if (payload.status !== "0000") {
    throw new Error(`Bithumb ticker error for ${symbol}: ${payload.status}`);
  }

  return payload.data;
}

async function fetchBithumbOrderbook(symbol) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/orderbook/${symbol}_KRW?count=15`);

  if (payload.status !== "0000") {
    throw new Error(`Bithumb orderbook error for ${symbol}: ${payload.status}`);
  }

  return payload.data;
}

async function fetchBithumbCandles(symbol, timeframe) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/candlestick/${symbol}_KRW/${timeframe.bithumbInterval}`);

  if (payload.status !== "0000") {
    return [];
  }

  return payload.data.slice(-timeframe.candleLimit).map((entry) => ({
    timestamp: Number(entry[0]),
    open: Number(entry[1]),
    close: Number(entry[2]),
    high: Number(entry[3]),
    low: Number(entry[4]),
    volume: Number(entry[5])
  }));
}

async function fetchBithumbRecentTrades(symbol) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/transaction_history/${symbol}_KRW?count=25`);

  if (payload.status !== "0000") {
    return [];
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchUsdtKrwRate() {
  const ticker = await fetchBithumbTicker("USDT");
  return Number(ticker.closing_price);
}

async function fetchBinanceTicker(symbol) {
  return fetchJson(`${BINANCE_BASE_URL}/ticker/24hr?symbol=${symbol}USDT`);
}

async function fetchBinanceBookTicker(symbol) {
  return fetchJson(`${BINANCE_BASE_URL}/ticker/bookTicker?symbol=${symbol}USDT`);
}

function toNumber(value) {
  return Number(value);
}

function getSupportedCoins() {
  return SUPPORTED_COINS;
}

function getSupportedTimeframes() {
  return SUPPORTED_TIMEFRAMES.map(({ id, label }) => ({ id, label }));
}

function assertSupported(symbol) {
  if (!SUPPORTED_COINS.some((coin) => coin.symbol === symbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }
}

function getTimeframeConfig(timeframeId = "1h") {
  return SUPPORTED_TIMEFRAMES.find((timeframe) => timeframe.id === timeframeId) || SUPPORTED_TIMEFRAMES[2];
}

function normalizeOrderbookSide(levels) {
  return (levels || []).map((level) => ({
    price: toNumber(level.price),
    quantity: toNumber(level.quantity)
  }));
}

function buildOrderbook(orderbook) {
  const bids = normalizeOrderbookSide(orderbook.bids);
  const asks = normalizeOrderbookSide(orderbook.asks);
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;

  return {
    bids,
    asks,
    spreadKrw: Math.max(bestAsk - bestBid, 0),
    totalBidUnits: bids.reduce((sum, level) => sum + level.quantity, 0),
    totalAskUnits: asks.reduce((sum, level) => sum + level.quantity, 0)
  };
}

function parseTradeTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(String(value).replace(" ", "T"));

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function buildRecentTrades(trades) {
  return trades.map((trade, index) => ({
    id: trade.cont_no || `${trade.transaction_date || "trade"}-${index}`,
    timestamp: parseTradeTimestamp(trade.transaction_date),
    side: String(trade.type || "bid").toLowerCase() === "ask" ? "sell" : "buy",
    priceKrw: toNumber(trade.price),
    quantity: toNumber(trade.units_traded),
    valueKrw: toNumber(trade.total)
  }));
}

function buildAnnotations(symbol, candles, orderbook, bithumbPriceKrw) {
  if (!candles.length) {
    return [];
  }

  const visibleCandles = candles.slice(-Math.min(candles.length, 32));
  const lows = visibleCandles.map((candle) => candle.low);
  const highs = visibleCandles.map((candle) => candle.high);
  const firstCandle = visibleCandles[0];
  const lastCandle = visibleCandles.at(-1);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  const supportBand = support * 0.003;
  const resistanceBand = resistance * 0.003;
  const bidPressureRatio = orderbook.totalBidUnits / Math.max(orderbook.totalAskUnits, 0.0001);
  const pressureLabel =
    bidPressureRatio >= 1.15
      ? "매수 호가 우위"
      : bidPressureRatio <= 0.87
        ? "매도 호가 우위"
        : "호가 균형";

  return [
    {
      id: `${symbol}-support`,
      type: "zone",
      label: "단기 지지 구간",
      color: "rgba(18, 160, 120, 0.16)",
      lineColor: "rgba(18, 160, 120, 0.72)",
      startTime: firstCandle.timestamp,
      endTime: lastCandle.timestamp,
      minPrice: Math.max(support - supportBand, 0),
      maxPrice: support + supportBand,
      reason: "최근 캔들 저점 묶음 기반"
    },
    {
      id: `${symbol}-resistance`,
      type: "zone",
      label: "단기 저항 구간",
      color: "rgba(210, 72, 63, 0.14)",
      lineColor: "rgba(210, 72, 63, 0.72)",
      startTime: firstCandle.timestamp,
      endTime: lastCandle.timestamp,
      minPrice: Math.max(resistance - resistanceBand, 0),
      maxPrice: resistance + resistanceBand,
      reason: "최근 캔들 고점 묶음 기반"
    },
    {
      id: `${symbol}-trend`,
      type: "line",
      label: "단기 추세선",
      color: "#0ea5a0",
      from: {
        time: firstCandle.timestamp,
        price: firstCandle.close
      },
      to: {
        time: lastCandle.timestamp,
        price: lastCandle.close
      },
      reason: "표시 구간 시작과 종료 종가 연결"
    },
    {
      id: `${symbol}-price`,
      type: "marker",
      label: `${pressureLabel} · 현재가`,
      color: bidPressureRatio >= 1 ? "#0ea5a0" : "#d2483f",
      time: lastCandle.timestamp,
      price: bithumbPriceKrw,
      reason: `현재가 ${Math.round(bithumbPriceKrw).toLocaleString("ko-KR")} KRW`
    }
  ];
}

async function getMarketSnapshot(symbol, options = {}) {
  assertSupported(symbol);
  const timeframe = getTimeframeConfig(options.timeframe);

  const [bithumbTicker, bithumbOrderbookRaw, bithumbRecentTradesRaw, usdtKrw, binanceTicker, binanceBookTicker, candles] =
    await Promise.all([
      fetchBithumbTicker(symbol),
      fetchBithumbOrderbook(symbol),
      fetchBithumbRecentTrades(symbol),
      fetchUsdtKrwRate(),
      fetchBinanceTicker(symbol),
      fetchBinanceBookTicker(symbol),
      fetchBithumbCandles(symbol, timeframe)
    ]);

  const bithumbPriceKrw = toNumber(bithumbTicker.closing_price);
  const benchmarkPriceUsdt = toNumber(binanceTicker.lastPrice);
  const benchmarkPriceKrw = benchmarkPriceUsdt * usdtKrw;
  const premiumPct = ((bithumbPriceKrw - benchmarkPriceKrw) / benchmarkPriceKrw) * 100;
  const orderbook = buildOrderbook(bithumbOrderbookRaw);
  const recentTrades = buildRecentTrades(bithumbRecentTradesRaw);
  const annotations = buildAnnotations(symbol, candles, orderbook, bithumbPriceKrw);

  return {
    symbol,
    label: SUPPORTED_COINS.find((coin) => coin.symbol === symbol)?.label ?? symbol,
    fetchedAt: new Date().toISOString(),
    timeframe: timeframe.id,
    availableTimeframes: getSupportedTimeframes(),
    usdtKrw,
    premiumPct,
    bithumb: {
      exchange: "Bithumb",
      market: `${symbol}/KRW`,
      priceKrw: bithumbPriceKrw,
      change24hPct: toNumber(bithumbTicker.fluctate_rate_24H),
      high24hKrw: toNumber(bithumbTicker.max_price),
      low24hKrw: toNumber(bithumbTicker.min_price),
      volume24h: toNumber(bithumbTicker.units_traded_24H),
      value24hKrw: toNumber(bithumbTicker.acc_trade_value_24H),
      bidKrw: orderbook.bids[0]?.price || 0,
      askKrw: orderbook.asks[0]?.price || 0
    },
    benchmark: {
      exchange: "Binance",
      market: `${symbol}/USDT`,
      priceUsdt: benchmarkPriceUsdt,
      priceKrw: benchmarkPriceKrw,
      change24hPct: toNumber(binanceTicker.priceChangePercent),
      high24hUsdt: toNumber(binanceTicker.highPrice),
      low24hUsdt: toNumber(binanceTicker.lowPrice),
      volume24h: toNumber(binanceTicker.volume),
      quoteVolume24hUsdt: toNumber(binanceTicker.quoteVolume),
      bidUsdt: toNumber(binanceBookTicker.bidPrice),
      askUsdt: toNumber(binanceBookTicker.askPrice)
    },
    orderbook,
    recentTrades,
    annotations,
    candles
  };
}

module.exports = {
  getMarketSnapshot,
  getSupportedCoins,
  getSupportedTimeframes
};
