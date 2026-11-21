import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/calculations.ts';
import type {
  ContributionType,
  TripDetailPayload,
  TripFinancialOverview,
} from '../lib/tripmate-types.ts';

interface ContributionsTabProps {
  detail: TripDetailPayload;
  overview: TripFinancialOverview;
  onAddContribution: (payload: {
    memberId: number;
    amount: number;
    contributionType: ContributionType;
    paymentDate: string;
    note?: string;
  }) => Promise<void>;
  onApproveContribution: (id: number) => Promise<void>;
  onDeleteContribution: (id: number) => Promise<void>;
}

export function ContributionsTab({
  detail,
  overview,
  onAddContribution,
  onApproveContribution,
  onDeleteContribution,
}: ContributionsTabProps) {
  const { trip, members, contributions, myRole, myMemberId } = detail;
  const isAdmin = myRole === 'admin';
  const currency = trip.currency;
  const memberMap = new Map(members.map((m) => [m.id, m.memberName]));

  const [memberId, setMemberId] = useState<number>(
    myMemberId ?? members[0]?.id ?? 0,
  );
  const [amount, setAmount] = useState('');
  const [contributionType, setContributionType] =
    useState<ContributionType>('initial');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'initial' | 'additional' | 'pending'
  >('all');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = contributions.filter((c) => {
    if (filterType === 'initial') return c.contributionType === 'initial';
    if (filterType === 'additional') return c.contributionType === 'additional';
    if (filterType === 'pending') return c.approvalStatus === 'pending';
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Contribution amount must be greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddContribution({
        memberId: isAdmin ? memberId : (myMemberId ?? memberId),
        amount: parsed,
        contributionType,
        paymentDate,
        note,
      });
      setAmount('');
      setNote('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2744]">
            Contributions &amp; Fund Collection
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track staggered initial budget payments and separate additional
            mid-trip fund top-ups.
          </p>
        </div>

        <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div>
            <p className="text-xs text-slate-500">Initial Collected</p>
            <p className="font-mono-num text-base font-bold text-[#0F2744]">
              {formatCurrency(overview.totalInitialContributions, currency)}
            </p>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <p className="text-xs text-slate-500">Additional Top-Ups</p>
            <p className="font-mono-num text-base font-bold text-teal-700">
              {formatCurrency(overview.totalAdditionalContributions, currency)}
            </p>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <p className="text-xs text-slate-500">Total Pool Deposited</p>
            <p className="font-mono-num text-base font-bold text-[#0F2744]">
              {formatCurrency(overview.totalCollectedMoney, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Record Contribution Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5"
        >
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            {isAdmin ? 'Record Member Contribution' : 'Submit Contribution Entry'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAdmin
              ? 'Deposits are immediately added to the Group Fund.'
              : 'Submitted entries appear as Pending until the Trip Administrator verifies receipt.'}
          </p>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Contributing Member
              </label>
              <select
                value={isAdmin ? memberId : (myMemberId ?? memberId)}
                disabled={!isAdmin}
                onChange={(e) => setMemberId(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Amount ({currency})
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Contribution Type
                </label>
                <select
                  value={contributionType}
                  onChange={(e) =>
                    setContributionType(e.target.value as ContributionType)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  <option value="initial">Initial Budget</option>
                  <option value="additional">Additional Money</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="bKash / Cash"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F2744] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#173963] disabled:opacity-60 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>
                {submitting ? 'Saving...' : 'Save Contribution Record'}
              </span>
            </button>
          </div>
        </form>

        {/* Member Payment Status Matrix */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            Member Payment Completion
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Identifies members with remaining initial budget dues versus
            additional top-ups.
          </p>

          <div className="mt-4 space-y-3.5">
            {overview.memberSummaries.map((ms) => {
              const pct =
                ms.assignedBudget > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (ms.initialContributed / ms.assignedBudget) * 100,
                      ),
                    )
                  : 100;
              return (
                <div
                  key={ms.member.id}
                  className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-900">
                      {ms.member.memberName}
                    </span>
                    <div className="font-mono-num text-xs text-slate-600">
                      {formatCurrency(ms.initialContributed, currency)} /{' '}
                      {formatCurrency(ms.assignedBudget, currency)} initial
                      {ms.additionalContributed > 0 && (
                        <span className="ml-2 font-semibold text-teal-700">
                          +{formatCurrency(ms.additionalContributed, currency)}{' '}
                          extra
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? 'bg-teal-600' : 'bg-[#0F2744]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-24 text-right font-mono-num text-xs font-medium text-slate-600">
                      {ms.unpaidBudget > 0
                        ? `${formatCurrency(ms.unpaidBudget, currency)} due`
                        : 'Complete'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contribution History Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            Contribution History ({filtered.length})
          </h2>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'initial', 'additional', 'pending'] as const).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterType(tab)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                    filterType === tab
                      ? 'bg-white text-[#0F2744] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ),
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No contribution records match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Note</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 font-mono-num text-xs text-slate-600">
                      {c.paymentDate}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {memberMap.get(c.memberId) ?? 'Member'}
                    </td>
                    <td className="px-6 py-3 text-slate-600 capitalize">
                      {c.contributionType}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {c.note || '—'}
                    </td>
                    <td className="px-6 py-3 text-xs font-medium">
                      {c.approvalStatus === 'approved' ? (
                        <span className="text-teal-700">Verified</span>
                      ) : (
                        <span className="text-amber-700">Pending Approval</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-mono-num font-semibold text-[#0F2744]">
                      {formatCurrency(c.amount, currency)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {c.approvalStatus === 'pending' && (
                            <button
                              type="button"
                              onClick={() => onApproveContribution(c.id)}
                              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteContribution(c.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                            aria-label="Delete contribution"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
