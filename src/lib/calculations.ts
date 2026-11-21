import type {
  CategoryBreakdownItem,
  ContributionRecord,
  ExpenseRecord,
  MemberFinancialSummary,
  ReimbursementRecord,
  SettlementRecord,
  SuggestedTransfer,
  TripFinancialOverview,
  TripMemberRecord,
} from './tripmate-types.ts';

const CATEGORY_COLORS: Record<string, string> = {
  Transportation: '#0F2744',
  Accommodation: '#0D9488',
  Meals: '#0284C7',
  Snacks: '#D97706',
  Shopping: '#4F46E5',
  'Tickets & Entrance Fees': '#16A34A',
  Other: '#64748B',
};

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency = 'BDT'): string {
  const safe = Number.isFinite(amount) ? roundMoney(amount) : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe));
  const sign = safe < 0 ? '-' : '';
  return `${sign}${formatted} ${currency}`;
}

export function computeTripFinancials(
  members: TripMemberRecord[],
  contributions: ContributionRecord[],
  expenses: ExpenseRecord[],
  reimbursements: ReimbursementRecord[],
  settlements: SettlementRecord[],
): TripFinancialOverview {
  const approvedContribs = contributions.filter((c) => c.approvalStatus === 'approved');
  const approvedExpenses = expenses.filter((e) => e.approvalStatus === 'approved');

  const pendingContributionsCount = contributions.filter(
    (c) => c.approvalStatus === 'pending',
  ).length;
  const pendingExpensesCount = expenses.filter((e) => e.approvalStatus === 'pending').length;

  const totalExpectedBudget = roundMoney(
    members.reduce((sum, m) => sum + Number(m.assignedBudget || 0), 0),
  );

  const totalInitialContributions = roundMoney(
    approvedContribs
      .filter((c) => c.contributionType === 'initial')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0),
  );

  const totalAdditionalContributions = roundMoney(
    approvedContribs
      .filter((c) => c.contributionType === 'additional')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0),
  );

  const totalCollectedMoney = roundMoney(
    totalInitialContributions + totalAdditionalContributions,
  );

  const totalTripExpense = roundMoney(
    approvedExpenses.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0),
  );

  const expensesPaidFromGroupFund = roundMoney(
    approvedExpenses
      .filter((e) => e.paymentSource === 'group_fund')
      .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0),
  );

  const expensesPaidFromPersonal = roundMoney(
    approvedExpenses
      .filter((e) => e.paymentSource === 'personal')
      .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0),
  );

  const completedReimbursements = roundMoney(
    reimbursements
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0),
  );

  const pendingReimbursementsAmount = roundMoney(
    reimbursements
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0),
  );

  const refundsPaidOut = roundMoney(
    settlements
      .filter((s) => s.settlementStatus === 'completed')
      .reduce((sum, s) => sum + Number(s.refundsReceived || 0), 0),
  );

  // Section 8.4: Remaining Group Fund = Total Contributions Deposited - Expenses Paid from Group Fund - Reimbursements Paid - Refunds Paid
  const remainingGroupFund = roundMoney(
    totalCollectedMoney -
      expensesPaidFromGroupFund -
      completedReimbursements -
      refundsPaidOut,
  );

  const settlementByMember = new Map<number, SettlementRecord>();
  for (const s of settlements) {
    settlementByMember.set(s.memberId, s);
  }

  const memberSummaries: MemberFinancialSummary[] = members.map((member) => {
    const mContribs = approvedContribs.filter((c) => c.memberId === member.id);
    const initialContributed = roundMoney(
      mContribs
        .filter((c) => c.contributionType === 'initial')
        .reduce((sum, c) => sum + Number(c.amount || 0), 0),
    );
    const additionalContributed = roundMoney(
      mContribs
        .filter((c) => c.contributionType === 'additional')
        .reduce((sum, c) => sum + Number(c.amount || 0), 0),
    );
    const totalContributed = roundMoney(initialContributed + additionalContributed);
    const unpaidBudget = roundMoney(
      Math.max(0, Number(member.assignedBudget || 0) - initialContributed),
    );

    const personalAdvances = roundMoney(
      approvedExpenses
        .filter((e) => e.paidByMemberId === member.id && e.paymentSource === 'personal')
        .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0),
    );

    let allocatedExpenseShare = 0;
    for (const exp of approvedExpenses) {
      for (const p of exp.participants) {
        if (p.memberId === member.id) {
          allocatedExpenseShare += Number(p.shareAmount || 0);
        }
      }
    }
    allocatedExpenseShare = roundMoney(allocatedExpenseShare);

    const reimbursementsReceived = roundMoney(
      reimbursements
        .filter((r) => r.memberId === member.id && r.status === 'completed')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0),
    );

    const pendingReimbursements = roundMoney(
      reimbursements
        .filter((r) => r.memberId === member.id && r.status === 'pending')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0),
    );

    const unrequestedPersonalAdvance = roundMoney(
      Math.max(0, personalAdvances - reimbursementsReceived - pendingReimbursements),
    );

    const settlement = settlementByMember.get(member.id);
    const refundsReceived = roundMoney(
      settlement?.settlementStatus === 'completed'
        ? Number(settlement.refundsReceived || 0)
        : 0,
    );

    // Section 8.6: Member Balance = Contributions + Personal Advances - Allocated Expense Shares - Reimbursements Received - Refunds Received
    const netBalance = roundMoney(
      totalContributed +
        personalAdvances -
        allocatedExpenseShare -
        reimbursementsReceived -
        refundsReceived,
    );

    return {
      member,
      assignedBudget: roundMoney(Number(member.assignedBudget || 0)),
      initialContributed,
      additionalContributed,
      totalContributed,
      unpaidBudget,
      personalAdvances,
      allocatedExpenseShare,
      reimbursementsReceived,
      pendingReimbursements,
      unrequestedPersonalAdvance,
      refundsReceived,
      netBalance,
      settlementStatus: settlement?.settlementStatus ?? 'pending',
      settledAt: settlement?.settledAt ?? '',
    };
  });

  // Category breakdown
  const catMap = new Map<string, { amount: number; count: number }>();
  for (const exp of approvedExpenses) {
    const existing = catMap.get(exp.category) ?? { amount: 0, count: 0 };
    existing.amount += Number(exp.totalAmount || 0);
    existing.count += 1;
    catMap.set(exp.category, existing);
  }

  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(catMap.entries())
    .map(([category, info]) => ({
      category,
      amount: roundMoney(info.amount),
      percentage:
        totalTripExpense > 0
          ? roundMoney((info.amount / totalTripExpense) * 100)
          : 0,
      count: info.count,
      color: CATEGORY_COLORS[category] ?? '#64748B',
    }))
    .sort((a, b) => b.amount - a.amount);

  // Suggested settlement transfers reconciling debtors, creditors, and remaining group fund
  const suggestedTransfers: SuggestedTransfer[] = [];
  for (const ms of memberSummaries) {
    if (ms.netBalance < -0.01) {
      suggestedTransfers.push({
        fromLabel: ms.member.memberName,
        toLabel: 'Group Settlement Pool',
        amount: roundMoney(Math.abs(ms.netBalance)),
        kind: 'debtor_to_pool',
      });
    }
  }
  for (const ms of memberSummaries) {
    if (ms.netBalance > 0.01) {
      suggestedTransfers.push({
        fromLabel: 'Group Settlement Pool',
        toLabel: ms.member.memberName,
        amount: roundMoney(ms.netBalance),
        kind: 'pool_to_creditor',
      });
    }
  }

  return {
    totalExpectedBudget,
    totalInitialContributions,
    totalAdditionalContributions,
    totalCollectedMoney,
    totalTripExpense,
    expensesPaidFromGroupFund,
    expensesPaidFromPersonal,
    completedReimbursements,
    pendingReimbursementsAmount,
    refundsPaidOut,
    remainingGroupFund,
    pendingContributionsCount,
    pendingExpensesCount,
    memberSummaries,
    categoryBreakdown,
    suggestedTransfers,
  };
}

export function computeEqualShares(
  totalAmount: number,
  memberIds: number[],
): Array<{ memberId: number; shareAmount: number }> {
  if (memberIds.length === 0) return [];
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - baseCents * memberIds.length;

  return memberIds.map((memberId, index) => ({
    memberId,
    shareAmount: (baseCents + (index < remainder ? 1 : 0)) / 100,
  }));
}
