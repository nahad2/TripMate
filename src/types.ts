export interface User {
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

export interface PublicTrip {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  description: string;
  cover_image: string;
  status: 'planning' | 'upcoming' | 'active' | 'completed' | 'archived';
  show_member_count: number;
  owner_name: string;
  member_count: number | null;
}

export interface DashboardTrip {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  description: string;
  cover_image: string;
  visibility: 'public' | 'private';
  status: 'planning' | 'upcoming' | 'active' | 'completed' | 'archived';
  estimated_budget_minor: number;
  expected_per_member_minor: number;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
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

export interface TripMembership {
  tripId: number;
  role: 'owner' | 'admin' | 'member';
  permissions: TripPermissions;
  tripStatus: string;
}

export interface TripFinanceSummary {
  estimatedBudgetMinor: number;
  expectedPerMemberMinor: number;
  verifiedContributionsMinor: number;
  pendingContributionsMinor: number;
  groupFundExpensesMinor: number;
  personalAdvancesMinor: number;
  totalApprovedExpensesMinor: number;
  reimbursementsPaidMinor: number;
  reimbursementsPendingMinor: number;
  availableGroupFundMinor: number;
  remainingPersonalLiabilityMinor: number;
  budgetUsagePercent: number;
  pendingExpenseRequestsCount: number;
  pendingJoinRequestsCount: number;
  activeMembersCount: number;
}

export interface TripMember {
  id: number;
  user_id: number;
  role: 'owner' | 'admin' | 'member';
  status: string;
  joined_at: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  can_manage_members?: number;
  can_approve_expenses?: number;
  can_manage_contributions?: number;
  can_edit_expenses?: number;
  can_manage_notes?: number;
  can_publish_announcements?: number;
  can_view_reports?: number;
  can_manage_schedule?: number;
}

export interface TripDetail {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  description: string;
  cover_image: string;
  visibility: 'public' | 'private';
  show_member_count: number;
  status: 'planning' | 'upcoming' | 'active' | 'completed' | 'archived';
  estimated_budget_minor: number;
  expected_per_member_minor: number;
  owner_id: number;
  owner_name: string;
}

export interface ContributionRecord {
  id: number;
  trip_id: number;
  member_id: number;
  member_name: string;
  amount_minor: number;
  contribution_date: string;
  payment_method: string;
  recorded_by: number;
  recorded_by_name: string;
  note: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by_name: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface ExpenseParticipant {
  member_id: number;
  member_name: string;
  share_minor: number;
}

export interface ExpenseRecord {
  id: number;
  trip_id: number;
  title: string;
  description: string;
  amount_minor: number;
  category: string;
  expense_date: string;
  paid_by_member_id: number;
  paid_by_name: string;
  payment_source: 'group_fund' | 'personal';
  split_type: 'equal' | 'custom' | 'individual' | 'participation';
  receipt_note: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_correction' | 'cancelled';
  rejection_reason: string;
  submitted_by: number;
  submitted_by_name: string;
  approved_by_name: string | null;
  parent_expense_id: number | null;
  created_at: string;
  participants: ExpenseParticipant[];
}

export interface ReimbursementRecord {
  id: number;
  trip_id: number;
  member_id: number;
  member_name: string;
  amount_minor: number;
  payment_date: string;
  payment_method: string;
  note: string;
  status: 'pending' | 'completed';
  recorded_by_name: string;
  created_at: string;
}

export interface GeneralNote {
  id: number;
  trip_id: number;
  title: string;
  content: string;
  is_pinned: number;
  is_archived: number;
  author_id: number;
  author_name: string;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseNote {
  id: number;
  trip_id: number;
  expense_id: number | null;
  expense_title: string | null;
  expense_amount_minor: number | null;
  title: string;
  content: string;
  author_id: number;
  author_name: string;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteHistoryItem {
  id: number;
  note_type: 'general' | 'expense';
  note_id: number;
  previous_title: string;
  previous_content: string;
  edited_by_name: string;
  edited_at: string;
}

export interface AnnouncementItem {
  id: number;
  trip_id: number;
  title: string;
  message: string;
  priority: 'normal' | 'urgent';
  author_name: string;
  created_at: string;
}

export interface ScheduleItem {
  id: number;
  trip_id: number;
  title: string;
  activity_date: string;
  activity_time: string;
  location: string;
  description: string;
  created_by_name: string;
}

export interface ActivityLogItem {
  id: number;
  trip_id: number;
  user_id: number;
  actor_name: string;
  action_type: string;
  record_type: string;
  record_id: number | null;
  summary: string;
  previous_values: string;
  new_values: string;
  created_at: string;
}

export interface MemberSettlementRow {
  userId: number;
  name: string;
  email: string;
  role: string;
  verifiedContributionMinor: number;
  pendingContributionMinor: number;
  assignedExpenseShareMinor: number;
  personalPaidMinor: number;
  reimbursementsReceivedMinor: number;
  settlementPaidMinor: number;
  settlementReceivedMinor: number;
  netBalanceMinor: number;
  status: 'settled' | 'receivable' | 'owes';
  explanation: string;
}

export interface SuggestedTransfer {
  fromUserId: number | null;
  fromName: string;
  toUserId: number | null;
  toName: string;
  targetType: 'member' | 'group_fund' | 'from_group_fund';
  amountMinor: number;
}

export interface RecordedSettlementTransfer {
  id: number;
  from_user_id: number | null;
  from_name: string;
  to_user_id: number | null;
  to_name: string;
  target_type: 'member' | 'group_fund' | 'from_group_fund';
  amount_minor: number;
  status: 'pending' | 'completed';
  verified_by_name: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface TripSettlementReport {
  summary: TripFinanceSummary;
  members: MemberSettlementRow[];
  suggestedTransfers: SuggestedTransfer[];
  recordedTransfers: RecordedSettlementTransfer[];
  reconciled: boolean;
}
