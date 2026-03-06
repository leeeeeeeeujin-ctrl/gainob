
const fetch = require('node-fetch');

// This module provides Binance-public-data based metrics only.
// It intentionally avoids third-party indexer usage to keep data sourcing
// limited to Binance free public endpoints (tickers, depth, trades).

const BINANCE_BASE = 'https://data-api.binance.vision/api/v3';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function getBinancePublicMetrics(symbols = [], timeframe = '1h') {
  // symbols are base assets like BTC, ETH; we will query PAIR = symbol + USDT
  const results = {};

  for (const sym of symbols) {
    const pair = `${sym}USDT`;
    try {
      const ticker = await fetchJson(`${BINANCE_BASE}/ticker/24hr?symbol=${pair}`);
      const book = await fetchJson(`${BINANCE_BASE}/depth?symbol=${pair}&limit=20`);
      const trades = await fetchJson(`${BINANCE_BASE}/trades?symbol=${pair}&limit=30`);

      results[sym] = {
        pair,
        lastPrice: Number(ticker.lastPrice || 0),
        priceChangePercent: Number(ticker.priceChangePercent || 0),
        quoteVolume: Number(ticker.quoteVolume || 0),
        bids: (book.bids || []).slice(0, 10),
        asks: (book.asks || []).slice(0, 10),
        recentTradesCount: Array.isArray(trades) ? trades.length : 0
      };
    } catch (e) {
      results[sym] = { error: 'unavailable' };
    }
  }

  return results;
}

module.exports = { getBinancePublicMetrics };
