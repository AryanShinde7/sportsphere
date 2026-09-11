import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();

const app = express();
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_for_demo_only';
const MOCK_WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || 'sportsphere_mock_webhook_secret_2026';

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Admin role guard (use after authenticateToken) ---
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// --- Helper: Write audit log ---
async function writeAuditLog(userId: number, action: string, entityType: string, entityId: number, details?: string) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, details }
  });
}

// --- Helper: Hydrate a Verification record with its linked entity ---
async function hydrateVerification(v: any) {
  let entity: any = null;
  let athleteName: string | null = null;

  if (v.entityType === 'AthleteProfile') {
    entity = await prisma.athleteProfile.findUnique({
      where: { id: v.entityId },
      include: { user: { select: { name: true } }, sport: true }
    });
    athleteName = entity?.user?.name || null;
  } else if (v.entityType === 'Achievement') {
    entity = await prisma.achievement.findUnique({
      where: { id: v.entityId },
      include: { athlete: { include: { user: { select: { name: true } } } } }
    });
    athleteName = entity?.athlete?.user?.name || null;
  } else if (v.entityType === 'SupportRequest') {
    entity = await prisma.supportRequest.findUnique({
      where: { id: v.entityId },
      include: { athlete: { include: { user: { select: { name: true } } } } }
    });
    athleteName = entity?.athlete?.user?.name || null;
  } else if (v.entityType === 'BudgetItem') {
    entity = await prisma.budgetItem.findUnique({
      where: { id: v.entityId },
      include: { supportRequest: { include: { athlete: { include: { user: { select: { name: true } } } } } } }
    });
    athleteName = entity?.supportRequest?.athlete?.user?.name || null;
  }

  return { ...v, entity, athleteName };
}

// --- Helper: Generate mock Razorpay-style IDs ---
function generateMockId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

// ===================================================================
// AUTH ROUTES
// ===================================================================

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'SUPPORTER'
      }
    });
    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: 'Registration failed. Email might already exist.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ===================================================================
// ATHLETE & DISCOVERY ROUTES (with filters — Step 5)
// ===================================================================

app.get('/api/athletes', async (req, res) => {
  try {
    const { sport, discipline, state, achievementLevel, supportCategory, verificationStatus, requestStatus } = req.query;

    // Build where clause for athlete profiles
    const where: any = {};
    if (sport) where.sport = { name: sport as string };
    if (discipline) where.discipline = { contains: discipline as string };
    if (state) where.state = state as string;

    // Achievement-level filter: only include athletes who have at least one achievement at this level
    if (achievementLevel) {
      where.achievements = { some: { achievementLevel: achievementLevel as string } };
    }

    // Support category filter
    if (supportCategory) {
      where.supportRequests = { some: { category: supportCategory as string } };
    }

    // Request status filter (lifecycleStatus)
    if (requestStatus) {
      where.supportRequests = {
        ...where.supportRequests,
        some: { ...(where.supportRequests?.some || {}), lifecycleStatus: requestStatus as string }
      };
    }

    const athletes = await prisma.athleteProfile.findMany({
      where,
      include: {
        user: { select: { name: true } },
        sport: true,
        achievements: true,
        supportRequests: {
          where: { lifecycleStatus: 'ACTIVE' }
        }
      }
    });

    // Attach verification records for each athlete
    const athletesWithVerifications = await Promise.all(athletes.map(async (athlete) => {
      // Get verifications for this athlete profile (IDENTITY, ATHLETE_AFFILIATION)
      const profileVerifications = await prisma.verification.findMany({
        where: { entityType: 'AthleteProfile', entityId: athlete.id }
      });

      // Get verifications for each achievement
      const achievementIds = athlete.achievements.map((a: any) => a.id);
      const achievementVerifications = achievementIds.length > 0 ? await prisma.verification.findMany({
        where: { entityType: 'Achievement', entityId: { in: achievementIds } }
      }) : [];

      // Get verifications for each support request
      const srIds = athlete.supportRequests.map((sr: any) => sr.id);
      const supportVerifications = srIds.length > 0 ? await prisma.verification.findMany({
        where: { entityType: 'SupportRequest', entityId: { in: srIds } }
      }) : [];

      const verifications = [...profileVerifications, ...achievementVerifications, ...supportVerifications];

      return { ...athlete, verifications };
    }));

    // Apply verificationStatus filter after hydration
    // "VERIFIED" = IDENTITY is VERIFIED AND at least one ACHIEVEMENT is VERIFIED
    if (verificationStatus) {
      const filtered = athletesWithVerifications.filter((a: any) => {
        if (verificationStatus === 'VERIFIED') {
          const identityVerified = a.verifications.some((v: any) => v.category === 'IDENTITY' && v.status === 'VERIFIED');
          const anyAchievementVerified = a.verifications.some((v: any) => v.category === 'ACHIEVEMENT' && v.status === 'VERIFIED');
          return identityVerified && anyAchievementVerified;
        } else if (verificationStatus === 'PENDING_REVIEW') {
          return a.verifications.some((v: any) => v.status === 'PENDING_REVIEW');
        } else if (verificationStatus === 'NOT_SUBMITTED') {
          return a.verifications.some((v: any) => v.status === 'NOT_SUBMITTED');
        }
        return true;
      });
      return res.json(filtered);
    }

    res.json(athletesWithVerifications);
  } catch (error) {
    console.error('Failed to fetch athletes:', error);
    res.status(500).json({ error: 'Failed to fetch athletes' });
  }
});

app.get('/api/athletes/:id', async (req, res) => {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { name: true } },
        sport: true,
        achievements: true,
        supportRequests: {
          include: { budgetItems: true }
        }
      }
    });
    if (!athlete) return res.status(404).json({ error: 'Athlete not found' });

    // Attach verification records
    const profileVerifications = await prisma.verification.findMany({
      where: { entityType: 'AthleteProfile', entityId: athlete.id }
    });
    const achievementIds = athlete.achievements.map((a: any) => a.id);
    const achievementVerifications = achievementIds.length > 0 ? await prisma.verification.findMany({
      where: { entityType: 'Achievement', entityId: { in: achievementIds } }
    }) : [];
    const srIds = athlete.supportRequests.map((sr: any) => sr.id);
    const supportVerifications = srIds.length > 0 ? await prisma.verification.findMany({
      where: { entityType: 'SupportRequest', entityId: { in: srIds } }
    }) : [];

    const verifications = [...profileVerifications, ...achievementVerifications, ...supportVerifications];

    res.json({ ...athlete, verifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch athlete' });
  }
});

// ===================================================================
// SUPPORT REQUEST ROUTES
// ===================================================================

app.get('/api/support-requests', async (req, res) => {
  try {
    const requests = await prisma.supportRequest.findMany({
      include: {
        athlete: {
          include: { user: { select: { name: true, email: true } }, sport: true }
        },
        budgetItems: true
      }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

app.get('/api/support-requests/:id', async (req, res) => {
  try {
    const request = await prisma.supportRequest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        athlete: {
          include: { user: { select: { name: true } }, sport: true, achievements: true }
        },
        budgetItems: true
      }
    });
    if (!request) return res.status(404).json({ error: 'Support request not found' });
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support request' });
  }
});

// ===================================================================
// RAZORPAY-SHAPED PAYMENT FLOW (Step 2)
// ===================================================================

// POST /api/payments/razorpay/create-order — creates Support + Transaction, returns mock order
app.post('/api/payments/razorpay/create-order', authenticateToken, async (req: any, res) => {
  const { supportRequestId, amount } = req.body;
  const supporterId = req.user.id;

  if (!supportRequestId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'supportRequestId and a positive amount are required' });
  }

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    const mockOrderId = generateMockId('order');

    // Create Support record (INITIATED) and Transaction (CREATED) in one transaction
    const support = await prisma.support.create({
      data: {
        supportRequestId,
        supporterId,
        amount,
        status: 'PENDING', // User is now in checkout
        transaction: {
          create: {
            amount,
            status: 'CREATED',
            gatewayOrderId: mockOrderId,
            currency: 'INR',
          }
        }
      },
      include: { transaction: true }
    });

    // Return mock Razorpay order shape
    const orderResponse = {
      id: mockOrderId,
      entity: 'order',
      amount: Math.round(amount * 100), // Razorpay uses paise
      currency: 'INR',
      status: 'created',
      supportId: support.id,
    };

    await writeAuditLog(supporterId, 'PAYMENT_ORDER_CREATED', 'Support', support.id,
      JSON.stringify({ supportRequestId, amount, orderId: mockOrderId }));

    res.status(201).json(orderResponse);
  } catch (error) {
    console.error('Create order failed:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payments/razorpay/webhook — processes payment confirmation
// Security: requires x-mock-webhook-secret header (not wide open)
// Idempotency: if Transaction already CAPTURED, returns 200 no-op
app.post('/api/payments/razorpay/webhook', async (req, res) => {
  // --- Security check: require shared secret header ---
  const webhookSecret = req.headers['x-mock-webhook-secret'];
  if (webhookSecret !== MOCK_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, status } = req.body;

  if (!razorpay_order_id) {
    return res.status(400).json({ error: 'razorpay_order_id is required' });
  }

  try {
    // Find the transaction by gatewayOrderId
    const transaction = await prisma.transaction.findFirst({
      where: { gatewayOrderId: razorpay_order_id },
      include: { support: true }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found for this order ID' });
    }

    // --- Idempotency guard ---
    if (transaction.status === 'CAPTURED') {
      return res.status(200).json({ message: 'Payment already processed (idempotent)', status: 'CAPTURED' });
    }
    if (transaction.status === 'FAILED') {
      return res.status(200).json({ message: 'Payment already failed (idempotent)', status: 'FAILED' });
    }

    const isSuccess = status !== 'failed'; // Default to success unless explicitly failed

    // TODO: Replace with real HMAC SHA256 verification using RAZORPAY_KEY_SECRET
    // const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    //   .update(razorpay_order_id + '|' + razorpay_payment_id)
    //   .digest('hex');

    if (isSuccess) {
      // Update Transaction → CAPTURED
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId: razorpay_payment_id || generateMockId('pay'),
          gatewaySignature: razorpay_signature || 'mock_signature',
          gatewayResponse: JSON.stringify(req.body),
        }
      });

      // Update Support → SUCCESS
      await prisma.support.update({
        where: { id: transaction.supportId },
        data: { status: 'SUCCESS' }
      });

      // Increment SupportRequest.amountSupported
      await prisma.supportRequest.update({
        where: { id: transaction.support.supportRequestId },
        data: { amountSupported: { increment: transaction.amount } }
      });

      res.json({ message: 'Payment captured successfully', status: 'CAPTURED' });
    } else {
      // Update Transaction → FAILED
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          gatewayResponse: JSON.stringify(req.body),
        }
      });

      // Update Support → FAILED
      await prisma.support.update({
        where: { id: transaction.supportId },
        data: { status: 'FAILED' }
      });

      res.json({ message: 'Payment failed', status: 'FAILED' });
    }
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Legacy support route (kept for backward compat, but now creates proper Transaction records)
app.post('/api/support-requests/:id/support', authenticateToken, async (req: any, res) => {
  const { amount } = req.body;
  const supportRequestId = parseInt(req.params.id);
  const supporterId = req.user.id;

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    const mockOrderId = generateMockId('order');
    const mockPaymentId = generateMockId('pay');

    // Create support + transaction in one go (auto-success for legacy flow)
    const support = await prisma.support.create({
      data: {
        supportRequestId,
        supporterId,
        amount,
        status: 'SUCCESS',
        transactionId: mockOrderId,
        transaction: {
          create: {
            amount,
            status: 'CAPTURED',
            gatewayOrderId: mockOrderId,
            gatewayPaymentId: mockPaymentId,
            currency: 'INR',
          }
        }
      }
    });

    const updatedRequest = await prisma.supportRequest.update({
      where: { id: supportRequestId },
      data: { amountSupported: { increment: amount } }
    });

    res.json({ message: 'Support successful!', support, updatedRequest });
  } catch (error) {
    res.status(500).json({ error: 'Support payment failed' });
  }
});

// ===================================================================
// ADMIN — VERIFICATION ROUTES (Step 3)
// ===================================================================

// GET /api/admin/verifications/pending — hydrated pending verification items
app.get('/api/admin/verifications/pending', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const pending = await prisma.verification.findMany({
      where: { status: 'PENDING_REVIEW' }
    });

    // Hydrate each verification with its linked entity + athlete name
    const hydrated = await Promise.all(pending.map(hydrateVerification));

    res.json(hydrated);
  } catch (error) {
    console.error('Failed to fetch pending verifications:', error);
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

// GET /api/admin/verifications — all verifications (with optional category/status filter)
app.get('/api/admin/verifications', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { category, status } = req.query;
    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const verifications = await prisma.verification.findMany({ where });
    const hydrated = await Promise.all(verifications.map(hydrateVerification));
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// POST /api/admin/verifications/:id/approve
app.post('/api/admin/verifications/:id/approve', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { notes } = req.body;

    const verification = await prisma.verification.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
        notes: notes || null,
      }
    });

    // Sync denormalized Achievement.verificationStatus if this is an ACHIEVEMENT verification
    if (verification.entityType === 'Achievement') {
      await prisma.achievement.update({
        where: { id: verification.entityId },
        data: { verificationStatus: 'VERIFIED', verifiedBy: req.user.id, verifiedAt: new Date() }
      });
    }

    await writeAuditLog(req.user.id, 'VERIFICATION_APPROVED', 'Verification', id,
      JSON.stringify({ category: verification.category, entityType: verification.entityType, entityId: verification.entityId, notes }));

    res.json(verification);
  } catch (error) {
    console.error('Approve verification failed:', error);
    res.status(500).json({ error: 'Failed to approve verification' });
  }
});

// POST /api/admin/verifications/:id/reject
app.post('/api/admin/verifications/:id/reject', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { notes } = req.body;

    const verification = await prisma.verification.update({
      where: { id },
      data: {
        status: 'REJECTED',
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
        notes: notes || null,
      }
    });

    if (verification.entityType === 'Achievement') {
      await prisma.achievement.update({
        where: { id: verification.entityId },
        data: { verificationStatus: 'REJECTED', verifiedBy: req.user.id, verifiedAt: new Date() }
      });
    }

    await writeAuditLog(req.user.id, 'VERIFICATION_REJECTED', 'Verification', id,
      JSON.stringify({ category: verification.category, entityType: verification.entityType, entityId: verification.entityId, notes }));

    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject verification' });
  }
});

// POST /api/admin/verifications/:id/request-correction
app.post('/api/admin/verifications/:id/request-correction', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { notes } = req.body;

    const verification = await prisma.verification.update({
      where: { id },
      data: {
        status: 'NEEDS_CORRECTION',
        verifiedBy: req.user.id,
        notes: notes || null,
      }
    });

    if (verification.entityType === 'Achievement') {
      await prisma.achievement.update({
        where: { id: verification.entityId },
        data: { verificationStatus: 'NEEDS_CORRECTION' }
      });
    }

    await writeAuditLog(req.user.id, 'VERIFICATION_CORRECTION_REQUESTED', 'Verification', id,
      JSON.stringify({ category: verification.category, entityType: verification.entityType, entityId: verification.entityId, notes }));

    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to request correction' });
  }
});

// ===================================================================
// ADMIN — SUPPORT REQUEST MANAGEMENT (Step 7)
// ===================================================================

app.get('/api/admin/support-requests', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const requests = await prisma.supportRequest.findMany({
      include: {
        athlete: {
          include: { user: { select: { name: true, email: true } }, sport: true }
        },
        budgetItems: true,
        supports: {
          include: { transaction: true }
        }
      }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

app.put('/api/admin/support-requests/:id/approve', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.supportRequest.update({
      where: { id },
      data: { approvalStatus: 'APPROVED' }
    });

    await writeAuditLog(req.user.id, 'SUPPORT_REQUEST_APPROVED', 'SupportRequest', id,
      JSON.stringify({ title: updated.title }));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve support request' });
  }
});

// ===================================================================
// ADMIN — SPONSORSHIP MANAGEMENT (Step 6 & 7)
// ===================================================================

app.get('/api/admin/sponsorship-interests', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const interests = await prisma.sponsorshipInterest.findMany({
      include: {
        sponsor: { include: { user: { select: { name: true, email: true } } } },
        athlete: { include: { user: { select: { name: true } }, sport: true } },
      }
    });
    res.json(interests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sponsorship interests' });
  }
});

app.put('/api/admin/sponsorship-interests/:id', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const updated = await prisma.sponsorshipInterest.update({
      where: { id },
      data: { status }
    });

    await writeAuditLog(req.user.id, 'SPONSORSHIP_STATUS_UPDATED', 'SponsorshipInterest', id,
      JSON.stringify({ newStatus: status }));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sponsorship interest' });
  }
});

// ===================================================================
// SPONSORSHIP INTEREST — PUBLIC (Step 6)
// ===================================================================

app.post('/api/athletes/:id/sponsorship-interest', authenticateToken, async (req: any, res) => {
  try {
    const athleteId = parseInt(req.params.id);
    const { organizationName, contactPerson, supportType, proposedAmount, duration, requirements, message } = req.body;

    // Get the sponsor profile for the authenticated user
    const sponsorProfile = await prisma.sponsorProfile.findUnique({ where: { userId: req.user.id } });

    if (!sponsorProfile) {
      // Create one on the fly if the user is a SPONSOR role but doesn't have a profile yet
      if (req.user.role !== 'SPONSOR') {
        return res.status(403).json({ error: 'Only sponsors can submit sponsorship interests' });
      }
    }

    const sponsorId = sponsorProfile
      ? sponsorProfile.id
      : (await prisma.sponsorProfile.create({
          data: {
            userId: req.user.id,
            organizationName: organizationName || 'Unknown Organization',
            contactPerson: contactPerson || req.user.name,
          }
        })).id;

    const interest = await prisma.sponsorshipInterest.create({
      data: {
        sponsorId,
        athleteId,
        supportType: supportType || 'FINANCIAL',
        proposedAmount: proposedAmount || null,
        duration: duration || null,
        requirements: requirements || null,
        message: message || null,
      }
    });

    await writeAuditLog(req.user.id, 'SPONSORSHIP_INTEREST_SUBMITTED', 'SponsorshipInterest', interest.id,
      JSON.stringify({ athleteId, supportType }));

    res.status(201).json(interest);
  } catch (error) {
    console.error('Sponsorship interest creation failed:', error);
    res.status(500).json({ error: 'Failed to submit sponsorship interest' });
  }
});

// ===================================================================
// ADMIN — DASHBOARD & AUDIT LOG (Step 7)
// ===================================================================

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const totalAthletes = await prisma.athleteProfile.count();
    const activeRequests = await prisma.supportRequest.count({ where: { lifecycleStatus: 'ACTIVE' } });
    const totalUsers = await prisma.user.count();
    const totalSupported = await prisma.support.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true }
    });

    // Pending verifications count (across all categories)
    const pendingVerificationsCount = await prisma.verification.count({ where: { status: 'PENDING_REVIEW' } });

    // Recent pending verifications (hydrated)
    const pendingRaw = await prisma.verification.findMany({
      where: { status: 'PENDING_REVIEW' },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    const pendingVerifications = await Promise.all(pendingRaw.map(hydrateVerification));

    res.json({
      totalAthletes,
      activeRequests,
      totalUsers,
      totalFundsRaised: totalSupported._sum.amount || 0,
      pendingVerificationsCount,
      pendingVerifications
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/admin/audit-logs — paginated audit log viewer
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ===================================================================
// START SERVER
// ===================================================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
