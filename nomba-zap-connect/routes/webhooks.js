const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../db');
const { verifyNombaSignature, HEADER_NAME, TIMESTAMP_HEADER } = require('../lib/verifySignature');
const { dispatchToZapier } = require('../lib/dispatchToZapier');

const router = express.Router();

async function sendTelegramAlert(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        }).catch(err => console.error("Telegram Alert Failed:", err.message));
    } catch (err) {
        console.error("Critical Alerting Error:", err);
    }
}

router.post('/', async (req, res) => {
    const rawBody = req.body;
    const signature = req.header(HEADER_NAME);
    const timestamp = req.header(TIMESTAMP_HEADER);
    const secret = process.env.NOMBA_WEBHOOK_SECRET;

    let payload;
    try {
        payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const eventId = payload.eventId || payload.id;
    const eventType = payload.eventType || payload.type || 'unknown';

    if (!eventId) {
        return res.status(400).json({ error: 'Missing eventId on webhook payload' });
    }

    if (db.webhookEvents.exists(eventId)) {
        return res.status(200).json({ received: true, duplicate: true });
    }

    // --- DEBUG PROBE START ---
    const signingPayloadDebug = [
        payload.eventType || '',
        (payload.data || {}).requestId || '',
        (payload.data || {}).userId || '',
        (payload.data || {}).walletId || '',
        (payload.data || {}).transactionId || '',
        (payload.data || {}).type || '',
        (payload.data || {}).time || '',
        (payload.data || {}).responseCode || '',
        timestamp || '',
    ].join(':');

    console.log("DEBUG: String server is HASHING:", signingPayloadDebug);
    // --- DEBUG PROBE END ---

    const signatureValid = verifyNombaSignature(rawBody, signature, timestamp, secret);

    db.webhookEvents.insert({
        id: uuidv4(),
        event_id: eventId,
        event_type: eventType,
        payload,
        signature_valid: signatureValid,
        received_at: new Date().toISOString(),
    });

    if (!signatureValid) {
        console.warn(`[webhook] REJECTED invalid signature for event ${eventId}`);
        return res.status(401).json({ error: 'Invalid signature' });
    }

    res.status(200).json({ received: true });

    const data = payload.data || {};

    if (eventType === 'payment_success' || eventType === 'payment_failed') {
        const status = eventType === 'payment_success' ? 'success' : 'failed';
        db.transactions.upsert({
            id: uuidv4(),
            reference: data.transactionId || eventId,
            customer_name: data.customerName || null,
            customer_email: data.customerEmail || null,
            amount: data.amount || 0,
            currency: data.currency || 'NGN',
            status,
            raw_payload: data,
            created_at: new Date().toISOString(),
        });
        sendTelegramAlert(`${status === 'success' ? '✅' : '❌'} *Payment ${status === 'success' ? 'Success' : 'Failed'}*\nRef: ${data.transactionId}\nAmt: ${data.amount} ${data.currency || 'NGN'}`);
        await dispatchToZapier(status === 'success' ? 'new_transaction' : 'payment_failed', {
            transactionId: data.transactionId,
            amount: data.amount,
            currency: data.currency || 'NGN',
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            status,
            occurredAt: new Date().toISOString(),
        });
    }

    if (eventType === 'payout_success' || eventType === 'payout_failed') {
        await dispatchToZapier(eventType, {
            transactionId: data.transactionId,
            amount: data.amount,
            currency: data.currency || 'NGN',
            status: eventType === 'payout_success' ? 'success' : 'failed',
            occurredAt: new Date().toISOString(),
        });
    }

    if (eventType === 'payout_refund' || eventType === 'payment_reversal') {
        db.refunds.updateStatusByReference(data.transactionId, 'processed');
        sendTelegramAlert(`🔄 *${eventType} processed*\nRef: ${data.transactionId}`);
        await dispatchToZapier('refund_completed', {
            transactionId: data.transactionId,
            amount: data.amount,
            eventType,
            occurredAt: new Date().toISOString(),
        });
    }
});

module.exports = router;