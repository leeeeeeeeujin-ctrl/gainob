#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

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
  "TOTAL3_1m_change",
  "Stablecoin_Market_Cap_1m_change",
  "DXY_1m_change",
  "QQQ_1m_change"
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
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous)) || Number(previous) === 0) {
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
    const total3Return30d = futureReturn(total3Series, date, 30);
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
      Stablecoin_Market_Cap: valueOnOrBefore(stablecoins, date),
      DXY: valueOnOrBefore(dxy, date),
      US10Y: valueOnOrBefore(seriesByLabel.US10Y || [], date),
      QQQ: valueOnOrBefore(qqq, date),
      ETH_BTC_1m_change: laggedChange(ethBtcSeries, date, 30),
      TOTAL3_1m_change: laggedChange(total3Series, date, 30),
      Stablecoin_Market_Cap_1m_change: laggedChange(stablecoins, date, 30),
      DXY_1m_change: laggedChange(dxy, date, 30),
      QQQ_1m_change: laggedChange(qqq, date, 30)
    };

    for (const horizon of horizons) {
      for (const symbol of DEFAULT_SYMBOLS) {
        row[`future_return_${symbol}_${horizon}d`] = futureReturn(seriesByLabel[symbol] || [], date, horizon);
      }
    }

    row.ETH_outperforms_BTC_30d = boolValue(row.future_return_ETH_30d !== null && row.future_return_BTC_30d !== null
      ? row.future_return_ETH_30d > row.future_return_BTC_30d
      : null);
    row.SOL_outperforms_ETH_30d = boolValue(row.future_return_SOL_30d !== null && row.future_return_ETH_30d !== null
      ? row.future_return_SOL_30d > row.future_return_ETH_30d
      : null);
    row.TOTAL3_positive_30d = boolValue(total3Return30d !== null ? total3Return30d > 0 : null);
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
  const tasks = [
    ...symbols.map((symbol) => fetchYahooSeries(symbol, YAHOO_SYMBOLS[symbol] || `${symbol}-USD`, fetchStartMs, fetchEndMs, interval)),
    fetchYahooSeries("DXY", YAHOO_SYMBOLS.DXY, fetchStartMs, fetchEndMs, interval),
    fetchYahooSeries("US10Y", YAHOO_SYMBOLS.US10Y, fetchStartMs, fetchEndMs, interval),
    fetchYahooSeries("QQQ", YAHOO_SYMBOLS.QQQ, fetchStartMs, fetchEndMs, interval),
    fetchStablecoinSeries()
  ];

  const results = await Promise.all(tasks);
  const allResults = [...results, ...localCsvResults];
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
        dominance: "optional local CSV import from backtests/input",
        total3: "optional local CSV import from backtests/input"
      },
      localCsv: Object.fromEntries(localCsvResults.map((result) => [result.label, {
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
