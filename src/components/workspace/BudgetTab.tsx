import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import type {
  ContributionRecord,
  TripDetail,
  TripFinanceSummary,
  TripMember,
} from '../../types';
import { formatMoney } from '../../utils/format';

interface BudgetTabProps {
  trip: TripDetail;
  summary: TripFinanceSummary;
  members: TripMember[];
  onGoToContributions: () => void;
}

export function BudgetTab({ trip, summary, members, onGoToContributions }: BudgetTabProps) {
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);

  useEffect(() => {
    apiFetch<{ contributions: ContributionRecord[] }>(`/api/trips/${trip.id}/contributions`)
      .then((res) => setContributions(res.contributions))
      .catch(() => setContributions([]));
  }, [trip.id]);

  const expectedTotal =
    summary.expectedPerMemberMinor > 0
      ? summary.expectedPerMemberMinor * members.length
      : summary.estimatedBudgetMinor;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budget Overview</h1>
          <p className="text-sm text-slate-600">
            Supports partial and delayed member deposits without assuming full upfront payment.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToContributions}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          Manage Contributions
        </button>
      </div>

      {/* Budget Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Estimated Trip Budget</span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(summary.estimatedBudgetMinor)}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            {formatMoney(summary.expectedPerMemberMinor)} expected / member
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">
            Verified Collected Money
          </span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-teal-700">
            {formatMoney(summary.verifiedContributionsMinor)}
          </span>
          <span className="mt-1 block text-xs text-amber-700 font-mono tabular-nums">
            +{formatMoney(summary.pendingContributionsMinor)} pending verification
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Total Approved Expenses</span>
          <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(summary.totalApprovedExpensesMinor)}
          </span>
          <span className="mt-1 block text-xs text-slate-500 font-mono tabular-nums">
            {summary.budgetUsagePercent}% of budget used
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <span className="block text-xs font-medium text-slate-500">Remaining Group Fund</span>
          <span
            className={`mt-2 block text-2xl font-bold font-mono tabular-nums ${
              summary.availableGroupFundMinor >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatMoney(summary.availableGroupFundMinor)}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Pool cash currently held
          </span>
        </div>
      </div>

      {/* Member Contribution Progress Table (Partial & Delayed Deposits) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Member Contribution Fulfillment
            </h2>
            <p className="text-xs text-slate-500">
              Only verified deposits count toward confirmed collected funds.
            </p>
          </div>
          {expectedTotal > 0 && (
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Target pool: {formatMoney(expectedTotal)}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Member</th>
                <th className="py-3 px-4 text-right">Expected</th>
                <th className="py-3 px-4 text-right">Verified Paid</th>
                <th className="py-3 px-4 text-right">Pending</th>
                <th className="py-3 px-6 text-right">Remaining Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {members.map((m) => {
                const verified = contributions
                  .filter((c) => c.member_id === m.user_id && c.status === 'verified')
                  .reduce((acc, c) => acc + c.amount_minor, 0);
                const pending = contributions
                  .filter((c) => c.member_id === m.user_id && c.status === 'pending')
                  .reduce((acc, c) => acc + c.amount_minor, 0);
                const expected = summary.expectedPerMemberMinor;
                const remaining = Math.max(0, expected - verified);

                return (
                  <tr key={m.user_id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-medium text-slate-900">{m.name}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatMoney(expected)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                      {formatMoney(verified)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {pending > 0 ? formatMoney(pending) : '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums text-slate-700">
                      {expected > 0 ? formatMoney(remaining) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
