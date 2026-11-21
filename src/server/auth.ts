import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db.ts';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatar_url: string;
  email_verified: number;
  notify_expenses: number;
  notify_announcements: number;
  notify_requests: number;
}

export interface TripPermissions {
  can_manage_members: boolean;
  can_approve_expenses: boolean;
  can_manage_contributions: boolean;
  can_edit_expenses: boolean;
  can_manage_notes: boolean;
  can_publish_announcements: boolean;
  can_view_reports: boolean;
  can_manage_schedule: boolean;
}

export type PermissionKey = keyof TripPermissions;

export interface TripMembershipContext {
  tripId: number;
  role: 'owner' | 'admin' | 'member';
  permissions: TripPermissions;
  tripStatus: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  tripContext?: TripMembershipContext;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: number): { token: string; expiresAt: string } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`).run(
    tokenHash,
    userId,
    expiresAt
  );
  return { token, expiresAt };
}

export function revokeSession(token: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
}

function resolveUserFromHeader(req: Request): AuthUser | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return undefined;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.bio, u.avatar_url, u.email_verified,
              u.notify_expenses, u.notify_announcements, u.notify_requests, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) return undefined;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
    return undefined;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    bio: row.bio,
    avatar_url: row.avatar_url,
    email_verified: row.email_verified,
    notify_expenses: row.notify_expenses,
    notify_announcements: row.notify_announcements,
    notify_requests: row.notify_requests,
  };
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  req.user = resolveUserFromHeader(req);
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = resolveUserFromHeader(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

const FULL_PERMISSIONS: TripPermissions = {
  can_manage_members: true,
  can_approve_expenses: true,
  can_manage_contributions: true,
  can_edit_expenses: true,
  can_manage_notes: true,
  can_publish_announcements: true,
  can_view_reports: true,
  can_manage_schedule: true,
};

const MEMBER_PERMISSIONS: TripPermissions = {
  can_manage_members: false,
  can_approve_expenses: false,
  can_manage_contributions: false,
  can_edit_expenses: false,
  can_manage_notes: false,
  can_publish_announcements: false,
  can_view_reports: true,
  can_manage_schedule: false,
};

export function getTripMembershipContext(tripId: number, userId: number): TripMembershipContext | null {
  const db = getDb();
  const member = db
    .prepare(
      `SELECT tm.role, t.status AS trip_status
       FROM trip_members tm
       JOIN trips t ON t.id = tm.trip_id
       WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`
    )
    .get(tripId, userId) as { role: 'owner' | 'admin' | 'member'; trip_status: string } | undefined;

  if (!member) return null;

  if (member.role === 'owner') {
    return {
      tripId,
      role: 'owner',
      permissions: { ...FULL_PERMISSIONS },
      tripStatus: member.trip_status,
    };
  }

  if (member.role === 'admin') {
    const perms = db
      .prepare(`SELECT * FROM admin_permissions WHERE trip_id = ? AND user_id = ?`)
      .get(tripId, userId) as Record<string, number> | undefined;

    return {
      tripId,
      role: 'admin',
      tripStatus: member.trip_status,
      permissions: {
        can_manage_members: Boolean(perms?.can_manage_members),
        can_approve_expenses: Boolean(perms?.can_approve_expenses),
        can_manage_contributions: Boolean(perms?.can_manage_contributions),
        can_edit_expenses: Boolean(perms?.can_edit_expenses),
        can_manage_notes: Boolean(perms?.can_manage_notes),
        can_publish_announcements: Boolean(perms?.can_publish_announcements),
        can_view_reports: perms ? Boolean(perms.can_view_reports) : true,
        can_manage_schedule: Boolean(perms?.can_manage_schedule),
      },
    };
  }

  return {
    tripId,
    role: 'member',
    permissions: { ...MEMBER_PERMISSIONS },
    tripStatus: member.trip_status,
  };
}

export function requireTripMember(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const tripId = Number(req.params.tripId);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    res.status(400).json({ error: 'Invalid trip identifier.' });
    return;
  }
  const ctx = getTripMembershipContext(tripId, req.user.id);
  if (!ctx) {
    res.status(403).json({ error: 'You do not have access to this trip workspace.' });
    return;
  }
  req.tripContext = ctx;
  next();
}

export function requireTripPermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const ctx = req.tripContext;
    if (!ctx) {
      res.status(403).json({ error: 'Trip membership context missing.' });
      return;
    }
    if (ctx.role === 'owner') {
      next();
      return;
    }
    if (ctx.role === 'admin' && ctx.permissions[permission]) {
      next();
      return;
    }
    res.status(403).json({ error: 'Insufficient administrative permissions for this action.' });
  };
}

export function requireTripOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.tripContext || req.tripContext.role !== 'owner') {
    res.status(403).json({ error: 'Only the trip Owner can perform this action.' });
    return;
  }
  next();
}

// Simple in-memory rate limiter for sensitive auth endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxHits: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxHits) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    bucket.count += 1;
    next();
  };
}
