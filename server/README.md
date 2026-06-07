# Gainob Express Server

This directory is the server entrypoint for the existing Express API.

The current implementation remains in `../src` to avoid disrupting the existing Vercel function and local scripts. New frontend code should call the public API through:

```text
GET /api/public/liquidity-dashboard
```

Liquidity dashboard data is served by the public data provider in `src/liquidity-dashboard.js`.
Current sources are CoinGecko, Binance with CoinGecko fallback, DefiLlama, optional SoSoValue ETF flow when an API key is configured, and Farside public ETF tables as the no-key ETF fallback.
