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
app.use(express.json({ limit: '10mb' })); // Allow base64 image uploads

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    req.user = user;
    next();
  });
};

// --- Admin role guard ---
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Helper: ensure user owns the athlete profile
const requireAthleteProfile = async (req, res, next) => {
  try {
    const profile = await prisma.athleteProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Athlete profile not found. Please create your profile first.' });
    req.athleteProfile = profile;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Failed to verify athlete profile.' });
  }
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

// ===================================================
// AUTH ROUTES
// ===================================================

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role || 'SUPPORTER' }
    });
    res.status(201).json({ message: 'Account created successfully!', userId: user.id });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'An account with this email already exists.' });
    console.error(error);
    res.status(400).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { athleteProfile: true }
    });
    if (!user) return res.status(404).json({ error: 'No account found with this email address.' });
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        athleteProfile: user.athleteProfile
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { athleteProfile: { include: { sport: true } } }
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// Update profile image (base64 or URL)
app.put('/api/auth/profile-image', authenticateToken, async (req, res) => {
  const { profileImageUrl } = req.body;
  if (!profileImageUrl) return res.status(400).json({ error: 'Profile image URL is required.' });
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImageUrl }
    });
    res.json({ message: 'Profile image updated successfully.', profileImageUrl: user.profileImageUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile image. Please try again.' });
  }
});

// ===================================================
// SPORTS ROUTES
// ===================================================

app.get('/api/sports', async (req, res) => {
  try {
    const sports = await prisma.sport.findMany({ orderBy: { name: 'asc' } });
    res.json(sports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sports list.' });
  }
});

// ===================================================
// ATHLETE PROFILE ROUTES
// ===================================================

// Get own profile (authenticated athlete)
app.get('/api/athletes/me', authenticateToken, async (req, res) => {
  try {
    const profile = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        sport: true,
        achievements: { orderBy: { createdAt: 'desc' } },
        supportRequests: { where: { lifecycleStatus: 'ACTIVE' } }
      }
    });
    if (!profile) return res.status(404).json({ error: 'Athlete profile not found.' });

    // Include user info (safe fields only)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, profileImageUrl: true, role: true }
    });
    res.json({ ...profile, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch your athlete profile.' });
  }
});

// Create athlete profile
app.post('/api/athletes/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'ATHLETE') {
    return res.status(403).json({ error: 'Only athlete accounts can create athlete profiles.' });
  }
  const {
    sportId, discipline, currentLevel, ageGroup,
    city, state, bio, coachName, academyName, yearsActive,
    currentGoal, supportSummary
  } = req.body;

  try {
    // Check if profile already exists
    const existing = await prisma.athleteProfile.findUnique({ where: { userId: req.user.id } });
    if (existing) return res.status(400).json({ error: 'Athlete profile already exists. Use PUT to update it.' });

    const profile = await prisma.athleteProfile.create({
      data: {
        userId: req.user.id,
        sportId: sportId ? parseInt(sportId) : null,
        discipline,
        currentLevel,
        ageGroup,
        city,
        state,
        bio,
        coachName,
        academyName,
        yearsActive: yearsActive ? parseInt(yearsActive) : null,
        currentGoal,
        supportSummary,
        profileVerificationStatus: 'NOT_SUBMITTED'
      },
      include: { sport: true }
    });

    // Update user role to ATHLETE if registering as athlete
    await prisma.user.update({
      where: { id: req.user.id },
      data: { role: 'ATHLETE' }
    });

    res.status(201).json({ message: 'Athlete profile created successfully!', profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create athlete profile. Please try again.' });
  }
});

// Update athlete profile
app.put('/api/athletes/profile', authenticateToken, requireAthleteProfile, async (req, res) => {
  const {
    sportId, discipline, currentLevel, ageGroup,
    city, state, bio, coachName, academyName, yearsActive,
    currentGoal, supportSummary
  } = req.body;

  try {
    const profile = await prisma.athleteProfile.update({
      where: { userId: req.user.id },
      data: {
        ...(sportId !== undefined && { sportId: sportId ? parseInt(sportId) : null }),
        ...(discipline !== undefined && { discipline }),
        ...(currentLevel !== undefined && { currentLevel }),
        ...(ageGroup !== undefined && { ageGroup }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(bio !== undefined && { bio }),
        ...(coachName !== undefined && { coachName }),
        ...(academyName !== undefined && { academyName }),
        ...(yearsActive !== undefined && { yearsActive: yearsActive ? parseInt(yearsActive) : null }),
        ...(currentGoal !== undefined && { currentGoal }),
        ...(supportSummary !== undefined && { supportSummary })
      },
      include: { sport: true }
    });
    res.json({ message: 'Profile updated successfully.', profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update athlete profile.' });
  }
});

// Submit profile for verification
app.post('/api/athletes/profile/submit-verification', authenticateToken, requireAthleteProfile, async (req, res) => {
  try {
    const profile = await prisma.athleteProfile.update({
      where: { userId: req.user.id },
      data: { profileVerificationStatus: 'PENDING_REVIEW' }
    });
    res.json({ message: 'Profile submitted for verification. Our team will review it shortly.', profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit profile for verification.' });
  }
});

// ===================================================
// ACHIEVEMENTS ROUTES
// ===================================================

// Get achievements for a specific athlete (public)
app.get('/api/athletes/:id/achievements', async (req, res) => {
  try {
    const athleteId = parseInt(req.params.id);
    const achievements = await prisma.achievement.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch achievements.' });
  }
});

// Get own achievements (authenticated)
app.get('/api/achievements/me', authenticateToken, requireAthleteProfile, async (req, res) => {
  try {
    const achievements = await prisma.achievement.findMany({
      where: { athleteId: req.athleteProfile.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your achievements.' });
  }
});

// Create achievement
app.post('/api/achievements', authenticateToken, requireAthleteProfile, async (req, res) => {
  const { title, competition, event, position, score, date, achievementLevel } = req.body;
  if (!title) return res.status(400).json({ error: 'Achievement title is required.' });

  try {
    const achievement = await prisma.achievement.create({
      data: {
        athleteId: req.athleteProfile.id,
        title,
        competition: competition || null,
        event: event || null,
        position: position || null,
        score: score || null,
        date: date || null,
        achievementLevel: achievementLevel || null,
        verificationStatus: 'NOT_SUBMITTED'
      }
    });
    res.status(201).json({ message: 'Achievement added successfully.', achievement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create achievement.' });
  }
});

// Update achievement
app.put('/api/achievements/:id', authenticateToken, requireAthleteProfile, async (req, res) => {
  const achievementId = parseInt(req.params.id);
  const { title, competition, event, position, score, date, evidenceFileId, achievementLevel } = req.body;

  try {
    // Verify ownership
    const existing = await prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!existing) return res.status(404).json({ error: 'Achievement not found.' });
    if (existing.athleteId !== req.athleteProfile.id) return res.status(403).json({ error: 'You can only edit your own achievements.' });

    // If currently NEEDS_CORRECTION, reset to NOT_SUBMITTED on edit
    const newStatus = existing.verificationStatus === 'NEEDS_CORRECTION' ? 'NOT_SUBMITTED' : existing.verificationStatus;

    const achievement = await prisma.achievement.update({
      where: { id: achievementId },
      data: {
        ...(title !== undefined && { title }),
        ...(competition !== undefined && { competition }),
        ...(event !== undefined && { event }),
        ...(position !== undefined && { position }),
        ...(score !== undefined && { score }),
        ...(date !== undefined && { date }),
        ...(evidenceFileId !== undefined && { evidenceFileId }),
        ...(achievementLevel !== undefined && { achievementLevel }),
        ...(existing.verificationStatus === 'NEEDS_CORRECTION' && { verificationStatus: newStatus, reviewNotes: null })
      }
    });
    res.json({ message: 'Achievement updated.', achievement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update achievement.' });
  }
});

// Delete achievement
app.delete('/api/achievements/:id', authenticateToken, requireAthleteProfile, async (req, res) => {
  const achievementId = parseInt(req.params.id);
  try {
    const existing = await prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!existing) return res.status(404).json({ error: 'Achievement not found.' });
    if (existing.athleteId !== req.athleteProfile.id) return res.status(403).json({ error: 'You can only delete your own achievements.' });
    if (existing.verificationStatus === 'VERIFIED') return res.status(400).json({ error: 'Verified achievements cannot be deleted.' });

    await prisma.achievement.delete({ where: { id: achievementId } });
    res.json({ message: 'Achievement deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete achievement.' });
  }
});

// Submit achievement for verification
app.post('/api/achievements/:id/submit-verification', authenticateToken, requireAthleteProfile, async (req, res) => {
  const achievementId = parseInt(req.params.id);
  try {
    const existing = await prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!existing) return res.status(404).json({ error: 'Achievement not found.' });
    if (existing.athleteId !== req.athleteProfile.id) return res.status(403).json({ error: 'You can only submit your own achievements.' });

    const allowedStatuses = ['NOT_SUBMITTED', 'NEEDS_CORRECTION'];
    if (!allowedStatuses.includes(existing.verificationStatus)) {
      return res.status(400).json({
        error: `Cannot submit for verification. Current status: ${existing.verificationStatus}`
      });
    }

    const achievement = await prisma.achievement.update({
      where: { id: achievementId },
      data: { verificationStatus: 'PENDING_REVIEW', reviewNotes: null }
    });
    res.json({ message: 'Achievement submitted for verification. Our team will review it shortly.', achievement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit achievement for verification.' });
  }
});

// Upload evidence for achievement (base64 image or URL)
app.post('/api/achievements/:id/evidence', authenticateToken, requireAthleteProfile, async (req, res) => {
  const achievementId = parseInt(req.params.id);
  const { evidenceFileId, fileName, fileType } = req.body;

  if (!evidenceFileId) return res.status(400).json({ error: 'Evidence file data is required.' });

  try {
    const existing = await prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!existing) return res.status(404).json({ error: 'Achievement not found.' });
    if (existing.athleteId !== req.athleteProfile.id) return res.status(403).json({ error: 'Access denied.' });

    // Store evidence as JSON string containing the image data + metadata
    const evidenceData = JSON.stringify({ uri: evidenceFileId, fileName, fileType, uploadedAt: new Date().toISOString() });

    const achievement = await prisma.achievement.update({
      where: { id: achievementId },
      data: {
        evidenceFileId: evidenceData,
        // If previously submitted and verified/rejected, reset to NOT_SUBMITTED when new evidence uploaded
        ...(existing.verificationStatus === 'NEEDS_CORRECTION' && { verificationStatus: 'NOT_SUBMITTED', reviewNotes: null })
      }
    });
    res.json({ message: 'Evidence uploaded successfully.', achievement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload evidence. Please try again.' });
  }
});

// ===================================================
// PUBLIC ATHLETE & DISCOVERY ROUTES
// ===================================================

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
        user: { select: { name: true, profileImageUrl: true } },
        sport: true,
        achievements: { where: { verificationStatus: 'VERIFIED' } },
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
    res.status(500).json({ error: 'Failed to fetch athletes.' });
  }
});

app.get('/api/athletes/:id', async (req, res) => {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { name: true, profileImageUrl: true } },
        sport: true,
        achievements: true,
        supportRequests: { include: { budgetItems: true } }
      }
    });
    if (!athlete) return res.status(404).json({ error: 'Athlete not found.' });

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

    // For public view: sanitize achievements to not expose private evidence
    const safeAchievements = athlete.achievements.map(a => ({
      id: a.id,
      title: a.title,
      competition: a.competition,
      event: a.event,
      position: a.position,
      score: a.score,
      date: a.date,
      achievementLevel: a.achievementLevel,
      verificationStatus: a.verificationStatus,
      verifiedAt: a.verifiedAt,
    }));

    res.json({ ...athlete, achievements: safeAchievements, verifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch athlete profile.' });
  }
});

// ===================================================
// SUPPORT REQUEST ROUTES
// ===================================================

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
    res.status(500).json({ error: 'Failed to fetch support requests.' });
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
    if (!request) return res.status(404).json({ error: 'Support request not found.' });
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support request.' });
  }
});

// ===================================================
// RAZORPAY PAYMENT FLOW
// ===================================================

app.post('/api/payments/razorpay/create-order', authenticateToken, async (req, res) => {
  const { supportRequestId, amount } = req.body;
  const supporterId = req.user.id;

  if (!supportRequestId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'supportRequestId and a positive amount are required' });
  }

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found.' });

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

// Support (mock payment endpoint - works authenticated or unauthenticated demo mode)
app.post('/api/support-requests/:id/support', async (req, res) => {
  const { amount } = req.body;
  const supportRequestId = parseInt(req.params.id);
  const authHeader = req.headers['authorization'];
  let supporterId = req.body.supporterId || 2;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.id) supporterId = decoded.id;
    } catch {}
  }

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found.' });

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
    console.error(error);
    res.status(500).json({ error: 'Support payment failed.' });
  }
});

// ===================================================
// ADMIN ROUTES
// ===================================================

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

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required.' });
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

    // Achievements pending review for Admin Web App
    const pendingAchievements = await prisma.achievement.findMany({
      where: { verificationStatus: 'PENDING_REVIEW' },
      include: { athlete: { include: { user: { select: { name: true } }, sport: true } } }
    });

    res.json({
      totalAthletes,
      activeRequests,
      totalUsers,
      totalFundsRaised: totalSupported._sum.amount || 0,
      pendingVerificationsCount: pendingVerificationsCount + pendingAchievements.length,
      pendingVerifications: pendingAchievements.length > 0 ? pendingAchievements : pendingVerifications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

// Admin: update achievement verification status (ADMIN only)
app.put('/api/admin/achievements/:id/verify', authenticateToken, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required.' });
  const { verificationStatus, reviewNotes } = req.body;
  const validStatuses = ['VERIFIED', 'NEEDS_CORRECTION', 'REJECTED'];
  if (!validStatuses.includes(verificationStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const achievement = await prisma.achievement.update({
      where: { id: parseInt(req.params.id) },
      data: {
        verificationStatus,
        reviewNotes: reviewNotes || null,
        verifiedBy: verificationStatus === 'VERIFIED' ? req.user.id : null,
        verifiedAt: verificationStatus === 'VERIFIED' ? new Date() : null
      }
    });
    res.json({ message: `Achievement ${verificationStatus.toLowerCase().replace('_', ' ')}.`, achievement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update verification status.' });
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
