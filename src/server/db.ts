import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'tripmate.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  dbInstance = db;
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      email_verified INTEGER NOT NULL DEFAULT 1,
      notify_expenses INTEGER NOT NULL DEFAULT 1,
      notify_announcements INTEGER NOT NULL DEFAULT 1,
      notify_requests INTEGER NOT NULL DEFAULT 1,
      deletion_requested INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_image TEXT DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
      show_member_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'upcoming', 'active', 'completed', 'archived')),
      estimated_budget_minor INTEGER NOT NULL DEFAULT 0,
      expected_per_member_minor INTEGER NOT NULL DEFAULT 0,
      owner_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trip_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (trip_id, user_id),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_permissions (
      trip_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      can_manage_members INTEGER NOT NULL DEFAULT 0,
      can_approve_expenses INTEGER NOT NULL DEFAULT 0,
      can_manage_contributions INTEGER NOT NULL DEFAULT 0,
      can_edit_expenses INTEGER NOT NULL DEFAULT 0,
      can_manage_notes INTEGER NOT NULL DEFAULT 0,
      can_publish_announcements INTEGER NOT NULL DEFAULT 0,
      can_view_reports INTEGER NOT NULL DEFAULT 1,
      can_manage_schedule INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (trip_id, user_id),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trip_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      invited_email TEXT NOT NULL,
      invited_user_id INTEGER,
      invited_by INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by INTEGER,
      rejection_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      contribution_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      recorded_by INTEGER NOT NULL,
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
      verified_by INTEGER,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES users(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id),
      FOREIGN KEY (verified_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      amount_minor INTEGER NOT NULL,
      category TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      paid_by_member_id INTEGER NOT NULL,
      payment_source TEXT NOT NULL DEFAULT 'group_fund' CHECK (payment_source IN ('group_fund', 'personal')),
      split_type TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'individual', 'participation')),
      receipt_note TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_correction', 'cancelled')),
      rejection_reason TEXT DEFAULT '',
      submitted_by INTEGER NOT NULL,
      approved_by INTEGER,
      approved_at TEXT,
      parent_expense_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by_member_id) REFERENCES users(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (parent_expense_id) REFERENCES expenses(id)
    );

    CREATE TABLE IF NOT EXISTS expense_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      share_minor INTEGER NOT NULL,
      UNIQUE (expense_id, member_id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reimbursements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      recorded_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES users(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS general_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER NOT NULL,
      updated_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expense_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      expense_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      updated_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS note_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_type TEXT NOT NULL CHECK (note_type IN ('general', 'expense')),
      note_id INTEGER NOT NULL,
      previous_title TEXT NOT NULL,
      previous_content TEXT NOT NULL,
      edited_by INTEGER NOT NULL,
      edited_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (edited_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
      author_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      trip_id INTEGER,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trip_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      activity_date TEXT NOT NULL,
      activity_time TEXT NOT NULL DEFAULT '09:00',
      location TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id INTEGER,
      summary TEXT NOT NULL,
      previous_values TEXT DEFAULT '',
      new_values TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ownership_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      previous_owner_new_role TEXT NOT NULL DEFAULT 'admin' CHECK (previous_owner_new_role IN ('admin', 'member')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      responded_at TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      from_user_id INTEGER,
      to_user_id INTEGER,
      target_type TEXT NOT NULL DEFAULT 'member' CHECK (target_type IN ('member', 'group_fund', 'from_group_fund')),
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      verified_by INTEGER,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id),
      FOREIGN KEY (verified_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id, status);
    CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_contributions_trip ON contributions(trip_id, status);
    CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id, status);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_trip ON activity_logs(trip_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Transportation',
  'Accommodation',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snacks and Drinks',
  'Tickets and Entertainment',
  'Shopping',
  'Emergency',
  'Other Expenses',
];

export function logActivity(
  db: Database.Database,
  params: {
    tripId: number;
    userId: number;
    actionType: string;
    recordType: string;
    recordId?: number | null;
    summary: string;
    previousValues?: unknown;
    newValues?: unknown;
  }
): void {
  db.prepare(
    `INSERT INTO activity_logs (trip_id, user_id, action_type, record_type, record_id, summary, previous_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.tripId,
    params.userId,
    params.actionType,
    params.recordType,
    params.recordId ?? null,
    params.summary,
    params.previousValues !== undefined ? JSON.stringify(params.previousValues) : '',
    params.newValues !== undefined ? JSON.stringify(params.newValues) : ''
  );
}

export function createNotification(
  db: Database.Database,
  params: {
    userId: number;
    tripId?: number | null;
    type: string;
    title: string;
    message: string;
  }
): void {
  db.prepare(
    `INSERT INTO notifications (user_id, trip_id, type, title, message) VALUES (?, ?, ?, ?, ?)`
  ).run(params.userId, params.tripId ?? null, params.type, params.title, params.message);
}
