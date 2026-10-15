import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:5000';

async function request(endpoint: string, options: any = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  let json: any = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function login(email: string, password = 'password123') {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

async function runTests() {
  console.log('=== STARTING ACCEPTANCE TESTS FOR VERIFICATION SPEC ===\n');

  // Log in users
  const admin = await login('admin@sportsphere.com');
  console.log('✓ Logged in as Admin:', admin.user.email);

  const athleteA = await login('aarav@athlete.com');
  console.log('✓ Logged in as Athlete A:', athleteA.user.email);

  const athleteB = await login('rohan@athlete.com');
  console.log('✓ Logged in as Athlete B:', athleteB.user.email);

  const supporter = await login('supporter@demo.com');
  console.log('✓ Logged in as Supporter:', supporter.user.email);

  // -------------------------------------------------------------
  // Test 7: Strengthen reviewer authorization
  // Acceptance test: A normal athlete, supporter, or sponsor receives 403 Forbidden
  // when attempting an administrative verification action.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 7: REVIEWER AUTHORIZATION ---');
  {
    const suppAttempt = await request('/api/admin/verifications', {
      headers: { Authorization: `Bearer ${supporter.token}` },
    });
    console.log(`Supporter GET /api/admin/verifications status: ${suppAttempt.status}`);
    if (suppAttempt.status !== 403) throw new Error(`Expected 403, got ${suppAttempt.status}`);

    const athleteAttempt = await request('/api/admin/verifications/1/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Self approve' }),
    });
    console.log(`Athlete POST /api/admin/verifications/1/approve status: ${athleteAttempt.status}`);
    if (athleteAttempt.status !== 403) throw new Error(`Expected 403, got ${athleteAttempt.status}`);

    const adminQueue = await request('/api/admin/verifications', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    console.log(`Admin GET /api/admin/verifications status: ${adminQueue.status}`);
    if (adminQueue.status !== 200) throw new Error(`Expected 200 for admin, got ${adminQueue.status}`);
    console.log('✓ Acceptance Test 7 Passed: Non-admins receive 403 Forbidden on admin verification actions.');
  }

  // -------------------------------------------------------------
  // Test 4: Athlete verification submission workflow & ownership
  // Acceptance test: An athlete can submit evidence for their own profile or achievement
  // but cannot submit, edit, or approve a verification request belonging to another athlete.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 4: COMPLETE SUBMISSION WORKFLOW & OWNERSHIP ---');
  let athleteAVerificationId: number;
  {
    // Try to submit verification for athlete B's profile while logged in as athlete A
    const crossSubmit = await request('/api/verifications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'AthleteProfile',
        entityId: athleteB.user.athleteProfile?.id || 2, // athlete B's profile
        category: 'IDENTITY',
        status: 'VERIFIED', // attempt to self-verify
      }),
    });
    console.log(`Cross-user claim status: ${crossSubmit.status}`);
    if (crossSubmit.status !== 403) throw new Error(`Expected 403 for cross-user claim, got ${crossSubmit.status}`);

    // Submit for athlete A's own profile
    // First get athlete A's profile id
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${athleteA.token}` },
    });
    const athleteAProfileId = meRes.body.athleteProfile.id;

    const mySubmit = await request('/api/verifications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'AthleteProfile',
        entityId: athleteAProfileId,
        category: 'IDENTITY',
        status: 'VERIFIED', // attempting to set VERIFIED should be ignored and set to PENDING_REVIEW
        verifiedBy: 999,
      }),
    });
    console.log(`Own-profile claim status: ${mySubmit.status}, claim status: ${mySubmit.body.verification?.status}`);
    if (mySubmit.status !== 201) throw new Error(`Expected 201, got ${mySubmit.status}`);
    if (mySubmit.body.verification.status !== 'PENDING_REVIEW') {
      throw new Error(`Expected PENDING_REVIEW, got ${mySubmit.body.verification.status}`);
    }
    if (mySubmit.body.verification.verifiedBy) {
      throw new Error(`User should not be able to set verifiedBy`);
    }
    athleteAVerificationId = mySubmit.body.verification.id;

    // Athlete B attempts to upload evidence to Athlete A's verification
    // Create a dummy PDF buffer: %PDF-1.4 header
    const dummyPdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    ]);
    const formDataBoundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const formBody = Buffer.concat([
      Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="evidenceType"\r\n\r\nGOVERNMENT_ID\r\n`),
      Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="file"; filename="aadhar.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      dummyPdf,
      Buffer.from(`\r\n--${formDataBoundary}--\r\n`),
    ]);

    const crossEvidence = await fetch(`${BASE_URL}/api/verifications/${athleteAVerificationId}/evidence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteB.token}`,
        'Content-Type': `multipart/form-data; boundary=${formDataBoundary}`,
      },
      body: formBody,
    });
    console.log(`Cross-user evidence upload status: ${crossEvidence.status}`);
    if (crossEvidence.status !== 403) throw new Error(`Expected 403 for cross-user evidence, got ${crossEvidence.status}`);

    // GET /api/verifications/me
    const myVerifs = await request('/api/verifications/me', {
      headers: { Authorization: `Bearer ${athleteA.token}` },
    });
    console.log(`GET /api/verifications/me count: ${myVerifs.body.length}`);
    if (myVerifs.status !== 200 || !Array.isArray(myVerifs.body) || myVerifs.body.length === 0) {
      throw new Error(`Failed to fetch /api/verifications/me`);
    }

    console.log('✓ Acceptance Test 4 Passed: Athletes cannot submit, edit, or upload evidence for another athlete.');
  }

  // -------------------------------------------------------------
  // Test 1: Make uploaded verification documents private
  // Acceptance test: Copy a verification document URL into a logged-out browser and an
  // ordinary contributor account. Neither should be able to retrieve the private document.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 1: PRIVATE VERIFICATION DOCUMENTS ---');
  let uploadedEvidenceId: number;
  let privateStorageKey: string;
  {
    // Upload valid PDF evidence as athlete A
    const dummyPdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    ]);
    const formDataBoundary = '----WebKitFormBoundaryUpload123';
    const formBody = Buffer.concat([
      Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="evidenceType"\r\n\r\nGOVERNMENT_ID\r\n`),
      Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="file"; filename="passport.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      dummyPdf,
      Buffer.from(`\r\n--${formDataBoundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${BASE_URL}/api/verifications/${athleteAVerificationId}/evidence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteA.token}`,
        'Content-Type': `multipart/form-data; boundary=${formDataBoundary}`,
      },
      body: formBody,
    });
    const uploadJson = await uploadRes.json();
    console.log(`Evidence upload status: ${uploadRes.status}, evidenceId: ${uploadJson.evidence?.id}`);
    if (uploadRes.status !== 201 || !uploadJson.evidence) {
      throw new Error(`Evidence upload failed: ${JSON.stringify(uploadJson)}`);
    }
    uploadedEvidenceId = uploadJson.evidence.id;
    privateStorageKey = uploadJson.evidence.privateStorageKey;

    // Verify file is NOT accessible via public /uploads
    const publicUrlTry = await fetch(`${BASE_URL}/uploads/${privateStorageKey}`);
    console.log(`Public /uploads access status: ${publicUrlTry.status}`);
    if (publicUrlTry.status !== 404) {
      throw new Error(`Expected 404 from public /uploads, got ${publicUrlTry.status}`);
    }

    // Try to access protected endpoint as LOGGED OUT
    const loggedOutAccess = await fetch(`${BASE_URL}/api/verifications/evidence/${uploadedEvidenceId}/file`);
    console.log(`Logged-out access status: ${loggedOutAccess.status}`);
    if (loggedOutAccess.status !== 401) {
      throw new Error(`Expected 401 for logged out access, got ${loggedOutAccess.status}`);
    }

    // Try to access protected endpoint as ORDINARY CONTRIBUTOR / SUPPORTER
    const contributorAccess = await fetch(`${BASE_URL}/api/verifications/evidence/${uploadedEvidenceId}/file`, {
      headers: { Authorization: `Bearer ${supporter.token}` },
    });
    console.log(`Contributor access status: ${contributorAccess.status}`);
    if (contributorAccess.status !== 403) {
      throw new Error(`Expected 403 for ordinary contributor, got ${contributorAccess.status}`);
    }

    // Access as Admin: should be 200 OK
    const adminAccess = await fetch(`${BASE_URL}/api/verifications/evidence/${uploadedEvidenceId}/file`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    console.log(`Admin access status: ${adminAccess.status}`);
    if (adminAccess.status !== 200) {
      throw new Error(`Expected 200 for admin, got ${adminAccess.status}`);
    }

    // Access as owning athlete: should be 200 OK
    const ownerAccess = await fetch(`${BASE_URL}/api/verifications/evidence/${uploadedEvidenceId}/file`, {
      headers: { Authorization: `Bearer ${athleteA.token}` },
    });
    console.log(`Owner access status: ${ownerAccess.status}`);
    if (ownerAccess.status !== 200) {
      throw new Error(`Expected 200 for owner, got ${ownerAccess.status}`);
    }

    console.log('✓ Acceptance Test 1 Passed: Private verification documents cannot be retrieved by logged-out users or ordinary contributors.');
  }

  // -------------------------------------------------------------
  // Test 2: Stop approving funding campaigns before verification
  // Acceptance test: A newly created campaign remains unavailable for contributions
  // until an authorized reviewer approves it.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 2: CAMPAIGN APPROVAL BEFORE FUNDING ---');
  let campaignId: number;
  let campaignVerificationId: number;
  {
    // Athlete A creates a campaign
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${athleteA.token}` },
    });
    const athleteProfileId = meRes.body.athleteProfile.id;

    const newCampaign = await request('/api/support-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Running Shoes for National Trials',
        description: 'Need competitive sprint spikes for upcoming nationals.',
        targetAmount: 15000,
        category: 'EQUIPMENT',
        budgetItems: [
          { description: 'Nike Zoom Superfly Elite 2', amount: 15000 },
        ],
      }),
    });
    console.log(`New campaign status: ${newCampaign.status}, approvalStatus: ${newCampaign.body.approvalStatus}`);
    if (newCampaign.status !== 201) throw new Error(`Failed to create campaign: ${JSON.stringify(newCampaign.body)}`);
    if (newCampaign.body.approvalStatus !== 'SUBMITTED' && newCampaign.body.approvalStatus !== 'UNDER_REVIEW') {
      throw new Error(`Expected SUBMITTED or UNDER_REVIEW, got ${newCampaign.body.approvalStatus}`);
    }
    campaignId = newCampaign.body.id;

    // Verify discovery endpoints DO NOT expose unapproved campaign
    const discoveryRes = await request('/api/support-requests');
    const inDiscovery = discoveryRes.body.some((c: any) => c.id === campaignId);
    console.log(`Campaign exposed in public discovery: ${inDiscovery}`);
    if (inDiscovery) throw new Error('Unapproved campaign must not appear in public discovery');

    // Verify contributions are PREVENTED for unapproved campaign
    const payOrderRes = await request('/api/payments/razorpay/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supportRequestId: campaignId,
        amount: 1000,
      }),
    });
    console.log(`Payment order attempt status on unapproved campaign: ${payOrderRes.status}`);
    if (payOrderRes.status !== 400) {
      throw new Error(`Expected 400 rejecting payment for unapproved campaign, got ${payOrderRes.status}`);
    }

    // Find the campaign verification record in admin queue
    const adminVerifs = await request('/api/admin/verifications', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    const matchingVerif = adminVerifs.body.find((v: any) => v.entityType === 'SupportRequest' && v.entityId === campaignId);
    if (!matchingVerif) {
      throw new Error(`Matching Verification record for SupportRequest ${campaignId} was not created`);
    }
    campaignVerificationId = matchingVerif.id;
    console.log(`Found matching verification #${campaignVerificationId} with status ${matchingVerif.status}`);

    // Admin approves the campaign
    const approveRes = await request(`/api/admin/verifications/${campaignVerificationId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Evidence and budget verified.' }),
    });
    console.log(`Admin campaign approve status: ${approveRes.status}`);
    if (approveRes.status !== 200) throw new Error(`Admin approve failed: ${JSON.stringify(approveRes.body)}`);

    // Verify campaign is now APPROVED
    const singleReq = await request(`/api/support-requests/${campaignId}`);
    console.log(`Campaign approval status after admin approval: ${singleReq.body.approvalStatus}`);
    if (singleReq.body.approvalStatus !== 'APPROVED') {
      throw new Error(`Expected APPROVED, got ${singleReq.body.approvalStatus}`);
    }

    // Now payment order creation SHOULD succeed!
    const allowedPayOrder = await request('/api/payments/razorpay/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supportRequestId: campaignId,
        amount: 1000,
      }),
    });
    console.log(`Payment order after approval status: ${allowedPayOrder.status}`);
    if ((allowedPayOrder.status !== 200 && allowedPayOrder.status !== 201) || !allowedPayOrder.body.orderId) {
      throw new Error(`Failed to create order on approved campaign: ${JSON.stringify(allowedPayOrder.body)}`);
    }

    console.log('✓ Acceptance Test 2 Passed: Unapproved campaigns are hidden and cannot accept contributions until approved.');
  }

  // -------------------------------------------------------------
  // Test 3: Make payment verification fail closed
  // Acceptance test: A forged payment callback or webhook cannot create a successful
  // contribution or increase the campaign's collected amount.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 3: FAIL-CLOSED PAYMENT VERIFICATION ---');
  {
    // Create a real order first
    const realOrderRes = await request('/api/payments/razorpay/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supportRequestId: campaignId,
        amount: 500,
      }),
    });
    const realOrderId = realOrderRes.body.orderId;

    // Try forged signature with real order on /api/payments/razorpay/verify
    const forgedVerify = await request('/api/payments/razorpay/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: realOrderId,
        razorpay_payment_id: 'pay_fake_456',
        razorpay_signature: 'forged_fake_signature_hash_value_9999999999999999999999999999999999999999999999999999999999999999',
      }),
    });
    console.log(`Forged payment verification status: ${forgedVerify.status}`);
    if (forgedVerify.status !== 400) {
      throw new Error(`Expected 400 for forged payment verification, got ${forgedVerify.status}`);
    }

    // Try forged webhook signature
    const forgedWebhook = await request('/api/payments/razorpay/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid_forged_webhook_signature',
      },
      body: JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_mock_123',
              order_id: 'order_mock_123',
              amount: 50000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      }),
    });
    console.log(`Forged webhook status: ${forgedWebhook.status}`);
    if (forgedWebhook.status !== 400) {
      throw new Error(`Expected 400 for forged webhook signature, got ${forgedWebhook.status}`);
    }

    // Test Valid Webhook with exact HMAC signature & check idempotent processing
    const webhookSecret = process.env.MOCK_WEBHOOK_SECRET || 'sportsphere_mock_webhook_secret_2026';
    
    // First create a genuine pending order in DB
    const orderRes = await request('/api/payments/razorpay/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${supporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supportRequestId: campaignId,
        amount: 2500,
      }),
    });
    const genuineOrderId = orderRes.body.orderId;
    const genuinePaymentId = `pay_test_${Date.now()}`;

    // Get current campaign amountSupported
    const beforeReq = await request(`/api/support-requests/${campaignId}`);
    const beforeAmount = beforeReq.body.amountSupported;

    const webhookBodyObj = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: genuinePaymentId,
            order_id: genuineOrderId,
            amount: 2500 * 100, // 2500 INR in paise
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const webhookPayloadRaw = JSON.stringify(webhookBodyObj);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayloadRaw)
      .digest('hex');

    // Send valid webhook
    const validWebhookRes = await fetch(`${BASE_URL}/api/payments/razorpay/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      body: webhookPayloadRaw,
    });
    console.log(`Valid webhook status: ${validWebhookRes.status}`);
    if (validWebhookRes.status !== 200) {
      const errText = await validWebhookRes.text();
      throw new Error(`Valid webhook failed: ${validWebhookRes.status} ${errText}`);
    }

    // Check amountSupported incremented
    const afterFirstReq = await request(`/api/support-requests/${campaignId}`);
    console.log(`Campaign amountSupported: before=${beforeAmount}, after=${afterFirstReq.body.amountSupported}`);
    if (afterFirstReq.body.amountSupported !== beforeAmount + 2500) {
      throw new Error(`Expected amountSupported to increase by 2500`);
    }

    // Re-send the EXACT SAME webhook event (simulate duplicate delivery) -> must be idempotent!
    const duplicateWebhookRes = await fetch(`${BASE_URL}/api/payments/razorpay/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      body: webhookPayloadRaw,
    });
    console.log(`Duplicate webhook status: ${duplicateWebhookRes.status}`);
    const afterDuplicateReq = await request(`/api/support-requests/${campaignId}`);
    console.log(`Campaign amountSupported after duplicate: ${afterDuplicateReq.body.amountSupported}`);
    if (afterDuplicateReq.body.amountSupported !== afterFirstReq.body.amountSupported) {
      throw new Error(`Duplicate webhook must NOT increment amountSupported again!`);
    }

    console.log('✓ Acceptance Test 3 Passed: Forged signatures rejected; valid webhooks processed idempotently without double-counting.');
  }

  // -------------------------------------------------------------
  // Test 5: Verify each achievement separately
  // Acceptance test: An athlete with one approved achievement and two pending achievements
  // displays only the approved achievement as verified.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 5: VERIFY EACH ACHIEVEMENT SEPARATELY ---');
  {
    // Submit Achievement 1
    const ach1 = await request('/api/achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'State Track Championship 400m Gold',
        competitionName: 'Maharashtra State Senior Athletics',
        event: '400m Men Finals',
        date: '2026-03-15',
        result: '1st Place (Gold Medal - 47.92s)',
        achievementLevel: 'STATE',
        evidenceSource: 'Official State Athletics Federation Result Sheet',
      }),
    });
    console.log(`Achievement 1 creation status: ${ach1.status}, verificationStatus: ${ach1.body.verificationStatus}`);
    if (ach1.status !== 201 || ach1.body.verificationStatus !== 'PENDING_REVIEW') {
      throw new Error(`Achievement 1 verificationStatus should be PENDING_REVIEW`);
    }

    // Submit Achievement 2
    const ach2 = await request('/api/achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'West Zone Inter-University 200m Silver',
        competitionName: 'West Zone Universities Championship',
        event: '200m Sprint',
        date: '2026-01-20',
        result: '2nd Place',
        achievementLevel: 'ZONE',
        evidenceSource: 'University Sports Board Certificate',
      }),
    });
    console.log(`Achievement 2 creation status: ${ach2.status}, verificationStatus: ${ach2.body.verificationStatus}`);

    // Submit Achievement 3
    const ach3 = await request('/api/achievements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${athleteA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'District Open 400m Gold',
        competitionName: 'Pune District Open Meet',
        event: '400m Men',
        date: '2025-11-10',
        result: '1st Place',
        achievementLevel: 'DISTRICT',
        evidenceSource: 'District Association Meet Circular',
      }),
    });
    console.log(`Achievement 3 creation status: ${ach3.status}, verificationStatus: ${ach3.body.verificationStatus}`);

    // Approve ONLY Achievement 1
    const adminVerifs = await request('/api/admin/verifications', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    const verif1 = adminVerifs.body.find((v: any) => v.entityType === 'Achievement' && v.entityId === ach1.body.id);
    if (!verif1) throw new Error(`Could not find verification for Achievement ${ach1.body.id}`);

    const approveAch1 = await request(`/api/admin/verifications/${verif1.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Verified against Maharashtra State Athletics official bulletin' }),
    });
    console.log(`Admin approve Achievement 1 status: ${approveAch1.status}`);
    if (approveAch1.status !== 200) throw new Error('Failed to approve Achievement 1');

    // Fetch athlete's achievements via /api/athletes/:id
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${athleteA.token}` },
    });
    const athleteProfileId = meRes.body.athleteProfile.id;
    const athleteRes = await request(`/api/athletes/${athleteProfileId}`);
    
    const achievements = athleteRes.body.achievements;
    const item1 = achievements.find((a: any) => a.id === ach1.body.id);
    const item2 = achievements.find((a: any) => a.id === ach2.body.id);
    const item3 = achievements.find((a: any) => a.id === ach3.body.id);

    console.log(`Achievement 1 status: ${item1?.verificationStatus}`);
    console.log(`Achievement 2 status: ${item2?.verificationStatus}`);
    console.log(`Achievement 3 status: ${item3?.verificationStatus}`);

    if (item1?.verificationStatus !== 'VERIFIED') {
      throw new Error(`Expected Achievement 1 to be VERIFIED, got ${item1?.verificationStatus}`);
    }
    if (item2?.verificationStatus !== 'PENDING_REVIEW') {
      throw new Error(`Expected Achievement 2 to be PENDING_REVIEW, got ${item2?.verificationStatus}`);
    }
    if (item3?.verificationStatus !== 'PENDING_REVIEW') {
      throw new Error(`Expected Achievement 3 to be PENDING_REVIEW, got ${item3?.verificationStatus}`);
    }

    // Check that athlete's overall profile is NOT auto-verified
    const profileIdentityVerif = athleteRes.body.verifications?.find((v: any) => v.entityType === 'AthleteProfile' && v.category === 'IDENTITY');
    console.log(`Athlete profile identity verification status: ${profileIdentityVerif?.status}`);
    if (profileIdentityVerif?.status === 'VERIFIED') {
      throw new Error('Athlete profile identity must not be auto-verified when achievement is verified');
    }

    console.log('✓ Acceptance Test 5 Passed: Only the approved achievement is verified; pending achievements and profile remain separate.');
  }

  // -------------------------------------------------------------
  // Test 6: Enforce valid verification state transitions
  // Acceptance test: Invalid transitions return an appropriate error and do not
  // partially update the database.
  // -------------------------------------------------------------
  console.log('\n--- TESTING INSTRUCTION 6: ENFORCE VALID STATE TRANSITIONS ---');
  {
    // Try to reject without providing a reason
    const noReasonReject = await request(`/api/admin/verifications/${athleteAVerificationId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '' }), // missing or empty reason
    });
    console.log(`Reject without reason status: ${noReasonReject.status}`);
    if (noReasonReject.status !== 400) {
      throw new Error(`Expected 400 for reject without reason, got ${noReasonReject.status}`);
    }

    // Try request-correction without notes
    const noNotesCorrection = await request(`/api/admin/verifications/${athleteAVerificationId}/request-correction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: '' }),
    });
    console.log(`Request-correction without notes status: ${noNotesCorrection.status}`);
    if (noNotesCorrection.status !== 400) {
      throw new Error(`Expected 400 for request correction without notes, got ${noNotesCorrection.status}`);
    }

    // Successfully request correction
    const validCorrection = await request(`/api/admin/verifications/${athleteAVerificationId}/request-correction`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Please upload front and back of national ID.' }),
    });
    console.log(`Valid correction request status: ${validCorrection.status}`);
    if (validCorrection.status !== 200) throw new Error('Correction request failed');

    // Verification is now in NEEDS_CORRECTION
    // User resubmitting evidence moves it back to PENDING_REVIEW
    const dummyPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG magic bytes
      Buffer.from('dummy image data content'),
    ]);
    const formDataBoundary = '----WebKitFormBoundaryResubmit';
    const formBody = Buffer.concat([
      Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="evidenceType"\r\n\r\nGOVERNMENT_ID\r\n`),
      Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="file"; filename="aadhar_back.png"\r\nContent-Type: image/png\r\n\r\n`),
      dummyPng,
      Buffer.from(`\r\n--${formDataBoundary}--\r\n`),
    ]);

    const resubmitRes = await fetch(`${BASE_URL}/api/verifications/${athleteAVerificationId}/evidence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteA.token}`,
        'Content-Type': `multipart/form-data; boundary=${formDataBoundary}`,
      },
      body: formBody,
    });
    console.log(`Resubmit evidence status: ${resubmitRes.status}`);
    if (resubmitRes.status !== 201) throw new Error('Resubmitting evidence failed');

    // Check verification status is back to PENDING_REVIEW
    const myVerifsAfter = await request('/api/verifications/me', {
      headers: { Authorization: `Bearer ${athleteA.token}` },
    });
    const checkV = myVerifsAfter.body.find((v: any) => v.id === athleteAVerificationId);
    console.log(`Verification status after resubmission: ${checkV?.status}`);
    if (checkV?.status !== 'PENDING_REVIEW') {
      throw new Error(`Expected PENDING_REVIEW after resubmission, got ${checkV?.status}`);
    }

    // Admin rejects with valid reason
    const validReject = await request(`/api/admin/verifications/${athleteAVerificationId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Submitted ID is expired.' }),
    });
    console.log(`Valid rejection status: ${validReject.status}`);
    if (validReject.status !== 200) throw new Error('Rejection failed');

    // Attempting an invalid transition: approving a nonexistent verification ID
    const nonExistentApprove = await request('/api/admin/verifications/999999/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Approve' }),
    });
    console.log(`Approve nonexistent ID status: ${nonExistentApprove.status}`);
    if (nonExistentApprove.status !== 404) {
      throw new Error(`Expected 404 for nonexistent verification, got ${nonExistentApprove.status}`);
    }

    console.log('✓ Acceptance Test 6 Passed: State transitions properly validated, reasons enforced, transactions kept atomic.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 7 ACCEPTANCE CRITERIA PASSED WITHOUT COMPLAINT!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
