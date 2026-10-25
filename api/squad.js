// Vercel Serverless Function: /api/squad?id=...
// Fetches squad from CricketData.org using process.env.CRICKETDATA_API_KEY
// Key is kept strictly server-side and never exposed to the client.

import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiKey = process.env.CRICKETDATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      status: 'failure',
      message: 'CRICKETDATA_API_KEY is not configured in Vercel Environment Variables.'
    });
  }

  const matchId = req.query?.id;
  if (!matchId) {
    return res.status(400).json({ status: 'failure', message: 'Missing id query parameter' });
  }

  const targetUrl = `https://api.cricapi.com/v1/match_squad?apikey=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(matchId)}`;

  https.get(targetUrl, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.apikey) json.apikey = '***PROTECTED_BY_VERCEL***';
        res.status(apiRes.statusCode || 200).json(json);
      } catch (e) {
        res.status(500).json({ status: 'failure', message: 'Invalid JSON response from CricketData' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ status: 'failure', message: err.message });
  });
}
