"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPublicApiUrl } from "@/lib/api-client";

type EndpointPreset = {
  id: string;
  label: string;
  path: string;
  params: Record<string, string>;
  description: string;
};

type EndpointResult = {
  id: string;
  label: string;
  url: string;
  status: number | null;
  fetchedAt: string;
  text: string;
  error: string | null;
};

type BatchEntry = {
  label: string;
  source: string;
  url: string | null;
  manualText: string | null;
};

type TradingViewSummaryRow = {
  metric: string;
  rows: number;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
};

const endpointPresets: EndpointPreset[] = [
  {
    id: "gpt-briefing",
    label: "GPT Briefing",
    path: "/api/public/gpt-briefing",
    params: { profile: "liquidity_cycle_v1", timeframe: "1h", range: "30d", format: "text", includeRaw: "false" },
    description: "Single copy-paste briefing export for ChatGPT"
  },
  {
    id: "liquidity-dashboard",
    label: "Liquidity Dashboard",
    path: "/api/public/liquidity-dashboard",
    params: {},
    description: "MVP aggregate: dominance, rotation, stablecoin cap, ETF flows"
  },
  {
    id: "direction",
    label: "Direction",
    path: "/api/public/direction",
    params: { timeframe: "1h", limit: "5", universe: "10" },
    description: "Market breadth, leaders, laggards, dominance context"
  },
  {
    id: "sector-flow",
    label: "Sector Flow",
    path: "/api/public/sector-flow",
    params: { timeframe: "1h", universe: "24" },
    description: "Sector-level relative flow and breadth"
  },
  {
    id: "opportunity",
    label: "Opportunity",
    path: "/api/public/opportunity",
    params: { timeframe: "1h", universe: "24", limit: "6" },
    description: "Rule-based watch buckets, not a price forecast"
  },
  {
    id: "market",
    label: "Market Snapshot",
    path: "/api/public/market",
    params: { symbol: "BTC", timeframe: "1h", concise: "true" },
    description: "Single-symbol public market packet"
  },
  {
    id: "liquidity",
    label: "Liquidity",
    path: "/api/public/liquidity",
    params: { symbol: "BTC", timeframe: "1h", orderbookDepth: "10" },
    description: "Orderbook summary and wall pressure"
  },
  {
    id: "readme",
    label: "API Readme",
    path: "/api/public/readme",
    params: {},
    description: "Public API documentation as markdown"
  },
  {
    id: "tradingview-summary",
    label: "TradingView DB Summary",
    path: "/api/private/tradingview/summary",
    params: {},
    description: "Private imported BTC.D, ETH.D, TOTAL3 storage status"
  }
];

function prettyPrint(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (_error) {
    return text;
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function cleanBatchLine(line: string) {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^GET\s+/i, "")
    .trim();
}

function parseBatchInput(input: string): BatchEntry[] {
  return input
    .split(/\r?\n/)
    .map(cleanBatchLine)
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map((line, index) => {
      const match = line.match(/https?:\/\/[^\s)]+|\/api\/[^\s)]+/);

      if (!match) {
        return {
          label: `Text ${index + 1}`,
          source: line,
          url: null,
          manualText: line
        };
      }

      const rawUrl = match[0];
      const labelPart = line.slice(0, match.index).replace(/[:|-]\s*$/, "").trim();
      return {
        label: labelPart || `Endpoint ${index + 1}`,
        source: line,
        url: rawUrl.startsWith("/api/") ? buildPublicApiUrl(rawUrl) : rawUrl,
        manualText: null
      };
    });
}

export function PublicEndpointConsole() {
  const [selectedId, setSelectedId] = useState(endpointPresets[0].id);
  const [paramsById, setParamsById] = useState<Record<string, Record<string, string>>>(
    Object.fromEntries(endpointPresets.map((preset) => [preset.id, preset.params]))
  );
  const [results, setResults] = useState<EndpointResult[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [batchInput, setBatchInput] = useState(
    [
      "GET /api/public/gpt-briefing?profile=liquidity_cycle_v1&timeframe=1h&range=30d",
      "GET /api/public/direction?timeframe=1h&limit=5&universe=24",
      "GET /api/public/sector-flow?timeframe=1h&universe=24",
      "GET /api/public/opportunity?timeframe=1h&universe=24&limit=6",
      "GET /api/private/tradingview/summary"
    ].join("\n")
  );
  const [batchOutput, setBatchOutput] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [tradingViewMetric, setTradingViewMetric] = useState("BTC_D");
  const [tradingViewSource, setTradingViewSource] = useState("TradingView CSV");
  const [tradingViewCsv, setTradingViewCsv] = useState("");
  const [tradingViewSummary, setTradingViewSummary] = useState<TradingViewSummaryRow[]>([]);
  const [tradingViewMessage, setTradingViewMessage] = useState("");
  const [tradingViewError, setTradingViewError] = useState("");
  const [tradingViewLoading, setTradingViewLoading] = useState(false);

  const selectedPreset = useMemo(
    () => endpointPresets.find((preset) => preset.id === selectedId) || endpointPresets[0],
    [selectedId]
  );
  const selectedParams = paramsById[selectedPreset.id] || {};

  useEffect(() => {
    void loadTradingViewSummary();
  }, []);

  function updateParam(key: string, value: string) {
    setParamsById((current) => ({
      ...current,
      [selectedPreset.id]: {
        ...(current[selectedPreset.id] || {}),
        [key]: value
      }
    }));
  }

  async function runEndpoint(preset: EndpointPreset) {
    const params = paramsById[preset.id] || {};
    const url = buildPublicApiUrl(preset.path, params);
    setRunningId(preset.id);

    try {
      const response = await fetch(url, { headers: { accept: "application/json,text/markdown,text/plain" } });
      const text = prettyPrint(await response.text());
      const result: EndpointResult = {
        id: `${preset.id}-${Date.now()}`,
        label: preset.label,
        url,
        status: response.status,
        fetchedAt: new Date().toISOString(),
        text,
        error: response.ok ? null : `HTTP ${response.status}`
      };
      setResults((current) => [result, ...current].slice(0, 12));
    } catch (error) {
      setResults((current) => [
        {
          id: `${preset.id}-${Date.now()}`,
          label: preset.label,
          url,
          status: null,
          fetchedAt: new Date().toISOString(),
          text: "",
          error: error instanceof Error ? error.message : "Request failed"
        },
        ...current
      ].slice(0, 12));
    } finally {
      setRunningId(null);
    }
  }

  async function runSelected() {
    await runEndpoint(selectedPreset);
  }

  async function runAll() {
    for (const preset of endpointPresets) {
      await runEndpoint(preset);
    }
  }

  async function loadTradingViewSummary() {
    setTradingViewLoading(true);
    setTradingViewError("");

    try {
      const response = await fetch(buildPublicApiUrl("/api/private/tradingview/summary"), {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      setTradingViewSummary(Array.isArray(payload.series) ? payload.series : []);
    } catch (error) {
      setTradingViewSummary([]);
      setTradingViewError(error instanceof Error ? error.message : "TradingView summary request failed");
    } finally {
      setTradingViewLoading(false);
    }
  }

  async function importTradingViewCsv() {
    setTradingViewLoading(true);
    setTradingViewError("");
    setTradingViewMessage("");

    try {
      const body = new URLSearchParams();
      body.set("metric", tradingViewMetric);
      body.set("source", tradingViewSource);
      body.set("csv", tradingViewCsv);

      const response = await fetch(buildPublicApiUrl("/api/private/tradingview/import"), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      setTradingViewMessage(`${payload.metric || tradingViewMetric}: ${payload.rows ?? 0} rows imported.`);
      setTradingViewCsv("");
      await loadTradingViewSummary();
    } catch (error) {
      setTradingViewError(error instanceof Error ? error.message : "TradingView CSV import failed");
    } finally {
      setTradingViewLoading(false);
    }
  }

  function downloadResult(result: EndpointResult) {
    const filename = `gainob-${result.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${result.fetchedAt.slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    const body = [
      `Endpoint: ${result.label}`,
      `URL: ${result.url}`,
      `Status: ${result.status ?? "-"}`,
      `Fetched At: ${result.fetchedAt}`,
      "",
      result.error ? `Error: ${result.error}` : result.text
    ].join("\n");

    downloadText(filename, body);
  }

  function downloadAll() {
    const body = results
      .map((result) => [
        `# ${result.label}`,
        `URL: ${result.url}`,
        `Status: ${result.status ?? "-"}`,
        `Fetched At: ${result.fetchedAt}`,
        "",
        result.error ? `Error: ${result.error}` : result.text
      ].join("\n"))
      .join("\n\n---\n\n");

    downloadText(`gainob-public-api-results-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`, body || "No results.");
  }

  async function runBatch() {
    const entries = parseBatchInput(batchInput);
    const generatedAt = new Date().toISOString();
    const sections = [
      "=== GPT PASTED BATCH EXPORT ===",
      `GENERATED_AT: ${generatedAt}`,
      `ITEM_COUNT: ${entries.length}`,
      ""
    ];

    if (!entries.length) {
      setBatchOutput([...sections, "No batch items.", "", "=== END GPT PASTED BATCH EXPORT ==="].join("\n"));
      return;
    }

    setBatchRunning(true);

    try {
      for (const entry of entries) {
        sections.push(`## ${entry.label}`);
        sections.push(`SOURCE: ${entry.source}`);

        if (entry.manualText) {
          sections.push("TYPE: text");
          sections.push("");
          sections.push(entry.manualText);
          sections.push("");
          continue;
        }

        if (!entry.url) {
          sections.push("STATUS: unavailable");
          sections.push("");
          continue;
        }

        sections.push(`URL: ${entry.url}`);

        try {
          const response = await fetch(entry.url, {
            headers: { accept: "application/json,text/markdown,text/plain" }
          });
          const text = prettyPrint(await response.text());
          sections.push(`STATUS: ${response.status}`);
          sections.push("");
          sections.push(text);
        } catch (error) {
          sections.push("STATUS: unavailable");
          sections.push("");
          sections.push(error instanceof Error ? error.message : "Request failed");
        }

        sections.push("");
      }

      sections.push("=== END GPT PASTED BATCH EXPORT ===");
      setBatchOutput(sections.join("\n"));
    } finally {
      setBatchRunning(false);
    }
  }

  function downloadBatch() {
    downloadText(
      `gainob-gpt-pasted-batch-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`,
      batchOutput || "No batch output."
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Public Endpoint Console</h2>
          <p className="mt-1 text-sm text-slate-500">공개 API를 한 화면에서 호출하고 응답을 텍스트 파일로 저장합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runSelected}
            disabled={runningId !== null}
            className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run Selected
          </button>
          <button
            type="button"
            onClick={runAll}
            disabled={runningId !== null}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run All
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={!results.length}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download All
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {endpointPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedId(preset.id)}
              className={`w-full rounded-md border px-3 py-3 text-left ${
                selectedId === preset.id ? "border-moss bg-emerald-50" : "border-line bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{preset.label}</span>
                {runningId === preset.id && <span className="text-xs font-semibold text-moss">Running</span>}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
            </button>
          ))}
        </div>

        <div className="min-w-0">
          <div className="rounded-lg border border-line bg-slate-50 p-4">
            <div className="text-sm font-semibold text-ink">{selectedPreset.path}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.keys(selectedPreset.params).length ? (
                Object.keys(selectedPreset.params).map((key) => (
                  <label key={key} className="text-xs font-semibold text-slate-500">
                    {key}
                    <input
                      value={selectedParams[key] || ""}
                      onChange={(event) => updateParam(key, event.target.value)}
                      className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-moss"
                    />
                  </label>
                ))
              ) : (
                <div className="text-sm text-slate-500">No query parameters</div>
              )}
            </div>
            <div className="mt-3 break-all rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-600">
              {buildPublicApiUrl(selectedPreset.path, selectedParams)}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <section className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">TradingView Data</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    BTC.D, ETH.D, TOTAL3 CSV를 저장하고 현재 DB 적재 상태를 확인합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadTradingViewSummary}
                  disabled={tradingViewLoading}
                  className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh Storage
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-md border border-line">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="border-b border-line px-3 py-2 font-semibold">Metric</th>
                      <th className="border-b border-line px-3 py-2 font-semibold">Rows</th>
                      <th className="border-b border-line px-3 py-2 font-semibold">Start</th>
                      <th className="border-b border-line px-3 py-2 font-semibold">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradingViewSummary.length ? (
                      tradingViewSummary.map((row) => (
                        <tr key={row.metric}>
                          <td className="border-b border-line px-3 py-2 font-semibold text-ink">{row.metric}</td>
                          <td className="border-b border-line px-3 py-2 text-slate-600">{row.rows}</td>
                          <td className="border-b border-line px-3 py-2 text-slate-600">{row.start_date ? String(row.start_date).slice(0, 10) : "-"}</td>
                          <td className="border-b border-line px-3 py-2 text-slate-600">{row.end_date ? String(row.end_date).slice(0, 10) : "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-slate-500">
                          {tradingViewLoading ? "Loading..." : "No TradingView rows stored yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                <label className="text-xs font-semibold text-slate-500">
                  Metric
                  <select
                    value={tradingViewMetric}
                    onChange={(event) => setTradingViewMetric(event.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-moss"
                  >
                    <option value="BTC_D">BTC.D</option>
                    <option value="ETH_D">ETH.D</option>
                    <option value="TOTAL3">TOTAL3</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Source
                  <input
                    value={tradingViewSource}
                    onChange={(event) => setTradingViewSource(event.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-moss"
                  />
                </label>
              </div>
              <textarea
                value={tradingViewCsv}
                onChange={(event) => setTradingViewCsv(event.target.value)}
                placeholder={"date,close\n2024-01-01,52.1\n2024-01-02,52.4"}
                className="mt-3 min-h-32 w-full resize-y rounded-md border border-line bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-ink outline-none focus:border-moss"
                spellCheck={false}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={importTradingViewCsv}
                  disabled={tradingViewLoading || !tradingViewCsv.trim()}
                  className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Import CSV
                </button>
                {tradingViewMessage && <span className="text-xs font-semibold text-moss">{tradingViewMessage}</span>}
                {tradingViewError && <span className="text-xs font-semibold text-brick">{tradingViewError}</span>}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">GPT Paste Batch</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    GPT가 출력한 여러 줄의 endpoint나 텍스트 항목을 그대로 붙여넣고, 하나의 텍스트 결과로 합칩니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runBatch}
                    disabled={batchRunning}
                    className="rounded-md bg-moss px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Run Pasted Batch
                  </button>
                  <button
                    type="button"
                    onClick={downloadBatch}
                    disabled={!batchOutput}
                    className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Download Batch TXT
                  </button>
                </div>
              </div>
              <textarea
                value={batchInput}
                onChange={(event) => setBatchInput(event.target.value)}
                className="mt-3 min-h-36 w-full resize-y rounded-md border border-line bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-ink outline-none focus:border-moss"
                spellCheck={false}
              />
              {batchOutput && (
                <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {batchOutput}
                </pre>
              )}
            </section>

            {results.length ? (
              results.map((result) => (
                <article key={result.id} className="overflow-hidden rounded-lg border border-line bg-white">
                  <div className="flex flex-col gap-2 border-b border-line bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{result.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${result.error ? "bg-rose-50 text-brick" : "bg-emerald-50 text-moss"}`}>
                          {result.status ?? "ERR"}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">{result.url}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadResult(result)}
                      className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink"
                    >
                      Download TXT
                    </button>
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-5 text-slate-700">
                    {result.error ? result.error : result.text}
                  </pre>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-line p-6 text-sm text-slate-500">
                실행한 공개 API 응답이 여기에 표시됩니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

