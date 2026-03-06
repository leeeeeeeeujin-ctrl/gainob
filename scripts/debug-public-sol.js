const { startServer } = require("../src/web-handler");

async function main() {
  const server = startServer(3473);

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const path = "/api/public/market?symbol=SOL&timeframe=1h&candles=6&trades=5&orderbookDepth=10";
    const response = await fetch(`http://localhost:3473${path}`);
    const text = await response.text();
    console.log(`PATH ${path}`);
    console.log(`STATUS ${response.status}`);
    console.log(`LENGTH ${text.length}`);
    try {
      const json = JSON.parse(text);
      console.log('TOP_LEVEL_KEYS', Object.keys(json));
      console.log('openInterest', json.openInterest, 'fundingRate', json.fundingRate, 'serverTime', json.serverTime);
      if (json.candles) console.log('candles.length', json.candles.length);
      if (json.recentTrades) console.log('recentTrades.length', json.recentTrades.length);
    } catch (e) {
      console.log(text.slice(0,2000));
    }
  } finally {
    server.close();
  }
}

main().catch((err)=>{console.error(err); process.exit(1);});
