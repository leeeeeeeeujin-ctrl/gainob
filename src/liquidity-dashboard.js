const DAY_MS = 24 * 60 * 60 * 1000;
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const BINANCE_BASE_URL = "https://data-api.binance.vision/api/v3";
const DEFILLAMA_STABLECOINS_BASE_URL = "https://stablecoins.llama.fi";
const SOSOVALUE_BASE_URL = "https://api.sosovalue.xyz/openapi/v2";
const FARSIDE_BASE_URL = "https://farside.co.uk";

const PROVIDER_CACHE_TTL_MS = 10 * 60 * 1000;
const FARSIDE_ETF_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const providerCache = new Map();

function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  return Number(Number(value).toFixed(digits));
}

function point(timestamp, value) {
  return {
    timestamp: new Date(timestamp).toISOString(),
    value: round(value, 4)
  };
}

function latest(series) {
  return series.at(-1)?.value ?? null;
}

function movingAverage(series, window) {
  const values = series.slice(-window).map((item) => item.value).filter((value) => value !== null);
  if (!values.length) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 4);
}

function changePct(series, periods) {
  const current = latest(series);
  const previous = series.at(-1 - periods)?.value;

  if (current === null || previous === undefined || previous === null || previous === 0) {
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

function normalizeResult(result, sourceFallback) {
  if (Array.isArray(result)) {
    return {
      series: result,
      source: sourceFallback,
      status: result.length ? "available" : "unavailable",
      error: null
    };
  }

  return {
    series: Array.isArray(result?.series) ? result.series : [],
    source: result?.source || sourceFallback,
    status: result?.status || (result?.series?.length ? "available" : "unavailable"),
    error: result?.error || null
  };
}

function buildMetric({ id, label, unit, result, description, source }) {
  const normalized = normalizeResult(result, source);

  return {
    id,
    label,
    unit,
    current: latest(normalized.series),
    changes: {
      "1d": changePct(normalized.series, 1),
      "1w": changePct(normalized.series, 7),
      "1m": changePct(normalized.series, 30),
      "3m": changePct(normalized.series, 90)
    },
    description,
    source: normalized.source,
    status: normalized.status,
    error: normalized.error,
    series: normalized.series
  };
}

function buildRotation({ id, label, unit, result, source }) {
  const normalized = normalizeResult(result, source);
  const current = latest(normalized.series);
  const ma20 = movingAverage(normalized.series, 20);
  const ma50 = movingAverage(normalized.series, 50);
  const ma200 = movingAverage(normalized.series, 200);

  return {
    id,
    label,
    unit,
    current,
    ma20,
    ma50,
    ma200,
    status: normalized.status === "available" ? classifyRotation(current, ma20, ma50, ma200) : "Unavailable",
    source: normalized.source,
    error: normalized.error,
    series: normalized.series
  };
}

function buildFlow({ id, label, unit, result, description, source }) {
  const normalized = normalizeResult(result, source);
  const current = latest(normalized.series);
  const currentWeek = normalized.series.length
    ? round(normalized.series.slice(-7).reduce((sum, item) => sum + Number(item.value || 0), 0), 2)
    : null;
  const sum30d = normalized.series.length
    ? round(normalized.series.slice(-30).reduce((sum, item) => sum + Number(item.value || 0), 0), 2)
    : null;
  const sum90d = normalized.series.length
    ? round(normalized.series.slice(-90).reduce((sum, item) => sum + Number(item.value || 0), 0), 2)
    : null;

  return {
    id,
    label,
    unit,
    current,
    currentWeek,
    sum30d,
    sum90d,
    description,
    source: normalized.source,
    status: normalized.status,
    error: normalized.error,
    series: normalized.series
  };
}

function describeRotation(metric) {
  if (metric.status === "Unavailable") {
    return "unavailable";
  }
  if (metric.status === "Bullish") {
    return "strong";
  }
  if (metric.status === "Bearish") {
    return "weak";
  }
  return "neutral";
}

function buildCapitalFlowSummary({ btcDominance, ethBtc, solEth, stablecoinCap, btcEtfFlow, ethEtfFlow }) {
  const lines = [];
  const btcDomChange = btcDominance.changes["1m"];
  const stableCapChange = stablecoinCap.changes["1m"];

  if (btcDomChange !== null) {
    lines.push(`BTC Dominance is ${btcDomChange >= 0 ? "rising" : "falling"} on a 1 month basis.`);
  } else {
    lines.push("BTC Dominance 1 month change is unavailable.");
  }

  lines.push(`ETH/BTC structure is ${describeRotation(ethBtc)}.`);
  lines.push(`SOL/ETH structure is ${describeRotation(solEth)}.`);

  if (stableCapChange !== null) {
    lines.push(`Stablecoin Market Cap is ${stableCapChange >= 0 ? "expanding" : "contracting"} on a 1 month basis.`);
  } else {
    lines.push("Stablecoin Market Cap 1 month change is unavailable.");
  }

  const btcEtfTone =
    btcEtfFlow.sum30d === null ? "unavailable" : btcEtfFlow.sum30d > 0 ? "net inflow" : btcEtfFlow.sum30d < 0 ? "net outflow" : "flat";
  const ethEtfTone =
    ethEtfFlow.sum30d === null ? "unavailable" : ethEtfFlow.sum30d > 0 ? "net inflow" : ethEtfFlow.sum30d < 0 ? "net outflow" : "flat";
  lines.push(`BTC ETF 30 day flow is ${btcEtfTone}; ETH ETF 30 day flow is ${ethEtfTone}.`);

  if (stableCapChange > 0 && ethBtc.status === "Bullish") {
    lines.push("Liquidity is improving and ETH relative strength is participating.");
  } else if (stableCapChange > 0) {
    lines.push("Liquidity is improving, but broad alt expansion is not fully confirmed.");
  } else {
    lines.push("Liquidity expansion is not confirmed; capital flow should be treated as defensive or mixed.");
  }

  return lines;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (compatible; GainobLiquidityDashboard/1.0; +https://gainob.vercel.app)",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function cached(key, loader, ttlMs = PROVIDER_CACHE_TTL_MS) {
  const existing = providerCache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.payload;
  }

  const payload = await loader();
  providerCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    payload
  });
  return payload;
}

function fromCurrentValue(value) {
  return [point(Date.now(), value)];
}

function dailySeriesFromPairs(pairs) {
  return pairs
    .map(([timestamp, value]) => point(Number(timestamp), Number(value)))
    .filter((item) => item.value !== null)
    .slice(-210);
}

function dailySeriesFromSeconds(items, valueSelector) {
  return items
    .map((item) => point(Number(item.date) * 1000, valueSelector(item)))
    .filter((item) => item.value !== null)
    .slice(-210);
}

function unavailable(source, error) {
  return {
    series: [],
    source,
    status: "unavailable",
    error: error ? String(error.message || error) : "unavailable"
  };
}

async function safeLoad(source, loader) {
  try {
    const series = await loader();
    return {
      series,
      source,
      status: Array.isArray(series) && series.length ? "available" : "unavailable",
      error: null
    };
  } catch (error) {
    return unavailable(source, error);
  }
}

async function getCoinGeckoGlobal() {
  return cached("coingecko:global", () => fetchJson(`${COINGECKO_BASE_URL}/global`));
}

async function getCoinGeckoSimpleMarkets() {
  return cached(
    "coingecko:simple-markets",
    () =>
      fetchJson(
        `${COINGECKO_BASE_URL}/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,btc,eth&include_market_cap=true`
      )
  );
}

async function getBinanceKlines(pair, interval = "1d", limit = 210) {
  return cached(
    `binance:klines:${pair}:${interval}:${limit}`,
    () => fetchJson(`${BINANCE_BASE_URL}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`),
    5 * 60 * 1000
  );
}

async function getCoinGeckoMarketChart(coinId, vsCurrency, days = 210) {
  return cached(
    `coingecko:market-chart:${coinId}:${vsCurrency}:${days}`,
    () => fetchJson(`${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=daily`),
    30 * 60 * 1000
  );
}

async function getDefiLlamaStablecoinChartsAll() {
  return cached(
    "defillama:stablecoincharts:all",
    () => fetchJson(`${DEFILLAMA_STABLECOINS_BASE_URL}/stablecoincharts/all`),
    6 * 60 * 60 * 1000
  );
}

async function getDefiLlamaStablecoin(assetId) {
  return cached(
    `defillama:stablecoin:${assetId}`,
    () => fetchJson(`${DEFILLAMA_STABLECOINS_BASE_URL}/stablecoin/${assetId}`),
    6 * 60 * 60 * 1000
  );
}

async function getFarsideEtfHtml(asset) {
  const slug = asset === "ETH" ? "ethereum-etf-flow-all-data" : "bitcoin-etf-flow-all-data";
  return cached(
    `farside:etf:${asset}`,
    () => fetchText(`${FARSIDE_BASE_URL}/${slug}/`),
    FARSIDE_ETF_CACHE_TTL_MS
  );
}

function seriesFromBinanceClose(klines, transform = (close) => close) {
  return klines
    .map((entry) => point(Number(entry[0]), transform(Number(entry[4]))))
    .filter((item) => item.value !== null);
}

function seriesFromPairedBinanceClose(leftKlines, rightKlines) {
  const rightByTimestamp = new Map(rightKlines.map((entry) => [Number(entry[0]), Number(entry[4])]));
  return leftKlines
    .map((left) => {
      const timestamp = Number(left[0]);
      const rightClose = rightByTimestamp.get(timestamp);
      if (!rightClose) {
        return null;
      }
      return point(timestamp, Number(left[4]) / rightClose);
    })
    .filter(Boolean);
}

function getPeggedUsd(value) {
  return Number(value?.peggedUSD || 0);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;|&ndash;/gi, "-")
    .replace(/&#8212;|&mdash;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseFarsideAmount(value) {
  const text = stripHtml(value).replace(/,/g, "").trim();
  if (!text || /^(-|n\/a|na)$/i.test(text)) {
    return null;
  }

  const isNegative = /^\(.+\)$/.test(text);
  const numeric = Number(text.replace(/[()$]/g, ""));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return (isNegative ? -numeric : numeric) * 1_000_000;
}

function parseFarsideDate(value) {
  const text = stripHtml(value);
  const parsed = Date.parse(`${text} UTC`);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFarsideEtfSeries(html) {
  const rows = String(html || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const series = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);
    if (cells.length < 2) {
      continue;
    }

    const timestamp = parseFarsideDate(cells[0]);
    if (timestamp === null) {
      continue;
    }

    const total = parseFarsideAmount(cells.at(-1));
    if (total === null) {
      continue;
    }

    series.push(point(timestamp, total));
  }

  return series
    .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp))
    .slice(-210);
}

async function getFarsideEtfNetFlow(asset) {
  const html = await getFarsideEtfHtml(asset);
  const series = parseFarsideEtfSeries(html);
  if (!series.length) {
    throw new Error("Farside ETF table parse returned no rows");
  }
  return series;
}

function createRealLiquidityDashboardProvider() {
  return {
    async getBTCDominance() {
      return safeLoad("CoinGecko /global", async () => {
        const global = await getCoinGeckoGlobal();
        return fromCurrentValue(global?.data?.market_cap_percentage?.btc);
      });
    },

    async getETHDominance() {
      return safeLoad("CoinGecko /global", async () => {
        const global = await getCoinGeckoGlobal();
        return fromCurrentValue(global?.data?.market_cap_percentage?.eth);
      });
    },

    async getETHBTC() {
      return safeLoad("Binance ETHBTC daily klines; CoinGecko fallback", async () => {
        try {
          const klines = await getBinanceKlines("ETHBTC");
          return seriesFromBinanceClose(klines);
        } catch (binanceError) {
          try {
            const chart = await getCoinGeckoMarketChart("ethereum", "btc");
            return dailySeriesFromPairs(chart.prices || []);
          } catch (_coinGeckoChartError) {
            const simpleMarkets = await getCoinGeckoSimpleMarkets();
            const current = simpleMarkets?.ethereum?.btc;
            if (!Number.isFinite(Number(current))) {
              throw binanceError;
            }
            return fromCurrentValue(current);
          }
        }
      });
    },

    async getSOLETH() {
      return safeLoad("Binance SOLUSDT/ETHUSDT daily klines; CoinGecko fallback", async () => {
        try {
          const [solKlines, ethKlines] = await Promise.all([getBinanceKlines("SOLUSDT"), getBinanceKlines("ETHUSDT")]);
          return seriesFromPairedBinanceClose(solKlines, ethKlines);
        } catch (binanceError) {
          try {
            const chart = await getCoinGeckoMarketChart("solana", "eth");
            return dailySeriesFromPairs(chart.prices || []);
          } catch (_coinGeckoChartError) {
            const simpleMarkets = await getCoinGeckoSimpleMarkets();
            const current = simpleMarkets?.solana?.eth;
            if (!Number.isFinite(Number(current))) {
              throw binanceError;
            }
            return fromCurrentValue(current);
          }
        }
      });
    },

    async getStablecoinMarketCap() {
      return safeLoad("DefiLlama stablecoincharts/all", async () => {
        const chart = await getDefiLlamaStablecoinChartsAll();
        return dailySeriesFromSeconds(chart, (item) => getPeggedUsd(item.totalCirculatingUSD || item.totalCirculating));
      });
    },

    async getStablecoinSupply(asset) {
      const assetId = asset === "USDC" ? "2" : "1";
      return safeLoad(`DefiLlama stablecoin/${assetId}`, async () => {
        const payload = await getDefiLlamaStablecoin(assetId);
        return dailySeriesFromSeconds(payload.tokens || [], (item) => getPeggedUsd(item.circulating));
      });
    },

    async getETFNetFlow(asset) {
      return safeLoad("SoSoValue ETF historicalInflowChart; Farside public table fallback", async () => {
        const apiKey = process.env.SOSO_API_KEY || process.env.SOSOVALUE_API_KEY;
        if (!apiKey) {
          return getFarsideEtfNetFlow(asset);
        }

        try {
          const payload = await fetchJson(`${SOSOVALUE_BASE_URL}/etf/historicalInflowChart`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-soso-api-key": apiKey
            },
            body: JSON.stringify({ type: asset === "ETH" ? "us-eth-spot" : "us-btc-spot" })
          });
          const rows = payload?.data?.list || [];
          const series = rows
            .map((row) => point(`${row.date}T00:00:00Z`, Number(row.totalNetInflow)))
            .filter((item) => item.value !== null)
            .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp))
            .slice(-210);

          if (series.length) {
            return series;
          }
        } catch (_error) {
          // Fall through to the public table parser.
        }

        return getFarsideEtfNetFlow(asset);
      });
    },

    async getMarketCapIndex(index) {
      return safeLoad("CoinGecko /global and /simple/price", async () => {
        const [global, simpleMarkets] = await Promise.all([getCoinGeckoGlobal(), getCoinGeckoSimpleMarkets()]);
        const total = Number(global?.data?.total_market_cap?.usd);
        const btcMarketCap = Number(simpleMarkets?.bitcoin?.usd_market_cap || 0);
        const ethMarketCap = Number(simpleMarkets?.ethereum?.usd_market_cap || 0);

        if (index === "TOTAL") {
          return fromCurrentValue(total);
        }
        if (index === "TOTAL2") {
          return fromCurrentValue(total - btcMarketCap);
        }
        return fromCurrentValue(total - btcMarketCap - ethMarketCap);
      });
    }
  };
}

async function buildLiquidityDashboardSnapshot(provider = createRealLiquidityDashboardProvider()) {
  const [
    btcDominanceResult,
    ethDominanceResult,
    ethBtcResult,
    solEthResult,
    stablecoinCapResult,
    usdtSupplyResult,
    usdcSupplyResult,
    btcEtfResult,
    ethEtfResult,
    totalMarketCapResult,
    total2Result,
    total3Result
  ] = await Promise.all([
    provider.getBTCDominance(),
    provider.getETHDominance(),
    provider.getETHBTC(),
    provider.getSOLETH(),
    provider.getStablecoinMarketCap(),
    provider.getStablecoinSupply("USDT"),
    provider.getStablecoinSupply("USDC"),
    provider.getETFNetFlow("BTC"),
    provider.getETFNetFlow("ETH"),
    provider.getMarketCapIndex("TOTAL"),
    provider.getMarketCapIndex("TOTAL2"),
    provider.getMarketCapIndex("TOTAL3")
  ]);

  const btcDominance = buildMetric({
    id: "btc-dominance",
    label: "BTC Dominance",
    unit: "%",
    result: btcDominanceResult,
    source: "CoinGecko /global",
    description: "BTC share of total crypto market capitalization"
  });
  const ethDominance = buildMetric({
    id: "eth-dominance",
    label: "ETH Dominance",
    unit: "%",
    result: ethDominanceResult,
    source: "CoinGecko /global",
    description: "ETH share of total crypto market capitalization"
  });
  const stablecoinCap = buildMetric({
    id: "stablecoin-market-cap",
    label: "Stablecoin Market Cap",
    unit: "USD",
    result: stablecoinCapResult,
    source: "DefiLlama stablecoincharts/all",
    description: "Aggregate USD-pegged stablecoin circulating supply"
  });
  const usdtSupply = buildMetric({
    id: "usdt-supply",
    label: "USDT Supply",
    unit: "USD",
    result: usdtSupplyResult,
    source: "DefiLlama stablecoin/1",
    description: "USDT circulating supply"
  });
  const usdcSupply = buildMetric({
    id: "usdc-supply",
    label: "USDC Supply",
    unit: "USD",
    result: usdcSupplyResult,
    source: "DefiLlama stablecoin/2",
    description: "USDC circulating supply"
  });
  const ethBtc = buildRotation({ id: "eth-btc", label: "ETH/BTC", unit: "ratio", result: ethBtcResult, source: "Binance ETHBTC" });
  const solEth = buildRotation({ id: "sol-eth", label: "SOL/ETH", unit: "ratio", result: solEthResult, source: "Binance SOLUSDT/ETHUSDT" });
  const totalMarketCap = buildMetric({
    id: "total-market-cap",
    label: "TOTAL Market Cap",
    unit: "USD",
    result: totalMarketCapResult,
    source: "CoinGecko /global",
    description: "Total crypto market capitalization"
  });
  const total2 = buildMetric({
    id: "total2",
    label: "TOTAL2",
    unit: "USD",
    result: total2Result,
    source: "CoinGecko /global and /simple/price",
    description: "Crypto market capitalization excluding BTC"
  });
  const total3 = buildMetric({
    id: "total3",
    label: "TOTAL3",
    unit: "USD",
    result: total3Result,
    source: "CoinGecko /global and /simple/price",
    description: "Crypto market capitalization excluding BTC and ETH"
  });
  const btcEtfFlow = buildFlow({
    id: "btc-etf-net-flow",
    label: "BTC ETF Net Flow",
    unit: "USD/day",
    result: btcEtfResult,
    source: "SoSoValue ETF historicalInflowChart",
    description: "Daily net flow across US spot BTC ETFs"
  });
  const ethEtfFlow = buildFlow({
    id: "eth-etf-net-flow",
    label: "ETH ETF Net Flow",
    unit: "USD/day",
    result: ethEtfResult,
    source: "SoSoValue ETF historicalInflowChart",
    description: "Daily net flow across US spot ETH ETFs"
  });

  return {
    asOf: new Date().toISOString(),
    provider: {
      id: "public-liquidity-v1",
      name: "Public Liquidity Dashboard Provider",
      mode: "real",
      sources: ["CoinGecko", "Binance", "DefiLlama", "SoSoValue optional"],
      cacheTtlSeconds: PROVIDER_CACHE_TTL_MS / 1000,
      note: "ETF flow requires SOSO_API_KEY. Failed or unavailable upstream fields are isolated per metric."
    },
    scope: {
      purpose: "briefing",
      excludes: ["price_prediction", "trade_signal"]
    },
    marketRegime: [btcDominance, ethDominance],
    cycleRotation: [ethBtc, solEth],
    cryptoLiquidity: [stablecoinCap, usdtSupply, usdcSupply],
    etfFlows: [btcEtfFlow, ethEtfFlow],
    marketSize: [totalMarketCap, total2, total3],
    capitalFlow: {
      stablecoins: [stablecoinCap, usdtSupply, usdcSupply],
      etfFlows: [btcEtfFlow, ethEtfFlow],
      marketSize: [totalMarketCap, total2, total3]
    },
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
  createRealLiquidityDashboardProvider
};
