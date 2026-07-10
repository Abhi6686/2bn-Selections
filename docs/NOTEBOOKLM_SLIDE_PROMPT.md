# NotebookLM Slide Deck Prompt — 2BN Selections

Copy everything inside the **PROMPT START** / **PROMPT END** block below and paste it into NotebookLM when generating your slide deck from `PROJECT_OVERVIEW.md`.

---

## PROMPT START

You are creating a **professional, modern slide deck** for an executive and stakeholder audience (construction company leadership, project managers, and potential technology partners). Use **only** the attached source document `PROJECT_OVERVIEW.md` as your factual basis. Do not invent features that are not described in the document.

### Presentation goal

Explain what **2BN Selections** is today, how it works end-to-end, where it is deployed, what limitations exist, and what the **recommended product roadmap** looks like — in a way that builds confidence to invest in Phase 1 development.

### Audience

- Non-technical executives who need clarity on business value
- Project managers who will use the tool daily
- Optional: technical partner evaluating the stack

### Tone & style

- **Confident, clear, and professional** — not salesy or hype-heavy
- Short sentences; no jargon without a one-line explanation
- Use construction-industry language where appropriate (selections, change orders, allowances, spec sheets)
- Avoid mentioning internal implementation details unless on the Architecture slide

### Visual & design direction (describe on every slide for the designer)

- **Theme:** Modern SaaS + construction professionalism
- **Color palette:** Deep forest green `#1a3d32` (primary), warm off-white `#f0f2f5` (background), charcoal `#111827` (text), accent gold/amber for Level 2 highlights, soft rose for Level 3 premium tier
- **Typography:** Clean sans-serif for body (DM Sans style); elegant serif for titles (Instrument Serif style)
- **Layout:** Generous whitespace; one key idea per slide; max 5–6 bullet points per slide
- **Icons:** Minimal line icons (dashboard, library, budget, timeline, change order, lock/login)
- **Diagrams:** Use simple flow diagrams for user journey and change order workflow; use a 3-column layout for Level 1 / 2 / 3 comparison
- **Do not** use stock photos of generic offices; prefer UI wireframe-style blocks or abstract geometric shapes
- **Charts:** Only where the document supports it (e.g., phased roadmap timeline, limitation vs solution table)

### Deck structure — create exactly **22 slides** with this outline

**Slide 1 — Title**
- Title: **2BN Selections**
- Subtitle: Appliance & Material Selection Management with Budget Control & Change Orders
- Footer: Prototype · May 2026 · Deployed on Vercel
- Speaker note: One-sentence hook — "One place to pick appliances, track budget, and document every change from day one."

**Slide 2 — The problem we solve**
- Bullet pain points: scattered Excel/Word selection sheets; budget drift invisible until too late; change orders undocumented; no audit trail; Level 1/2/3 options hard to compare
- Speaker note: Tie to real docx source sheets

**Slide 3 — Our solution (one slide summary)**
- 4 pillars with icons: **Material Library** · **Project Wizard** · **Budget Tracking** · **Change Order Workflow**
- Tagline: "From first selection to final signed change order — fully traceable"
- Speaker note: 30-second elevator pitch

**Slide 4 — Data foundation: three selection levels**
- 3 columns:
  - **Level 1 — Value:** GE base, ~$6K package reference
  - **Level 2 — Mid:** GE Profile, cooktop + wall oven, ~$12K+
  - **Level 3 — Premium:** Monogram, luxury plumbing, ~$35K+
- Note: Users mix levels per category — not locked to one tier
- Speaker note: Explain Don's Appliances catalog imported from docx

**Slide 5 — Who uses it & how they log in**
- User: Project manager / admin (today: single admin role)
- Login screen description; session security note
- Do **not** display real passwords on the slide — say "credentials managed via environment variables"
- Speaker note: Phase 1 adds multi-user roles

**Slide 6 — User journey (flow diagram)**
- Flow: Login → Dashboard → New Project → Category selections → Initial budget locked → Ongoing changes → Change orders → Timeline audit
- Make this a left-to-right or top-to-bottom diagram with 7–8 steps
- Speaker note: Walk through happy path in 60 seconds

**Slide 7 — Material library**
- Features: 51+ products with images; filter by level & category; add custom materials & categories
- Visual: describe a grid of product cards with image, model, price, level badge
- Speaker note: Images extracted automatically from Word selection sheets

**Slide 8 — New project wizard**
- Step 1: Project name, client, address
- Step 2+: Per category — all levels shown side by side; progress bar; running budget total
- Speaker note: No upfront "pick Level 1 only" — flexibility is a differentiator

**Slide 9 — Project dashboard**
- All projects at a glance: name, client, current budget, variance vs initial, CO count
- Speaker note: Portfolio view for PM managing multiple homes

**Slide 10 — Project detail: five tabs**
- Tab list with one-line purpose each:
  1. Selections (change any level)
  2. Budget history (snapshots)
  3. Change orders (workflow)
  4. Timeline (audit)
  5. Analytics (category variance)
- Speaker note: This is the daily workspace

**Slide 11 — Change selection (deep dive)**
- Modal: compare Level 1, 2, 3 options in same category; price delta preview; apply selection
- Speaker note: Reduces wrong-tier mistakes

**Slide 12 — Change order workflow**
- Status flow diagram: **Draft → Released → Accepted / Rejected**
- $500 minimum threshold (per spec sheets)
- Timestamps recorded on timeline
- Speaker note: Aligns with industry best practice (InEight, Bauwise patterns cited in doc)

**Slide 13 — Budget & alerts**
- Initial budget snapshot at project creation
- Every change creates snapshot + timeline event
- Alert when change ≥ $500 without formal CO
- Speaker note: Prevents silent budget creep

**Slide 14 — Timeline & analytics**
- Timeline: every event type listed (project created, CO accepted, selection updated, etc.)
- Analytics: category variance table; CO touch counts
- Speaker note: Legal and client disputes — audit trail is the safety net

**Slide 15 — Technology stack (architecture)**
- Simple table: React 19, TypeScript, Vite, React Router, Vercel, localStorage (prototype)
- One line: "Phase 1 migrates to Supabase + real auth"
- Speaker note: For technical stakeholders only — keep brief

**Slide 16 — Current limitations (honest assessment)**
- Table with 2 columns: Limitation | Impact
- Include: single admin, browser-only storage, no PDF export, no e-sign, no multi-user
- Tone: transparent, not apologetic — "prototype by design"
- Speaker note: Sets up roadmap credibility

**Slide 17 — Roadmap overview (4 phases)**
- Phase 1 Foundations (1–2 wks): DB, auth, PDF export, attachments
- Phase 2 Power (3–4 wks): client portal, e-sign, charts, allowance vs actual
- Phase 3 Scale (4–8 wks): integrations, PWA, AI, templates
- Phase 4 Differentiators (ongoing): AR, forecasting, mobile apps
- Visual: horizontal timeline with 4 milestones
- Speaker note: Phases from section 6 of source doc

**Slide 18 — Phase 1 priority features (detail)**
- Bullet the 6 Phase 1 items from the document
- Call out **highest ROI:** PDF export, real database, multi-user auth
- Speaker note: What to fund first

**Slide 19 — Future feature highlights (pick top 12 from roadmap)**
- Organize in 4 quadrants or grouped list:
  - **Client experience:** portal, e-sign, style board, mobile PWA
  - **Financial:** SOV, contingency, EAC forecasting, QuickBooks
  - **Operations:** vendor APIs, lead time, room-based selections
  - **Intelligence:** AI suggestions, auto-draft CO, OCR specs
- Speaker note: "Menu of options" — not all required

**Slide 20 — Integrations landscape**
- Logos or name list: QuickBooks, Buildertrend, Procore, DocuSign, Ferguson, Slack/Teams
- Label each: Phase 2 vs Phase 3
- Speaker note: Reduces duplicate data entry

**Slide 21 — Open decisions for leadership**
- 5–7 questions from section 8 of source doc (SaaS vs internal tool, e-sign requirement, mobile use case, etc.)
- Format as discussion prompts, not conclusions
- Speaker note: Use for Q&A slide

**Slide 22 — Closing / next steps**
- **Today:** Live prototype on Vercel; GitHub repo ready
- **Next:** Approve Phase 1 scope; assign owner; set pilot project
- **Contact / CTA:** "Schedule a live demo walkthrough"
- Speaker note: End with confidence and clear ask

### Output requirements

1. For **each slide**, provide:
   - Slide title (max 8 words)
   - On-slide headline (1 sentence)
   - 3–6 bullet points (short, scannable)
   - Optional: one suggested diagram or visual description
   - **Speaker notes** (2–4 sentences) for the presenter
2. Add a **"Design notes"** appendix slide suggestion listing colors, fonts, and icon style
3. Keep total presentation time to **18–22 minutes** (about 1 minute per slide)
4. Use **consistent slide titles** in sentence case
5. Where the source document has tables, convert them to clean slide-friendly tables (max 4 rows on one slide; split if needed)
6. End with a **one-page executive summary** suitable for printing (bullets only, no speaker notes)

### What to avoid

- Do not include admin passwords or credential strings on any slide
- Do not claim features are "live in production" except what the doc says is prototype/deployed
- Do not add competitor names unless comparing to industry patterns already mentioned in the doc
- Do not exceed 6 bullets per slide
- Do not use clip art or cartoon illustrations

Generate the complete slide deck content now, slide by slide, following this structure exactly.

## PROMPT END

---

## Optional follow-up prompts (use after first generation)

### Refine visuals
"Regenerate slides 6, 12, and 17 with detailed descriptions for Mermaid-style flowcharts and a horizontal phase timeline. Keep all text the same."

### Shorter version (10 slides)
"Condense the deck to 10 slides for a 10-minute investor pitch. Keep: problem, solution, demo flow, change orders, limitations, Phase 1 roadmap, next steps. Merge library + wizard into one slide."

### Client-facing version
"Rewrite the deck for **homeowners and clients**, not internal PMs. Remove tech stack slide. Emphasize transparency, budget visibility, and approval of change orders. Softer tone."

### Add appendix
"Add 5 appendix slides: full feature roadmap table by category (5.1–5.14), tech stack detail, data model diagram, competitive best practices summary, and glossary of terms (CO, SOV, EAC, allowance)."
