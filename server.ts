import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Response } from 'express';
import {
  createNotification,
  DEFAULT_EXPENSE_CATEGORIES,
  getDb,
  logActivity,
} from './src/server/db.ts';
import {
  createSession,
  hashPassword,
  optionalAuth,
  rateLimit,
  requireAuth,
  requireTripMember,
  requireTripOwner,
  requireTripPermission,
  revokeSession,
  verifyPassword,
} from './src/server/auth.ts';
import type { AuthenticatedRequest } from './src/server/auth.ts';
import {
  computeShares,
  computeTripFinanceSummary,
  computeTripSettlement,
} from './src/server/finance.ts';
import { seedIfEmpty } from './src/server/seed.ts';

const PORT = Number(process.env.PORT) || 3000;

function sanitizeImageUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/src/assets/')) return trimmed;
  if (trimmed.startsWith('data:image/')) {
    if (trimmed.length > 2_500_000) {
      throw new Error('Image payload exceeds 2MB limit.');
    }
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return trimmed;
    }
    throw new Error('Invalid image data format.');
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    throw new Error('Invalid image URL.');
  }
  throw new Error('Unsupported image URL scheme.');
}

function getActiveMemberIds(tripId: number): number[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT user_id FROM trip_members WHERE trip_id = ? AND status = 'active'`)
    .all(tripId) as Array<{ user_id: number }>;
  return rows.map((r) => r.user_id);
}

function isTripFinanciallyLocked(status: string): boolean {
  return status === 'completed' || status === 'archived';
}

async function startServer() {
  const db = getDb();
  seedIfEmpty();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ============================================================
  // AUTHENTICATION & USER ACCOUNT ROUTES
  // ============================================================

  app.post('/api/auth/register', rateLimit(20, 60_000), (req, res) => {
    try {
      const { name, email, password, phone } = req.body ?? {};
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: 'Full name must be at least 2 characters.' });
        return;
      }
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cleanEmail);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = hashPassword(password);
      const result = db
        .prepare(
          `INSERT INTO users (name, email, password_hash, phone, email_verified) VALUES (?, ?, ?, ?, 1)`
        )
        .run(name.trim(), cleanEmail, passwordHash, typeof phone === 'string' ? phone.trim() : '');

      const userId = Number(result.lastInsertRowid);

      // Link any pending invitations sent to this email
      db.prepare(
        `UPDATE trip_invitations SET invited_user_id = ? WHERE invited_email = ? AND invited_user_id IS NULL`
      ).run(userId, cleanEmail);

      const user = db
        .prepare(
          `SELECT id, name, email, phone, bio, avatar_url, email_verified, notify_expenses, notify_announcements, notify_requests FROM users WHERE id = ?`
        )
        .get(userId);
      const session = createSession(userId);
      res.status(201).json({ token: session.token, expiresAt: session.expiresAt, user });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/login', rateLimit(30, 60_000), (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      const row = db
        .prepare(`SELECT * FROM users WHERE email = ? AND deletion_requested = 0`)
        .get(cleanEmail) as (Record<string, unknown> & { id: number; password_hash: string }) | undefined;

      if (!row || !verifyPassword(password, row.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const session = createSession(row.id);
      res.json({
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
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
        },
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    const token = req.headers.authorization?.slice(7).trim() ?? '';
    if (token) revokeSession(token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const {
        name,
        phone,
        bio,
        avatar_url,
        notify_expenses,
        notify_announcements,
        notify_requests,
      } = req.body ?? {};

      const cleanName = typeof name === 'string' && name.trim().length >= 2 ? name.trim() : req.user!.name;
      const cleanPhone = typeof phone === 'string' ? phone.trim() : req.user!.phone;
      const cleanBio = typeof bio === 'string' ? bio.trim() : req.user!.bio;
      const cleanAvatar =
        avatar_url !== undefined ? sanitizeImageUrl(avatar_url) : req.user!.avatar_url;

      db.prepare(
        `UPDATE users
         SET name = ?, phone = ?, bio = ?, avatar_url = ?,
             notify_expenses = ?, notify_announcements = ?, notify_requests = ?
         WHERE id = ?`
      ).run(
        cleanName,
        cleanPhone,
        cleanBio,
        cleanAvatar,
        notify_expenses !== undefined ? (notify_expenses ? 1 : 0) : req.user!.notify_expenses,
        notify_announcements !== undefined
          ? notify_announcements
            ? 1
            : 0
          : req.user!.notify_announcements,
        notify_requests !== undefined ? (notify_requests ? 1 : 0) : req.user!.notify_requests,
        userId
      );

      const updated = db
        .prepare(
          `SELECT id, name, email, phone, bio, avatar_url, email_verified, notify_expenses, notify_announcements, notify_requests FROM users WHERE id = ?`
        )
        .get(userId);
      res.json({ user: updated });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/forgot-password', rateLimit(10, 60_000), (req, res) => {
    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cleanEmail) as
      | { id: number }
      | undefined;

    if (!user) {
      // Return generic message without revealing account existence
      res.json({
        message: 'If an account matches that email, a password reset code has been generated.',
      });
      return;
    }

    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.prepare(`INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)`).run(
      user.id,
      codeHash,
      expiresAt
    );

    // Note: in a production deployment with SMTP, this code is emailed; we never expose reset codes for real accounts via API in production,
    // so only return confirmation + in-app demo indicator if SMTP is unconfigured.
    res.json({
      message: 'Password reset verification code generated. Check your registered inbox.',
      demoResetCode: process.env.SMTP_HOST ? undefined : code,
    });
  });

  app.post('/api/auth/reset-password', rateLimit(10, 60_000), (req, res) => {
    const { email, code, newPassword } = req.body ?? {};
    if (
      typeof email !== 'string' ||
      typeof code !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8
    ) {
      res.status(400).json({ error: 'Email, 6-digit code, and new password (min 8 chars) are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cleanEmail) as
      | { id: number }
      | undefined;
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    const resetRow = db
      .prepare(
        `SELECT id, expires_at FROM password_resets
         WHERE user_id = ? AND code_hash = ? AND used = 0
         ORDER BY id DESC LIMIT 1`
      )
      .get(user.id, codeHash) as { id: number; expires_at: string } | undefined;

    if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
        hashPassword(newPassword),
        user.id
      );
      db.prepare(`UPDATE password_resets SET used = 1 WHERE id = ?`).run(resetRow.id);
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
    })();

    res.json({ message: 'Password updated successfully. Please sign in.' });
  });

  app.post('/api/auth/delete-account', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const ownedActive = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM trips WHERE owner_id = ? AND status NOT IN ('completed', 'archived')`
      )
      .get(userId) as { cnt: number };

    if (ownedActive.cnt > 0) {
      res.status(400).json({
        error:
          'You are currently the Owner of active trips. Transfer ownership or archive those trips before requesting account deletion.',
      });
      return;
    }

    db.prepare(`UPDATE users SET deletion_requested = 1 WHERE id = ?`).run(userId);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    res.json({ message: 'Account deletion request recorded and active sessions closed.' });
  });

  // ============================================================
  // PUBLIC TRIP DISCOVERY ROUTES (STRICT PRIVACY ENFORCED)
  // ============================================================

  app.get('/api/public/trips', optionalAuth, (req: AuthenticatedRequest, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';
    const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let sql = `
      SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.description, t.cover_image,
             t.status, t.show_member_count, u.name AS owner_name,
             CASE WHEN t.show_member_count = 1
                  THEN (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id AND tm.status = 'active')
                  ELSE NULL END AS member_count
      FROM trips t
      JOIN users u ON u.id = t.owner_id
      WHERE t.visibility = 'public' AND t.status != 'archived'
    `;
    const params: unknown[] = [];

    if (statusFilter !== 'all') {
      sql += ` AND t.status = ?`;
      params.push(statusFilter);
    }
    if (search) {
      sql += ` AND (LOWER(t.name) LIKE ? OR LOWER(t.destination) LIKE ? OR LOWER(t.description) LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += ` ORDER BY t.created_at DESC`;
    const trips = db.prepare(sql).all(...params);
    res.json({ trips });
  });

  app.get('/api/public/trips/:tripId', optionalAuth, (req: AuthenticatedRequest, res) => {
    const tripId = Number(req.params.tripId);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(400).json({ error: 'Invalid trip ID.' });
      return;
    }

    const trip = db
      .prepare(
        `SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.description, t.cover_image,
                t.status, t.visibility, t.show_member_count, u.name AS owner_name,
                CASE WHEN t.show_member_count = 1
                     THEN (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id AND tm.status = 'active')
                     ELSE NULL END AS member_count
         FROM trips t
         JOIN users u ON u.id = t.owner_id
         WHERE t.id = ? AND t.visibility = 'public'`
      )
      .get(tripId);

    if (!trip) {
      res.status(404).json({ error: 'Public trip not found.' });
      return;
    }

    let membershipStatus: 'none' | 'member' | 'pending_request' | 'rejected_request' = 'none';
    if (req.user) {
      const mem = db
        .prepare(`SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = 'active'`)
        .get(tripId, req.user.id);
      if (mem) {
        membershipStatus = 'member';
      } else {
        const jr = db
          .prepare(
            `SELECT status FROM join_requests WHERE trip_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1`
          )
          .get(tripId, req.user.id) as { status: string } | undefined;
        if (jr?.status === 'pending') membershipStatus = 'pending_request';
        else if (jr?.status === 'rejected') membershipStatus = 'rejected_request';
      }
    }

    // Strict privacy: never return financial data, member emails, notes, or logs on public endpoint
    res.json({ trip, membershipStatus });
  });

  app.post('/api/public/trips/:tripId/join', requireAuth, (req: AuthenticatedRequest, res) => {
    const tripId = Number(req.params.tripId);
    const userId = req.user!.id;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    const trip = db
      .prepare(`SELECT id, name, visibility, status, owner_id FROM trips WHERE id = ?`)
      .get(tripId) as
      | { id: number; name: string; visibility: string; status: string; owner_id: number }
      | undefined;

    if (!trip || trip.visibility !== 'public' || trip.status === 'archived') {
      res.status(404).json({ error: 'This trip is not open for public join requests.' });
      return;
    }

    const existingMember = db
      .prepare(`SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = 'active'`)
      .get(tripId, userId);
    if (existingMember) {
      res.status(400).json({ error: 'You are already a member of this trip.' });
      return;
    }

    const pendingReq = db
      .prepare(`SELECT id FROM join_requests WHERE trip_id = ? AND user_id = ? AND status = 'pending'`)
      .get(tripId, userId);
    if (pendingReq) {
      res.status(409).json({ error: 'You already have a pending join request for this trip.' });
      return;
    }

    const result = db
      .prepare(`INSERT INTO join_requests (trip_id, user_id, message, status) VALUES (?, ?, ?, 'pending')`)
      .run(tripId, userId, message);

    // Notify Owner and Admins with manage_members permission
    const admins = db
      .prepare(
        `SELECT tm.user_id FROM trip_members tm
         LEFT JOIN admin_permissions ap ON ap.trip_id = tm.trip_id AND ap.user_id = tm.user_id
         WHERE tm.trip_id = ? AND tm.status = 'active'
           AND (tm.role = 'owner' OR (tm.role = 'admin' AND ap.can_manage_members = 1))`
      )
      .all(tripId) as Array<{ user_id: number }>;

    for (const a of admins) {
      createNotification(db, {
        userId: a.user_id,
        tripId,
        type: 'join_request',
        title: 'New Join Request',
        message: `${req.user!.name} requested to join "${trip.name}".`,
      });
    }

    res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending' });
  });

  // ============================================================
  // PERSONAL DASHBOARD, NOTIFICATIONS, INVITATIONS, CREATE TRIP
  // ============================================================

  app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;

    const myTrips = db
      .prepare(
        `SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.description, t.cover_image,
                t.visibility, t.status, t.estimated_budget_minor, t.expected_per_member_minor,
                tm.role,
                (SELECT COUNT(*) FROM trip_members m2 WHERE m2.trip_id = t.id AND m2.status = 'active') AS member_count
         FROM trip_members tm
         JOIN trips t ON t.id = tm.trip_id
         WHERE tm.user_id = ? AND tm.status = 'active'
         ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'planning' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END, t.start_date ASC`
      )
      .all(userId) as Array<Record<string, unknown> & { id: number; status: string }>;

    const pendingInvitations = db
      .prepare(
        `SELECT ti.id, ti.trip_id, t.name AS trip_name, t.destination, t.start_date, t.end_date,
                u.name AS invited_by_name, ti.created_at
         FROM trip_invitations ti
         JOIN trips t ON t.id = ti.trip_id
         JOIN users u ON u.id = ti.invited_by
         WHERE (ti.invited_user_id = ? OR LOWER(ti.invited_email) = ?) AND ti.status = 'pending'
         ORDER BY ti.created_at DESC`
      )
      .all(userId, req.user!.email.toLowerCase());

    const pendingJoinRequestsSent = db
      .prepare(
        `SELECT jr.id, jr.trip_id, t.name AS trip_name, t.destination, jr.status, jr.created_at
         FROM join_requests jr
         JOIN trips t ON t.id = jr.trip_id
         WHERE jr.user_id = ? AND jr.status = 'pending'
         ORDER BY jr.created_at DESC`
      )
      .all(userId);

    const pendingOwnershipTransfers = db
      .prepare(
        `SELECT ot.id, ot.trip_id, t.name AS trip_name, u.name AS from_user_name, ot.previous_owner_new_role, ot.created_at
         FROM ownership_transfers ot
         JOIN trips t ON t.id = ot.trip_id
         JOIN users u ON u.id = ot.from_user_id
         WHERE ot.to_user_id = ? AND ot.status = 'pending'`
      )
      .all(userId);

    const recentActivities = db
      .prepare(
        `SELECT al.id, al.trip_id, t.name AS trip_name, al.action_type, al.summary, al.created_at, u.name AS actor_name
         FROM activity_logs al
         JOIN trips t ON t.id = al.trip_id
         JOIN users u ON u.id = al.user_id
         WHERE al.trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ? AND status = 'active')
         ORDER BY al.id DESC LIMIT 12`
      )
      .all(userId);

    const unreadNotifications = (
      db
        .prepare(`SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0`)
        .get(userId) as { cnt: number }
    ).cnt;

    // Personal pending reimbursements / net receivables across trips
    let personalReceivableMinor = 0;
    for (const trip of myTrips) {
      const settlement = computeTripSettlement(db, trip.id);
      const mine = settlement.members.find((m) => m.userId === userId);
      if (mine && mine.netBalanceMinor > 0) {
        personalReceivableMinor += mine.netBalanceMinor;
      }
    }

    res.json({
      stats: {
        totalJoinedTrips: myTrips.length,
        activeTrips: myTrips.filter((t) => t.status === 'active' || t.status === 'upcoming').length,
        pendingRequestsAndInvites: pendingInvitations.length + pendingJoinRequestsSent.length,
        personalReceivableMinor,
        unreadNotifications,
      },
      myTrips,
      pendingInvitations,
      pendingJoinRequestsSent,
      pendingOwnershipTransfers,
      recentActivities,
    });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT n.*, t.name AS trip_name
         FROM notifications n
         LEFT JOIN trips t ON t.id = n.trip_id
         WHERE n.user_id = ?
         ORDER BY n.id DESC LIMIT 50`
      )
      .all(req.user!.id);
    res.json({ notifications: rows });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(
      Number(req.params.id),
      req.user!.id
    );
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user!.id);
    res.json({ ok: true });
  });

  app.post('/api/invitations/:inviteId/respond', requireAuth, (req: AuthenticatedRequest, res) => {
    const inviteId = Number(req.params.inviteId);
    const { action } = req.body ?? {};
    if (action !== 'accept' && action !== 'decline') {
      res.status(400).json({ error: 'Action must be accept or decline.' });
      return;
    }

    const invite = db
      .prepare(`SELECT * FROM trip_invitations WHERE id = ? AND status = 'pending'`)
      .get(inviteId) as
      | { id: number; trip_id: number; invited_user_id: number | null; invited_email: string }
      | undefined;

    if (
      !invite ||
      (invite.invited_user_id !== req.user!.id &&
        invite.invited_email.toLowerCase() !== req.user!.email.toLowerCase())
    ) {
      res.status(404).json({ error: 'Invitation not found.' });
      return;
    }

    db.transaction(() => {
      db.prepare(`UPDATE trip_invitations SET status = ?, invited_user_id = ? WHERE id = ?`).run(
        action === 'accept' ? 'accepted' : 'declined',
        req.user!.id,
        inviteId
      );

      if (action === 'accept') {
        db.prepare(
          `INSERT INTO trip_members (trip_id, user_id, role, status)
           VALUES (?, ?, 'member', 'active')
           ON CONFLICT(trip_id, user_id) DO UPDATE SET status = 'active', role = 'member'`
        ).run(invite.trip_id, req.user!.id);

        logActivity(db, {
          tripId: invite.trip_id,
          userId: req.user!.id,
          actionType: 'member_joined',
          recordType: 'member',
          recordId: req.user!.id,
          summary: `${req.user!.name} accepted trip invitation and joined as Member.`,
        });
      }
    })();

    res.json({ ok: true, status: action === 'accept' ? 'accepted' : 'declined' });
  });

  app.post('/api/trips', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const {
        name,
        destination,
        start_date,
        end_date,
        description,
        cover_image,
        visibility,
        estimated_budget,
        expected_per_member,
      } = req.body ?? {};

      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: 'Trip name is required.' });
        return;
      }
      if (typeof destination !== 'string' || destination.trim().length < 2) {
        res.status(400).json({ error: 'Destination is required.' });
        return;
      }
      if (!start_date || !end_date) {
        res.status(400).json({ error: 'Start and ending dates are required.' });
        return;
      }

      const vis = visibility === 'public' ? 'public' : 'private';
      const estMinor = Math.max(0, Math.round((Number(estimated_budget) || 0) * 100));
      const perMinor = Math.max(0, Math.round((Number(expected_per_member) || 0) * 100));
      const cleanCover = cover_image
        ? sanitizeImageUrl(cover_image)
        : '/src/assets/images/trip_cover_mountains_1795281225911.jpg';

      let createdTripId = 0;
      db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO trips (name, destination, start_date, end_date, description, cover_image, visibility, status, estimated_budget_minor, expected_per_member_minor, owner_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?)`
          )
          .run(
            name.trim(),
            destination.trim(),
            String(start_date),
            String(end_date),
            typeof description === 'string' ? description.trim() : '',
            cleanCover,
            vis,
            estMinor,
            perMinor,
            req.user!.id
          );
        createdTripId = Number(result.lastInsertRowid);

        db.prepare(
          `INSERT INTO trip_members (trip_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`
        ).run(createdTripId, req.user!.id);

        logActivity(db, {
          tripId: createdTripId,
          userId: req.user!.id,
          actionType: 'trip_created',
          recordType: 'trip',
          recordId: createdTripId,
          summary: `Created trip "${name.trim()}" (${vis}).`,
        });
      })();

      res.status(201).json({ id: createdTripId });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // ============================================================
  // TRIP WORKSPACE ROUTES (MEMBER + RBAC ENFORCED)
  // ============================================================

  app.get('/api/trips/:tripId', requireAuth, requireTripMember, (req: AuthenticatedRequest, res) => {
    const tripId = Number(req.params.tripId);
    const trip = db
      .prepare(
        `SELECT t.*, u.name AS owner_name
         FROM trips t
         JOIN users u ON u.id = t.owner_id
         WHERE t.id = ?`
      )
      .get(tripId);

    const summary = computeTripFinanceSummary(db, tripId);

    const members = db
      .prepare(
        `SELECT tm.id, tm.user_id, tm.role, tm.status, tm.joined_at,
                u.name, u.email, u.phone, u.avatar_url,
                ap.can_manage_members, ap.can_approve_expenses, ap.can_manage_contributions,
                ap.can_edit_expenses, ap.can_manage_notes, ap.can_publish_announcements,
                ap.can_view_reports, ap.can_manage_schedule
         FROM trip_members tm
         JOIN users u ON u.id = tm.user_id
         LEFT JOIN admin_permissions ap ON ap.trip_id = tm.trip_id AND ap.user_id = tm.user_id
         WHERE tm.trip_id = ? AND tm.status = 'active'
         ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name ASC`
      )
      .all(tripId);

    const pendingOwnershipTransfer = db
      .prepare(
        `SELECT ot.*, u.name AS to_user_name
         FROM ownership_transfers ot
         JOIN users u ON u.id = ot.to_user_id
         WHERE ot.trip_id = ? AND ot.status = 'pending'
         ORDER BY ot.id DESC LIMIT 1`
      )
      .get(tripId);

    res.json({
      trip,
      membership: req.tripContext,
      summary,
      members,
      pendingOwnershipTransfer: pendingOwnershipTransfer ?? null,
    });
  });

  // ---- Trip Settings (Owner Only) ----
  app.patch(
    '/api/trips/:tripId/settings',
    requireAuth,
    requireTripMember,
    requireTripOwner,
    (req: AuthenticatedRequest, res) => {
      try {
        const tripId = Number(req.params.tripId);
        const existing = db.prepare(`SELECT * FROM trips WHERE id = ?`).get(tripId) as Record<
          string,
          unknown
        >;
        const {
          name,
          destination,
          start_date,
          end_date,
          description,
          cover_image,
          visibility,
          show_member_count,
          status,
          estimated_budget,
          expected_per_member,
        } = req.body ?? {};

        const validStatuses = ['planning', 'upcoming', 'active', 'completed', 'archived'];
        const nextStatus = validStatuses.includes(status) ? status : String(existing.status);
        const nextVis =
          visibility === 'public' || visibility === 'private'
            ? visibility
            : String(existing.visibility);
        const nextCover =
          cover_image !== undefined ? sanitizeImageUrl(cover_image) : String(existing.cover_image);

        db.prepare(
          `UPDATE trips
           SET name = ?, destination = ?, start_date = ?, end_date = ?, description = ?,
               cover_image = ?, visibility = ?, show_member_count = ?, status = ?,
               estimated_budget_minor = ?, expected_per_member_minor = ?
           WHERE id = ?`
        ).run(
          typeof name === 'string' && name.trim() ? name.trim() : existing.name,
          typeof destination === 'string' && destination.trim()
            ? destination.trim()
            : existing.destination,
          start_date || existing.start_date,
          end_date || existing.end_date,
          typeof description === 'string' ? description.trim() : existing.description,
          nextCover,
          nextVis,
          show_member_count !== undefined
            ? show_member_count
              ? 1
              : 0
            : existing.show_member_count,
          nextStatus,
          estimated_budget !== undefined
            ? Math.max(0, Math.round(Number(estimated_budget) * 100))
            : existing.estimated_budget_minor,
          expected_per_member !== undefined
            ? Math.max(0, Math.round(Number(expected_per_member) * 100))
            : existing.expected_per_member_minor,
          tripId
        );

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: 'trip_settings_updated',
          recordType: 'trip',
          recordId: tripId,
          summary: `Updated trip settings (status: ${nextStatus}, visibility: ${nextVis}).`,
          previousValues: { status: existing.status, visibility: existing.visibility },
          newValues: { status: nextStatus, visibility: nextVis },
        });

        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // ---- Members, Join Requests & Admin Permissions ----
  app.get(
    '/api/trips/:tripId/join-requests',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_members'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const requests = db
        .prepare(
          `SELECT jr.*, u.name AS user_name, u.email AS user_email
           FROM join_requests jr
           JOIN users u ON u.id = jr.user_id
           WHERE jr.trip_id = ?
           ORDER BY CASE jr.status WHEN 'pending' THEN 0 ELSE 1 END, jr.created_at DESC`
        )
        .all(tripId);
      res.json({ requests });
    }
  );

  app.post(
    '/api/trips/:tripId/join-requests/:reqId/review',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_members'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const reqId = Number(req.params.reqId);
      const { decision, rejection_reason } = req.body ?? {};
      if (decision !== 'approved' && decision !== 'rejected') {
        res.status(400).json({ error: 'Decision must be approved or rejected.' });
        return;
      }

      const jr = db
        .prepare(
          `SELECT jr.*, u.name AS requester_name, t.name AS trip_name
           FROM join_requests jr
           JOIN users u ON u.id = jr.user_id
           JOIN trips t ON t.id = jr.trip_id
           WHERE jr.id = ? AND jr.trip_id = ? AND jr.status = 'pending'`
        )
        .get(reqId, tripId) as
        | { id: number; user_id: number; requester_name: string; trip_name: string }
        | undefined;

      if (!jr) {
        res.status(404).json({ error: 'Pending join request not found.' });
        return;
      }

      db.transaction(() => {
        db.prepare(
          `UPDATE join_requests
           SET status = ?, reviewed_by = ?, rejection_reason = ?, reviewed_at = datetime('now')
           WHERE id = ?`
        ).run(
          decision,
          req.user!.id,
          typeof rejection_reason === 'string' ? rejection_reason.trim() : '',
          reqId
        );

        if (decision === 'approved') {
          db.prepare(
            `INSERT INTO trip_members (trip_id, user_id, role, status)
             VALUES (?, ?, 'member', 'active')
             ON CONFLICT(trip_id, user_id) DO UPDATE SET status = 'active', role = 'member'`
          ).run(tripId, jr.user_id);
        }

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: `join_request_${decision}`,
          recordType: 'join_request',
          recordId: reqId,
          summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} join request from ${jr.requester_name}.`,
        });

        createNotification(db, {
          userId: jr.user_id,
          tripId,
          type: 'join_request_decision',
          title: `Join Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
          message:
            decision === 'approved'
              ? `Your request to join "${jr.trip_name}" was approved.`
              : `Your request to join "${jr.trip_name}" was declined.`,
        });
      })();

      res.json({ ok: true });
    }
  );

  app.post(
    '/api/trips/:tripId/members/invite',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_members'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { email } = req.body ?? {};
      if (typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const targetUser = db
        .prepare(`SELECT id, name FROM users WHERE email = ? AND deletion_requested = 0`)
        .get(cleanEmail) as { id: number; name: string } | undefined;

      if (targetUser) {
        const alreadyMember = db
          .prepare(`SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = 'active'`)
          .get(tripId, targetUser.id);
        if (alreadyMember) {
          res.status(400).json({ error: 'This user is already an active member of the trip.' });
          return;
        }
      }

      const pendingInvite = db
        .prepare(
          `SELECT id FROM trip_invitations WHERE trip_id = ? AND invited_email = ? AND status = 'pending'`
        )
        .get(tripId, cleanEmail);
      if (pendingInvite) {
        res.status(409).json({ error: 'An invitation is already pending for this email.' });
        return;
      }

      const trip = db.prepare(`SELECT name FROM trips WHERE id = ?`).get(tripId) as { name: string };
      const result = db
        .prepare(
          `INSERT INTO trip_invitations (trip_id, invited_email, invited_user_id, invited_by, status)
           VALUES (?, ?, ?, ?, 'pending')`
        )
        .run(tripId, cleanEmail, targetUser?.id ?? null, req.user!.id);

      if (targetUser) {
        createNotification(db, {
          userId: targetUser.id,
          tripId,
          type: 'invitation',
          title: 'Trip Invitation',
          message: `${req.user!.name} invited you to join "${trip.name}".`,
        });
      }

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'member_invited',
        recordType: 'invitation',
        recordId: Number(result.lastInsertRowid),
        summary: `Invited ${cleanEmail} to join the trip.`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  app.get(
    '/api/trips/:tripId/invitations',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_members'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const invitations = db
        .prepare(
          `SELECT ti.*, u.name AS invited_by_name
           FROM trip_invitations ti
           JOIN users u ON u.id = ti.invited_by
           WHERE ti.trip_id = ?
           ORDER BY ti.created_at DESC`
        )
        .all(tripId);
      res.json({ invitations });
    }
  );

  app.patch(
    '/api/trips/:tripId/members/:userId/role',
    requireAuth,
    requireTripMember,
    requireTripOwner,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const targetUserId = Number(req.params.userId);
      const { role } = req.body ?? {};
      if (role !== 'admin' && role !== 'member') {
        res.status(400).json({ error: 'Role must be admin or member. Use Ownership Transfer to assign Owner.' });
        return;
      }
      if (targetUserId === req.user!.id) {
        res.status(400).json({ error: 'Owner cannot demote themselves directly. Use Ownership Transfer.' });
        return;
      }

      const target = db
        .prepare(
          `SELECT tm.role, u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`
        )
        .get(tripId, targetUserId) as { role: string; name: string } | undefined;

      if (!target) {
        res.status(404).json({ error: 'Active member not found.' });
        return;
      }

      db.transaction(() => {
        db.prepare(`UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ?`).run(
          role,
          tripId,
          targetUserId
        );
        if (role === 'admin') {
          db.prepare(
            `INSERT INTO admin_permissions (trip_id, user_id, can_view_reports)
             VALUES (?, ?, 1)
             ON CONFLICT(trip_id, user_id) DO NOTHING`
          ).run(tripId, targetUserId);
        } else {
          db.prepare(`DELETE FROM admin_permissions WHERE trip_id = ? AND user_id = ?`).run(
            tripId,
            targetUserId
          );
        }

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: 'role_changed',
          recordType: 'member',
          recordId: targetUserId,
          summary: `Changed ${target.name}'s role from ${target.role} to ${role}.`,
          previousValues: { role: target.role },
          newValues: { role },
        });
      })();

      res.json({ ok: true });
    }
  );

  app.patch(
    '/api/trips/:tripId/members/:userId/permissions',
    requireAuth,
    requireTripMember,
    requireTripOwner,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const targetUserId = Number(req.params.userId);
      const member = db
        .prepare(
          `SELECT tm.role, u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`
        )
        .get(tripId, targetUserId) as { role: string; name: string } | undefined;

      if (!member || member.role !== 'admin') {
        res.status(400).json({ error: 'Permissions can only be configured for active Admins.' });
        return;
      }

      const p = req.body ?? {};
      db.prepare(
        `INSERT INTO admin_permissions (
           trip_id, user_id, can_manage_members, can_approve_expenses, can_manage_contributions,
           can_edit_expenses, can_manage_notes, can_publish_announcements, can_view_reports, can_manage_schedule
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(trip_id, user_id) DO UPDATE SET
           can_manage_members = excluded.can_manage_members,
           can_approve_expenses = excluded.can_approve_expenses,
           can_manage_contributions = excluded.can_manage_contributions,
           can_edit_expenses = excluded.can_edit_expenses,
           can_manage_notes = excluded.can_manage_notes,
           can_publish_announcements = excluded.can_publish_announcements,
           can_view_reports = excluded.can_view_reports,
           can_manage_schedule = excluded.can_manage_schedule`
      ).run(
        tripId,
        targetUserId,
        p.can_manage_members ? 1 : 0,
        p.can_approve_expenses ? 1 : 0,
        p.can_manage_contributions ? 1 : 0,
        p.can_edit_expenses ? 1 : 0,
        p.can_manage_notes ? 1 : 0,
        p.can_publish_announcements ? 1 : 0,
        p.can_view_reports !== false ? 1 : 0,
        p.can_manage_schedule ? 1 : 0
      );

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'admin_permissions_updated',
        recordType: 'admin_permissions',
        recordId: targetUserId,
        summary: `Updated Admin permissions for ${member.name}.`,
        newValues: p,
      });

      res.json({ ok: true });
    }
  );

  app.delete(
    '/api/trips/:tripId/members/:userId',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_members'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const targetUserId = Number(req.params.userId);
      const target = db
        .prepare(
          `SELECT tm.role, u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`
        )
        .get(tripId, targetUserId) as { role: string; name: string } | undefined;

      if (!target) {
        res.status(404).json({ error: 'Member not found.' });
        return;
      }
      if (target.role === 'owner') {
        res.status(400).json({ error: 'The trip Owner cannot be removed.' });
        return;
      }
      if (target.role === 'admin' && req.tripContext!.role !== 'owner') {
        res.status(403).json({ error: 'Only the Owner can remove an Admin.' });
        return;
      }

      db.transaction(() => {
        db.prepare(`UPDATE trip_members SET status = 'removed' WHERE trip_id = ? AND user_id = ?`).run(
          tripId,
          targetUserId
        );
        db.prepare(`DELETE FROM admin_permissions WHERE trip_id = ? AND user_id = ?`).run(
          tripId,
          targetUserId
        );
        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: 'member_removed',
          recordType: 'member',
          recordId: targetUserId,
          summary: `Removed ${target.name} from the trip.`,
        });
      })();

      res.json({ ok: true });
    }
  );

  // ---- Ownership Transfer ----
  app.post(
    '/api/trips/:tripId/ownership-transfer',
    requireAuth,
    requireTripMember,
    requireTripOwner,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { to_user_id, previous_owner_new_role } = req.body ?? {};
      const targetUserId = Number(to_user_id);
      const newRole = previous_owner_new_role === 'member' ? 'member' : 'admin';

      if (targetUserId === req.user!.id) {
        res.status(400).json({ error: 'Select another active member to transfer ownership to.' });
        return;
      }

      const targetMember = db
        .prepare(
          `SELECT u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`
        )
        .get(tripId, targetUserId) as { name: string } | undefined;

      if (!targetMember) {
        res.status(404).json({ error: 'Target member must be an active member of this trip.' });
        return;
      }

      const trip = db.prepare(`SELECT name FROM trips WHERE id = ?`).get(tripId) as { name: string };

      db.transaction(() => {
        db.prepare(
          `UPDATE ownership_transfers SET status = 'cancelled' WHERE trip_id = ? AND status = 'pending'`
        ).run(tripId);

        const result = db
          .prepare(
            `INSERT INTO ownership_transfers (trip_id, from_user_id, to_user_id, previous_owner_new_role, status)
             VALUES (?, ?, ?, ?, 'pending')`
          )
          .run(tripId, req.user!.id, targetUserId, newRole);

        createNotification(db, {
          userId: targetUserId,
          tripId,
          type: 'ownership_transfer',
          title: 'Ownership Transfer Request',
          message: `${req.user!.name} requested to transfer ownership of "${trip.name}" to you.`,
        });

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: 'ownership_transfer_requested',
          recordType: 'ownership_transfer',
          recordId: Number(result.lastInsertRowid),
          summary: `Initiated ownership transfer request to ${targetMember.name}.`,
        });
      })();

      res.status(201).json({ ok: true });
    }
  );

  app.post(
    '/api/trips/:tripId/ownership-transfer/:transferId/respond',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const transferId = Number(req.params.transferId);
      const { action } = req.body ?? {};
      if (action !== 'accept' && action !== 'reject') {
        res.status(400).json({ error: 'Action must be accept or reject.' });
        return;
      }

      const transfer = db
        .prepare(
          `SELECT * FROM ownership_transfers WHERE id = ? AND trip_id = ? AND to_user_id = ? AND status = 'pending'`
        )
        .get(transferId, tripId, req.user!.id) as
        | { id: number; from_user_id: number; to_user_id: number; previous_owner_new_role: 'admin' | 'member' }
        | undefined;

      if (!transfer) {
        res.status(404).json({ error: 'Pending ownership transfer request not found.' });
        return;
      }

      db.transaction(() => {
        db.prepare(
          `UPDATE ownership_transfers SET status = ?, responded_at = datetime('now') WHERE id = ?`
        ).run(action === 'accept' ? 'accepted' : 'rejected', transferId);

        if (action === 'accept') {
          db.prepare(`UPDATE trips SET owner_id = ? WHERE id = ?`).run(transfer.to_user_id, tripId);
          db.prepare(`UPDATE trip_members SET role = 'owner' WHERE trip_id = ? AND user_id = ?`).run(
            tripId,
            transfer.to_user_id
          );
          db.prepare(`DELETE FROM admin_permissions WHERE trip_id = ? AND user_id = ?`).run(
            tripId,
            transfer.to_user_id
          );
          db.prepare(`UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ?`).run(
            transfer.previous_owner_new_role,
            tripId,
            transfer.from_user_id
          );
          if (transfer.previous_owner_new_role === 'admin') {
            db.prepare(
              `INSERT INTO admin_permissions (trip_id, user_id, can_manage_members, can_approve_expenses, can_manage_contributions, can_edit_expenses, can_manage_notes, can_publish_announcements, can_view_reports, can_manage_schedule)
               VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1)
               ON CONFLICT(trip_id, user_id) DO NOTHING`
            ).run(tripId, transfer.from_user_id);
          }

          logActivity(db, {
            tripId,
            userId: req.user!.id,
            actionType: 'ownership_transferred',
            recordType: 'ownership_transfer',
            recordId: transferId,
            summary: `${req.user!.name} accepted trip ownership. Previous owner became ${transfer.previous_owner_new_role}.`,
          });
        } else {
          logActivity(db, {
            tripId,
            userId: req.user!.id,
            actionType: 'ownership_transfer_rejected',
            recordType: 'ownership_transfer',
            recordId: transferId,
            summary: `${req.user!.name} declined the ownership transfer request.`,
          });
        }
      })();

      res.json({ ok: true });
    }
  );

  // ---- Contributions ----
  app.get(
    '/api/trips/:tripId/contributions',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const contributions = db
        .prepare(
          `SELECT c.*, mu.name AS member_name, ru.name AS recorded_by_name, vu.name AS verified_by_name
           FROM contributions c
           JOIN users mu ON mu.id = c.member_id
           JOIN users ru ON ru.id = c.recorded_by
           LEFT JOIN users vu ON vu.id = c.verified_by
           WHERE c.trip_id = ?
           ORDER BY c.contribution_date DESC, c.id DESC`
        )
        .all(tripId);
      res.json({ contributions });
    }
  );

  app.post(
    '/api/trips/:tripId/contributions',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      if (isTripFinanciallyLocked(req.tripContext!.tripStatus)) {
        res.status(400).json({ error: 'Financial records are locked on completed or archived trips.' });
        return;
      }

      const { member_id, amount, contribution_date, payment_method, note, auto_verify } =
        req.body ?? {};
      const amountMinor = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        res.status(400).json({ error: 'Contribution amount must be greater than zero.' });
        return;
      }

      const canManage =
        req.tripContext!.role === 'owner' || req.tripContext!.permissions.can_manage_contributions;
      const targetMemberId = canManage && member_id ? Number(member_id) : req.user!.id;

      const activeMember = db
        .prepare(`SELECT u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`)
        .get(tripId, targetMemberId) as { name: string } | undefined;

      if (!activeMember) {
        res.status(400).json({ error: 'Contributor must be an active member of this trip.' });
        return;
      }

      // A contribution is only marked verified if recorded & verified by an authorized Admin/Owner;
      // regular member submissions stay 'pending' until verified (SRS Section 11).
      const status = canManage && auto_verify !== false ? 'verified' : 'pending';
      const dateStr =
        typeof contribution_date === 'string' && contribution_date
          ? contribution_date
          : new Date().toISOString().slice(0, 10);

      const result = db
        .prepare(
          `INSERT INTO contributions (trip_id, member_id, amount_minor, contribution_date, payment_method, recorded_by, note, status, verified_by, verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          tripId,
          targetMemberId,
          amountMinor,
          dateStr,
          typeof payment_method === 'string' && payment_method.trim() ? payment_method.trim() : 'Cash',
          req.user!.id,
          typeof note === 'string' ? note.trim() : '',
          status,
          status === 'verified' ? req.user!.id : null,
          status === 'verified' ? new Date().toISOString() : null
        );

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: status === 'verified' ? 'contribution_verified' : 'contribution_submitted',
        recordType: 'contribution',
        recordId: Number(result.lastInsertRowid),
        summary: `${status === 'verified' ? 'Recorded & verified' : 'Submitted pending'} contribution of ৳${(amountMinor / 100).toLocaleString()} for ${activeMember.name}.`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid), status });
    }
  );

  app.patch(
    '/api/trips/:tripId/contributions/:contribId/verify',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_contributions'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const contribId = Number(req.params.contribId);
      if (isTripFinanciallyLocked(req.tripContext!.tripStatus)) {
        res.status(400).json({ error: 'Trip is completed or archived.' });
        return;
      }

      const { status } = req.body ?? {};
      if (status !== 'verified' && status !== 'rejected') {
        res.status(400).json({ error: 'Status must be verified or rejected.' });
        return;
      }

      const existing = db
        .prepare(
          `SELECT c.*, u.name AS member_name FROM contributions c JOIN users u ON u.id = c.member_id WHERE c.id = ? AND c.trip_id = ?`
        )
        .get(contribId, tripId) as
        | { id: number; status: string; amount_minor: number; member_id: number; member_name: string }
        | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Contribution record not found.' });
        return;
      }

      db.prepare(
        `UPDATE contributions SET status = ?, verified_by = ?, verified_at = datetime('now') WHERE id = ?`
      ).run(status, req.user!.id, contribId);

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: `contribution_${status}`,
        recordType: 'contribution',
        recordId: contribId,
        summary: `Marked ${existing.member_name}'s contribution (৳${(existing.amount_minor / 100).toLocaleString()}) as ${status}.`,
        previousValues: { status: existing.status },
        newValues: { status },
      });

      createNotification(db, {
        userId: existing.member_id,
        tripId,
        type: 'contribution_update',
        title: `Contribution ${status === 'verified' ? 'Verified' : 'Rejected'}`,
        message: `Your contribution of ৳${(existing.amount_minor / 100).toLocaleString()} was ${status}.`,
      });

      res.json({ ok: true });
    }
  );

  // ---- Categories & Expenses ----
  app.get(
    '/api/trips/:tripId/categories',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const customRows = db
        .prepare(`SELECT name FROM expense_categories WHERE trip_id = ? ORDER BY name ASC`)
        .all(tripId) as Array<{ name: string }>;
      const categories = Array.from(
        new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customRows.map((r) => r.name)])
      );
      res.json({ categories });
    }
  );

  app.post(
    '/api/trips/:tripId/categories',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_edit_expenses'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (name.length < 2) {
        res.status(400).json({ error: 'Category name must be at least 2 characters.' });
        return;
      }
      db.prepare(`INSERT INTO expense_categories (trip_id, name, is_default) VALUES (?, ?, 0)`).run(
        tripId,
        name
      );
      res.status(201).json({ name });
    }
  );

  app.get(
    '/api/trips/:tripId/expenses',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const expenses = db
        .prepare(
          `SELECT e.*,
                  pu.name AS paid_by_name,
                  su.name AS submitted_by_name,
                  au.name AS approved_by_name
           FROM expenses e
           JOIN users pu ON pu.id = e.paid_by_member_id
           JOIN users su ON su.id = e.submitted_by
           LEFT JOIN users au ON au.id = e.approved_by
           WHERE e.trip_id = ?
           ORDER BY e.expense_date DESC, e.id DESC`
        )
        .all(tripId) as Array<Record<string, unknown> & { id: number }>;

      const participantStmt = db.prepare(
        `SELECT ep.member_id, ep.share_minor, u.name AS member_name
         FROM expense_participants ep
         JOIN users u ON u.id = ep.member_id
         WHERE ep.expense_id = ?
         ORDER BY u.name ASC`
      );

      const enriched = expenses.map((e) => ({
        ...e,
        participants: participantStmt.all(e.id),
      }));

      res.json({ expenses: enriched });
    }
  );

  app.post(
    '/api/trips/:tripId/expenses',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      try {
        const tripId = Number(req.params.tripId);
        if (isTripFinanciallyLocked(req.tripContext!.tripStatus)) {
          res.status(400).json({ error: 'Expenses are locked on completed or archived trips.' });
          return;
        }

        const {
          title,
          description,
          amount,
          category,
          expense_date,
          paid_by_member_id,
          payment_source,
          split_type,
          participant_ids,
          custom_shares,
          receipt_note,
          notes,
          auto_approve,
        } = req.body ?? {};

        if (typeof title !== 'string' || title.trim().length < 2) {
          res.status(400).json({ error: 'Expense title is required.' });
          return;
        }
        const amountMinor = Math.round(Number(amount) * 100);
        if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
          res.status(400).json({ error: 'Expense amount must be greater than zero.' });
          return;
        }

        const source = payment_source === 'personal' ? 'personal' : 'group_fund';
        const split = ['equal', 'custom', 'individual', 'participation'].includes(split_type)
          ? (split_type as 'equal' | 'custom' | 'individual' | 'participation')
          : 'equal';

        const activeMemberIds = new Set(getActiveMemberIds(tripId));
        const payerId = Number(paid_by_member_id) || req.user!.id;
        if (!activeMemberIds.has(payerId)) {
          res.status(400).json({ error: 'Payer must be an active member of this trip.' });
          return;
        }

        const rawParticipants: number[] = Array.isArray(participant_ids)
          ? participant_ids.map(Number).filter((id) => activeMemberIds.has(id))
          : Array.from(activeMemberIds);

        const formattedCustomShares = Array.isArray(custom_shares)
          ? custom_shares
              .filter((s) => activeMemberIds.has(Number(s.memberId)))
              .map((s) => ({
                memberId: Number(s.memberId),
                shareMinor: Math.round(Number(s.amount) * 100),
              }))
          : undefined;

        const shares = computeShares(amountMinor, split, rawParticipants, formattedCustomShares);

        const canApprove =
          req.tripContext!.role === 'owner' || req.tripContext!.permissions.can_approve_expenses;
        const status = canApprove && auto_approve === true ? 'approved' : 'pending';

        let expenseId = 0;
        db.transaction(() => {
          const result = db
            .prepare(
              `INSERT INTO expenses (
                 trip_id, title, description, amount_minor, category, expense_date,
                 paid_by_member_id, payment_source, split_type, receipt_note, notes,
                 status, submitted_by, approved_by, approved_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              tripId,
              title.trim(),
              typeof description === 'string' ? description.trim() : '',
              amountMinor,
              typeof category === 'string' && category.trim() ? category.trim() : 'Other Expenses',
              typeof expense_date === 'string' && expense_date
                ? expense_date
                : new Date().toISOString().slice(0, 10),
              payerId,
              source,
              split,
              typeof receipt_note === 'string' ? receipt_note.trim() : '',
              typeof notes === 'string' ? notes.trim() : '',
              status,
              req.user!.id,
              status === 'approved' ? req.user!.id : null,
              status === 'approved' ? new Date().toISOString() : null
            );

          expenseId = Number(result.lastInsertRowid);
          const insertShare = db.prepare(
            `INSERT INTO expense_participants (expense_id, member_id, share_minor) VALUES (?, ?, ?)`
          );
          for (const s of shares) {
            insertShare.run(expenseId, s.memberId, s.shareMinor);
          }

          logActivity(db, {
            tripId,
            userId: req.user!.id,
            actionType: status === 'approved' ? 'expense_approved' : 'expense_submitted',
            recordType: 'expense',
            recordId: expenseId,
            summary: `${status === 'approved' ? 'Recorded & approved' : 'Submitted'} expense "${title.trim()}" (৳${(amountMinor / 100).toLocaleString()}).`,
          });

          if (status === 'pending') {
            const approvers = db
              .prepare(
                `SELECT tm.user_id FROM trip_members tm
                 LEFT JOIN admin_permissions ap ON ap.trip_id = tm.trip_id AND ap.user_id = tm.user_id
                 WHERE tm.trip_id = ? AND tm.status = 'active' AND tm.user_id != ?
                   AND (tm.role = 'owner' OR (tm.role = 'admin' AND ap.can_approve_expenses = 1))`
              )
              .all(tripId, req.user!.id) as Array<{ user_id: number }>;
            for (const a of approvers) {
              createNotification(db, {
                userId: a.user_id,
                tripId,
                type: 'expense_submitted',
                title: 'Expense Pending Review',
                message: `${req.user!.name} submitted "${title.trim()}" (৳${(amountMinor / 100).toLocaleString()}).`,
              });
            }
          }
        })();

        res.status(201).json({ id: expenseId, status });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.patch(
    '/api/trips/:tripId/expenses/:expenseId/review',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const expenseId = Number(req.params.expenseId);
      if (isTripFinanciallyLocked(req.tripContext!.tripStatus)) {
        res.status(400).json({ error: 'Trip is completed or archived.' });
        return;
      }

      const { status, rejection_reason } = req.body ?? {};
      const validStatuses = ['approved', 'rejected', 'needs_correction', 'cancelled'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid review status.' });
        return;
      }

      const existing = db
        .prepare(`SELECT * FROM expenses WHERE id = ? AND trip_id = ?`)
        .get(expenseId, tripId) as
        | { id: number; status: string; title: string; amount_minor: number; submitted_by: number }
        | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Expense not found.' });
        return;
      }

      // Submitter can cancel their own pending expense; otherwise requires can_approve_expenses
      const canApprove =
        req.tripContext!.role === 'owner' || req.tripContext!.permissions.can_approve_expenses;
      if (status === 'cancelled' && existing.submitted_by === req.user!.id && existing.status === 'pending') {
        // allowed
      } else if (!canApprove) {
        res.status(403).json({ error: 'Insufficient permission to review expenses.' });
        return;
      }

      if (existing.status === 'approved') {
        res.status(400).json({
          error: 'Approved financial records cannot be altered directly. Use the Correction Entry workflow.',
        });
        return;
      }

      if (status === 'rejected' && (!rejection_reason || !String(rejection_reason).trim())) {
        res.status(400).json({ error: 'A rejection reason is required.' });
        return;
      }

      db.transaction(() => {
        db.prepare(
          `UPDATE expenses
           SET status = ?, rejection_reason = ?, approved_by = ?, approved_at = ?
           WHERE id = ?`
        ).run(
          status,
          typeof rejection_reason === 'string' ? rejection_reason.trim() : '',
          status === 'approved' ? req.user!.id : null,
          status === 'approved' ? new Date().toISOString() : null,
          expenseId
        );

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: `expense_${status}`,
          recordType: 'expense',
          recordId: expenseId,
          summary: `Marked expense "${existing.title}" (৳${(existing.amount_minor / 100).toLocaleString()}) as ${status}.`,
          previousValues: { status: existing.status },
          newValues: { status, rejection_reason: rejection_reason || '' },
        });

        if (existing.submitted_by !== req.user!.id) {
          createNotification(db, {
            userId: existing.submitted_by,
            tripId,
            type: 'expense_decision',
            title: `Expense ${status.replace('_', ' ')}`,
            message: `Your expense "${existing.title}" was marked ${status.replace('_', ' ')}.`,
          });
        }
      })();

      res.json({ ok: true });
    }
  );

  // Audited correction / adjustment of an approved expense (SRS Section 12: preserves original, records adjustment)
  app.post(
    '/api/trips/:tripId/expenses/:expenseId/correct',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_edit_expenses'),
    (req: AuthenticatedRequest, res) => {
      try {
        const tripId = Number(req.params.tripId);
        const expenseId = Number(req.params.expenseId);
        if (isTripFinanciallyLocked(req.tripContext!.tripStatus)) {
          res.status(400).json({ error: 'Trip is completed or archived.' });
          return;
        }

        const original = db
          .prepare(`SELECT * FROM expenses WHERE id = ? AND trip_id = ? AND status = 'approved'`)
          .get(expenseId, tripId) as
          | {
              id: number;
              title: string;
              amount_minor: number;
              category: string;
              expense_date: string;
              paid_by_member_id: number;
              payment_source: 'group_fund' | 'personal';
              split_type: 'equal' | 'custom' | 'individual' | 'participation';
            }
          | undefined;

        if (!original) {
          res.status(404).json({ error: 'Approved expense not found.' });
          return;
        }

        const { new_amount, reason } = req.body ?? {};
        const newAmountMinor = Math.round(Number(new_amount) * 100);
        if (!Number.isFinite(newAmountMinor) || newAmountMinor < 0) {
          res.status(400).json({ error: 'Corrected amount must be zero or positive.' });
          return;
        }
        if (typeof reason !== 'string' || reason.trim().length < 3) {
          res.status(400).json({ error: 'A clear reason for the correction is required.' });
          return;
        }

        const deltaMinor = newAmountMinor - original.amount_minor;
        if (deltaMinor === 0) {
          res.status(400).json({ error: 'New amount matches existing approved amount.' });
          return;
        }

        const origParticipants = db
          .prepare(`SELECT member_id FROM expense_participants WHERE expense_id = ?`)
          .all(expenseId) as Array<{ member_id: number }>;
        const participantIds = origParticipants.map((p) => p.member_id);
        const adjustmentShares = computeShares(deltaMinor, 'equal', participantIds);

        let adjId = 0;
        db.transaction(() => {
          const result = db
            .prepare(
              `INSERT INTO expenses (
                 trip_id, title, description, amount_minor, category, expense_date,
                 paid_by_member_id, payment_source, split_type, receipt_note, notes,
                 status, submitted_by, approved_by, approved_at, parent_expense_id
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'equal', '', ?, 'approved', ?, ?, datetime('now'), ?)`
            )
            .run(
              tripId,
              `Adjustment: ${original.title}`,
              `Audited correction for expense #${original.id}: ${reason.trim()}`,
              deltaMinor,
              original.category,
              original.expense_date,
              original.paid_by_member_id,
              original.payment_source,
              `Original: ৳${(original.amount_minor / 100).toLocaleString()} → Corrected: ৳${(newAmountMinor / 100).toLocaleString()}`,
              req.user!.id,
              req.user!.id,
              original.id
            );

          adjId = Number(result.lastInsertRowid);
          const ins = db.prepare(
            `INSERT INTO expense_participants (expense_id, member_id, share_minor) VALUES (?, ?, ?)`
          );
          for (const s of adjustmentShares) {
            ins.run(adjId, s.memberId, s.shareMinor);
          }

          logActivity(db, {
            tripId,
            userId: req.user!.id,
            actionType: 'expense_corrected',
            recordType: 'expense',
            recordId: original.id,
            summary: `Created adjustment #${adjId} for "${original.title}": ৳${(original.amount_minor / 100).toLocaleString()} → ৳${(newAmountMinor / 100).toLocaleString()} (${reason.trim()}).`,
            previousValues: { amount_minor: original.amount_minor },
            newValues: { amount_minor: newAmountMinor, adjustment_id: adjId, reason: reason.trim() },
          });
        })();

        res.status(201).json({ adjustmentId: adjId });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // ---- Reimbursements ----
  app.get(
    '/api/trips/:tripId/reimbursements',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const reimbursements = db
        .prepare(
          `SELECT r.*, mu.name AS member_name, ru.name AS recorded_by_name
           FROM reimbursements r
           JOIN users mu ON mu.id = r.member_id
           JOIN users ru ON ru.id = r.recorded_by
           WHERE r.trip_id = ?
           ORDER BY r.payment_date DESC, r.id DESC`
        )
        .all(tripId);

      // Compute personal paid vs reimbursed per member
      const memberBreakdown = db
        .prepare(
          `SELECT tm.user_id AS member_id, u.name AS member_name,
                  COALESCE((SELECT SUM(e.amount_minor) FROM expenses e WHERE e.trip_id = tm.trip_id AND e.paid_by_member_id = tm.user_id AND e.payment_source = 'personal' AND e.status = 'approved'), 0) AS personal_paid_minor,
                  COALESCE((SELECT SUM(r.amount_minor) FROM reimbursements r WHERE r.trip_id = tm.trip_id AND r.member_id = tm.user_id AND r.status = 'completed'), 0) AS reimbursed_minor,
                  COALESCE((SELECT SUM(r.amount_minor) FROM reimbursements r WHERE r.trip_id = tm.trip_id AND r.member_id = tm.user_id AND r.status = 'pending'), 0) AS pending_reimbursement_minor
           FROM trip_members tm
           JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ? AND tm.status = 'active'`
        )
        .all(tripId);

      res.json({ reimbursements, memberBreakdown });
    }
  );

  app.post(
    '/api/trips/:tripId/reimbursements',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_contributions'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      if (isTripFinanciallyLocked(req.tripContext!.tripStatus)) {
        res.status(400).json({ error: 'Trip is completed or archived.' });
        return;
      }

      const { member_id, amount, payment_date, payment_method, note, status } = req.body ?? {};
      const targetId = Number(member_id);
      const amountMinor = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        res.status(400).json({ error: 'Reimbursement amount must be greater than zero.' });
        return;
      }

      const member = db
        .prepare(
          `SELECT u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id
           WHERE tm.trip_id = ? AND tm.user_id = ? AND tm.status = 'active'`
        )
        .get(tripId, targetId) as { name: string } | undefined;

      if (!member) {
        res.status(400).json({ error: 'Recipient must be an active trip member.' });
        return;
      }

      const finalStatus = status === 'pending' ? 'pending' : 'completed';
      const result = db
        .prepare(
          `INSERT INTO reimbursements (trip_id, member_id, amount_minor, payment_date, payment_method, note, status, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          tripId,
          targetId,
          amountMinor,
          typeof payment_date === 'string' && payment_date
            ? payment_date
            : new Date().toISOString().slice(0, 10),
          typeof payment_method === 'string' && payment_method.trim()
            ? payment_method.trim()
            : 'Bank Transfer',
          typeof note === 'string' ? note.trim() : '',
          finalStatus,
          req.user!.id
        );

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'reimbursement_recorded',
        recordType: 'reimbursement',
        recordId: Number(result.lastInsertRowid),
        summary: `Recorded ${finalStatus} reimbursement of ৳${(amountMinor / 100).toLocaleString()} to ${member.name}.`,
      });

      createNotification(db, {
        userId: targetId,
        tripId,
        type: 'reimbursement',
        title: 'Reimbursement Recorded',
        message: `A ${finalStatus} reimbursement of ৳${(amountMinor / 100).toLocaleString()} was recorded for you.`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  app.patch(
    '/api/trips/:tripId/reimbursements/:reimbId/complete',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_contributions'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const reimbId = Number(req.params.reimbId);

      const existing = db
        .prepare(
          `SELECT r.*, u.name AS member_name FROM reimbursements r JOIN users u ON u.id = r.member_id
           WHERE r.id = ? AND r.trip_id = ? AND r.status = 'pending'`
        )
        .get(reimbId, tripId) as
        | { id: number; amount_minor: number; member_id: number; member_name: string }
        | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Pending reimbursement not found.' });
        return;
      }

      db.prepare(`UPDATE reimbursements SET status = 'completed' WHERE id = ?`).run(reimbId);

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'reimbursement_completed',
        recordType: 'reimbursement',
        recordId: reimbId,
        summary: `Completed pending reimbursement of ৳${(existing.amount_minor / 100).toLocaleString()} to ${existing.member_name}.`,
      });

      createNotification(db, {
        userId: existing.member_id,
        tripId,
        type: 'reimbursement',
        title: 'Reimbursement Completed',
        message: `Your reimbursement of ৳${(existing.amount_minor / 100).toLocaleString()} is now completed.`,
      });

      res.json({ ok: true });
    }
  );

  // ---- TripMate Notepad (Separate General Notes & Expense Notes) ----
  app.get(
    '/api/trips/:tripId/notes',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const generalNotes = db
        .prepare(
          `SELECT gn.*, au.name AS author_name, uu.name AS updated_by_name
           FROM general_notes gn
           JOIN users au ON au.id = gn.author_id
           LEFT JOIN users uu ON uu.id = gn.updated_by
           WHERE gn.trip_id = ?
           ORDER BY gn.is_archived ASC, gn.is_pinned DESC, gn.updated_at DESC, gn.id DESC`
        )
        .all(tripId);

      const expenseNotes = db
        .prepare(
          `SELECT en.*, au.name AS author_name, uu.name AS updated_by_name,
                  e.title AS expense_title, e.amount_minor AS expense_amount_minor
           FROM expense_notes en
           JOIN users au ON au.id = en.author_id
           LEFT JOIN users uu ON uu.id = en.updated_by
           LEFT JOIN expenses e ON e.id = en.expense_id
           WHERE en.trip_id = ?
           ORDER BY en.updated_at DESC, en.id DESC`
        )
        .all(tripId);

      const history = db
        .prepare(
          `SELECT nh.*, u.name AS edited_by_name
           FROM note_history nh
           JOIN users u ON u.id = nh.edited_by
           WHERE (nh.note_type = 'general' AND nh.note_id IN (SELECT id FROM general_notes WHERE trip_id = ?))
              OR (nh.note_type = 'expense' AND nh.note_id IN (SELECT id FROM expense_notes WHERE trip_id = ?))
           ORDER BY nh.id DESC`
        )
        .all(tripId, tripId);

      res.json({ generalNotes, expenseNotes, history });
    }
  );

  app.post(
    '/api/trips/:tripId/general-notes',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { title, content, is_pinned } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'Note title and content are required.' });
        return;
      }

      const canPin =
        req.tripContext!.role === 'owner' || req.tripContext!.permissions.can_manage_notes;
      const pinned = canPin && is_pinned ? 1 : 0;

      const result = db
        .prepare(
          `INSERT INTO general_notes (trip_id, title, content, is_pinned, author_id, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(tripId, title.trim(), content.trim(), pinned, req.user!.id, req.user!.id);

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'general_note_created',
        recordType: 'general_note',
        recordId: Number(result.lastInsertRowid),
        summary: `Added General Note "${title.trim()}".`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  app.patch(
    '/api/trips/:tripId/general-notes/:noteId',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const noteId = Number(req.params.noteId);
      const existing = db
        .prepare(`SELECT * FROM general_notes WHERE id = ? AND trip_id = ?`)
        .get(noteId, tripId) as
        | { id: number; title: string; content: string; is_pinned: number; is_archived: number; author_id: number }
        | undefined;

      if (!existing) {
        res.status(404).json({ error: 'General note not found.' });
        return;
      }

      const canManage =
        req.tripContext!.role === 'owner' ||
        req.tripContext!.permissions.can_manage_notes ||
        existing.author_id === req.user!.id;

      if (!canManage) {
        res.status(403).json({ error: 'You do not have permission to edit this note.' });
        return;
      }

      const { title, content, is_pinned, is_archived } = req.body ?? {};
      const nextTitle = typeof title === 'string' && title.trim() ? title.trim() : existing.title;
      const nextContent =
        typeof content === 'string' && content.trim() ? content.trim() : existing.content;
      const nextPinned = is_pinned !== undefined ? (is_pinned ? 1 : 0) : existing.is_pinned;
      const nextArchived = is_archived !== undefined ? (is_archived ? 1 : 0) : existing.is_archived;

      db.transaction(() => {
        if (nextTitle !== existing.title || nextContent !== existing.content) {
          db.prepare(
            `INSERT INTO note_history (note_type, note_id, previous_title, previous_content, edited_by)
             VALUES ('general', ?, ?, ?, ?)`
          ).run(noteId, existing.title, existing.content, req.user!.id);
        }

        db.prepare(
          `UPDATE general_notes
           SET title = ?, content = ?, is_pinned = ?, is_archived = ?, updated_by = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(nextTitle, nextContent, nextPinned, nextArchived, req.user!.id, noteId);

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: 'general_note_updated',
          recordType: 'general_note',
          recordId: noteId,
          summary: `Updated General Note "${nextTitle}".`,
        });
      })();

      res.json({ ok: true });
    }
  );

  app.delete(
    '/api/trips/:tripId/general-notes/:noteId',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_notes'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const noteId = Number(req.params.noteId);
      const existing = db
        .prepare(`SELECT title FROM general_notes WHERE id = ? AND trip_id = ?`)
        .get(noteId, tripId) as { title: string } | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Note not found.' });
        return;
      }
      db.prepare(`DELETE FROM general_notes WHERE id = ?`).run(noteId);
      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'general_note_deleted',
        recordType: 'general_note',
        recordId: noteId,
        summary: `Deleted General Note "${existing.title}".`,
      });
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/trips/:tripId/expense-notes',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { expense_id, title, content } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'Expense note title and description are required.' });
        return;
      }

      let linkedExpenseId: number | null = null;
      if (expense_id) {
        const exp = db
          .prepare(`SELECT id FROM expenses WHERE id = ? AND trip_id = ?`)
          .get(Number(expense_id), tripId) as { id: number } | undefined;
        if (!exp) {
          res.status(400).json({ error: 'Linked expense does not belong to this trip.' });
          return;
        }
        linkedExpenseId = exp.id;
      }

      const result = db
        .prepare(
          `INSERT INTO expense_notes (trip_id, expense_id, title, content, author_id, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(tripId, linkedExpenseId, title.trim(), content.trim(), req.user!.id, req.user!.id);

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'expense_note_created',
        recordType: 'expense_note',
        recordId: Number(result.lastInsertRowid),
        summary: `Added Expense Note "${title.trim()}"${linkedExpenseId ? ` linked to expense #${linkedExpenseId}` : ''}.`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  app.patch(
    '/api/trips/:tripId/expense-notes/:noteId',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const noteId = Number(req.params.noteId);
      const existing = db
        .prepare(`SELECT * FROM expense_notes WHERE id = ? AND trip_id = ?`)
        .get(noteId, tripId) as
        | { id: number; title: string; content: string; author_id: number }
        | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Expense note not found.' });
        return;
      }

      const canManage =
        req.tripContext!.role === 'owner' ||
        req.tripContext!.permissions.can_manage_notes ||
        existing.author_id === req.user!.id;
      if (!canManage) {
        res.status(403).json({ error: 'Insufficient permission to edit this expense note.' });
        return;
      }

      const { title, content } = req.body ?? {};
      const nextTitle = typeof title === 'string' && title.trim() ? title.trim() : existing.title;
      const nextContent =
        typeof content === 'string' && content.trim() ? content.trim() : existing.content;

      db.transaction(() => {
        if (nextTitle !== existing.title || nextContent !== existing.content) {
          db.prepare(
            `INSERT INTO note_history (note_type, note_id, previous_title, previous_content, edited_by)
             VALUES ('expense', ?, ?, ?, ?)`
          ).run(noteId, existing.title, existing.content, req.user!.id);
        }
        db.prepare(
          `UPDATE expense_notes SET title = ?, content = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(nextTitle, nextContent, req.user!.id, noteId);

        logActivity(db, {
          tripId,
          userId: req.user!.id,
          actionType: 'expense_note_updated',
          recordType: 'expense_note',
          recordId: noteId,
          summary: `Updated Expense Note "${nextTitle}".`,
        });
      })();

      res.json({ ok: true });
    }
  );

  // ---- Announcements ----
  app.get(
    '/api/trips/:tripId/announcements',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const announcements = db
        .prepare(
          `SELECT a.*, u.name AS author_name
           FROM announcements a
           JOIN users u ON u.id = a.author_id
           WHERE a.trip_id = ?
           ORDER BY a.id DESC`
        )
        .all(tripId);
      res.json({ announcements });
    }
  );

  app.post(
    '/api/trips/:tripId/announcements',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_publish_announcements'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { title, message, priority } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Announcement title and message are required.' });
        return;
      }
      const prio = priority === 'urgent' ? 'urgent' : 'normal';
      const result = db
        .prepare(
          `INSERT INTO announcements (trip_id, title, message, priority, author_id) VALUES (?, ?, ?, ?, ?)`
        )
        .run(tripId, title.trim(), message.trim(), prio, req.user!.id);

      const memberIds = getActiveMemberIds(tripId).filter((id) => id !== req.user!.id);
      for (const mid of memberIds) {
        createNotification(db, {
          userId: mid,
          tripId,
          type: 'announcement',
          title: prio === 'urgent' ? `Urgent: ${title.trim()}` : title.trim(),
          message: message.trim().slice(0, 140),
        });
      }

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'announcement_published',
        recordType: 'announcement',
        recordId: Number(result.lastInsertRowid),
        summary: `Published ${prio} announcement "${title.trim()}".`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  // ---- Trip Schedule Planner ----
  app.get(
    '/api/trips/:tripId/schedule',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const items = db
        .prepare(
          `SELECT s.*, u.name AS created_by_name
           FROM trip_schedules s
           JOIN users u ON u.id = s.created_by
           WHERE s.trip_id = ?
           ORDER BY s.activity_date ASC, s.activity_time ASC, s.id ASC`
        )
        .all(tripId);
      res.json({ schedule: items });
    }
  );

  app.post(
    '/api/trips/:tripId/schedule',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_schedule'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { title, activity_date, activity_time, location, description } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim() || !activity_date) {
        res.status(400).json({ error: 'Activity title and date are required.' });
        return;
      }

      const result = db
        .prepare(
          `INSERT INTO trip_schedules (trip_id, title, activity_date, activity_time, location, description, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          tripId,
          title.trim(),
          String(activity_date),
          typeof activity_time === 'string' && activity_time ? activity_time : '09:00',
          typeof location === 'string' ? location.trim() : '',
          typeof description === 'string' ? description.trim() : '',
          req.user!.id
        );

      const memberIds = getActiveMemberIds(tripId).filter((id) => id !== req.user!.id);
      for (const mid of memberIds) {
        createNotification(db, {
          userId: mid,
          tripId,
          type: 'schedule_updated',
          title: 'Itinerary Updated',
          message: `Added "${title.trim()}" on ${activity_date}.`,
        });
      }

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'schedule_added',
        recordType: 'schedule',
        recordId: Number(result.lastInsertRowid),
        summary: `Scheduled "${title.trim()}" on ${activity_date}.`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  app.delete(
    '/api/trips/:tripId/schedule/:itemId',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_schedule'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const itemId = Number(req.params.itemId);
      db.prepare(`DELETE FROM trip_schedules WHERE id = ? AND trip_id = ?`).run(itemId, tripId);
      res.json({ ok: true });
    }
  );

  // ---- Immutable Activity Logs ----
  app.get(
    '/api/trips/:tripId/activity-logs',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const logs = db
        .prepare(
          `SELECT al.*, u.name AS actor_name
           FROM activity_logs al
           JOIN users u ON u.id = al.user_id
           WHERE al.trip_id = ?
           ORDER BY al.id DESC LIMIT 200`
        )
        .all(tripId);
      res.json({ logs });
    }
  );

  // ---- Final Settlement & Transfers ----
  app.get(
    '/api/trips/:tripId/settlement',
    requireAuth,
    requireTripMember,
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const settlement = computeTripSettlement(db, tripId);
      res.json(settlement);
    }
  );

  app.post(
    '/api/trips/:tripId/settlement/transfers',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_contributions'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const { from_user_id, to_user_id, target_type, amount_minor, mark_completed } = req.body ?? {};
      const minor = Math.round(Number(amount_minor));
      if (!Number.isFinite(minor) || minor <= 0) {
        res.status(400).json({ error: 'Settlement transfer amount must be greater than zero.' });
        return;
      }

      const validTarget = ['member', 'group_fund', 'from_group_fund'].includes(target_type)
        ? target_type
        : 'member';
      const status = mark_completed ? 'completed' : 'pending';

      const result = db
        .prepare(
          `INSERT INTO settlement_transfers (trip_id, from_user_id, to_user_id, target_type, amount_minor, status, verified_by, verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          tripId,
          from_user_id ? Number(from_user_id) : null,
          to_user_id ? Number(to_user_id) : null,
          validTarget,
          minor,
          status,
          status === 'completed' ? req.user!.id : null,
          status === 'completed' ? new Date().toISOString() : null
        );

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: status === 'completed' ? 'settlement_completed' : 'settlement_recorded',
        recordType: 'settlement_transfer',
        recordId: Number(result.lastInsertRowid),
        summary: `Recorded ${status} settlement transfer of ৳${(minor / 100).toLocaleString()}.`,
      });

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
  );

  app.patch(
    '/api/trips/:tripId/settlement/transfers/:transferId/complete',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_manage_contributions'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const transferId = Number(req.params.transferId);
      const existing = db
        .prepare(`SELECT * FROM settlement_transfers WHERE id = ? AND trip_id = ? AND status = 'pending'`)
        .get(transferId, tripId) as { id: number; amount_minor: number } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Pending settlement transfer not found.' });
        return;
      }

      db.prepare(
        `UPDATE settlement_transfers SET status = 'completed', verified_by = ?, verified_at = datetime('now') WHERE id = ?`
      ).run(req.user!.id, transferId);

      logActivity(db, {
        tripId,
        userId: req.user!.id,
        actionType: 'settlement_completed',
        recordType: 'settlement_transfer',
        recordId: transferId,
        summary: `Verified completion of settlement transfer (৳${(existing.amount_minor / 100).toLocaleString()}).`,
      });

      res.json({ ok: true });
    }
  );

  // ---- Reports & Data Export ----
  app.get(
    '/api/trips/:tripId/reports',
    requireAuth,
    requireTripMember,
    requireTripPermission('can_view_reports'),
    (req: AuthenticatedRequest, res) => {
      const tripId = Number(req.params.tripId);
      const trip = db
        .prepare(`SELECT t.*, u.name AS owner_name FROM trips t JOIN users u ON u.id = t.owner_id WHERE t.id = ?`)
        .get(tripId);
      const settlement = computeTripSettlement(db, tripId);
      const categoryBreakdown = db
        .prepare(
          `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS total_minor
           FROM expenses
           WHERE trip_id = ? AND status = 'approved'
           GROUP BY category
           ORDER BY total_minor DESC`
        )
        .all(tripId);

      const contributions = db
        .prepare(
          `SELECT c.*, mu.name AS member_name, vu.name AS verified_by_name
           FROM contributions c
           JOIN users mu ON mu.id = c.member_id
           LEFT JOIN users vu ON vu.id = c.verified_by
           WHERE c.trip_id = ?
           ORDER BY c.contribution_date ASC`
        )
        .all(tripId);

      const expenses = db
        .prepare(
          `SELECT e.*, pu.name AS paid_by_name, au.name AS approved_by_name
           FROM expenses e
           JOIN users pu ON pu.id = e.paid_by_member_id
           LEFT JOIN users au ON au.id = e.approved_by
           WHERE e.trip_id = ? AND e.status = 'approved'
           ORDER BY e.expense_date ASC`
        )
        .all(tripId);

      const reimbursements = db
        .prepare(
          `SELECT r.*, mu.name AS member_name
           FROM reimbursements r
           JOIN users mu ON mu.id = r.member_id
           WHERE r.trip_id = ?
           ORDER BY r.payment_date ASC`
        )
        .all(tripId);

      const activityLogs = db
        .prepare(
          `SELECT al.*, u.name AS actor_name
           FROM activity_logs al
           JOIN users u ON u.id = al.user_id
           WHERE al.trip_id = ?
           ORDER BY al.id DESC LIMIT 100`
        )
        .all(tripId);

      res.json({
        generatedAt: new Date().toISOString(),
        trip,
        settlement,
        categoryBreakdown,
        contributions,
        expenses,
        reimbursements,
        activityLogs,
      });
    }
  );

  // Error fallback for API routes
  app.use('/api', (_req, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TripMate server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TripMate server:', err);
  process.exit(1);
});
