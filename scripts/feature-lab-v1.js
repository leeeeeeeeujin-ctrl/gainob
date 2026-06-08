#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OUT_DIR = "feature_lab";
const DEFAULT_FEATURE_FILE = path.join(DEFAULT_OUT_DIR, "feature-lab-v1.csv");
const DEFAULT_MODEL_DIR = path.join(DEFAULT_OUT_DIR, "models");
const HORIZONS = [30, 60, 90];
const FEATURE_LAGS = {
  price_market_structure: "1d",
  stablecoin_market_cap: "1d",
  dxy_us10y_qqq: "1d",
  rrp_tga: "1d",
  m2sl: "30d",
  labels: "start from as_of_date + 1d"
};

const METRICS = [
  "BTC_price",
  "ETH_price",
  "SOL_price",
  "ETH_BTC",
  "SOL_ETH",
  "BTC_dominance",
  "ETH_dominance",
  "TOTAL3",
  "Stablecoin_Market_Cap",
  "M2SL",
  "RRPONTSYD",
  "TGA",
  "DXY",
  "US10Y",
  "QQQ"
];

const LABEL_PREFIXES = ["future_return_", "ETH_outperform", "SOL_outperform", "TOTAL3_positive"];

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
    "  node scripts/feature-lab-v1.js build --start=2024-01-01 --end=2026-06-01",
    "  node scripts/feature-lab-v1.js build --start=2016-01-01 --end=2026-06-01 --split=walk-forward",
    "  node scripts/feature-lab-v1.js train --target=SOL_outperform_ETH_60d",
    "  node scripts/feature-lab-v1.js report --target=SOL_outperform_ETH_60d"
  ].join("\n");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseDate(value) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
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

function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  if (!text) return [];
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, parseCsvValue(values[index])]));
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(file, "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
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
  return Number((((Number(current) - Number(previous)) / Number(previous)) * 100).toFixed(6));
}

function valueOnOrBefore(rowsByDate, date, metric) {
  const target = parseDate(date);
  if (target === null) return null;
  for (let time = target; time >= target - 120 * DAY_MS; time -= DAY_MS) {
    const row = rowsByDate.get(isoDate(time));
    if (row && row[metric] !== null && row[metric] !== undefined && Number.isFinite(Number(row[metric]))) {
      return Number(row[metric]);
    }
  }
  return null;
}

function trendDirection(value) {
  if (!Number.isFinite(Number(value))) return 0;
  if (Number(value) > 0) return 1;
  if (Number(value) < 0) return -1;
  return 0;
}

function splitForDate(date, mode = "legacy") {
  if (mode === "walk-forward") {
    if (date >= "2016-01-01" && date < "2024-01-01") return "train";
    if (date >= "2024-01-01" && date < "2025-01-01") return "validation";
    if (date >= "2025-01-01") return "test";
    return "ignore";
  }
  if (date.startsWith("2024")) return "train";
  if (date.startsWith("2025")) return "validation";
  if (date.startsWith("2026")) return "test";
  return "ignore";
}

function boolNumber(value) {
  if (value === null || value === undefined) return null;
  return value ? 1 : 0;
}

function outperformsLabel(leftReturn, rightReturn) {
  if (
    leftReturn === null ||
    leftReturn === undefined ||
    rightReturn === null ||
    rightReturn === undefined ||
    !Number.isFinite(Number(leftReturn)) ||
    !Number.isFinite(Number(rightReturn))
  ) {
    return null;
  }
  return boolNumber(Number(leftReturn) > Number(rightReturn));
}

function buildFeatureRows(sourceRows, splitMode = "legacy") {
  const rowsByDate = new Map(sourceRows.map((row) => [row.date, row]));

  return sourceRows.map((row) => {
    const out = {
      date: row.date,
      split: splitForDate(String(row.date), splitMode)
    };

    for (const metric of METRICS) {
      const current = Number.isFinite(Number(row[metric])) ? Number(row[metric]) : null;
      out[metric] = current;

      for (const days of [7, 30, 90]) {
        const previousDate = isoDate(parseDate(row.date) - days * DAY_MS);
        const previous = valueOnOrBefore(rowsByDate, previousDate, metric);
        const change = pctChange(current, previous);
        out[`${metric}_change_${days}d`] = change;
        out[`${metric}_trend_${days}d`] = trendDirection(change);
      }
    }

    out.macro_friendly = boolNumber(Number(out.M2SL_change_30d) > 0 && Number(out.RRPONTSYD_change_30d) < 0 && Number(out.TGA_change_30d) < 0);
    out.stable_expanding = boolNumber(Number(out.Stablecoin_Market_Cap_change_30d) > 0);
    out.eth_btc_up = boolNumber(Number(out.ETH_BTC_change_30d) > 0);
    out.total3_up = boolNumber(Number(out.TOTAL3_change_30d) > 0);
    out.total3_down = boolNumber(Number(out.TOTAL3_change_30d) < 0);
    out.btc_d_down = boolNumber(Number(out.BTC_dominance_change_30d) < 0);
    out.btc_d_up = boolNumber(Number(out.BTC_dominance_change_30d) > 0);
    out.eth_d_up = boolNumber(Number(out.ETH_dominance_change_30d) > 0);
    out.eth_d_down = boolNumber(Number(out.ETH_dominance_change_30d) < 0);
    out.qqq_up = boolNumber(Number(out.QQQ_change_30d) > 0);
    out.dxy_down = boolNumber(Number(out.DXY_change_30d) < 0);
    out.us10y_down = boolNumber(Number(out.US10Y_change_30d) < 0);

    for (const horizon of HORIZONS) {
      out[`future_return_BTC_${horizon}d`] = row[`future_return_BTC_${horizon}d`];
      out[`future_return_ETH_${horizon}d`] = row[`future_return_ETH_${horizon}d`];
      out[`future_return_SOL_${horizon}d`] = row[`future_return_SOL_${horizon}d`];
      out[`future_return_TOTAL3_${horizon}d`] = row[`future_return_TOTAL3_${horizon}d`];
      out[`ETH_outperform_BTC_${horizon}d`] = outperformsLabel(row[`future_return_ETH_${horizon}d`], row[`future_return_BTC_${horizon}d`]);
      out[`SOL_outperform_ETH_${horizon}d`] = outperformsLabel(row[`future_return_SOL_${horizon}d`], row[`future_return_ETH_${horizon}d`]);
      const total3Return = row[`future_return_TOTAL3_${horizon}d`];
      out[`TOTAL3_positive_${horizon}d`] = total3Return === null || total3Return === undefined ? null : boolNumber(Number(total3Return) > 0);
    }

    return out;
  }).filter((row) => row.split !== "ignore");
}

function runBuild(args) {
  if (!args.start || !args.end) {
    throw new Error("--start and --end are required");
  }

  const outDir = args.outDir || DEFAULT_OUT_DIR;
  ensureDir(outDir);
  const sourceFile = args.source || path.join(outDir, "feature-lab-v1-source.csv");

  if (!args.source) {
    const result = spawnSync(
      process.execPath,
      [
        path.join("scripts", "backtest-v1.js"),
        "run",
        `--start=${args.start}`,
        `--end=${args.end}`,
        `--outDir=${outDir}`,
        "--out=feature-lab-v1-source",
        args.cacheDir ? `--cacheDir=${args.cacheDir}` : null,
        args.refreshCache ? `--refreshCache=${args.refreshCache}` : null
      ].filter(Boolean),
      { stdio: "inherit", shell: false }
    );
    if (result.status !== 0) {
      throw new Error("backtest_v1 source build failed");
    }
  }

  const sourceRows = readCsv(sourceFile);
  const splitMode = args.split || "legacy";
  const featureRows = buildFeatureRows(sourceRows, splitMode);
  const featureFile = args.out || DEFAULT_FEATURE_FILE;
  writeCsv(featureFile, featureRows);
  fs.writeFileSync(
    featureFile.replace(/\.csv$/i, ".json"),
    `${JSON.stringify({ meta: buildMeta(featureRows, splitMode), rows: featureRows }, null, 2)}\n`,
    "utf8"
  );

  console.log(`row count: ${featureRows.length}`);
  console.log(`feature count: ${featureColumns(featureRows).length}`);
  console.log(`CSV: ${featureFile}`);
  console.log(`JSON: ${featureFile.replace(/\.csv$/i, ".json")}`);
}

function buildMeta(rows, splitMode = "legacy") {
  return {
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    featureCount: featureColumns(rows).length,
    splitMode,
    splitCounts: splitCounts(rows),
    lagPolicy: FEATURE_LAGS,
    note: "Feature rows are built from backtest_v1 as_of_date snapshots. Labels use future returns starting after as_of_date and are excluded from model features."
  };
}

function splitCounts(rows) {
  return rows.reduce((acc, row) => {
    acc[row.split] = (acc[row.split] || 0) + 1;
    return acc;
  }, {});
}

function isLabelColumn(column) {
  return LABEL_PREFIXES.some((prefix) => column.startsWith(prefix));
}

function featureColumns(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((column) => column !== "date" && column !== "split" && !isLabelColumn(column));
}

function targetRows(rows, target) {
  return rows.filter((row) => row.split !== "ignore" && (row[target] === 0 || row[target] === 1));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stddev(values, avg) {
  if (!values.length) return 1;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return std || 1;
}

function trainStats(rows, columns) {
  const stats = {};
  for (const column of columns) {
    const values = rows.map((row) => Number(row[column])).filter(Number.isFinite);
    const avg = mean(values);
    stats[column] = { mean: avg, std: stddev(values, avg) };
  }
  return stats;
}

function vector(row, columns, stats) {
  return columns.map((column) => {
    const value = Number(row[column]);
    const usable = Number.isFinite(value) ? value : stats[column].mean;
    return (usable - stats[column].mean) / stats[column].std;
  });
}

function sigmoid(value) {
  if (value > 35) return 1;
  if (value < -35) return 0;
  return 1 / (1 + Math.exp(-value));
}

function trainLogistic(rows, columns, target, options = {}) {
  const epochs = Number(options.epochs || 900);
  const learningRate = Number(options.learningRate || 0.05);
  const l2 = Number(options.l2 || 0.001);
  const stats = trainStats(rows, columns);
  const weights = new Array(columns.length).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = new Array(columns.length).fill(0);
    let biasGrad = 0;

    for (const row of rows) {
      const x = vector(row, columns, stats);
      const y = Number(row[target]);
      const z = bias + weights.reduce((sum, weight, index) => sum + weight * x[index], 0);
      const error = sigmoid(z) - y;
      biasGrad += error;
      for (let index = 0; index < weights.length; index += 1) {
        grad[index] += error * x[index] + l2 * weights[index];
      }
    }

    const scale = rows.length || 1;
    bias -= learningRate * (biasGrad / scale);
    for (let index = 0; index < weights.length; index += 1) {
      weights[index] -= learningRate * (grad[index] / scale);
    }
  }

  return { type: "logistic_regression", target, columns, stats, weights, bias, epochs, learningRate, l2 };
}

function predict(model, row) {
  const x = vector(row, model.columns, model.stats);
  const z = model.bias + model.weights.reduce((sum, weight, index) => sum + weight * x[index], 0);
  const probability = sigmoid(z);
  return { probability, prediction: probability >= 0.5 ? 1 : 0 };
}

function evaluate(model, rows, target) {
  if (!rows.length) {
    return emptyMetrics();
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  const positives = rows.filter((row) => Number(row[target]) === 1).length;
  const baselineClass = positives >= rows.length - positives ? 1 : 0;
  let baselineCorrect = 0;

  for (const row of rows) {
    const actual = Number(row[target]);
    const { prediction } = predict(model, row);
    if (baselineClass === actual) baselineCorrect += 1;
    if (prediction === 1 && actual === 1) tp += 1;
    if (prediction === 1 && actual === 0) fp += 1;
    if (prediction === 0 && actual === 0) tn += 1;
    if (prediction === 0 && actual === 1) fn += 1;
  }

  return {
    samples: rows.length,
    accuracy: (tp + tn) / rows.length,
    baselineAccuracy: baselineCorrect / rows.length,
    precision: tp + fp ? tp / (tp + fp) : 0,
    recall: tp + fn ? tp / (tp + fn) : 0,
    positiveRate: positives / rows.length,
    confusion: { tp, fp, tn, fn }
  };
}

function emptyMetrics() {
  return {
    samples: 0,
    accuracy: null,
    baselineAccuracy: null,
    precision: null,
    recall: null,
    positiveRate: null,
    confusion: { tp: 0, fp: 0, tn: 0, fn: 0 }
  };
}

function featureImportance(model) {
  return model.columns
    .map((feature, index) => ({ feature, weight: Number(model.weights[index].toFixed(6)), importance: Math.abs(model.weights[index]) }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 25);
}

function leakageWarnings(columns) {
  const suspicious = columns.filter((column) => isLabelColumn(column) || /future|outperform|positive/i.test(column));
  return suspicious.length ? [`Potential leakage columns included: ${suspicious.join(", ")}`] : [];
}

function overfitWarnings(metrics, split) {
  const warnings = [];
  if (split.train < 100 || split.validation < 50 || split.test < 20) warnings.push("sample count is small for at least one split");
  if (metrics.train.accuracy !== null && metrics.validation.accuracy !== null && metrics.train.accuracy - metrics.validation.accuracy > 0.15) {
    warnings.push("train accuracy is much higher than validation accuracy");
  }
  if (metrics.train.accuracy !== null && metrics.test.accuracy !== null && metrics.train.accuracy - metrics.test.accuracy > 0.15) {
    warnings.push("train accuracy is much higher than test accuracy");
  }
  for (const name of ["validation", "test"]) {
    const metric = metrics[name];
    if (metric.accuracy !== null && metric.baselineAccuracy !== null && metric.accuracy - metric.baselineAccuracy < 0.02) {
      warnings.push(`${name} accuracy improves baseline by less than 2 percentage points`);
    }
  }
  return warnings;
}

function targetDistributionWarnings(rows, target) {
  const positiveBySplit = rows.reduce((acc, row) => {
    if (row[target] === 1) acc[row.split] = (acc[row.split] || 0) + 1;
    return acc;
  }, {});
  const positives = Object.values(positiveBySplit).reduce((sum, value) => sum + value, 0);
  if (!positives) return [`target has no positive samples: ${target}`];

  const maxShare = Math.max(...Object.values(positiveBySplit)) / positives;
  const sparseSplits = ["train", "validation", "test"].filter((split) => (positiveBySplit[split] || 0) < 10);
  const warnings = [];
  if (maxShare > 0.75) warnings.push("positive target samples are concentrated in one time split");
  if (sparseSplits.length) warnings.push(`positive target samples are sparse in: ${sparseSplits.join(", ")}`);
  return warnings;
}

function loadFeatureRows(file = DEFAULT_FEATURE_FILE) {
  if (!fs.existsSync(file)) throw new Error(`Feature table not found: ${file}`);
  return readCsv(file);
}

function runTrain(args) {
  const target = args.target;
  if (!target) throw new Error("--target is required");
  const rows = targetRows(loadFeatureRows(args.file || DEFAULT_FEATURE_FILE), target);
  if (!rows.length) throw new Error(`No rows with target: ${target}`);

  const columns = featureColumns(rows);
  const trainRows = rows.filter((row) => row.split === "train");
  const validationRows = rows.filter((row) => row.split === "validation");
  const testRows = rows.filter((row) => row.split === "test");
  const model = trainLogistic(trainRows, columns, target, args);
  const metrics = {
    train: evaluate(model, trainRows, target),
    validation: evaluate(model, validationRows, target),
    test: evaluate(model, testRows, target)
  };
  const split = { train: trainRows.length, validation: validationRows.length, test: testRows.length };
  const report = {
    target,
    generatedAt: new Date().toISOString(),
    model,
    rowCount: rows.length,
    featureCount: columns.length,
    split,
    metrics,
    featureImportance: featureImportance(model),
    warnings: [...leakageWarnings(columns), ...overfitWarnings(metrics, split), ...targetDistributionWarnings(rows, target)],
    leakageWarning: "Labels and future_return columns are excluded from training features."
  };

  ensureDir(DEFAULT_MODEL_DIR);
  const file = modelFile(target);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printReport(report);
  console.log(`model report: ${file}`);
}

function modelFile(target) {
  return path.join(DEFAULT_MODEL_DIR, `${target}.json`);
}

function fmtPct(value) {
  return value === null || value === undefined ? "n/a" : `${(Number(value) * 100).toFixed(2)}%`;
}

function printMetric(name, metric) {
  console.log(`${name} samples: ${metric.samples}`);
  console.log(`${name} accuracy: ${fmtPct(metric.accuracy)}`);
  console.log(`${name} baseline accuracy: ${fmtPct(metric.baselineAccuracy)}`);
  console.log(`${name} precision: ${fmtPct(metric.precision)}`);
  console.log(`${name} recall: ${fmtPct(metric.recall)}`);
}

function printReport(report) {
  console.log(`target: ${report.target}`);
  console.log(`row count: ${report.rowCount}`);
  console.log(`feature count: ${report.featureCount}`);
  console.log(`train/validation/test: ${report.split.train}/${report.split.validation}/${report.split.test}`);
  printMetric("train", report.metrics.train);
  printMetric("validation", report.metrics.validation);
  printMetric("test", report.metrics.test);
  console.log("feature importance:");
  for (const item of report.featureImportance.slice(0, 15)) {
    console.log(`- ${item.feature}: ${item.weight}`);
  }
  console.log("warnings:");
  if (!report.warnings.length) {
    console.log("- none");
  } else {
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }
  console.log(`leakage warning: ${report.leakageWarning}`);
}

function runReport(args) {
  const target = args.target;
  if (!target) throw new Error("--target is required");
  const file = modelFile(target);
  if (!fs.existsSync(file)) throw new Error(`Model report not found. Run train first: ${file}`);
  printReport(JSON.parse(fs.readFileSync(file, "utf8")));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "build") return runBuild(args);
  if (args.command === "train") return runTrain(args);
  if (args.command === "report") return runReport(args);
  console.log(usage());
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
