# SportSphere 2.0 Execution Roadmap — "The LinkedIn for Indian Athletes"

> **North Star**: The premier professional identity, discovery, and verified micro-funding platform for Indian athletes.
>
> **Core Vision**: Like LinkedIn connects professionals with opportunities, SportSphere connects emerging Indian sports talent with individual backers, coaches, brands, and CSR sponsors — backed by verified credentials, media-rich athlete profiles, and real-time funding.

This document is the single source of truth for all agents and team members. Read it in full before touching any file. Update it after every meaningful change.

---

## 0. How to Use This Roadmap

Before starting work, every agent must:

1. Read the **Current State Ledger**.
2. Read the **Conflict-Avoidance Rules**.
3. Claim exactly one phase or sub-phase. Do not claim multiple.
4. Stay inside the listed file scope for your phase.
5. Stop and record a blocker if work requires files outside your allowed scope.
6. Update the **Progress Log**, **Decision Log**, and this ledger after completing work.

Do not silently expand scope. Silent scope expansion is how agents create merge conflicts and hidden bugs.

---

## 1. Current State Ledger (v2.0)

| Field | Current Value |
|:---|:---|
| **Roadmap Version** | **2.0 (Expansion & Professional Network Phase)** |
| **Foundation Status** | **Completed & Stabilized** (Phases 0–6 verified end-to-end) |
| **Active Target Phase** | **Phase 7A: Schema + Media Upload Backend** |
| **Backend Runtime** | Canonical `backend/src/index.ts` via `tsx` |
| **Database** | SQLite `backend/prisma/dev.db` via Prisma ORM |
| **Client Platforms** | Mobile (Expo / React Native) & Admin Web (Vite / React) |
| **Payment Status** | Functional sandbox/ledger persistence; Live Razorpay Gateway planned for Phase 9 |
| **Expo Mode** | Standard Expo Go (SDK 50+). Phase 9B will require `expo-dev-client` — native module needed. |
| **Last Updated** | 2026-10-12 |

---

## 2. Foundation Retrospective (Phases 0–6 — All Completed)

| Phase | Goal | Status |
|:---|:---|:---|
| Phase 0 | Backend runtime canonicalized; `index.ts` + `seed.ts` as single sources of truth | ✅ Done |
| Phase 1 | All REST contracts verified across Auth, Discovery, Funding, Admin, and Sponsorship | ✅ Done |
| Phase 2 | Centralized Axios clients with automatic Bearer token interceptors on both platforms | ✅ Done |
| Phase 3 | Admin verification actions live-wired to database; approve/reject persist across reload | ✅ Done |
| Phase 4 | Mobile micro-funding flow wired honestly; auto-refreshing progress on screen focus | ✅ Done |
| Phase 5 | Corporate sponsorship proposal loop complete: mobile submission → admin review → persist | ✅ Done |
| Phase 6 | QA completed; builds passing (`npm run build`, `tsc --noEmit`); README runbook written | ✅ Done |

---

## 3. Conflict-Avoidance Rules

These rules matter more than speed.

1. **One agent, one sub-phase.** Never let two agents claim the same sub-phase. Sub-phases within the same parent phase may run in parallel only when their file scopes are completely disjoint.

2. **Backend schema changes are always serial.** `backend/prisma/schema.prisma` is a single-owner file. No two agents may touch it simultaneously. This is the highest-conflict file in the project.

3. **Migration before seeding.** Any schema change must be followed by `npx prisma migrate dev --name <description>` before re-seeding. Never re-seed against a stale schema.

4. **Backend contracts lock before frontend wiring.** A frontend agent must not guess endpoint request/response shapes. Wait for the backend sub-phase Done Gate before writing client code against it.

5. **No new feature families across active sub-phases.** If Phase 7A is in progress, do not begin Phase 7C. Sub-phases sequence serially within a phase unless scopes are explicitly verified as non-overlapping.

6. **No fake success states.** If a backend call fails, the UI must show failure. This rule is permanent.

7. **Merge serially.** Parallel development is allowed only where scopes allow it, but changes must be reviewed and merged one sub-phase at a time.

---

## 4. Migration Strategy Protocol

Every schema change from Phase 7 onward must follow this protocol exactly:

```text
1. Edit backend/prisma/schema.prisma
2. Run: npx prisma migrate dev --name <phase>-<description>
   e.g.: npx prisma migrate dev --name phase-7a-media-asset-table
3. Verify migration file created under backend/prisma/migrations/
4. Re-seed: npx tsx backend/prisma/seed.ts
5. Smoke-test 2–3 affected API endpoints before marking sub-phase done
```

**Rules for new schema fields on existing tables:**
- All new columns on existing populated tables must be **nullable** (`?`) or carry a **default value**.
- A non-null column without a default on a table with existing rows will fail the Prisma migration.
- New standalone models (`MediaAsset`, `CareerMilestone`, `Post`, etc.) are safe to add without this constraint.

---

## 5. Product Pillars for SportSphere 2.0

### Pillar 1: Professional Identity
- Media-rich profiles: avatars, banner covers, action galleries.
- Professional headline: *"National U-19 400m Gold Medalist | Target: 2028 Olympics"*.
- Career timeline: District → State → National → International.
- Verified credentials with "Federation Verified" badge.
- Coach endorsements as high-trust sponsor signals.

### Pillar 2: Transparent Real Funding
- Live Razorpay Checkout: UPI (GPay, PhonePe, Paytm), Cards, Netbanking.
- HMAC SHA256 webhook signature verification before crediting any payment.
- Animated live funding progress bars with milestone indicators.
- Public Wall of Backers with supporter names and cheer notes.

### Pillar 3: Dynamic Updates & Social Proof
- Athlete training logs and competition announcements as lightweight posts.
- One-tap Cheer reaction with real-time counter (race-condition-safe via relation table).
- Post-funding evidence receipts showing fund utilization.

---

## 6. Phase Graph (v2.0)

```text
Phase 7A: Backend Media Schema + Upload Endpoint
  └── Phase 7B: Seed Photo Data & URL Hydration
        └── Phase 7C: Mobile Feed & Profile Visual Redesign

Phase 8A: Career Milestone & Post Schema + API
  └── Phase 8B: Mobile Feed Tabs (Athletes | Updates)
        └── Phase 8C: Career Timeline on Athlete Profile

Phase 9A: Backend Real Razorpay Order + HMAC Verify
  └── Phase 9B: Mobile Razorpay Native Checkout    ← REQUIRES expo-dev-client (see Blocker Log)
        └── Phase 9C: Animated Progress Bar + Backers Wall

Phase 10A: Athlete Profile Edit API
  └── Phase 10B: Mobile Campaign Creator Wizard + Profile Studio

Phase 11A: Coach Endorsement Schema + API
  └── Phase 11B: Mobile Endorsement Display + Cheer System
```

Phases 7 → 8 → 9 → 10 → 11 are strictly sequential. Within each phase, sub-phases A → B → C are sequential.

---

## 7. Strict Non-Goals (Do Not Build During Phases 7–11)

Do not build these unless a phase explicitly names them:

```text
- Real-time websocket notifications (no Socket.io or SSE)
- Direct messaging / DM / group chat between users
- AI athlete ranking or recommendation engine
- Cloud object storage (S3 / R2 / GCS) — use local static file serving for now
- App Store / Play Store packaging or production EAS builds
- Full sponsor analytics dashboard
- Public marketing landing page
- Stripe or any gateway other than Razorpay
- Automated test suites (manual CLI smoke tests are acceptable)
- Admin RBAC / granular role-based permission system
```

---

# Phase 7A: Backend Media Schema + Upload Endpoint

## Goal
Establish the data model and backend file-serving infrastructure for athlete media. Nothing frontend happens until this Done Gate passes.

## Owner
Backend agent only.

## Allowed Scope
```text
backend/prisma/schema.prisma
backend/prisma/migrations/**
backend/src/**
backend/uploads/**          (create dir; add to .gitignore)
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Do Not Touch
```text
mobile-app/src/**
admin-web/src/**
```

## Deliverables

1. **New `MediaAsset` relation model** — do NOT use a JSON blob on `AthleteProfile`:
   ```prisma
   model MediaAsset {
     id        Int            @id @default(autoincrement())
     athleteId Int
     athlete   AthleteProfile @relation(fields: [athleteId], references: [id])
     type      String         // "AVATAR" | "BANNER" | "GALLERY"
     url       String
     order     Int            @default(0)
     createdAt DateTime       @default(now())
   }
   ```
   > **Why a relation table, not JSON on AthleteProfile**: SQLite has no native array type. A JSON blob cannot be queried, ordered, or joined efficiently. A dedicated table is clean, indexable, and allows ordered gallery slots.

2. **Add to `AthleteProfile`** (nullable — safe for existing seeded rows):
   - `headline String?`
   - `mediaAssets MediaAsset[]` (back-relation)

3. **Backend upload endpoint**:
   - `POST /api/upload` — accepts `multipart/form-data`, validates MIME type (jpeg/png/webp only, max 5 MB), saves to `backend/uploads/<uuid>.<ext>`, returns `{ url: "/uploads/<filename>" }`.
   - `GET /uploads/:filename` — static asset serving via `express.static('uploads')`.

4. **Update athlete queries**:
   - `GET /api/athletes` — include `mediaAssets` for each athlete.
   - `GET /api/athletes/:id` — include `mediaAssets`.

5. **Run migration**: `npx prisma migrate dev --name phase-7a-media-asset`

## Done Gate
- [ ] `MediaAsset` table exists in migrated DB schema.
- [ ] `POST /api/upload` accepts a test image and returns a `/uploads/...` URL.
- [ ] Returned URL resolves as a static file via `GET /uploads/<filename>`.
- [ ] `GET /api/athletes/:id` includes a `mediaAssets` array in the response.
- [ ] `backend/uploads/` is in `.gitignore`.
- [ ] Existing seed data loads without error post-migration.

---

# Phase 7B: Seed Photo Data & URL Hydration

## Goal
Populate seeded athletes with photo URLs and professional headlines so Phase 7C has real content to render.

## Owner
Backend / Seed agent. Start only after Phase 7A Done Gate passes.

## Allowed Scope
```text
backend/prisma/seed.ts
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Do Not Touch
```text
backend/prisma/schema.prisma   (locked after 7A)
mobile-app/src/**
admin-web/src/**
```

## Deliverables

For each seeded athlete, create:
- 1 `AVATAR` `MediaAsset` record — use Unsplash CDN sport URLs (publicly accessible, no auth needed for demo).
- 1 `BANNER` `MediaAsset` record — sport-specific action background image.
- 2–3 `GALLERY` `MediaAsset` records with incrementing `order` values.
- A meaningful `headline` on the `AthleteProfile`.

Example headlines:
```text
"National U-19 400m Gold Medalist | Target: 2028 Los Angeles Olympics"
"Junior National Javelin Throw Record Holder | SAI Patiala Trainee"
"State-Level Boxing Champion | 60kg Lightweight | Khelo India Alumnus"
"Commonwealth Youth Games Silver Medalist | Women's Weightlifting 59kg"
"Asian Junior Wrestling Championship Bronze | Freestyle 65kg"
```

## Done Gate
- [ ] `GET /api/athletes` returns `mediaAssets` with at least one `AVATAR` per athlete.
- [ ] All 10 seeded athletes have a non-null `headline`.
- [ ] Seed runs without errors: `npx tsx backend/prisma/seed.ts`.

---

# Phase 7C: Mobile Feed & Profile Visual Redesign

## Goal
Redesign the discovery feed cards and athlete profile header to display photos, banners, headlines, and verification badges.

## Owner
Mobile frontend agent. Start only after Phase 7B Done Gate passes.

## Allowed Scope
```text
mobile-app/src/app/**
mobile-app/src/components/**   (create directory if absent)
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Do Not Touch
```text
backend/src/**
backend/prisma/**
admin-web/src/**
```

## Deliverables

1. **Discovery Feed Card Redesign**:
   - Hero image (`AVATAR` or first `GALLERY` asset) as card background with a dark gradient overlay.
   - Sport tag chip, state tag, and verified badge (if `VERIFIED`) overlaid on the card.
   - Athlete name + `headline` in bold over the gradient.
   - Compact funding progress bar at card bottom: *"₹X raised — N%"*.

2. **Athlete Profile Header Redesign** (`athlete/[id].tsx`):
   - Full-width `BANNER` image spanning the top of the screen.
   - Circular `AVATAR` overlapping the banner bottom edge (LinkedIn-style offset).
   - `headline` displayed below the athlete name.
   - Green verified checkmark badge if any `Verification.status === "VERIFIED"`.
   - Horizontally scrollable `GALLERY` carousel section below the bio.

3. **Graceful Fallback**:
   - Empty `mediaAssets`: render initials-based circular avatar with a sport-color gradient placeholder banner.
   - Image load failure: `onError` handler replaces src with the initials fallback. Do not show broken image icons.

## Done Gate
- [ ] Discovery feed cards display hero athlete photos with gradient overlay.
- [ ] Athlete profile renders banner + overlapping circular avatar + headline.
- [ ] Gallery carousel renders when `GALLERY` assets are present.
- [ ] Initials fallback renders cleanly when media is absent or fails to load.
- [ ] `npx tsc --noEmit` passes with no new errors.

---

# Phase 8A: Career Milestone & Post Schema + API

## Goal
Lock the data models and API contracts for career milestones and athlete update posts before any mobile UI work begins.

## Owner
Backend agent. Start after Phase 7C Done Gate passes.

## Allowed Scope
```text
backend/prisma/schema.prisma
backend/prisma/migrations/**
backend/src/**
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Deliverables

1. **`CareerMilestone` model**:
   ```prisma
   model CareerMilestone {
     id             Int            @id @default(autoincrement())
     athleteId      Int
     athlete        AthleteProfile @relation(fields: [athleteId], references: [id])
     year           Int
     title          String
     result         String?        // "Gold Medal — 46.8s"
     level          String         // "DISTRICT" | "STATE" | "NATIONAL" | "INTERNATIONAL"
     certificateUrl String?
     createdAt      DateTime       @default(now())
   }
   ```

2. **`Post` and `Cheer` models** — do NOT use an integer `cheerCount` column:
   ```prisma
   model Post {
     id        Int            @id @default(autoincrement())
     athleteId Int
     athlete   AthleteProfile @relation(fields: [athleteId], references: [id])
     content   String
     mediaUrl  String?
     createdAt DateTime       @default(now())
     cheers    Cheer[]
   }

   model Cheer {
     id        Int      @id @default(autoincrement())
     postId    Int
     post      Post     @relation(fields: [postId], references: [id])
     userId    Int
     createdAt DateTime @default(now())
     @@unique([postId, userId])
   }
   ```
   > **Why a Cheer relation table, not an integer column**: A stored `cheerCount` integer is a write race condition under concurrent requests — two simultaneous increments on SQLite can collide. The relation table enforces one cheer per user per post via the unique constraint and counts safely at query time with `_count.cheers`.

3. **API contracts**:
   - `GET /api/athletes/:id/milestones` — milestones ordered by `year DESC`.
   - `GET /api/feed/posts` — recent posts across all athletes, with `_count: { cheers: true }` and `mediaUrl`.
   - `POST /api/posts/:id/cheer` — authenticated; upsert Cheer (idempotent, returns 200 on duplicate).

4. Seed 2–3 milestones and 1–2 posts per athlete.

5. **Run migration**: `npx prisma migrate dev --name phase-8a-milestones-posts-cheers`

## Done Gate
- [ ] `CareerMilestone`, `Post`, `Cheer` tables exist in migrated schema.
- [ ] `GET /api/athletes/:id/milestones` returns seeded data.
- [ ] `GET /api/feed/posts` returns posts with correct `cheerCount`.
- [ ] `POST /api/posts/:id/cheer` called twice by the same user returns 200 both times (no 500, no duplicate row).

---

# Phase 8B: Mobile Feed Tabs (Athletes | Updates)

## Owner
Mobile frontend agent. Start only after Phase 8A Done Gate passes.

## Allowed Scope
```text
mobile-app/src/app/**
mobile-app/src/components/**
```

## Deliverables

1. Two-tab layout on the home/feed screen:
   - **"Athletes"** tab — existing discovery feed from Phase 7C.
   - **"Updates"** tab — chronological post cards from `GET /api/feed/posts`.

2. **Post card component**: athlete circular avatar + name, post content, optional media image, cheer count, one-tap Cheer button.

3. Cheer button behavior:
   - Calls `POST /api/posts/:id/cheer` with Bearer token.
   - Optimistically increments counter in local state.
   - Reverts on API error (no fake persistence).

## Done Gate
- [ ] Both tabs render without crash.
- [ ] Cheer button optimistically increments; tapping again does not double-count.
- [ ] `npx tsc --noEmit` passes.

---

# Phase 8C: Career Timeline on Athlete Profile

## Owner
Mobile frontend agent. Start after Phase 8B Done Gate.

## Allowed Scope
```text
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/components/**
```

## Deliverables
- Vertical scrollable timeline section rendered below the bio.
- Each entry: year chip on the left, level badge (color-coded: District=grey, State=blue, National=orange, International=gold), title, result string.
- If `certificateUrl` is present, a "View Certificate →" button opens it via `expo-web-browser`.

## Done Gate
- [ ] Timeline renders at least 2 seeded milestones per athlete in correct year-descending order.
- [ ] Level badges are visually differentiated by color.
- [ ] "View Certificate" button works if URL is set.

---

# Phase 9A: Backend Real Razorpay Order + HMAC Verify

> **⚠️ Blocker: resolve the expo-dev-client decision (Blocker Log item B-001) before starting this phase.**
> Phase 9A can proceed on the backend, but Phase 9B cannot start until the mobile build strategy is confirmed.

## Owner
Backend agent.

## Allowed Scope
```text
backend/src/**
backend/.env                    (add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET — test keys only)
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Deliverables

1. `npm install razorpay` in `backend/`.

2. Real Razorpay SDK routes (test mode):
   - `POST /api/payments/razorpay/order` — creates real Razorpay order, returns `{ orderId, amount, currency, keyId }`.
   - `POST /api/payments/razorpay/verify` — validates HMAC SHA256 (`razorpay_order_id + "|" + razorpay_payment_id` signed with `RAZORPAY_KEY_SECRET`). Credits `amountSupported` only after valid signature. Rejects tampered payloads with 400.

3. The existing `Transaction` model is correctly shaped — no schema migration required.

4. Record the chosen test key ID in the Decision Log.

## Done Gate
- [ ] Razorpay test dashboard shows the created order after calling the order endpoint.
- [ ] Verify endpoint returns 400 for a forged/modified payload.
- [ ] Valid test-mode payload increments `amountSupported` and persists.

---

# Phase 9B: Mobile Razorpay Native Checkout

> **⚠️ Cannot run in standard Expo Go.** `react-native-razorpay` is a native module. A development build via `expo-dev-client` or `expo run:android` / `expo run:ios` is required. Do not attempt this phase without resolving Blocker B-001.

## Owner
Mobile frontend agent. Start only after Phase 9A Done Gate and B-001 are resolved.

## Allowed Scope
```text
mobile-app/src/**
mobile-app/package.json
mobile-app/app.json
```

## Deliverables

1. `npm install react-native-razorpay` in `mobile-app/`.

2. Replace `mobileApi.support.supportDirect` call flow in `support/[id].tsx` with:
   - Step 1: `POST /api/payments/razorpay/order` → receive `orderId`.
   - Step 2: `RazorpayCheckout.open(options)` — triggers native Razorpay payment sheet.
   - Step 3: On `payment.success`, POST to `/api/payments/razorpay/verify`.
   - Step 4: On `payment.error` or user cancel, show honest error banner.

3. Use test UPI ID `success@razorpay` for test-mode simulation.

## Done Gate
- [ ] Razorpay checkout sheet opens on device or simulator.
- [ ] Successful test payment calls verify endpoint and increases `amountSupported`.
- [ ] Cancelled/failed payment shows error banner with no fake success.
- [ ] `npx tsc --noEmit` passes.

---

# Phase 9C: Animated Progress Bar + Backers Wall

## Owner
Mobile frontend agent. Start after Phase 9B Done Gate.

## Allowed Scope
```text
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/components/**
mobile-app/babel.config.js      (only if react-native-reanimated setup requires it)
```

## Deliverables

1. **Animated Progress Bar**:
   - **First**: check `mobile-app/package.json` — if `react-native-reanimated` is already installed, use it. If not, install it and configure Babel plugin per Expo Reanimated docs.
   - Animate bar width using `withTiming` from previous to current percentage on mount and on `amountSupported` changes.
   - Display: `₹X raised of ₹Y · Z% · N days left`.
   - Milestone markers at 25%, 50%, 75% if campaign has milestone targets.

2. **Backers Wall**:
   - Section below campaign description showing last 5 backers.
   - Each row: initials avatar, supporter name (or "Anonymous"), amount contributed, optional cheer note.
   - Verify `GET /api/athletes/:id` already returns recent `supports` with `supporter.user.name`. If not, record a backend blocker — do not patch the backend from this scope.

## Done Gate
- [ ] Progress bar animates smoothly when navigating to the profile after a contribution.
- [ ] Backers Wall renders with at least 2 entries from seeded supporter data.
- [ ] `npx tsc --noEmit` passes.

---

# Phase 10A: Athlete Profile Edit API

## Owner
Backend agent. Start after Phase 9C Done Gate passes.

## Allowed Scope
```text
backend/src/**
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Deliverables

1. `PUT /api/athletes/me/profile` — athlete-role JWT only. Updatable fields: `headline`, `bio`, `city`, `state`, `coachName`, `academyName`, `currentGoal`. Returns 403 if token is not the athlete's own profile.

2. `PUT /api/athletes/me/avatar` — `multipart/form-data` image upload. Reuses Phase 7A upload service. Creates or replaces the `AVATAR` `MediaAsset` for this athlete.

3. `POST /api/athletes/me/campaigns` — creates a `SupportRequest` in `DRAFT` status with nested `budgetItems`. Writes an `AuditLog` entry so admin can see the submission.

## Done Gate
- [ ] Athlete JWT updates own profile; another athlete's JWT receives 403.
- [ ] Avatar upload creates or replaces the `AVATAR` `MediaAsset`.
- [ ] New campaign appears under `GET /api/admin/verifications/pending`.

---

# Phase 10B: Mobile Campaign Creator Wizard + Profile Studio

## Owner
Mobile frontend agent. Start after Phase 10A Done Gate.

## Allowed Scope
```text
mobile-app/src/app/**
mobile-app/src/components/**
```

## Deliverables

1. **Profile Edit Screen** (shown only when logged-in user is the athlete):
   - Editable: headline, bio, city, state, coach name, academy.
   - Avatar upload via `expo-image-picker` + `PUT /api/athletes/me/avatar`.

2. **Campaign Creator — 4-step wizard**:
   - Step 1: Title, category (Travel / Gear / Nutrition / Coaching), target event, deadline picker.
   - Step 2: Itemized budget table — add/remove rows with description and amount.
   - Step 3: Optional evidence image attachment per budget line item.
   - Step 4: Review summary → "Submit for Verification" calls `POST /api/athletes/me/campaigns`.

3. **Athlete Private Dashboard tab** (visible only to logged-in athlete):
   - Active campaigns with funding status.
   - Pending verifications.
   - Incoming corporate sponsor proposals.

## Done Gate
- [ ] Athlete completes wizard and campaign appears in admin portal.
- [ ] Profile edits persist and are visible to other users on the profile screen.
- [ ] `npx tsc --noEmit` passes.

---

# Phase 11A: Coach Endorsement Schema + API

## Owner
Backend agent. Start after Phase 10B Done Gate.

## Allowed Scope
```text
backend/prisma/schema.prisma
backend/prisma/migrations/**
backend/src/**
SPORTSPHERE_EXECUTION_ROADMAP.md
```

## Deliverables

1. **`CoachEndorsement` model**:
   ```prisma
   model CoachEndorsement {
     id         Int            @id @default(autoincrement())
     athleteId  Int
     athlete    AthleteProfile @relation(fields: [athleteId], references: [id])
     coachName  String
     coachTitle String?        // "Head Coach, SAI Patiala"
     body       String
     isVerified Boolean        @default(false)
     createdAt  DateTime       @default(now())
   }
   ```

2. API:
   - `GET /api/athletes/:id/endorsements` — all endorsements for an athlete.
   - `POST /api/admin/endorsements/:id/verify` — admin sets `isVerified: true`.

3. Seed 1–2 endorsements per athlete with realistic coach details.

4. **Run migration**: `npx prisma migrate dev --name phase-11a-coach-endorsements`

## Done Gate
- [ ] Endorsements returned by `GET /api/athletes/:id/endorsements` with seeded data.
- [ ] Admin verify endpoint toggles `isVerified` and persists.

---

# Phase 11B: Mobile Endorsements Display + Cheer System

## Owner
Mobile frontend agent. Start after Phase 11A Done Gate.

## Allowed Scope
```text
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/components/**
```

## Deliverables

1. **Endorsement Cards section** on athlete profile:
   - Coach name, title, endorsement text.
   - "✓ Coach Verified" green badge if `isVerified: true`.
   - Unverified endorsements show with a "Pending Verification" muted badge.

2. **Cheer button polish** on the Updates feed (Phase 8B) — confirm optimistic update and revert on error is working correctly.

## Done Gate
- [ ] Endorsement section renders on athlete profile with at least 1 seeded entry.
- [ ] Verified coaches display green badge; unverified show muted pending state.

---

## 8. Known Issues & Backlog Tracker (v2.0)

| ID | Feature / Issue | Phase | Priority | Status |
|:---|:---|:---|:---|:---|
| **E-001** | No `MediaAsset` model — no photo infrastructure exists | Phase 7A | Critical | **Next Up** |
| **E-002** | Seed data has no photos, banners, or headlines | Phase 7B | High | Queued after 7A |
| **E-003** | Mobile feed shows no athlete photos | Phase 7C | High | Queued after 7B |
| **E-004** | No `CareerMilestone`, `Post`, or `Cheer` models exist | Phase 8A | High | Queued |
| **E-005** | No Updates feed tab on mobile | Phase 8B | Medium | Queued |
| **E-006** | No career timeline on athlete profile | Phase 8C | Medium | Queued |
| **E-007** | Razorpay is mock/simulated — not real | Phase 9A | High | Queued — see Blocker B-001 |
| **E-008** | No animated progress bar | Phase 9C | Medium | Queued |
| **E-009** | No backers wall on athlete profile | Phase 9C | Medium | Queued |
| **E-010** | Athletes cannot edit their own profiles | Phase 10A | High | Queued |
| **E-011** | Athletes cannot self-submit funding campaigns | Phase 10A | High | Queued |
| **E-012** | No coach endorsement data model or UI | Phase 11A | Medium | Queued |

---

## 9. Progress Log

| Date | Agent/Owner | Phase | Change Made | Files Touched | Verification |
|:---|:---|:---|:---|:---|:---|
| 2026-10-12 | Antigravity | Phase 0 | Canonicalized backend to `index.ts`; deprecated `index.js` | `package.json`, `src/index.js` | Backend starts on port 5000 ✓ |
| 2026-10-12 | Antigravity | Phase 0 | Ported rich seed to `seed.ts`; deprecated `seed.js` | `prisma/seed.ts`, `prisma/seed.js` | 10 athletes, 15 achievements seeded ✓ |
| 2026-10-12 | Antigravity | Phase 1 | All auth, discovery, funding, admin, and sponsorship contracts verified | — | All passed ✓ |
| 2026-10-12 | Antigravity | Phase 2 | Typed Axios clients with Bearer token interceptors on admin web and mobile | `admin-web/src/api/*`, `mobile-app/src/utils/config.ts` | Builds passing ✓ |
| 2026-10-12 | Antigravity | Phase 3 | Admin verification wired to live API; spinners, banners, DB persistence | `admin-web/src/App.tsx` | Live approve/reject persist ✓ |
| 2026-10-12 | Antigravity | Phase 4 | Mobile support flow wired honestly; auto-refresh on screen focus | `support/[id].tsx`, `athlete/[id].tsx`, `dashboard.tsx` | ₹1000 contribution persists ✓ |
| 2026-10-12 | Antigravity | Phase 5 | Sponsor proposal form on mobile; review + action UI in admin portal | `athlete/[id].tsx`, `App.tsx` | Full proposal loop persists ✓ |
| 2026-10-12 | Antigravity | Phase 6 | QA pass; comprehensive README runbook written | `README.md` | End-to-end demo confirmed ✓ |

---

## 10. Decision Log

| Date | Decision | Reason | Owner |
|:---|:---|:---|:---|
| 2026-10-12 | `index.ts` is the canonical backend source | 822 lines vs 631 in `.js`; has TypeScript types, audit logs, all admin routes | Antigravity / Phase 0 |
| 2026-10-12 | `seed.ts` is the canonical seed | Rich data ported; TypeScript forward-compatible | Antigravity / Phase 0 |
| 2026-10-12 | `GET /api/athletes` returns a plain array (no wrapper) | Mobile reads `res.data` directly as array | Antigravity / Phase 1 |
| 2026-10-12 | Legacy `/support-requests/:id/support` acceptable until Phase 9 | Razorpay mock also works for demo; either is usable for MVP | Antigravity / Phase 1 |
| 2026-10-12 | Audit log returns `{ logs, total, page, limit, totalPages }` | Admin must read `response.data.logs`, not `response.data` | Antigravity / Phase 1 |
| 2026-10-12 | Centralized Axios instances with auto Bearer token on both clients | Prevents inconsistent manual headers and surprise 401s | Antigravity / Phase 2 |
| 2026-10-12 | `MediaAsset` as a relation table, NOT a JSON blob | SQLite has no native array type; relation is queryable and orderable | Antigravity / Roadmap v2.0 |
| 2026-10-12 | `Cheer` as a relation table with `@@unique([postId, userId])`, NOT integer counter | Integer increment is a write race condition; relation enforces 1 cheer/user/post | Antigravity / Roadmap v2.0 |
| — | Expo Go vs `expo-dev-client` for Phase 9B | **PENDING** — `react-native-razorpay` is a native module; cannot run in Expo Go | Team / Before Phase 9B |

---

## 11. Blocker Log

| ID | Date | Blocker | Affected Phase | Impact | Proposed Resolution | Owner | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **B-001** | — | `react-native-razorpay` is a native module and cannot run in standard Expo Go | Phase 9B | Blocks real Razorpay checkout on mobile entirely | Switch to `expo-dev-client`; run `npx expo run:android` or produce an EAS dev build | Team | **Pending Decision** |

---

## 12. Summary Persona Matrix

| Persona | Account | Role in SportSphere 2.0 |
|:---|:---|:---|
| **Admin** | `admin@sportsphere.com` / `password123` | Approves athlete credentials, campaigns, reviews B2B proposals, verifies coaches |
| **Athlete** | `aarav@athlete.com` / `password123` | Media-rich verified profile; self-publishes campaigns and training updates (Phase 10) |
| **Supporter** | `supporter@demo.com` / `password123` | Micro-funds via real Razorpay (Phase 9); appears on backers wall with cheer note |
| **Sponsor** | `sponsor@techcorp.com` / `password123` | Browses verified talent; submits B2B equipment/travel/financial sponsorship proposals |

---

## Final Principle

Move in this order:

```text
Look credible → Be real → Enable action → Scale trust
```

SportSphere's value proposition is **trust**. Every phase must make the product feel more legitimate and athlete-worthy before adding new features.
