const { startServer } = require("../src/web-handler");

async function main() {
  const server = startServer(3475);

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const path = "/api/public/readme";
    const response = await fetch(`http://localhost:3475${path}`);
    const text = await response.text();
    console.log(`PATH ${path}`);
    console.log(`STATUS ${response.status}`);
    console.log(`LENGTH ${text.length}`);
    console.log("--- SAMPLE START ---");
    console.log(text.slice(0, 2000));
    console.log("--- SAMPLE END ---");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
