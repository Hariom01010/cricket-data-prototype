// Secure Backend Proxy Server
// Reads CRICKETDATA_API_KEY from environment variables (.env / process.env)
// Never exposes the API key to client browsers or network inspection tools.

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Simple .env parser without external dependencies
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const CRIC_API_BASE = 'https://api.cricapi.com/v1';

// In-memory simple hit tracker
let serverHitsToday = 0;

function fetchCricketData(endpointPath) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.CRICKETDATA_API_KEY;
    if (!apiKey) {
      return reject(new Error('CRICKETDATA_API_KEY environment variable is not set on the server. Please set it in your .env file or hosting provider settings.'));
    }

    const separator = endpointPath.includes('?') ? '&' : '?';
    const targetUrl = `${CRIC_API_BASE}${endpointPath}${separator}apikey=${encodeURIComponent(apiKey)}`;

    serverHitsToday++;

    https.get(targetUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Sanitize response so apikey is never leaked even inside JSON
          if (json.apikey) json.apikey = '***PROTECTED_BY_BACKEND***';
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          reject(new Error('Invalid JSON from CricketData API'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local/team testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Proxy Route 1: Status & Hits Info
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasApiKey: Boolean(process.env.CRICKETDATA_API_KEY),
      hitsToday: serverHitsToday,
      limit: 100
    }));
    return;
  }

  // API Proxy Route 2: Get Matches (Uses env key securely)
  if (pathname === '/api/matches') {
    try {
      const result = await fetchCricketData('/matches?offset=0');
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failure', message: err.message }));
    }
    return;
  }

  // API Proxy Route 3: Get Match Squad (Uses env key securely)
  if (pathname === '/api/squad') {
    const matchId = parsedUrl.searchParams.get('id');
    if (!matchId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failure', message: 'Missing id query parameter' }));
      return;
    }

    try {
      const result = await fetchCricketData(`/match_squad?id=${encodeURIComponent(matchId)}`);
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failure', message: err.message }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`CRICKETDATA_API_KEY configured: ${Boolean(process.env.CRICKETDATA_API_KEY)}`);
});
