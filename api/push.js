/**
 * POST /api/push — Push a lead to a broker
 *
 * Body: { broker: "medianow", lead: { email, firstName, lastName, ... } }
 * Supports single lead or array of leads for bulk push.
 */

const { getBroker } = require('./lib/brokers');
const medianow = require('./lib/medianow');
const { addEntry } = require('./lib/push-log');

// Broker-specific push handlers
const pushHandlers = {
  async medianow(lead) {
    const result = await medianow.registerLead(lead);
    return {
      success: true,
      leadRequestID: result.details?.leadRequest?.ID || null,
      redirectUrl: result.details?.redirect?.url || null,
      advertiser: result.details?.advertiser?.name || null,
      offer: result.details?.offer?.name || null,
      raw: result,
    };
  },

  // Add more broker handlers here:
  // async exampleBroker(lead) { ... }
};

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { broker: brokerId, lead, leads } = req.body || {};

    if (!brokerId) return res.status(400).json({ error: 'Missing broker field' });

    const brokerConfig = getBroker(brokerId);
    const handler = pushHandlers[brokerId];
    if (!handler) return res.status(400).json({ error: `No push handler for broker: ${brokerId}` });

    // Bulk push
    if (Array.isArray(leads) && leads.length > 0) {
      const results = [];
      for (const singleLead of leads.slice(0, 100)) { // Cap at 100
        const result = await pushSingle(brokerId, brokerConfig, handler, singleLead);
        results.push(result);
      }
      return res.status(200).json({ results, count: results.length });
    }

    // Single push
    if (!lead) return res.status(400).json({ error: 'Missing lead or leads field' });
    const result = await pushSingle(brokerId, brokerConfig, handler, lead);
    return res.status(result.status === 'success' ? 200 : 400).json(result);

  } catch (err) {
    console.error('Push error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function pushSingle(brokerId, brokerConfig, handler, lead) {
  // Validate required fields
  const missing = brokerConfig.requiredFields.filter(f => !lead[f]);
  if (missing.length > 0) {
    const entry = addEntry({
      broker: brokerId,
      status: 'error',
      error: `Missing required fields: ${missing.join(', ')}`,
      lead: { email: lead.email || 'unknown' },
    });
    return { status: 'error', error: `Missing required fields: ${missing.join(', ')}`, id: entry.id };
  }

  try {
    const result = await handler(lead);
    const entry = addEntry({
      broker: brokerId,
      status: 'success',
      leadRequestID: result.leadRequestID,
      redirectUrl: result.redirectUrl,
      advertiser: result.advertiser,
      offer: result.offer,
      lead: { email: lead.email, firstName: lead.firstName, lastName: lead.lastName },
    });
    return { status: 'success', ...result, id: entry.id };
  } catch (err) {
    const entry = addEntry({
      broker: brokerId,
      status: 'error',
      error: err.message,
      lead: { email: lead.email || 'unknown' },
    });
    return { status: 'error', error: err.message, id: entry.id, raw: err.response || null };
  }
}
