import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  defaultCurrency: text('default_currency').notNull().default('BDT'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trips = pgTable('trips', {
  id: serial('id').primaryKey(),
  tripName: text('trip_name').notNull(),
  destination: text('destination').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  currency: text('currency').notNull().default('BDT'),
  defaultMemberBudget: doublePrecision('default_member_budget').notNull().default(0),
  status: text('status').notNull().default('ongoing'),
  refundPolicy: text('refund_policy').notNull().default('proportional'),
  coverImage: text('cover_image').default(''),
  createdByUserId: integer('created_by_user_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tripMembers = pgTable('trip_members', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id),
  memberName: text('member_name').notNull(),
  memberEmail: text('member_email').notNull(),
  assignedBudget: doublePrecision('assigned_budget').notNull().default(0),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contributions = pgTable('contributions', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => tripMembers.id, { onDelete: 'cascade' })
    .notNull(),
  amount: doublePrecision('amount').notNull(),
  contributionType: text('contribution_type').notNull().default('initial'),
  paymentDate: text('payment_date').notNull(),
  note: text('note').default(''),
  approvalStatus: text('approval_status').notNull().default('approved'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  totalAmount: doublePrecision('total_amount').notNull(),
  paidByMemberId: integer('paid_by_member_id')
    .references(() => tripMembers.id, { onDelete: 'cascade' })
    .notNull(),
  paymentSource: text('payment_source').notNull().default('group_fund'),
  splitMethod: text('split_method').notNull().default('equal'),
  expenseDate: text('expense_date').notNull(),
  notes: text('notes').default(''),
  approvalStatus: text('approval_status').notNull().default('approved'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenseParticipants = pgTable('expense_participants', {
  id: serial('id').primaryKey(),
  expenseId: integer('expense_id')
    .references(() => expenses.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => tripMembers.id, { onDelete: 'cascade' })
    .notNull(),
  shareAmount: doublePrecision('share_amount').notNull(),
});

export const reimbursements = pgTable('reimbursements', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => tripMembers.id, { onDelete: 'cascade' })
    .notNull(),
  amount: doublePrecision('amount').notNull(),
  status: text('status').notNull().default('pending'),
  paymentSource: text('payment_source').notNull().default('group_fund'),
  paymentDate: text('payment_date').notNull(),
  note: text('note').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const settlements = pgTable('settlements', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => tripMembers.id, { onDelete: 'cascade' })
    .notNull(),
  totalContributions: doublePrecision('total_contributions').notNull().default(0),
  totalPersonalAdvances: doublePrecision('total_personal_advances').notNull().default(0),
  totalExpenseShares: doublePrecision('total_expense_shares').notNull().default(0),
  reimbursementsReceived: doublePrecision('reimbursements_received').notNull().default(0),
  refundsReceived: doublePrecision('refunds_received').notNull().default(0),
  netBalance: doublePrecision('net_balance').notNull().default(0),
  settlementStatus: text('settlement_status').notNull().default('pending'),
  settledAt: text('settled_at').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  createdTrips: many(trips),
  memberships: many(tripMembers),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  creator: one(users, {
    fields: [trips.createdByUserId],
    references: [users.id],
  }),
  members: many(tripMembers),
  contributions: many(contributions),
  expenses: many(expenses),
  reimbursements: many(reimbursements),
  settlements: many(settlements),
}));

export const tripMembersRelations = relations(tripMembers, ({ one, many }) => ({
  trip: one(trips, {
    fields: [tripMembers.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [tripMembers.userId],
    references: [users.id],
  }),
  contributions: many(contributions),
  paidExpenses: many(expenses),
  expenseShares: many(expenseParticipants),
  reimbursements: many(reimbursements),
  settlements: many(settlements),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
  trip: one(trips, {
    fields: [contributions.tripId],
    references: [trips.id],
  }),
  member: one(tripMembers, {
    fields: [contributions.memberId],
    references: [tripMembers.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(trips, {
    fields: [expenses.tripId],
    references: [trips.id],
  }),
  paidBy: one(tripMembers, {
    fields: [expenses.paidByMemberId],
    references: [tripMembers.id],
  }),
  participants: many(expenseParticipants),
}));

export const expenseParticipantsRelations = relations(expenseParticipants, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseParticipants.expenseId],
    references: [expenses.id],
  }),
  member: one(tripMembers, {
    fields: [expenseParticipants.memberId],
    references: [tripMembers.id],
  }),
}));

export const reimbursementsRelations = relations(reimbursements, ({ one }) => ({
  trip: one(trips, {
    fields: [reimbursements.tripId],
    references: [trips.id],
  }),
  member: one(tripMembers, {
    fields: [reimbursements.memberId],
    references: [tripMembers.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  trip: one(trips, {
    fields: [settlements.tripId],
    references: [trips.id],
  }),
  member: one(tripMembers, {
    fields: [settlements.memberId],
    references: [tripMembers.id],
  }),
}));
