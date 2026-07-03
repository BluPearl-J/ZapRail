const axios = require('axios');

const NOMBA_API_BASE = process.env.NOMBA_API_BASE || 'https://api.nomba.com';

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  const { data } = await axios.post(`${NOMBA_API_BASE}/v1/auth/token/issue`, {
    grant_type: 'client_credentials',
    client_id: process.env.NOMBA_CLIENT_ID,
    client_secret: process.env.NOMBA_PRIVATE_KEY,
  });

  cachedToken = data.access_token;
  // Refresh a minute early to avoid edge-of-expiry failures
  cachedTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function nombaRequest(method, path, body, extraHeaders = {}) {
  const token = await getAccessToken();
  const response = await axios({
    method,
    url: `${NOMBA_API_BASE}${path}`,
    data: body,
    headers: {
      Authorization: `Bearer ${token}`,
      // accountId goes in the header per real Nomba docs, NOT in the body
      accountId: process.env.NOMBA_ACCOUNT_ID,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
  return response.data;
}

// Real Nomba refund endpoint: POST /v1/checkout/refund
// Required field: transactionId (not transactionReference)
// Idempotency-Key header passed through so Nomba deduplicates on their side too
async function issueRefund({ transactionId, amount, reason, idempotencyKey }) {
  return nombaRequest(
    'POST',
    '/v1/checkout/refund',
    { transactionId, amount, reason },
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  );
}

async function fetchTransaction(transactionId) {
  return nombaRequest('GET', `/v1/transactions/${transactionId}`);
}

module.exports = { issueRefund, fetchTransaction, getAccessToken };
