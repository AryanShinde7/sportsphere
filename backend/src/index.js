const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_for_demo_only';
const MOCK_WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || 'sportsphere_mock_webhook_secret_2026';

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Admin role guard ---
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// --- Helper: Write audit log ---
async function writeAuditLog(userId, action, entityType, entityId, details) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, details }
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// --- Helper: Hydrate a Verification record ---
async function hydrateVerification(v) {
  let entity = null;
  let athleteName = null;

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
function generateMockId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ===================================================================
// AUTH ROUTES
// ===================================================================
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role || 'SUPPORTER' }
    });
    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Registration failed. Email might already exist.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { athleteProfile: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, athleteProfile: user.athleteProfile, profileImageUrl: user.profileImageUrl } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ===================================================================
// ATHLETE & DISCOVERY ROUTES
// ===================================================================
app.get('/api/athletes', async (req, res) => {
  try {
    const { sport, discipline, state, achievementLevel, supportCategory, verificationStatus, requestStatus } = req.query;

    const where = {};
    if (sport) where.sport = { name: sport };
    if (discipline) where.discipline = { contains: discipline };
    if (state) where.state = state;
    if (achievementLevel) {
      where.achievements = { some: { achievementLevel } };
    }
    if (supportCategory) {
      where.supportRequests = { some: { category: supportCategory } };
    }
    if (requestStatus) {
      where.supportRequests = {
        ...where.supportRequests,
        some: { ...(where.supportRequests?.some || {}), lifecycleStatus: requestStatus }
      };
    }

    const athletes = await prisma.athleteProfile.findMany({
      where,
      include: {
        user: { select: { name: true } },
        sport: true,
        achievements: true,
        supportRequests: { where: { lifecycleStatus: 'ACTIVE' } }
      }
    });

    const athletesWithVerifications = await Promise.all(athletes.map(async (athlete) => {
      const profileVerifications = await prisma.verification.findMany({
        where: { entityType: 'AthleteProfile', entityId: athlete.id }
      });
      const achievementIds = athlete.achievements.map((a) => a.id);
      const achievementVerifications = achievementIds.length > 0 ? await prisma.verification.findMany({
        where: { entityType: 'Achievement', entityId: { in: achievementIds } }
      }) : [];
      const srIds = athlete.supportRequests.map((sr) => sr.id);
      const supportVerifications = srIds.length > 0 ? await prisma.verification.findMany({
        where: { entityType: 'SupportRequest', entityId: { in: srIds } }
      }) : [];

      const verifications = [...profileVerifications, ...achievementVerifications, ...supportVerifications];
      return { ...athlete, verifications };
    }));

    if (verificationStatus) {
      const filtered = athletesWithVerifications.filter((a) => {
        if (verificationStatus === 'VERIFIED') {
          const identityVerified = a.verifications.some((v) => v.category === 'IDENTITY' && v.status === 'VERIFIED');
          const anyAchievementVerified = a.verifications.some((v) => v.category === 'ACHIEVEMENT' && v.status === 'VERIFIED');
          return identityVerified && anyAchievementVerified;
        } else if (verificationStatus === 'PENDING_REVIEW') {
          return a.verifications.some((v) => v.status === 'PENDING_REVIEW');
        } else if (verificationStatus === 'NOT_SUBMITTED') {
          return a.verifications.some((v) => v.status === 'NOT_SUBMITTED');
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
        supportRequests: { include: { budgetItems: true } }
      }
    });
    if (!athlete) return res.status(404).json({ error: 'Athlete not found' });

    const profileVerifications = await prisma.verification.findMany({
      where: { entityType: 'AthleteProfile', entityId: athlete.id }
    });
    const achievementIds = athlete.achievements.map((a) => a.id);
    const achievementVerifications = achievementIds.length > 0 ? await prisma.verification.findMany({
      where: { entityType: 'Achievement', entityId: { in: achievementIds } }
    }) : [];
    const srIds = athlete.supportRequests.map((sr) => sr.id);
    const supportVerifications = srIds.length > 0 ? await prisma.verification.findMany({
      where: { entityType: 'SupportRequest', entityId: { in: srIds } }
    }) : [];

    const verifications = [...profileVerifications, ...achievementVerifications, ...supportVerifications];
    res.json({ ...athlete, verifications });
  } catch (error) {
    console.error(error);
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
        athlete: { include: { user: { select: { name: true, email: true } }, sport: true } },
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
        athlete: { include: { user: { select: { name: true } }, sport: true, achievements: true } },
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
// RAZORPAY PAYMENT FLOW
// ===================================================================
app.post('/api/payments/razorpay/create-order', authenticateToken, async (req, res) => {
  const { supportRequestId, amount } = req.body;
  const supporterId = req.user.id;

  if (!supportRequestId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'supportRequestId and a positive amount are required' });
  }

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    const mockOrderId = generateMockId('order');

    const support = await prisma.support.create({
      data: {
        supportRequestId,
        supporterId,
        amount: parseFloat(amount),
        status: 'PENDING',
        transaction: {
          create: {
            amount: parseFloat(amount),
            status: 'CREATED',
            gatewayOrderId: mockOrderId,
            currency: 'INR',
          }
        }
      },
      include: { transaction: true }
    });

    const orderResponse = {
      id: mockOrderId,
      entity: 'order',
      amount: Math.round(amount * 100),
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

app.post('/api/payments/razorpay/webhook', async (req, res) => {
  const webhookSecret = req.headers['x-mock-webhook-secret'];
  if (webhookSecret !== MOCK_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, status } = req.body;
  if (!razorpay_order_id) {
    return res.status(400).json({ error: 'razorpay_order_id is required' });
  }

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { gatewayOrderId: razorpay_order_id },
      include: { support: true }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found for this order ID' });
    }

    if (transaction.status === 'CAPTURED') {
      return res.status(200).json({ message: 'Payment already processed (idempotent)', status: 'CAPTURED' });
    }
    if (transaction.status === 'FAILED') {
      return res.status(200).json({ message: 'Payment already failed (idempotent)', status: 'FAILED' });
    }

    const isSuccess = status !== 'failed';

    if (isSuccess) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId: razorpay_payment_id || generateMockId('pay'),
          gatewaySignature: razorpay_signature || 'mock_signature',
          gatewayResponse: JSON.stringify(req.body),
        }
      });

      await prisma.support.update({
        where: { id: transaction.supportId },
        data: { status: 'SUCCESS' }
      });

      await prisma.supportRequest.update({
        where: { id: transaction.support.supportRequestId },
        data: { amountSupported: { increment: transaction.amount } }
      });

      res.json({ message: 'Payment captured successfully', status: 'CAPTURED' });
    } else {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          gatewayResponse: JSON.stringify(req.body),
        }
      });

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

// Legacy support route
app.post('/api/support-requests/:id/support', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  const supportRequestId = parseInt(req.params.id);
  const supporterId = req.user.id;

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    const mockOrderId = generateMockId('order');
    const mockPaymentId = generateMockId('pay');

    const support = await prisma.support.create({
      data: {
        supportRequestId,
        supporterId,
        amount: parseFloat(amount),
        status: 'SUCCESS',
        transactionId: mockOrderId,
        transaction: {
          create: {
            amount: parseFloat(amount),
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
      data: { amountSupported: { increment: parseFloat(amount) } }
    });

    res.json({ message: 'Support successful!', support, updatedRequest });
  } catch (error) {
    res.status(500).json({ error: 'Support payment failed' });
  }
});

// ===================================================================
// ADMIN — VERIFICATION ROUTES
// ===================================================================
app.get('/api/admin/verifications/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pending = await prisma.verification.findMany({
      where: { status: 'PENDING_REVIEW' }
    });
    const hydrated = await Promise.all(pending.map(hydrateVerification));
    res.json(hydrated);
  } catch (error) {
    console.error('Failed to fetch pending verifications:', error);
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

app.get('/api/admin/verifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { category, status } = req.query;
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const verifications = await prisma.verification.findMany({ where });
    const hydrated = await Promise.all(verifications.map(hydrateVerification));
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

app.post('/api/admin/verifications/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
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

app.post('/api/admin/verifications/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
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

app.post('/api/admin/verifications/:id/request-correction', authenticateToken, requireAdmin, async (req, res) => {
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
// ADMIN — DASHBOARD & AUDIT LOG
// ===================================================================
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalAthletes = await prisma.athleteProfile.count();
    const activeRequests = await prisma.supportRequest.count({ where: { lifecycleStatus: 'ACTIVE' } });
    const totalUsers = await prisma.user.count();
    const totalSupported = await prisma.support.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true }
    });

    const pendingVerificationsCount = await prisma.verification.count({ where: { status: 'PENDING_REVIEW' } });
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
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
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

app.listen(PORT, () => {
  console.log(`✅ SportSphere API running on http://localhost:${PORT}`);
});
