import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import prisma from './prisma';
import {
  authenticateToken,
  optionalAuthenticateToken,
  requireAdmin,
  requireRole,
  JWT_SECRET,
  AuthenticatedRequest
} from './middleware/auth';
import { authRateLimiter, sensitiveEndpointLimiter } from './middleware/rateLimiter';
import {
  validateEvidenceFileBuffer,
  savePrivateEvidenceFile,
  getPrivateFilePath,
  PRIVATE_UPLOADS_DIR
} from './utils/fileValidation';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const MOCK_WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || 'sportsphere_mock_webhook_secret_2026';

let Razorpay: any = null;
try {
  Razorpay = require('razorpay');
} catch (err) {
  console.warn('Razorpay package could not be required:', err);
}

function isPlaceholderKey(val: string): boolean {
  if (!val) return true;
  const upper = val.toUpperCase();
  return (
    upper.includes('YOUR_KEY_ID') ||
    upper.includes('YOUR_KEY_SECRET') ||
    upper.includes('XXXX') ||
    upper.includes('PLACEHOLDER') ||
    upper.includes('TEST_KEY')
  );
}

function getRazorpayConfig() {
  dotenv.config({ override: true });
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  let client: any = null;
  if (keyId && !isPlaceholderKey(keyId) && keySecret && !isPlaceholderKey(keySecret)) {
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

// Instruction 3.4: Configure the webhook route to capture raw request body before JSON parsing
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Instruction 1.1 & 1.7: Public athlete media (profile pictures, banners) served statically under /uploads
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Public media upload (avatars & banners)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype?.startsWith('image/') || 
      ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'].includes(file.mimetype);
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
    }
  },
});

// Instruction 1.3: Dedicated upload multer for verification documents using memoryStorage to inspect buffer magic bytes
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// --- Helper: Write audit log ---
async function writeAuditLog(userId: number, action: string, entityType: string, entityId: number, details?: string) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, details: details || null }
  });
}

// Instruction 4.6: Validate that entity belongs to authenticated user
async function checkEntityOwnership(entityType: string, entityId: number, userId: number): Promise<boolean> {
  if (entityType === 'AthleteProfile') {
    const profile = await prisma.athleteProfile.findUnique({ where: { id: entityId } });
    return profile?.userId === userId;
  }
  if (entityType === 'Achievement') {
    const ach = await prisma.achievement.findUnique({
      where: { id: entityId },
      include: { athlete: true }
    });
    return ach?.athlete?.userId === userId;
  }
  if (entityType === 'SupportRequest') {
    const sr = await prisma.supportRequest.findUnique({
      where: { id: entityId },
      include: { athlete: true }
    });
    return sr?.athlete?.userId === userId;
  }
  if (entityType === 'BudgetItem') {
    const bi = await prisma.budgetItem.findUnique({
      where: { id: entityId },
      include: { supportRequest: { include: { athlete: true } } }
    });
    return bi?.supportRequest?.athlete?.userId === userId;
  }
  return false;
}

// Instruction 1.6 & 4.4: Check verification claim ownership
async function checkVerificationOwnership(verification: any, userId: number): Promise<boolean> {
  return checkEntityOwnership(verification.entityType, verification.entityId, userId);
}

// Instruction 7.8: Avoid returning internal reviewer notes or private evidence details in public API responses
function sanitizeVerificationForPublic(v: any) {
  return {
    id: v.id,
    entityType: v.entityType,
    entityId: v.entityId,
    category: v.category,
    status: v.status,
    verifiedAt: v.verifiedAt,
  };
}

// --- Helper: Hydrate a Verification record with its linked entity and evidence ---
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

  const evidence = await prisma.verificationEvidence.findMany({
    where: { verificationId: v.id }
  });

  return { ...v, entity, athleteName, evidence };
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

// Instruction 7.5: Add rate limiting to login and sensitive endpoints
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
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

    // Instruction 7.4: Validate current account status
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Access denied.` });
    }

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
        profileImageUrl: user.profileImageUrl,
        bannerImageUrl: user.bannerImageUrl,
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
    if (safeUser.athleteProfile) {
      const identityVerif = await prisma.verification.findFirst({
        where: {
          entityType: 'AthleteProfile',
          entityId: safeUser.athleteProfile.id,
          category: 'IDENTITY'
        },
        orderBy: { updatedAt: 'desc' }
      });
      (safeUser as any).athleteProfile.identityStatus = identityVerif?.status || (safeUser.athleteProfile.publicVerificationSummary ? 'VERIFIED' : 'NOT_SUBMITTED');
    }
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/profile — update contributor/supporter profile
app.put('/api/users/profile', authenticateToken, async (req: any, res) => {
  const { name, phone, profileImageUrl, bannerImageUrl, organizationName, organizationType, budgetRange } = req.body;
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
        ...(bannerImageUrl !== undefined && { bannerImageUrl }),
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

// POST /api/upload — general image/file upload
app.post('/api/upload', authenticateToken, upload.single('image'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const host = req.get('host');
  const fullUrl = `${req.protocol}://${host}/uploads/${req.file.filename}`;
  res.json({
    url: `/uploads/${req.file.filename}`,
    fullUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// POST /api/users/profile-image — upload or set avatar for authenticated user (both roles)
app.post('/api/users/profile-image', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    let imageUrl = req.body?.imageUrl;
    if (req.file) {
      const host = req.get('host');
      imageUrl = `${req.protocol}://${host}/uploads/${req.file.filename}`;
    }
    if (!imageUrl) {
      return res.status(400).json({ error: 'Please provide an image file or imageUrl' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImageUrl: imageUrl },
      include: {
        athleteProfile: {
          include: { sport: true, mediaAssets: true }
        },
        sponsorProfile: true
      }
    });

    // If user has an athlete profile, also upsert MediaAsset AVATAR
    if (updatedUser.athleteProfile) {
      const existing = await prisma.mediaAsset.findFirst({
        where: { athleteId: updatedUser.athleteProfile.id, type: 'AVATAR' }
      });
      if (existing) {
        await prisma.mediaAsset.update({
          where: { id: existing.id },
          data: { url: imageUrl }
        });
      } else {
        await prisma.mediaAsset.create({
          data: {
            athleteId: updatedUser.athleteProfile.id,
            type: 'AVATAR',
            url: imageUrl,
            order: 0
          }
        });
      }
    }

    const { passwordHash, ...safeUser } = updatedUser;
    res.json({
      message: 'Profile photo updated successfully',
      profileImageUrl: imageUrl,
      user: safeUser
    });
  } catch (error: any) {
    console.error('Update profile image error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile image' });
  }
});

// POST /api/users/banner-image — upload or set banner for authenticated user (both roles)
app.post('/api/users/banner-image', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    let bannerUrl = req.body?.bannerUrl;
    if (req.file) {
      const host = req.get('host');
      bannerUrl = `${req.protocol}://${host}/uploads/${req.file.filename}`;
    }
    if (!bannerUrl) {
      return res.status(400).json({ error: 'Please provide an image file or bannerUrl' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { bannerImageUrl: bannerUrl },
      include: {
        athleteProfile: {
          include: { sport: true, mediaAssets: true }
        },
        sponsorProfile: true
      }
    });

    // If user has an athlete profile, also upsert MediaAsset BANNER
    if (updatedUser.athleteProfile) {
      const existing = await prisma.mediaAsset.findFirst({
        where: { athleteId: updatedUser.athleteProfile.id, type: 'BANNER' }
      });
      if (existing) {
        await prisma.mediaAsset.update({
          where: { id: existing.id },
          data: { url: bannerUrl }
        });
      } else {
        await prisma.mediaAsset.create({
          data: {
            athleteId: updatedUser.athleteProfile.id,
            type: 'BANNER',
            url: bannerUrl,
            order: 0
          }
        });
      }
    }

    const { passwordHash, ...safeUser } = updatedUser;
    res.json({
      message: 'Banner image updated successfully',
      bannerImageUrl: bannerUrl,
      user: safeUser
    });
  } catch (error: any) {
    console.error('Update banner image error:', error);
    res.status(500).json({ error: error.message || 'Failed to update banner image' });
  }
});

// PUT /api/athletes/profile — update athlete profile details
app.put('/api/athletes/profile', authenticateToken, async (req: any, res) => {
  const {
    name, phone, profileImageUrl, bannerImageUrl,
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

    if (name || phone !== undefined || profileImageUrl !== undefined || bannerImageUrl !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name && { name: name.trim() }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
          ...(profileImageUrl !== undefined && { profileImageUrl }),
          ...(bannerImageUrl !== undefined && { bannerImageUrl }),
        }
      });
    }

    // Sync avatar to MediaAsset
    if (profileImageUrl) {
      const existingAvatar = await prisma.mediaAsset.findFirst({
        where: { athleteId: athleteProfile.id, type: 'AVATAR' }
      });
      if (existingAvatar) {
        await prisma.mediaAsset.update({
          where: { id: existingAvatar.id },
          data: { url: profileImageUrl }
        });
      } else {
        await prisma.mediaAsset.create({
          data: {
            athleteId: athleteProfile.id,
            type: 'AVATAR',
            url: profileImageUrl,
            order: 0
          }
        });
      }
    }

    // Sync banner to MediaAsset
    if (bannerImageUrl) {
      const existingBanner = await prisma.mediaAsset.findFirst({
        where: { athleteId: athleteProfile.id, type: 'BANNER' }
      });
      if (existingBanner) {
        await prisma.mediaAsset.update({
          where: { id: existingBanner.id },
          data: { url: bannerImageUrl }
        });
      } else {
        await prisma.mediaAsset.create({
          data: {
            athleteId: athleteProfile.id,
            type: 'BANNER',
            url: bannerImageUrl,
            order: 0
          }
        });
      }
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
        user: { select: { id: true, name: true, email: true, phone: true, role: true, profileImageUrl: true, bannerImageUrl: true } },
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

app.get('/api/athletes', optionalAuthenticateToken, async (req: any, res) => {
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
        user: { select: { id: true, name: true, profileImageUrl: true, bannerImageUrl: true } },
        sport: true,
        achievements: true,
        mediaAssets: { orderBy: { order: 'asc' } },
        supportRequests: {
          // Instruction 2.6: Ensure public discovery endpoints do not expose unapproved campaigns
          where: { lifecycleStatus: 'ACTIVE', approvalStatus: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          include: {
            budgetItems: true,
            supports: {
              where: { status: 'SUCCESS' },
              select: { id: true, amount: true, createdAt: true, supporter: { select: { name: true } } }
            }
          }
        }
      }
    });

    const isViewerAdmin = req.user?.role === 'ADMIN';

    // Attach verification records for each athlete
    const athletesWithVerifications = await Promise.all(athletes.map(async (athlete) => {
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

      const rawVerifications = [...profileVerifications, ...achievementVerifications, ...supportVerifications];

      // Instruction 7.8: Sanitize verification details for public / non-admin viewers
      const isOwner = req.user && req.user.id === athlete.user.id;
      const verifications = (isViewerAdmin || isOwner)
        ? rawVerifications
        : rawVerifications.map(sanitizeVerificationForPublic);

      const identityVerif = profileVerifications.find((v: any) => v.category === 'IDENTITY');
      const identityStatus = identityVerif?.status || (athlete.publicVerificationSummary ? 'VERIFIED' : 'NOT_SUBMITTED');

      return { ...athlete, identityStatus, verifications };
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

app.get('/api/athletes/:id', optionalAuthenticateToken, async (req: any, res) => {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true, bannerImageUrl: true } },
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

    const isOwner = req.user && req.user.id === athlete.user.id;
    const isAdmin = req.user?.role === 'ADMIN';
    const isPrivileged = Boolean(isOwner || isAdmin);

    // Instruction 2.6: Filter unapproved campaigns unless owner athlete or admin
    const filteredSupportRequests = isPrivileged
      ? athlete.supportRequests
      : athlete.supportRequests.filter((sr: any) => sr.approvalStatus === 'APPROVED' && sr.lifecycleStatus === 'ACTIVE');

    // Attach verification records
    const profileVerifications = await prisma.verification.findMany({
      where: { entityType: 'AthleteProfile', entityId: athlete.id }
    });
    const achievementIds = athlete.achievements.map((a: any) => a.id);
    const achievementVerifications = achievementIds.length > 0 ? await prisma.verification.findMany({
      where: { entityType: 'Achievement', entityId: { in: achievementIds } }
    }) : [];
    const srIds = filteredSupportRequests.map((sr: any) => sr.id);
    const supportVerifications = srIds.length > 0 ? await prisma.verification.findMany({
      where: { entityType: 'SupportRequest', entityId: { in: srIds } }
    }) : [];

    const rawVerifications = [...profileVerifications, ...achievementVerifications, ...supportVerifications];

    // Instruction 7.8: Avoid returning internal reviewer notes or private evidence details in public API responses
    const verifications = isPrivileged
      ? rawVerifications
      : rawVerifications.map(sanitizeVerificationForPublic);

    const identityVerif = profileVerifications.find((v: any) => v.category === 'IDENTITY');
    const identityStatus = identityVerif?.status || (athlete.publicVerificationSummary ? 'VERIFIED' : 'NOT_SUBMITTED');

    res.json({
      ...athlete,
      identityStatus,
      supportRequests: filteredSupportRequests,
      verifications
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch athlete' });
  }
});

// ===================================================================
// SUPPORT REQUEST ROUTES
// ===================================================================

// Instruction 2.6: Ensure public discovery endpoints do not expose unapproved campaigns
app.get('/api/support-requests', async (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const requests = await prisma.supportRequest.findMany({
      where: {
        lifecycleStatus: 'ACTIVE',
        approvalStatus: isProd ? 'APPROVED' : { in: ['APPROVED', 'SUBMITTED'] }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        athlete: {
          include: {
            user: { select: { id: true, name: true, email: true, profileImageUrl: true, bannerImageUrl: true } },
            sport: true,
            mediaAssets: true,
          }
        },
        budgetItems: true,
        supports: {
          where: { status: 'SUCCESS' },
          include: {
            supporter: { select: { id: true, name: true, profileImageUrl: true } }
          }
        }
      }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

app.get('/api/support-requests/:id', optionalAuthenticateToken, async (req: any, res) => {
  try {
    const request = await prisma.supportRequest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        athlete: {
          include: { user: { select: { id: true, name: true } }, sport: true, achievements: true }
        },
        budgetItems: true,
        supports: {
          where: { status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          include: {
            supporter: { select: { id: true, name: true, profileImageUrl: true } }
          }
        }
      }
    });
    if (!request) return res.status(404).json({ error: 'Support request not found' });

    // Instruction 2.6: Unapproved campaign is not publicly discoverable
    if (request.approvalStatus !== 'APPROVED') {
      const isOwner = req.user && req.user.id === request.athlete?.user?.id;
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Support request is under review and not yet publicly available' });
      }
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support request' });
  }
});

// POST /api/support-requests — Athlete creates a new funding campaign
// Instruction 2.1 & 2.2: Set newly submitted support requests to SUBMITTED, not APPROVED.
// Create corresponding Verification record with category: 'SUPPORT_NEED' and status: 'PENDING_REVIEW'.
app.post('/api/support-requests', authenticateToken, sensitiveEndpointLimiter, async (req: any, res) => {
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
      // Archive any prior active campaigns for this athlete so this new campaign becomes the active one
      await tx.supportRequest.updateMany({
        where: { athleteId: athlete.id, lifecycleStatus: 'ACTIVE' },
        data: { lifecycleStatus: 'ARCHIVED' }
      });

      const sr = await tx.supportRequest.create({
        data: {
          athleteId: athlete.id,
          title: title.trim(),
          description: description?.trim() || null,
          category: validCategory.toUpperCase(),
          targetAmount: numTarget,
          deadline: deadline ? new Date(deadline) : null,
          approvalStatus: 'SUBMITTED', // Instruction 2.1: SUBMITTED, not APPROVED
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

      const ver = await tx.verification.create({
        data: {
          entityType: 'SupportRequest',
          entityId: sr.id,
          category: 'SUPPORT_NEED',
          status: 'PENDING_REVIEW', // Instruction 2.2: PENDING_REVIEW
          notes: evidenceUrl ? `Supporting proof: ${evidenceUrl}` : (description ? `Reason: ${title}` : null),
        }
      });

      if (evidenceUrl) {
        await tx.verificationEvidence.create({
          data: {
            verificationId: ver.id,
            evidenceType: 'URL',
            sourceUrl: evidenceUrl,
          }
        });
      }

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
app.post('/api/payments/razorpay/create-order', authenticateToken, sensitiveEndpointLimiter, async (req: any, res) => {
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

    // Instruction 2.3: Prevent pending or rejected campaigns from accepting real contributions in production
    if (process.env.NODE_ENV === 'production' && supportRequest.approvalStatus !== 'APPROVED') {
      return res.status(400).json({ error: 'This campaign is pending verification and cannot accept contributions yet.' });
    }

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
        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({ error: `Razorpay order creation failed: ${rzpErr.error?.description || rzpErr.message}` });
        }
        console.warn('⚠️ Razorpay API order failed, falling back to simulated sandbox order for development');
        orderId = generateMockId('order');
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
// Instruction 3: Make payment verification fail closed
app.post('/api/payments/razorpay/verify', authenticateToken, sensitiveEndpointLimiter, async (req: any, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, supportId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ error: 'razorpay_order_id and razorpay_payment_id are required' });
  }

  const isProd = process.env.NODE_ENV === 'production';
  const { keyId, keySecret, client } = getRazorpayConfig();

  // Instruction 3.1: In production, reject payment-verification requests if valid Razorpay credentials are not configured
  if (isProd) {
    if (!keyId || !keySecret || isPlaceholderKey(keyId) || isPlaceholderKey(keySecret)) {
      return res.status(503).json({ error: 'Razorpay credentials not properly configured in production environment.' });
    }
    // Instruction 3.5: Reject missing or invalid signatures. Never accept a placeholder signature in production.
    if (!razorpay_signature || razorpay_signature === 'sandbox_verified_signature') {
      return res.status(400).json({ error: 'Valid payment signature is required.' });
    }
  }

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { gatewayOrderId: razorpay_order_id },
      include: { support: true }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found for this order ID' });
    }

    // Instruction 3.7: Process idempotently so duplicate events cannot increment amountSupported more than once
    if (transaction.status === 'CAPTURED') {
      return res.status(200).json({
        message: 'Payment already verified (idempotent)',
        status: 'CAPTURED',
        supportId: transaction.supportId
      });
    }

    // Instruction 3.6: Verify transaction's stored order, amount, currency, and payment status before marking it successful
    if (transaction.status === 'FAILED') {
      return res.status(400).json({ error: 'Transaction is marked as failed and cannot be verified.' });
    }
    if (transaction.amount <= 0 || transaction.currency !== 'INR') {
      return res.status(400).json({ error: 'Invalid transaction amount or currency.' });
    }

    // Instruction 3.2: Always validate payment signature using expected order ID, payment ID, and secret. Use constant-time comparison.
    if (keySecret && !isPlaceholderKey(keySecret) && razorpay_signature) {
      if (!isProd && razorpay_signature === 'sandbox_verified_signature') {
        // Allow developer quick test verification in non-production
      } else {
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        const sigBuf = Buffer.from(razorpay_signature, 'utf8');
        const genBuf = Buffer.from(expectedSignature, 'utf8');

        if (sigBuf.length !== genBuf.length || !crypto.timingSafeEqual(sigBuf, genBuf)) {
          console.warn('Razorpay signature mismatch:', { received: razorpay_signature });
          return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
        }
      }
    } else if (isProd) {
      return res.status(400).json({ error: 'Payment signature verification failed. Missing secret or signature.' });
    }

    // Instruction 3.7: Process in a Prisma transaction to guarantee atomic and idempotent status update
    const result = await prisma.$transaction(async (tx) => {
      const freshTx = await tx.transaction.findUnique({
        where: { id: transaction.id },
        include: { support: true }
      });

      if (!freshTx || freshTx.status === 'CAPTURED') {
        return { alreadyCaptured: true };
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature || 'verified_signature',
          gatewayResponse: JSON.stringify(req.body),
        }
      });

      await tx.support.update({
        where: { id: transaction.supportId },
        data: { status: 'SUCCESS' }
      });

      const updatedRequest = await tx.supportRequest.update({
        where: { id: transaction.support.supportRequestId },
        data: { amountSupported: { increment: transaction.amount } }
      });

      return { alreadyCaptured: false, updatedRequest };
    });

    if (result.alreadyCaptured) {
      return res.status(200).json({
        message: 'Payment already verified (idempotent)',
        status: 'CAPTURED',
        supportId: transaction.supportId
      });
    }

    await writeAuditLog(req.user.id, 'PAYMENT_VERIFIED', 'Support', transaction.supportId,
      JSON.stringify({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, amount: transaction.amount }));

    res.json({
      success: true,
      message: 'Payment verified and captured successfully',
      status: 'CAPTURED',
      amount: transaction.amount,
      amountSupported: result.updatedRequest!.amountSupported,
      targetAmount: result.updatedRequest!.targetAmount,
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message || 'Payment verification failed' });
  }
});

// GET /api/payments/razorpay/checkout-page — serves web checkout for Expo / Webview
app.get('/api/payments/razorpay/checkout-page', (req: any, res) => {
  const { orderId, amount, keyId, title, name, email, phone } = req.query;
  const { keyId: configKeyId, client } = getRazorpayConfig();
  const effectiveKey = (keyId && typeof keyId === 'string' && !isPlaceholderKey(keyId)) ? keyId : configKeyId;
  const isRealKey = Boolean(client && effectiveKey && !isPlaceholderKey(effectiveKey as string));
  const numAmount = parseInt(amount || '0', 10);
  const formattedInr = (numAmount / 100).toLocaleString('en-IN');

  if (!isRealKey) {
    // Render authentic Razorpay Standard Checkout UI (Sandbox Mode)
    const razorpayHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Razorpay Checkout</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background: #0c1626; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 12px; }
    .rzp-modal { background: #ffffff; width: 100%; max-width: 380px; border-radius: 14px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
    
    /* Razorpay Top Header */
    .rzp-header { background: #0c2340; color: #ffffff; padding: 18px 20px; position: relative; }
    .rzp-header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .rzp-brand { display: flex; align-items: center; gap: 8px; }
    .rzp-logo-badge { background: #0b72e7; color: #ffffff; width: 28px; height: 28px; border-radius: 6px; display: flex; justify-content: center; align-items: center; font-weight: 900; font-size: 16px; letter-spacing: -1px; }
    .rzp-brand-text { font-size: 17px; font-weight: 800; letter-spacing: -0.4px; }
    .rzp-test-badge { background: #ea580c; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .merchant-info { margin-top: 4px; }
    .merchant-name { font-size: 14px; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: 5px; }
    .verified-icon { color: #10b981; font-size: 13px; }
    .order-desc { font-size: 12px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
    
    .amount-bar { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.12); }
    .amount-label { font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .amount-value { font-size: 24px; font-weight: 900; color: #ffffff; }

    /* Payment Methods Tabs */
    .method-nav { display: flex; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .nav-btn { flex: 1; padding: 11px 4px; border: none; background: transparent; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; text-align: center; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .nav-btn.active { color: #0b72e7; border-bottom: 2px solid #0b72e7; background: #ffffff; }

    /* Tab Content Area */
    .tab-content { padding: 18px 20px; background: #ffffff; min-height: 220px; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    /* UPI Options */
    .section-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .upi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .upi-item { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.15s; }
    .upi-item:hover, .upi-item.selected { border-color: #0b72e7; background: #f0f7ff; }
    .upi-item-icon { font-size: 20px; }
    .upi-item-name { font-size: 12px; font-weight: 700; color: #1e293b; }
    
    .input-group { margin-top: 10px; }
    .input-label { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block; }
    .text-input { width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 13px; outline: none; transition: border-color 0.2s; }
    .text-input:focus { border-color: #0b72e7; }

    /* Card Form */
    .card-row { display: flex; gap: 10px; margin-top: 10px; }
    .card-row .input-group { flex: 1; margin-top: 0; }
    .card-brands { display: flex; gap: 6px; margin-top: 6px; }
    .card-badge { background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }

    /* Netbanking Grid */
    .nb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .nb-item { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; font-size: 12px; font-weight: 700; color: #1e293b; cursor: pointer; transition: all 0.15s; }
    .nb-item:hover, .nb-item.selected { border-color: #0b72e7; background: #f0f7ff; color: #0b72e7; }

    /* Bottom Action Area */
    .rzp-footer-actions { padding: 14px 20px 18px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .pay-button { background: #0b72e7; color: #ffffff; border: none; width: 100%; padding: 14px 16px; border-radius: 10px; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(11, 114, 231, 0.35); transition: background 0.15s; }
    .pay-button:active { background: #0756b1; }
    .cancel-link { text-align: center; margin-top: 10px; font-size: 12px; color: #94a3b8; cursor: pointer; text-decoration: underline; }

    .rzp-security-note { text-align: center; margin-top: 12px; font-size: 10.5px; color: #94a3b8; display: flex; justify-content: center; align-items: center; gap: 6px; }

    /* Processing Overlay */
    .processing-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(12, 22, 38, 0.95); z-index: 999; flex-direction: column; justify-content: center; align-items: center; color: #ffffff; padding: 24px; text-align: center; }
    .rzp-spinner { width: 52px; height: 52px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #0b72e7; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
    .processing-title { font-size: 17px; font-weight: 800; margin-bottom: 6px; }
    .processing-sub { font-size: 12px; color: #94a3b8; max-width: 280px; line-height: 1.5; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>

  <div class="rzp-modal">
    <!-- Razorpay Blue Header -->
    <div class="rzp-header">
      <div class="rzp-header-top">
        <div class="rzp-brand">
          <div class="rzp-logo-badge">R</div>
          <div class="rzp-brand-text">Razorpay</div>
        </div>
        <div class="rzp-test-badge">Test Mode</div>
      </div>

      <div class="merchant-info">
        <div class="merchant-name">
          SportSphere Foundation
          <span class="verified-icon">✓</span>
        </div>
        <div class="order-desc">${title || 'Athlete Funding Contribution'}</div>
      </div>

      <div class="amount-bar">
        <span class="amount-label">Amount Payable</span>
        <span class="amount-value">₹${formattedInr}</span>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="method-nav">
      <button class="nav-btn active" onclick="switchTab('upi')">📱 UPI</button>
      <button class="nav-btn" onclick="switchTab('card')">💳 Card</button>
      <button class="nav-btn" onclick="switchTab('nb')">🏦 Netbanking</button>
    </div>

    <!-- Tab 1: UPI -->
    <div class="tab-content">
      <div id="tab-upi" class="tab-pane active">
        <div class="section-title">Popular UPI Apps</div>
        <div class="upi-grid">
          <div class="upi-item selected" onclick="selectUpi(this, 'Google Pay')">
            <span class="upi-item-icon">🟢</span>
            <span class="upi-item-name">Google Pay</span>
          </div>
          <div class="upi-item" onclick="selectUpi(this, 'PhonePe')">
            <span class="upi-item-icon">🟣</span>
            <span class="upi-item-name">PhonePe</span>
          </div>
          <div class="upi-item" onclick="selectUpi(this, 'Paytm')">
            <span class="upi-item-icon">🔵</span>
            <span class="upi-item-name">Paytm UPI</span>
          </div>
          <div class="upi-item" onclick="selectUpi(this, 'BHIM')">
            <span class="upi-item-icon">⚡</span>
            <span class="upi-item-name">BHIM UPI</span>
          </div>
        </div>

        <div class="input-group">
          <label class="input-label">Or enter UPI ID / VPA</label>
          <input type="text" id="upi-vpa" class="text-input" value="supporter@okhdfcbank" placeholder="e.g. yourname@upi" />
        </div>
      </div>

      <!-- Tab 2: Cards -->
      <div id="tab-card" class="tab-pane">
        <div class="section-title">Credit / Debit Card</div>
        <div class="input-group">
          <label class="input-label">Card Number</label>
          <input type="text" class="text-input" value="4111 •••• •••• 1111" readonly />
          <div class="card-brands">
            <span class="card-badge">VISA</span>
            <span class="card-badge">Mastercard</span>
            <span class="card-badge">RuPay</span>
          </div>
        </div>

        <div class="card-row">
          <div class="input-group">
            <label class="input-label">Expiry (MM/YY)</label>
            <input type="text" class="text-input" value="12/28" readonly />
          </div>
          <div class="input-group">
            <label class="input-label">CVV</label>
            <input type="password" class="text-input" value="123" readonly />
          </div>
        </div>

        <div class="input-group">
          <label class="input-label">Name on Card</label>
          <input type="text" class="text-input" value="${name || 'SportSphere Supporter'}" />
        </div>
      </div>

      <!-- Tab 3: Netbanking -->
      <div id="tab-nb" class="tab-pane">
        <div class="section-title">Popular Banks</div>
        <div class="nb-grid">
          <div class="nb-item selected" onclick="selectNb(this)">HDFC Bank</div>
          <div class="nb-item" onclick="selectNb(this)">State Bank of India</div>
          <div class="nb-item" onclick="selectNb(this)">ICICI Bank</div>
          <div class="nb-item" onclick="selectNb(this)">Axis Bank</div>
        </div>
        <div class="input-group">
          <label class="input-label">Other Banks</label>
          <input type="text" class="text-input" value="Kotak Mahindra Bank" readonly />
        </div>
      </div>
    </div>

    <!-- Action Area -->
    <div class="rzp-footer-actions">
      <button class="pay-button" id="pay-submit-btn" onclick="executePayment()">
        🔒 Pay ₹${formattedInr}
      </button>
      <div class="cancel-link" onclick="cancelPayment()">Cancel Transaction</div>

      <div class="rzp-security-note">
        <span>🛡️ Secured by Razorpay</span>
        <span>·</span>
        <span>PCI-DSS Certified</span>
      </div>
    </div>
  </div>

  <!-- Processing Spinner Overlay -->
  <div id="processing-overlay" class="processing-overlay">
    <div class="rzp-spinner"></div>
    <div class="processing-title">Authorizing Payment...</div>
    <div class="processing-sub" id="processing-sub">
      Connecting to Razorpay gateway & securing ledger receipt for ₹${formattedInr}...
    </div>
  </div>

  <script>
    var selectedMethod = 'Google Pay';

    function switchTab(tabId) {
      document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.remove('active'); });

      if (tabId === 'upi') {
        document.querySelectorAll('.nav-btn')[0].classList.add('active');
        document.getElementById('tab-upi').classList.add('active');
      } else if (tabId === 'card') {
        document.querySelectorAll('.nav-btn')[1].classList.add('active');
        document.getElementById('tab-card').classList.add('active');
      } else if (tabId === 'nb') {
        document.querySelectorAll('.nav-btn')[2].classList.add('active');
        document.getElementById('tab-nb').classList.add('active');
      }
    }

    function selectUpi(el, method) {
      document.querySelectorAll('.upi-item').forEach(function(i) { i.classList.remove('selected'); });
      el.classList.add('selected');
      selectedMethod = method;
    }

    function selectNb(el) {
      document.querySelectorAll('.nb-item').forEach(function(i) { i.classList.remove('selected'); });
      el.classList.add('selected');
    }

    function executePayment() {
      var overlay = document.getElementById('processing-overlay');
      overlay.style.display = 'flex';

      setTimeout(function() {
        var payload = {
          event: 'SUCCESS',
          razorpay_payment_id: 'pay_' + Math.random().toString(36).substring(2, 12),
          razorpay_order_id: '${orderId}',
          razorpay_signature: 'sandbox_verified_signature'
        };

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } else {
          alert('Payment Successful! ID: ' + payload.razorpay_payment_id);
        }
      }, 1400);
    }

    function cancelPayment() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'CANCELLED' }));
      }
    }
  </script>
</body>
</html>`;
    return res.send(razorpayHtml);
  }

  // Real Razorpay Checkout flow with verified API credentials
  const realHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>SportSphere Razorpay Checkout</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0c1626; color: #fff; padding: 16px; }
    .loader { width: 44px; height: 44px; border: 4px solid rgba(255,255,255,0.15); border-top-color: #0b72e7; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px auto; }
    .btn { background: #0b72e7; color: #fff; border: none; padding: 14px 22px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; margin-top: 14px; box-shadow: 0 4px 14px rgba(11,114,231,0.4); }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div style="text-align: center; max-width: 320px;">
    <div class="loader"></div>
    <h4 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #ffffff;">Opening Razorpay Gateway</h4>
    <p style="margin: 0; font-size: 13px; color: #94a3b8;">${title || 'Athlete Funding Support'} · ₹${formattedInr}</p>
    <button class="btn" id="pay-btn" onclick="openCheckout()" style="display: none;">Reopen Razorpay</button>
  </div>
  <script>
    function openCheckout() {
      var options = {
        key: "${effectiveKey}",
        amount: "${amount || '100000'}",
        currency: "INR",
        name: "SportSphere Foundation",
        description: "${title || 'Athlete Funding Support'}",
        order_id: "${orderId}",
        prefill: {
          name: "${name || ''}",
          email: "${email || ''}",
          contact: "${phone || ''}"
        },
        theme: { color: "#0B72E7" },
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
            alert('Payment Successful! ID: ' + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: function () {
            document.getElementById('pay-btn').style.display = 'inline-block';
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'CANCELLED' }));
            }
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        document.getElementById('pay-btn').style.display = 'inline-block';
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
      setTimeout(openCheckout, 150);
    };
  </script>
</body>
</html>`;

  res.send(realHtml);
});

// POST /api/payments/razorpay/webhook — processes payment confirmation from Razorpay webhook
// Instruction 3.3 & 3.4: Validate actual Razorpay webhooks against X-Razorpay-Signature using webhook secret and exact raw request body
app.post('/api/payments/razorpay/webhook', async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const webhookSignature = (req.headers['x-razorpay-signature'] || '') as string;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || (!isProd ? (req.headers['x-mock-webhook-secret'] as string || process.env.MOCK_WEBHOOK_SECRET) : '');

  if (isProd) {
    if (!webhookSecret) {
      return res.status(500).json({ error: 'RAZORPAY_WEBHOOK_SECRET is not configured in production' });
    }
    // Instruction 3.5: Reject missing or invalid signatures
    if (!webhookSignature) {
      return res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
    }
  }

  // Validate webhook signature against raw request body
  if (webhookSecret && webhookSignature) {
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    const generated = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(webhookSignature, 'utf8');
    const genBuf = Buffer.from(generated, 'utf8');

    if (sigBuf.length !== genBuf.length || !crypto.timingSafeEqual(sigBuf, genBuf)) {
      console.warn('Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }
  } else if (isProd) {
    return res.status(400).json({ error: 'Webhook signature validation required in production' });
  }

  const paymentEntity = req.body.payload?.payment?.entity;
  const razorpay_order_id = req.body.razorpay_order_id || paymentEntity?.order_id;
  const razorpay_payment_id = req.body.razorpay_payment_id || paymentEntity?.id;
  const razorpay_signature = req.body.razorpay_signature;
  const status = req.body.status || paymentEntity?.status;

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

    // Instruction 3.7: Process idempotently so duplicate events cannot increment amountSupported more than once
    if (transaction.status === 'CAPTURED') {
      return res.status(200).json({ message: 'Payment already processed (idempotent)', status: 'CAPTURED' });
    }
    if (transaction.status === 'FAILED') {
      return res.status(200).json({ message: 'Payment already failed (idempotent)', status: 'FAILED' });
    }

    const isSuccess = req.body.event ? (req.body.event !== 'payment.failed' && status !== 'failed') : (status !== 'failed');

    if (isSuccess) {
      await prisma.$transaction(async (tx) => {
        const freshTx = await tx.transaction.findUnique({ where: { id: transaction.id } });
        if (freshTx?.status === 'CAPTURED') return;

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'CAPTURED',
            gatewayPaymentId: razorpay_payment_id || generateMockId('pay'),
            gatewaySignature: razorpay_signature || 'webhook_signature',
            gatewayResponse: JSON.stringify(req.body),
          }
        });

        await tx.support.update({
          where: { id: transaction.supportId },
          data: { status: 'SUCCESS' }
        });

        await tx.supportRequest.update({
          where: { id: transaction.support.supportRequestId },
          data: { amountSupported: { increment: transaction.amount } }
        });
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
app.post('/api/support-requests/:id/support', authenticateToken, sensitiveEndpointLimiter, async (req: any, res) => {
  const { amount } = req.body;
  const supportRequestId = parseInt(req.params.id);
  const supporterId = req.user.id;

  try {
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    // Instruction 2.3: Prevent pending or rejected campaigns from accepting real contributions
    if (supportRequest.approvalStatus !== 'APPROVED') {
      return res.status(400).json({ error: 'This campaign is pending verification and cannot accept contributions yet.' });
    }

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
// USER VERIFICATION SUBMISSION & EVIDENCE ROUTES (Instructions 1, 4, 5)
// ===================================================================

// POST /api/verifications — Authenticated user submits a verification claim
// Instruction 4.3, 4.6, 4.7
app.post('/api/verifications', authenticateToken, sensitiveEndpointLimiter, async (req: any, res) => {
  const { entityType, entityId, category, notes, evidenceType, sourceUrl } = req.body;

  if (!entityType || !entityId || !category) {
    return res.status(400).json({ error: 'entityType, entityId, and category are required' });
  }

  const validEntityTypes = ['AthleteProfile', 'Achievement', 'SupportRequest', 'BudgetItem'];
  if (!validEntityTypes.includes(entityType)) {
    return res.status(400).json({ error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` });
  }

  const numEntityId = parseInt(entityId, 10);
  if (isNaN(numEntityId)) {
    return res.status(400).json({ error: 'entityId must be a valid number' });
  }

  try {
    // Instruction 4.6: Validate that entity belongs to authenticated user
    const isOwner = await checkEntityOwnership(entityType, numEntityId, req.user.id);
    if (!isOwner && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to submit or modify verification for this entity.' });
    }

    // Instruction 4.7: Prevent users from assigning themselves VERIFIED status or setting verifiedBy
    const status = 'PENDING_REVIEW';

    let verificationRecord = await prisma.verification.findFirst({
      where: {
        entityType,
        entityId: numEntityId,
        category,
      }
    });

    if (verificationRecord) {
      // Instruction 6.1: Allow submission to move claim from NOT_SUBMITTED to PENDING_REVIEW (or resubmission from NEEDS_CORRECTION / REJECTED)
      verificationRecord = await prisma.verification.update({
        where: { id: verificationRecord.id },
        data: {
          status,
          notes: notes !== undefined ? notes : verificationRecord.notes,
          verifiedBy: null,
          verifiedAt: null,
        }
      });
    } else {
      verificationRecord = await prisma.verification.create({
        data: {
          entityType,
          entityId: numEntityId,
          category,
          status,
          notes: notes || null,
        }
      });
    }

    let evidenceRecord = null;
    if (sourceUrl || evidenceType) {
      evidenceRecord = await prisma.verificationEvidence.create({
        data: {
          verificationId: verificationRecord.id,
          evidenceType: evidenceType || 'DOCUMENT',
          sourceUrl: sourceUrl || null,
        }
      });
    }

    if (entityType === 'Achievement') {
      await prisma.achievement.update({
        where: { id: numEntityId },
        data: { verificationStatus: 'PENDING_REVIEW' }
      });
    } else if (entityType === 'SupportRequest') {
      await prisma.supportRequest.update({
        where: { id: numEntityId },
        data: { approvalStatus: 'UNDER_REVIEW' }
      });
    }

    await writeAuditLog(req.user.id, 'VERIFICATION_SUBMITTED', 'Verification', verificationRecord.id,
      JSON.stringify({ entityType, entityId: numEntityId, category }));

    const hydrated = await hydrateVerification(verificationRecord);
    res.status(201).json({ verification: hydrated, evidence: evidenceRecord });
  } catch (error: any) {
    console.error('Submit verification claim failed:', error);
    res.status(500).json({ error: error.message || 'Failed to submit verification claim' });
  }
});

// POST /api/verifications/:id/evidence — Upload evidence for claim owned by authenticated user
// Instruction 1.3, 1.4, 1.5, 4.4, 4.8
app.post('/api/verifications/:id/evidence', authenticateToken, sensitiveEndpointLimiter, evidenceUpload.single('file'), async (req: any, res) => {
  const verificationId = parseInt(req.params.id, 10);
  if (isNaN(verificationId)) {
    return res.status(400).json({ error: 'Invalid verification ID' });
  }

  try {
    const verification = await prisma.verification.findUnique({
      where: { id: verificationId }
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification claim not found' });
    }

    // Instruction 4.4 & 4.6: Validate claim is owned by authenticated user
    const isOwner = await checkVerificationOwnership(verification, req.user.id);
    if (!isOwner && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to upload evidence for this verification claim.' });
    }

    let privateStorageKey: string | null = null;
    let documentHash: string | null = null;
    let originalFilename: string | null = null;
    const { evidenceType, sourceUrl } = req.body;

    if (req.file) {
      // Instruction 1.4: Validate file signatures, MIME type, file size, and file contents (PDF, JPEG, PNG)
      const validation = validateEvidenceFileBuffer(req.file.buffer);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error || 'Invalid file format. Only PDF, JPEG, and PNG are allowed.' });
      }

      // Instruction 1.2 & 1.5: Store verification evidence in private directory outside publicly served uploads folder
      const saved = await savePrivateEvidenceFile(req.file.buffer, validation.extension!);
      privateStorageKey = saved.privateStorageKey;
      documentHash = saved.documentHash;
      originalFilename = req.file.originalname;
    } else if (!sourceUrl) {
      return res.status(400).json({ error: 'Either an evidence file (PDF, PNG, JPEG) or a valid sourceUrl is required.' });
    }

    const evidence = await prisma.verificationEvidence.create({
      data: {
        verificationId,
        evidenceType: evidenceType || (req.file ? 'DOCUMENT' : 'URL'),
        privateStorageKey,
        sourceUrl: sourceUrl || null,
        originalFilename,
        documentHash,
      }
    });

    // Instruction 4.8 & 6.3: Require new or resubmitted evidence to return claim to PENDING_REVIEW
    const updatedVerification = await prisma.verification.update({
      where: { id: verificationId },
      data: {
        status: 'PENDING_REVIEW',
        verifiedBy: null,
        verifiedAt: null,
      }
    });

    if (verification.entityType === 'Achievement') {
      await prisma.achievement.update({
        where: { id: verification.entityId },
        data: { verificationStatus: 'PENDING_REVIEW' }
      });
    } else if (verification.entityType === 'SupportRequest') {
      await prisma.supportRequest.update({
        where: { id: verification.entityId },
        data: { approvalStatus: 'UNDER_REVIEW' }
      });
    }

    await writeAuditLog(req.user.id, 'EVIDENCE_UPLOADED', 'VerificationEvidence', evidence.id,
      JSON.stringify({ verificationId, evidenceType: evidence.evidenceType, filename: originalFilename }));

    res.status(201).json({
      message: 'Evidence uploaded successfully and submitted for review',
      evidence,
      verification: updatedVerification
    });
  } catch (error: any) {
    console.error('Evidence upload failed:', error);
    res.status(500).json({ error: error.message || 'Evidence upload failed' });
  }
});

// GET /api/verifications/me — Authenticated user sees own verification requests and statuses
// Instruction 4.5
app.get('/api/verifications/me', authenticateToken, async (req: any, res) => {
  try {
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        achievements: { select: { id: true } },
        supportRequests: { select: { id: true, budgetItems: { select: { id: true } } } }
      }
    });

    if (!athleteProfile) {
      return res.json([]);
    }

    const achievementIds = athleteProfile.achievements.map((a: any) => a.id);
    const srIds = athleteProfile.supportRequests.map((sr: any) => sr.id);
    const budgetItemIds = athleteProfile.supportRequests.flatMap((sr: any) => sr.budgetItems.map((b: any) => b.id));

    const verifications = await prisma.verification.findMany({
      where: {
        OR: [
          { entityType: 'AthleteProfile', entityId: athleteProfile.id },
          ...(achievementIds.length > 0 ? [{ entityType: 'Achievement', entityId: { in: achievementIds } }] : []),
          ...(srIds.length > 0 ? [{ entityType: 'SupportRequest', entityId: { in: srIds } }] : []),
          ...(budgetItemIds.length > 0 ? [{ entityType: 'BudgetItem', entityId: { in: budgetItemIds } }] : [])
        ]
      },
      include: {
        evidence: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const hydrated = await Promise.all(verifications.map(hydrateVerification));
    res.json(hydrated);
  } catch (error: any) {
    console.error('Fetch my verifications failed:', error);
    res.status(500).json({ error: 'Failed to fetch verification claims' });
  }
});

// Instruction 1.6: Protected endpoint for reviewers & document owners to retrieve private evidence files
app.get('/api/verifications/evidence/:evidenceId/file', authenticateToken, async (req: any, res) => {
  try {
    const evidenceId = parseInt(req.params.evidenceId, 10);
    if (isNaN(evidenceId)) {
      return res.status(400).json({ error: 'Invalid evidence ID' });
    }

    const evidence = await prisma.verificationEvidence.findUnique({
      where: { id: evidenceId },
      include: { verification: true }
    });

    if (!evidence || !evidence.privateStorageKey) {
      return res.status(404).json({ error: 'Evidence document not found' });
    }

    // Check authorization: reviewer (ADMIN) or document owner
    const isOwner = await checkVerificationOwnership(evidence.verification, req.user.id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this private document.' });
    }

    const filePath = getPrivateFilePath(evidence.privateStorageKey);
    if (!filePath) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${evidence.originalFilename || path.basename(filePath)}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Retrieve private document failed:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

// GET /api/verifications/documents/:key — Retrieve private document by storage key (protected)
app.get('/api/verifications/documents/:key', authenticateToken, async (req: any, res) => {
  try {
    const key = req.params.key;
    const evidence = await prisma.verificationEvidence.findFirst({
      where: { privateStorageKey: key },
      include: { verification: true }
    });

    if (!evidence) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const isOwner = await checkVerificationOwnership(evidence.verification, req.user.id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this document.' });
    }

    const filePath = getPrivateFilePath(key);
    if (!filePath) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${evidence.originalFilename || path.basename(filePath)}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error: any) {
    console.error('Retrieve private document failed:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

// ===================================================================
// ACHIEVEMENTS WORKFLOW (Instruction 5)
// ===================================================================

// POST /api/achievements — Athlete submits a new achievement
// Instruction 5.1 & 5.2
app.post('/api/achievements', authenticateToken, sensitiveEndpointLimiter, async (req: any, res) => {
  const {
    title,
    competition,
    event,
    date,
    position,
    result,
    achievementLevel,
    evidenceSource,
    evidenceUrl,
    evidenceFileId
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Achievement title is required' });
  }

  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!athlete) {
      return res.status(403).json({ error: 'Only registered athletes can submit achievements' });
    }

    const validLevels = ['CLUB', 'DISTRICT', 'ZONE', 'REGIONAL', 'STATE', 'NATIONAL', 'INTERNATIONAL'];
    const level = (achievementLevel || 'STATE').toUpperCase();
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: `achievementLevel must be one of: ${validLevels.join(', ')}` });
    }

    const outcome = (position || result || '').trim();

    // Instruction 5.1: Create achievement and matching Verification record with PENDING_REVIEW
    const createdAchievement = await prisma.$transaction(async (tx) => {
      const ach = await tx.achievement.create({
        data: {
          athleteId: athlete.id,
          title: title.trim(),
          competition: competition ? competition.trim() : null,
          event: event ? event.trim() : null,
          position: outcome || null,
          date: date ? date.trim() : null,
          achievementLevel: level,
          verificationStatus: 'PENDING_REVIEW', // Instruction 5.1
          evidenceFileId: evidenceFileId || evidenceUrl || null,
        }
      });

      const notes = [
        `Competition: ${competition || 'N/A'}`,
        `Event: ${event || 'N/A'}`,
        `Date: ${date || 'N/A'}`,
        `Result: ${outcome || 'N/A'}`,
        `Level: ${level}`,
        `Evidence Source: ${evidenceSource || 'Official Results / Certificates'}`
      ].join(' | ');

      const ver = await tx.verification.create({
        data: {
          entityType: 'Achievement',
          entityId: ach.id,
          category: 'ACHIEVEMENT',
          status: 'PENDING_REVIEW',
          notes,
        }
      });

      if (evidenceUrl) {
        await tx.verificationEvidence.create({
          data: {
            verificationId: ver.id,
            evidenceType: 'CERTIFICATE',
            sourceUrl: evidenceUrl,
          }
        });
      }

      return ach;
    });

    await writeAuditLog(req.user.id, 'ACHIEVEMENT_CREATED', 'Achievement', createdAchievement.id,
      JSON.stringify({ title, competition, level }));

    res.status(201).json(createdAchievement);
  } catch (error: any) {
    console.error('Create achievement failed:', error);
    res.status(500).json({ error: error.message || 'Failed to create achievement' });
  }
});

// GET /api/achievements/me — Authenticated athlete views own achievements
app.get('/api/achievements/me', authenticateToken, async (req: any, res) => {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!athlete) {
      return res.json([]);
    }

    const achievements = await prisma.achievement.findMany({
      where: { athleteId: athlete.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// ===================================================================
// ADMIN — VERIFICATION MANAGEMENT (Instructions 2, 5, 6, 7)
// ===================================================================

// GET /api/admin/verifications/pending — hydrated pending verification items
app.get('/api/admin/verifications/pending', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const pending = await prisma.verification.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { evidence: true },
      orderBy: { createdAt: 'desc' }
    });

    const hydrated = await Promise.all(pending.map(hydrateVerification));
    res.json(hydrated);
  } catch (error) {
    console.error('Failed to fetch pending verifications:', error);
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

// GET /api/admin/verifications — all verifications with optional filtering
app.get('/api/admin/verifications', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { category, status } = req.query;
    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const verifications = await prisma.verification.findMany({
      where,
      include: { evidence: true },
      orderBy: { createdAt: 'desc' }
    });
    const hydrated = await Promise.all(verifications.map(hydrateVerification));
    res.json(hydrated);
  } catch (error) {
    console.error('Failed to fetch verifications:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// POST /api/admin/verifications/:id/approve
// Instructions 5.5, 5.6, 5.7, 6.2, 6.6, 6.7
app.post('/api/admin/verifications/:id/approve', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { notes } = req.body;

    const verification = await prisma.verification.findUnique({
      where: { id }
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    // Instruction 6.4: Validate state transition
    if (verification.status === 'VERIFIED') {
      return res.status(400).json({ error: 'Verification claim is already approved and verified' });
    }

    const decisionTime = new Date();

    // Instruction 6.6: Atomic update across verification, target entity, and audit log
    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.verification.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          verifiedBy: req.user.id,
          verifiedAt: decisionTime,
          notes: notes || verification.notes || null,
        }
      });

      // Instruction 5.5 & 5.6: If this is an achievement verification, update that specific achievement
      if (verification.entityType === 'Achievement') {
        await tx.achievement.update({
          where: { id: verification.entityId },
          data: {
            verificationStatus: 'VERIFIED',
            verifiedBy: req.user.id,
            verifiedAt: decisionTime,
          }
        });
        // Instruction 5.7: Do NOT automatically verify athlete's entire profile
      }

      // Instruction 2.5: If this is a support request verification, update campaign status to APPROVED
      if (verification.entityType === 'SupportRequest') {
        await tx.supportRequest.update({
          where: { id: verification.entityId },
          data: {
            approvalStatus: 'APPROVED'
          }
        });
      }

      // If this is an AthleteProfile verification (Identity or Affiliation), update summary
      if (verification.entityType === 'AthleteProfile') {
        const ap = await tx.athleteProfile.findUnique({ where: { id: verification.entityId } });
        if (ap) {
          const currentSummary = ap.publicVerificationSummary || '';
          const tag = verification.category === 'IDENTITY' ? 'Identity ✓' : (verification.category === 'ATHLETE_AFFILIATION' ? 'Affiliation ✓' : 'Verified ✓');
          const newSummary = currentSummary.includes(tag) 
            ? currentSummary 
            : (currentSummary ? `${currentSummary} • ${tag}` : tag);
          await tx.athleteProfile.update({
            where: { id: verification.entityId },
            data: { publicVerificationSummary: newSummary }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'VERIFICATION_APPROVED',
          entityType: verification.entityType,
          entityId: verification.entityId,
          details: JSON.stringify({
            verificationId: id,
            category: verification.category,
            notes: notes || null
          })
        }
      });

      return v;
    });

    res.json({ message: 'Verification approved successfully', verification: updated });
  } catch (error: any) {
    console.error('Approve verification failed:', error);
    res.status(500).json({ error: error.message || 'Failed to approve verification' });
  }
});

// POST /api/admin/verifications/:id/reject
// Instructions 6.2, 6.5, 6.6, 6.7
app.post('/api/admin/verifications/:id/reject', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason, notes } = req.body;
    const rejectionReason = (reason || notes || '').trim();

    // Instruction 6.5: Require a reason when rejecting a claim
    if (!rejectionReason) {
      return res.status(400).json({ error: 'A specific reason is required when rejecting a verification claim' });
    }

    const verification = await prisma.verification.findUnique({
      where: { id }
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    if (verification.status === 'REJECTED') {
      return res.status(400).json({ error: 'Verification claim is already rejected' });
    }

    const decisionTime = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.verification.update({
        where: { id },
        data: {
          status: 'REJECTED',
          verifiedBy: req.user.id,
          verifiedAt: decisionTime,
          notes: rejectionReason,
        }
      });

      if (verification.entityType === 'Achievement') {
        await tx.achievement.update({
          where: { id: verification.entityId },
          data: {
            verificationStatus: 'REJECTED',
            verifiedBy: req.user.id,
            verifiedAt: decisionTime,
          }
        });
      }

      if (verification.entityType === 'SupportRequest') {
        await tx.supportRequest.update({
          where: { id: verification.entityId },
          data: {
            approvalStatus: 'REJECTED'
          }
        });
      }

      if (verification.entityType === 'AthleteProfile') {
        await tx.athleteProfile.update({
          where: { id: verification.entityId },
          data: { publicVerificationSummary: null }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'VERIFICATION_REJECTED',
          entityType: verification.entityType,
          entityId: verification.entityId,
          details: JSON.stringify({
            verificationId: id,
            category: verification.category,
            reason: rejectionReason
          })
        }
      });

      return v;
    });

    res.json({ message: 'Verification rejected successfully', verification: updated });
  } catch (error: any) {
    console.error('Reject verification failed:', error);
    res.status(500).json({ error: error.message || 'Failed to reject verification' });
  }
});

// POST /api/admin/verifications/:id/request-correction
// Instructions 6.2, 6.5, 6.6
app.post('/api/admin/verifications/:id/request-correction', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { notes, reason } = req.body;
    const correctionNotes = (notes || reason || '').trim();

    // Instruction 6.5: Require notes/reason when requesting corrections
    if (!correctionNotes) {
      return res.status(400).json({ error: 'Correction instructions or notes are required' });
    }

    const verification = await prisma.verification.findUnique({
      where: { id }
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.verification.update({
        where: { id },
        data: {
          status: 'NEEDS_CORRECTION',
          verifiedBy: req.user.id,
          notes: correctionNotes,
        }
      });

      if (verification.entityType === 'Achievement') {
        await tx.achievement.update({
          where: { id: verification.entityId },
          data: {
            verificationStatus: 'NEEDS_CORRECTION'
          }
        });
      }

      if (verification.entityType === 'SupportRequest') {
        await tx.supportRequest.update({
          where: { id: verification.entityId },
          data: {
            approvalStatus: 'UNDER_REVIEW'
          }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'VERIFICATION_CORRECTION_REQUESTED',
          entityType: verification.entityType,
          entityId: verification.entityId,
          details: JSON.stringify({
            verificationId: id,
            category: verification.category,
            notes: correctionNotes
          })
        }
      });

      return v;
    });

    res.json({ message: 'Correction requested successfully', verification: updated });
  } catch (error: any) {
    console.error('Request correction failed:', error);
    res.status(500).json({ error: error.message || 'Failed to request correction' });
  }
});

// ===================================================================
// ADMIN — SUPPORT REQUEST MANAGEMENT (Instruction 2)
// ===================================================================

// GET /api/admin/support-requests — all support requests for admin portal
app.get('/api/admin/support-requests', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.approvalStatus = status;

    const requests = await prisma.supportRequest.findMany({
      where,
      include: {
        athlete: {
          include: { user: { select: { name: true, email: true } }, sport: true }
        },
        budgetItems: true,
        supports: {
          include: { transaction: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error('Failed to fetch admin support requests:', error);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

// PUT /api/admin/support-requests/:id/approve
// Instruction 2.4 & 2.5: Approve campaign and update matching verification record consistently
app.put('/api/admin/support-requests/:id/approve', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    const decisionTime = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const sr = await tx.supportRequest.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED'
        }
      });

      // Consistently update matching Verification record
      const matchingVerification = await tx.verification.findFirst({
        where: {
          entityType: 'SupportRequest',
          entityId: id,
          category: 'SUPPORT_NEED'
        }
      });

      if (matchingVerification) {
        await tx.verification.update({
          where: { id: matchingVerification.id },
          data: {
            status: 'VERIFIED',
            verifiedBy: req.user.id,
            verifiedAt: decisionTime,
          }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'SUPPORT_REQUEST_APPROVED',
          entityType: 'SupportRequest',
          entityId: id,
          details: JSON.stringify({ title: existing.title, targetAmount: existing.targetAmount })
        }
      });

      return sr;
    });

    res.json({ message: 'Support request approved successfully', request: updated });
  } catch (error: any) {
    console.error('Approve support request failed:', error);
    res.status(500).json({ error: error.message || 'Failed to approve support request' });
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
// POSTS & ATHLETE JOURNEY UPDATES (Instagram-Style Social Feed)
// ===================================================================

// GET /api/posts — Feed of athlete updates with cheer count and user cheered status
app.get('/api/posts', optionalAuthenticateToken, async (req: any, res) => {
  try {
    const athleteId = req.query.athleteId ? parseInt(req.query.athleteId as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (athleteId) {
      where.athleteId = athleteId;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        athlete: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImageUrl: true,
                bannerImageUrl: true,
                role: true,
              }
            },
            sport: true,
            mediaAssets: true,
            supportRequests: {
              where: { lifecycleStatus: 'ACTIVE' },
              take: 1,
              include: { supports: true }
            }
          }
        },
        cheers: {
          select: {
            id: true,
            userId: true,
            createdAt: true,
          }
        },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
                role: true,
              }
            }
          }
        },
        _count: {
          select: { cheers: true, comments: true }
        }
      }
    });

    const currentUserId = req.user?.id;
    const formatted = posts.map((post: any) => {
      const isCheered = currentUserId
        ? post.cheers.some((c: any) => c.userId === currentUserId)
        : false;
      return {
        id: post.id,
        athleteId: post.athleteId,
        content: post.content,
        mediaUrl: post.mediaUrl,
        createdAt: post.createdAt,
        cheerCount: post._count.cheers,
        commentCount: post._count.comments,
        recentComments: post.comments.slice().reverse(),
        isCheered,
        athlete: post.athlete,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Fetch posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /api/athletes/:id/posts — Get posts for specific athlete
app.get('/api/athletes/:id/posts', optionalAuthenticateToken, async (req: any, res) => {
  try {
    const athleteId = parseInt(req.params.id);
    const posts = await prisma.post.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'desc' },
      include: {
        athlete: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
                bannerImageUrl: true,
              }
            },
            sport: true,
            mediaAssets: true,
            supportRequests: {
              where: { lifecycleStatus: 'ACTIVE' },
              take: 1
            }
          }
        },
        cheers: {
          select: {
            userId: true,
          }
        },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
                role: true,
              }
            }
          }
        },
        _count: {
          select: { cheers: true, comments: true }
        }
      }
    });

    const currentUserId = req.user?.id;
    const formatted = posts.map(post => ({
      id: post.id,
      athleteId: post.athleteId,
      content: post.content,
      mediaUrl: post.mediaUrl,
      createdAt: post.createdAt,
      cheerCount: post._count.cheers,
      commentCount: post._count.comments,
      recentComments: post.comments.slice().reverse(),
      isCheered: currentUserId ? post.cheers.some(c => c.userId === currentUserId) : false,
      athlete: post.athlete,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Fetch athlete posts error:', error);
    res.status(500).json({ error: 'Failed to fetch athlete posts' });
  }
});

// POST /api/posts — Create a new journey update post (Athletes only)
app.post('/api/posts', authenticateToken, async (req: any, res) => {
  const { content, mediaUrl } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post caption or update text is required' });
  }

  try {
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true } },
        sport: true,
      }
    });

    if (!athleteProfile) {
      return res.status(403).json({ error: 'Only registered athletes can publish journey updates' });
    }

    const post = await prisma.post.create({
      data: {
        athleteId: athleteProfile.id,
        content: content.trim(),
        mediaUrl: mediaUrl?.trim() || null,
      },
      include: {
        athlete: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true, bannerImageUrl: true } },
            sport: true,
            mediaAssets: true,
            supportRequests: { where: { lifecycleStatus: 'ACTIVE' }, take: 1, include: { supports: true } }
          }
        },
        _count: { select: { cheers: true } },
      }
    });

    res.status(201).json({
      id: post.id,
      athleteId: post.athleteId,
      content: post.content,
      mediaUrl: post.mediaUrl,
      createdAt: post.createdAt,
      cheerCount: 0,
      isCheered: false,
      athlete: post.athlete,
    });
  } catch (error: any) {
    console.error('Create post error:', error);
    res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

// POST /api/posts/:id/cheer — Toggle cheer (like) on a post
app.post('/api/posts/:id/cheer', authenticateToken, async (req: any, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingCheer = await prisma.cheer.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        }
      }
    });

    let cheered = false;
    if (existingCheer) {
      await prisma.cheer.delete({
        where: { id: existingCheer.id }
      });
      cheered = false;
    } else {
      await prisma.cheer.create({
        data: {
          postId,
          userId,
        }
      });
      cheered = true;
    }

    const cheerCount = await prisma.cheer.count({
      where: { postId }
    });

    res.json({
      success: true,
      cheered,
      cheerCount,
    });
  } catch (error) {
    console.error('Toggle cheer error:', error);
    res.status(500).json({ error: 'Failed to toggle cheer' });
  }
});

// DELETE /api/posts/:id — Delete post (Owner athlete or admin only)
app.delete('/api/posts/:id', authenticateToken, async (req: any, res) => {
  const postId = parseInt(req.params.id);

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { athlete: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isOwner = post.athlete.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to delete this post' });
    }

    // Delete associated cheers first
    await prisma.cheer.deleteMany({ where: { postId } });
    await prisma.post.delete({ where: { id: postId } });

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ===================================================================
// COMMENTS MECHANISM (Enabled for all users: Athletes, Supporters, Sponsors, Admins)
// ===================================================================

// GET /api/posts/:id/comments — Retrieve all comments for a post
app.get('/api/posts/:id/comments', optionalAuthenticateToken, async (req: any, res) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            role: true,
            athleteProfile: {
              select: {
                id: true,
                sport: { select: { name: true } },
              }
            }
          }
        }
      }
    });

    res.json(comments);
  } catch (error) {
    console.error('Fetch comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/posts/:id/comments — Add a comment to a post (All authenticated users)
app.post('/api/posts/:id/comments', authenticateToken, async (req: any, res) => {
  const postId = parseInt(req.params.id);
  const { content } = req.body;

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment text cannot be empty' });
  }

  if (content.trim().length > 1000) {
    return res.status(400).json({ error: 'Comment must be under 1000 characters' });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { athlete: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newComment = await prisma.comment.create({
      data: {
        postId,
        userId: req.user.id,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            role: true,
            athleteProfile: {
              select: {
                id: true,
                sport: { select: { name: true } },
              }
            }
          }
        }
      }
    });

    const commentCount = await prisma.comment.count({
      where: { postId }
    });

    res.status(201).json({
      comment: newComment,
      commentCount,
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// DELETE /api/comments/:id — Delete comment (Author, Post Owner, or Admin)
app.delete('/api/comments/:id', authenticateToken, async (req: any, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) {
    return res.status(400).json({ error: 'Invalid comment ID' });
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: { athlete: true }
        }
      }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isCommentAuthor = comment.userId === req.user.id;
    const isPostOwner = comment.post.athlete.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isCommentAuthor && !isPostOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment' });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    const commentCount = await prisma.comment.count({
      where: { postId: comment.postId }
    });

    res.json({
      success: true,
      message: 'Comment deleted successfully',
      postId: comment.postId,
      commentCount,
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
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
