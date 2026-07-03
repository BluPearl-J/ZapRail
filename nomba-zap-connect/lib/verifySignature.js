const crypto = require('crypto');

const HEADER_NAME = 'nomba-signature';
const TIMESTAMP_HEADER = 'nomba-timestamp';

function buildSigningPayload(payload, timestamp) {
    const d = payload.data || {};
    const parts = [
        payload.eventType || '',
        d.requestId || '',
        d.userId || '',
        d.walletId || '',
        d.transactionId || '',
        d.type || '',
        d.time || '',
        d.responseCode || '',
        timestamp || '',
    ];
    return parts.join(':');
}

function verifyNombaSignature(rawBody, signatureHeader, timestampHeader, secret) {
    if (!signatureHeader || !secret) return false;

    let payload;
    try {
        payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
        return false;
    }

    const signingPayload = buildSigningPayload(payload, timestampHeader);

    const expected = crypto
        .createHmac('sha256', secret)
        .update(signingPayload)
        .digest('base64');

    // --- THESE ARE THE LINES YOU ARE ADDING ---
    console.log("DEBUG: Provided Signature (from Header):", signatureHeader);
    console.log("DEBUG: Calculated Signature (by Server):", expected);
    // ------------------------------------------

    // Timing-safe compare (both base64 strings)
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyNombaSignature, HEADER_NAME, TIMESTAMP_HEADER };