const express = require("express");
const path = require("path");
const { analyzeContext } = require("./ai");
const { createModuleContext } = require("./core/module-context");
const { getMarketSnapshot, getSupportedCoins } = require("./market");
const modules = require("./modules");

const moduleContext = createModuleContext(modules);
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    now: new Date().toISOString()
  });
});

app.get("/api/coins", (_request, response) => {
  response.json({
    coins: getSupportedCoins(),
    localExchange: "Bithumb",
    benchmarkExchange: "Binance"
  });
});

app.get("/api/modules", (_request, response) => {
  response.json({
    modules: moduleContext.listModules()
  });
});

app.get("/api/market/:symbol", async (request, response) => {
  try {
    const symbol = String(request.params.symbol || "").toUpperCase();
    const snapshot = await getMarketSnapshot(symbol);

    response.json(snapshot);
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

app.post("/api/context", async (request, response) => {
  try {
    const symbol = String(request.body.symbol || "").toUpperCase();
    const context = await moduleContext.collect({
      symbol,
      moduleIds: request.body.modules,
      profile: request.body.profile,
      journal: request.body.journal
    });
    const marketModule = context.modules.find((module) => module.id === "market" && module.status === "ok");

    response.json({
      context,
      snapshot: marketModule?.data || null
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

app.post("/api/analyze", async (request, response) => {
  try {
    const symbol = String(request.body.symbol || "").toUpperCase();
    const context = await moduleContext.collect({
      symbol,
      moduleIds: request.body.modules,
      profile: request.body.profile,
      journal: request.body.journal
    });
    const promptSections = moduleContext.buildPromptSections(context);
    const result = await analyzeContext(context, promptSections);
    const marketModule = context.modules.find((module) => module.id === "market" && module.status === "ok");

    response.json({
      context,
      snapshot: marketModule?.data || null,
      ...result
    });
  } catch (error) {
    response.status(400).json({
      error: error.message
    });
  }
});

function startServer(port = Number(process.env.PORT || 3000)) {
  return app.listen(port, () => {
    console.log(`coin-ai-briefing listening on http://localhost:${port}`);
  });
}

module.exports = app;
module.exports.startServer = startServer;
