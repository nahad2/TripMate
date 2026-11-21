import {
  ArrowRight,
  Calendar,
  MapPin,
  NotebookPen,
  Plus,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react';
import type {
  ActivityLogItem,
  TripDetail,
  TripFinanceSummary,
  TripMembership,
} from '../../types';
import { formatDateRange, formatMoney, formatTimestamp } from '../../utils/format';
import { RoleLabel, StatusLabel } from '../StatusLabel';
import { TripCoverImage } from '../TripCoverImage';

interface OverviewTabProps {
  trip: TripDetail;
  membership: TripMembership;
  summary: TripFinanceSummary;
  recentLogs: ActivityLogItem[];
  onNavigate: (tab: string) => void;
  onQuickAddExpense: () => void;
  onQuickAddContribution: () => void;
}

export function OverviewTab({
  trip,
  membership,
  summary,
  recentLogs,
  onNavigate,
  onQuickAddExpense,
  onQuickAddContribution,
}: OverviewTabProps) {
  const isLocked = trip.status === 'completed' || trip.status === 'archived';
  const progressClamped = Math.min(100, Math.max(0, summary.budgetUsagePercent));

  return (
    <div className="space-y-6">
      {/* Trip Header Summary */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 min-h-[180px] bg-slate-100">
          <TripCoverImage
            src={trip.cover_image}
            alt={trip.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="lg:col-span-8 p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <StatusLabel status={trip.status} />
                <span aria-hidden="true">·</span>
                <span className="capitalize">{trip.visibility} trip</span>
                <span aria-hidden="true">·</span>
                <RoleLabel role={membership.role} />
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {summary.activeMembersCount} active members
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{trip.name}</h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-700" />
                {trip.destination}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                {formatDateRange(trip.start_date, trip.end_date)}
              </span>
            </div>

            {trip.description && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed line-clamp-2">
                {trip.description}
              </p>
            )}
          </div>

          {!isLocked && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onQuickAddExpense}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Submit Expense
              </button>
              <button
                type="button"
                onClick={onQuickAddContribution}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                Record Contribution
              </button>
              <button
                type="button"
                onClick={() => onNavigate('notepad')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                <NotebookPen className="w-3.5 h-3.5" />
                Open Notepad
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settlement')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                Final Settlement
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Central Group Fund Financial Ledger Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Available Group Fund</span>
          <span
            className={`mt-2 block text-2xl font-bold font-mono tabular-nums ${
              summary.availableGroupFundMinor >= 0 ? 'text-teal-700' : 'text-red-700'
            }`}
          >
            {formatMoney(summary.availableGroupFundMinor)}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Verified − Pool Expenses − Reimbursed
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Verified Contributions</span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(summary.verifiedContributionsMinor)}
          </span>
          <span className="mt-1 block text-xs text-amber-700 font-mono tabular-nums">
            {formatMoney(summary.pendingContributionsMinor)} pending verification
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Total Approved Expenses</span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(summary.totalApprovedExpensesMinor)}
          </span>
          <span className="mt-1 block text-xs text-slate-500 font-mono tabular-nums">
            {formatMoney(summary.groupFundExpensesMinor)} from pool
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Personal Advances</span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(summary.personalAdvancesMinor)}
          </span>
          <span className="mt-1 block text-xs text-slate-500 font-mono tabular-nums">
            {formatMoney(summary.remainingPersonalLiabilityMinor)} owed to members
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Pending Approvals</span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-amber-700">
            {summary.pendingExpenseRequestsCount + summary.pendingJoinRequestsCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            {summary.pendingExpenseRequestsCount} expenses · {summary.pendingJoinRequestsCount}{' '}
            joins
          </span>
        </div>
      </section>

      {/* Budget Progress + Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Budget Utilization</h2>
            <button
              type="button"
              onClick={() => onNavigate('budget')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
            >
              Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm text-slate-600">
                Spent{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatMoney(summary.totalApprovedExpensesMinor)}
                </strong>{' '}
                of{' '}
                <span className="font-mono tabular-nums">
                  {formatMoney(summary.estimatedBudgetMinor)}
                </span>
              </span>
              <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                {summary.budgetUsagePercent}%
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  summary.budgetUsagePercent > 100 ? 'bg-red-600' : 'bg-teal-600'
                }`}
                style={{ width: `${progressClamped}%` }}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Expected per member</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatMoney(summary.expectedPerMemberMinor)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Reimbursements paid</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatMoney(summary.reimbursementsPaidMinor)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Reimbursements pending</span>
              <span className="font-mono tabular-nums font-medium text-amber-700">
                {formatMoney(summary.reimbursementsPendingMinor)}
              </span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Recent Audit Activity</h2>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              View Expenses
            </button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No recorded activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-800">{log.summary}</p>
                    <p className="text-xs text-slate-500 mt-0.5">By {log.actor_name}</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                    {formatTimestamp(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
