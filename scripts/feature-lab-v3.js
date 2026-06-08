#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_FEATURE_FILE = path.join("feature_lab", "feature-lab-v1.csv");
const DEFAULT_OUT_DIR = "feature_lab";
const LABEL_PREFIXES = ["future_return_", "ETH_outperform", "SOL_outperform", "TOTAL3_positive"];
const ASSETS = ["BTC", "ETH", "SOL", "TOTAL3"];
const HORIZONS = [30, 60, 90];

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
    "  node scripts/feature-lab-v3.js analyze --file=feature_lab/feature-lab-v1-tv-research.csv --date=2026-06-01",
    "",
    "Outputs:",
    "  feature_lab/factor_outcome_analysis.json",
    "  feature_lab/cluster_outcome_analysis.json",
    "  feature_lab/similar_day_outcome_analysis.json"
  ].join("\n");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function writeJson(file, payload) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function isLabelColumn(column) {
  return LABEL_PREFIXES.some((prefix) => column.startsWith(prefix));
}

function isFiniteCell(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function round(value, digits = 6) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(digits));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(values, avg) {
  if (!values.length) return 1;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) || 1;
}

function featureColumns(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((column) => {
    if (column === "date" || column === "split") return false;
    if (isLabelColumn(column)) return false;
    return rows.some((row) => isFiniteCell(row[column]));
  });
}

function prepareMatrix(rows, columns) {
  const stats = columns.map((column) => {
    const values = rows.map((row) => isFiniteCell(row[column]) ? Number(row[column]) : null).filter((value) => value !== null);
    const avg = mean(values) ?? 0;
    return { column, mean: avg, std: stddev(values, avg), nonNull: values.length };
  }).filter((item) => item.std > 0 && item.nonNull > 2);
  const matrix = rows.map((row) => stats.map((stat) => {
    const value = isFiniteCell(row[stat.column]) ? Number(row[stat.column]) : stat.mean;
    return (value - stat.mean) / stat.std;
  }));
  return { matrix, columns: stats.map((stat) => stat.column) };
}

function dot(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index];
  return sum;
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector)) || 1;
}

function matVec(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function covariance(matrix) {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const cov = Array.from({ length: cols }, () => new Array(cols).fill(0));
  for (const row of matrix) {
    for (let i = 0; i < cols; i += 1) {
      for (let j = i; j < cols; j += 1) {
        cov[i][j] += row[i] * row[j];
      }
    }
  }
  const scale = Math.max(1, rows - 1);
  for (let i = 0; i < cols; i += 1) {
    for (let j = i; j < cols; j += 1) {
      cov[i][j] /= scale;
      cov[j][i] = cov[i][j];
    }
  }
  return cov;
}

function powerIteration(matrix, seedIndex, iterations = 80) {
  const size = matrix.length;
  let vector = Array.from({ length: size }, (_, index) => (((index + seedIndex * 13) % 17) + 1) / 17);
  vector = vector.map((value) => value / norm(vector));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = matVec(matrix, vector);
    vector = next.map((value) => value / norm(next));
  }
  return { eigenvalue: Math.max(0, dot(vector, matVec(matrix, vector))), vector };
}

function pca(matrix, maxComponents) {
  const cov = covariance(matrix);
  const working = cov.map((row) => [...row]);
  const totalVariance = cov.reduce((sum, row, index) => sum + row[index], 0);
  const components = [];
  const count = Math.min(maxComponents, cov.length);
  let cumulative = 0;

  for (let index = 0; index < count; index += 1) {
    const { eigenvalue, vector } = powerIteration(working, index + 1);
    if (eigenvalue <= 1e-10) break;
    const explainedVarianceRatio = totalVariance ? eigenvalue / totalVariance : 0;
    cumulative += explainedVarianceRatio;
    components.push({ pc: index + 1, eigenvalue, explainedVarianceRatio, cumulativeVariance: cumulative, vector });
    for (let i = 0; i < working.length; i += 1) {
      for (let j = 0; j < working.length; j += 1) {
        working[i][j] -= eigenvalue * vector[i] * vector[j];
      }
    }
  }
  return components;
}

function transform(matrix, components, dims) {
  return matrix.map((row) => components.slice(0, dims).map((component) => dot(row, component.vector)));
}

function euclidean(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += (a[index] - b[index]) ** 2;
  return Math.sqrt(sum);
}

function kmeans(points, k, iterations = 60) {
  const centroids = [points[0]];
  while (centroids.length < k && centroids.length < points.length) {
    let best = points[0];
    let bestDistance = -Infinity;
    for (const point of points) {
      const nearest = Math.min(...centroids.map((centroid) => euclidean(point, centroid)));
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = point;
      }
    }
    centroids.push([...best]);
  }
  let assignments = new Array(points.length).fill(0);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let changed = false;
    assignments = points.map((point, index) => {
      let best = 0;
      let bestDistance = Infinity;
      for (let centroidIndex = 0; centroidIndex < centroids.length; centroidIndex += 1) {
        const distance = euclidean(point, centroids[centroidIndex]);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = centroidIndex;
        }
      }
      if (assignments[index] !== best) changed = true;
      return best;
    });
    const sums = Array.from({ length: centroids.length }, () => new Array(points[0].length).fill(0));
    const counts = new Array(centroids.length).fill(0);
    points.forEach((point, index) => {
      const cluster = assignments[index];
      counts[cluster] += 1;
      for (let dim = 0; dim < point.length; dim += 1) sums[cluster][dim] += point[dim];
    });
    for (let centroid = 0; centroid < centroids.length; centroid += 1) {
      if (counts[centroid]) centroids[centroid] = sums[centroid].map((value) => value / counts[centroid]);
    }
    if (!changed) break;
  }
  return { assignments, centroids };
}

function returnColumn(asset, horizon) {
  return `future_return_${asset}_${horizon}d`;
}

function outcomeStats(rows) {
  const result = {};
  for (const horizon of HORIZONS) {
    result[horizon] = {};
    for (const asset of ASSETS) {
      const values = rows.map((row) => isFiniteCell(row[returnColumn(asset, horizon)]) ? Number(row[returnColumn(asset, horizon)]) : null).filter((value) => value !== null);
      result[horizon][asset] = {
        samples: values.length,
        average: round(mean(values)),
        median: round(median(values)),
        winRate: values.length ? round(values.filter((value) => value > 0).length / values.length) : null
      };
    }
  }
  return result;
}

function scoreBucketRows(rows, scores, pcIndex) {
  const items = rows.map((row, index) => ({ row, score: scores[index][pcIndex] })).filter((item) => Number.isFinite(item.score));
  const sorted = [...items].sort((a, b) => a.score - b.score);
  const bucketSize = Math.max(1, Math.floor(sorted.length * 0.2));
  const low = sorted.slice(0, bucketSize).map((item) => item.row);
  const high = sorted.slice(-bucketSize).map((item) => item.row);
  const mid = sorted.slice(bucketSize, sorted.length - bucketSize).map((item) => item.row);
  return { high, mid, low, highThreshold: high[0]?.score ?? null, lowThreshold: low[low.length - 1]?.score ?? null };
}

function factorLoadings(components, columns, topN = 10) {
  return components.map((component) => ({
    pc: component.pc,
    explainedVarianceRatio: round(component.explainedVarianceRatio),
    topFeatures: component.vector
      .map((value, index) => ({ feature: columns[index], loading: round(value), absLoading: Math.abs(value) }))
      .sort((a, b) => b.absLoading - a.absLoading)
      .slice(0, topN)
      .map(({ feature, loading }) => ({ feature, loading }))
  }));
}

function factorOutcomeAnalysis(rows, scores, components, columns, pcCount = 20) {
  const loadings = factorLoadings(components, columns, 12);
  const factors = [];
  const ranking = [];
  for (let pcIndex = 0; pcIndex < Math.min(pcCount, components.length); pcIndex += 1) {
    const buckets = scoreBucketRows(rows, scores, pcIndex);
    const outcomes = {
      high: outcomeStats(buckets.high),
      mid: outcomeStats(buckets.mid),
      low: outcomeStats(buckets.low)
    };
    const comparisons = [];
    for (const horizon of HORIZONS) {
      for (const asset of ASSETS) {
        const highAvg = outcomes.high[horizon][asset].average;
        const lowAvg = outcomes.low[horizon][asset].average;
        if (highAvg !== null && lowAvg !== null) {
          const diff = round(highAvg - lowAvg);
          comparisons.push({ horizon, asset, highAverage: highAvg, lowAverage: lowAvg, difference: diff });
          ranking.push({
            pc: pcIndex + 1,
            horizon,
            asset,
            highAverage: highAvg,
            lowAverage: lowAvg,
            difference: diff,
            absDifference: Math.abs(diff),
            highWinRate: outcomes.high[horizon][asset].winRate,
            lowWinRate: outcomes.low[horizon][asset].winRate,
            topFeatures: loadings[pcIndex]?.topFeatures?.slice(0, 8) || []
          });
        }
      }
    }
    factors.push({
      pc: pcIndex + 1,
      explainedVarianceRatio: round(components[pcIndex].explainedVarianceRatio),
      thresholds: { high: round(buckets.highThreshold), low: round(buckets.lowThreshold) },
      sampleCounts: { high: buckets.high.length, mid: buckets.mid.length, low: buckets.low.length },
      topFeatures: loadings[pcIndex]?.topFeatures || [],
      outcomes,
      longShortComparisons: comparisons.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    });
  }
  ranking.sort((a, b) => b.absDifference - a.absDifference);
  return { factors, ranking };
}

function clusterOutcomeAnalysis(rows, scores, k = 5) {
  const { assignments } = kmeans(scores, k);
  const clusters = Array.from({ length: k }, (_, cluster) => {
    const clusterRows = rows.filter((_, index) => assignments[index] === cluster);
    const yearDistribution = clusterRows.reduce((acc, row) => {
      const year = String(row.date).slice(0, 4);
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});
    const headline = [];
    for (const horizon of HORIZONS) {
      for (const asset of ASSETS) {
        const stat = outcomeStats(clusterRows)[horizon][asset];
        if (stat.average !== null) headline.push({ horizon, asset, average: stat.average, winRate: stat.winRate });
      }
    }
    headline.sort((a, b) => Math.abs(b.average) - Math.abs(a.average));
    return {
      cluster,
      sampleCount: clusterRows.length,
      startDate: clusterRows[0]?.date || null,
      endDate: clusterRows[clusterRows.length - 1]?.date || null,
      yearDistribution,
      outcomes: outcomeStats(clusterRows),
      strongestOutcomes: headline.slice(0, 8)
    };
  });
  const ranking = clusters
    .flatMap((cluster) => cluster.strongestOutcomes.map((item) => ({ cluster: cluster.cluster, sampleCount: cluster.sampleCount, ...item, absAverage: Math.abs(item.average) })))
    .sort((a, b) => b.absAverage - a.absAverage);
  return { k, dimensions: scores[0]?.length || 0, clusters, ranking };
}

function similarDayOutcomeAnalysis(rows, scores, targetDate, topN = 20) {
  const targetIndex = rows.findIndex((row) => row.date === targetDate);
  if (targetIndex === -1) return { targetDate, error: "target date not found", matches: [], outcomes: null };
  const target = scores[targetIndex];
  const matches = rows
    .map((row, index) => ({ row, distance: euclidean(target, scores[index]) }))
    .filter((item) => item.row.date < targetDate)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topN);
  return {
    targetDate,
    dimensions: scores[0].length,
    matches: matches.map((item) => ({ date: item.row.date, distance: round(item.distance) })),
    outcomes: outcomeStats(matches.map((item) => item.row))
  };
}

function runAnalyze(args) {
  const file = args.file || DEFAULT_FEATURE_FILE;
  const outDir = args.outDir || "feature_lab";
  const rows = readCsv(file).filter((row) => row.split !== "ignore");
  if (!rows.length) throw new Error(`No feature rows found: ${file}`);
  const { matrix, columns } = prepareMatrix(rows, featureColumns(rows));
  const components = pca(matrix, Math.min(columns.length, Number(args.components || 50)));
  const scores20 = transform(matrix, components, Math.min(20, components.length));
  const scores10 = transform(matrix, components, Math.min(10, components.length));
  const targetDate = args.date || rows[rows.length - 1].date;

  const factor = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    rowCount: rows.length,
    featureCount: columns.length,
    note: "Factor outcome analysis buckets PCA scores into high 20%, mid 60%, and low 20%. This is not a predictive model.",
    ...factorOutcomeAnalysis(rows, scores20, components, columns, 20)
  };
  const cluster = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    note: "Cluster outcome analysis uses unsupervised KMeans on 10D PCA scores. This is regime diagnostics, not a prediction model.",
    ...clusterOutcomeAnalysis(rows, scores10, Number(args.k || 5))
  };
  const similar = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    note: "Similar-day outcomes average the forward returns after nearest historical PCA-space neighbors.",
    ...similarDayOutcomeAnalysis(rows, scores10, targetDate, Number(args.limit || 20))
  };

  writeJson(path.join(outDir, "factor_outcome_analysis.json"), factor);
  writeJson(path.join(outDir, "cluster_outcome_analysis.json"), cluster);
  writeJson(path.join(outDir, "similar_day_outcome_analysis.json"), similar);

  console.log(`rows: ${rows.length}`);
  console.log(`features: ${columns.length}`);
  console.log(`factor ranking top: PC${factor.ranking[0]?.pc} ${factor.ranking[0]?.asset} ${factor.ranking[0]?.horizon}d diff=${factor.ranking[0]?.difference}`);
  console.log(`cluster ranking top: C${cluster.ranking[0]?.cluster} ${cluster.ranking[0]?.asset} ${cluster.ranking[0]?.horizon}d avg=${cluster.ranking[0]?.average}`);
  console.log(`similar target: ${targetDate}`);
  console.log(`similar matches: ${similar.matches.length}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "analyze") return runAnalyze(args);
  console.log(usage());
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
