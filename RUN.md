# 2BN Selections — Run Guide (Windows test → Linux production)

## Prerequisites

- **Node.js 20 LTS**
- **MongoDB Atlas** connection string (you provide in `.env`)
- **Windows** for local testing; same stack deploys to **Linux** later

## First-time setup

1. Copy environment template:

```powershell
Copy-Item .env.example .env
```

2. Edit `.env` and set at minimum:

```env
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster.mongodb.net/2bn-selections
JWT_SECRET=your-long-random-secret-at-least-32-characters
VITE_API_URL=http://localhost:3001
```

3. Install dependencies:

```powershell
npm install
```

4. Seed database (org, users, library, themes):

```powershell
npm run seed
```

Default accounts after seed:

| Role | Email | Password |
|------|-------|----------|
| Admin (Stepron) | `admin@stepron.com` | `2BN-Admin-2026!` |
| Client (2BN) | `client@2bncontracting.com` | `2BN-Client-2026!` |

Override via `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, etc. in `.env`.

## Development (Windows)

Run **API + web** together:

```powershell
npm run dev
```

- Web UI: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/api/health

Vite proxies `/api` and `/uploads` to the API in dev.

### API only

```powershell
npm run dev:api
```

### Web only (legacy localStorage mode — no `.env` API)

```powershell
npm run dev:web
```

## Production build

```powershell
npm run build
```

Starts API in production:

```powershell
npm run build:api
npm run start:api
```

Serve the built SPA from `dist/` (Nginx, or `npm run preview` for a quick test).

## Linux deployment (later)

1. Build on CI or server: `npm run build`
2. Copy `.env`, `dist/`, `server/dist/`, `uploads/` to server
3. Use **PM2**: `pm2 start ecosystem.config.cjs`
4. **Nginx** reverse proxy:
   - `/api` → `http://127.0.0.1:3001`
   - `/uploads` → static or proxy
   - `/` → `dist/index.html` (SPA fallback)
5. Optional: migrate Atlas → self-hosted MongoDB by changing `MONGODB_URI`

## Project structure

```
selections-prototype/
├── packages/shared/     # Zod schemas + shared TypeScript types
├── server/              # Fastify + Mongoose API
├── src/                 # React SPA
├── uploads/             # Images, PDFs, signatures (created at runtime)
└── .env                 # Secrets (never commit)
```

## Implemented API surface

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login`, magic link, refresh, logout, `GET /api/auth/me` |
| Projects | CRUD, members, invite homeowner |
| Selections | `PATCH` per category (auto-save), confirm-all |
| Library | `GET /api/library`, master categories |
| Change orders | Create, release, approve (signature), reject, PDF |
| Themes | List, create, update (admin) |
| Health | `GET /api/health` |

## SMTP (optional in dev)

Without SMTP configured, emails (magic links, CO approvals) are **logged to the API console**.

Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in `.env` for real delivery.

## Troubleshooting

### `querySrv ECONNREFUSED` (seed or API won't start)

Windows often blocks **SRV DNS** lookups used by `mongodb+srv://` URIs.

**Fix:** In MongoDB Atlas → **Connect** → **Drivers** → copy the **Standard connection string** (starts with `mongodb://`, not `mongodb+srv://`). Replace `MONGODB_URI` in `.env` with that full string.

Test connection:

```powershell
npm run test:mongo --workspace=@2bn/server
```

Also check:
- Cluster status is **Active** (not Paused)
- **Network Access** includes your IP or `0.0.0.0/0` for dev
- Database user password has no unescaped special characters in the URI (URL-encode if needed)

### Login fails / proxy ECONNREFUSED

The API must be running first. If MongoDB fails to connect, the API crashes and login returns proxy errors. Fix MongoDB first, then:

```powershell
npm run seed
npm run dev
```

### Other

- **`Missing MONGODB_URI`** — add Atlas URI to `.env` before `npm run seed` or `npm run dev:api`
- **CORS / cookie issues** — ensure `WEB_ORIGIN=http://localhost:5173` matches Vite URL
- **Atlas IP allowlist** — add your Windows machine public IP in Atlas Network Access
