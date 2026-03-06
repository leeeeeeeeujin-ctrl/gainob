const { startServer } = require("../src/web-handler");

async function main() {
  const server = startServer(3476);

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const path = "/api/public/readme?format=json";
    const response = await fetch(`http://localhost:3476${path}`);
    const json = await response.json();
    console.log(`PATH ${path}`);
    console.log(`STATUS ${response.status}`);
    console.log(`LENGTH ${JSON.stringify(json).length}`);
    console.log('SAMPLE', json.content.slice(0,200));
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
