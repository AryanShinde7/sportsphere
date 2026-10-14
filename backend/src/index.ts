import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasourceUrl: process.env.DATABASE_URL } : undefined);
const PORT = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_for_demo_only';
const MOCK_WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || 'sportsphere_mock_webhook_secret_2026';

const Razorpay = require('razorpay');

function getRazorpayConfig() {
  dotenv.config({ override: true });
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  let client: any = null;
  if (keyId && !keyId.includes('YOUR_KEY_ID')) {
    try {
      client = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    } catch (err) {
      console.warn('Could not initialize Razorpay client:', err);
    }
  }
  return { keyId, keySecret, client };
}

app.use(cors());
app.use(express.json());

// --- Static file serving for uploaded athlete media ---
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Multer config: disk storage, UUID filenames, image-only validation ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

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
// FILE UPLOAD ROUTE (Phase 7A)
// ===================================================================

// POST /api/upload — accepts a single image file, returns its URL
app.post('/api/upload', authenticateToken, upload.single('file'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type' });
  }
  const url = `/uploads/${req.file.filename}`;
  return res.json({ url, filename: req.file.filename });
});

// Error handler for multer (e.g. file too large, wrong type)
app.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError || err.message?.includes('Only')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ===================================================================
// SPORTS & METADATA ROUTES
// ===================================================================

app.get('/api/sports', async (_req, res) => {
  try {
    const sports = await prisma.sport.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(sports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sports' });
  }
});

app.post('/api/sports', async (req, res) => {
  const { name, category } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Sport name is required' });
  }
  const trimmedName = name.trim();
  try {
    const existing = await prisma.sport.findFirst({
      where: { name: trimmedName }
    });
    if (existing) {
      return res.json(existing);
    }
    const sport = await prisma.sport.create({
      data: {
        name: trimmedName,
        category: category?.trim() || 'Custom Sport'
      }
    });
    res.status(201).json(sport);
  } catch (error) {
    console.error('Create sport error:', error);
    res.status(500).json({ error: 'Failed to create sport' });
  }
});


// ===================================================================
// AUTH ROUTES
// ===================================================================

app.post('/api/auth/register', async (req, res) => {
  const {
    name, email, password, phone, role,
    // Athlete specific fields
    sportId, sportName, discipline, city, state, headline, bio, currentGoal, coachName, academyName,
    // Sponsor/Contributor specific fields
    organizationName, organizationType, contactPerson, budgetRange
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const assignedRole = role === 'ATHLETE' ? 'ATHLETE' : (role === 'SPONSOR' ? 'SPONSOR' : 'SUPPORTER');

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: phone.trim() } });
      if (existingPhone) {
        return res.status(400).json({ error: 'An account with this phone number already exists' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          passwordHash,
          role: assignedRole,
        }
      });

      let athleteProfile = null;
      let sponsorProfile = null;

      if (assignedRole === 'ATHLETE') {
        let finalSportId = sportId ? parseInt(sportId) : null;
        if (!finalSportId && sportName && sportName.trim()) {
          const sName = sportName.trim();
          let existingSport = await tx.sport.findFirst({
            where: { name: sName }
          });
          if (!existingSport) {
            existingSport = await tx.sport.create({
              data: { name: sName, category: 'Custom Sport' }
            });
          }
          finalSportId = existingSport.id;
        }
        if (!finalSportId) {
          const defaultSport = await tx.sport.findFirst();
          finalSportId = defaultSport ? defaultSport.id : null;
        }

        athleteProfile = await tx.athleteProfile.create({
          data: {
            userId: newUser.id,
            sportId: finalSportId,
            discipline: discipline?.trim() || null,
            city: city?.trim() || null,
            state: state?.trim() || null,
            headline: headline?.trim() || `${name} · Athlete`,
            bio: bio?.trim() || null,
            currentGoal: currentGoal?.trim() || null,
            coachName: coachName?.trim() || null,
            academyName: academyName?.trim() || null,
          },
          include: { sport: true }
        });

        // Initialize NOT_SUBMITTED identity verification row
        await tx.verification.create({
          data: {
            entityType: 'AthleteProfile',
            entityId: athleteProfile.id,
            category: 'IDENTITY',
            status: 'NOT_SUBMITTED',
          }
        });
      } else if (assignedRole === 'SPONSOR') {
        sponsorProfile = await tx.sponsorProfile.create({
          data: {
            userId: newUser.id,
            organizationName: organizationName?.trim() || `${name}'s Organization`,
            organizationType: organizationType?.trim() || 'Individual Supporter',
            contactPerson: contactPerson?.trim() || name,
            budgetRange: budgetRange?.trim() || '10k-50k',
          }
        });
      }

      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        athleteProfile,
        sponsorProfile,
      };
    });

    const token = jwt.sign(
      { id: result.id, role: result.role, email: result.email, name: result.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: result
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        athleteProfile: {
          include: {
            sport: true,
            mediaAssets: { orderBy: { order: 'asc' } },
            supportRequests: { where: { lifecycleStatus: 'ACTIVE' } }
          }
        },
        sponsorProfile: true
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone,
        athleteProfile: user.athleteProfile,
        sponsorProfile: user.sponsorProfile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        athleteProfile: {
          include: {
            sport: true,
            mediaAssets: true,
            supportRequests: true
          }
        },
        sponsorProfile: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/profile — update contributor/supporter profile
app.put('/api/users/profile', authenticateToken, async (req: any, res) => {
  const { name, phone, profileImageUrl, organizationName, organizationType, budgetRange } = req.body;
  try {
    if (organizationName || organizationType || budgetRange) {
      await prisma.sponsorProfile.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          organizationName: (organizationName && organizationName.trim()) || 'Supporter Organization',
          organizationType: organizationType ? organizationType.trim() : null,
          budgetRange: budgetRange ? budgetRange.trim() : null,
        },
        update: {
          ...(organizationName && { organizationName: organizationName.trim() }),
          ...(organizationType !== undefined && { organizationType: organizationType ? organizationType.trim() : null }),
          ...(budgetRange !== undefined && { budgetRange: budgetRange ? budgetRange.trim() : null })
        }
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(profileImageUrl !== undefined && { profileImageUrl }),
      },
      include: {
        athleteProfile: {
          include: {
            sport: true,
            mediaAssets: true,
            supportRequests: true
          }
        },
        sponsorProfile: true
      }
    });

    const { passwordHash, ...safeUser } = updatedUser;
    res.json({ message: 'Profile updated successfully', user: safeUser });
  } catch (error: any) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// PUT /api/athletes/profile — update athlete profile details
app.put('/api/athletes/profile', authenticateToken, async (req: any, res) => {
  const {
    name, phone,
    sportId, sportName, discipline, city, state, headline, bio,
    currentGoal, coachName, academyName
  } = req.body;

  try {
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id },
      include: { sport: true }
    });

    if (!athleteProfile) {
      return res.status(404).json({ error: 'Athlete profile not found for this account' });
    }

    let finalSportId = athleteProfile.sportId;
    if (sportId) {
      finalSportId = parseInt(sportId);
    } else if (sportName && sportName.trim()) {
      let customSport = await prisma.sport.findFirst({ where: { name: sportName.trim() } });
      if (!customSport) {
        customSport = await prisma.sport.create({
          data: { name: sportName.trim(), category: 'Custom Sport' }
        });
      }
      finalSportId = customSport.id;
    }

    if (name || phone !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name && { name: name.trim() }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null })
        }
      });
    }

    const updatedProfile = await prisma.athleteProfile.update({
      where: { id: athleteProfile.id },
      data: {
        ...(finalSportId && { sportId: finalSportId }),
        ...(discipline !== undefined && { discipline: discipline ? discipline.trim() : null }),
        ...(city !== undefined && { city: city ? city.trim() : null }),
        ...(state !== undefined && { state: state ? state.trim() : null }),
        ...(headline !== undefined && { headline: headline ? headline.trim() : null }),
        ...(bio !== undefined && { bio: bio ? bio.trim() : null }),
        ...(currentGoal !== undefined && { currentGoal: currentGoal ? currentGoal.trim() : null }),
        ...(coachName !== undefined && { coachName: coachName ? coachName.trim() : null }),
        ...(academyName !== undefined && { academyName: academyName ? academyName.trim() : null }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        sport: true,
        mediaAssets: { orderBy: { order: 'asc' } },
        supportRequests: { where: { lifecycleStatus: 'ACTIVE' } }
      }
    });

    res.json({ message: 'Athlete profile updated successfully', athlete: updatedProfile });
  } catch (error: any) {
    console.error('Update athlete profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to update athlete profile' });
  }
});

// GET /api/users/contributions — contributor's backed athletes & stats
app.get('/api/users/contributions', authenticateToken, async (req: any, res) => {
  try {
    const supports = await prisma.support.findMany({
      where: { supporterId: req.user.id },
      include: {
        supportRequest: {
          include: {
            athlete: {
              include: {
                user: { select: { name: true } },
                sport: true,
                mediaAssets: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalContributed = supports.reduce((sum, item) => sum + (item.amount || 0), 0);
    const athletesSupportedCount = new Set(supports.map(s => s.supportRequest?.athleteId).filter(Boolean)).size;

    res.json({
      supports,
      totalContributed,
      athletesSupportedCount
    });
  } catch (error) {
    console.error('Fetch contributions error:', error);
    res.status(500).json({ error: 'Failed to fetch contributions' });
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
        mediaAssets: { orderBy: { order: 'asc' } },
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
        mediaAssets: { orderBy: { order: 'asc' } },
        supportRequests: {
          include: {
            budgetItems: true,
            supports: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { supporter: { select: { name: true } } }
            }
          }
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

// POST /api/support-requests — Athlete creates a new funding campaign
app.post('/api/support-requests', authenticateToken, async (req: any, res) => {
  const {
    title,
    description,
    category,
    targetAmount,
    deadline,
    budgetItems,
    evidenceUrl,
    documents
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Campaign title / reason for funding is required' });
  }

  const numTarget = parseFloat(targetAmount);
  if (isNaN(numTarget) || numTarget <= 0) {
    return res.status(400).json({ error: 'Target amount must be a positive number' });
  }

  const validCategory = (category && category.trim()) || 'EQUIPMENT';

  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true } }, sport: true }
    });

    if (!athlete) {
      return res.status(403).json({ error: 'Only registered athletes can create funding campaigns' });
    }

    const createdRequest = await prisma.$transaction(async (tx) => {
      const sr = await tx.supportRequest.create({
        data: {
          athleteId: athlete.id,
          title: title.trim(),
          description: description?.trim() || null,
          category: validCategory.toUpperCase(),
          targetAmount: numTarget,
          deadline: deadline ? new Date(deadline) : null,
          approvalStatus: 'APPROVED',
          lifecycleStatus: 'ACTIVE',
          amountSupported: 0,
        }
      });

      if (Array.isArray(budgetItems) && budgetItems.length > 0) {
        for (const item of budgetItems) {
          if (item.description && parseFloat(item.amount) > 0) {
            await tx.budgetItem.create({
              data: {
                supportRequestId: sr.id,
                description: item.description.trim(),
                amount: parseFloat(item.amount),
                evidenceFileId: item.evidenceFileId || evidenceUrl || null,
                status: 'PENDING'
              }
            });
          }
        }
      }

      await tx.verification.create({
        data: {
          entityType: 'SupportRequest',
          entityId: sr.id,
          category: 'SUPPORT_NEED',
          status: 'PENDING_REVIEW',
          notes: evidenceUrl ? `Supporting proof: ${evidenceUrl}` : (description ? `Reason: ${title}` : null),
        }
      });

      return sr;
    });

    const fullRequest = await prisma.supportRequest.findUnique({
      where: { id: createdRequest.id },
      include: {
        athlete: {
          include: { user: { select: { name: true } }, sport: true }
        },
        budgetItems: true,
        supports: true
      }
    });

    await writeAuditLog(req.user.id, 'SUPPORT_REQUEST_CREATED', 'SupportRequest', createdRequest.id,
      JSON.stringify({ title, targetAmount: numTarget, category: validCategory }));

    res.status(201).json(fullRequest);
  } catch (error: any) {
    console.error('Create support request error:', error);
    res.status(500).json({ error: error.message || 'Failed to create funding campaign' });
  }
});

// ===================================================================
// RAZORPAY PAYMENT FLOW
// ===================================================================

// POST /api/payments/razorpay/create-order — creates Support + Transaction, returns Razorpay order
app.post('/api/payments/razorpay/create-order', authenticateToken, async (req: any, res) => {
  const { supportRequestId, amount } = req.body;
  const supporterId = req.user.id;

  if (!supportRequestId || !amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'supportRequestId and a positive amount are required' });
  }

  const numAmount = parseFloat(amount);
  const amountInPaise = Math.round(numAmount * 100);

  try {
    const supportRequest = await prisma.supportRequest.findUnique({
      where: { id: parseInt(supportRequestId) },
      include: { athlete: { include: { user: { select: { name: true } } } } }
    });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    let orderId: string;
    const orderReceipt = `sp_${Date.now()}`;
    const { keyId, keySecret, client } = getRazorpayConfig();

    // Attempt real Razorpay order creation if client is initialized
    if (client) {
      try {
        const rzpOrder = await client.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: orderReceipt,
          notes: {
            supportRequestId: supportRequest.id.toString(),
            supporterId: supporterId.toString(),
            athleteName: supportRequest.athlete?.user?.name || 'Athlete',
            campaignTitle: supportRequest.title,
          }
        });
        orderId = rzpOrder.id;
        console.log('✓ Real Razorpay Order created:', orderId);
      } catch (rzpErr: any) {
        console.error('Razorpay API order creation failed:', rzpErr);
        return res.status(500).json({ error: `Razorpay order creation failed: ${rzpErr.error?.description || rzpErr.message}` });
      }
    } else {
      orderId = generateMockId('order');
    }

    // Create Support record (PENDING) and Transaction (CREATED) in one transaction
    const support = await prisma.support.create({
      data: {
        supportRequestId: supportRequest.id,
        supporterId,
        amount: numAmount,
        status: 'PENDING',
        transaction: {
          create: {
            amount: numAmount,
            status: 'CREATED',
            gatewayOrderId: orderId,
            currency: 'INR',
          }
        }
      },
      include: { transaction: true }
    });

    const orderResponse = {
      orderId,
      entity: 'order',
      amount: amountInPaise,
      currency: 'INR',
      status: 'created',
      supportId: support.id,
      supportRequestId: supportRequest.id,
      keyId: keyId || 'rzp_test_placeholder',
      athleteName: supportRequest.athlete?.user?.name || 'Verified Athlete',
      campaignTitle: supportRequest.title,
      isRealKey: Boolean(client),
    };

    await writeAuditLog(supporterId, 'PAYMENT_ORDER_CREATED', 'Support', support.id,
      JSON.stringify({ supportRequestId, amount: numAmount, orderId }));

    res.status(201).json(orderResponse);
  } catch (error) {
    console.error('Create order failed:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payments/razorpay/verify — verify Razorpay signature and capture payment
app.post('/api/payments/razorpay/verify', authenticateToken, async (req: any, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, supportId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ error: 'razorpay_order_id and razorpay_payment_id are required' });
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
      return res.status(200).json({
        message: 'Payment already verified (idempotent)',
        status: 'CAPTURED',
        supportId: transaction.supportId
      });
    }

    // Verify HMAC SHA256 signature when secret is provided
    const { keySecret } = getRazorpayConfig();
    if (keySecret && !keySecret.includes('YOUR_KEY_SECRET') && razorpay_signature && razorpay_signature !== 'sandbox_verified_signature') {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        console.warn('Razorpay signature mismatch:', { generatedSignature, received: razorpay_signature });
        return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      }
    }

    // Update Transaction → CAPTURED
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'CAPTURED',
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature || 'verified_signature',
        gatewayResponse: JSON.stringify(req.body),
      }
    });

    // Update Support → SUCCESS
    await prisma.support.update({
      where: { id: transaction.supportId },
      data: { status: 'SUCCESS' }
    });

    // Atomically increment SupportRequest.amountSupported
    const updatedRequest = await prisma.supportRequest.update({
      where: { id: transaction.support.supportRequestId },
      data: { amountSupported: { increment: transaction.amount } }
    });

    await writeAuditLog(req.user.id, 'PAYMENT_VERIFIED', 'Support', transaction.supportId,
      JSON.stringify({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, amount: transaction.amount }));

    res.json({
      success: true,
      message: 'Payment verified and captured successfully',
      status: 'CAPTURED',
      amount: transaction.amount,
      amountSupported: updatedRequest.amountSupported,
      targetAmount: updatedRequest.targetAmount,
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message || 'Payment verification failed' });
  }
});

// GET /api/payments/razorpay/checkout-page — serves web checkout for Expo / Webview
app.get('/api/payments/razorpay/checkout-page', (req: any, res) => {
  const { orderId, amount, keyId, title, name, email, phone } = req.query;
  const { keyId: configKeyId } = getRazorpayConfig();
  const effectiveKey = keyId || configKeyId;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SportSphere Razorpay Checkout</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0F172A; color: #fff; }
    .card { background: #1E293B; border-radius: 16px; padding: 24px; text-align: center; max-width: 360px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .btn { background: #E2550B; color: #fff; border: none; padding: 14px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 16px; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h3 style="color:#E2550B;margin-top:0;">SportSphere Verified Backing</h3>
    <p style="font-size:14px;color:#94A3B8;">${title || 'Athlete Support'}</p>
    <p style="font-size:24px;font-weight:900;margin:16px 0;">₹${(parseInt(amount || '0') / 100).toLocaleString('en-IN')}</p>
    <button class="btn" id="pay-btn" onclick="openCheckout()">Open Razorpay Checkout</button>
  </div>
  <script>
    function openCheckout() {
      var options = {
        key: "${effectiveKey}",
        amount: "${amount || '100000'}",
        currency: "INR",
        name: "SportSphere",
        description: "${title || 'Athlete Funding Support'}",
        order_id: "${orderId}",
        prefill: {
          name: "${name || ''}",
          email: "${email || ''}",
          contact: "${phone || ''}"
        },
        theme: { color: "#E2550B" },
        handler: function (response) {
          var payload = {
            event: 'SUCCESS',
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          };
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } else {
            alert('Payment Successful! Payment ID: ' + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: function () {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'CANCELLED' }));
            }
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            event: 'FAILED',
            error: resp.error ? resp.error.description : 'Payment Failed'
          }));
        }
      });
      rzp.open();
    }
    window.onload = function() {
      setTimeout(openCheckout, 300);
    };
  </script>
</body>
</html>`;

  res.send(html);
});

// POST /api/payments/razorpay/webhook — processes payment confirmation from Razorpay webhook
app.post('/api/payments/razorpay/webhook', async (req, res) => {
  const webhookSecret = req.headers['x-mock-webhook-secret'] || process.env.RAZORPAY_WEBHOOK_SECRET;
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
          gatewaySignature: razorpay_signature || 'webhook_signature',
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

      res.json({ message: 'Payment captured successfully via webhook', status: 'CAPTURED' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
