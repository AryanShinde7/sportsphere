import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_for_demo_only';

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

// --- AUTH ROUTES ---
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

// --- ATHLETE & DISCOVERY ROUTES ---
app.get('/api/athletes', async (req, res) => {
  try {
    const athletes = await prisma.athleteProfile.findMany({
      include: {
        user: { select: { name: true } },
        sport: true,
        achievements: true,
        supportRequests: {
          where: { lifecycleStatus: 'ACTIVE' }
        }
      }
    });
    res.json(athletes);
  } catch (error) {
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
    res.json(athlete);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch athlete' });
  }
});

// --- SUPPORT REQUEST ROUTES ---
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

// --- MOCK PAYMENT / SUPPORT FLOW ---
app.post('/api/support-requests/:id/support', authenticateToken, async (req: any, res) => {
  const { amount } = req.body;
  const supportRequestId = parseInt(req.params.id);
  const supporterId = req.user.id;

  try {
    // In a real app, this would verify a Razorpay signature. Here we just mock success.
    const supportRequest = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
    if (!supportRequest) return res.status(404).json({ error: 'Support request not found' });

    // 1. Create support record
    const support = await prisma.support.create({
      data: {
        supportRequestId,
        supporterId,
        amount,
        status: 'SUCCESS',
        transactionId: `mock_tx_${Date.now()}`
      }
    });

    // 2. Update amount supported
    const updatedRequest = await prisma.supportRequest.update({
      where: { id: supportRequestId },
      data: { amountSupported: { increment: amount } }
    });

    res.json({ message: 'Support successful!', support, updatedRequest });
  } catch (error) {
    res.status(500).json({ error: 'Support payment failed' });
  }
});


// --- ADMIN DASHBOARD MOCK ROUTES ---
app.get('/api/admin/dashboard', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  
  try {
    const totalAthletes = await prisma.athleteProfile.count();
    const activeRequests = await prisma.supportRequest.count({ where: { lifecycleStatus: 'ACTIVE' } });
    const totalUsers = await prisma.user.count();
    
    // For demo, we just get recent achievements pending review
    const pendingVerifications = await prisma.achievement.findMany({
      where: { verificationStatus: 'PENDING_REVIEW' },
      include: { athlete: { include: { user: { select: { name: true } } } } }
    });

    res.json({
      totalAthletes,
      activeRequests,
      totalUsers,
      pendingVerifications
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
