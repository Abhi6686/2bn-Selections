# 2BN Selections — Project Overview & Roadmap

A complete reference for the current 2BN Selections prototype: what it is, how it works, the architecture, and a deep roadmap of features to add next.

---

## 1. Executive summary

**2BN Selections** is a web application for managing **construction/renovation appliance & material selections** with **budget tracking** and a **change order workflow**.

The starting data is sourced from three real selection sheets:

- `Level 1 Selections .docx` — Value tier (GE base appliances + standard plumbing)
- `Level 2 Selections.docx` — Mid tier (GE Profile + premium plumbing)
- `Level 3 Selections.docx` — Premium tier (Monogram + luxury plumbing)

A project manager logs in, creates a project, picks one appliance per category (mixing levels freely), and the app captures an **initial budget snapshot**. From that point, every change is tracked: revised selections, budget alerts, formal change orders (Draft → Released → Accepted / Rejected), and a full audit timeline.

**Status:** Working client-side prototype, deployable to Vercel, with admin login.

---

## 2. Current functionality (what it does today)

### 2.1 Authentication

- `/login` page with branded card UI.
- Hardcoded admin credentials (overridable by Vercel env vars):
  - **User ID:** `admin`
  - **Password:** `2BN-Admin-2026!`
- Session stored in `sessionStorage` (clears on browser close).
- All app routes are protected; unauthenticated visitors are redirected to `/login`.
- Sign-out button in the sidebar.

### 2.2 Material library (`/library`)

- Browse all imported items from Level 1, 2, and 3.
- Filter by **level** (1/2/3/all) and **category**.
- Each card shows:
  - Product image (extracted from the docx files)
  - Manufacturer, model, finish, price range, level badge
- **Add custom material** form — adds new line items to any category.
- **Add custom category** for non-standard scopes.

### 2.3 New project wizard (`/projects/new`)

- **Step 1 — Project details:** name, client, address.
- **Step 2…n — Per-category selection:** one step per category (refrigeration → toilet).
  - Shows appliances from **all three levels** simultaneously, grouped by level.
  - Filter pills to narrow to one level.
  - Progress bar + step chips that mark each completed category.
- On finish, the app stores **initial budget** = sum of selected line prices.

### 2.4 Project dashboard (`/`)

- Card grid of all projects.
- Per project: current budget, variance vs initial, change order count, last update.
- Open project, reset all demo data.

### 2.5 Project detail (`/projects/:projectId`)

Tabs:

1. **Selections** — Product cards with images. **Change selection** opens a modal that lets you swap to any item in the same category from **any level**, with price-delta preview.
2. **Budget history** — Every snapshot (initial, manual change, accepted CO) with timestamp.
3. **Change orders** —
   - Form to draft a CO with multiple line items (quick-add from category).
   - Cards per CO with status pill (Draft/Released/Accepted/Rejected) and timestamps.
   - Workflow buttons: Release → Mark accepted / Reject.
   - **$500 minimum** delta enforced (per source spec sheets).
4. **Timeline** — Full audit log: project_created, initial_budget_set, selection_updated, change_order_created, change_order_released, change_order_accepted, change_order_rejected, budget alerts.
5. **Analytics** — Category-level initial vs current variance and CO touch counts.

### 2.6 Notifications & alerts

- Whenever a selection change moves the budget by **≥ $500**, a timeline notification is created.
- Most-recent notification surfaces as a banner on the project detail page.

---

## 3. Architecture

### 3.1 Tech stack

| Layer | Technology |
|-------|-------------|
| UI framework | React 19 + TypeScript (strict) |
| Build tool | Vite 6 |
| Routing | React Router 7 |
| Styling | Hand-written CSS (no UI framework dependency) |
| State | React Context + `useReducer`-style setState patterns |
| Persistence | `localStorage` for app state; `sessionStorage` for auth |
| Deployment | Vercel (`vercel.json` for SPA routing) |
| Source data | `.docx` files parsed via Python scripts (`scripts/*.py`) |

### 3.2 Folder structure

```
selections-prototype/
├─ public/images/                # Product images extracted from docx
├─ scripts/
│  ├─ build_library.py           # Generates src/data/selectionLibrary.json
│  ├─ extract_images.py          # Pulls images from docx, maps to models
│  └─ debug_docx.py
├─ src/
│  ├─ App.tsx                    # Routes + providers
│  ├─ main.tsx                   # React entry
│  ├─ index.css                  # All styling
│  ├─ config/auth.ts             # Admin credential constants
│  ├─ context/
│  │  ├─ AppContext.tsx          # Project + library state
│  │  └─ AuthContext.tsx         # Login / logout / session
│  ├─ components/
│  │  ├─ Layout.tsx              # Sidebar + main shell
│  │  ├─ ProtectedRoute.tsx      # Auth gate
│  │  ├─ LevelBadge.tsx
│  │  ├─ ProductImage.tsx
│  │  ├─ SelectionProductCard.tsx
│  │  └─ ChangeSelectionModal.tsx
│  ├─ pages/
│  │  ├─ LoginPage.tsx
│  │  ├─ DashboardPage.tsx
│  │  ├─ LibraryPage.tsx
│  │  ├─ NewProjectPage.tsx
│  │  └─ ProjectDetailPage.tsx
│  ├─ store/
│  │  ├─ library.ts              # Library helpers + level metadata
│  │  └─ storage.ts              # Load/save app state
│  ├─ data/
│  │  ├─ selectionLibrary.json   # Imported Level 1-3 data
│  │  └─ imageMap.json
│  ├─ types/index.ts             # All TypeScript domain types
│  └─ utils/
│     ├─ budget.ts               # Snapshot, CO math, timeline helpers
│     ├─ project.ts              # Level summaries
│     └─ format.ts               # Currency, dates, IDs
├─ vercel.json                   # SPA rewrite rule
├─ DEPLOY.md                     # Vercel deployment guide
└─ README.md
```

### 3.3 Domain model (key TypeScript types)

```typescript
SelectionLevel = "1" | "2" | "3"

LibraryItem {
  id, category, manufacturer, model, product, finish,
  priceMin, priceMax, level, imageUrl?, optional?, custom?
}

ProjectSelection {
  category, libraryItemId, manufacturer, model, product,
  priceUsed, level, imageUrl?, finish?
}

ChangeOrder {
  id, number, title, status, lines[],
  totalDelta, notes, createdAt, releasedAt?, acceptedAt?, rejectedAt?
}

Project {
  id, name, clientName, address, defaultLevel,
  selections[], initialBudget, currentBudget,
  budgetSnapshots[], changeOrders[], timeline[],
  createdAt, updatedAt
}
```

### 3.4 Data flow

1. **Library load** — `selectionLibrary.json` is bundled at build time; on first launch it’s seeded into `AppContext`.
2. **User edits** — Every state change goes through `AppContext` setState reducers.
3. **Persistence** — A `useEffect` writes the entire app state to `localStorage` after every change.
4. **Auth** — `AuthContext` is independent; uses `sessionStorage` to avoid stale logins after browser close.

---

## 4. Known limitations of the current prototype

| Area | Limitation |
|------|-------------|
| Auth | Client-side only, single hardcoded admin |
| Storage | Browser `localStorage` — not shared across users or devices |
| Real-time | No collaboration; two users editing in two browsers will diverge |
| Files | No PDF/spec sheet upload yet |
| Export | No PDF / Excel export of the selection schedule |
| Search | Library has filter, but no full-text or fuzzy search |
| Mobile | Responsive at breakpoints but not optimized for tablets/phones |
| Multi-project | All projects in one local store; no archiving |
| Vendors | Single vendor (Don’s Appliances) — no multi-vendor categories |
| Currency | USD only |
| Versioning | Selection history is captured in timeline, but no rollback UI |

---

## 5. Suggested feature roadmap

Below is a deep menu of feature ideas, organized by area and prioritized. Pick whichever align with your goals.

### 5.1 Authentication & user management

**Quick wins**

- Add **“Forgot password / reset”** stub link.
- Add a **second role** (Read-only viewer / Estimator / Project Manager) with permission gates on actions.
- Show **login attempt history** in a small admin panel.

**Bigger upgrades**

- Move to **proper backend auth**: NextAuth, Supabase, Clerk, Auth0, or AWS Cognito.
- **Multi-user accounts** — invite by email, per-project assignments.
- **Single sign-on (SSO)** via Google / Microsoft 365 (most construction firms use one of these).
- **Audit log of user actions** (who released a CO at what time).
- **2FA** for admin / approver roles.
- **Magic-link** login (no password) — popular pattern for small business apps.

### 5.2 Project & selection management

**Quick wins**

- **Duplicate project** — clone an existing project as a template.
- **Project templates** — save a project as a “Spec home Tier 2” template for reuse.
- **Selection lock** — lock categories once approved by the client.
- **Notes per selection** — add why an item was chosen (client preference, lead time, etc.).
- **Cost code / GL account** field per category — feeds accounting.
- **Quantity per selection** — handles multiple bathrooms, etc. (e.g., 3 × toilet).
- **Allowance vs actual** — show estimating allowance per category vs the locked price.

**Bigger upgrades**

- **Room-based selections** — group by Kitchen / Master Bath / Powder Room rather than just category.
- **Multi-unit projects** — same building, multiple units with shared & per-unit selections.
- **Selection schedule export** — PDF “tearsheet” for client signature.
- **Bulk import** — upload a CSV or XLSX of library items.
- **Versioned selections** — every change creates a new version with one-click rollback.
- **Comparison mode** — pick 2–3 items in a category and compare side-by-side (specs, price, lead time).
- **Suggested upgrades / downgrades** — “Upgrade this faucet to Level 3 for +$340.”
- **Lead time tracking** — store and display delivery estimates; flag long-lead items in red.

### 5.3 Budget & financial features

**Quick wins**

- **Tax & freight** — add per-line or per-project tax % and freight $.
- **Contingency reserve** — set a % of initial budget; show contingency consumed by COs.
- **Multi-currency** with FX (CAD, EUR for international clients).
- **Margin / markup** field — separate cost from sell price.
- **Per-category caps** — alert when a category exceeds its allowance.

**Bigger upgrades**

- **Schedule of Values (SOV)** — generate per-AIA G702/G703 with selections as line items.
- **Pay applications** — track invoiced vs paid against selections.
- **Bank draw integration** — map selections to construction loan draw schedules.
- **Forecasting / EAC** (Estimate at Completion) using accepted + pending COs.
- **Cost variance reports** — by project, by category, by vendor, over time.
- **Budget dashboards with charts** — sparkline by category, donut chart of spend by level, bar chart of CO trend.

### 5.4 Change order workflow (deeper)

**Quick wins**

- **CO templates** — common COs like "Upgrade kitchen package L1→L2."
- **Schedule impact (days)** on each CO line — many contracts require this.
- **Reason codes** — owner request, design change, RFI, unforeseen condition, code change.
- **Attachments** — PDF spec, photos, drawing markup on each CO.
- **Auto-numbering** with format `CO-{Project}-{NN}`.

**Bigger upgrades**

- **E-sign integration** — DocuSign / Dropbox Sign / Adobe Sign.
- **Client portal** — clients log in to approve/reject COs without contractor handholding.
- **Approval routing** — first PM approves, then client, with email notifications.
- **CO bundling** — combine multiple small selection changes into one signed CO at end of month.
- **Deduct change orders** with SOV reference (industry-standard for credits).
- **Backup documentation** — auto-attach vendor quotes, photos, RFIs.
- **PDF CO package generator** with cover sheet, line items, totals, signature blocks.

### 5.5 Vendor & catalog management

**Quick wins**

- **Multi-vendor support** — vendor field per item; filter library by vendor.
- **Vendor contact card** — name, rep, phone, email, account number.
- **Stock status** — Available / Backorder / Discontinued tags.
- **Replace discontinued items** — bulk reassign across projects.

**Bigger upgrades**

- **Vendor APIs / scrapers** — auto-refresh prices from Ferguson, Wayfair, Home Depot Pro.
- **Live availability** — “In stock at Pittsburgh warehouse, 3 business days.”
- **Direct ordering** — push selections to vendor as a quote/PO.
- **Catalog sync schedule** — nightly refresh of price & availability.
- **Multiple price tiers** — list, trade, contractor, with role-based visibility.

### 5.6 Client-facing features

**Quick wins**

- **Public read-only link** per project (token URL, no login) to share selections with client.
- **Acknowledgement** — client clicks “I approve these selections.”
- **Comment thread per item** — client questions a finish choice; PM responds.
- **Style board** — mood-board view of all chosen items as a grid of photos.

**Bigger upgrades**

- **Branded client portal** — separate login for homeowners, with limited views.
- **Mobile app or PWA** — clients pick selections on phone in showroom.
- **3D / AR preview** — link to manufacturer 3D models.
- **Showroom check-in** — QR code on each selection that pulls up the page.
- **Selection deadline countdown** — “Choose your tile by Apr 12 or default will apply.”

### 5.7 Documents, files, and references

**Quick wins**

- **Upload spec sheet PDFs** per item (you already reference `BQ00109630 - FULL SPECS.pdf` etc.).
- **Receipt attachments** per item (Don’s receipts `2bnlevel1.pdf`).
- **Hyperlinks** field per item — already in source docs (Ferguson links), surface them on cards.
- **Photo gallery per item** — multiple images, swipe through.

**Bigger upgrades**

- **Drawing / plan integration** — upload floor plan, drop pins for where each selection goes.
- **Photo-based selection** — client uploads a photo of what they want; PM matches to library.
- **Document version control** for spec sheets.
- **OCR ingestion** — drop a PDF spec; app extracts model & price automatically.

### 5.8 Reporting & analytics

**Quick wins**

- **Export to PDF/Excel** — selection schedule, budget summary, CO log.
- **Filters on timeline** — by event type, by user, by category.
- **Print-friendly view** — cleaner CSS for paper output.

**Bigger upgrades**

- **Dashboards (charts)** —
  - Budget over time line chart with CO markers
  - Spend by category donut
  - Spend by level (1/2/3) stacked bar
  - CO frequency histogram
- **Project portfolio dashboard** — across all projects, total variance, top 10 categories causing change orders.
- **Variance attribution** — “78% of overage came from kitchen ranges across 12 projects.”
- **Vendor performance** — which vendor causes most lead-time delays.
- **Custom report builder** — drag-and-drop fields; save report templates.
- **Scheduled email reports** — weekly digest to PMs and clients.

### 5.9 Collaboration & communication

**Quick wins**

- **@mention** in notes — “@john please verify pricing.”
- **Activity feed** for each user.
- **Email notification** when a CO is released or selection changes.

**Bigger upgrades**

- **Real-time collaboration** — Firebase / Supabase realtime so multiple users see live edits.
- **In-app chat per project**.
- **Slack / Teams integration** — post CO status changes into a channel.
- **SMS alerts** for clients on critical updates.

### 5.10 Integrations

**Quick wins**

- **CSV import/export** to/from Excel.
- **Calendar (iCal/Google) export** of CO milestones.

**Bigger upgrades**

- **QuickBooks Online / Xero** — push selections as estimates, COs as invoices.
- **Buildertrend / CoConstruct / Procore / JobTread** — sync selections into these PM platforms.
- **Sage 100 / Foundation** for construction accounting.
- **Stripe / Square** — accept client deposits on selections via the portal.
- **Google Drive / Dropbox / OneDrive** for document storage.
- **Zapier / Make** webhooks — enable hundreds of downstream integrations.
- **Email-in** — forward a vendor quote email; app parses and creates a draft selection.

### 5.11 AI & automation

**Quick wins**

- **AI suggestions** — “Clients who picked GE Profile fridge usually pick GE Profile dishwasher.”
- **Auto-fill from URL** — paste a Ferguson product URL; app scrapes and adds to library.
- **Spec sheet summarizer** — uploaded PDF → bullet point summary of key features.
- **Auto-draft CO** — when selections change, app drafts the CO text and lines automatically.

**Bigger upgrades**

- **Image-based matching** — client sends inspiration photo; AI finds closest library items.
- **Budget forecasting model** — predict final budget based on patterns from past projects.
- **Natural-language commands** — “Show me all projects over budget by more than $5K.”
- **Smart category mapping** — when bulk importing CSV, AI maps columns automatically.

### 5.12 Quality, performance, and ops

**Quick wins**

- **Tests** — unit (Vitest), integration (Playwright) for critical flows.
- **Storybook** for component library.
- **Error boundary + Sentry** for production error tracking.
- **Bundle size budget** in CI.
- **Lighthouse score** target ≥ 90 on perf/a11y.

**Bigger upgrades**

- **Backend with proper DB** — PostgreSQL on Neon/Supabase/Render.
- **API layer** — tRPC or REST/GraphQL.
- **Background jobs** — for emails, PDF generation, scrapes.
- **Multi-tenant SaaS architecture** if you sell this to multiple builders.
- **Mobile app** via React Native (Expo) sharing the same backend.
- **Offline mode** with sync.

### 5.13 UX & visual polish

**Quick wins**

- **Empty states** with illustrations and helpful next-actions.
- **Onboarding tour** — Shepherd.js / Driver.js for first-time users.
- **Keyboard shortcuts** (`?` for help, `n` for new project, `/` for search).
- **Command palette** (⌘K) — “Go to project AMC”, “Add change order”.
- **Saved filters / views** in library and dashboard.
- **Skeleton loaders** during data load.
- **Toast notifications** for save confirmation.

**Bigger upgrades**

- **Dark mode**.
- **White-label theming** — colors and logo per tenant.
- **Drag-and-drop** category ordering inside a project.
- **Animations** with Framer Motion on transitions.
- **Responsive mobile layout** with bottom tab nav.
- **Accessibility audit** — full WCAG 2.1 AA compliance.

### 5.14 Compliance & data

- **Backup / restore** — export/import the entire `localStorage` blob.
- **GDPR / CCPA** delete-my-data flow on client portal.
- **Data retention policy** per project archive.
- **Audit log export** — immutable CSV for legal disputes.
- **Signed/notarized COs** stored with hash for tamper-evidence.

---

## 6. Suggested phased plan (recommended sequencing)

### Phase 1 — Foundations (1–2 weeks)

> Make the prototype production-grade for one company before adding features.

- Move auth to a real backend (Supabase / Clerk) with multi-user + roles.
- Add a real database (Supabase Postgres) and migrate `localStorage`.
- Add **PDF export** for selection schedule & change orders.
- Add **room** + **quantity** per selection.
- Add **attachments** (spec sheets, receipts).
- Tests for critical flows + Sentry.

### Phase 2 — Power features (3–4 weeks)

- **Client portal** with read-only link + approval.
- **E-sign** integration for COs.
- **Charts & analytics** (budget over time, by category, CO frequency).
- **Allowance vs actual** + **contingency reserve**.
- **Lead time** + **vendor status** fields.

### Phase 3 — Scale & integrations (4–8 weeks)

- **Multi-tenant** architecture.
- **QuickBooks / Buildertrend / Procore** integrations.
- **Mobile-friendly PWA** for showroom use.
- **AI features** — suggestions, spec sheet OCR, auto-draft COs.
- **Project templates** + **bulk import**.

### Phase 4 — Differentiators (ongoing)

- AR/3D preview, AI image matching, predictive budget modeling, native mobile apps, deep ERP integrations.

---

## 7. Tech decisions to lock in soon

| Decision | Options | Recommendation |
|----------|---------|------------------|
| Database | Supabase / Neon / PlanetScale / Firebase | **Supabase** (Postgres + auth + storage + realtime in one) |
| Auth | Supabase Auth / Clerk / Auth0 / NextAuth | **Clerk** (best DX) or **Supabase Auth** (cheapest) |
| Hosting | Vercel / Netlify / Render | **Vercel** (already configured) |
| PDF generation | `react-pdf` / Puppeteer / Documint / PDFMonkey | **react-pdf** for embedded; **Puppeteer** on a Vercel function for richer PDFs |
| E-sign | DocuSign / Dropbox Sign / SignWell | **Dropbox Sign** (cheaper, easy API) |
| Email | Resend / Postmark / SendGrid | **Resend** (modern, simple) |
| File storage | Supabase Storage / S3 / Uploadthing | **Supabase Storage** if using Supabase elsewhere |
| Charts | Recharts / Visx / Tremor | **Tremor** (great dashboard primitives) |
| Component library | shadcn/ui / Mantine / Chakra | **shadcn/ui** (Tailwind-based, copy-in, no lock-in) |

---

## 8. Open questions to align on

1. **Single company or SaaS?** Will only 2BN use this, or do you intend to sell it to other builders?
2. **Source of truth for prices** — manual updates, or scrape Ferguson/Don’s regularly?
3. **Who is the primary client-facing user** — homeowner, designer, or only internal PMs?
4. **Required signatures** — does every CO need formal e-signature, or is in-app approval enough?
5. **Integration priorities** — accounting (QuickBooks) vs PM (Buildertrend) vs vendor catalogs?
6. **Mobile use case** — picking on tablet in showroom? Approving on phone in field?
7. **Data residency / compliance** — any privacy requirements for client data?

---

## 9. Quick-start for new contributors

```bash
# Clone
git clone https://github.com/abhijeetgosavi89/selections.git
cd selections

# Install
npm install

# Dev
npm run dev          # http://localhost:5173/login

# Production build
npm run build
npm run preview

# Refresh library data from docx files (requires Python 3)
python scripts/build_library.py
python scripts/extract_images.py
```

**Login:** `admin` / `2BN-Admin-2026!`

---

## 10. Where things live (cheat sheet)

| I want to… | Edit / look at… |
|-------------|------------------|
| Change admin credentials | `src/config/auth.ts` (or Vercel env vars) |
| Add a category | `selectionLibrary.json → categories` or Library UI |
| Add a new product | Library UI → “Add material” |
| Tweak CO minimum | `selectionLibrary.json → meta.changeOrderMinimum` |
| Edit sidebar links | `src/components/Layout.tsx` |
| Change colors / styling | `src/index.css` (CSS custom properties at top) |
| Add a new tab to project detail | `src/pages/ProjectDetailPage.tsx` |
| Add a new project wizard step | `src/pages/NewProjectPage.tsx` |
| New event type on timeline | `src/types/index.ts → TimelineEventType` + handler |
| Add storage migration | `src/store/storage.ts` |

---

Last updated: **May 22, 2026**
