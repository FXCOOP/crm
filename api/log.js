/**
 * GET /api/log — Fetch push log entries
 * Query: page, limit, broker, status
 */

const { getEntries, getStats } = require('./lib/push-log');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { page, limit, broker, status, view } = req.query || {};

    if (view === 'stats') {
      return res.status(200).json(getStats());
    }

    const data = getEntries({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      broker,
      status,
    });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
