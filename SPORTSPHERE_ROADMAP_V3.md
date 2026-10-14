# SportSphere V3 — Implementation Roadmap
### Scope: Real Payments · Real Auth · Athlete Verification

> **Previous roadmap preserved at:** `SPORTSPHERE_EXECUTION_ROADMAP_LEGACY.md`
> **North Star:** Make every user interaction real — real money, real identity, real verification.

---

## 0. New Scope Declaration

The previous roadmap (Phases 0-11) covered visual redesign, media uploads, and feed infrastructure.
**That work is complete through Phase 7C and is the stable foundation we build on.**

This roadmap locks scope to three pillars only:

| Pillar | What It Means |
|:---|:---|
| **Pillar A0 - Real Registration & Onboarding (TOP PRIORITY)** | Real person registration flow for Athletes (sport, discipline, location, profile) & Contributors (Supporters/Sponsors) + immediate role-aware login |
| **Pillar A - Real Auth** | Production-grade email/password (bcrypt + JWT refresh tokens) + Firebase OTP phone login |
| **Pillar B - Real Payments** | Live Razorpay integration: create order on backend -> native checkout on mobile -> HMAC webhook verification -> DB persist |
| **Pillar C - Athlete Verification** | Athlete uploads Aadhaar + sports certificate -> admin reviews in portal -> status progresses -> badge shows on profile |

No other feature families are in scope until all three pillars are shipped end-to-end.

---

## 1. Architecture Decisions (Locked)

| Decision | Choice | Reason |
|:---|:---|:---|
| Razorpay SDK (mobile) | `react-native-razorpay` via `expo-dev-client` | Native module; cannot run in Expo Go; SDK 57 / RN 0.86 supports this |
| Razorpay web fallback | Razorpay payment link (server-generated) | No web SDK needed; just a shareable URL per campaign |
| OTP provider | Firebase Authentication (Phone Auth) | Free tier 10k OTPs/month; Google-managed; works with Expo |
| JWT strategy | Access token (15min) + Refresh token (7d, stored in DB) | Current system has no refresh token - this is a security fix |
| Athlete verification docs | Uploaded to `backend/uploads/` (local static serving) | Consistent with existing media infra; no S3 needed yet |
| Verification status tiers | `UNVERIFIED -> PENDING -> VERIFIED` (already in DB schema) | Admin-driven, simple, auditable |

---

## 2. Pre-Work Checklist (Do This FIRST — Before Any Code)

```
RAZORPAY SETUP:
[ ] Go to: https://dashboard.razorpay.com/signup
[ ] Sign up with your email (starts in TEST MODE automatically)
[ ] Go to: Settings -> API Keys -> Generate Test Mode API Key
[ ] Copy Key ID (rzp_test_XXXX) and Key Secret
[ ] Save both - you will add them to backend/.env

FIREBASE SETUP:
[ ] Go to: https://console.firebase.google.com -> New Project -> "SportSphere"
[ ] Enable Phone Authentication: Authentication -> Sign-in method -> Phone -> Enable
[ ] Add Android app to project -> download google-services.json -> save it
[ ] Project Settings -> Service Accounts -> Generate New Private Key -> save JSON

ENV FILE:
[ ] Create backend/.env with:
    RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
    RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX
    FIREBASE_PROJECT_ID=your_firebase_project_id
    JWT_SECRET=<64-char random hex>
    JWT_REFRESH_SECRET=<another 64-char random hex>
    RAZORPAY_WEBHOOK_SECRET=<random string you set in Razorpay dashboard>
[ ] Create backend/.env.example with placeholder values (commit this, not .env)
[ ] Add .env and google-services.json to .gitignore

DEVICE SETUP (for native Expo build):
[ ] Enable USB Debugging on Android: Settings -> Developer Options -> USB Debugging ON
[ ] Connect device via USB
[ ] Run: adb devices  (should list your device)
```

> **GATE: Do not write a single line of code until this checklist is complete.**

---

## 3. Phase Graph

```
Phase A0: Real Athlete & Contributor Registration & Login Flow (TOP PRIORITY)
  |
  +-- Phase A1: Production Auth Backend (JWT Refresh Tokens + Firebase Phone Verify)
  |     |
  |     +-- Phase A2: Mobile Auth Screens (Phone OTP + Email Login Unified Flow)
  |
  +-- Phase C1: Athlete Verification Document Upload API (needs real auth)
        |
        +-- Phase C2: Admin Verification Review Portal
        |
        +-- Phase C3: Mobile Verification Status + Submission Flow

Phase B1: Razorpay Backend Order API + HMAC Verify (parallel with A1)
  |
  +-- Phase B2: expo-dev-client Native Build Setup (parallel with A1)
        |
        +-- Phase B3: Mobile Razorpay Native Checkout (needs B1 + B2)
              |
              +-- Phase B4: Webhook Verification + Payment Persistence Polish
```

**Parallelism allowed:**
- A0 runs immediately across backend and mobile registration components.
- A1 and B1 can run after A0 foundation is in place.

---

## 4. Conflict-Avoidance Rules (V3)

1. `backend/.env` is NEVER committed. `.env.example` with placeholders is committed.
2. `backend/prisma/schema.prisma` is single-owner. No two agents touch it simultaneously.
3. Firebase token verification happens ONLY on the backend — never trust the client claim.
4. Razorpay Key Secret is ONLY on the backend. Mobile app only ever sees the Key ID.
5. HMAC webhook signature MUST be verified before crediting any payment. No exceptions.
6. No fake success states on payment or OTP — if it fails, show the error.
7. Access tokens expire in 15 minutes. Every API call must handle 401 -> refresh -> retry.

---

# PHASE A0: Real Athlete & Contributor Registration & Login Flow (TOP PRIORITY)

## Goal
Enable real individuals to register directly on SportSphere either as:
1. **Athlete**: Complete profile creation (Full Name, Email, Password, Phone, Sport selection, Discipline, City, State, Headline, Bio, Career Goal) linking their `User` account with a real `AthleteProfile`.
2. **Contributor (Supporter/Sponsor)**: Streamlined registration for donors, backers, and corporate sponsors.
3. **Immediate Seamless Login**: Upon registration or login, return complete user metadata (including `athleteProfile` and `sponsorProfile`), auto-authenticate, and navigate athletes to their dedicated dashboard/profile and contributors to the discovery feed.

## Scope
```
backend/src/index.ts          (Enhanced /api/auth/register, /api/auth/login, /api/sports)
mobile-app/src/app/index.tsx  (Role-aware multi-step registration UI + login)
mobile-app/src/utils/config.ts
SPORTSPHERE_ROADMAP_V3.md
```

## Deliverables
- [ ] `GET /api/sports`: Returns active sports list for registration dropdowns.
- [ ] `POST /api/auth/register`:
  - Handles `role: 'ATHLETE'` with transactional creation of `User` + `AthleteProfile` + default unverified `Verification` records.
  - Handles `role: 'SUPPORTER'` and `role: 'SPONSOR'` with transactional creation of `User` + `SponsorProfile`.
  - Returns auth `token` and hydrated `user` object directly on registration for instant login.
- [ ] `POST /api/auth/login`: Hydrates `athleteProfile` (with linked sport) and `sponsorProfile` into user session payload.
- [ ] Mobile App (`index.tsx`):
  - Role switcher tab during registration: **I AM AN ATHLETE** vs **I AM A CONTRIBUTOR / SUPPORTER**.
  - Dynamic sport selection dropdown.
  - Fields for discipline, state, city, headline, and bio for athletes.
  - Clean error handling, validation, loading states, and direct login redirect.

---

# PHASE A1: Production Auth Backend

## Goal
Upgrade the current single-token JWT system to a production-grade auth stack with refresh tokens
and Firebase Phone OTP verification on the backend.

## Owner
Backend agent only.

## Allowed Scope
```
backend/src/index.ts
backend/prisma/schema.prisma
backend/prisma/migrations/**
backend/.env                  (create — never commit)
backend/.env.example          (create — commit this)
SPORTSPHERE_ROADMAP_V3.md
```

## Do Not Touch
```
mobile-app/src/**
admin-web/src/**
```

## Dependencies to Install
```bash
cd backend
npm install firebase-admin razorpay dotenv
npm install --save-dev @types/node
```

## Deliverables

### A1-1: Schema Changes
Add to Prisma schema:
```prisma
model RefreshToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

Add to User model (all nullable — safe for existing rows):
```prisma
  phone         String?  @unique
  phoneVerified Boolean  @default(false)
  refreshTokens RefreshToken[]
```

### A1-2: New/Updated Auth Endpoints

| Method | Path | Description |
|:---|:---|:---|
| `POST` | `/api/auth/login` | UPGRADE: returns `{ accessToken (15min), refreshToken (7d), user }` |
| `POST` | `/api/auth/register` | UPGRADE: same refresh token pattern on successful register |
| `POST` | `/api/auth/refresh` | Accepts `{ refreshToken }` -> validates in DB -> returns new token pair (rotation) |
| `POST` | `/api/auth/logout` | Accepts `{ refreshToken }` -> deletes from DB |
| `POST` | `/api/auth/phone/verify` | Accepts Firebase `{ idToken }` -> verifies with Firebase Admin SDK -> returns JWT pair |

### A1-3: Token Logic
```typescript
// Access token — short lived
const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET!, { expiresIn: '15m' });

// Refresh token — long lived, stored in DB
const refreshToken = crypto.randomBytes(64).toString('hex');
await prisma.refreshToken.create({
  data: {
    token: refreshToken,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  },
});

// On POST /api/auth/refresh:
// 1. Find token in DB — if not found: 401
// 2. Check expiresAt > now — if expired: delete + 401
// 3. Delete the old token (rotation — one-time use)
// 4. Issue new accessToken + refreshToken pair
// 5. Return both
```

### A1-4: Firebase Phone Verify Logic
```typescript
import admin from 'firebase-admin';
// Initialize once at startup with service account from .env

// POST /api/auth/phone/verify
const decoded = await admin.auth().verifyIdToken(req.body.idToken);
const phone = decoded.phone_number; // e.g. "+919876543210"

// Find or create user with this phone
let user = await prisma.user.findUnique({ where: { phone } });
if (!user) {
  user = await prisma.user.create({
    data: { phone, phoneVerified: true, name: 'Athlete', role: 'SUPPORTER' }
  });
}
// Issue JWT pair same as login
```

## Migration
```bash
npx prisma migrate dev --name phase-a1-refresh-tokens-phone-auth
```

## Done Gate
- [ ] `RefreshToken` table exists in migrated DB
- [ ] `POST /api/auth/login` returns `{ accessToken, refreshToken, user }`
- [ ] `POST /api/auth/refresh` with valid token returns new pair
- [ ] `POST /api/auth/refresh` with invalid/expired token returns 401
- [ ] `POST /api/auth/phone/verify` with valid Firebase idToken returns JWT pair
- [ ] `POST /api/auth/logout` deletes the refresh token row
- [ ] All existing endpoints still work with the new 15-min access token

---

# PHASE A2: Mobile Auth Screens (Unified Login Flow)

## Goal
Rebuild the mobile login/register screen to support email+password login, phone OTP login via Firebase,
and registration with optional phone. Tokens stored securely with refresh-on-expiry logic.

## Owner
Mobile frontend agent. Start after Phase A1 Done Gate.

## Allowed Scope
```
mobile-app/src/app/index.tsx
mobile-app/src/utils/config.ts
mobile-app/src/utils/auth.ts       (create this)
mobile-app/src/app/_layout.tsx
SPORTSPHERE_ROADMAP_V3.md
```

## Do Not Touch
```
backend/src/**
admin-web/src/**
```

## Dependencies
```bash
cd mobile-app
npx expo install expo-secure-store
# Firebase native modules (install now, test after B2 native build):
npm install @react-native-firebase/app @react-native-firebase/auth
```

## Deliverables

### A2-1: Secure Token Storage
Replace AsyncStorage token calls with expo-secure-store:
```typescript
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('accessToken', accessToken);
await SecureStore.setItemAsync('refreshToken', refreshToken);
```

### A2-2: Auth Flow Tabs

**Tab 1 — Email Login / Register**
- Email + Password fields with validation
- Toggle between Login and Register
- Register: Name, Email, Password (+ optional phone)
- On success: store both tokens -> navigate to dashboard

**Tab 2 — Phone OTP Login**
- Phone number input (+91 prefix auto-applied)
- "Send OTP" -> triggers Firebase signInWithPhoneNumber
- 6-digit OTP input with auto-advance
- On confirm -> get Firebase idToken -> POST /api/auth/phone/verify -> store tokens

### A2-3: Token Refresh Interceptor (utils/auth.ts)
```typescript
// Axios response interceptor
mobileApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) { /* redirect to login */ return; }
      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync('accessToken', res.data.accessToken);
        await SecureStore.setItemAsync('refreshToken', res.data.refreshToken);
        error.config.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
        return mobileApi(error.config);
      } catch {
        /* clear tokens, redirect to login */
      }
    }
    return Promise.reject(error);
  }
);
```

### A2-4: Logout
POST /api/auth/logout with refreshToken -> clear SecureStore -> router.replace('/')

## Done Gate
- [ ] Email login returns tokens and navigates to dashboard
- [ ] Phone OTP flow completes and navigates to dashboard
- [ ] 401 on any API call silently refreshes token and retries the original request
- [ ] Logout clears tokens and redirects to login
- [ ] `npx tsc --noEmit` passes with no new errors

---

# PHASE B1: Razorpay Backend Order API

## Goal
Integrate Razorpay on the backend: create orders, expose Key ID safely to client, verify HMAC signatures.

## Owner
Backend agent. Can run in parallel with Phase A1.

## Allowed Scope
```
backend/src/index.ts
backend/prisma/schema.prisma
backend/prisma/migrations/**
backend/.env
SPORTSPHERE_ROADMAP_V3.md
```

## Deliverables

### B1-1: Payment Model
```prisma
model Payment {
  id                  Int      @id @default(autoincrement())
  razorpayOrderId     String   @unique
  razorpayPaymentId   String?
  razorpaySignature   String?
  amount              Int      // in paise (INR 1 = 100 paise)
  currency            String   @default("INR")
  status              String   @default("CREATED") // CREATED | PAID | FAILED
  athleteId           Int
  userId              Int
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### B1-2: Endpoints

| Method | Path | Auth | Description |
|:---|:---|:---|:---|
| `GET` | `/api/payments/config` | Public | Returns `{ keyId }` only — NEVER the secret |
| `POST` | `/api/payments/create-order` | Bearer | Creates Razorpay order -> persists Payment row -> returns `{ orderId, amount, currency, keyId }` |
| `POST` | `/api/payments/verify` | Bearer | HMAC verify -> mark PAID -> update campaign total in $transaction |
| `POST` | `/api/payments/generate-link` | Bearer | Razorpay Payment Link API -> returns shareable URL |
| `POST` | `/api/payments/webhook` | None (HMAC header) | Razorpay webhook — raw body HMAC verify -> update status idempotently |

### B1-3: HMAC Signature Verification (Critical — Never Skip)
```typescript
import crypto from 'crypto';

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');
  return expected === signature;
}
```

### B1-4: Create Order + Verify Flow
```typescript
// POST /api/payments/create-order
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});
const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: `receipt_${Date.now()}` });
await prisma.payment.create({ data: { razorpayOrderId: order.id, amount, userId, athleteId } });
res.json({ orderId: order.id, amount, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID });

// POST /api/payments/verify
const valid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
if (!valid) return res.status(400).json({ error: 'Invalid payment signature' });
await prisma.$transaction([
  prisma.payment.update({ where: { razorpayOrderId }, data: { status: 'PAID', razorpayPaymentId, razorpaySignature } }),
  prisma.supportRequest.update({ where: { id: supportRequestId }, data: { currentAmount: { increment: amountInRupees } } }),
]);
```

## Migration
```bash
npx prisma migrate dev --name phase-b1-payment-model
```

## Done Gate
- [ ] `POST /api/payments/create-order` creates a Razorpay order and returns orderId
- [ ] `POST /api/payments/verify` with valid HMAC returns 200 + updates campaign total
- [ ] `POST /api/payments/verify` with invalid HMAC returns 400 — no DB update
- [ ] `GET /api/payments/config` returns keyId only, never the secret
- [ ] Payment table exists in migrated DB

---

# PHASE B2: expo-dev-client Native Build Setup

## Goal
Build a custom Expo dev client that can run native modules (react-native-razorpay, Firebase Auth).
This is a one-time setup that replaces Expo Go.

## Owner
Do this manually — it is build infrastructure, not feature code.

## Step-by-Step Commands
```bash
# In mobile-app/
npx expo install expo-dev-client
npm install react-native-razorpay
npm install @react-native-firebase/app @react-native-firebase/auth

# Place google-services.json in mobile-app/
# Then update mobile-app/app.json under "android":
#   "googleServicesFile": "./google-services.json"

# Connect Android device via USB with USB Debugging ON
# Verify connection:
adb devices

# Build and install the custom dev client on device (~5-10 min first time):
npx expo run:android

# After first build, start dev server with:
npx expo start --dev-client
```

## app.json Changes Required
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "package": "com.sportsphere.app"
    }
  }
}
```

## .gitignore Additions
```
google-services.json
android/
ios/
```

## Done Gate
- [ ] `npx expo run:android` completes without error
- [ ] Dev client app opens on Android device
- [ ] JS changes hot-reload on device
- [ ] google-services.json is in .gitignore

> After this phase, ALWAYS use `npx expo start --dev-client` instead of `npx expo start`

---

# PHASE B3: Mobile Razorpay Native Checkout

## Goal
Wire the Razorpay native checkout into the athlete support/funding flow.
Payment success and failure are both honestly handled — no fake success states.

## Owner
Mobile frontend agent. Start ONLY after Phase B1 AND Phase B2 Done Gates pass.

## Allowed Scope
```
mobile-app/src/app/support/**
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/utils/payment.ts    (create this)
SPORTSPHERE_ROADMAP_V3.md
```

## Deliverables

### B3-1: utils/payment.ts
```typescript
import RazorpayCheckout from 'react-native-razorpay';
import { mobileApi } from './config';

export async function initiatePayment(params: {
  athleteId: number;
  athleteName: string;
  amount: number; // in rupees
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {

  // Step 1: Get Key ID from backend (safe — never hardcode)
  const { data: config } = await mobileApi.get('/payments/config');

  // Step 2: Create order on backend
  const { data: order } = await mobileApi.post('/payments/create-order', {
    athleteId: params.athleteId,
    amount: params.amount * 100, // paise
  });

  // Step 3: Open Razorpay native sheet
  const options = {
    description: `Support ${params.athleteName}`,
    currency: order.currency,
    key: config.keyId,
    amount: String(order.amount),
    order_id: order.orderId,
    name: 'SportSphere',
    theme: { color: '#E2550B' },
  };

  try {
    const data = await RazorpayCheckout.open(options);

    // Step 4: Verify signature on backend — mandatory
    await mobileApi.post('/payments/verify', {
      razorpayOrderId: order.orderId,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpaySignature: data.razorpaySignature,
    });

    return { success: true, paymentId: data.razorpayPaymentId };
  } catch (err: any) {
    // User cancelled or payment failed — show real error, never fake success
    return { success: false, error: err?.description || 'Payment was not completed.' };
  }
}
```

### B3-2: Support Screen Integration
- Replace the mock SupportRequest create call with `initiatePayment()`
- Show loading spinner while Razorpay sheet is open
- On success: show confirmation with amount paid -> navigate back (profile auto-refreshes on focus)
- On failure/cancel: show inline error — never silently swallow

### B3-3: Web Payment Link Fallback
- On athlete profile: "Pay via Link" button
- Calls `POST /api/payments/generate-link` -> receives URL
- Opens in browser via `expo-web-browser`

## Done Gate
- [ ] Razorpay checkout sheet opens on support screen
- [ ] Test payment completes -> campaign total updates on athlete profile
- [ ] Payment cancelled -> error shown, no PAID row in DB
- [ ] Invalid HMAC -> backend 400 -> mobile shows error
- [ ] "Pay via Link" opens browser with Razorpay payment link

---

# PHASE B4: Webhook Verification + Payment Persistence Polish

## Goal
Handle payment status updates even if the app crashes or loses network mid-flow.

## Owner
Backend agent. Start after Phase B3 Done Gate.

## Allowed Scope
```
backend/src/index.ts
SPORTSPHERE_ROADMAP_V3.md
```

## Razorpay Webhook Setup
```
1. Razorpay Dashboard -> Settings -> Webhooks -> Add Webhook
2. URL: http://<your-server>/api/payments/webhook
   For local dev: npx ngrok http 5000  (paste the https ngrok URL)
3. Secret: a random string you generate -> save in backend/.env as RAZORPAY_WEBHOOK_SECRET
4. Subscribe to events: payment.captured, payment.failed, order.paid
```

## Critical: Raw Body Parsing
The webhook route MUST use `express.raw()` not `express.json()` — HMAC is over raw bytes:
```typescript
app.post('/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = req.body; // Buffer
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');
    if (expected !== signature) return res.status(400).send('Invalid signature');

    const event = JSON.parse(body.toString());
    // Handle payment.captured idempotently
    if (event.event === 'payment.captured') {
      const orderId = event.payload.payment.entity.order_id;
      // Find payment, if already PAID skip, else mark PAID and update campaign
    }
    res.json({ status: 'ok' });
  }
);
```

## Done Gate
- [ ] Webhook receives payment.captured and updates Payment status
- [ ] Duplicate webhook events do not double-credit campaigns (idempotency check)
- [ ] Invalid X-Razorpay-Signature returns 400

---

# PHASE C1: Athlete Verification Document Upload API

## Goal
Allow athletes to upload identity and sports credential documents for admin review.

## Owner
Backend agent. Start after Phase A1 Done Gate.

## Allowed Scope
```
backend/src/index.ts
backend/prisma/schema.prisma
backend/prisma/migrations/**
backend/uploads/**
SPORTSPHERE_ROADMAP_V3.md
```

## Deliverables

### C1-1: Schema
```prisma
model VerificationDocument {
  id          Int            @id @default(autoincrement())
  athleteId   Int
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id])
  docType     String         // "AADHAAR" | "SPORTS_CERTIFICATE" | "OTHER"
  fileUrl     String
  status      String         @default("PENDING") // "PENDING" | "APPROVED" | "REJECTED"
  adminNote   String?
  submittedAt DateTime       @default(now())
  reviewedAt  DateTime?
}
```

Add to AthleteProfile:
```prisma
  verificationDocs VerificationDocument[]
```

### C1-2: Endpoints

| Method | Path | Auth | Description |
|:---|:---|:---|:---|
| `POST` | `/api/verification/upload-doc` | Bearer (athlete) | Multipart -> save file -> create VerificationDocument -> set athlete status PENDING |
| `GET` | `/api/verification/my-docs` | Bearer (athlete) | Returns all docs for authenticated athlete |
| `GET` | `/api/admin/verification/pending` | Bearer (admin) | All athletes with PENDING docs |
| `POST` | `/api/admin/verification/:athleteId/approve` | Bearer (admin) | Sets athlete VERIFIED, doc APPROVED, sets reviewedAt |
| `POST` | `/api/admin/verification/:athleteId/reject` | Bearer (admin) | Sets doc REJECTED, saves adminNote |

## Migration
```bash
npx prisma migrate dev --name phase-c1-verification-documents
```

## Done Gate
- [ ] Athlete can upload file -> VerificationDocument row created with status PENDING
- [ ] GET /api/admin/verification/pending returns athletes with pending docs
- [ ] Admin approve -> athlete Verification.status becomes VERIFIED
- [ ] Admin reject with note -> doc REJECTED, note saved

---

# PHASE C2: Admin Verification Review Portal

## Goal
Add a Verification Queue tab to the admin web portal for document review.

## Owner
Admin web frontend agent. Start after Phase C1 Done Gate.

## Allowed Scope
```
admin-web/src/**
SPORTSPHERE_ROADMAP_V3.md
```

## Deliverables

1. **Verification Queue Tab** in admin nav
   - List of athletes with pending documents: name, sport, submission date, doc count
   
2. **Review Modal**
   - Document thumbnails (images) or file links (PDFs)
   - Document type label
   - Admin note text field
   - "Approve" button (green) -> POST /api/admin/verification/:athleteId/approve
   - "Reject with Note" button (red, requires note) -> POST /api/admin/verification/:athleteId/reject
   - Inline success/failure feedback

3. **Status Badges** on athlete list: VERIFIED (green), PENDING (amber), UNVERIFIED (gray)

## Done Gate
- [ ] Verification Queue tab shows all pending athletes
- [ ] Admin can view uploaded document files
- [ ] Approve -> athlete becomes VERIFIED, disappears from queue
- [ ] Reject with note -> note persisted, athlete removed from queue

---

# PHASE C3: Mobile Verification Status + Submission Flow

## Goal
Athletes see their verification status and can submit documents from mobile.

## Owner
Mobile frontend agent. Start after Phase C1 Done Gate.

## Allowed Scope
```
mobile-app/src/app/athlete/[id].tsx
mobile-app/src/app/verification/**    (create directory)
mobile-app/src/components/**
SPORTSPHERE_ROADMAP_V3.md
```

## Dependencies
```bash
npx expo install expo-document-picker
```

## Deliverables

### C3-1: Verification Status Banner (on own profile)
- UNVERIFIED -> amber banner: "Your profile is not verified. Tap to submit documents."
- PENDING -> blue banner: "Documents under review. We will notify you once verified."
- VERIFIED -> no banner; green checkmark badge already shows

### C3-2: Document Submission Screen (`verification/submit.tsx`)
- Select document type (Aadhaar / Sports Certificate / Other)
- expo-document-picker to pick PDF or image
- Upload via POST /api/verification/upload-doc (multipart)
- Show upload progress and success confirmation

### C3-3: My Documents Screen (`verification/my-docs.tsx`)
- Lists submitted documents with status badges
- Shows admin rejection note if REJECTED (so athlete knows what to fix and resubmit)

## Done Gate
- [ ] Unverified athlete sees amber banner on their profile
- [ ] Tapping banner navigates to document submission screen
- [ ] Document upload succeeds -> status updates to PENDING
- [ ] Rejection note visible on My Documents screen

---

## 5. Recommended Execution Order

```
DAY 1 — Setup + Auth Backend
  [x] Complete Pre-Work Checklist (Razorpay account, Firebase, .env)
  [ ] Phase A1: Production Auth Backend
      - Install firebase-admin, razorpay, dotenv
      - Schema migration (RefreshToken + phone fields)
      - Login/Register/Refresh/Logout/PhoneVerify endpoints
      - Smoke test with curl

DAY 2 — Payments Backend + Build Setup
  [ ] Phase B1: Razorpay Backend Order API (parallel with remaining A1 work)
      - Payment model migration
      - create-order, verify, config, webhook endpoints
  [ ] Phase B2: expo-dev-client Native Build
      - Install native modules
      - Place google-services.json
      - npx expo run:android (do this early — takes time)

DAY 3 — Mobile Auth + Payments Frontend
  [ ] Phase A2: Mobile Auth Screens (requires A1)
      - Unified email + OTP login screen
      - SecureStore token storage
      - Refresh interceptor
  [ ] Phase B3: Mobile Razorpay Checkout (requires B1 + B2)
      - utils/payment.ts
      - Wire into support screen

DAY 4 — Payments Polish + Verification Backend
  [ ] Phase B4: Webhook Verification Polish
      - ngrok setup for local webhook testing
      - Idempotency check
  [ ] Phase C1: Athlete Verification Document Upload API
      - VerificationDocument schema migration
      - Upload + admin review endpoints

DAY 5 — Verification Frontend
  [ ] Phase C2: Admin Verification Review Portal
  [ ] Phase C3: Mobile Verification Status + Submission

DAY 6 — End-to-End Smoke Test
  [ ] Full flow: Register -> Fund an athlete (test mode) -> Verify an athlete
  [ ] Update Progress Log
  [ ] Switch Razorpay to LIVE mode after KYC approval
```

---

## 6. Progress Log (V3)

| Date | Agent | Phase | Change | Files Touched | Verified |
|:---|:---|:---|:---|:---|:---|
| 2026-10-13 | Antigravity | V3 Roadmap | Scope reconfigured to Auth + Payments + Verification | SPORTSPHERE_ROADMAP_V3.md | — |

---

## 7. Decision Log (V3)

| Date | Decision | Reason | Owner |
|:---|:---|:---|:---|
| 2026-10-13 | expo-dev-client over Expo Go | Only way to run native modules (Razorpay, Firebase) on SDK 57 | Antigravity V3 |
| 2026-10-13 | Firebase Authentication for OTP | 10k free OTPs/month, no card needed, Google-managed infra | Antigravity V3 |
| 2026-10-13 | Access token 15min + Refresh token 7d in DB | Security upgrade — current unlimited token is insecure | Antigravity V3 |
| 2026-10-13 | Local file storage for verification docs | Consistent with existing /uploads infra; no S3 complexity yet | Antigravity V3 |
| 2026-10-13 | Manual admin verification flow | Simple, auditable, right for MVP scale | Antigravity V3 |
| 2026-10-13 | Razorpay money lands in merchant account | Simplest flow; manual athlete settlement until scale justifies Razorpay Route | Antigravity V3 |

---

## 8. Blocker Log (V3)

| ID | Blocker | Affected Phase | Resolution |
|:---|:---|:---|:---|
| B-001 | react-native-razorpay is a native module — cannot run in Expo Go | B3 | Phase B2 sets up expo-dev-client — resolves entirely |
| B-002 | Razorpay KYC required for live mode | B1 live | Test mode works immediately; KYC only needed before going live |
| B-003 | Razorpay webhook needs a public URL for local dev | B4 | Use `npx ngrok http 5000` for local testing |
| B-004 | Firebase native modules require expo-dev-client | A2 | Same resolution as B-001 — Phase B2 covers both |
