const BITHUMB_BASE_URL = "https://api.bithumb.com/public";
const BINANCE_BASE_URL = "https://api.binance.com/api/v3";

const SUPPORTED_COINS = [
  { symbol: "BTC", label: "Bitcoin" },
  { symbol: "ETH", label: "Ethereum" },
  { symbol: "XRP", label: "XRP" },
  { symbol: "SOL", label: "Solana" },
  { symbol: "DOGE", label: "Dogecoin" },
  { symbol: "ADA", label: "Cardano" }
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
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/orderbook/${symbol}_KRW?count=5`);

  if (payload.status !== "0000") {
    throw new Error(`Bithumb orderbook error for ${symbol}: ${payload.status}`);
  }

  return payload.data;
}

async function fetchBithumbCandles(symbol) {
  const payload = await fetchJson(`${BITHUMB_BASE_URL}/candlestick/${symbol}_KRW/1h`);

  if (payload.status !== "0000") {
    return [];
  }

  return payload.data.slice(-24).map((entry) => ({
    timestamp: Number(entry[0]),
    open: Number(entry[1]),
    close: Number(entry[2]),
    high: Number(entry[3]),
    low: Number(entry[4]),
    volume: Number(entry[5])
  }));
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

function assertSupported(symbol) {
  if (!SUPPORTED_COINS.some((coin) => coin.symbol === symbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }
}

async function getMarketSnapshot(symbol) {
  assertSupported(symbol);

  const [bithumbTicker, bithumbOrderbook, usdtKrw, binanceTicker, binanceBookTicker, candles] =
    await Promise.all([
      fetchBithumbTicker(symbol),
      fetchBithumbOrderbook(symbol),
      fetchUsdtKrwRate(),
      fetchBinanceTicker(symbol),
      fetchBinanceBookTicker(symbol),
      fetchBithumbCandles(symbol)
    ]);

  const bithumbPriceKrw = toNumber(bithumbTicker.closing_price);
  const benchmarkPriceUsdt = toNumber(binanceTicker.lastPrice);
  const benchmarkPriceKrw = benchmarkPriceUsdt * usdtKrw;
  const premiumPct = ((bithumbPriceKrw - benchmarkPriceKrw) / benchmarkPriceKrw) * 100;

  return {
    symbol,
    label: SUPPORTED_COINS.find((coin) => coin.symbol === symbol)?.label ?? symbol,
    fetchedAt: new Date().toISOString(),
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
      bidKrw: toNumber(bithumbOrderbook.bids?.[0]?.price ?? 0),
      askKrw: toNumber(bithumbOrderbook.asks?.[0]?.price ?? 0)
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
    candles
  };
}

module.exports = {
  getMarketSnapshot,
  getSupportedCoins
};
