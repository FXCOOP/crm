/**
 * MediaNow API client — wraps all endpoints from the documentation.
 */

const https = require('https');
const http = require('http');
const { URL, URLSearchParams } = require('url');

const BASE = 'https://365-medianow-api.com';

function getApiKey() {
  const key = process.env.MEDIANOW_API_KEY;
  if (!key) throw new Error('MEDIANOW_API_KEY env variable is not set');
  return key;
}

// ── Generic request helper ───────────────────────────────

function request(method, path, params = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    let body = null;

    if (method === 'GET' && Object.keys(params).length) {
      // Handle array params like offerIDs[]=1
      Object.entries(params).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach(item => url.searchParams.append(k, item));
        } else if (v !== undefined && v !== null) {
          url.searchParams.append(k, v);
        }
      });
    }

    if (method === 'POST') {
      body = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) body.append(k, v);
      });
      body = body.toString();
    }

    const proto = url.protocol === 'https:' ? https : http;
    const headers = {
      'Api-Key': getApiKey(),
    };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const req = proto.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(json.message || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.response = json;
            reject(err);
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(body);
    req.end();
  });
}

// ── Lead Registration ────────────────────────────────────

async function registerLead(leadData) {
  return request('POST', '/api/v2/leads', leadData);
}

// ── Get Autologin URL ────────────────────────────────────

async function getAutologinUrl(leadRequestID) {
  return request('GET', '/api/v2/brokers/login/details', { leadRequestID });
}

// ── Get Offer Advertisers ────────────────────────────────

async function getOfferAdvertisers(filters = {}) {
  return request('GET', '/api/v2/offers/advertisers/locations', filters);
}

// ── Get Offers ───────────────────────────────────────────

async function getOffers(filters = {}) {
  return request('GET', '/api/v2/offers', filters);
}

// ── Get Countries ────────────────────────────────────────

async function getCountries() {
  return request('GET', '/api/v2/countries');
}

// ── Get Leads ────────────────────────────────────────────

async function getLeads(fromDate, toDate, filters = {}) {
  return request('GET', '/api/v2/leads', { fromDate, toDate, ...filters });
}

// ── Get Conversions ──────────────────────────────────────

async function getConversions(fromDate, toDate, filters = {}) {
  return request('GET', '/api/v2/conversions', { fromDate, toDate, ...filters });
}

// ── Add Company ──────────────────────────────────────────

async function addCompany(companyData) {
  return request('POST', '/api/v2/companies', companyData);
}

// ── Add Company Payment Method ───────────────────────────

async function addCompanyPaymentMethod(companyID, paymentData) {
  return request('POST', `/api/v2/companies/${companyID}/payments/methods`, paymentData);
}

// ── Get Income ───────────────────────────────────────────

async function getIncome(fromDate, toDate, filters = {}) {
  return request('GET', '/api/v2/income', { fromDate, toDate, ...filters });
}

// ── Get Postbacks ────────────────────────────────────────

async function getPostbacks(filters = {}) {
  return request('GET', '/api/v2/postbacks', filters);
}

// ── Upload File ──────────────────────────────────────────

async function addFile(filePath, type) {
  // For file uploads we need multipart — handled separately
  const FormData = require('form-data');
  const fs = require('fs');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('type', type);

  return new Promise((resolve, reject) => {
    const url = new URL('/api/v2/files', BASE);
    const proto = url.protocol === 'https:' ? https : http;

    const req = proto.request(url, {
      method: 'POST',
      headers: {
        'Api-Key': getApiKey(),
        ...form.getHeaders(),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

module.exports = {
  registerLead,
  getAutologinUrl,
  getOfferAdvertisers,
  getOffers,
  getCountries,
  getLeads,
  getConversions,
  addCompany,
  addCompanyPaymentMethod,
  getIncome,
  getPostbacks,
  addFile,
};
