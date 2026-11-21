export const EXPENSE_CATEGORIES = [
  'Transportation',
  'Accommodation',
  'Meals',
  'Snacks',
  'Shopping',
  'Tickets & Entrance Fees',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type TripStatus = 'upcoming' | 'ongoing' | 'completed';
export type RefundPolicy = 'proportional' | 'equal' | 'carry_forward';
export type MemberRole = 'admin' | 'member';
export type ContributionType = 'initial' | 'additional';
export type PaymentSource = 'group_fund' | 'personal';
export type SplitMethod = 'equal' | 'custom' | 'individual';
export type ApprovalStatus = 'pending' | 'approved';
export type ReimbursementStatus = 'pending' | 'completed';
export type SettlementStatus = 'pending' | 'completed';

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  phone: string;
  defaultCurrency: string;
}

export interface TripRecord {
  id: number;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  defaultMemberBudget: number;
  status: TripStatus;
  refundPolicy: RefundPolicy;
  coverImage: string;
  createdByUserId: number;
}

export interface TripListItem extends TripRecord {
  memberCount: number;
  myRole: MemberRole;
  totalCollected: number;
  totalExpenses: number;
  remainingFund: number;
}

export interface TripMemberRecord {
  id: number;
  tripId: number;
  userId: number | null;
  memberName: string;
  memberEmail: string;
  assignedBudget: number;
  role: MemberRole;
}

export interface ContributionRecord {
  id: number;
  tripId: number;
  memberId: number;
  amount: number;
  contributionType: ContributionType;
  paymentDate: string;
  note: string;
  approvalStatus: ApprovalStatus;
}

export interface ExpenseParticipantRecord {
  id: number;
  expenseId: number;
  memberId: number;
  shareAmount: number;
}

export interface ExpenseRecord {
  id: number;
  tripId: number;
  title: string;
  category: string;
  totalAmount: number;
  paidByMemberId: number;
  paymentSource: PaymentSource;
  splitMethod: SplitMethod;
  expenseDate: string;
  notes: string;
  approvalStatus: ApprovalStatus;
  participants: ExpenseParticipantRecord[];
}

export interface ReimbursementRecord {
  id: number;
  tripId: number;
  memberId: number;
  amount: number;
  status: ReimbursementStatus;
  paymentSource: PaymentSource;
  paymentDate: string;
  note: string;
}

export interface SettlementRecord {
  id: number;
  tripId: number;
  memberId: number;
  totalContributions: number;
  totalPersonalAdvances: number;
  totalExpenseShares: number;
  reimbursementsReceived: number;
  refundsReceived: number;
  netBalance: number;
  settlementStatus: SettlementStatus;
  settledAt: string;
}

export interface TripDetailPayload {
  trip: TripRecord;
  myRole: MemberRole;
  myMemberId: number | null;
  members: TripMemberRecord[];
  contributions: ContributionRecord[];
  expenses: ExpenseRecord[];
  reimbursements: ReimbursementRecord[];
  settlements: SettlementRecord[];
}

export interface MemberFinancialSummary {
  member: TripMemberRecord;
  assignedBudget: number;
  initialContributed: number;
  additionalContributed: number;
  totalContributed: number;
  unpaidBudget: number;
  personalAdvances: number;
  allocatedExpenseShare: number;
  reimbursementsReceived: number;
  pendingReimbursements: number;
  unrequestedPersonalAdvance: number;
  refundsReceived: number;
  netBalance: number;
  settlementStatus: SettlementStatus;
  settledAt: string;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

export interface SuggestedTransfer {
  fromLabel: string;
  toLabel: string;
  amount: number;
  kind: 'debtor_to_pool' | 'pool_to_creditor';
}

export interface TripFinancialOverview {
  totalExpectedBudget: number;
  totalInitialContributions: number;
  totalAdditionalContributions: number;
  totalCollectedMoney: number;
  totalTripExpense: number;
  expensesPaidFromGroupFund: number;
  expensesPaidFromPersonal: number;
  completedReimbursements: number;
  pendingReimbursementsAmount: number;
  refundsPaidOut: number;
  remainingGroupFund: number;
  pendingContributionsCount: number;
  pendingExpensesCount: number;
  memberSummaries: MemberFinancialSummary[];
  categoryBreakdown: CategoryBreakdownItem[];
  suggestedTransfers: SuggestedTransfer[];
}
