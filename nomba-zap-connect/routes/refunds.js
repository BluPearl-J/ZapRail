const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireApiKey } = require('../lib/auth');
const { issueRefund } = require('../lib/nombaClient');
const { dispatchToZapier } = require('../lib/dispatchToZapier');

const router = express.Router();
router.use(requireApiKey);

// Issue a refund via Nomba POST /v1/checkout/refund
// Required field: transactionId (NOT transactionReference per real Nomba docs)
// accountId is passed as a header inside nombaClient, not in the body
router.post('/', async (req, res) => {
  const { transactionId, amount, reason } = req.body;

  if (!transactionId || !amount) {
    return res.status(400).json({ error: 'transactionId and amount are required' });
  }

  const txn = db.transactions.getByReference(transactionId);
  if (!txn) {
    return res.status(404).json({ error: 'Unknown transactionId' });
  }

  // Idempotency guard: prevent double refunds on retry / double-click
  const existingRefund = db.refunds.findActiveByReference(transactionId);
  if (existingRefund) {
    return res.status(409).json({
      error: 'A refund for this transaction is already pending or processed',
      refund: existingRefund,
    });
  }

  const refundId = uuidv4();

  db.refunds.insert({
    id: refundId,
    transaction_id: transactionId,
    amount,
    status: 'pending',
    reason: reason || null,
    created_at: new Date().toISOString(),
  });

  try {
    // Idempotency key header sent to Nomba so their side also deduplicates
    await issueRefund({ transactionId, amount, reason, idempotencyKey: refundId });
    res.status(202).json({ id: refundId, status: 'pending', transactionId, amount });
  } catch (err) {
    db.refunds.updateStatusById(refundId, 'rejected');

    await dispatchToZapier('refund_completed', {
      transactionId,
      amount,
      status: 'rejected',
      reason: err.message,
    });

    res.status(502).json({ error: 'Refund request to Nomba failed', detail: err.message });
  }
});

router.get('/', (req, res) => {
  res.json(db.refunds.list());
});

module.exports = router;
