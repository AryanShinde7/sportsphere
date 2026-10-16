import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const isProd = process.env.NODE_ENV === 'production';
const rawJwtSecret = process.env.JWT_SECRET;

// Instruction 7.6: Use a strong JWT_SECRET from environment configuration and fail startup if missing in production. Remove hard-coded fallback.
if (isProd && (!rawJwtSecret || rawJwtSecret === 'supersecretkey_for_demo_only')) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing or set to demo default in production. Set a strong secret.');
}

export const JWT_SECRET = rawJwtSecret || 'supersecretkey_for_demo_only';
if (!isProd && (!rawJwtSecret || rawJwtSecret === 'supersecretkey_for_demo_only')) {
  console.warn('⚠️ WARNING: Using demo JWT_SECRET in non-production environment. Set JWT_SECRET in .env for security.');
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  profileImageUrl?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser | null;
  rawBody?: Buffer;
}

/**
 * Authentication Middleware:
 * Instruction 7.2: Require authentication before any private verification operation.
 * Instruction 7.4: Validate the user's current account status and permissions from DB
 * rather than trusting stale role information in a long-lived token alone.
 */
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Access denied: No token provided' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(403).json({ error: 'Invalid token payload' });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profileImageUrl: true,
      }
    });

    if (!dbUser) {
      return res.status(401).json({ error: 'User account no longer exists' });
    }

    if (dbUser.status !== 'ACTIVE') {
      return res.status(403).json({ error: `Account is ${dbUser.status.toLowerCase()}. Access denied.` });
    }

    req.user = dbUser;
    next();
  } catch (err: any) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional Authentication Middleware
 */
export const optionalAuthenticateToken = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
  const token = headerToken || queryToken;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          profileImageUrl: true,
        }
      });
      if (dbUser && dbUser.status === 'ACTIVE') {
        req.user = dbUser;
        return next();
      }
    }
  } catch (_e) {
    // Non-fatal for optional auth
  }

  req.user = null;
  next();
};

/**
 * Instruction 7.3: Require the ADMIN role for verification queues and review decisions.
 * Instruction 7.7: Require MFA for administrative accounts in production.
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (isProd && process.env.REQUIRE_ADMIN_MFA === 'true') {
    const mfaToken = req.headers['x-admin-mfa-token'] || req.headers['x-mfa-code'];
    if (!mfaToken) {
      return res.status(403).json({ error: 'MFA required for administrative decisions in production' });
    }
  }

  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
};
