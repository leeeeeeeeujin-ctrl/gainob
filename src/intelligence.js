const BINANCE_BASE_URL = "https://api.binance.com/api/v3";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const GDELT_BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

const SYMBOL_QUERY_HINTS = {
  BTC: "Bitcoin OR BTC",
  ETH: "Ethereum OR ETH",
  XRP: "XRP OR Ripple",
  SOL: "Solana OR SOL",
  DOGE: "Dogecoin OR DOGE",
  ADA: "Cardano OR ADA"
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

function buildNewsQuery(symbol, label) {
  const hint = SYMBOL_QUERY_HINTS[symbol] || `${label || symbol} OR ${symbol}`;
  return encodeURIComponent(`(${hint}) AND (crypto OR cryptocurrency OR blockchain)`);
}

async function fetchBinanceTicker(symbol) {
  return fetchJson(`${BINANCE_BASE_URL}/ticker/24hr?symbol=${symbol}USDT`);
}

async function fetchBinanceKlines(symbol) {
  return fetchJson(`${BINANCE_BASE_URL}/klines?symbol=${symbol}USDT&interval=1h&limit=24`);
}

async function fetchGlobalSnapshot() {
  return fetchJson(`${COINGECKO_BASE_URL}/global`);
}

async function fetchNewsArticles(symbol, label) {
  const query = buildNewsQuery(symbol, label);
  const url = `${GDELT_BASE_URL}?query=${query}&mode=ArtList&maxrecords=15&sort=datedesc&format=json`;
  const payload = await fetchJson(url);

  return Array.isArray(payload.articles) ? payload.articles : [];
}

function summarizeBinanceTicker(ticker, klines) {
  const hourlyCandles = klines.map((entry) => ({
    openTime: Number(entry[0]),
    open: toNumber(entry[1]),
    high: toNumber(entry[2]),
    low: toNumber(entry[3]),
    close: toNumber(entry[4]),
    volume: toNumber(entry[5])
  }));

  const latestClose = hourlyCandles.at(-1)?.close || toNumber(ticker.lastPrice);
  const close6hAgo = hourlyCandles.at(-7)?.close || latestClose;
  const close24hAgo = hourlyCandles.at(0)?.open || latestClose;
  const hourlyHigh = Math.max(...hourlyCandles.map((candle) => candle.high), latestClose);
  const hourlyLow = Math.min(...hourlyCandles.map((candle) => candle.low), latestClose);

  return {
    exchange: "Binance",
    market: ticker.symbol,
    lastPriceUsdt: toNumber(ticker.lastPrice),
    change24hPct: toNumber(ticker.priceChangePercent),
    high24hUsdt: toNumber(ticker.highPrice),
    low24hUsdt: toNumber(ticker.lowPrice),
    quoteVolume24hUsdt: toNumber(ticker.quoteVolume),
    tradeCount24h: toNumber(ticker.count),
    avgTradeValueUsdt: toNumber(ticker.quoteVolume) / Math.max(toNumber(ticker.count), 1),
    range24hPct:
      ((toNumber(ticker.highPrice) - toNumber(ticker.lowPrice)) / Math.max(toNumber(ticker.lowPrice), 1)) * 100,
    momentum6hPct: ((latestClose - close6hAgo) / Math.max(close6hAgo, 1)) * 100,
    momentum24hPct: ((latestClose - close24hAgo) / Math.max(close24hAgo, 1)) * 100,
    intradayRangePct: ((hourlyHigh - hourlyLow) / Math.max(hourlyLow, 1)) * 100
  };
}

function summarizeGlobal(payload) {
  const data = payload.data || {};
  const marketCapPercentage = data.market_cap_percentage || {};
  const totalMarketCapUsd = toNumber(data.total_market_cap?.usd);
  const totalVolumeUsd = toNumber(data.total_volume?.usd);

  return {
    activeCryptocurrencies: toNumber(data.active_cryptocurrencies),
    markets: toNumber(data.markets),
    totalMarketCapUsd,
    totalVolumeUsd,
    btcDominancePct: toNumber(marketCapPercentage.btc),
    ethDominancePct: toNumber(marketCapPercentage.eth),
    marketCapChange24hUsd: toNumber(data.market_cap_change_percentage_24h_usd)
  };
}

function summarizeNews(articles) {
  const now = Date.now();
  const normalized = articles.map((article) => {
    const publishedAt = article.seendate || article.socialimage || article.date || null;
    const publishedTime = publishedAt ? Date.parse(publishedAt) : null;

    return {
      title: article.title || "",
      url: article.url || "",
      domain: article.domain || article.sourceCommonName || "unknown",
      language: article.language || "unknown",
      sourceCountry: article.sourcecountry || "unknown",
      tone: toNumber(article.tone),
      publishedAt: Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString() : null,
      publishedTime: Number.isFinite(publishedTime) ? publishedTime : null
    };
  });

  const byDomain = normalized.reduce((accumulator, article) => {
    accumulator[article.domain] = (accumulator[article.domain] || 0) + 1;
    return accumulator;
  }, {});

  const topDomains = Object.entries(byDomain)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([domain, count]) => ({ domain, count }));

  const tones = normalized.map((article) => article.tone).filter((tone) => Number.isFinite(tone));
  const recent24h = normalized.filter((article) => article.publishedTime && now - article.publishedTime <= 86_400_000);
  const recent72h = normalized.filter((article) => article.publishedTime && now - article.publishedTime <= 259_200_000);

  return {
    articleCount: normalized.length,
    recent24hCount: recent24h.length,
    recent72hCount: recent72h.length,
    averageTone: tones.length ? tones.reduce((sum, tone) => sum + tone, 0) / tones.length : 0,
    topDomains,
    latestHeadline: normalized[0]?.title || null,
    latestPublishedAt: normalized[0]?.publishedAt || null,
    articles: normalized.slice(0, 8)
  };
}

async function getIntelligenceSnapshot(symbol, label) {
  const [binanceTickerResult, binanceKlinesResult, globalResult, newsResult] = await Promise.allSettled([
    fetchBinanceTicker(symbol),
    fetchBinanceKlines(symbol),
    fetchGlobalSnapshot(),
    fetchNewsArticles(symbol, label)
  ]);

  if (binanceTickerResult.status !== "fulfilled" || binanceKlinesResult.status !== "fulfilled") {
    const reason =
      binanceTickerResult.status === "rejected"
        ? binanceTickerResult.reason
        : binanceKlinesResult.status === "rejected"
          ? binanceKlinesResult.reason
          : new Error("Binance stats unavailable.");

    throw reason;
  }

  const errors = [];

  if (globalResult.status === "rejected") {
    errors.push(`macro: ${globalResult.reason.message}`);
  }

  if (newsResult.status === "rejected") {
    errors.push(`news: ${newsResult.reason.message}`);
  }

  const globalPayload = globalResult.status === "fulfilled" ? globalResult.value : { data: {} };
  const newsArticles = newsResult.status === "fulfilled" ? newsResult.value : [];

  return {
    fetchedAt: new Date().toISOString(),
    symbol,
    label,
    binanceStats: summarizeBinanceTicker(binanceTickerResult.value, binanceKlinesResult.value),
    macroStats: summarizeGlobal(globalPayload),
    newsStats: summarizeNews(newsArticles),
    errors
  };
}

module.exports = {
  getIntelligenceSnapshot
};
