/**
 * Single serverless function router — all API endpoints consolidated.
 * Vercel Hobby plan allows max 12 serverless functions.
 */

const medianow = require('./lib/medianow');
const { getBroker, listBrokers } = require('./lib/brokers');
const { addEntry, getEntries, getStats } = require('./lib/push-log');
const { generateCountryIP, getSupportedCountries } = require('./lib/country-ips');

const STATIC_PASSWORD = 'Broker2026!x';


// ── Broker push handlers ─────────────────────
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
};

async function pushSingle(brokerId, brokerConfig, handler, lead, countryCode) {
  // Auto-fill password if not provided
  if (!lead.password) lead.password = STATIC_PASSWORD;

  // Auto-generate country-specific IP if not provided
  if (!lead.ip && countryCode) {
    lead.ip = generateCountryIP(countryCode);
  }

  const missing = brokerConfig.requiredFields.filter(f => !lead[f]);
  if (missing.length > 0) {
    const entry = addEntry({ broker: brokerId, status: 'error', error: `Missing required fields: ${missing.join(', ')}`, lead: { email: lead.email || 'unknown' } });
    return { status: 'error', error: `Missing required fields: ${missing.join(', ')}`, id: entry.id };
  }
  try {
    const result = await handler(lead);
    const entry = addEntry({ broker: brokerId, status: 'success', leadRequestID: result.leadRequestID, redirectUrl: result.redirectUrl, advertiser: result.advertiser, offer: result.offer, lead: { email: lead.email, firstName: lead.firstName, lastName: lead.lastName } });
    return { status: 'success', ...result, id: entry.id };
  } catch (err) {
    const entry = addEntry({ broker: brokerId, status: 'error', error: err.message, lead: { email: lead.email || 'unknown' } });
    return { status: 'error', error: err.message, id: entry.id, raw: err.response || null };
  }
}

// ── Route handlers ───────────────────────────

const routes = {
  // POST /api/push
  // Body: { broker, lead, leads, countryCode }
  // countryCode can be global (fallback) or per-lead via lead.country field
  // password is auto-filled with static password if missing
  // IP is auto-generated from the lead's country (per-lead) or global countryCode
  'POST /push': async (req, res) => {
    const { broker: brokerId, lead, leads, countryCode } = req.body || {};
    if (!brokerId) return res.status(400).json({ error: 'Missing broker field' });
    const brokerConfig = getBroker(brokerId);
    const handler = pushHandlers[brokerId];
    if (!handler) return res.status(400).json({ error: `No push handler for broker: ${brokerId}` });

    if (Array.isArray(leads) && leads.length > 0) {
      const results = [];
      for (const singleLead of leads.slice(0, 100)) {
        const leadCopy = { ...singleLead };
        // Per-lead country takes priority, then global fallback
        const cc = leadCopy.country || countryCode;
        delete leadCopy.country; // don't send 'country' to MediaNow API
        results.push(await pushSingle(brokerId, brokerConfig, handler, leadCopy, cc));
      }
      return res.status(200).json({ results, count: results.length });
    }

    if (!lead) return res.status(400).json({ error: 'Missing lead or leads field' });
    const leadCopy = { ...lead };
    const cc = leadCopy.country || countryCode;
    delete leadCopy.country;
    const result = await pushSingle(brokerId, brokerConfig, handler, leadCopy, cc);
    return res.status(result.status === 'success' ? 200 : 400).json(result);
  },

  // GET /api/supported-countries — list countries with IP generation support
  'GET /supported-countries': async (req, res) => {
    return res.status(200).json({ countries: getSupportedCountries() });
  },

  // GET /api/leads
  'GET /leads': async (req, res) => {
    const { fromDate, toDate, ...filters } = req.query || {};
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate are required' });
    return res.status(200).json(await medianow.getLeads(fromDate, toDate, filters));
  },

  // GET /api/conversions
  'GET /conversions': async (req, res) => {
    const { fromDate, toDate, ...filters } = req.query || {};
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate are required' });
    return res.status(200).json(await medianow.getConversions(fromDate, toDate, filters));
  },

  // GET /api/offers
  'GET /offers': async (req, res) => {
    return res.status(200).json(await medianow.getOffers(req.query || {}));
  },

  // GET /api/advertisers
  'GET /advertisers': async (req, res) => {
    return res.status(200).json(await medianow.getOfferAdvertisers(req.query || {}));
  },

  // GET /api/countries
  'GET /countries': async (req, res) => {
    return res.status(200).json(await medianow.getCountries());
  },

  // GET /api/income
  'GET /income': async (req, res) => {
    const { fromDate, toDate, ...filters } = req.query || {};
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate are required' });
    return res.status(200).json(await medianow.getIncome(fromDate, toDate, filters));
  },

  // GET /api/postbacks
  'GET /postbacks': async (req, res) => {
    return res.status(200).json(await medianow.getPostbacks(req.query || {}));
  },

  // GET /api/autologin
  'GET /autologin': async (req, res) => {
    const { leadRequestID } = req.query || {};
    if (!leadRequestID) return res.status(400).json({ error: 'leadRequestID is required' });
    return res.status(200).json(await medianow.getAutologinUrl(leadRequestID));
  },

  // GET /api/brokers
  'GET /brokers': async (req, res) => {
    return res.status(200).json({ brokers: listBrokers() });
  },

  // GET /api/log
  'GET /log': async (req, res) => {
    const { page, limit, broker, status, view } = req.query || {};
    if (view === 'stats') return res.status(200).json(getStats());
    return res.status(200).json(getEntries({ page: parseInt(page) || 1, limit: parseInt(limit) || 50, broker, status }));
  },
};

// ── Main handler ─────────────────────────────

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract route path: /api/push → /push, /api/leads → /leads
  const path = req.url.split('?')[0].replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const routeKey = `${req.method} ${path}`;

  const routeHandler = routes[routeKey];
  if (!routeHandler) {
    return res.status(404).json({ error: 'Not found', availableRoutes: Object.keys(routes) });
  }

  try {
    await routeHandler(req, res);
  } catch (err) {
    console.error(`Error on ${routeKey}:`, err);
    return res.status(err.status || 500).json({ error: err.message, response: err.response });
  }
};
