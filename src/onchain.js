const fetch = require('node-fetch');

const COVALENT_API_KEY = process.env.COVALENT_API_KEY || '';

// Example hotwallet addresses (publicly known exchange deposit wallets).
// These are examples; replace/extend with maintained list for production.
const EXCHANGE_WALLETS = {
  binance: [
    '0x28C6c06298d514Db089934071355E5743bf21d60',
    '0xF977814e90dA44bFA03b6295A0616a897441aceC'
  ],
  coinbase: [
    '0x3f5CE5FBFe3E9af3971dD833D26BA9b5C936f0bE'
  ]
};

const TOKEN_CONTRACTS = {
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9eb0ce3606eb48'
};

async function fetchCovalentTransfers(chainId, address, contractAddress, pageSize = 100) {
  if (!COVALENT_API_KEY) throw new Error('COVALENT_API_KEY not configured');
  const url = `https://api.covalenthq.com/v1/${chainId}/address/${address}/transfers_v2/?contract-address=${contractAddress}&page-size=${pageSize}&key=${COVALENT_API_KEY}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Covalent request failed: ${res.status}`);
  const payload = await res.json();
  return payload.data && Array.isArray(payload.data.items) ? payload.data.items : [];
}

async function getDepositMetrics({ symbols = ['USDT','USDC'], exchanges = ['binance','coinbase'], windowMinutes = 60, chainId = 1 }) {
  // returns { symbol: { exchange: { count, volume, usdVolume } } }
  const endTs = Date.now();
  const startTs = endTs - windowMinutes * 60 * 1000;

  const results = {};

  for (const sym of symbols) {
    const contract = TOKEN_CONTRACTS[sym];
    if (!contract) continue;
    results[sym] = {};

    for (const ex of exchanges) {
      const wallets = EXCHANGE_WALLETS[ex] || [];
      let totalCount = 0;
      let totalValue = 0;

      for (const w of wallets) {
        try {
          const items = await fetchCovalentTransfers(chainId, w, contract);
          for (const it of items) {
            // Covalent returns "confirmed_at" and "delta" or "value" fields
            const timestamp = it.block_signed_at ? new Date(it.block_signed_at).getTime() : null;
            if (!timestamp || timestamp < startTs) continue;
            // value often in token's smallest unit, use 'delta' or 'value'
            const rawValue = Number(it.delta) || Number(it.value) || 0;
            // convert using contract decimals if available
            const decimals = it.contract_decimals || 6; // USDT historically 6
            const value = rawValue / Math.pow(10, decimals);
            totalCount += 1;
            totalValue += value;
          }
        } catch (_e) {
          // ignore per-wallet failures
        }
      }

      results[sym][ex] = { count: totalCount, volume: totalValue, windowMinutes };
    }
  }

  return results;
}

module.exports = {
  getDepositMetrics,
  EXCHANGE_WALLETS,
  TOKEN_CONTRACTS
};
