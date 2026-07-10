# 2BN Selections — V2 Architecture & Roadmap (MongoDB, Roles, Recommendations)

This plan upgrades the current **client-side prototype** into a **fast, robust, multi-user web application** backed by MongoDB, with three roles, magic-link auth, background auto-save, PDF-based change order approvals, and a tag-driven recommendation engine.

> Companion to `PROJECT_OVERVIEW.md`. That doc describes what exists today; this doc describes where we go next and exactly how.

Last updated: **June 4, 2026**

---

## 0. Confirmed decisions (June 4, 2026)

These are locked and reflected throughout the plan:

| Topic | Decision | Impact |
|-------|----------|--------|
| **Email** | **Own / local SMTP** (no third-party API) | Use `nodemailer` against your SMTP server for magic links + CO approvals; dev uses Mailpit/MailHog |
| **Tenancy** | **Multi-tenant** (other builders later) | Add `orgId` to all tenant-scoped collections + org-scoped RBAC from day one |
| **Homeowner pricing** | **Full prices visible** | End user sees real prices on every item and in change orders |
| **Catalog scope** | **Full master library** per project | No per-project curation step initially; homeowner browses everything (filter/recommend to manage size) |
| **Tagging** | **Manual by Admin** | Admin assigns style/color/material tags; no auto-tagging in V2 core |
| **Master categories** | **`Master Selections List`** (13 sections, 51+ groups) | Source of truth in `src/data/masterCategories.json`; appliance catalog mapped into Kitchen/Bathroom/Laundry groups |
| **Homeowners** | **One primary** per project; **optional second** | Couple can both select; **both may approve** change orders when enabled |
| **CO approval** | **Tokenized link + captured signature** | Typed name and/or draw signature (mouse, touch, stylus); audit IP + optional GPS |
| **Themes** | **From master list + Admin CRUD** | Seed: Modern, Traditional, Farmhouse, Transitional; Admin adds themes and tags items |
| **Branding** | **2BN Contracting** ([2bncontracting.com](https://www.2bncontracting.com/)) | Gold + charcoal modern contractor aesthetic (see §17) |

> Multi-tenant from the start means a top-level **`organizations`** collection and an `orgId` on users, projects, library items, themes, tags, files, etc. 2BN is the first org; the platform can onboard more builders later without a rewrite.

---

## 0.1 Master Selections List — category structure

Imported from **`Master Selections List`** / `MasterList.txt` into **`src/data/masterCategories.json`**.

### 13 top-level sections

| # | Section | Example groups |
|---|---------|----------------|
| 1 | **Exterior Selections** | Roofing, Siding, Soffit/Fascia, Windows, Exterior Doors, Exterior Lighting, Porch/Deck |
| 2 | **Interior Finishes** | Flooring (Hardwood, LVP, Tile, Carpet), Interior Doors, Door Hardware, Trim & Millwork, Paint |
| 3 | **Kitchen Selections** | Cabinetry, Countertops, Backsplash, Sink & Faucet, **Appliances** |
| 4 | **Bathroom Selections** | Vanity, Plumbing Fixtures (Faucet, Shower, Tub, Toilet), Accessories |
| 5 | **Electrical & Technology** | Switches & Outlets, Lighting, Smart Home |
| 6 | **HVAC & Comfort** | Thermostat, registers, heated floors, etc. |
| 7 | **Fireplace Selections** | Gas/electric, surround, mantel, hearth |
| 8 | **Storage & Organization** | Closets, Mudroom |
| 9 | **Laundry Room** | Cabinets, countertops, sink, appliances |
| 10 | **Specialty Items** | Aging-in-place, wine storage, sauna, gym, etc. |
| 11 | **Final Detail Items** | House numbers, mailbox, window treatments |
| 12 | **Project-Wide Details** | **Style preferences** (themes), finishes, budget priorities |
| 13 | **Ordering metadata** | Manufacturer, SKU, lead time, ordered/delivered/installed flags |

### How the app uses this

- **Wizard navigation** = section → group → optional **selection fields** (line items from the master list).
- **Material library** (today’s appliance SKUs) maps into:
  - `Kitchen - Appliances` (Refrigerator, Range, Microwave, Dishwasher, Vent Hood, Wall Oven as **selection slots**)
  - `Kitchen - Sink & Faucet`
  - `Bathroom - Plumbing Fixtures` (Faucet, Shower/Tub, Toilet)
  - `Laundry Room - Appliances` (Washer, Dryer)
- Groups **without catalog items yet** still appear in the wizard as **TBD / custom entry / skip** until Admin adds materials.
- Regenerate JSON: `python scripts/parse_master_list.py`

### Themes from the document (section 12)

The master list explicitly asks for: **Modern / traditional / farmhouse / transitional** style.

**V2 approach:**
- Seed these four themes in MongoDB.
- **Admin (Stepron)** can **create, edit, deactivate** themes anytime.
- Each theme has **tag weights**; Admin manually tags library items → recommendations when homeowner picks a theme on the project.

---

## 1. What changes from the prototype

| Concern | Prototype (today) | V2 (this plan) |
|---------|-------------------|-----------------|
| Storage | Browser `localStorage` | **MongoDB** (Atlas free → self-hosted local) |
| Users | 1 hardcoded admin | **3 roles**: Admin (Stepron), Client (2BN), End User (homeowner) |
| Auth | Static password | **Magic link + password**, JWT sessions, invites |
| Selections | Saved instantly in browser | **Background auto-save drafts**, resume where you left off |
| Change orders | In-app status only | **PDF generated + emailed for approval**, audit trail |
| Files | Bundled images | **Local disk storage** for images + PDF specs |
| Recommendations | None | **Tag + theme-based smart recommendations** |
| Performance | Single bundle | **API + React Query caching + list virtualization** |

---

## 2. Roles & permissions

### 2.1 The three roles

| Role | Who | Primary jobs |
|------|-----|---------------|
| **Admin** | **Stepron** (platform owner) | Add/edit library assets, tags, themes, categories; manage all users; configure software; full access to every project; system settings |
| **Client** | **2BN** (the builder) | Launch projects, provide/curate materials per project, invite end users, set allowances/budgets, manage & release change orders, provide selection support |
| **End User** | **Homeowner** | Self-select items per category (with **Skip** option), approve/reject change orders, view budget & timeline; **cannot** edit the master library or pricing |

### 2.2 Permission matrix

| Capability | Admin | Client (2BN) | End User |
|------------|:-----:|:-----:|:-----:|
| Manage global library / catalog | ✅ | ➖ (request only) | ❌ |
| Manage tags & themes | ✅ | ➖ | ❌ |
| Create / launch project | ✅ | ✅ | ❌ |
| Invite end user to a project | ✅ | ✅ | ❌ |
| Curate which items appear for a project | ✅ | ✅ | ❌ |
| Select / change selections | ✅ | ✅ (assist) | ✅ |
| Skip a category | ✅ | ✅ | ✅ |
| Auto-save draft selections | ✅ | ✅ | ✅ |
| Set budgets / allowances / pricing | ✅ | ✅ | ❌ (view only) |
| Create / release change order | ✅ | ✅ | ❌ |
| **Approve / reject** change order | ✅ (override) | ➖ | ✅ |
| Generate / download CO PDF | ✅ | ✅ | ✅ (their own) |
| View timeline & analytics | ✅ | ✅ | ✅ (their project) |
| Manage users / roles | ✅ | ➖ (project-scoped) | ❌ |

Legend: ✅ full · ➖ limited/scoped · ❌ none

> **Key principle:** End users get a **simple, guided, read-mostly** experience focused on choosing and approving — never on pricing internals or catalog management.

---

## 3. Target architecture

### 3.1 High-level diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser (SPA)                          │
│  React 19 + Vite + TypeScript + React Query + React Router     │
│  - Role-aware UI    - Auto-save drafts    - List virtualization│
└───────────────▲───────────────────────────────┬───────────────┘
                │ HTTPS (JSON, httpOnly cookies)  │
                │                                 ▼
┌───────────────┴───────────────────────────────────────────────┐
│                      API server (Node + Fastify)                │
│  Auth · RBAC · Selections · Change Orders · PDF · Recommender   │
│  Validation (zod) · Rate limit · Logging (pino) · Health checks │
└───────┬──────────────────────┬───────────────────────┬─────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌─────────────────┐     ┌──────────────────┐
│   MongoDB     │      │  Local file dir │     │  SMTP (nodemailer)│
│ Atlas → local │      │ /uploads images │     │  magic link +     │
│   (Mongoose)  │      │  + PDF specs    │     │  CO approvals     │
└───────────────┘      └─────────────────┘     └──────────────────┘
```

### 3.2 Recommended stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Keep **React 19 + Vite + TS** | Already built; fast |
| Data fetching | **TanStack React Query** | Caching, retries, optimistic updates, autosave-friendly |
| Backend | **Node.js + Fastify + TypeScript** | ~2× faster than Express, schema-based validation, robust |
| ODM | **Mongoose** | Schema validation, indexes, middleware, mature |
| Database | **MongoDB** (Atlas M0 free → self-hosted) | Per your requirement; flexible documents fit selections well |
| Auth | **Custom JWT + magic link** (jose + argon2) | Full control, no per-seat cost; cookies httpOnly |
| Email | **Own SMTP** via `nodemailer` (Mailpit in dev) | Magic links + CO approval emails; no third-party API |
| PDF | **@react-pdf/renderer** (server) or **Puppeteer** | react-pdf = light/fast; Puppeteer = pixel-perfect HTML |
| File storage | **Local disk** + `sharp` for thumbnails | Per your requirement; S3-ready later |
| Process mgmt | **PM2** (cluster) + **Nginx** reverse proxy | Production robustness on your server |
| Validation | **zod** | Shared types front+back |
| Logging | **pino** + rotation | Fast structured logs |

> **Single repo, two packages** (monorepo): `apps/web` (existing SPA) and `apps/api` (new). Or simpler: add `/server` folder. Shared `packages/types` for zod schemas + TS types used by both.

---

## 4. MongoDB data model

Collections (with key indexes). Sub-documents are embedded where read-together; large or independently-mutated data is separate for write performance.

> **Multi-tenant note:** every tenant-scoped collection carries an `orgId` (indexed). All queries are automatically scoped by the caller's `orgId` via middleware so one builder can never see another's data. A new `organizations` collection holds `{ _id, name, slug, status, createdAt }` (2BN = first org).

### 4.1 `users`
```
{
  _id, orgId,               // tenant scope (admin = platform-level, orgId optional)
  email (unique, indexed), name,
  role: "admin" | "client" | "end_user",
  passwordHash?,            // argon2; optional (magic-link-only users)
  status: "invited" | "active" | "disabled",
  createdAt, updatedAt, lastLoginAt
}
Indexes: { email: 1 } unique, { orgId: 1, role: 1 }
```
> **Admin (Stepron)** is platform-level (super admin across all orgs). **Client/End User** are scoped to an `orgId`.

### 4.2 `projects`
```
{
  _id, orgId, name, clientName, address,
  ownerClientId,            // the 2BN client user
  endUserIds: [ ... ],      // invited homeowners
  themeId?,                 // selected house style (drives recommendations)
  status: "draft" | "active" | "selections_in_progress"
        | "selections_complete" | "closed",
  initialBudget, currentBudget,
  allowancesByCategory: { [category]: number },
  createdAt, updatedAt
}
Indexes: { ownerClientId: 1 }, { endUserIds: 1 }, { status: 1 }
```

### 4.3 `libraryItems` (master catalog — Admin owned)
```
{
  _id, orgId, category, manufacturer, model, product, finish,
  priceMin, priceMax, level: "1"|"2"|"3",
  imageIds: [fileId...], specPdfId?,
  tags: [tagId...],         // style/color/material tags for recommendations
  vendor, stockStatus, leadTimeDays,
  active: true, custom: false,
  createdAt, updatedAt
}
Indexes: { orgId: 1, category: 1, level: 1 }, { orgId: 1, tags: 1 },
         { orgId: 1, active: 1 }, { manufacturer: "text", product: "text" }
```
> Homeowners see the **full library** for their org (per confirmed decision); filters + recommendations keep the large list manageable.

### 4.4 `projectSelections` (separate collection for fast granular auto-save)
```
{
  _id, projectId, category,
  state: "draft" | "confirmed" | "skipped",
  libraryItemId?, manufacturer?, model?, product?,
  priceUsed?, level?, imageId?, finish?,
  selectedBy (userId), updatedAt, version   // optimistic concurrency
}
Indexes: { projectId: 1, category: 1 } unique
```
> One document per project+category. Auto-save patches a single small doc → cheap, conflict-safe.

### 4.5 `changeOrders`
```
{
  _id, projectId, number, title, status:
    "draft" | "released" | "approved" | "rejected" | "cancelled",
  lines: [{ category, description, previousAmount, newAmount, delta }],
  totalDelta, notes,
  pdfFileId?,               // generated PDF
  approval: {
     token?, sentTo, sentAt, viewedAt, decidedAt,
     decidedBy, decision, ipAddress
  },
  createdAt, releasedAt?, approvedAt?, rejectedAt?
}
Indexes: { projectId: 1, number: 1 } unique, { status: 1 }
```

### 4.6 `themes` (house styles → tag weights)
```
{
  _id, name: "Modern Farmhouse", description, heroImageId?,
  tagWeights: { [tagId]: number }   // e.g. matte-black:0.9, brass:0.4
}
```

### 4.7 `tags`
```
{ _id, name, kind: "style"|"color"|"material"|"finish"|"feature", slug }
Indexes: { slug: 1 } unique, { kind: 1 }
```

### 4.8 Supporting collections
- `timelineEvents` — `{ projectId, type, title, description, amountBefore?, amountAfter?, actorId, changeOrderId?, createdAt }` · index `{ projectId: 1, createdAt: -1 }`
- `budgetSnapshots` — `{ projectId, label, total, byCategory, source, createdAt }`
- `invites` — `{ email, projectId, role, token(hashed), expiresAt, acceptedAt }`
- `magicLinkTokens` — `{ userId, tokenHash, purpose, expiresAt, usedAt }` · TTL index on `expiresAt`
- `files` — `{ _id, kind: "image"|"pdf", originalName, mimeType, sizeBytes, path, thumbPath?, projectId?, createdAt }`
- `auditLogs` — `{ actorId, action, entity, entityId, meta, ip, createdAt }`

---

## 5. Authentication & invitations

### 5.1 Methods
- **Password login** — argon2 hashed, for Admin/Client and end users who set one.
- **Magic link** — passwordless: enter email → one-time signed link (15-min expiry, single use) → session. Ideal for homeowners.

### 5.2 Sessions
- **JWT access token** (15 min) + **refresh token** (7–30 days) in **httpOnly, Secure, SameSite=Lax cookies**.
- Silent refresh; logout clears cookies + revokes refresh token (stored hash list).

### 5.3 Invite flow (Client invites End User)
1. Client clicks **Invite homeowner** on a project, enters email.
2. API creates `invites` + emails a magic link.
3. End user clicks → lands on **Welcome** screen → optionally set a password → enters project selection workspace.
4. Invite token single-use, expires in 7 days; resend supported.

### 5.4 Security baseline
- Rate limit auth routes (e.g. 5/min/IP).
- Hash all tokens at rest; never log them.
- RBAC middleware on every route (`requireRole`, `requireProjectAccess`).
- CSRF protection for cookie auth (double-submit token) or rely on SameSite + custom header.

---

## 6. Background auto-save (drafts) — the headline UX feature

### 6.1 Goals
- Homeowner works through a **long list** without ever clicking "Save".
- Closing the tab and returning later **resumes from the last category**.
- Feels instant; never blocks the UI; survives flaky networks.

### 6.2 Mechanism
1. **Optimistic UI** — selecting/skipping updates local state immediately.
2. **Debounced sync** — 800 ms after the last change, send a `PATCH /projects/:id/selections/:category` with the single changed doc.
3. **Per-category documents** (see 4.4) — each save writes one tiny record → no big-document contention.
4. **Optimistic concurrency** — each selection has a `version`; server rejects stale writes (409) and client refetches that one item.
5. **Resume cursor** — store `lastVisitedCategory` on the project; on load, scroll/jump there with a "Resume where you left off" banner.
6. **Save status chip** — subtle "Saving… / All changes saved · 2s ago" indicator (like Google Docs).
7. **Offline resilience (Phase 2)** — queue unsynced patches in IndexedDB; flush on reconnect; show "Offline — changes will sync".

### 6.3 Draft vs confirmed
- Selections start as `draft`. End user can **Submit selections** to mark the set `confirmed` (locks for client review).
- **Skip** sets a category to `skipped` (counts as a deliberate decision, not "missing"), reversible.

---

## 7. Change orders + PDF approval

### 7.1 Flow
```
Client drafts CO ──► Generate PDF ──► Release (email to homeowner)
        │                                   │
        ▼                                   ▼
   stored in DB                    Homeowner opens link
   pdfFileId set                   views PDF + line items
                                          │
                              ┌───────────┴───────────┐
                              ▼                        ▼
                          Approve                   Reject
                     (budget updated,         (reason captured,
                      snapshot + timeline)      timeline event)
```

### 7.2 PDF generation
- Server route `POST /change-orders/:id/pdf` renders a branded template:
  - 2BN header/logo, project + client info, CO number/date
  - Line table: category, description, previous, new, delta
  - Totals, schedule impact (optional), notes
  - Signature/approval block + approval link/QR
- **Engine:** start with **@react-pdf/renderer** (fast, no headless browser). Switch to **Puppeteer** only if pixel-perfect HTML/CSS fidelity is needed.
- Save PDF to **local `/uploads/pdf/`**, store metadata in `files`, link via `changeOrders.pdfFileId`.

### 7.3 Approval
- Email contains a **tokenized approval link** (or in-app button when logged in).
- Capture `viewedAt`, `decidedAt`, `decision`, `decidedBy`, `ipAddress` → strong audit trail.
- On **approve**: apply `totalDelta` to `currentBudget`, write `budgetSnapshot` + `timelineEvent`, regenerate a stamped "APPROVED" PDF.
- (Optional later) true **e-signature** via Dropbox Sign.

---

## 8. Recommendations engine (tags + themes)

### 8.1 Concept
Every library item carries **tags** (style/color/material/finish/feature). Each **theme** (house style) defines **weighted tag preferences**. When a project picks a theme, items are **scored** and the best matches are recommended per category.

### 8.2 Tagging
- Admin assigns tags when adding/editing items (e.g. `matte-black`, `brushed-gold`, `farmhouse`, `minimalist`, `stainless`, `panel-ready`).
- Bulk tagging UI + CSV import of tags.
- **Seeded from master list (section 12):** Modern, Traditional, Farmhouse, Transitional.
- **Admin can add more** (e.g. Industrial, Coastal) and tag library items manually for recommendations.

### 8.3 Scoring (start simple, rule-based)
```
score(item, theme) =
   Σ over item.tags t of  theme.tagWeights[t]   (0 if absent)
   + levelAffinity(item.level, theme.preferredLevel)   // small nudge
   + finishMatchBonus
normalize to 0–100
```
- Show a **"Recommended for {Theme}"** badge and a ⭐ score on matching cards.
- **Sort** each category so recommended items appear first; keep a "Show all" toggle.
- "Why recommended?" tooltip lists matched tags → builds trust and feels smart.

### 8.4 Smarter later (optional)
- **Co-selection learning** — "homeowners who chose X often chose Y" from historical projects.
- **Vector similarity** — embed tag sets; cosine similarity for fuzzy matches.
- **Budget-aware** — recommend within remaining allowance.
- **Image/AI matching** — homeowner uploads inspiration photo → suggest closest items (Phase 4).

---

## 9. File storage (local)

- Directory layout: `/uploads/images/{itemId}/...`, `/uploads/pdf/specs/...`, `/uploads/pdf/change-orders/...`.
- On upload: validate mime/size, store original + generate **thumbnail** (`sharp`, e.g. 400px) for fast lists.
- Serve via Nginx `location /uploads/` (static, cache headers) — keeps Node out of the file-serving path = fast.
- DB stores only **metadata + path** (never the binary).
- Migrate the existing `public/images/*` into this scheme via a one-time script.
- **Backups:** include `/uploads` in the nightly backup (see §11).

---

## 10. Performance plan (fast + robust)

**Database**
- Compound indexes on all hot queries (see §4); use **projections** (fetch only needed fields).
- **Pagination** everywhere (cursor-based for big lists).
- Connection pooling; `lean()` reads when documents aren't mutated.

**API**
- **Fastify** + `@fastify/compress` (brotli/gzip), `@fastify/etag`, `@fastify/helmet`.
- In-memory **LRU cache** for the (rarely-changing) library + themes; bust on admin edit.
- Rate limiting; request validation short-circuits bad input early.

**Frontend**
- **React Query** caching + background refetch; optimistic autosave.
- **List virtualization** (`react-window`/`virtuoso`) for the big selection list.
- **Lazy-load images** + serve thumbnails; preload next category.
- **Route-based code splitting**; keep first paint light.
- Debounced autosave prevents write storms.

**Ops / robustness**
- **PM2 cluster mode** (one worker per core) behind **Nginx**.
- Health check (`/healthz`) + readiness; auto-restart on crash.
- Structured logging (**pino**) + error tracking (**Sentry**).
- Graceful shutdown; centralized error handler; never crash on a single bad request.

---

## 11. Deployment plan (Atlas → self-hosted)

### Stage A — Cloud (now)
- **MongoDB Atlas M0 (free)**; IP allowlist + DB user.
- API on a small VPS (Render/Railway/your server) or alongside the SPA.
- SPA stays on Vercel (or move behind the same Nginx — see Stage B).
- Secrets via `.env` (never committed).

### Stage B — Production (same server)
- One server (VPS): **Nginx** (TLS via Let's Encrypt) → reverse proxy to **Node API** (PM2) + serve built **SPA** + static `/uploads`.
- **Self-hosted MongoDB** on the same box (or a sibling box), bound to localhost, auth enabled.
- **Backups:** `mongodump` nightly cron + `/uploads` tarball → off-box copy; test restores.
- Monitoring: uptime check + disk/RAM alerts; log rotation.

> Migration from Atlas → local = `mongodump` from Atlas, `mongorestore` locally; flip `MONGODB_URI`. Data model unchanged.

---

## 12. Migration from the prototype

1. **Stand up API + MongoDB**; define Mongoose schemas (§4).
2. **Seed library** from `src/data/selectionLibrary.json` → `libraryItems` (+ migrate images to `/uploads`, create `files`).
3. **Seed tags & themes**; back-fill tags on items (admin pass).
4. **Swap frontend data layer** from `localStorage` (`src/store/storage.ts`) to **React Query + API client** — same component tree, new hooks.
5. **Add auth screens** (magic link + password) and role-aware routing/guards.
6. **Add auto-save** to the selection workspace.
7. **Add CO PDF + approval** flow.
8. **Add recommendations** (theme picker + scored sorting/badges).
9. Keep a **read-only offline fallback** using cached data (optional).

---

## 13. Proposed roadmap & timeline

> Estimates assume one focused developer; parallelizable.

### Phase 1 — Backend foundation (≈ 2 weeks)
- Monorepo (`apps/web`, `apps/api`, `packages/types`).
- Fastify + Mongoose + Atlas connection; zod validation; logging; health checks.
- **Auth**: password + **magic link**, JWT cookies, RBAC middleware.
- Users + **invite flow** (Client → End User).
- Seed library/images into MongoDB + local file storage.
- Swap frontend to React Query against the new API.
**Outcome:** Real multi-user app on Atlas, logins working, library served from DB.

### Phase 2 — Selections + auto-save + roles UX (≈ 2 weeks)
- `projectSelections` per-category model + **background auto-save** + resume cursor + save-status chip.
- **Skip** option; draft → submit flow.
- Role-aware UI: Admin console, Client project console, End User guided workspace.
- List **virtualization** + thumbnails for speed.
**Outcome:** Homeowner can self-select a long list smoothly, resume anytime.

### Phase 3 — Change orders + PDF approvals (≈ 1.5 weeks)
- CO builder, **PDF generation**, email release, tokenized **approve/reject**, audit trail.
- Budget snapshots + timeline integration; approved-PDF stamping.
**Outcome:** End-to-end change order lifecycle with documents.

### Phase 4 — Recommendations + themes (≈ 1.5 weeks)
- Tag taxonomy + admin tagging UI; seed themes.
- Theme picker on project; **scored recommendations**, badges, "why recommended".
- Recommended-first sorting + budget-aware nudges.
**Outcome:** Smart, guided selection that matches the home's style.

### Phase 5 — Hardening + self-host (≈ 1 week + ongoing)
- Sentry, rate limits, backups, Nginx/PM2, TLS.
- **Migrate Atlas → local MongoDB** on the production server.
- Perf pass (indexes, caching, Lighthouse ≥ 90), accessibility pass.
**Outcome:** Fast, robust, self-hosted production.

> **Total core build: ~7–8 weeks.** Phases 1–3 deliver a usable product; 4–5 make it smart and production-grade.

---

## 14. UX principles (easy · informative · smart)

- **Guided flow**: progress bar, "X of Y categories chosen", clear Skip vs Choose.
- **Resume banner**: "Welcome back — continue at Bathroom Faucet."
- **Always-saved**: Google-Docs-style autosave indicator → zero anxiety.
- **Recommended-first** with a friendly "Recommended for your Modern Farmhouse" badge.
- **Plain language** for homeowners; hide pricing internals/jargon.
- **Empty/clear states**, skeleton loaders, toasts on key actions.
- **Mobile-friendly** so homeowners can pick on a phone/tablet.
- **Help on demand**: per-item info, spec PDF link, and a "Need help? Ask 2BN" button.
- **Comparison**: select 2–3 items in a category to compare side-by-side.

---

## 15. Homeowner accounts (primary + optional second)

### Default: one primary homeowner
- Client invites **one email** → primary End User on the project.
- Primary can complete all selections and approve change orders.

### Optional: second homeowner (e.g. couple)
- Client checks **“Add second homeowner for approvals”** and enters a second email.
- Both accounts can:
  - **Log in** (magic link or password)
  - **Make selections** (shared draft — same auto-save document; show “last edited by …”)
  - **Approve change orders** when `requiresDualApproval: true` on the project

### Approval rules
| Setting | Behavior |
|---------|----------|
| Single homeowner | One approval completes the CO |
| Dual homeowners | **Both** must sign/approve (or Admin override with audit note) |
| Either-or mode (optional later) | One of two approvals sufficient — only if you request it |

### Data model (`projectMembers`)
```typescript
{
  projectId, userId, role: "primary_homeowner" | "secondary_homeowner",
  canSelect: true, canApproveChangeOrders: true,
  invitedAt, acceptedAt
}
```

---

## 16. Change order approval — token + real signature + audit

### Two layers (both required for a valid approval)

1. **Tokenized approval link** (email) — proves the link was opened by the invited email; expires in 7 days; single-use optional.
2. **Captured signature** on the approval screen:
   - **Draw** — HTML5 canvas (`signature_pad` library): mouse on desktop, finger/stylus on phone/tablet
   - **Type name** — cursive-style typed signature + printed legal name field
   - User picks one or both (configurable per org)

### Audit trail stored on `changeOrders.approval`
```typescript
{
  tokenId, emailSentTo,
  viewedAt, decidedAt, decision: "approved" | "rejected",
  signatureType: "drawn" | "typed" | "both",
  signatureImagePath?,      // PNG from canvas → /uploads/signatures/
  typedName?,
  signerUserId,
  ipAddress,                // from request headers (X-Forwarded-For)
  geo?: { lat, lng, accuracyMeters, capturedAt, consentGiven: true }
}
```

### Geolocation (phone/tablet)
- **Only if user taps “Share location for this approval”** (GDPR/consent checkbox).
- Browser `navigator.geolocation.getCurrentPosition` — never silent tracking.
- If denied, approval still valid with IP + signature only.
- PDF footer prints: `Signed electronically on {date} from IP {ip}` and optional `Location: lat,lng (approx.)`.

### Rejection
- Same flow; optional **reason** text; no signature required on reject (configurable).

### PDF output
- Embed signature image + typed name on the approval page of the CO PDF.
- Second homeowner gets a **second signature block** when dual approval is enabled.

---

## 17. Branding — 2BN Contracting (modern, advanced, fast)

Reference: [https://www.2bncontracting.com/](https://www.2bncontracting.com/) — gold centered logo, residential/commercial focus, wood-frame craftsmanship imagery.

### Visual direction
- **Premium contractor** — not generic SaaS blue; **gold + deep charcoal + warm neutrals**
- **Fast UI** — skeleton loaders, optimistic saves, no full-page spinners; snappy transitions (&lt;200ms)
- **Informative** — progress, budget impact, “why recommended”, clear next step on every screen
- **Modern** — card-based layout, subtle shadows, large product imagery, minimal chrome

### Suggested design tokens (extract logo gold from brand asset in Phase 1)

| Token | Hex | Usage |
|-------|-----|--------|
| **Brand gold** | `#C5A028` | Primary buttons, accents, level highlights (tune from logo) |
| **Gold light** | `#F5E6B8` | Badges, hover, recommendation chips |
| **Charcoal** | `#1C1C1C` | Sidebar, headers, PDF headers |
| **Warm white** | `#F7F5F0` | Page background |
| **Surface** | `#FFFFFF` | Cards |
| **Success** | `#2D6A4F` | Approved, under budget |
| **Warning** | `#B45309` | Budget alert, pending CO |
| **Danger** | `#B91C1C` | Rejected, over allowance |

### Logo & assets
- Download **“2bn gold centered copy”** from the Wix CDN / provide SVG from 2BN.
- Use on: login, sidebar, PDF header, approval emails.
- **Typography:** keep **Instrument Serif** for headings + **DM Sans** for UI (already in prototype) — aligns with premium residential feel.

### PDF & email templates
- Charcoal header bar + gold rule line + white body.
- Footer: company name, project address, approval metadata, page numbers.

---

## 18. Self-hosted server recommendations

Target: **one Linux server** running Nginx + Node API (PM2) + MongoDB + local `/uploads` (same box initially; DB can move to a sibling VM later).

### Minimum (pilot / &lt; 20 active projects, &lt; 50 users)

| Resource | Spec |
|----------|------|
| **OS** | Ubuntu 22.04 LTS or 24.04 LTS |
| **CPU** | 2 vCPU |
| **RAM** | **8 GB** (4 GB tight once MongoDB + Node + OS are counted) |
| **Disk** | **80 GB SSD** (30 GB uploads/PDFs, 20 GB MongoDB, rest OS/logs) |
| **Network** | Static IP, TLS via Let’s Encrypt |

### Recommended production (comfortable, fast, room to grow)

| Resource | Spec |
|----------|------|
| **CPU** | **4 vCPU** |
| **RAM** | **16 GB** |
| **Disk** | **160 GB NVMe SSD** |
| **MongoDB** | WiredTiger cache ~4 GB; daily `mongodump` + off-site copy |
| **Backups** | Nightly DB dump + weekly full disk snapshot of `/uploads` |

### Software stack on the box
- **Nginx** — TLS termination, static SPA, `/uploads` alias, reverse proxy to API on `:4000`
- **PM2** — cluster mode (`instances: max` or 2–4 workers)
- **MongoDB 7.x** — bind `127.0.0.1` only; auth enabled
- **Node 20 LTS** — API process only (Vite build is CI/local, not on server at runtime)
- **fail2ban** + UFW (22, 80, 443 only)
- **logrotate** for app logs and MongoDB logs

### Atlas → local migration
- Develop on **Atlas M0** (free).
- Before go-live: `mongodump` from Atlas → `mongorestore` on local MongoDB.
- Change `MONGODB_URI` in `.env`; zero schema change.

### Performance checklist on this hardware
- MongoDB indexes on `{ orgId, projectId }`, `{ projectId, categoryKey }`, `{ email }`
- Nginx `gzip` + `brotli` for JS/CSS
- `sharp` thumbnail pipeline so list views never load 500 KB appliance PNGs
- PM2 memory restart limit 512 MB per worker

---

## 19. Updated phased roadmap (incorporates master list + signatures)

### Phase 1 — Backend + master categories (≈ 2.5 weeks)
- Fastify + Mongoose + Atlas + multi-tenant `orgId`
- Auth (SMTP magic link + password) + invites
- Import **`masterCategories.json`** + seed library with **selection slots**
- Section/group wizard API (skip, draft per `categoryKey`)
- React Query; role-aware shells

### Phase 2 — Homeowner UX + auto-save (≈ 2 weeks)
- Primary + **optional second homeowner** on project
- Background auto-save + resume cursor
- List virtualization; full master-list navigation (51 groups)
- Theme picker on project (seed 4 styles from master list)

### Phase 3 — Change orders + signature + PDF (≈ 2 weeks)
- CO PDF generation (2BN-branded)
- Email release via SMTP
- **Draw + typed signature**, IP audit, optional geo with consent
- Dual approval when two homeowners enabled

### Phase 4 — Recommendations + Admin themes (≈ 1.5 weeks)
- Admin theme CRUD + manual item tagging
- Scored recommendations per theme; “Recommended for …” UX

### Phase 5 — Production hardening (≈ 1 week)
- Migrate to self-hosted MongoDB on recommended hardware
- Sentry, backups, PM2+Nginx, Lighthouse pass
- Load test auto-save under 50 concurrent PATCH/min

**Total: ~9 weeks** to production-grade V2 with full master list coverage.

---

## 20. Open items (minor — not blocking Phase 1)

1. **Logo file** — SVG or high-res PNG from 2BN for PDF/email (gold exact hex match).
2. **Dual approval default** — always require both spouses, or optional per project? (plan assumes **optional per project**.)
3. **E-sign legality** — if Pennsylvania requires additional disclosure text on electronic signatures, add to approval page footer.

---

## 21. Recommended tech decisions (updated for MongoDB)

| Decision | Recommendation | Notes |
|----------|----------------|-------|
| Database | **MongoDB** (Atlas M0 → self-hosted) | Per requirement |
| ODM | **Mongoose** | Schema + indexes + middleware |
| API framework | **Fastify** | Fast, robust, validation built-in |
| Auth | **Custom JWT + magic link** (jose, argon2) | No per-seat cost, full control |
| Data fetching | **TanStack React Query** | Caching + optimistic autosave |
| PDF | **@react-pdf/renderer** (→ Puppeteer if needed) | Light + fast first |
| Email | **Own SMTP** (`nodemailer`) | Confirmed; Mailpit/MailHog for local dev |
| Files | **Local disk + sharp thumbnails** | Per requirement; S3-ready later |
| Process | **PM2 + Nginx** | Cluster + TLS + static |
| Validation | **zod** (shared) | One schema, both ends |
| Errors/Logs | **pino + Sentry** | Robust observability |
| Big lists | **react-window / virtuoso** | Smooth long master-list selection UI |
| Signatures | **signature_pad** + PNG to `/uploads/signatures` | Draw on touch/mouse; embed in PDF |
| Geolocation | **Browser API + consent** | Optional audit field only |
| Categories | **`masterCategories.json`** | 13 sections from Master Selections List |

---

## 22. Next implementation step

1. Commit `masterCategories.json` + updated `selectionLibrary.json` (category remap + selection slots).
2. Begin **Phase 1** API with `masterCategories` + `projectMembers` + `themes` collections.
3. Apply **§17 branding tokens** to the SPA and PDF templates.

If this direction looks right, confirm **dual-approval default** (optional per project vs always-on) and provide the **2BN logo asset** for exact gold hex matching.
