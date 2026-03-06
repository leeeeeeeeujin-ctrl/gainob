const { startServer } = require("../src/web-handler");

async function main() {
  const server = startServer(3472);

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const paths = [
      "/api/public/market?symbol=BTC&timeframe=1h",
      "/api/public/liquidity?symbol=BTC",
      "/api/public/structure?symbol=BTC"
    ];

    for (const path of paths) {
      const response = await fetch(`http://localhost:3472${path}`);
      const text = await response.text();
      console.log(`PATH ${path}`);
      console.log(`STATUS ${response.status}`);
      console.log(`LENGTH ${text.length}`);

      try {
        const json = JSON.parse(text);
        console.log('TOP_LEVEL_KEYS', Object.keys(json));
        if (json.candles) console.log('candles.length', json.candles.length);
        if (json.recentTrades) console.log('recentTrades.length', json.recentTrades.length);
        if (json.orderbook && json.orderbook.bids) console.log('orderbook.bids.length', json.orderbook.bids.length);
        if (json.multiTimeframes) console.log('multiTimeframes.length', json.multiTimeframes.length);
        if (json.annotations) console.log('annotations.length', json.annotations.length);
        console.log('SAMPLE', JSON.stringify({ symbol: json.symbol, timeframe: json.timeframe, fetchedAt: json.fetchedAt }, null, 0));
      } catch (e) {
        console.log(text.slice(0, 2000));
      }

      console.log("--- TRUNCATED ---\n");
    }
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
