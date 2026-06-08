#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_OUT_DIR = "research_data";
const DEFAULT_BARS = 5000;
const SOCKET_URL = "wss://data.tradingview.com/socket.io/websocket";
const SYMBOLS = [
  { symbol: "CRYPTOCAP:BTC.D", file: "btc_d_daily.csv" },
  { symbol: "CRYPTOCAP:ETH.D", file: "eth_d_daily.csv" },
  { symbol: "CRYPTOCAP:TOTAL3", file: "total3_daily.csv" }
];

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const [key, ...valueParts] = item.slice(2).split("=");
    args[key] = valueParts.length ? valueParts.join("=") : true;
  }
  return args;
}

function session(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

function frame(name, params) {
  const payload = JSON.stringify({ m: name, p: params });
  return `~m~${payload.length}~m~${payload}`;
}

function parseFrames(buffer) {
  const messages = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf("~m~", cursor);
    if (start === -1) break;
    const lenStart = start + 3;
    const lenEnd = buffer.indexOf("~m~", lenStart);
    if (lenEnd === -1) break;
    const length = Number(buffer.slice(lenStart, lenEnd));
    const payloadStart = lenEnd + 3;
    const payload = buffer.slice(payloadStart, payloadStart + length);
    cursor = payloadStart + length;
    if (!payload || payload === "m~~h~") continue;
    try {
      messages.push(JSON.parse(payload));
    } catch {
      // Ignore heartbeat or malformed chunks.
    }
  }
  return messages;
}

function isoDate(seconds) {
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
}

function extractSeries(message) {
  const series = message?.p?.[1];
  if (!series) return [];
  const firstSeries = Object.values(series)[0];
  const points = firstSeries?.s || [];
  return points
    .map((point) => ({
      date: isoDate(point.v?.[0]),
      close: Number(point.v?.[4])
    }))
    .filter((point) => point.date && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fetchSymbol(symbol, bars) {
  return new Promise((resolve, reject) => {
    const chartSession = session("cs");
    const ws = new WebSocket(SOCKET_URL, {
      headers: {
        origin: "https://www.tradingview.com",
        "user-agent": "Mozilla/5.0 (compatible; GainobResearch/1.0)"
      }
    });
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // Ignore close errors.
      }
      reject(new Error(`Timed out fetching ${symbol}`));
    }, 30000);

    ws.onopen = () => {
      ws.send(frame("set_auth_token", ["unauthorized_user_token"]));
      ws.send(frame("chart_create_session", [chartSession, ""]));
      ws.send(frame("switch_timezone", [chartSession, "Etc/UTC"]));
      ws.send(frame("resolve_symbol", [chartSession, "symbol_1", `=${JSON.stringify({
        symbol,
        adjustment: "splits",
        session: "regular"
      })}`]));
      ws.send(frame("create_series", [chartSession, "s1", "s1", "symbol_1", "1D", bars]));
    };

    ws.onmessage = (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
      for (const message of parseFrames(text)) {
        if (message.m === "timescale_update") {
          const rows = extractSeries(message);
          if (rows.length) {
            clearTimeout(timeout);
            ws.close();
            resolve(rows);
            return;
          }
        }
        if (message.m === "critical_error" || message.m === "series_error") {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`${symbol}: ${JSON.stringify(message.p)}`));
          return;
        }
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      reject(new Error(`${symbol}: ${error.message || "websocket error"}`));
    };
  });
}

function writeCsv(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = ["date,close", ...rows.map((row) => `${row.date},${row.close}`)];
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.outDir || DEFAULT_OUT_DIR;
  const bars = Number(args.bars || DEFAULT_BARS);
  const summary = [];

  for (const item of SYMBOLS) {
    const rows = await fetchSymbol(item.symbol, bars);
    const file = path.join(outDir, item.file);
    writeCsv(file, rows);
    summary.push({
      symbol: item.symbol,
      file,
      rows: rows.length,
      start: rows[0]?.date || null,
      end: rows[rows.length - 1]?.date || null
    });
  }

  for (const item of summary) {
    console.log(`${item.symbol}: ${item.rows} rows ${item.start}..${item.end} -> ${item.file}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
