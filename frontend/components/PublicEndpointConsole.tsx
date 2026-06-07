"use client";

import { useMemo, useState } from "react";
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

export function PublicEndpointConsole() {
  const [selectedId, setSelectedId] = useState(endpointPresets[0].id);
  const [paramsById, setParamsById] = useState<Record<string, Record<string, string>>>(
    Object.fromEntries(endpointPresets.map((preset) => [preset.id, preset.params]))
  );
  const [results, setResults] = useState<EndpointResult[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => endpointPresets.find((preset) => preset.id === selectedId) || endpointPresets[0],
    [selectedId]
  );
  const selectedParams = paramsById[selectedPreset.id] || {};

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

