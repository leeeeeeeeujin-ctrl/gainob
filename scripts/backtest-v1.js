#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DAY_MS = 24 * 60 * 60 * 1000;
const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const DEFILLAMA_STABLECOINS_BASE = "https://stablecoins.llama.fi";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL"];
const DEFAULT_HORIZONS = [30, 60, 90];
const DEFAULT_INTERVAL = "1d";
const DEFAULT_OUT_DIR = "backtests";
const DEFAULT_INPUT_DIR = path.join(DEFAULT_OUT_DIR, "input");

const YAHOO_SYMBOLS = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  DXY: "DX-Y.NYB",
  US10Y: "^TNX",
  QQQ: "QQQ"
};

const CSV_COLUMNS = [
  "date",
  "BTC_price",
  "ETH_price",
  "SOL_price",
  "ETH_BTC",
  "SOL_ETH",
  "BTC_dominance",
  "ETH_dominance",
  "TOTAL3",
  "Stablecoin_Market_Cap",
  "DXY",
  "US10Y",
  "QQQ",
  "future_return_BTC_30d",
  "future_return_ETH_30d",
  "future_return_SOL_30d",
  "future_return_BTC_60d",
  "future_return_ETH_60d",
  "future_return_SOL_60d",
  "future_return_BTC_90d",
  "future_return_ETH_90d",
  "future_return_SOL_90d",
  "ETH_outperforms_BTC_30d",
  "SOL_outperforms_ETH_30d",
  "TOTAL3_positive_30d",
  "BTC_positive_30d",
  "ETH_BTC_1m_change",
  "BTC_dominance_1m_change",
  "ETH_dominance_1m_change",
  "TOTAL3_1m_change",
  "Stablecoin_Market_Cap_1m_change",
  "M2SL",
  "RRPONTSYD",
  "TGA",
  "M2SL_1m_change",
  "RRPONTSYD_1m_change",
  "TGA_1m_change",
  "DXY_1m_change",
  "QQQ_1m_change",
  "future_return_TOTAL3_30d",
  "future_return_TOTAL3_60d",
  "future_return_TOTAL3_90d"
];

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const args = { command };

  for (const item of rest) {
    if (!item.startsWith("--")) continue;
    const [key, ...valueParts] = item.slice(2).split("=");
    args[key] = valueParts.length ? valueParts.join("=") : true;
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/backtest-v1.js run --start=2024-01-01 --end=2026-06-01",
    "  node scripts/backtest-v1.js summarize --file=backtests/backtest-v1.csv",
    "",
    "Options:",
    "  --start=YYYY-MM-DD",
    "  --end=YYYY-MM-DD",
    "  --interval=1d",
    "  --horizons=30d,60d,90d",
    "  --symbols=BTC,ETH,SOL",
    "  --outDir=backtests",
    "  --inputDir=backtests/input"
  ].join("\n");
}

function parseDate(value, label) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseHorizons(value) {
  return parseList(value, DEFAULT_HORIZONS.map((day) => `${day}d`))
    .map((item) => Number(String(item).replace(/d$/i, "")))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (compatible; GainobBacktest/1.0)",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function yahooUrl(symbol, startMs, endMs, interval) {
  const period1 = Math.floor(startMs / 1000);
  const period2 = Math.floor((endMs + DAY_MS) / 1000);
  return `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}`;
}

async function fetchYahooSeries(label, yahooSymbol, startMs, endMs, interval = "1d") {
  try {
    const payload = await fetchJson(yahooUrl(yahooSymbol, startMs, endMs, interval));
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const series = timestamps
      .map((timestamp, index) => ({
        date: isoDate(Number(timestamp) * 1000),
        value: closes[index] === null || closes[index] === undefined ? null : Number(closes[index])
      }))
      .filter((point) => Number.isFinite(point.value));

    return { label, series, error: null };
  } catch (error) {
    return { label, series: [], error: error.message };
  }
}

async function fetchStablecoinSeries() {
  try {
    const payload = await fetchJson(`${DEFILLAMA_STABLECOINS_BASE}/stablecoincharts/all`);
    const series = (Array.isArray(payload) ? payload : [])
      .map((item) => ({
        date: isoDate(Number(item.date) * 1000),
        value: Number(item.totalCirculatingUSD?.peggedUSD ?? item.totalCirculating?.peggedUSD)
      }))
      .filter((point) => Number.isFinite(point.value));
    return { label: "Stablecoin_Market_Cap", series, error: null };
  } catch (error) {
    return { label: "Stablecoin_Market_Cap", series: [], error: error.message };
  }
}

function toMap(series) {
  return new Map((series || []).map((point) => [point.date, point.value]));
}

function valueOnOrBefore(series, date) {
  if (!Array.isArray(series) || !series.length) return null;
  const target = parseDate(date, "date");
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (parseDate(series[index].date, "series date") <= target) {
      return series[index].value;
    }
  }
  return null;
}

function valueOnOrAfter(series, date) {
  if (!Array.isArray(series) || !series.length) return null;
  const target = parseDate(date, "date");
  for (const point of series) {
    if (parseDate(point.date, "series date") >= target) {
      return point.value;
    }
  }
  return null;
}

function pctChange(current, previous) {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    !Number.isFinite(Number(current)) ||
    !Number.isFinite(Number(previous)) ||
    Number(previous) === 0
  ) {
    return null;
  }
  return Number((((Number(current) - Number(previous)) / Number(previous)) * 100).toFixed(4));
}

function futureReturn(series, date, horizonDays) {
  const current = valueOnOrBefore(series, date);
  const futureDate = isoDate(parseDate(date, "date") + horizonDays * DAY_MS);
  const future = valueOnOrAfter(series, futureDate);
  return pctChange(future, current);
}

function laggedChange(series, date, lagDays = 30) {
  const current = valueOnOrBefore(series, date);
  const previousDate = isoDate(parseDate(date, "date") - lagDays * DAY_MS);
  const previous = valueOnOrBefore(series, previousDate);
  return pctChange(current, previous);
}

function dateRange(startMs, endMs, stepDays = 1) {
  const dates = [];
  for (let time = startMs; time <= endMs; time += stepDays * DAY_MS) {
    dates.push(isoDate(time));
  }
  return dates;
}

function divide(a, b) {
  if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b)) || Number(b) === 0) {
    return null;
  }
  return Number((Number(a) / Number(b)).toFixed(8));
}

function boolValue(value) {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

function findHeader(headers, expected) {
  const normalizedExpected = expected.toLowerCase();
  return headers.findIndex((header) => String(header).trim().toLowerCase() === normalizedExpected);
}

function readLocalCsvSeries(inputDir, label, fileName) {
  const file = path.join(inputDir, fileName);
  if (!fs.existsSync(file)) {
    return { label, series: [], error: null, source: "missing" };
  }

  try {
    const text = fs.readFileSync(file, "utf8").trim();
    if (!text) {
      return { label, series: [], error: "empty local CSV", source: file };
    }

    const [headerLine, ...lines] = text.split(/\r?\n/);
    const headers = splitCsvLine(headerLine);
    const dateIndex = findHeader(headers, "date");
    const closeIndex = findHeader(headers, "close");

    if (dateIndex === -1 || closeIndex === -1) {
      return { label, series: [], error: "local CSV must include date and close columns", source: file };
    }

    const series = lines
      .filter(Boolean)
      .map((line) => {
        const values = splitCsvLine(line);
        const dateText = values[dateIndex];
        const close = Number(values[closeIndex]);
        if (!dateText || !Number.isFinite(close)) return null;
        return {
          date: isoDate(parseDate(dateText.slice(0, 10), `${label} date`)),
          value: close
        };
      })
      .filter(Boolean)
      .sort((a, b) => parseDate(a.date, "date") - parseDate(b.date, "date"));

    return { label, series, error: null, source: file };
  } catch (error) {
    return { label, series: [], error: error.message, source: file };
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL || "";
}

async function readDbSeries(table, metric, label) {
  if (!databaseUrl()) {
    return { label, series: [], error: null, source: "database not configured" };
  }

  const pool = new Pool({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(
      `
        select date::text as date, close::float as close
        from ${table}
        where metric = $1
        order by date
      `,
      [metric]
    );
    return {
      label,
      series: result.rows
        .map((row) => ({ date: row.date, value: Number(row.close) }))
        .filter((point) => Number.isFinite(point.value)),
      error: null,
      source: `${table}:${metric}`
    };
  } catch (error) {
    return { label, series: [], error: error.message, source: `${table}:${metric}` };
  } finally {
    await pool.end();
  }
}

function preferSeries(primary, fallback) {
  return primary?.series?.length ? primary : fallback;
}

function buildRows({ dates, seriesByLabel, horizons }) {
  const btc = seriesByLabel.BTC || [];
  const eth = seriesByLabel.ETH || [];
  const sol = seriesByLabel.SOL || [];
  const stablecoins = seriesByLabel.Stablecoin_Market_Cap || [];
  const dxy = seriesByLabel.DXY || [];
  const qqq = seriesByLabel.QQQ || [];
  const btcDominance = seriesByLabel.BTC_dominance || [];
  const ethDominance = seriesByLabel.ETH_dominance || [];
  const total3Series = seriesByLabel.TOTAL3 || [];
  const m2 = seriesByLabel.M2SL || [];
  const rrp = seriesByLabel.RRPONTSYD || [];
  const tga = seriesByLabel.TGA || [];

  const ethBtcSeries = [];
  const solEthSeries = [];

  for (const date of dates) {
    const btcPrice = valueOnOrBefore(btc, date);
    const ethPrice = valueOnOrBefore(eth, date);
    const solPrice = valueOnOrBefore(sol, date);
    const ethBtc = divide(ethPrice, btcPrice);
    const solEth = divide(solPrice, ethPrice);
    ethBtcSeries.push({ date, value: ethBtc });
    solEthSeries.push({ date, value: solEth });
  }

  return dates.map((date) => {
    const row = {
      date,
      BTC_price: valueOnOrBefore(btc, date),
      ETH_price: valueOnOrBefore(eth, date),
      SOL_price: valueOnOrBefore(sol, date),
      ETH_BTC: valueOnOrBefore(ethBtcSeries, date),
      SOL_ETH: valueOnOrBefore(solEthSeries, date),
      BTC_dominance: valueOnOrBefore(btcDominance, date),
      ETH_dominance: valueOnOrBefore(ethDominance, date),
      TOTAL3: valueOnOrBefore(total3Series, date),
      M2SL: valueOnOrBefore(m2, date),
      RRPONTSYD: valueOnOrBefore(rrp, date),
      TGA: valueOnOrBefore(tga, date),
      Stablecoin_Market_Cap: valueOnOrBefore(stablecoins, date),
      DXY: valueOnOrBefore(dxy, date),
      US10Y: valueOnOrBefore(seriesByLabel.US10Y || [], date),
      QQQ: valueOnOrBefore(qqq, date),
      ETH_BTC_1m_change: laggedChange(ethBtcSeries, date, 30),
      BTC_dominance_1m_change: laggedChange(btcDominance, date, 30),
      ETH_dominance_1m_change: laggedChange(ethDominance, date, 30),
      TOTAL3_1m_change: laggedChange(total3Series, date, 30),
      Stablecoin_Market_Cap_1m_change: laggedChange(stablecoins, date, 30),
      M2SL_1m_change: laggedChange(m2, date, 30),
      RRPONTSYD_1m_change: laggedChange(rrp, date, 30),
      TGA_1m_change: laggedChange(tga, date, 30),
      DXY_1m_change: laggedChange(dxy, date, 30),
      QQQ_1m_change: laggedChange(qqq, date, 30)
    };

    for (const horizon of horizons) {
      for (const symbol of DEFAULT_SYMBOLS) {
        row[`future_return_${symbol}_${horizon}d`] = futureReturn(seriesByLabel[symbol] || [], date, horizon);
      }
      row[`future_return_TOTAL3_${horizon}d`] = futureReturn(total3Series, date, horizon);
    }

    row.ETH_outperforms_BTC_30d = boolValue(row.future_return_ETH_30d !== null && row.future_return_BTC_30d !== null
      ? row.future_return_ETH_30d > row.future_return_BTC_30d
      : null);
    row.SOL_outperforms_ETH_30d = boolValue(row.future_return_SOL_30d !== null && row.future_return_ETH_30d !== null
      ? row.future_return_SOL_30d > row.future_return_ETH_30d
      : null);
    row.TOTAL3_positive_30d = boolValue(row.future_return_TOTAL3_30d !== null ? row.future_return_TOTAL3_30d > 0 : null);
    row.BTC_positive_30d = boolValue(row.future_return_BTC_30d !== null ? row.future_return_BTC_30d > 0 : null);

    return row;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  }
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
}

function writeJson(file, payload) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function runBacktest(args) {
  if (!args.start || !args.end) {
    throw new Error("--start and --end are required");
  }

  const startMs = parseDate(args.start, "start");
  const endMs = parseDate(args.end, "end");
  if (endMs < startMs) {
    throw new Error("--end must be after --start");
  }

  const interval = String(args.interval || DEFAULT_INTERVAL);
  if (interval !== "1d") {
    throw new Error("backtest_v1 currently supports interval=1d only");
  }

  const horizons = parseHorizons(args.horizons);
  const symbols = parseList(args.symbols, DEFAULT_SYMBOLS).map((symbol) => symbol.toUpperCase());
  const outDir = args.outDir || DEFAULT_OUT_DIR;
  const inputDir = args.inputDir || DEFAULT_INPUT_DIR;
  ensureDir(outDir);

  const fetchStartMs = startMs - 45 * DAY_MS;
  const fetchEndMs = endMs + Math.max(...horizons) * DAY_MS + 7 * DAY_MS;
  const localCsvResults = [
    readLocalCsvSeries(inputDir, "BTC_dominance", "btc_dominance.csv"),
    readLocalCsvSeries(inputDir, "ETH_dominance", "eth_dominance.csv"),
    readLocalCsvSeries(inputDir, "TOTAL3", "total3.csv")
  ];
  const dbResults = await Promise.all([
    readDbSeries("tradingview_series", "BTC_D", "BTC_dominance"),
    readDbSeries("tradingview_series", "ETH_D", "ETH_dominance"),
    readDbSeries("tradingview_series", "TOTAL3", "TOTAL3"),
    readDbSeries("macro_series", "M2SL", "M2SL"),
    readDbSeries("macro_series", "RRPONTSYD", "RRPONTSYD"),
    readDbSeries("macro_series", "TGA", "TGA")
  ]);
  const resolvedOptionalResults = [
    preferSeries(localCsvResults[0], dbResults[0]),
    preferSeries(localCsvResults[1], dbResults[1]),
    preferSeries(localCsvResults[2], dbResults[2]),
    dbResults[3],
    dbResults[4],
    dbResults[5]
  ];
  const tasks = [
    ...symbols.map((symbol) => fetchYahooSeries(symbol, YAHOO_SYMBOLS[symbol] || `${symbol}-USD`, fetchStartMs, fetchEndMs, interval)),
    fetchYahooSeries("DXY", YAHOO_SYMBOLS.DXY, fetchStartMs, fetchEndMs, interval),
    fetchYahooSeries("US10Y", YAHOO_SYMBOLS.US10Y, fetchStartMs, fetchEndMs, interval),
    fetchYahooSeries("QQQ", YAHOO_SYMBOLS.QQQ, fetchStartMs, fetchEndMs, interval),
    fetchStablecoinSeries()
  ];

  const results = await Promise.all(tasks);
  const allResults = [...results, ...resolvedOptionalResults];
  const seriesByLabel = Object.fromEntries(allResults.map((result) => [result.label, result.series]));
  const dates = dateRange(startMs, endMs, 1);
  const rows = buildRows({ dates, seriesByLabel, horizons });
  const baseName = args.out || "backtest-v1";
  const csvFile = path.join(outDir, `${baseName}.csv`);
  const jsonFile = path.join(outDir, `${baseName}.json`);

  writeCsv(csvFile, rows);
  writeJson(jsonFile, {
    meta: {
      generatedAt: new Date().toISOString(),
      startDate: args.start,
      endDate: args.end,
      interval,
      horizons: horizons.map((horizon) => `${horizon}d`),
      symbols,
      sources: {
        prices: "Yahoo Finance chart",
        macro: "Yahoo Finance chart",
        stablecoins: "DefiLlama stablecoincharts/all",
        dominance: "optional local CSV import from backtests/input or tradingview_series DB",
        total3: "optional local CSV import from backtests/input or tradingview_series DB",
        macroLiquidity: "macro_series DB"
      },
      localCsv: Object.fromEntries(localCsvResults.map((result) => [result.label, {
        source: result.source,
        rows: result.series.length,
        error: result.error
      }])),
      database: Object.fromEntries(dbResults.map((result) => [result.label, {
        source: result.source,
        rows: result.series.length,
        error: result.error
      }])),
      errors: Object.fromEntries(allResults.filter((result) => result.error).map((result) => [result.label, result.error]))
    },
    rows
  });

  console.log(`Wrote ${rows.length} rows`);
  console.log(`CSV: ${csvFile}`);
  console.log(`JSON: ${jsonFile}`);
}

function parseCsv(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, parseCsvValue(values[index])]));
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsvValue(value) {
  if (value === undefined || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(Number(value)));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + Number(value), 0) / usable.length;
}

function median(values) {
  const usable = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}

function minValue(values) {
  const usable = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return usable.length ? Math.min(...usable) : null;
}

function rate(rows, predicate) {
  const usable = rows.map(predicate).filter((value) => value !== null && value !== undefined);
  if (!usable.length) return null;
  return usable.filter(Boolean).length / usable.length;
}

function fmtPct(value) {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function fmtNumber(value) {
  return value === null ? "n/a" : Number(value).toFixed(4);
}

function fmtSignedPct(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "n/a";
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(4)}%`;
}

function relativeReturn(row, longSymbol, shortSymbol, horizon = 30) {
  const longReturn = row[`future_return_${longSymbol}_${horizon}d`];
  const shortReturn = row[`future_return_${shortSymbol}_${horizon}d`];
  if (!Number.isFinite(Number(longReturn)) || !Number.isFinite(Number(shortReturn))) return null;
  return Number((Number(longReturn) - Number(shortReturn)).toFixed(4));
}

function averageAssetReturn(row, horizon = 30) {
  return average([
    row[`future_return_BTC_${horizon}d`],
    row[`future_return_ETH_${horizon}d`],
    row[`future_return_SOL_${horizon}d`]
  ]);
}

function signalStats(rows, signal, horizon) {
  const samples = rows
    .filter(signal.condition)
    .map((row) => ({
      row,
      win: signal.win(row, horizon),
      ret: signal.ret(row, horizon)
    }))
    .filter((sample) => sample.win !== null && sample.win !== undefined && Number.isFinite(Number(sample.ret)));
  const returns = samples.map((sample) => Number(sample.ret));

  return {
    name: signal.name,
    samples: samples.length,
    winRate: samples.length ? samples.filter((sample) => sample.win).length / samples.length : null,
    avgReturn: average(returns),
    medianReturn: median(returns),
    maxDrawdown: minValue(returns),
    expectancy: average(returns),
    confidenceScore: confidenceScore(samples.length, samples.length ? samples.filter((sample) => sample.win).length / samples.length : null, average(returns))
  };
}

function confidenceScore(samples, winRate, expectancy) {
  if (!samples || winRate === null || expectancy === null || !Number.isFinite(Number(expectancy))) return null;
  const sampleFactor = Math.min(1, Math.log10(samples + 1) / Math.log10(200));
  const winFactor = Math.max(0, Math.min(1, Number(winRate)));
  const expectancyFactor = Math.max(0, Math.min(1, (Number(expectancy) + 10) / 30));
  return Number(((sampleFactor * 0.4 + winFactor * 0.3 + expectancyFactor * 0.3) * 100).toFixed(2));
}

function sampleWarning(samples) {
  if (samples < 20) return "LOW_SAMPLE";
  if (samples < 50) return "THIN_SAMPLE";
  return "";
}

function buildSignals() {
  return [
    {
      name: "ETH/BTC up -> ETH outperform BTC",
      condition: (row) => Number(row.ETH_BTC_1m_change) > 0,
      win: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon)
    },
    {
      name: "TOTAL3 1m up -> TOTAL3 future positive",
      condition: (row) => Number(row.TOTAL3_1m_change) > 0,
      win: (row, horizon) => {
        const ret = row[`future_return_TOTAL3_${horizon}d`];
        return ret === null || ret === undefined ? null : Number(ret) > 0;
      },
      ret: (row, horizon) => row[`future_return_TOTAL3_${horizon}d`]
    },
    {
      name: "BTC.D 1m down -> ETH outperform BTC",
      condition: (row) => Number(row.BTC_dominance_1m_change) < 0,
      win: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon)
    },
    {
      name: "BTC.D down + ETH.D up -> ETH outperform BTC",
      condition: (row) => Number(row.BTC_dominance_1m_change) < 0 && Number(row.ETH_dominance_1m_change) > 0,
      win: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon)
    },
    {
      name: "ETH/BTC up + TOTAL3 up -> ETH outperform BTC",
      condition: (row) => Number(row.ETH_BTC_1m_change) > 0 && Number(row.TOTAL3_1m_change) > 0,
      win: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon)
    },
    {
      name: "ETH/BTC up + TOTAL3 up -> SOL outperform ETH",
      condition: (row) => Number(row.ETH_BTC_1m_change) > 0 && Number(row.TOTAL3_1m_change) > 0,
      win: (row, horizon) => relativeReturn(row, "SOL", "ETH", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "SOL", "ETH", horizon)
    },
    {
      name: "M2 up + RRP down -> BTC/ETH/SOL average return",
      condition: (row) => Number(row.M2SL_1m_change) > 0 && Number(row.RRPONTSYD_1m_change) < 0,
      win: (row, horizon) => {
        const ret = averageAssetReturn(row, horizon);
        return ret === null ? null : ret > 0;
      },
      ret: averageAssetReturn
    },
    {
      name: "M2 up + RRP down + TGA down -> BTC/ETH/SOL average return",
      condition: (row) => Number(row.M2SL_1m_change) > 0 && Number(row.RRPONTSYD_1m_change) < 0 && Number(row.TGA_1m_change) < 0,
      win: (row, horizon) => {
        const ret = averageAssetReturn(row, horizon);
        return ret === null ? null : ret > 0;
      },
      ret: averageAssetReturn
    },
    {
      name: "M2 up + RRP down + TGA down + TOTAL3 up -> BTC/ETH/SOL average return",
      condition: (row) =>
        Number(row.M2SL_1m_change) > 0 &&
        Number(row.RRPONTSYD_1m_change) < 0 &&
        Number(row.TGA_1m_change) < 0 &&
        Number(row.TOTAL3_1m_change) > 0,
      win: (row, horizon) => {
        const ret = averageAssetReturn(row, horizon);
        return ret === null ? null : ret > 0;
      },
      ret: averageAssetReturn
    },
    {
      name: "Macro friendly + ETH/BTC up + TOTAL3 up -> ETH outperform BTC",
      condition: (row) =>
        Number(row.M2SL_1m_change) > 0 &&
        Number(row.RRPONTSYD_1m_change) < 0 &&
        Number(row.TGA_1m_change) < 0 &&
        Number(row.ETH_BTC_1m_change) > 0 &&
        Number(row.TOTAL3_1m_change) > 0,
      win: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "ETH", "BTC", horizon)
    },
    {
      name: "Macro friendly + ETH/BTC up + TOTAL3 up -> SOL outperform ETH",
      condition: (row) =>
        Number(row.M2SL_1m_change) > 0 &&
        Number(row.RRPONTSYD_1m_change) < 0 &&
        Number(row.TGA_1m_change) < 0 &&
        Number(row.ETH_BTC_1m_change) > 0 &&
        Number(row.TOTAL3_1m_change) > 0,
      win: (row, horizon) => relativeReturn(row, "SOL", "ETH", horizon) > 0,
      ret: (row, horizon) => relativeReturn(row, "SOL", "ETH", horizon)
    }
  ];
}

function rowsByDate(rows) {
  return new Map(rows.map((row) => [row.date, row]));
}

function rowAfter(dateMap, date, horizon) {
  const target = isoDate(parseDate(date, "date") + horizon * DAY_MS);
  return dateMap.get(target) || null;
}

function forwardPctChange(row, futureRow, field) {
  if (!row || !futureRow) return null;
  return pctChange(futureRow[field], row[field]);
}

function macroFriendly(row) {
  return Number(row.M2SL_1m_change) > 0 && Number(row.RRPONTSYD_1m_change) < 0 && Number(row.TGA_1m_change) < 0;
}

function leadLagStats(rows, horizons) {
  const dateMap = rowsByDate(rows);
  const macroRows = rows.filter(macroFriendly);

  return horizons.map((horizon) => {
    const btcDomChanges = [];
    const ethDomChanges = [];
    const total3Changes = [];
    const solOutperformance = [];

    for (const row of macroRows) {
      const future = rowAfter(dateMap, row.date, horizon);
      const btcDom = forwardPctChange(row, future, "BTC_dominance");
      const ethDom = forwardPctChange(row, future, "ETH_dominance");
      const total3 = forwardPctChange(row, future, "TOTAL3");
      const solEth = future ? relativeReturn(row, "SOL", "ETH", horizon) : null;
      if (btcDom !== null) btcDomChanges.push(btcDom);
      if (ethDom !== null) ethDomChanges.push(ethDom);
      if (total3 !== null) total3Changes.push(total3);
      if (solEth !== null) solOutperformance.push(solEth);
    }

    return {
      horizon,
      samples: macroRows.length,
      usableSamples: Math.max(btcDomChanges.length, ethDomChanges.length, total3Changes.length, solOutperformance.length),
      btcDominanceAvgChange: average(btcDomChanges),
      ethDominanceAvgChange: average(ethDomChanges),
      total3AvgChange: average(total3Changes),
      solOutperformEthAvg: average(solOutperformance)
    };
  });
}

function summarize(args) {
  if (!args.file) {
    throw new Error("--file is required");
  }

  const rows = parseCsv(args.file);
  const ethBtcPositive = rows.filter((row) => Number(row.ETH_BTC_1m_change) > 0);
  const total3Positive = rows.filter((row) => Number(row.TOTAL3_1m_change) > 0);
  const stablecoinExpanding = rows.filter((row) => Number(row.Stablecoin_Market_Cap_1m_change) > 0);
  const dxyDownQqqUp = rows.filter((row) => Number(row.DXY_1m_change) < 0 && Number(row.QQQ_1m_change) > 0);

  const riskReturns = dxyDownQqqUp.flatMap((row) => [
    row.future_return_BTC_30d,
    row.future_return_ETH_30d,
    row.future_return_SOL_30d
  ]);
  const stablecoinReturns = stablecoinExpanding.flatMap((row) => [
    row.future_return_BTC_30d,
    row.future_return_ETH_30d,
    row.future_return_SOL_30d
  ]);

  const lines = [
    `sample count: ${rows.length}`,
    `BTC 30d win rate: ${fmtPct(rate(rows, (row) => row.BTC_positive_30d))}`,
    `ETH vs BTC 30d win rate: ${fmtPct(rate(rows, (row) => row.ETH_outperforms_BTC_30d))}`,
    `SOL vs ETH 30d win rate: ${fmtPct(rate(rows, (row) => row.SOL_outperforms_ETH_30d))}`,
    `ETH/BTC 1m positive -> ETH outperformance: ${fmtPct(rate(ethBtcPositive, (row) => row.ETH_outperforms_BTC_30d))} (n=${ethBtcPositive.length})`,
    `TOTAL3 1m positive -> TOTAL3 positive: ${fmtPct(rate(total3Positive, (row) => row.TOTAL3_positive_30d))} (n=${total3Positive.length})`,
    `Stablecoin expanding -> BTC/ETH/SOL avg 30d return: ${fmtNumber(average(stablecoinReturns))}% (n=${stablecoinExpanding.length})`,
    `DXY down + QQQ up -> risk asset avg 30d return: ${fmtNumber(average(riskReturns))}% (n=${dxyDownQqqUp.length})`
  ];

  const horizons = parseHorizons(args.horizons || "30d,60d,90d");
  const signals = buildSignals();
  const signalResults = signals.flatMap((signal) => horizons.map((horizon) => ({
    ...signalStats(rows, signal, horizon),
    horizon
  })));
  lines.push("");
  lines.push("=== SIGNAL VALIDATION ===");
  for (const signal of signals) {
    lines.push("");
    lines.push(signal.name);
    for (const horizon of horizons) {
      const result = signalResults.find((item) => item.name === signal.name && item.horizon === horizon);
      lines.push(`${horizon}d:`);
      lines.push(`  samples: ${result.samples}${sampleWarning(result.samples) ? ` (${sampleWarning(result.samples)})` : ""}`);
      lines.push(`  win rate: ${fmtPct(result.winRate)}`);
      lines.push(`  avg return: ${fmtSignedPct(result.avgReturn)}`);
      lines.push(`  median return: ${fmtSignedPct(result.medianReturn)}`);
      lines.push(`  max drawdown: ${fmtSignedPct(result.maxDrawdown)}`);
      lines.push(`  expectancy: ${fmtSignedPct(result.expectancy)}`);
      lines.push(`  confidence score: ${result.confidenceScore === null ? "n/a" : result.confidenceScore}`);
    }
  }

  const ranked = signalResults
    .filter((result) => result.samples > 0 && Number.isFinite(Number(result.expectancy)))
    .sort((a, b) => Number(b.confidenceScore || 0) - Number(a.confidenceScore || 0))
    .slice(0, 10);

  lines.push("");
  lines.push("=== LEAD-LAG: MACRO FRIENDLY -> MARKET STRUCTURE ===");
  for (const item of leadLagStats(rows, horizons)) {
    lines.push(`${item.horizon}d:`);
    lines.push(`  samples: ${item.usableSamples}/${item.samples}`);
    lines.push(`  BTC.D avg change: ${fmtSignedPct(item.btcDominanceAvgChange)}`);
    lines.push(`  ETH.D avg change: ${fmtSignedPct(item.ethDominanceAvgChange)}`);
    lines.push(`  TOTAL3 avg change: ${fmtSignedPct(item.total3AvgChange)}`);
    lines.push(`  SOL vs ETH avg relative return: ${fmtSignedPct(item.solOutperformEthAvg)}`);
  }

  lines.push("");
  lines.push("=== SIGNAL RANKING TOP 10 ===");
  if (!ranked.length) {
    lines.push("No ranked signals with usable samples.");
  } else {
    ranked.forEach((result, index) => {
      lines.push(`#${index + 1} ${result.name} (${result.horizon}d)`);
      lines.push(`samples: ${result.samples}${sampleWarning(result.samples) ? ` (${sampleWarning(result.samples)})` : ""}`);
      lines.push(`win rate: ${fmtPct(result.winRate)}`);
      lines.push(`expectancy: ${fmtSignedPct(result.expectancy)}`);
      lines.push(`confidence score: ${result.confidenceScore === null ? "n/a" : result.confidenceScore}`);
    });
  }

  console.log(lines.join("\n"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "run") {
    await runBacktest(args);
    return;
  }
  if (args.command === "summarize") {
    summarize(args);
    return;
  }

  console.log(usage());
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
