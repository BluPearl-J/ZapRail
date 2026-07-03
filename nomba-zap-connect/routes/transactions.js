const express = require('express');
const db = require('../db');
const { requireApiKey } = require('../lib/auth');

const router = express.Router();
router.use(requireApiKey);

// List transactions — used by the Lovable dashboard table
router.get('/', (req, res) => {
  const { status, limit } = req.query;
  const rows = db.transactions.list({ status, limit: limit ? Number(limit) : 50 });
  res.json(rows);
});

// Single transaction lookup by reference — also used as a Zapier
// "Find Transaction" action
router.get('/:reference', (req, res) => {
  const row = db.transactions.getByReference(req.params.reference);
  if (!row) return res.status(404).json({ error: 'Transaction not found' });
  res.json(row);
});

module.exports = router;
