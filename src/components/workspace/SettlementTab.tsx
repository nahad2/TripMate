import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { apiFetch } from '../../api';
import type {
  SuggestedTransfer,
  TripMembership,
  TripSettlementReport,
} from '../../types';
import { formatMoney, formatTimestamp } from '../../utils/format';
import { StatusLabel } from '../StatusLabel';

interface SettlementTabProps {
  tripId: number;
  membership: TripMembership;
  onFinancialChanged: () => void;
}

export function SettlementTab({ tripId, membership, onFinancialChanged }: SettlementTabProps) {
  const canSettle =
    membership.role === 'owner' || membership.permissions.can_manage_contributions;

  const [report, setReport] = useState<TripSettlementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<TripSettlementReport>(`/api/trips/${tripId}/settlement`);
      setReport(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  async function recordSuggestedTransfer(t: SuggestedTransfer, markCompleted: boolean) {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/settlement/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: t.fromUserId,
          to_user_id: t.toUserId,
          target_type: t.targetType,
          amount_minor: t.amountMinor,
          mark_completed: markCompleted,
        }),
      });
      setFeedback(
        markCompleted
          ? 'Settlement transfer recorded and verified as completed.'
          : 'Settlement transfer queued as pending verification.'
      );
      await load();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function completePendingTransfer(transferId: number) {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/settlement/transfers/${transferId}/complete`, {
        method: 'PATCH',
      });
      setFeedback('Settlement transfer verified as completed.');
      await load();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading || !report) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
        Calculating member settlement ledger...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Final Settlement & Reconciliation</h1>
          <p className="text-sm text-slate-600">
            Calculated exclusively from verified contributions, approved expenses, and completed
            reimbursements.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg self-start sm:self-auto">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {report.reconciled
              ? 'Reconciled with Central Group Fund'
              : 'Reconciliation check pending'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
          {feedback}
        </div>
      )}

      {/* Member-wise Settlement Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Member Financial Breakdown</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Member</th>
                <th className="py-3 px-3 text-right">Verified Contrib.</th>
                <th className="py-3 px-3 text-right">Expense Share</th>
                <th className="py-3 px-3 text-right">Personal Paid</th>
                <th className="py-3 px-3 text-right">Reimb. Received</th>
                <th className="py-3 px-3 text-right">Net Balance</th>
                <th className="py-3 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {report.members.map((m) => (
                <tr key={m.userId} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-6">
                    <p className="font-semibold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{m.explanation}</span>
                    </p>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatMoney(m.verifiedContributionMinor)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatMoney(m.assignedExpenseShareMinor)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatMoney(m.personalPaidMinor)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                    {formatMoney(m.reimbursementsReceivedMinor)}
                  </td>
                  <td
                    className={`py-3.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                      m.netBalanceMinor > 0
                        ? 'text-teal-700'
                        : m.netBalanceMinor < 0
                          ? 'text-red-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(m.netBalanceMinor, true)}
                  </td>
                  <td className="py-3.5 px-6">
                    <StatusLabel status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suggested Minimum Transfers */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Suggested Settlement Transfers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Minimized payment plan reconciling the Central Group Fund (
            <span className="font-mono">{formatMoney(report.summary.availableGroupFundMinor)}</span>
            ) and member balances. Transfers are only marked completed after authorized
            verification.
          </p>
        </div>

        {report.suggestedTransfers.length === 0 ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
            All member balances and group fund accounts are fully settled.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {report.suggestedTransfers.map((t, idx) => (
              <div
                key={`${t.fromName}-${t.toName}-${idx}`}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="font-semibold text-slate-900">{t.fromName}</span>
                  <ArrowRight className="w-4 h-4 text-teal-700 shrink-0" />
                  <span className="font-semibold text-slate-900">{t.toName}</span>
                  <span className="font-mono tabular-nums font-bold text-teal-700 ml-2">
                    {formatMoney(t.amountMinor)}
                  </span>
                </div>

                {canSettle && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => recordSuggestedTransfer(t, true)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
                    >
                      Verify & Mark Paid
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Verified / Pending Settlement Transfer History */}
      {report.recordedTransfers.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Recorded Settlement Transfers
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {report.recordedTransfers.map((rt) => (
              <div
                key={rt.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-900">{rt.from_name}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="font-medium text-slate-900">{rt.to_name}</span>
                  <span className="ml-3 font-mono tabular-nums font-semibold text-slate-900">
                    {formatMoney(rt.amount_minor)}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {rt.verified_by_name ? `Verified by ${rt.verified_by_name} · ` : ''}
                    {formatTimestamp(rt.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusLabel status={rt.status} />
                  {rt.status === 'pending' && canSettle && (
                    <button
                      type="button"
                      onClick={() => completePendingTransfer(rt.id)}
                      className="px-3 py-1 bg-teal-700 text-white text-xs font-medium rounded-md"
                    >
                      Verify Payment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
