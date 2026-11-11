# SearchProxy

A minimal Node/Express backend proxy for **Google's Custom Search JSON API**.
It keeps your Google API key and Search Engine ID server-side, so a
frontend or app can call a simple `GET /search?q=...` endpoint without ever
seeing (or being able to steal) your credentials.

## 1. Set up Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create (or select) a project.
2. **APIs & Services → Library** → search for and enable **Custom Search API**.
3. **APIs & Services → Credentials → Create credentials → API key**.
   - Click "Restrict key" and limit it to the Custom Search API (recommended).
4. Go to [programmablesearchengine.google.com](https://programmablesearchengine.google.com/)
   and click **Add**.
   - Under "What to search", choose **"Search the entire web"** — this is
     what lets the engine search anything, not just a fixed list of sites.
   - Turn on **SafeSearch** or leave it off depending on what you want returned.
   - After creating it, open **Setup** and copy the **Search engine ID (cx)**.

## 2. Configure the proxy

```bash
cd SearchProxy
npm install
cp .env.example .env
# edit .env and fill in GOOGLE_API_KEY and GOOGLE_CSE_ID
npm start
```

The server listens on `http://localhost:8787` by default (`PORT` in `.env`).

## 3. Use it

```
GET /search?q=your+query
GET /search?q=your+query&num=10&start=1
GET /healthz
```

Example:

```bash
curl "http://localhost:8787/search?q=roblox+lua"
```

Response:

```json
{
  "query": "roblox lua",
  "searchInformation": { "totalResults": "123000000" },
  "items": [
    { "title": "...", "link": "...", "snippet": "...", "displayLink": "..." }
  ]
}
```

## Notes / limits

- Google's free tier for Custom Search is capped (100 queries/day); beyond
  that it's billed per 1,000 queries. Check current pricing in the Console.
- `num` is capped at 10 per request (Google's API limit); use `start` to
  paginate up to 100 total results.
- `ALLOWED_ORIGINS` in `.env` controls which browser origins may call this
  proxy via CORS — lock it down to your real frontend's origin in production,
  instead of leaving it as `*`.
- A basic per-IP rate limiter (30 req/min) is built in; tune it in `server.js`
  for your expected traffic.
- Never commit your `.env` file — it holds your live API key.
