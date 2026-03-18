/**
 * Broker configurations — each broker has its own API adapter.
 * Add new brokers here. The system routes leads to the correct
 * broker based on the `broker` field in the push request.
 */

const BROKERS = {
  medianow: {
    name: 'MediaNow',
    baseUrl: 'https://365-medianow-api.com',
    apiVersion: 'v2',
    authHeader: 'Api-Key',
    // Key comes from env: MEDIANOW_API_KEY
    envKey: 'MEDIANOW_API_KEY',
    requiredFields: ['email', 'firstName', 'lastName', 'phone'],
    autoFields: ['password', 'ip'], // auto-generated: password=static, ip=country-based
    optionalFields: ['password', 'ip', 'areaCode', 'custom1', 'custom2', 'custom3', 'custom4', 'custom5', 'comment', 'offerName', 'offerWebsite', 'locale'],
  },

  // ── Add more brokers below ──────────────────────────────
  // example: {
  //   name: 'Example Broker',
  //   baseUrl: 'https://api.example.com',
  //   apiVersion: 'v1',
  //   authHeader: 'Authorization',
  //   envKey: 'EXAMPLE_API_KEY',
  //   requiredFields: ['email', 'firstName', 'lastName', 'phone'],
  //   optionalFields: ['country', 'source'],
  // },
};

function getBroker(id) {
  const broker = BROKERS[id];
  if (!broker) throw new Error(`Unknown broker: ${id}`);
  return broker;
}

function listBrokers() {
  return Object.entries(BROKERS).map(([id, b]) => ({
    id,
    name: b.name,
    requiredFields: b.requiredFields,
    optionalFields: b.optionalFields,
  }));
}

module.exports = { BROKERS, getBroker, listBrokers };
