const app = require("../src/web-handler");

module.exports = (request, response) => {
  const url = new URL(request.url, "https://gainob.local");
  const endpoint = String(url.searchParams.get("endpoint") || "health").replace(/^\/+/, "");

  url.searchParams.delete("endpoint");
  request.url = `/api/${endpoint}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;

  return app(request, response);
};
