import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { apiFetch } from '../../api';
import type { ContributionRecord, TripMember, TripMembership, User } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { StatusLabel } from '../StatusLabel';

interface ContributionsTabProps {
  tripId: number;
  tripStatus: string;
  currentUser: User;
  membership: TripMembership;
  members: TripMember[];
  initialShowModal?: boolean;
  onModalHandled?: () => void;
  onFinancialChanged: () => void;
}

export function ContributionsTab({
  tripId,
  tripStatus,
  currentUser,
  membership,
  members,
  initialShowModal = false,
  onModalHandled,
  onFinancialChanged,
}: ContributionsTabProps) {
  const canManage =
    membership.role === 'owner' || membership.permissions.can_manage_contributions;
  const isLocked = tripStatus === 'completed' || tripStatus === 'archived';

  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(initialShowModal);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [memberId, setMemberId] = useState<number>(currentUser.id);
  const [amount, setAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [note, setNote] = useState('');
  const [autoVerify, setAutoVerify] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialShowModal) {
      setShowAdd(true);
      onModalHandled?.();
    }
  }, [initialShowModal, onModalHandled]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ contributions: ContributionRecord[] }>(
        `/api/trips/${tripId}/contributions`
      );
      setContributions(res.contributions);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/trips/${tripId}/contributions`, {
        method: 'POST',
        body: JSON.stringify({
          member_id: canManage ? memberId : currentUser.id,
          amount: Number(amount),
          contribution_date: contributionDate,
          payment_method: paymentMethod,
          note,
          auto_verify: canManage ? autoVerify : false,
        }),
      });
      setAmount('');
      setNote('');
      setShowAdd(false);
      await load();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyContribution(id: number, status: 'verified' | 'rejected') {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/contributions/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const filtered = contributions.filter((c) => {
    if (filterMember !== 'all' && String(c.member_id) !== filterMember) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contribution Ledger</h1>
          <p className="text-sm text-slate-600">
            Every initial, partial, and additional deposit is stored as an individual verified
            transaction.
          </p>
        </div>

        {!isLocked && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            {canManage ? 'Record Contribution' : 'Submit Payment Record'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <option value="all">All Members</option>
          {members.map((m) => (
            <option key={m.user_id} value={String(m.user_id)}>
              {m.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {['all', 'verified', 'pending', 'rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                filterStatus === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Method & Note</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                {canManage && !isLocked && <th className="py-3 px-6 text-right">Verification</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading contributions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No contribution records match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(c.contribution_date)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">{c.member_name}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{c.payment_method}</span>
                      {c.note && <span className="block text-slate-500 mt-0.5">{c.note}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatMoney(c.amount_minor)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusLabel status={c.status} />
                    </td>
                    {canManage && !isLocked && (
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        {c.status === 'pending' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => verifyContribution(c.id, 'verified')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => verifyContribution(c.id, 'rejected')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {c.verified_by_name ? `By ${c.verified_by_name}` : '—'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contribution Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                {canManage ? 'Record Member Contribution' : 'Submit Contribution Record'}
              </h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {canManage && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Member</label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount (৳)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="2000"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={contributionDate}
                    onChange={(e) => setContributionDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Method / Source
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Initial partial installment"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              {canManage ? (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoVerify}
                    onChange={(e) => setAutoVerify(e.target.checked)}
                    className="w-4 h-4 accent-teal-700"
                  />
                  <span>Verify immediately and include in Confirmed Group Fund</span>
                </label>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  Submitted payment records remain Pending until verified by an authorized Admin or
                  Owner.
                </p>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
