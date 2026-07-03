require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Ensure this points to your db.js

const webhooksRouter = require('./routes/webhooks');
const transactionsRouter = require('./routes/transactions');
const refundsRouter = require('./routes/refunds');
const zapierRouter = require('./routes/zapier');

const app = express();

app.use(cors());

// Webhook route
app.use('/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

app.use(express.json());

app.use('/transactions', transactionsRouter);
app.use('/refunds', refundsRouter);
app.use('/zapier', zapierRouter);

// PRO HEALTH CHECK
app.get('/health', (req, res) => {
    const isDbReady = db.isConnected();

    if (!isDbReady) {
        return res.status(503).json({ status: 'error', message: 'Database connection failed' });
    }

    res.json({
        status: 'ok',
        service: 'nomba-zap-connect',
        db: 'connected',
        time: new Date().toISOString()
    });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`nomba-zap-connect listening on port ${PORT}`);
});