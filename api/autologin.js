/**
 * GET /api/autologin?leadRequestID=xxx — Get autologin URL for a lead
 */

const medianow = require('./lib/medianow');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { leadRequestID } = req.query || {};
    if (!leadRequestID) {
      return res.status(400).json({ error: 'leadRequestID is required' });
    }
    const data = await medianow.getAutologinUrl(leadRequestID);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};
