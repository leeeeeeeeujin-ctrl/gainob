require("dotenv").config();

const app = require("./web-handler");

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`coin-ai-briefing listening on http://localhost:${port}`);
});
