/**
 * Local CRM Push Server — runs on YOUR computer so MediaNow sees YOUR whitelisted IP.
 *
 * Usage: node local-server.js
 * Then open: http://localhost:3737
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL, URLSearchParams } = require('url');

const PORT = 3737;
const MEDIANOW_URL = 'https://365-medianow-api.com';
const MEDIANOW_KEY = process.env.MEDIANOW_API_KEY || '0FE9567B-C447-2100-03E4-FA049CAB04C1';

// ── MediaNow API call ────────────────────────
function callMediaNow(leadData) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams();
    Object.entries(leadData).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, String(v)); });

    const url = new URL('/api/v2/leads', MEDIANOW_URL);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Api-Key': MEDIANOW_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid response: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body.toString());
    req.end();
  });
}

// ── Parse JSON body ──────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

// ── HTTP Server ──────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const urlPath = req.url.split('?')[0];

  // Serve the frontend
  if (urlPath === '/' || urlPath === '/index.html') {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.writeHead(404);
      res.end('index.html not found');
    }
    return;
  }

  // API: Push lead
  if (urlPath === '/api/push-direct' && req.method === 'POST') {
    const lead = await parseBody(req);
    if (!lead.email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing email' }));
      return;
    }
    if (!lead.password) lead.password = 'Broker2026!x';

    try {
      const result = await callMediaNow(lead);
      console.log(`[PUSH] ${lead.email} | IP: ${lead.ip} | Status: ${result?.server?.httpCode}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(`[ERROR] ${lead.email}: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, message: err.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   CRM Lead Pusher — Local Server         ║');
  console.log(`  ║   http://localhost:${PORT}                  ║`);
  console.log('  ║   Using YOUR IP (whitelisted)            ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
