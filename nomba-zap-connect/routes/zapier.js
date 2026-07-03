const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireApiKey } = require('../lib/auth');

const router = express.Router();
router.use(requireApiKey);

const VALID_TRIGGERS = [
  'new_transaction',
  'payment_failed',
  'refund_completed',
  'webhook_received',
];

// Called automatically by the Zapier CLI app when a user turns a Zap ON.
// Zapier sends us the target URL it wants events POSTed to.
router.post('/subscribe', (req, res) => {
  const { triggerType, targetUrl } = req.body;

  if (!VALID_TRIGGERS.includes(triggerType) || !targetUrl) {
    return res.status(400).json({ error: 'Invalid triggerType or missing targetUrl' });
  }

  const id = uuidv4();
  db.zapSubscriptions.insert({ id, trigger_type: triggerType, target_url: targetUrl });

  res.status(201).json({ id });
});

// Called automatically when a user turns a Zap OFF.
router.delete('/unsubscribe/:id', (req, res) => {
  db.zapSubscriptions.remove(req.params.id);
  res.status(200).json({ deleted: true });
});

// Polling fallback (Zapier requires this for every REST Hook trigger so
// it can show sample data in the Zap editor, and as a backup if REST
// Hooks delivery ever fails). Returns the most recent events as a list.
router.get('/poll/:triggerType', (req, res) => {
  const { triggerType } = req.params;

  if (triggerType === 'new_transaction' || triggerType === 'payment_failed') {
    const status = triggerType === 'new_transaction' ? 'success' : 'failed';
    return res.json(db.transactions.list({ status, limit: 20 }));
  }

  if (triggerType === 'refund_completed') {
    return res.json(db.refunds.list().filter((r) => r.status === 'processed').slice(0, 20));
  }

  if (triggerType === 'webhook_received') {
    return res.json(db.webhookEvents.list(20));
  }

  res.status(400).json({ error: 'Unknown trigger type' });
});

module.exports = router;
