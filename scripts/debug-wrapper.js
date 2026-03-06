const apiHandler = require("../api/index");

function call(url) {
  return new Promise((resolve, reject) => {
    const request = {
      url,
      method: "GET",
      headers: {}
    };

    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      getHeader(name) {
        return this.headers[name];
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({
          statusCode: this.statusCode,
          payload
        });
      },
      end(payload) {
        resolve({
          statusCode: this.statusCode,
          payload
        });
      }
    };

    try {
      apiHandler(request, response);
    } catch (error) {
      reject(error);
    }
  });
}

async function main() {
  for (const url of ["/api?endpoint=market&symbol=BTC&timeframe=6h", "/api?endpoint=intelligence&symbol=BTC"]) {
    const result = await call(url);
    console.log(`URL ${url}`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
