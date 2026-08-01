# Shortmark

A production-ready **URL shortener** with caching, async analytics logging, write rate limiting, and a clean React UI.

**Live:** [https://short.engineerdanyal.com](https://short.engineerdanyal.com)

---

## What it does

1. Paste a long URL → get a short link  
2. Visiting the short link redirects to the original URL  
3. Each click is logged asynchronously for analytics  
4. Hot redirects are served from Redis to stay fast under load  

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Cache / queue | Redis, BullMQ |
| Rate limiting | `express-rate-limit` + Redis store |
| Process manager | systemd |
| Reverse proxy / TLS | Nginx + Let's Encrypt |
| CI | GitHub Actions |

---

## Architecture (basic engineering)

```text
Browser
  │
  ▼
Nginx (HTTPS, static UI + reverse proxy)
  │
  ├─ /              → React build (frontend/dist)
  ├─ /api/*         → Node API :3002
  └─ /:shortCode    → Node redirect :3002
        │
        ├─ Redis cache  (short_code → long_url)
        ├─ PostgreSQL   (urls, users, clicks)
        └─ BullMQ queue → click worker → clicks table
```

### Design choices

| Concern | Approach |
|---------|----------|
| Fast redirects | Redis cache before Postgres |
| High write load (clicks) | Async queue (BullMQ) — redirect does not wait on DB insert |
| Abuse on create | Rate limit **only** `POST /api/shorten` (writes) |
| Uptime | systemd keeps API + worker alive across SSH disconnect / reboot |
| Secrets | `.env` on server, never committed |

---

## Project structure

```text
url_shorterning/
├── backend/
│   ├── index.js              # Express API
│   ├── db.js                 # Postgres pool
│   ├── redis.js              # Redis client
│   ├── middleware/rateLimit.js
│   ├── queues/clickQueue.js
│   ├── worker/clickWorker.js
│   └── utils/shortCode.js
├── frontend/                 # React + Vite UI
└── .github/workflows/ci.yml  # CI checks
```

---

## Database schema

**`urls`**

| Column | Type | Notes |
|--------|------|--------|
| `id` | BIGSERIAL | Primary key |
| `user_id` | BIGINT | Optional FK → users |
| `short_code` | VARCHAR(16) | Unique public code |
| `long_url` | TEXT | Original URL |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**`clicks`** (analytics)

| Column | Type |
|--------|------|
| `id` | BIGSERIAL |
| `short_code` | VARCHAR(16) |
| `clicked_at` | TIMESTAMPTZ |
| `ip` | TEXT |
| `user_agent` | TEXT |
| `referrer` | TEXT |
| `country` | TEXT |

---

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis

### Backend

```bash
cd backend
cp .env.example .env   # or create .env manually
npm install
npm run dev            # API (nodemon)
```

In a second terminal:

```bash
cd backend
npm run worker         # click logger
```

Example `.env`:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/url_shortener
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).  
For local API calls, `App.jsx` should use:

```js
const API_URL = "http://localhost:3000";
```

For production (same domain via Nginx), use:

```js
const API_URL = "";
```

### Health check

```bash
curl http://localhost:3000/api/health
```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health + DB check |
| `POST` | `/api/shorten` | Create short URL (rate limited) |
| `GET` | `/:shortCode` | Redirect + enqueue click |

**Create example**

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"long_url":"https://example.com"}'
```

---

## Production deploy (no full server shutdown)

Nginx / Postgres / Redis stay running. Only Node services restart briefly.

```bash
# 1) On your Mac
git add . && git commit -m "your message" && git push origin main

# 2) On VPS as urlshort
cd ~/url_shorterning && git pull origin main
cd backend && npm ci
cd ../frontend && npm ci && npm run build

# 3) On VPS as root
chmod 755 /home/urlshort
chmod -R o+rX /home/urlshort/url_shorterning/frontend/dist
systemctl restart urlshort-api urlshort-worker
systemctl status urlshort-api urlshort-worker
```

Then hard-refresh the site (`Cmd+Shift+R`).

### Useful service commands

```bash
systemctl status urlshort-api
systemctl status urlshort-worker
journalctl -u urlshort-api -f
```

---

## Scalability roadmap

Already in place:

- Redis cache for redirects  
- Async click logging via queue  
- Write rate limiting  
- Nginx reverse proxy + HTTPS  

Next (when traffic grows):

- Load balancer + multiple API instances (shared Redis rate limits)  
- DB sharding by `short_code` or ID range  
- CDN in front of static UI / edge caching  
- Analytics dashboard over the `clicks` table  

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:

- Backend: `npm ci` + smoke import of short-code helper  
- Frontend: `npm ci` + production build  

---

## License

Private / educational project unless otherwise specified.
