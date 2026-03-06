const BITHUMB_BASE_URL = "https://api.bithumb.com/public";
const BINANCE_BASE_URL = "https://data-api.binance.vision/api/v3";

const DEFAULT_COINS = [
  { symbol: "BTC", pair: "BTCUSDT", label: "BTC", localSupported: true },
  { symbol: "ETH", pair: "ETHUSDT", label: "ETH", localSupported: true },
  { symbol: "XRP", pair: "XRPUSDT", label: "XRP", localSupported: true },
  { symbol: "SOL", pair: "SOLUSDT", label: "SOL", localSupported: true },
  { symbol: "DOGE", pair: "DOGEUSDT", label: "DOGE", localSupported: true },
  { symbol: "ADA", pair: "ADAUSDT", label: "ADA", localSupported: true }
];

const SUPPORTED_TIMEFRAMES = [
  { id: "15m", label: "15분", binanceInterval: "15m", candleLimit: 800 },
  { id: "1h", label: "1시간", binanceInterval: "1h", candleLimit: 1000 },
  { id: "4h", label: "4시간", binanceInterval: "4h", candleLimit: 1000 },
  { id: "1d", label: "일봉", binanceInterval: "1d", candleLimit: 1000 },
  { id: "1w", label: "주봉", binanceInterval: "1w", candleLimit: 520 }
];

const coinCache = {
  coins: DEFAULT_COINS,
  expiresAt: 0
};

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

function toNumber(value) {
  return Number(value || 0);
}

function getTimeframeConfig(timeframeId = "1h") {
  return SUPPORTED_TIMEFRAMES.find((timeframe) => timeframe.id === timeframeId) || SUPPORTED_TIMEFRAMES[1];
}

async function fetchBinanceExchangeInfo() {
  return fetchJson(`${BINANCE_BASE_URL}/exchangeInfo`);
}

async function fetchBinanceTickers() {
  return fetchJson(`${BINANCE_BASE_URL}/ticker/24hr`);
}

async function fetchBinanceTicker(pair) {
  return fetchJson(`${BINANCE_BASE_URL}/ticker/24hr?symbol=${pair}`);
}

async function fetchBinanceBookTicker(pair) {
  return fetchJson(`${BINANCE_BASE_URL}/ticker/bookTicker?symbol=${pair}`);
}

async function fetchBinanceOrderbook(pair) {
  return fetchJson(`${BINANCE_BASE_URL}/depth?symbol=${pair}&limit=20`);
}

async function fetchBinanceTrades(pair) {
  return fetchJson(`${BINANCE_BASE_URL}/trades?symbol=${pair}&limit=30`);
}

async function fetchBinanceKlines(pair, timeframe) {
  return fetchJson(
    `${BINANCE_BASE_URL}/klines?symbol=${pair}&interval=${timeframe.binanceInterval}&limit=${timeframe.candleLimit}`
  );
}

async function fetchBithumbTicker(symbol) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/ticker/${symbol}_KRW`);

  if (payload.status !== "0000") {
    throw new Error(`Bithumb ticker error for ${symbol}: ${payload.status}`);
  }

  return payload.data;
}

async function fetchBithumbOrderbook(symbol) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/orderbook/${symbol}_KRW?count=10`);

  if (payload.status !== "0000") {
    throw new Error(`Bithumb orderbook error for ${symbol}: ${payload.status}`);
  }

  return payload.data;
}

async function fetchUsdtKrwRate() {
  const ticker = await fetchBithumbTicker("USDT");
  return Number(ticker.closing_price);
}

function normalizeBinanceCoin(symbolInfo, tickerByPair) {
  const ticker = tickerByPair.get(symbolInfo.symbol);

  return {
    symbol: symbolInfo.baseAsset,
    pair: symbolInfo.symbol,
    label: symbolInfo.baseAsset,
    lastPriceUsdt: toNumber(ticker?.lastPrice),
    change24hPct: toNumber(ticker?.priceChangePercent),
    quoteVolume24hUsdt: toNumber(ticker?.quoteVolume),
    localSupported: DEFAULT_COINS.some((coin) => coin.symbol === symbolInfo.baseAsset)
  };
}

async function getSupportedCoins() {
  if (coinCache.expiresAt > Date.now()) {
    return coinCache.coins;
  }

  try {
    const [exchangeInfo, tickers] = await Promise.all([fetchBinanceExchangeInfo(), fetchBinanceTickers()]);
    const tickerByPair = new Map(
      tickers
        .filter((ticker) => typeof ticker.symbol === "string")
        .map((ticker) => [ticker.symbol, ticker])
    );
    const coins = (exchangeInfo.symbols || [])
      .filter(
        (symbolInfo) =>
          symbolInfo.quoteAsset === "USDT" &&
          symbolInfo.status === "TRADING" &&
          symbolInfo.isSpotTradingAllowed
      )
      .map((symbolInfo) => normalizeBinanceCoin(symbolInfo, tickerByPair))
      .sort((left, right) => right.quoteVolume24hUsdt - left.quoteVolume24hUsdt);

    coinCache.coins = coins.length ? coins : DEFAULT_COINS;
    coinCache.expiresAt = Date.now() + 10 * 60 * 1000;
  } catch (_error) {
    coinCache.coins = coinCache.coins.length ? coinCache.coins : DEFAULT_COINS;
    coinCache.expiresAt = Date.now() + 60 * 1000;
  }

  return coinCache.coins;
}

function getCachedCoins() {
  return coinCache.coins;
}

async function getCoinMeta(symbol) {
  const coins = await getSupportedCoins();
  return coins.find((coin) => coin.symbol === symbol) || getCachedCoins().find((coin) => coin.symbol === symbol) || null;
}

function getSupportedTimeframes() {
  return SUPPORTED_TIMEFRAMES.map(({ id, label }) => ({ id, label }));
}

function normalizeBinanceOrderbook(entries) {
  return (entries || []).map(([price, quantity]) => ({
    price: toNumber(price),
    quantity: toNumber(quantity),
    valueUsdt: toNumber(price) * toNumber(quantity)
  }));
}

function buildPrimaryOrderbook(orderbook) {
  const bids = normalizeBinanceOrderbook(orderbook.bids);
  const asks = normalizeBinanceOrderbook(orderbook.asks);
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;

  return {
    bids,
    asks,
    spreadUsdt: Math.max(bestAsk - bestBid, 0),
    totalBidUnits: bids.reduce((sum, level) => sum + level.quantity, 0),
    totalAskUnits: asks.reduce((sum, level) => sum + level.quantity, 0),
    totalBidValueUsdt: bids.reduce((sum, level) => sum + level.valueUsdt, 0),
    totalAskValueUsdt: asks.reduce((sum, level) => sum + level.valueUsdt, 0)
  };
}

function buildRecentTrades(trades) {
  return (trades || []).map((trade) => ({
    id: trade.id,
    timestamp: new Date(Number(trade.time)).toISOString(),
    side: trade.isBuyerMaker ? "sell" : "buy",
    priceUsdt: toNumber(trade.price),
    quantity: toNumber(trade.qty),
    valueUsdt: toNumber(trade.price) * toNumber(trade.qty)
  }));
}

function buildCandles(klines) {
  return (klines || []).map((entry) => ({
    timestamp: Number(entry[0]),
    open: toNumber(entry[1]),
    high: toNumber(entry[2]),
    low: toNumber(entry[3]),
    close: toNumber(entry[4]),
    volume: toNumber(entry[5]),
    quoteVolume: toNumber(entry[7])
  }));
}

function buildAnnotations(symbol, candles, orderbook, currentPriceUsdt) {
  if (!candles.length) {
    return [];
  }

  const visibleCandles = candles.slice(-Math.min(candles.length, 48));
  const lows = visibleCandles.map((candle) => candle.low);
  const highs = visibleCandles.map((candle) => candle.high);
  const firstCandle = visibleCandles[0];
  const lastCandle = visibleCandles.at(-1);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  const supportBand = support * 0.004;
  const resistanceBand = resistance * 0.004;
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
      reason: "최근 저점 영역 기반"
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
      reason: "최근 고점 영역 기반"
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
      price: currentPriceUsdt,
      reason: `현재가 ${currentPriceUsdt.toFixed(2)} USDT`
    }
  ];
}

function buildLocalSnapshot(symbol, bithumbTicker, bithumbOrderbook, usdtKrw, primaryPriceUsdt) {
  if (!bithumbTicker || !bithumbOrderbook) {
    return {
      exchange: "Bithumb",
      market: `${symbol}/KRW`,
      available: false,
      priceKrw: null,
      change24hPct: null,
      high24hKrw: null,
      low24hKrw: null,
      volume24h: null,
      value24hKrw: null,
      bidKrw: null,
      askKrw: null,
      premiumPct: null,
      benchmarkKrw: primaryPriceUsdt * usdtKrw
    };
  }

  const priceKrw = toNumber(bithumbTicker.closing_price);
  const benchmarkKrw = primaryPriceUsdt * usdtKrw;

  return {
    exchange: "Bithumb",
    market: `${symbol}/KRW`,
    available: true,
    priceKrw,
    change24hPct: toNumber(bithumbTicker.fluctate_rate_24H),
    high24hKrw: toNumber(bithumbTicker.max_price),
    low24hKrw: toNumber(bithumbTicker.min_price),
    volume24h: toNumber(bithumbTicker.units_traded_24H),
    value24hKrw: toNumber(bithumbTicker.acc_trade_value_24H),
    bidKrw: toNumber(bithumbOrderbook.bids?.[0]?.price ?? 0),
    askKrw: toNumber(bithumbOrderbook.asks?.[0]?.price ?? 0),
    premiumPct: ((priceKrw - benchmarkKrw) / Math.max(benchmarkKrw, 1)) * 100,
    benchmarkKrw
  };
}

async function getMarketSnapshot(symbol, options = {}) {
  const coinMeta = await getCoinMeta(symbol);

  if (!coinMeta) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  const timeframe = getTimeframeConfig(options.timeframe);
  const [binanceTicker, binanceBookTicker, binanceOrderbookRaw, binanceTradesRaw, klines, usdtKrw] =
    await Promise.all([
      fetchBinanceTicker(coinMeta.pair),
      fetchBinanceBookTicker(coinMeta.pair),
      fetchBinanceOrderbook(coinMeta.pair),
      fetchBinanceTrades(coinMeta.pair),
      fetchBinanceKlines(coinMeta.pair, timeframe),
      fetchUsdtKrwRate()
    ]);

  let bithumbTicker = null;
  let bithumbOrderbook = null;

  try {
    [bithumbTicker, bithumbOrderbook] = await Promise.all([
      fetchBithumbTicker(symbol),
      fetchBithumbOrderbook(symbol)
    ]);
  } catch (_error) {
    bithumbTicker = null;
    bithumbOrderbook = null;
  }

  const primaryPriceUsdt = toNumber(binanceTicker.lastPrice);
  const orderbook = buildPrimaryOrderbook(binanceOrderbookRaw);
  const candles = buildCandles(klines);
  const recentTrades = buildRecentTrades(binanceTradesRaw);
  const local = buildLocalSnapshot(symbol, bithumbTicker, bithumbOrderbook, usdtKrw, primaryPriceUsdt);
  const annotations = buildAnnotations(symbol, candles, orderbook, primaryPriceUsdt);

  return {
    symbol,
    pair: coinMeta.pair,
    label: coinMeta.label,
    fetchedAt: new Date().toISOString(),
    timeframe: timeframe.id,
    availableTimeframes: getSupportedTimeframes(),
    usdtKrw,
    primary: {
      exchange: "Binance",
      market: coinMeta.pair,
      priceUsdt: primaryPriceUsdt,
      priceKrw: primaryPriceUsdt * usdtKrw,
      change24hPct: toNumber(binanceTicker.priceChangePercent),
      high24hUsdt: toNumber(binanceTicker.highPrice),
      low24hUsdt: toNumber(binanceTicker.lowPrice),
      volume24h: toNumber(binanceTicker.volume),
      quoteVolume24hUsdt: toNumber(binanceTicker.quoteVolume),
      tradeCount24h: toNumber(binanceTicker.count),
      bidUsdt: toNumber(binanceBookTicker.bidPrice),
      askUsdt: toNumber(binanceBookTicker.askPrice)
    },
    local,
    comparison: {
      localSupported: local.available,
      premiumPct: local.premiumPct,
      benchmarkKrw: local.benchmarkKrw,
      usdtKrw
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
