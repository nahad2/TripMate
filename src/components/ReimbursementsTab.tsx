import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/calculations.ts';
import type {
  ReimbursementStatus,
  TripDetailPayload,
  TripFinancialOverview,
} from '../lib/tripmate-types.ts';

interface ReimbursementsTabProps {
  detail: TripDetailPayload;
  overview: TripFinancialOverview;
  onAddReimbursement: (payload: {
    memberId: number;
    amount: number;
    status: ReimbursementStatus;
    paymentDate: string;
    note?: string;
  }) => Promise<void>;
  onUpdateReimbursement: (
    id: number,
    status: ReimbursementStatus,
  ) => Promise<void>;
  onDeleteReimbursement: (id: number) => Promise<void>;
}

export function ReimbursementsTab({
  detail,
  overview,
  onAddReimbursement,
  onUpdateReimbursement,
  onDeleteReimbursement,
}: ReimbursementsTabProps) {
  const { trip, members, reimbursements, myRole, myMemberId } = detail;
  const isAdmin = myRole === 'admin';
  const currency = trip.currency;
  const memberMap = new Map(members.map((m) => [m.id, m.memberName]));

  const [memberId, setMemberId] = useState<number>(
    myMemberId ?? members[0]?.id ?? 0,
  );
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<ReimbursementStatus>('pending');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddReimbursement({
        memberId: isAdmin ? memberId : (myMemberId ?? memberId),
        amount: parsed,
        status: isAdmin ? status : 'pending',
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
            Personal Advances &amp; Reimbursements
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track out-of-pocket payments made on behalf of the group and pay
            them back from the Group Fund.
          </p>
        </div>

        <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div>
            <p className="text-xs text-slate-500">Total Personal Advances</p>
            <p className="font-mono-num text-base font-bold text-[#0F2744]">
              {formatCurrency(overview.expensesPaidFromPersonal, currency)}
            </p>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <p className="text-xs text-slate-500">Reimbursed</p>
            <p className="font-mono-num text-base font-bold text-teal-700">
              {formatCurrency(overview.completedReimbursements, currency)}
            </p>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <p className="text-xs text-slate-500">Pending Payout</p>
            <p className="font-mono-num text-base font-bold text-amber-700">
              {formatCurrency(overview.pendingReimbursementsAmount, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Form */}
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5"
        >
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            {isAdmin ? 'Record Reimbursement' : 'Request Reimbursement'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Completed payouts deduct cash from the Remaining Group Fund.
          </p>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Member Receiving Money
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
                  min="0.01"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="600"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Payout Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as ReimbursementStatus)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  <option value="pending">Pending Payout</option>
                  <option value="completed">Completed (Paid from Pool)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Seafood dinner personal card advance"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F2744] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173963] disabled:opacity-60 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>
                {submitting ? 'Saving...' : 'Save Reimbursement Entry'}
              </span>
            </button>
          </div>
        </form>

        {/* Per-Member Advance Ledger */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            Member Personal Advance Position
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Shows personal money spent versus reimbursements already received or
            queued.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Member</th>
                  <th className="py-2.5 pr-4 text-right">Personal Paid</th>
                  <th className="py-2.5 pr-4 text-right">Reimbursed</th>
                  <th className="py-2.5 pr-4 text-right">Pending Req.</th>
                  <th className="py-2.5 text-right">Unrequested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.memberSummaries.map((ms) => (
                  <tr key={ms.member.id}>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {ms.member.memberName}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.personalAdvances, currency)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-num text-teal-700">
                      {formatCurrency(ms.reimbursementsReceived, currency)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-num text-amber-700">
                      {formatCurrency(ms.pendingReimbursements, currency)}
                    </td>
                    <td className="py-3 text-right font-mono-num font-semibold text-[#0F2744]">
                      {formatCurrency(ms.unrequestedPersonalAdvance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reimbursement History */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            Reimbursement Queue &amp; Payout History ({reimbursements.length})
          </h2>
        </div>
        {reimbursements.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No reimbursement records logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Note</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reimbursements.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 font-mono-num text-xs text-slate-600">
                      {r.paymentDate}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {memberMap.get(r.memberId) ?? 'Member'}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {r.note || '—'}
                    </td>
                    <td className="px-6 py-3 text-xs font-semibold">
                      {r.status === 'completed' ? (
                        <span className="text-teal-700">Completed</span>
                      ) : (
                        <span className="text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-mono-num font-semibold text-[#0F2744]">
                      {formatCurrency(r.amount, currency)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {r.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateReimbursement(r.id, 'completed')
                              }
                              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              Mark Paid
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateReimbursement(r.id, 'pending')
                              }
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              Revert
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteReimbursement(r.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                            aria-label="Delete reimbursement"
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
