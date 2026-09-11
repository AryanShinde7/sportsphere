const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_for_demo_only';

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
  const { title, competition, event, position, score, date } = req.body;
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
  const { title, competition, event, position, score, date, evidenceFileId } = req.body;

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
    const athletes = await prisma.athleteProfile.findMany({
      include: {
        user: { select: { name: true, profileImageUrl: true } },
        sport: true,
        achievements: { where: { verificationStatus: 'VERIFIED' } },
        supportRequests: { where: { lifecycleStatus: 'ACTIVE' } }
      }
    });
    res.json(athletes);
  } catch (error) {
    console.error(error);
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

    // For public view: never expose private documents
    const safeAchievements = athlete.achievements.map(a => ({
      id: a.id,
      title: a.title,
      competition: a.competition,
      event: a.event,
      position: a.position,
      score: a.score,
      date: a.date,
      verificationStatus: a.verificationStatus,
      verifiedAt: a.verifiedAt,
      // Do NOT expose evidenceFileId or reviewNotes on public endpoint
    }));

    res.json({ ...athlete, achievements: safeAchievements });
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
        athlete: { include: { user: { select: { name: true } }, sport: true } },
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

// Support (mock payment)
app.post('/api/support-requests/:id/support', async (req, res) => {
  const { amount, supporterId } = req.body;
  const supportRequestId = parseInt(req.params.id);
  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found.' });

    const support = await prisma.support.create({
      data: {
        supportRequestId,
        supporterId: supporterId || 2,
        amount: parseFloat(amount),
        status: 'SUCCESS',
        transactionId: `mock_tx_${Date.now()}`
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

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required.' });
  try {
    const totalAthletes = await prisma.athleteProfile.count();
    const activeRequests = await prisma.supportRequest.count({ where: { lifecycleStatus: 'ACTIVE' } });
    const totalUsers = await prisma.user.count();
    const pendingVerifications = await prisma.achievement.findMany({
      where: { verificationStatus: 'PENDING_REVIEW' },
      include: { athlete: { include: { user: { select: { name: true } } } } }
    });
    res.json({ totalAthletes, activeRequests, totalUsers, pendingVerifications });
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

app.listen(PORT, () => {
  console.log(`✅ SportSphere API running on http://localhost:${PORT}`);
});
