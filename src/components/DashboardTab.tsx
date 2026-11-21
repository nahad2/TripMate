import { ArrowUpRight, Check, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/calculations.ts';
import type {
  TripDetailPayload,
  TripFinancialOverview,
} from '../lib/tripmate-types.ts';
import { CategoryDonutChart, MemberContributionChart } from './Charts.tsx';

export type WorkspaceTab =
  | 'dashboard'
  | 'members'
  | 'contributions'
  | 'expenses'
  | 'reimbursements'
  | 'settlement'
  | 'reports'
  | 'profile';

interface DashboardTabProps {
  detail: TripDetailPayload;
  overview: TripFinancialOverview;
  onNavigate: (tab: WorkspaceTab) => void;
  onOpenAddExpense: () => void;
  onApproveContribution: (id: number) => Promise<void>;
  onDeleteContribution: (id: number) => Promise<void>;
  onApproveExpense: (id: number) => Promise<void>;
  onDeleteExpense: (id: number) => Promise<void>;
  onMarkReimbursementPaid: (id: number) => Promise<void>;
}

export function DashboardTab({
  detail,
  overview,
  onNavigate,
  onOpenAddExpense,
  onApproveContribution,
  onDeleteContribution,
  onApproveExpense,
  onDeleteExpense,
  onMarkReimbursementPaid,
}: DashboardTabProps) {
  const { trip, members, contributions, expenses, reimbursements, myRole } =
    detail;
  const isAdmin = myRole === 'admin';
  const currency = trip.currency;
  const memberMap = new Map(members.map((m) => [m.id, m.memberName]));

  const pendingContributions = contributions.filter(
    (c) => c.approvalStatus === 'pending',
  );
  const pendingExpenses = expenses.filter((e) => e.approvalStatus === 'pending');
  const pendingReimbursements = reimbursements.filter(
    (r) => r.status === 'pending',
  );

  const recentExpenses = expenses
    .filter((e) => e.approvalStatus === 'approved')
    .slice(0, 6);

  const collectionProgress =
    overview.totalExpectedBudget > 0
      ? Math.min(
          100,
          Math.round(
            (overview.totalInitialContributions /
              overview.totalExpectedBudget) *
              100,
          ),
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Trip Header Banner */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="flex flex-col justify-between p-6 lg:col-span-8">
            <div>
              <p className="text-xs font-medium text-teal-700">
                {trip.destination} · {trip.startDate} to {trip.endDate} ·{' '}
                {members.length} members ·{' '}
                <span className="capitalize">{trip.status}</span>
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-[#0F2744]">
                {trip.tripName}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Your role:{' '}
                <span className="font-semibold text-[#0F2744]">
                  {isAdmin ? 'Trip Administrator' : 'Group Member'}
                </span>{' '}
                · Currency: <span className="font-medium">{currency}</span> ·
                Initial budget collection at{' '}
                <span className="font-mono-num font-semibold text-teal-700">
                  {collectionProgress}%
                </span>
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenAddExpense}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2744] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#173963] whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Expense</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('contributions')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 whitespace-nowrap cursor-pointer"
              >
                <span>Record Contribution</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settlement')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 whitespace-nowrap cursor-pointer"
              >
                <span>View Settlement</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative h-44 bg-slate-100 lg:col-span-4 lg:h-auto">
            {trip.coverImage ? (
              <img
                src={trip.coverImage}
                alt={trip.destination}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#0F2744] text-sm font-medium text-white">
                {trip.destination}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Expected Budget
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[#0F2744]">
            {formatCurrency(overview.totalExpectedBudget, currency)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Across {members.length} assigned member budgets
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Collected Money
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[#0F2744]">
            {formatCurrency(overview.totalCollectedMoney, currency)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {formatCurrency(overview.totalInitialContributions, currency)} initial
            · {formatCurrency(overview.totalAdditionalContributions, currency)}{' '}
            additional
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Trip Expenses
          </p>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[#0F2744]">
            {formatCurrency(overview.totalTripExpense, currency)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {formatCurrency(overview.expensesPaidFromGroupFund, currency)} pool
            · {formatCurrency(overview.expensesPaidFromPersonal, currency)}{' '}
            personal
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Remaining Group Fund
          </p>
          <p
            className={`mt-2 font-mono-num text-2xl font-bold ${
              overview.remainingGroupFund < 0
                ? 'text-red-600'
                : 'text-teal-700'
            }`}
          >
            {formatCurrency(overview.remainingGroupFund, currency)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {formatCurrency(overview.pendingReimbursementsAmount, currency)}{' '}
            pending reimbursements
          </p>
        </div>
      </div>

      {/* Pending Member Submissions Queue (visible when pending entries exist) */}
      {(pendingContributions.length > 0 || pendingExpenses.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-amber-950">
                Pending Financial Verifications (
                {pendingContributions.length + pendingExpenses.length})
              </h2>
              <p className="text-xs text-amber-800">
                {isAdmin
                  ? 'Review and approve member-submitted contributions and personal expenses before they enter official totals.'
                  : 'Submitted entries awaiting Trip Administrator verification.'}
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-amber-200/80 border-t border-amber-200/80">
            {pendingContributions.map((c) => (
              <div
                key={`pc-${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {memberMap.get(c.memberId) ?? 'Member'}
                  </span>{' '}
                  <span className="text-slate-600">
                    submitted {c.contributionType} contribution ·{' '}
                    {c.paymentDate}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-num font-semibold text-[#0F2744]">
                    {formatCurrency(c.amount, currency)}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onApproveContribution(c.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteContribution(c.id)}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white p-1 text-slate-600 hover:text-red-600 cursor-pointer"
                        aria-label="Reject contribution"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pendingExpenses.map((e) => (
              <div
                key={`pe-${e.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-900">{e.title}</span>{' '}
                  <span className="text-slate-600">
                    · {e.category} · Paid by{' '}
                    {memberMap.get(e.paidByMemberId) ?? 'Member'} (
                    {e.paymentSource === 'personal' ? 'Personal' : 'Group Fund'}
                    )
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-num font-semibold text-[#0F2744]">
                    {formatCurrency(e.totalAmount, currency)}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onApproveExpense(e.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(e.id)}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white p-1 text-slate-600 hover:text-red-600 cursor-pointer"
                        aria-label="Reject expense"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2744]">
                Expense Category Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Approved spending across trip categories
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
            >
              Full Report
            </button>
          </div>
          <CategoryDonutChart
            categories={overview.categoryBreakdown}
            totalExpense={overview.totalTripExpense}
            currency={currency}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2744]">
                Member Contribution Overview
              </h2>
              <p className="text-xs text-slate-500">
                Budget vs deposited contributions vs allocated shares
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('contributions')}
              className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
            >
              Manage Contributions
            </button>
          </div>
          <MemberContributionChart
            summaries={overview.memberSummaries}
            currency={currency}
          />
        </div>
      </div>

      {/* Bottom Row: Recent Expenses + Pending Reimbursements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2744]">
                Recent Expenses
              </h2>
              <p className="text-xs text-slate-500">
                Latest approved shared and individual transactions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
            >
              All Expenses ({expenses.length})
            </button>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No expenses logged yet. Click &ldquo;Add Expense&rdquo; to record
              your first trip transaction.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 pr-4">Expense</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 pr-4">Paid By</th>
                    <th className="py-2.5 pr-4">Split</th>
                    <th className="py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">{exp.title}</p>
                        <p className="text-xs text-slate-500">
                          {exp.expenseDate.slice(0, 10)}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {exp.category}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {exp.paymentSource === 'group_fund'
                          ? 'Group Fund'
                          : `${memberMap.get(exp.paidByMemberId) ?? 'Member'} (Personal)`}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 capitalize">
                        {exp.splitMethod} · {exp.participants.length}/
                        {members.length}
                      </td>
                      <td className="py-3 text-right font-mono-num font-semibold text-[#0F2744]">
                        {formatCurrency(exp.totalAmount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2744]">
                Pending Reimbursements
              </h2>
              <p className="text-xs text-slate-500">
                Personal advances awaiting payout
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reimbursements')}
              className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {pendingReimbursements.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              All personal advances are reimbursed.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingReimbursements.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {memberMap.get(r.memberId) ?? 'Member'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {r.note || r.paymentDate}
                      </p>
                    </div>
                    <span className="font-mono-num text-sm font-semibold text-amber-700 shrink-0">
                      {formatCurrency(r.amount, currency)}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onMarkReimbursementPaid(r.id)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100 cursor-pointer"
                    >
                      <Check className="h-3 w-3" />
                      Mark Paid from Pool
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
