/**
 * Simulates Nomba sending a signed webhook to your local server.
 * Run the server first (npm start), then:
 *   node scripts/send-test-webhook.js
 */
require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const secret = process.env.NOMBA_WEBHOOK_SECRET || 'test_secret';
const timestamp = Date.now().toString();

const payload = {
  eventId: `evt_${timestamp}`,
  eventType: 'payment_success',
  data: {
    transactionId: `txn_${timestamp}`,
    requestId: `req_${timestamp}`,
    userId: 'user_test_001',
    walletId: 'wallet_test_001',
    type: 'payment',
    time: new Date().toISOString(),
    responseCode: '00',
    amount: 5000,
    currency: 'NGN',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
  },
};

// Build signing payload matching real Nomba scheme:
// event_type:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp
const d = payload.data;
const signingPayload = [
  payload.eventType,
  d.requestId,
  d.userId,
  d.walletId,
  d.transactionId,
  d.type,
  d.time,
  d.responseCode,
  timestamp,
].join(':');

const signature = crypto
  .createHmac('sha256', secret)
  .update(signingPayload)
  .digest('base64');

const rawBody = Buffer.from(JSON.stringify(payload));

axios
  .post(`${BASE_URL}/webhooks/nomba`, rawBody, {
    headers: {
      'Content-Type': 'application/json',
      'nomba-signature': signature,
      'nomba-timestamp': timestamp,
    },
  })
  .then((res) => console.log('✓ Webhook accepted:', res.data))
  .catch((err) => console.error('✗ Webhook rejected:', err.response?.data || err.message));
