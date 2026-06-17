# Product Requirements Document — Influencer Campaign Management Platform

**Product codename:** WRM Influencer Dashboard (working title — see §15 for naming)
**Owner:** Product / Engineering
**Status:** Draft v1.0 — foundation for the UI redesign initiative
**Last updated:** 2026-06-05
**Scope of this document:** As-built specification of the current product **plus** the target "out of the box" vision and a phased, module-by-module redesign roadmap.

---

## 1. Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Audience | Engineering, Design, Product, Stakeholders (White Rivers Media) |
| Related docs | `CLAUDE.md`, `RBAC_PERMISSIONS.md`, `RBAC_IMPLEMENTATION_SUMMARY.md`, `INFLUENCER_SCHEMA_DESIGN.md`, `INFLUENCER_SYSTEM_IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_COMPLETE_PHASE1.md` |
| Decisions ratified | UI stack = **Tailwind + shadcn/ui**; Visual direction = **Clean Professional (light)** with dark mode; First build target = **Design system + app shell** |

---

## 2. Executive Summary

The product is a **full-stack influencer marketing campaign management platform**. It lets an agency (White Rivers Media) and its teams run influencer campaigns end-to-end: maintain a reusable master of influencers and brands, create campaigns, assign influencers with deliverables and commercials, track the content they publish, and measure performance (views, likes, comments, engagement) — including **live metrics pulled from Instagram/Facebook via OAuth** and (on the `dev-apify` branch) social scraping.

It also ships a **self-service influencer portal**: invited influencers log in, maintain their own profile, connect their social accounts, see the campaigns they're on, and submit the content links they've published.

The application works today but is built on **~8,000 lines of bespoke, duplicated CSS** with an inconsistent visual language and no shared component system. This PRD defines the product faithfully as it exists, then sets the target experience: a polished, cohesive, **"out of the box" SaaS** built on a real design system (Tailwind + shadcn/ui), with a clean professional aesthetic, dark mode, and a set of high-leverage new capabilities (discovery, analytics, content approval workflow, reporting, command palette, notifications). The redesign is delivered **module by module**, starting with the design-system + app-shell foundation that every later screen reuses.

---

## 3. Goals & Non-Goals

### 3.1 Business Goals
- **G1 — Credibility:** Look and feel like a premium B2B SaaS that an agency can confidently demo to brand clients.
- **G2 — Efficiency:** Reduce the time to plan a campaign, shortlist influencers, and report results.
- **G3 — Data trust:** Make influencer reach and content performance accurate, current, and easy to read.
- **G4 — Scale:** Support a growing influencer master and many concurrent campaigns without UI degradation.
- **G5 — Self-service:** Shift routine data entry (profiles, content links) to influencers via the portal.

### 3.2 Product Goals (this initiative)
- **P1:** Replace bespoke CSS with a single design system (Tailwind + shadcn/ui) and reusable component primitives.
- **P2:** Establish one consistent information architecture, navigation shell, and interaction language across every module.
- **P3:** Ship dark mode, responsive layouts, accessible components, and modern UX affordances (skeletons, toasts, empty states, command palette).
- **P4:** Add high-value capabilities that turn the tool from a record-keeper into a decision-making product (discovery, analytics, approvals, reporting).

### 3.3 Non-Goals (for this initiative)
- Re-architecting the backend into microservices (the single-file Flask app stays; it is refactored only where a feature requires it).
- Replacing SQLite for production (tracked as a separate infra task; see §12.4).
- Building a public marketplace / influencer-facing discovery for external brands.
- Native mobile apps (the web app will be responsive instead).

---

## 4. Personas & Roles

The system has **four roles** (backend-enforced via JWT + decorators; frontend-gated via `AuthContext`). Note: the codebase currently has **naming drift** — older docs say "Manager/Viewer" while the live roles are "Campaign Manager/Campaign Executor". The redesign standardizes on the live names.

| Persona | Role | Primary jobs-to-be-done | Today's entry point |
|---|---|---|---|
| **Agency Admin** | `Admin` | Full control: all campaigns, users, roles, masters, brands. Oversees the whole operation. | `/` (Campaign Dashboard) |
| **Campaign Manager** | `Campaign Manager` | Create & run campaigns they own; assign influencers & teammates; manage influencer/brand masters. | `/` (Campaign Dashboard) |
| **Campaign Executor** | `Campaign Executor` | Execute on assigned campaigns: track deliverables, update content, read analytics. Cannot create campaigns/users. | `/` (Campaign Dashboard) |
| **Influencer** | `Influencer` | Maintain own profile, connect socials, view assigned campaigns, submit published content links. | `/influencer/dashboard` |

**Permission matrix (as-built, condensed):**

| Action | Admin | Campaign Manager | Campaign Executor | Influencer |
|---|:--:|:--:|:--:|:--:|
| View all campaigns | ✅ | own/assigned | assigned | own (portal) |
| Create/edit campaign | ✅ | ✅ | ❌ | ❌ |
| Assign influencers to campaign | ✅ | ✅ (own) | ❌ | ❌ |
| Manage influencer master | ✅ | ✅ | read | own profile only |
| Manage brand master | ✅ | ✅ | read | ❌ |
| Manage master data (geo, categories) | ✅ | ✅ | ❌ | ❌ |
| Manage users & roles | ✅ | ❌ | ❌ | ❌ |
| Submit content links | ✅ | ✅ | ✅ | ✅ (own) |
| Connect social accounts | — | — | — | ✅ (own) |

---

## 5. Current State (As-Built)

### 5.1 Tech Stack
- **Backend:** Flask (single file `backend/app.py`, ~3,900 LOC), SQLAlchemy ORM, JWT auth (24h expiry), Werkzeug password hashing, Flask-Mail for invites/credentials, CORS open. Helper scripts for schema upgrades and influencer import (`upgrade_schema.py`, `add_*_columns.py`, `import_influencers.py`, `migrate_to_mysql.py`).
- **Frontend:** React 19, React Router 7, Axios, Recharts. Create React App tooling (`react-scripts` 5). State via React Context (`AuthContext`). **~8,000 LOC of hand-written CSS** across 15 files; design tokens are redefined per-file.
- **Database:** SQLite (`backend/instance/campaigns.db`), no migration framework (manual scripts). A MySQL migration path exists (`migrate_to_mysql.py`).
- **Integrations:** Instagram & Facebook OAuth (live follower/post metrics); YouTube, Twitter/X, Instagram, Facebook post-metric fetchers; `dev-apify` branch introduces Apify-based scraping.

### 5.2 Modules & Routes (current)

| Route | Component | Access | Purpose |
|---|---|---|---|
| `/login` | `Login` | Public | Authentication |
| `/set-password` | `SetPassword` | Public (token) | Invite acceptance / first password |
| `/` | `CampaignDashboard` | Authenticated | Campaign list + KPI cards |
| `/campaign/:id` | `CampaignDetail` | Authenticated (assignment-checked) | Campaign detail: influencers, content, analytics |
| `/campaigns/new` | `NewCampaign` | Admin, Campaign Manager | Create campaign |
| `/influencers` | `InfluencerList` | Authenticated | Influencer master list |
| `/influencers/new`, `/influencers/:id/edit` | `InfluencerForm` | Admin, Campaign Manager | Create/edit influencer |
| `/brands`, `/brands/new`, `/brands/:id/edit` | `BrandList`, `BrandForm` | List: auth; Edit: Admin/CM | Brand master |
| `/masters` | `MasterData` | Admin, Campaign Manager | Countries/States/Cities/Categories |
| `/users` | `UserManagement` | Admin | Users & roles |
| `/influencer/dashboard` | `InfluencerDashboard` | Influencer | Self-service home |
| `/influencer/campaign/:id` | `InfluencerCampaignDetail` | Influencer | Influencer's view of a campaign + content submission |

### 5.3 Data Model (as-built)

Core entities and the most important fields:

- **User** — username, email, names, `is_active`, roles (M2M), assigned_campaigns (M2M), invite token + expiry, last_login; optional 1:1 link to an `Influencer` profile.
- **Role** — name, description, `permissions` (JSON array; Admin = `["*"]`).
- **Campaign** — name, objective, `brand_id` (FK), description, status, start/end dates, creator, assigned_users (M2M). Derived: #influencers, total content, total views/likes/comments.
- **Influencer** *(rich master)* — identity (name, email, phone, profile pic, bio), categories (JSON), location FKs (Country→State→City), per-platform handle/followers/URL for **Instagram, YouTube, Facebook, Twitter/X, LinkedIn**, tier (Nano/Micro/Macro/Mega, auto-calculated), full **rate card** per platform/format, past brands, **WRM relationship** (worked-with flag, first/last collab dates, total campaigns, notes), status (active/inactive/blacklisted), performance rating, optional linked `User` (portal access).
- **Brand** — name, description, status, categories (M2M), creator.
- **Category** — name, description, icon (emoji), status. Used by brands and influencers.
- **Country / State / City** — geo masters with cascade and uniqueness constraints.
- **CampaignInfluencer** *(assignment)* — campaign×influencer link with platform, link, deliverables count, content type spec, **compensation** (agreed amount, type, notes), contract dates, status (pending→active→in_progress→completed/cancelled), content tracking counts (submitted/approved/published), notes.
- **Content** *(per piece)* — campaign + influencer + assignment FKs, platform, content type (Post/Reel/Story/Video/Short/Tweet), url, thumbnail, caption, **metrics** (views, likes, comments, shares, saves, engagement_rate), status workflow (draft→submitted→approved→published/rejected), timestamps incl. `last_metrics_update`.
- **SocialAccountToken** — OAuth tokens per influencer/platform (IG/FB) for live metrics.
- **OAuthState** — CSRF protection for the OAuth flow.

### 5.4 API Surface (as-built, grouped)
- **Auth:** `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `GET /auth/verify-invite`, `POST /auth/set-password`.
- **Users:** CRUD `/users`, `/users/active`, per-id GET/PUT/DELETE.
- **Roles:** `GET/POST /roles`, `PUT/DELETE /roles/:id`.
- **Campaigns:** `GET/POST /campaigns`, `GET /campaigns/:id`, `PUT /campaigns/:id/assignments`, influencer sub-resources (`/influencers`, `/influencers/:aid/link`, content add/update/delete), `GET /campaigns/:id/content`, `GET /campaigns/:id/analytics`.
- **Influencers:** `GET/POST /influencers`, per-id GET/PUT/DELETE, `POST /influencers/:id/invite`, `POST /influencers/:id/resend-invite`.
- **Influencer self-service:** `GET/PUT /influencer/me`, `/influencer/me/campaigns`, `/influencer/me/campaign/:id`, analytics, assignment content add/update/delete, `/influencer/me/social-accounts`, refresh IG/FB stats.
- **Social/OAuth:** Instagram/Facebook connect + callback, `POST /content/:id/refresh-metrics`.
- **Masters:** CRUD for `/countries`, `/states`, `/cities`, `/categories`, `/brands`.

### 5.5 Known Gaps & Debt (the "why" of the redesign)
1. **No design system** — 15 CSS files, duplicated `:root` tokens, inconsistent spacing/typography/components.
2. **Inconsistent IA** — navigation lives as ad-hoc header buttons per page; no persistent shell/sidebar; the active section isn't indicated.
3. **No dark mode**, limited responsiveness, inconsistent empty/loading/error states.
4. **Limited analytics** — single-campaign analytics only; no cross-campaign or portfolio view; no spend/ROI rollups despite the data existing (`agreed_amount`).
5. **No influencer discovery** — the rich master (tier, category, ER, rate, location) isn't searchable/filterable as a decision tool.
6. **No content approval workflow UI** — the status workflow exists in the model but isn't surfaced as a board/queue.
7. **No reporting/export** — no shareable campaign report or CSV/PDF export.
8. **Role naming drift** and scattered permission logic.
9. **No notifications/activity**, no audit log, no command palette.
10. **CRA tooling** is effectively deprecated and not ideal for Tailwind + shadcn/ui (see §11 / §13).

---

## 6. Target Product — The "Out of the Box" Vision

The redesigned product is organized around a **persistent app shell** (left sidebar + top bar + command palette) and **role-aware home dashboards**. Each module is rebuilt on shared primitives so the whole product feels like one cohesive SaaS.

### 6.1 Experience Principles
- **Clarity over decoration** — generous whitespace, strong typographic hierarchy, one confident brand accent.
- **One language** — the same buttons, inputs, tables, cards, modals, toasts everywhere.
- **Fast** — skeleton loaders, optimistic updates, keyboard-first (`⌘K` command palette, shortcuts).
- **Always oriented** — persistent nav with active state, breadcrumbs, and clear page headers.
- **Forgiving** — explicit empty states, inline validation, confirmable destructive actions, undo where possible.
- **Accessible & responsive** — WCAG AA contrast, keyboard navigable, works from laptop to tablet to phone.

### 6.2 New / Upgraded Capabilities (vision)
| # | Capability | Value | Leverages existing data |
|---|---|---|---|
| V1 | **Global app shell + nav + ⌘K command palette** | Orientation, speed | Routes/roles |
| V2 | **Role-aware home dashboards** | Each persona lands on what matters | Campaigns, content, analytics |
| V3 | **Influencer Discovery** (faceted search: tier, category, location, ER, rate, platform, WRM history) | Turns the master into a planning tool | Influencer master fields |
| V4 | **Shortlists & comparison** (build a list, compare side-by-side, push to a campaign) | Faster casting decisions | Influencer master |
| V5 | **Cross-campaign Analytics / Portfolio view** (reach, engagement, top performers, trends) | Executive insight | Content + campaign rollups |
| V6 | **Spend & ROI tracking** (budget vs agreed amounts vs delivered; cost-per-view/engagement) | Commercial control | `agreed_amount`, content metrics |
| V7 | **Content Approval Workflow** (Kanban: draft→submitted→approved→published/rejected) | Operational clarity | `Content.status` workflow |
| V8 | **Reporting & export** (shareable campaign report, CSV/PDF) | Client deliverable | Campaign + content data |
| V9 | **Notifications & activity feed** (invites accepted, content submitted, metrics refreshed) | Stay in the loop | Events across modules |
| V10 | **Bulk actions, saved views, CSV import** | Scale & data ops | `import_influencers.py` exists |
| V11 | **Dark mode + theming** | Modern, comfortable | Design tokens |
| V12 | **Audit log** (who did what) | Compliance/trust | New table |

These are prioritized in the roadmap (§14); not all ship in the first passes.

---

## 7. Functional Requirements by Module

> Notation: **[A]** = as-built (rebuild faithfully), **[N]** = new/vision (added during redesign).

### 7.1 Authentication & Onboarding
- [A] Username/password login → JWT; auto-restore session from token; logout.
- [A] Invite flow: admin invites a user/influencer → email with token → `/set-password` to activate.
- [A] Token refresh; protected routes; role-based redirects (Influencer → portal).
- [N] Branded split-screen login, password strength meter, clear invite-acceptance screen, graceful expired-token handling, "forgot password" (stretch).

### 7.2 App Shell & Navigation **(Module 1 — build first)**
- [N] Persistent **left sidebar** (collapsible) with role-filtered sections; **top bar** with search/⌘K, notifications, theme toggle, user menu.
- [N] Breadcrumbs + standardized page header (title, description, primary actions).
- [N] Responsive: sidebar collapses to icons / drawer on small screens.
- [N] Dark/light theme toggle persisted per user.

### 7.3 Campaigns
- [A] List with KPI cards (total, active, completed, influencers, content), search, status filter.
- [A] Create campaign (brand, objective, status, dates, description; assign users/influencers).
- [A] Detail: assigned influencers (platform, deliverables, compensation, status), content list, analytics; add/edit/remove influencer assignments and content; refresh content metrics.
- [N] Campaign status pipeline view; budget vs spend; per-influencer deliverable progress; content approval board (V7); export report (V8); duplicate campaign.

### 7.4 Influencer Master & Discovery
- [A] List with search/filter; create/edit with full profile, multi-platform handles/followers, rate card, location, categories, WRM history; invite to portal; delete.
- [N] **Discovery** faceted search (V3), **shortlists & comparison** (V4), bulk invite, CSV import/export (V10), profile detail page with performance history across campaigns.

### 7.5 Influencer Self-Service Portal
- [A] Home dashboard; edit own profile; view assigned campaigns + analytics; submit/update/delete content links per assignment; connect/disconnect IG/FB; refresh own stats.
- [N] Cleaner onboarding checklist (complete profile, connect socials), deliverable to-do list, clearer content submission with live preview/validation, earnings summary.

### 7.6 Brands & Master Data
- [A] Brand CRUD with categories; Country/State/City CRUD; Category CRUD.
- [N] Unified "Settings → Masters" area with consistent table UX, inline create, search, and status toggles; cascade-aware geo editor.

### 7.7 Users & Roles (Admin)
- [A] User CRUD, role assignment, activate/deactivate, invites; role create/edit/delete with JSON permissions.
- [N] Clear role matrix editor, user status & last-login at a glance, resend-invite, search/filter, bulk role changes.

### 7.8 Analytics & Reporting (largely new)
- [A] Single-campaign analytics (Recharts).
- [N] Cross-campaign portfolio dashboard (V5), spend/ROI (V6), top performers, platform breakdowns, trend lines, exportable reports (V8).

### 7.9 Cross-cutting
- [N] Command palette (V1), notifications/activity (V9), audit log (V12), global toasts, consistent loading/empty/error states, optimistic updates.

---

## 8. Non-Functional Requirements
- **Performance:** First meaningful paint < 2s on a mid laptop; list views virtualized beyond ~200 rows; skeletons for all async data.
- **Accessibility:** WCAG 2.1 AA — keyboard navigable, focus states, ARIA via shadcn/Radix primitives, AA contrast in both themes.
- **Responsiveness:** Usable from 360px (phone) to wide desktop; sidebar adapts; tables become cards/scroll on small screens.
- **Browser support:** Latest 2 versions of Chrome, Edge, Firefox, Safari.
- **Security:** Keep JWT auth; move `SECRET_KEY` and mail creds to env; tighten CORS for production; never expose tokens in logs; httpOnly cookie option evaluated (stretch).
- **Maintainability:** One token source of truth; typed component props (PropTypes/JSDoc, TS optional); no per-file design tokens.
- **Internationalization-ready:** Currency already modeled (INR default); number/date formatting centralized.

---

## 9. Information Architecture & Navigation (target)

```
App Shell
├── Top bar:  [⌘K search]   [+ Quick create]   [🔔 notifications]   [🌓 theme]   [user ▾]
└── Sidebar (role-filtered):
    ├── Home / Dashboard         (role-aware)
    ├── Campaigns                (Admin, CM, CE)
    ├── Influencers              (Admin, CM, CE)
    │     └── Discovery / Shortlists
    ├── Brands                   (Admin, CM, CE-read)
    ├── Analytics & Reports      (Admin, CM)
    ├── Settings
    │     ├── Master Data        (Admin, CM)
    │     ├── Users & Roles      (Admin)
    │     └── Preferences        (all)
    └── [Influencer role only] Portal: My Profile · My Campaigns · Socials · Content
```

---

## 10. Key UX Flows (target)
1. **Plan a campaign:** Home → Campaigns → New → pick brand/objective/dates → open Discovery → filter & shortlist influencers → add with deliverables/commercials → invite → track.
2. **Cast influencers:** Influencers → Discovery (filter by tier/category/ER/rate/location) → compare shortlist → push selected to a campaign.
3. **Approve content:** Campaign → Content board → review submitted → approve/reject → published items pull live metrics.
4. **Report results:** Campaign → Analytics → export PDF/CSV → share with brand.
5. **Influencer self-service:** Invite email → set password → complete profile → connect socials → see assigned campaigns → submit published links → watch metrics populate.

---

## 11. Design System Direction (Clean Professional, light + dark)

- **Foundation:** Tailwind CSS for utilities + **shadcn/ui** (Radix-based, accessible, owned-in-repo components) for primitives.
- **Tokens (CSS variables, themeable):** color (background, foreground, muted, card, border, primary accent, success/warning/destructive/info), radius, spacing scale, shadows, typography scale. One source of truth; light & dark variants.
- **Brand accent:** evolve the current indigo/violet (`#667eea`/`#764ba2`) into a single confident, accessible primary; neutral gray scale for surfaces; semantic status colors aligned to campaign/content statuses.
- **Typography:** modern sans (e.g., Inter); clear scale (display/h1–h4/body/caption); tabular numerals for metrics.
- **Core components (shadcn):** Button, Input/Select/Combobox, Checkbox/Switch/Radio, Dialog/Sheet/Drawer, DropdownMenu, Tooltip, Tabs, Card, Badge, Avatar, Table (with sort/filter/pagination), Toast (Sonner), Skeleton, Pagination, Breadcrumb, Command (⌘K), Calendar/DatePicker, Charts (Recharts wrapped in themed containers).
- **Patterns:** standardized page header, KPI stat card, data table, filter bar, form layout, empty state, confirm dialog, status badge mapping.

---

## 12. Data & Backend Considerations

### 12.1 Reuse first
The data model is rich enough to power most vision features without schema changes (discovery, comparison, spend/ROI, approval board all read existing fields).

### 12.2 Likely additions (incremental, only when a feature needs them)
- `Notification` / `ActivityLog` (V9/V12).
- `Shortlist` / `ShortlistInfluencer` (V4).
- `Campaign.budget` (V6 — to compare against summed `agreed_amount`).
- Saved views / user preferences (theme, default filters) (V10/V11).

### 12.3 Naming & consistency
- Standardize role names in code, docs, and seed data; centralize permission checks.

### 12.4 Infra (tracked, not in UI scope)
- Introduce a migration framework (Alembic) to replace ad-hoc `add_*_columns.py` scripts.
- Production DB (MySQL/Postgres) using the existing `migrate_to_mysql.py` as a starting point.
- Env-based secrets; CORS allowlist.

---

## 13. Frontend Build & Architecture Decision

- **Decision:** adopt **Tailwind + shadcn/ui**.
- **Build tooling:** the current **Create React App** setup (`react-scripts` 5) is effectively unmaintained and is not the recommended host for shadcn/ui. **Recommendation: migrate to Vite** (React 19 compatible, fast, first-class Tailwind/shadcn support). This is the first technical step of Module 1. (Alternative: keep CRA with Tailwind via PostCSS — possible but swims against the ecosystem.)
- **Structure:** introduce `src/components/ui/*` (shadcn primitives), `src/layouts/*` (app shell), `src/lib/*` (api client, utils, formatters), `src/features/<module>/*`. Migrate existing screens into this structure module by module; delete the corresponding bespoke CSS as each screen is ported.
- **Compatibility:** keep the existing API contract and `AuthContext` behavior so the backend is untouched during the UI rebuild.

---

## 14. Phased Roadmap (module by module)

Each phase ends with a working, demoable slice. Bespoke CSS for a screen is removed when that screen is ported.

| Phase | Module | Key deliverables | New value |
|:--:|---|---|---|
| **0** | **Design System + App Shell** *(first)* | Vite migration, Tailwind + shadcn setup, theme tokens (light/dark), core component primitives, app shell (sidebar + top bar), routing/layout, ⌘K scaffold, toasts/skeletons/empty-state patterns | V1, V11 |
| **1** | Auth & Onboarding | Rebuilt login, set-password/invite, expired-token UX, role-based redirects | — |
| **2** | Campaigns | Dashboard (KPIs, filters), detail (assignments, content, analytics), create flow on new primitives | — |
| **3** | Influencer Master + Discovery | List/form rebuild, **Discovery** faceted search, profile detail, shortlists/compare | V3, V4 |
| **4** | Influencer Portal | Onboarding checklist, deliverable to-dos, content submission UX, socials | — |
| **5** | Brands + Master Data + Users/Roles | Unified settings area, consistent tables, role matrix editor | — |
| **6** | Analytics & Reporting | Portfolio dashboard, spend/ROI, content approval board, export | V5, V6, V7, V8 |
| **7** | Cross-cutting polish | Notifications/activity, audit log, command-palette actions, a11y & responsive sweep | V9, V12 |

> Phases are sequential for coherence but later phases can begin once Phase 0 primitives exist. Backend additions (§12.2) are introduced just-in-time within the phase that needs them.

---

## 15. Open Questions / To Confirm
- **Product name & brand:** keep "Influencer Dashboard" or rename (e.g., a WRM-branded product name)? Affects logo, login, sidebar header.
- **Brand palette:** confirm the exact primary accent (refine from current indigo/violet) and whether to match WRM brand colors.
- **Multi-tenancy:** single agency (WRM) or eventually multiple agencies/orgs? Influences data model and nav.
- **Currency/locale defaults:** INR-first confirmed? Any multi-currency need?
- **Reporting format:** PDF, shareable link, or both for client deliverables?

---

## 16. Success Metrics
- **Adoption:** % of influencers who complete portal onboarding; weekly active managers.
- **Efficiency:** time to create a campaign and cast N influencers; time to produce a client report.
- **Quality:** reduction in CSS/UI defects; Lighthouse a11y & performance scores (target ≥ 90).
- **Consistency:** number of design-token sources (target: 1) and shared components reused (target: high).
- **Data trust:** % of content with fresh metrics; % of influencers with connected socials.

---

## 17. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Build migration (CRA→Vite) destabilizes the app | Do it first in Phase 0 behind a clean branch; keep API/AuthContext unchanged; verify each route still loads |
| Big-bang redesign stalls | Module-by-module delivery; each phase independently demoable |
| Scope creep from vision features | Vision items are explicitly phased; ship as-built parity first per module |
| Backend coupling surprises | Keep API contract stable; add endpoints only when a feature requires |
| Data correctness (live metrics) | Keep existing OAuth/Apify fetchers; surface `last_metrics_update` in UI |

---

## 18. Appendix — Source of Truth References
- Roles & permissions: `RBAC_PERMISSIONS.md`, `AuthContext.js`, `app.py` decorators.
- Influencer schema rationale: `INFLUENCER_SCHEMA_DESIGN.md`, `INFLUENCER_SYSTEM_IMPLEMENTATION_PLAN.md`.
- API surface: `backend/app.py` route definitions.
- Current UI: `frontend/src/**` components + co-located CSS (to be replaced).

---

*End of PRD v1.0. Next step: Phase 0 — Design System + App Shell. A dedicated implementation plan will accompany that phase.*
