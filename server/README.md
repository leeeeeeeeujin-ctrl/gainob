# Gainob Express Server

This directory is the server entrypoint for the existing Express API.

The current implementation remains in `../src` to avoid disrupting the existing Vercel function and local scripts. New frontend code should call the public API through:

```text
GET /api/public/liquidity-dashboard
```

MVP data is served by a mock liquidity dashboard provider. Replace `src/liquidity-dashboard.js` with real provider implementations when the data source plan is finalized.
