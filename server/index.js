const app = require("../src/web-handler");

const port = Number(process.env.PORT || 3000);

app.startServer ? app.startServer(port) : app.listen(port, () => {
  console.log(`gainob server listening on http://localhost:${port}`);
});
