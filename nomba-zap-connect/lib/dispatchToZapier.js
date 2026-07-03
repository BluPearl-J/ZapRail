const axios = require('axios');
const db = require('../db');

/**
 * Pushes a payload to every Zap currently subscribed to a given trigger.
 * This is what makes triggers instant (REST Hooks) instead of Zapier
 * having to poll our API every few minutes.
 *
 * Failures are logged but never thrown — a dead Zap subscription should
 * never break webhook processing for everyone else.
 */
async function dispatchToZapier(triggerType, payload) {
  const subs = db.zapSubscriptions.listByTrigger(triggerType);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await axios.post(sub.target_url, payload, { timeout: 5000 });
      } catch (err) {
        console.error(
          `[zapier-dispatch] failed for sub ${sub.id} (${sub.target_url}): ${err.message}`
        );
        // In production: track consecutive failure count per subscription
        // and auto-remove dead hooks after N failures (Zapier convention).
      }
    })
  );
}

module.exports = { dispatchToZapier };
