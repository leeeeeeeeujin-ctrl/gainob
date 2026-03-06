const { startServer } = require("../src/web-handler");

async function main() {
  const server = startServer(3471);

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    for (const path of ["/api/market?symbol=BTC&timeframe=6h", "/api/intelligence?symbol=BTC"]) {
      const response = await fetch(`http://localhost:3471${path}`);
      const text = await response.text();
      console.log(`PATH ${path}`);
      console.log(`STATUS ${response.status}`);
      console.log(text);
    }
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
