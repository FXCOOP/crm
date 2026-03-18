/**
 * In-memory push log with persistence to /tmp (Vercel serverless).
 * For production, swap this with a database (Supabase, PlanetScale, etc.)
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join('/tmp', 'crm-push-log.json');

function readLog() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function writeLog(entries) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
}

function addEntry(entry) {
  const log = readLog();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  log.unshift(record);
  // Keep last 10000 entries
  if (log.length > 10000) log.length = 10000;
  writeLog(log);
  return record;
}

function getEntries({ page = 1, limit = 50, broker, status } = {}) {
  let log = readLog();
  if (broker) log = log.filter(e => e.broker === broker);
  if (status) log = log.filter(e => e.status === status);
  const total = log.length;
  const start = (page - 1) * limit;
  return {
    items: log.slice(start, start + limit),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

function getStats() {
  const log = readLog();
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = log.filter(e => e.timestamp?.startsWith(today));

  const byBroker = {};
  const byStatus = { success: 0, error: 0 };

  for (const entry of log) {
    const b = entry.broker || 'unknown';
    if (!byBroker[b]) byBroker[b] = { total: 0, success: 0, error: 0 };
    byBroker[b].total++;
    byBroker[b][entry.status || 'error']++;
    byStatus[entry.status || 'error']++;
  }

  return {
    total: log.length,
    today: todayEntries.length,
    todaySuccess: todayEntries.filter(e => e.status === 'success').length,
    todayError: todayEntries.filter(e => e.status === 'error').length,
    byBroker,
    byStatus,
  };
}

module.exports = { addEntry, getEntries, getStats };
