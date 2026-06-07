#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_FEATURE_FILE = path.join("feature_lab", "feature-lab-v1.csv");
const DEFAULT_OUT_DIR = "feature_lab";
const LABEL_PREFIXES = ["future_return_", "ETH_outperform", "SOL_outperform", "TOTAL3_positive"];
const DEFAULT_CLUSTER_DIMS = [5, 10, 20];
const DEFAULT_CLUSTER_KS = [3, 5, 8, 12];
const DEFAULT_COMPRESSION_DIMS = [50, 20, 10, 5, 3];
const OUTCOME_HORIZONS = [30, 60, 90];

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
    "  node scripts/feature-lab-v2.js analyze --file=feature_lab/feature-lab-v1.csv --date=2026-06-01",
    "",
    "Outputs:",
    "  feature_lab/pca_summary.json",
    "  feature_lab/factor_loadings.json",
    "  feature_lab/cluster_summary.json",
    "  feature_lab/compression_test.json",
    "  feature_lab/similar_day_examples.json"
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

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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

function round(value, digits = 6) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(digits));
}

function isFiniteCell(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
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
    const avg = mean(values);
    const std = stddev(values, avg);
    return { column, mean: avg, std, nonNull: values.length };
  });
  const usableIndexes = stats.map((item, index) => ({ item, index })).filter(({ item }) => item.std > 0 && item.nonNull > 2);
  const usableColumns = usableIndexes.map(({ item }) => item.column);
  const usableStats = usableIndexes.map(({ item }) => item);
  const matrix = rows.map((row) => usableStats.map((stat) => {
    const value = isFiniteCell(row[stat.column]) ? Number(row[stat.column]) : null;
    const usable = value !== null ? value : stat.mean;
    return (usable - stat.mean) / stat.std;
  }));
  return { matrix, columns: usableColumns, stats: usableStats };
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

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function powerIteration(matrix, seedIndex, iterations = 80) {
  const size = matrix.length;
  let vector = Array.from({ length: size }, (_, index) => (((index + seedIndex * 13) % 17) + 1) / 17);
  let vectorNorm = norm(vector);
  vector = vector.map((value) => value / vectorNorm);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = matVec(matrix, vector);
    vectorNorm = norm(next);
    vector = next.map((value) => value / vectorNorm);
  }
  const mv = matVec(matrix, vector);
  const eigenvalue = dot(vector, mv);
  return { eigenvalue: Math.max(0, eigenvalue), vector };
}

function pca(matrix, maxComponents) {
  const cov = covariance(matrix);
  const working = cloneMatrix(cov);
  const totalVariance = cov.reduce((sum, row, index) => sum + row[index], 0);
  const components = [];
  const count = Math.min(maxComponents, cov.length);

  for (let componentIndex = 0; componentIndex < count; componentIndex += 1) {
    const { eigenvalue, vector } = powerIteration(working, componentIndex + 1);
    if (eigenvalue <= 1e-10) break;
    components.push({ eigenvalue, vector });
    for (let i = 0; i < working.length; i += 1) {
      for (let j = 0; j < working.length; j += 1) {
        working[i][j] -= eigenvalue * vector[i] * vector[j];
      }
    }
  }

  let cumulative = 0;
  return components.map((component, index) => {
    const explainedVarianceRatio = totalVariance ? component.eigenvalue / totalVariance : 0;
    cumulative += explainedVarianceRatio;
    return {
      pc: index + 1,
      eigenvalue: component.eigenvalue,
      explainedVarianceRatio,
      cumulativeVariance: cumulative,
      vector: component.vector
    };
  });
}

function transform(matrix, components, dims) {
  const selected = components.slice(0, dims);
  return matrix.map((row) => selected.map((component) => dot(row, component.vector)));
}

function correlation(matrix, columns) {
  const rows = matrix.length;
  const pairs = [];
  const matrixObject = {};
  for (let i = 0; i < columns.length; i += 1) {
    matrixObject[columns[i]] = {};
    for (let j = 0; j < columns.length; j += 1) {
      let corr = 0;
      for (let row = 0; row < rows; row += 1) corr += matrix[row][i] * matrix[row][j];
      corr /= Math.max(1, rows - 1);
      matrixObject[columns[i]][columns[j]] = round(corr, 6);
      if (j > i) {
        pairs.push({ a: columns[i], b: columns[j], corr: round(corr, 6), absCorr: round(Math.abs(corr), 6) });
      }
    }
  }
  pairs.sort((a, b) => b.absCorr - a.absCorr);
  return {
    featureCount: columns.length,
    matrix: matrixObject,
    ranking: pairs,
    groups: {
      absCorrGt08: pairs.filter((pair) => pair.absCorr > 0.8),
      absCorrGt09: pairs.filter((pair) => pair.absCorr > 0.9)
    }
  };
}

function dimsForThreshold(components, threshold) {
  const hit = components.find((component) => component.cumulativeVariance >= threshold);
  return hit ? hit.pc : null;
}

function factorLoadings(components, columns, topN = 10) {
  return components.map((component) => ({
    pc: component.pc,
    eigenvalue: round(component.eigenvalue, 6),
    explainedVarianceRatio: round(component.explainedVarianceRatio, 6),
    cumulativeVariance: round(component.cumulativeVariance, 6),
    topFeatures: component.vector
      .map((value, index) => ({ feature: columns[index], loading: round(value, 6), absLoading: Math.abs(value) }))
      .sort((a, b) => b.absLoading - a.absLoading)
      .slice(0, topN)
      .map(({ feature, loading }) => ({ feature, loading }))
  }));
}

function euclidean(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += (a[index] - b[index]) ** 2;
  return Math.sqrt(sum);
}

function initialCentroids(points, k) {
  if (!points.length) return [];
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
  return centroids;
}

function kmeans(points, k, iterations = 60) {
  let centroids = initialCentroids(points, k);
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
    centroids = centroids.map((centroid, index) => counts[index] ? sums[index].map((value) => value / counts[index]) : centroid);
    if (!changed) break;
  }
  return { assignments, centroids };
}

function numeric(row, column) {
  if (!isFiniteCell(row[column])) return null;
  return Number(row[column]);
}

function averageColumn(rows, column) {
  const values = rows.map((row) => numeric(row, column)).filter((value) => value !== null);
  if (!values.length) return null;
  return round(mean(values), 6);
}

function clusterStats(rows, assignments, k) {
  return Array.from({ length: k }, (_, cluster) => {
    const clusterRows = rows.filter((_, index) => assignments[index] === cluster);
    const years = clusterRows.reduce((acc, row) => {
      const year = String(row.date).slice(0, 4);
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});
    const future = Object.fromEntries(OUTCOME_HORIZONS.map((horizon) => [horizon, {
      BTC: averageColumn(clusterRows, `future_return_BTC_${horizon}d`),
      ETH: averageColumn(clusterRows, `future_return_ETH_${horizon}d`),
      SOL: averageColumn(clusterRows, `future_return_SOL_${horizon}d`),
      TOTAL3: averageColumn(clusterRows, `future_return_TOTAL3_${horizon}d`)
    }]));
    return {
      cluster,
      sampleCount: clusterRows.length,
      startDate: clusterRows[0]?.date || null,
      endDate: clusterRows[clusterRows.length - 1]?.date || null,
      yearDistribution: years,
      averageReturns: {
        BTC_60d: averageColumn(clusterRows, "future_return_BTC_60d"),
        ETH_60d: averageColumn(clusterRows, "future_return_ETH_60d"),
        SOL_60d: averageColumn(clusterRows, "future_return_SOL_60d"),
        TOTAL3_60d: averageColumn(clusterRows, "future_return_TOTAL3_60d")
      },
      averageChanges: {
        BTC_D_30d: averageColumn(clusterRows, "BTC_dominance_change_30d"),
        ETH_D_30d: averageColumn(clusterRows, "ETH_dominance_change_30d")
      },
      forwardOutcomes: future
    };
  });
}

function sigmoid(value) {
  if (value > 35) return 1;
  if (value < -35) return 0;
  return 1 / (1 + Math.exp(-value));
}

function trainLogistic(rows, target, epochs = 700, learningRate = 0.05, l2 = 0.001) {
  if (!rows.length) return null;
  const dims = rows[0].x.length;
  const weights = new Array(dims).fill(0);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = new Array(dims).fill(0);
    let biasGrad = 0;
    for (const row of rows) {
      const z = bias + dot(weights, row.x);
      const error = sigmoid(z) - row[target];
      biasGrad += error;
      for (let dim = 0; dim < dims; dim += 1) grad[dim] += error * row.x[dim] + l2 * weights[dim];
    }
    const scale = rows.length;
    bias -= learningRate * (biasGrad / scale);
    for (let dim = 0; dim < dims; dim += 1) weights[dim] -= learningRate * (grad[dim] / scale);
  }
  return { weights, bias };
}

function evaluateLogistic(model, rows, target) {
  if (!model || !rows.length) return { samples: rows.length, accuracy: null, baselineAccuracy: null };
  const positives = rows.filter((row) => row[target] === 1).length;
  const baseline = positives >= rows.length - positives ? 1 : 0;
  let correct = 0;
  let baselineCorrect = 0;
  for (const row of rows) {
    const prediction = sigmoid(model.bias + dot(model.weights, row.x)) >= 0.5 ? 1 : 0;
    if (prediction === row[target]) correct += 1;
    if (baseline === row[target]) baselineCorrect += 1;
  }
  return {
    samples: rows.length,
    accuracy: round(correct / rows.length, 6),
    baselineAccuracy: round(baselineCorrect / rows.length, 6)
  };
}

function compressionTest(rows, scoresByDim, target = "TOTAL3_positive_60d") {
  return DEFAULT_COMPRESSION_DIMS.filter((dim) => scoresByDim[dim]).map((dim) => {
    const scores = scoresByDim[dim];
    const examples = rows.map((row, index) => ({
      split: row.split,
      x: scores[index],
      [target]: row[target]
    })).filter((row) => row.split !== "ignore" && (row[target] === 0 || row[target] === 1));
    const train = examples.filter((row) => row.split === "train");
    const validation = examples.filter((row) => row.split === "validation");
    const test = examples.filter((row) => row.split === "test");
    const model = trainLogistic(train, target);
    return {
      dimensions: dim,
      target,
      warning: examples.length ? null : `No usable samples for target: ${target}`,
      train: evaluateLogistic(model, train, target),
      validation: evaluateLogistic(model, validation, target),
      test: evaluateLogistic(model, test, target)
    };
  });
}

function similarDays(rows, scores, targetDate, topN = 20) {
  const targetIndex = rows.findIndex((row) => row.date === targetDate);
  if (targetIndex === -1) return { targetDate, error: "target date not found", matches: [] };
  const target = scores[targetIndex];
  const matches = rows
    .map((row, index) => ({ date: row.date, distance: round(euclidean(target, scores[index]), 6) }))
    .filter((item) => item.date < targetDate)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topN);
  return { targetDate, dimensions: scores[0].length, matches };
}

function runAnalyze(args) {
  const file = args.file || DEFAULT_FEATURE_FILE;
  const outDir = args.outDir || DEFAULT_OUT_DIR;
  const rows = readCsv(file).filter((row) => row.split !== "ignore");
  if (!rows.length) throw new Error(`No feature rows found: ${file}`);

  const rawColumns = featureColumns(rows);
  const { matrix, columns } = prepareMatrix(rows, rawColumns);
  const components = pca(matrix, Math.min(columns.length, Number(args.components || columns.length)));
  const pcaRows = components.map((component) => ({
    pc: component.pc,
    eigenvalue: round(component.eigenvalue, 6),
    explainedVarianceRatio: round(component.explainedVarianceRatio, 6),
    cumulativeVariance: round(component.cumulativeVariance, 6)
  }));

  const corr = correlation(matrix, columns);
  const pcaSummary = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    rowCount: rows.length,
    featureCount: columns.length,
    correlation: corr,
    pca: {
      components: pcaRows,
      dimensionsForVariance: {
        variance80: dimsForThreshold(components, 0.8),
        variance90: dimsForThreshold(components, 0.9),
        variance95: dimsForThreshold(components, 0.95)
      }
    }
  };

  const loadings = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    factors: factorLoadings(components, columns, Number(args.topFeatures || 12))
  };

  const clusterSummary = [];
  const scoresByDim = {};
  for (const dim of [...new Set([...DEFAULT_CLUSTER_DIMS, ...DEFAULT_COMPRESSION_DIMS, 20])].filter((dim) => dim <= components.length)) {
    scoresByDim[dim] = transform(matrix, components, dim);
  }
  for (const dim of DEFAULT_CLUSTER_DIMS.filter((item) => scoresByDim[item])) {
    for (const k of DEFAULT_CLUSTER_KS) {
      const { assignments, centroids } = kmeans(scoresByDim[dim], k);
      clusterSummary.push({
        dimensions: dim,
        k,
        centroidCount: centroids.length,
        clusters: clusterStats(rows, assignments, centroids.length)
      });
    }
  }

  const compression = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    note: "Compression test is diagnostic only; it checks information loss after PCA compression, not trading readiness.",
    results: compressionTest(rows, scoresByDim, args.target || "TOTAL3_positive_60d")
  };

  const similar = {
    generatedAt: new Date().toISOString(),
    sourceFile: file,
    examples: [
      similarDays(rows, scoresByDim[10] || scoresByDim[5] || transform(matrix, components, Math.min(components.length, 10)), args.date || rows[rows.length - 1].date, 20)
    ]
  };

  writeJson(path.join(outDir, "pca_summary.json"), pcaSummary);
  writeJson(path.join(outDir, "factor_loadings.json"), loadings);
  writeJson(path.join(outDir, "cluster_summary.json"), { generatedAt: new Date().toISOString(), sourceFile: file, results: clusterSummary });
  writeJson(path.join(outDir, "compression_test.json"), compression);
  writeJson(path.join(outDir, "similar_day_examples.json"), similar);

  console.log(`rows: ${rows.length}`);
  console.log(`features: ${columns.length}`);
  console.log(`corr |r|>0.8: ${corr.groups.absCorrGt08.length}`);
  console.log(`corr |r|>0.9: ${corr.groups.absCorrGt09.length}`);
  console.log(`PCA 80% dims: ${pcaSummary.pca.dimensionsForVariance.variance80}`);
  console.log(`PCA 90% dims: ${pcaSummary.pca.dimensionsForVariance.variance90}`);
  console.log(`PCA 95% dims: ${pcaSummary.pca.dimensionsForVariance.variance95}`);
  console.log(`cluster runs: ${clusterSummary.length}`);
  console.log(`compression tests: ${compression.results.length}`);
  console.log(`similar-day target: ${similar.examples[0].targetDate}`);
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
