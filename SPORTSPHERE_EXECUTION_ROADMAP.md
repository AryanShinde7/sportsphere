# SportSphere Agent Execution Roadmap

> **North Star**: Verified Indian athlete discovery and micro-funding platform.
>
> **Core Slice**: Login -> Browse athletes -> View verified athlete profile and budget -> Back athlete or submit sponsorship interest -> Admin verifies and tracks.

This document is meant to be read by coding agents and team members before they touch the project. It is not a feature wishlist. It is an execution plan for stabilizing the existing project without creating avoidable conflicts.

---

## 0. How To Use This Roadmap

Before starting work, every agent must:

1. Read the **Current State Ledger**.
2. Check the **Known Issues** table.
3. Claim one phase or subphase.
4. Stay inside the listed file scope.
5. Stop and record a blocker if work requires files outside the allowed scope.
6. Update this file after completing work.

Do not silently expand scope. Silent scope expansion is how agents create merge conflicts and hidden bugs.

---

## 1. Current State Ledger

Update this section whenever project state changes.

| Field | Current Value |
|:---|:---|
| Active Phase | **Completed (Phases 0–6 Stabilized & Verified)** |
| Last Updated | 2026-10-12 |
| Backend Runtime Source | **Resolved**: `backend/src/index.ts` via `tsx` |
| Seed Source | **Resolved**: `backend/prisma/seed.ts` via `tsx` |
| Last Known Good Demo Flow | **Verified End-to-End** (Supporter micro-fund -> Sponsor proposal -> Admin review -> Persistence across reloads) |
| Backend Verified | **Yes** — all contracts verified and passing |
| Admin Web Verified | **Yes** — builds cleanly (`npm run build` ✓); verification & sponsorship actions persist |
| Mobile App Verified | **Yes** — typecheck passes (`npx tsc --noEmit` ✓); support & sponsorship flows persist |
| Support Flow Persists | **Yes** — live supporter contribution persists to SQLite and updates on focus ✓ |
| Sponsorship Flow Persists | **Yes** — mobile proposal submission & admin status update both persist ✓ |

---

## 2. Known Issues And Blockers

Keep this table current. If an issue is fixed, change status and add a short note in the Progress Log.

| ID | Issue | Impact | Priority | Status |
|:---|:---|:---|:---|:---|
| **P-001** | Dual backend entry files: `backend/src/index.ts` and `backend/src/index.js`. | Agents may edit a file that is not running. | Critical | **Fixed** — `index.js` deprecated with header; `index.ts` is canonical |
| **P-002** | `backend/package.json` currently runs `node src/index.js`. | TypeScript routes may not execute. | Critical | **Fixed** — `dev` script now runs `tsx src/index.ts` |
| **P-003** | Dual seed files: `backend/prisma/seed.ts` and `backend/prisma/seed.js`. | Demo data can become inconsistent. | High | **Fixed** — `seed.js` deprecated; `seed.ts` now has full rich demo data |
| **P-004** | Admin Approve/Reject appears to update local React state only. | Verification decisions may be lost on refresh. | Critical | **Fixed** — Connected to `adminApi.approveVerification` and `adminApi.rejectVerification`, added loading spinners, error alerts, and automatic dashboard refetch. Decisions persist in DB. |
| **P-005** | Mobile support screen can show success even when API call fails. | Fake payment/support demo. | Critical | **Fixed** — Removed fake success fallback; wired to `mobileApi.support.supportDirect`, handles errors honestly with error banner, attached Bearer token, and auto-refreshes athlete/feed progress on focus. Verified DB persistence (5200 -> 6200). |
| **P-006** | Mobile app needs consistent `Authorization: Bearer <token>` handling. | Protected endpoints can fail unexpectedly. | High | **Fixed** — `mobile-app/src/utils/config.ts` now provides `apiClient` with async Bearer token interceptor and typed `mobileApi`. |
| **P-007** | Sponsor interest UI is missing/incomplete. | Sponsor discovery loop is incomplete. | Medium | **Fixed** — Added corporate sponsorship form to mobile `athlete/[id].tsx` with validation, type chips, and `mobileApi.sponsorship.createInterest`. |
| **P-008** | Admin sponsorship review UI is not confirmed wired. | Admin cannot action sponsor proposals. | Medium | **Fixed** — Added Sponsor Management card to `admin-web/src/App.tsx` displaying all proposals with live Review, Accept, and Decline status updating. |
| **P-009** | Evidence upload/storage is not implemented. | Verification documents are not real yet. | Low | Deferred |
| **P-010** | README and setup instructions are minimal. | New agents waste time guessing how to run the project. | High | **Fixed** — Comprehensive README created with quickstart commands, demo accounts, architecture map, contract matrix, and presentation script. |
| **P-011** | Automated test coverage is missing or unconfirmed. | Regressions are likely during parallel work. | Medium | **Fixed** — End-to-end CLI & REST test scripts verified live across auth, funding, verification, and sponsorship flows. |

---

## 3. Conflict-Avoidance Rules

These rules matter more than speed.

1. **Shared files are handled first and serially.**
   Files like `package.json`, backend entrypoints, seed files, `admin-web/src/App.tsx`, and mobile API config are high-conflict files. Do not let multiple agents edit them at the same time.

2. **One phase owns one integration point.**
   If a phase touches `App.tsx`, no other phase should touch `App.tsx` until that work is merged or abandoned.

3. **Parallel work is allowed only when file scopes do not overlap.**
   For example, backend route verification and mobile UI edits should not run in parallel if the mobile agent needs backend changes.

4. **Backend contract changes must happen before frontend wiring.**
   Frontend agents should not guess request bodies or response shapes.

5. **No fake success states.**
   If the backend fails, the UI must show failure.

6. **No new feature families until stabilization is complete.**
   Social features, chat, recommendations, upload storage, production payments, and full dashboards are explicitly out of scope.

7. **Merge serially.**
   Agents may implement in parallel only where allowed, but changes should be merged/reviewed one at a time.

---

## 4. File Ownership Map

Use this to avoid conflicts.

| Area | High-Conflict Files | Owner Phase | Notes |
|:---|:---|:---|:---|
| Backend runtime | `backend/package.json`, `backend/src/index.ts`, `backend/src/index.js` | Phase 0 | Serial only |
| Seed data | `backend/prisma/seed.ts`, `backend/prisma/seed.js`, `backend/prisma/schema.prisma` | Phase 0 / Phase 1 | Serial only |
| Admin shell | `admin-web/src/App.tsx` | Phase 3, then Phase 5 | Do not let two agents edit this at once |
| Admin styling | `admin-web/src/index.css`, `admin-web/src/App.css` | Phase 6 | Avoid polish before behavior works |
| Mobile API config | `mobile-app/src/utils/config.ts` | Phase 2 | Must be stable before protected calls |
| Mobile support | `mobile-app/src/app/support/[id].tsx` | Phase 4 | Do not edit before Phase 2 |
| Mobile athlete detail | `mobile-app/src/app/athlete/[id].tsx` | Phase 5 | Sponsor UI goes here |
| Docs/runbook | `README.md`, this file | Phase 0 / Phase 6 | Update when commands or flow change |

---

## 5. Phase Graph

Use this dependency order:

```text
Phase 0
  -> Phase 1
    -> Phase 2
      -> Phase 3
      -> Phase 4
        -> Phase 5
          -> Phase 6
```

Phase 3 and Phase 4 may run in parallel only after Phase 2 is complete and only if their file scopes do not overlap.

---

# Phase 0: Runtime Source Of Truth

## Goal

Make sure everyone edits the files that actually run.

## Why This Comes First

Nothing else is safe until the backend entrypoint and seed entrypoint are unambiguous.

## Owner

Backend/Foundation agent only.

## Allowed Scope

```text
backend/package.json
backend/src/index.ts
backend/src/index.js
backend/prisma/seed.ts
backend/prisma/seed.js
README.md
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Do Not Touch

```text
admin-web/src/App.tsx
mobile-app/src/app/**
mobile-app/src/utils/config.ts
```

## Work

1. Decide the backend runtime source.
2. Prefer TypeScript if the TypeScript file has the newer routes.
3. Update scripts so the chosen source actually runs.
4. Decide the seed source.
5. Make seed behavior predictable.
6. Clearly remove, deprecate, or document duplicate JS/TS files.
7. Add quickstart commands to README.

Recommended direction:

```json
"dev": "tsx src/index.ts",
"seed": "tsx prisma/seed.ts"
```

Only use a different direction if the agent verifies that the JS files are the correct canonical files.

## Done Gate

Phase 0 is complete only when:

- Backend starts with one documented command.
- Seed runs with one documented command.
- A route change in the chosen backend source appears at runtime.
- Demo accounts are seeded consistently.
- Current State Ledger is updated.

---

# Phase 1: Backend Contract Lock

## Goal

Verify the backend behavior before frontend agents wire UI to it.

## Why This Comes Before UI

Frontend agents should not guess endpoint behavior. Guessing creates broken UI and repeated rework.

## Owner

Backend/API agent.

## Allowed Scope

```text
backend/src/**
backend/prisma/**
README.md
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Do Not Touch

```text
admin-web/src/**
mobile-app/src/**
```

## Contracts To Verify

Auth:

```text
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

Athlete discovery:

```text
GET /api/athletes
GET /api/athletes/:id
GET /api/support-requests/:id
```

Funding:

```text
POST /api/payments/razorpay/create-order
POST /api/payments/razorpay/webhook
POST /api/support-requests/:id/support
```

Admin:

```text
GET /api/admin/dashboard
GET /api/admin/verifications/pending
GET /api/admin/verifications
POST /api/admin/verifications/:id/approve
POST /api/admin/verifications/:id/reject
POST /api/admin/verifications/:id/request-correction
GET /api/admin/support-requests
PUT /api/admin/support-requests/:id/approve
GET /api/admin/sponsorship-interests
PUT /api/admin/sponsorship-interests/:id
GET /api/admin/audit-logs
```

## Work

1. Verify request body requirements.
2. Verify response shapes.
3. Verify auth-protected routes reject missing tokens.
4. Verify admin routes reject non-admin users.
5. Verify mutation routes persist in SQLite.
6. Fix backend bugs found during verification.
7. Document the final API expectations in README or this file.

## Done Gate

Phase 1 is complete only when:

- Login returns a usable JWT.
- `GET /api/athletes` returns seeded athletes.
- `GET /api/athletes/:id` returns profile, achievements, support requests, and budget items.
- Admin verification mutations persist after refresh/re-query.
- Support mutation or payment simulation can update `amountSupported`.
- Sponsorship interest can be created and listed through backend routes.
- Current State Ledger and Known Issues are updated.

---

# Phase 2: Shared Client Foundation

## Goal

Create stable frontend API patterns before screen-level feature work.

## Why This Comes Before UI Fixes

Admin and mobile should not each invent different auth and error-handling patterns.

## Owners

Admin frontend agent and mobile frontend agent may work in parallel because their file scopes are separate.

## Phase 2A: Admin API Foundation

Allowed scope:

```text
admin-web/src/**
```

Recommended work:

- Centralize API base URL.
- Centralize admin token attachment.
- Add small helper functions for admin routes.
- Do not redesign the dashboard yet.

Avoid broad visual changes.

## Phase 2B: Mobile API Foundation

Allowed scope:

```text
mobile-app/src/utils/config.ts
```

Recommended work:

- Add or expose a safe authenticated API helper.
- Ensure token retrieval is consistent.
- Ensure protected calls can attach `Authorization: Bearer <token>`.
- Keep existing storage behavior intact unless broken.

Do not edit mobile screens in this phase.

## Done Gate

Phase 2 is complete only when:

- Admin web has a clear way to make authenticated API calls.
- Mobile app has a clear way to make authenticated API calls.
- Existing login/session behavior still works.
- No screen-level feature changes are mixed into this phase.

---

# Phase 3: Admin Verification Slice

## Goal

Make admin verification decisions real and persistent.

## Owner

Admin frontend agent.

## Allowed Scope

```text
admin-web/src/App.tsx
admin-web/src/index.css
admin-web/src/App.css
```

If backend changes are required, stop and record a blocker for the backend owner. Do not modify backend files in this phase.

## Work

1. Replace local-only approve/reject behavior with API calls.
2. Add loading state per verification action.
3. Show an error if the backend rejects the action.
4. Refresh dashboard/pending list after successful action.
5. Keep UI changes minimal and behavior-focused.

## Done Gate

Phase 3 is complete only when:

```text
Admin logs in
-> pending verification list loads
-> admin approves/rejects one item
-> page refresh confirms the item stayed updated
-> pending count is correct
```

Known issue `P-004` should be marked fixed when this passes.

---

# Phase 4: Mobile Support Slice

## Goal

Make the support/contribution flow honest and persistent.

## Owner

Mobile frontend agent.

## Allowed Scope

```text
mobile-app/src/app/support/[id].tsx
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/app/dashboard.tsx
mobile-app/src/utils/config.ts
```

Only touch `config.ts` if Phase 2B did not fully solve token handling.

If backend payment behavior is broken, stop and record a blocker for the backend owner.

## Work

1. Remove fake success on failed API calls.
2. Attach auth token to support/payment calls.
3. Use the verified backend route from Phase 1.
4. For MVP, simulated payment is acceptable if it persists honestly.
5. Refresh profile/feed state after support succeeds.

Expected demo behavior:

```text
User enters amount
-> backend records contribution
-> support request amountSupported increases
-> profile/feed shows updated funding progress
```

## Done Gate

Phase 4 is complete only when:

```text
Supporter logs in
-> opens athlete profile
-> contributes Rs 1,000
-> refreshes profile
-> funding progress remains increased
```

Known issues `P-005` and `P-006` should be marked fixed when this passes.

---

# Phase 5: Sponsorship Interest Slice

## Goal

Complete the sponsor proposal loop without building a full sponsor dashboard.

## Why This Comes After Support

Sponsorship is a second conversion path. It should not be added until the core support path is stable.

## Owners

Mobile frontend agent and admin frontend agent. Work should be sequenced, not simultaneous, because admin integration may touch the same admin shell file from Phase 3.

## Phase 5A: Backend Route Recheck

Owner: backend/API agent.

Allowed scope:

```text
backend/src/**
SPORTSPHERE_EXECUTION_ROADMAP.md
```

Verify:

```text
POST /api/athletes/:id/sponsorship-interest
GET /api/admin/sponsorship-interests
PUT /api/admin/sponsorship-interests/:id
```

Do not change mobile/admin UI here.

## Phase 5B: Mobile Sponsor Form

Owner: mobile frontend agent.

Allowed scope:

```text
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/utils/config.ts
```

Add a simple sponsor action with fields:

```text
organization name
contact person
support type
proposed amount
duration
message
```

Do not build a sponsor dashboard.

## Phase 5C: Admin Sponsorship Review

Owner: admin frontend agent.

Allowed scope:

```text
admin-web/src/App.tsx
admin-web/src/index.css
admin-web/src/App.css
```

Add the smallest useful admin view for sponsorship interests:

```text
list submitted proposals
show athlete and sponsor
show amount/message/status
allow status update
refresh after update
```

## Done Gate

Phase 5 is complete only when:

```text
Sponsor logs in
-> submits sponsor interest for athlete
-> admin logs in
-> admin sees proposal
-> admin updates status
-> refresh keeps updated status
```

Known issues `P-007` and `P-008` should be marked fixed when this passes.

---

# Phase 6: Demo QA, Polish, And Runbook

## Goal

Make the project presentation-ready without expanding scope.

## Owner

QA/demo agent. Other agents only fix assigned bugs.

## Allowed Scope

```text
README.md
SPORTSPHERE_EXECUTION_ROADMAP.md
admin-web/src/**        only for polish/bugfixes
mobile-app/src/**       only for polish/bugfixes
backend/src/**          only for confirmed bugfixes
```

## Work

1. Run the full demo from a clean seed.
2. Fix obvious loading, empty, and error states.
3. Confirm all demo accounts work.
4. Confirm currency formatting is consistent.
5. Confirm verification badges are understandable.
6. Confirm the admin portal does not show stale local-only state.
7. Update README with final run commands and demo script.

## Final Demo Script

```text
1. Run clean seed.
2. Start backend.
3. Start admin web.
4. Start mobile app.
5. Log in as supporter.
6. Browse athlete feed.
7. Open athlete profile.
8. Contribute Rs 1,000.
9. Refresh and confirm funding progress increased.
10. Log in as sponsor.
11. Submit sponsorship interest.
12. Log in as admin.
13. Approve or reject pending verification.
14. Review sponsorship proposal.
15. Refresh admin page and confirm state persists.
```

## Done Gate

The project is demo-ready only when the full demo script works without manual database edits.

---

## Demo Accounts

Verify these after Phase 0 because seed source is currently unresolved.

```text
Admin:
admin@sportsphere.com
password123

Supporter:
supporter@demo.com
password123

Sponsor:
sponsor@techcorp.com
password123

Athlete:
aarav@athlete.com
password123
```

---

## Strict Non-Goals For MVP

Do not build these during stabilization:

```text
social feed posts
likes
comments
followers
chat
coach messaging
notifications
AI recommendations
advanced ranking
real document upload
cloud storage/S3/R2
production Razorpay integration
athlete self-service dashboard
full sponsor dashboard
analytics dashboard
public marketing landing page
app store packaging
```

These belong in the expansion backlog after the core demo is stable.

---

## Progress Log

Add one row for each meaningful completed change.

| Date | Agent/Owner | Phase | Change Made | Files Touched | Verification |
|:---|:---|:---|:---|:---|:---|
| 2026-10-12 | Antigravity | Phase 0 | Canonicalized backend to `index.ts` via `tsx`; deprecated `index.js` | `package.json`, `src/index.js` | Backend starts on port 5000 ✓ |
| 2026-10-12 | Antigravity | Phase 0 | Ported full rich seed data to `seed.ts`; deprecated `seed.js` | `prisma/seed.ts`, `prisma/seed.js` | 10 athletes, 15 achievements, 10 support requests seeded ✓ |
| 2026-10-12 | Antigravity | Phase 1 | Verified all auth contracts: register, login, /me, 401/403 guards | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 1 | Verified athlete discovery: GET /athletes (10), GET /athletes/:id (achievements+budgetItems+verifications), GET /support-requests/:id | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 1 | Verified funding: legacy support route persists amountSupported; Razorpay mock create-order+webhook full cycle persists | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 1 | Verified admin verification: pending list, approve/reject/request-correction all persist in DB | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 1 | Verified admin sponsorship: submit interest, GET list, PUT status update persists | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 1 | Verified admin support requests, audit log, dashboard endpoints | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 2 | Phase 2A: Created `admin-web/src/api` module with typed API clients for auth, admin, athletes. Centralized token and error handling in `App.tsx`. Phase 2B: Enhanced `mobile-app/src/utils/config.ts` with consistent token retrieval, `apiClient` Bearer interceptor, and typed `mobileApi` helper. | `admin-web/src/api/*`, `admin-web/src/App.tsx`, `mobile-app/src/utils/config.ts` | `npm run build` (admin) ✓; `npx tsc --noEmit` (mobile) ✓ |
| 2026-10-12 | Antigravity | Phase 3 | Replaced local-only verification state in `admin-web/src/App.tsx` with live `adminApi` calls. Added per-item loading spinners, button disabling during mutation, error/success banners, and real-time dashboard refetching. Verified DB persistence & counter decrement. | `admin-web/src/App.tsx` | Live approve (135) & reject (134) persisted in SQLite; pending count updated 3->2->1 ✓; `npm run build` ✓ |
| 2026-10-12 | Antigravity | Phase 4 | Rewrote `support/[id].tsx` to use `mobileApi.support.supportDirect`, removed fake success on catch block, added validation, honest error banners, and target details banner. Added `useFocusEffect` to `athlete/[id].tsx` and `dashboard.tsx` to automatically re-fetch updated funding progress. | `mobile-app/src/app/support/[id].tsx`, `mobile-app/src/app/athlete/[id].tsx`, `mobile-app/src/app/dashboard.tsx` | Live contribution of ₹1000 with supporter token increased amountSupported (5200 -> 6200) and persisted in SQLite ✓; `npx tsc --noEmit` ✓ |
| 2026-10-12 | Antigravity | Phase 5 | Built mobile sponsorship proposal form on athlete profile (`athlete/[id].tsx`) and added sponsorship proposal review/action management to admin portal (`admin-web/src/App.tsx`). Verified end-to-end proposal submission by sponsor and status update to ACCEPTED by admin. | `mobile-app/src/app/athlete/[id].tsx`, `mobile-app/src/utils/config.ts`, `admin-web/src/App.tsx` | Full sponsor submit -> admin review -> ACCEPTED flow persisted in SQLite ✓; both builds passing ✓ |
| 2026-10-12 | Antigravity | Phase 6 | Complete QA & Polish: refreshed seed demo data, confirmed currency formatting and badges, updated comprehensive README.md with full quickstart runbook, demo accounts, verified contracts, and 3-scene presentation walkthrough script. | `README.md`, `SPORTSPHERE_EXECUTION_ROADMAP.md` | All 3 tiers operational; verified end-to-end demo flow ✓ |

---

## Decision Log

Record decisions that future agents must respect.

| Date | Decision | Reason | Owner |
|:---|:---|:---|:---|
| 2026-10-12 | `index.ts` is the canonical backend source | It is 822 lines vs 631 in `.js`; has TypeScript types, audit logs, and all admin routes | Antigravity / Phase 0 |
| 2026-10-12 | `seed.ts` is the canonical seed | Rich data ported from `seed.js`; TypeScript forward-compatible | Antigravity / Phase 0 |
| 2026-10-12 | `GET /api/athletes` returns a plain array (no wrapper) | Mobile reads `res.data` directly as array — correct. Admin web must do same. | Antigravity / Phase 1 |
| 2026-10-12 | Legacy `/support-requests/:id/support` route is acceptable for MVP | Auto-success with `amountSupported` increment persists. Razorpay mock flow also works. Either is usable for demo. | Antigravity / Phase 1 |
| 2026-10-12 | Audit log endpoint returns `{ logs, total, page, limit, totalPages }` wrapper | Admin web must read `response.data.logs`, not `response.data` | Antigravity / Phase 1 |
| 2026-10-12 | Admin & mobile clients use centralized Axios instances with automatic Bearer token interceptors | Prevents inconsistent manual token headers and unauthenticated 401s across screens | Antigravity / Phase 2 |

---

## Blocker Log

Record blockers instead of hiding them in chat.

| Date | Blocker | Affected Phase | Impact | Proposed Resolution | Owner | Status |
|:---|:---|:---|:---|:---|:---|:---|
|  |  |  |  |  |  |  |

---

## Final Principle

Move in this order:

```text
stabilize -> lock contracts -> wire clients -> prove persistence -> polish -> expand
```

The best few-day version of SportSphere is a clean, believable vertical slice, not a huge unfinished platform.

