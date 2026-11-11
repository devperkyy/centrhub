// SearchProxy — minimal backend proxy for Google's Custom Search JSON API.
//
// Why this exists: Google's Custom Search API requires an API key + Search
// Engine ID (cx) on every request. Shipping those inside a frontend/app
// means anyone can steal and abuse them. This proxy holds the credentials
// server-side (as env vars) and exposes a small, rate-limited GET /search
// endpoint that forwards queries to Google and returns the JSON results.
//
// Setup (Google Cloud Console):
//   1. console.cloud.google.com -> create/select a project.
//   2. APIs & Services -> Library -> enable "Custom Search API".
//   3. APIs & Services -> Credentials -> Create credentials -> API key.
//      (Optionally restrict the key to the Custom Search API.)
//   4. Go to programmablesearchengine.google.com -> Add a search engine.
//      - Under "What to search", choose "Search the entire web" to let it
//        search anything rather than being limited to specific sites.
//      - Copy the Search engine ID (cx).
//   5. Put both values in a .env file next to this server (see .env.example).
//
// Run:
//   npm install
//   cp .env.example .env   # fill in GOOGLE_API_KEY and GOOGLE_CSE_ID
//   npm start
//
// Call it:
//   GET /search?q=your+query&num=10&start=1
//
// This proxy adds no content filtering of its own; results reflect whatever
// your Search Engine's "entire web" / SafeSearch settings return. Keep your
// API key secret and never commit .env.

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 8787;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
// Comma-separated list of origins allowed to call this proxy from a browser.
// Use "*" (default) only for local testing; lock this down in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
  console.error(
    'Missing GOOGLE_API_KEY and/or GOOGLE_CSE_ID. Copy .env.example to .env and fill them in.'
  );
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
  })
);

// Basic abuse protection: limit requests per IP. Tune for your traffic.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(400).json({ error: 'Missing required query parameter "q".' });
  }

  // num: results per page (Google caps this at 10). start: 1-based offset
  // for pagination (Google caps total results at 100, i.e. start <= 91).
  const num = clampInt(req.query.num, 1, 10, 10);
  const start = clampInt(req.query.start, 1, 91, 1);

  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q,
    num: String(num),
    start: String(start),
  });

  // Optional passthroughs supported by the Custom Search API.
  if (typeof req.query.safe === 'string') params.set('safe', req.query.safe);
  if (typeof req.query.lr === 'string') params.set('lr', req.query.lr);
  if (typeof req.query.gl === 'string') params.set('gl', req.query.gl);

  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();

    if (!upstream.ok) {
      // Forward Google's status/error without leaking the API key.
      return res.status(upstream.status).json({
        error: data?.error?.message || 'Upstream search request failed.',
      });
    }

    const items = (data.items || []).map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
    }));

    res.json({
      query: q,
      searchInformation: data.searchInformation,
      items,
    });
  } catch (err) {
    console.error('Search proxy error:', err);
    res.status(502).json({ error: 'Failed to reach the search API.' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`SearchProxy listening on http://localhost:${PORT}`);
});

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
