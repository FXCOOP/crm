/**
 * GET /api/conversions — Fetch conversions from MediaNow
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
      return res.status(400).json({ error: 'fromDate and toDate are required' });
    }
    const data = await medianow.getConversions(fromDate, toDate, filters);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Get conversions error:', err);
    return res.status(err.status || 500).json({ error: err.message, response: err.response });
  }
};
