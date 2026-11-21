import type Database from 'better-sqlite3';

export interface ShareAllocation {
  memberId: number;
  shareMinor: number;
}

export function computeShares(
  amountMinor: number,
  splitType: 'equal' | 'custom' | 'individual' | 'participation',
  participantIds: number[],
  customShares?: Array<{ memberId: number; shareMinor: number }>
): ShareAllocation[] {
  const uniqueIds = Array.from(new Set(participantIds.filter((id) => Number.isInteger(id) && id > 0)));

  if (uniqueIds.length === 0) {
    throw new Error('At least one participating member must be selected.');
  }

  if (splitType === 'individual') {
    if (uniqueIds.length !== 1) {
      throw new Error('Individual expense must belong to exactly one member.');
    }
    return [{ memberId: uniqueIds[0], shareMinor: amountMinor }];
  }

  if (splitType === 'custom') {
    if (!customShares || customShares.length === 0) {
      throw new Error('Custom split requires explicit amounts per participating member.');
    }
    const clean = customShares.map((item) => ({
      memberId: Number(item.memberId),
      shareMinor: Math.round(Number(item.shareMinor)),
    }));
    const sign = amountMinor >= 0 ? 1 : -1;
    for (const item of clean) {
      if (sign > 0 && item.shareMinor < 0) {
        throw new Error('Custom share amounts cannot be negative.');
      }
      if (sign < 0 && item.shareMinor > 0) {
        throw new Error('Reversal shares must match reversal sign.');
      }
    }
    const sum = clean.reduce((acc, item) => acc + item.shareMinor, 0);
    if (sum !== amountMinor) {
      throw new Error('Sum of custom shares must exactly match the expense amount.');
    }
    return clean;
  }

  // Equal or participation-based split with deterministic integer distribution
  const count = uniqueIds.length;
  const sign = amountMinor < 0 ? -1 : 1;
  const absTotal = Math.abs(amountMinor);
  const base = Math.floor(absTotal / count);
  const remainder = absTotal % count;

  return uniqueIds.map((memberId, index) => ({
    memberId,
    shareMinor: sign * (base + (index < remainder ? 1 : 0)),
  }));
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

export function computeTripFinanceSummary(db: Database.Database, tripId: number): TripFinanceSummary {
  const trip = db
    .prepare(`SELECT estimated_budget_minor, expected_per_member_minor FROM trips WHERE id = ?`)
    .get(tripId) as { estimated_budget_minor: number; expected_per_member_minor: number } | undefined;

  const contribRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'verified' THEN amount_minor ELSE 0 END), 0) AS verified,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_minor ELSE 0 END), 0) AS pending
       FROM contributions WHERE trip_id = ?`
    )
    .get(tripId) as { verified: number; pending: number };

  const expenseRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'approved' AND payment_source = 'group_fund' THEN amount_minor ELSE 0 END), 0) AS group_fund_expenses,
         COALESCE(SUM(CASE WHEN status = 'approved' AND payment_source = 'personal' THEN amount_minor ELSE 0 END), 0) AS personal_advances,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
       FROM expenses WHERE trip_id = ?`
    )
    .get(tripId) as { group_fund_expenses: number; personal_advances: number; pending_count: number };

  const reimbRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_minor ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_minor ELSE 0 END), 0) AS pending
       FROM reimbursements WHERE trip_id = ?`
    )
    .get(tripId) as { paid: number; pending: number };

  const memberCountRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM trip_members WHERE trip_id = ? AND status = 'active'`)
    .get(tripId) as { cnt: number };

  const joinCountRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM join_requests WHERE trip_id = ? AND status = 'pending'`)
    .get(tripId) as { cnt: number };

  const verifiedContributionsMinor = contribRow.verified;
  const pendingContributionsMinor = contribRow.pending;
  const groupFundExpensesMinor = expenseRow.group_fund_expenses;
  const personalAdvancesMinor = expenseRow.personal_advances;
  const totalApprovedExpensesMinor = groupFundExpensesMinor + personalAdvancesMinor;
  const reimbursementsPaidMinor = reimbRow.paid;
  const reimbursementsPendingMinor = reimbRow.pending;
  const availableGroupFundMinor =
    verifiedContributionsMinor - groupFundExpensesMinor - reimbursementsPaidMinor;
  const remainingPersonalLiabilityMinor = Math.max(0, personalAdvancesMinor - reimbursementsPaidMinor);

  const estimatedBudgetMinor = trip?.estimated_budget_minor ?? 0;
  const budgetUsagePercent =
    estimatedBudgetMinor > 0
      ? Math.round((totalApprovedExpensesMinor / estimatedBudgetMinor) * 1000) / 10
      : 0;

  return {
    estimatedBudgetMinor,
    expectedPerMemberMinor: trip?.expected_per_member_minor ?? 0,
    verifiedContributionsMinor,
    pendingContributionsMinor,
    groupFundExpensesMinor,
    personalAdvancesMinor,
    totalApprovedExpensesMinor,
    reimbursementsPaidMinor,
    reimbursementsPendingMinor,
    availableGroupFundMinor,
    remainingPersonalLiabilityMinor,
    budgetUsagePercent,
    pendingExpenseRequestsCount: expenseRow.pending_count,
    pendingJoinRequestsCount: joinCountRow.cnt,
    activeMembersCount: memberCountRow.cnt,
  };
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
  netBalanceMinor: number; // > 0 receivable, < 0 owes
  status: 'settled' | 'receivable' | 'owes';
  explanation: string;
}

export interface SuggestedTransfer {
  fromUserId: number | null; // null means Central Group Fund
  fromName: string;
  toUserId: number | null; // null means Central Group Fund
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

function formatTaka(minor: number): string {
  const abs = Math.abs(minor) / 100;
  return `৳${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function computeTripSettlement(db: Database.Database, tripId: number): TripSettlementReport {
  const summary = computeTripFinanceSummary(db, tripId);

  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, tm.role
       FROM trip_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.trip_id = ? AND tm.status = 'active'
       ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name ASC`
    )
    .all(tripId) as Array<{ id: number; name: string; email: string; role: string }>;

  const contribByMember = new Map<number, { verified: number; pending: number }>();
  const contribRows = db
    .prepare(
      `SELECT member_id,
              COALESCE(SUM(CASE WHEN status = 'verified' THEN amount_minor ELSE 0 END), 0) AS verified,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_minor ELSE 0 END), 0) AS pending
       FROM contributions WHERE trip_id = ? GROUP BY member_id`
    )
    .all(tripId) as Array<{ member_id: number; verified: number; pending: number }>;
  for (const r of contribRows) {
    contribByMember.set(r.member_id, { verified: r.verified, pending: r.pending });
  }

  const sharesByMember = new Map<number, number>();
  const shareRows = db
    .prepare(
      `SELECT ep.member_id, COALESCE(SUM(ep.share_minor), 0) AS total_share
       FROM expense_participants ep
       JOIN expenses e ON e.id = ep.expense_id
       WHERE e.trip_id = ? AND e.status = 'approved'
       GROUP BY ep.member_id`
    )
    .all(tripId) as Array<{ member_id: number; total_share: number }>;
  for (const r of shareRows) {
    sharesByMember.set(r.member_id, r.total_share);
  }

  const personalPaidByMember = new Map<number, number>();
  const personalRows = db
    .prepare(
      `SELECT paid_by_member_id, COALESCE(SUM(amount_minor), 0) AS total_personal
       FROM expenses
       WHERE trip_id = ? AND status = 'approved' AND payment_source = 'personal'
       GROUP BY paid_by_member_id`
    )
    .all(tripId) as Array<{ paid_by_member_id: number; total_personal: number }>;
  for (const r of personalRows) {
    personalPaidByMember.set(r.paid_by_member_id, r.total_personal);
  }

  const reimbByMember = new Map<number, number>();
  const reimbRows = db
    .prepare(
      `SELECT member_id, COALESCE(SUM(amount_minor), 0) AS total_reimb
       FROM reimbursements
       WHERE trip_id = ? AND status = 'completed'
       GROUP BY member_id`
    )
    .all(tripId) as Array<{ member_id: number; total_reimb: number }>;
  for (const r of reimbRows) {
    reimbByMember.set(r.member_id, r.total_reimb);
  }

  const recordedTransfers = db
    .prepare(
      `SELECT st.*,
              COALESCE(fu.name, 'Central Group Fund') AS from_name,
              COALESCE(tu.name, 'Central Group Fund') AS to_name,
              vu.name AS verified_by_name
       FROM settlement_transfers st
       LEFT JOIN users fu ON fu.id = st.from_user_id
       LEFT JOIN users tu ON tu.id = st.to_user_id
       LEFT JOIN users vu ON vu.id = st.verified_by
       WHERE st.trip_id = ?
       ORDER BY st.created_at DESC, st.id DESC`
    )
    .all(tripId) as RecordedSettlementTransfer[];

  const settlementPaidByMember = new Map<number, number>();
  const settlementReceivedByMember = new Map<number, number>();
  let fundSettlementDelta = 0;

  for (const t of recordedTransfers) {
    if (t.status !== 'completed') continue;
    if (t.from_user_id) {
      settlementPaidByMember.set(
        t.from_user_id,
        (settlementPaidByMember.get(t.from_user_id) ?? 0) + t.amount_minor
      );
    } else if (t.target_type === 'from_group_fund') {
      fundSettlementDelta -= t.amount_minor;
    }

    if (t.to_user_id) {
      settlementReceivedByMember.set(
        t.to_user_id,
        (settlementReceivedByMember.get(t.to_user_id) ?? 0) + t.amount_minor
      );
    } else if (t.target_type === 'group_fund') {
      fundSettlementDelta += t.amount_minor;
    }
  }

  const memberRows: MemberSettlementRow[] = members.map((m) => {
    const contrib = contribByMember.get(m.id) ?? { verified: 0, pending: 0 };
    const assignedShare = sharesByMember.get(m.id) ?? 0;
    const personalPaid = personalPaidByMember.get(m.id) ?? 0;
    const reimbReceived = reimbByMember.get(m.id) ?? 0;
    const sPaid = settlementPaidByMember.get(m.id) ?? 0;
    const sReceived = settlementReceivedByMember.get(m.id) ?? 0;

    const totalContributed = contrib.verified + personalPaid - reimbReceived + sPaid - sReceived;
    const netBalanceMinor = totalContributed - assignedShare;

    let status: 'settled' | 'receivable' | 'owes' = 'settled';
    if (netBalanceMinor > 0) status = 'receivable';
    else if (netBalanceMinor < 0) status = 'owes';

    const explanationParts = [
      `Verified contributions ${formatTaka(contrib.verified)}`,
      personalPaid > 0 ? `+ personal payments ${formatTaka(personalPaid)}` : null,
      reimbReceived > 0 ? `- reimbursements received ${formatTaka(reimbReceived)}` : null,
      sPaid > 0 ? `+ settlement paid ${formatTaka(sPaid)}` : null,
      sReceived > 0 ? `- settlement received ${formatTaka(sReceived)}` : null,
      `- assigned share ${formatTaka(assignedShare)}`,
    ].filter(Boolean);

    const explanation = `${explanationParts.join(' ')} = ${
      netBalanceMinor >= 0 ? 'Receivable ' : 'Owes '
    }${formatTaka(netBalanceMinor)}`;

    return {
      userId: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      verifiedContributionMinor: contrib.verified,
      pendingContributionMinor: contrib.pending,
      assignedExpenseShareMinor: assignedShare,
      personalPaidMinor: personalPaid,
      reimbursementsReceivedMinor: reimbReceived,
      settlementPaidMinor: sPaid,
      settlementReceivedMinor: sReceived,
      netBalanceMinor,
      status,
      explanation,
    };
  });

  // Compute remaining Central Group Fund cash after any completed settlement payouts
  let remainingFundCash = summary.availableGroupFundMinor + fundSettlementDelta;

  // Build creditors & debtors list to minimize transfers
  const creditors = memberRows
    .filter((m) => m.netBalanceMinor > 0)
    .map((m) => ({ userId: m.userId, name: m.name, amount: m.netBalanceMinor }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = memberRows
    .filter((m) => m.netBalanceMinor < 0)
    .map((m) => ({ userId: m.userId, name: m.name, amount: Math.abs(m.netBalanceMinor) }))
    .sort((a, b) => b.amount - a.amount);

  const suggestedTransfers: SuggestedTransfer[] = [];

  // Step 1: If Central Group Fund holds cash, pay out creditors from the Group Fund first
  for (const creditor of creditors) {
    if (remainingFundCash <= 0) break;
    if (creditor.amount <= 0) continue;
    const pay = Math.min(remainingFundCash, creditor.amount);
    if (pay > 0) {
      suggestedTransfers.push({
        fromUserId: null,
        fromName: 'Central Group Fund',
        toUserId: creditor.userId,
        toName: creditor.name,
        targetType: 'from_group_fund',
        amountMinor: pay,
      });
      creditor.amount -= pay;
      remainingFundCash -= pay;
    }
  }

  // Step 2: Match remaining debtors directly to remaining creditors
  let dIdx = 0;
  let cIdx = 0;
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    if (debtor.amount <= 0) {
      dIdx++;
      continue;
    }
    if (creditor.amount <= 0) {
      cIdx++;
      continue;
    }
    const transfer = Math.min(debtor.amount, creditor.amount);
    suggestedTransfers.push({
      fromUserId: debtor.userId,
      fromName: debtor.name,
      toUserId: creditor.userId,
      toName: creditor.name,
      targetType: 'member',
      amountMinor: transfer,
    });
    debtor.amount -= transfer;
    creditor.amount -= transfer;
    if (debtor.amount === 0) dIdx++;
    if (creditor.amount === 0) cIdx++;
  }

  // Step 3: If Central Group Fund is in deficit (negative cash, e.g. over-reimbursed) and debtors still owe
  if (remainingFundCash < 0) {
    let deficit = Math.abs(remainingFundCash);
    for (const debtor of debtors) {
      if (deficit <= 0) break;
      if (debtor.amount <= 0) continue;
      const pay = Math.min(debtor.amount, deficit);
      suggestedTransfers.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: null,
        toName: 'Central Group Fund',
        targetType: 'group_fund',
        amountMinor: pay,
      });
      debtor.amount -= pay;
      deficit -= pay;
    }
  }

  const totalNet = memberRows.reduce((acc, m) => acc + m.netBalanceMinor, 0);
  const reconciled = totalNet === summary.availableGroupFundMinor + fundSettlementDelta;

  return {
    summary,
    members: memberRows,
    suggestedTransfers,
    recordedTransfers,
    reconciled,
  };
}
