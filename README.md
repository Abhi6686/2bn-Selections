# 2BN Project Selections Prototype

Working prototype for **Appliances** selection sheets (Levels 1–3), project budgeting, and change order tracking.

## Features

- **Material library** — All items from Level 1, 2, and 3 docx sheets with **product images** extracted from the documents; filter by category/level; add custom materials and categories
- **Change selection modal** — Pick replacements from **any level** (1, 2, or 3) with price delta preview
- **New project wizard** — Walk categories at chosen budget level; records **initial budget**
- **Budget tracking** — Snapshots, variance vs initial, alerts when changes exceed $500 CO minimum
- **Change orders** — Draft → Released → Accepted/Rejected with timestamps on timeline
- **Timeline** — Full audit from project creation through every selection and CO
- **Analytics** — Category-level initial vs current and CO touch counts

## Admin login

| Field | Value |
|-------|--------|
| **User ID** | `admin` |
| **Password** | `2BN-Admin-2026!` |

Override via `VITE_ADMIN_USERNAME` and `VITE_ADMIN_PASSWORD` in `.env.local` or Vercel environment variables.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/login

## Deploy to Vercel

See [DEPLOY.md](./DEPLOY.md). Connect the GitHub repo `abhijeetgosavi89/selections` and deploy with default Vite settings (`dist` output).

Data persists in **browser localStorage**.

## Rebuild library JSON and images from docx

```bash
python scripts/build_library.py
python scripts/extract_images.py
```

Images are saved to `public/images/` and linked in `src/data/selectionLibrary.json`.

## Source documents

Imported from:

- `Level 1 Selections .docx`
- `Level 2 Selections.docx`
- `Level 3 Selections.docx`

## Suggested next steps (production)

- Backend API + database (PostgreSQL)
- PDF export for CO packages and selection schedules
- E-sign integration (DocuSign / Dropbox Sign)
- Link to SOV / cost codes per category
- Multi-user roles (PM, client, vendor)
- Photo/spec sheet attachments per line item
- Schedule impact days on change orders (Primavera/Unifier pattern)
