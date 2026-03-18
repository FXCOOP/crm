/**
 * GET /api/leads — Fetch leads from MediaNow
 * Query params: fromDate, toDate, page, itemsPerPage, + any filter
 */

const medianow = require('./lib/medianow');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fromDate, toDate, ...filters } = req.query || {};
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'fromDate and toDate are required (YYYY-MM-DD HH:mm:ss)' });
    }
    const data = await medianow.getLeads(fromDate, toDate, filters);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Get leads error:', err);
    return res.status(err.status || 500).json({ error: err.message, response: err.response });
  }
};
