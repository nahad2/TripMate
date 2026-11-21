import { useState } from 'react';
import { ArrowRight, CheckCircle2, FileText } from 'lucide-react';
import { formatCurrency, roundMoney } from '../lib/calculations.ts';
import type {
  RefundPolicy,
  TripDetailPayload,
  TripFinancialOverview,
} from '../lib/tripmate-types.ts';

interface SettlementTabProps {
  detail: TripDetailPayload;
  overview: TripFinancialOverview;
  onChangeRefundPolicy: (policy: RefundPolicy) => Promise<void>;
  onFinalizeSettlements: (
    entries: Array<{
      memberId: number;
      totalContributions: number;
      totalPersonalAdvances: number;
      totalExpenseShares: number;
      reimbursementsReceived: number;
      refundsReceived: number;
      netBalance: number;
      settlementStatus: 'pending' | 'completed';
      settledAt: string;
    }>,
    markTripCompleted: boolean,
  ) => Promise<void>;
  onOpenReport: () => void;
}

export function SettlementTab({
  detail,
  overview,
  onChangeRefundPolicy,
  onFinalizeSettlements,
  onOpenReport,
}: SettlementTabProps) {
  const { trip, myRole } = detail;
  const isAdmin = myRole === 'admin';
  const currency = trip.currency;

  const [saving, setSaving] = useState(false);

  async function handleToggleMemberSettled(memberId: number) {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const entries = overview.memberSummaries.map((ms) => {
        if (ms.member.id !== memberId) {
          return {
            memberId: ms.member.id,
            totalContributions: ms.totalContributed,
            totalPersonalAdvances: ms.personalAdvances,
            totalExpenseShares: ms.allocatedExpenseShare,
            reimbursementsReceived: ms.reimbursementsReceived,
            refundsReceived: ms.refundsReceived,
            netBalance: ms.netBalance,
            settlementStatus: ms.settlementStatus,
            settledAt: ms.settledAt,
          };
        }

        const nextStatus: 'pending' | 'completed' =
          ms.settlementStatus === 'completed' ? 'pending' : 'completed';

        const nextRefund =
          nextStatus === 'completed' && ms.netBalance > 0
            ? roundMoney(ms.refundsReceived + ms.netBalance)
            : 0;

        const nextNetBalance =
          nextStatus === 'completed'
            ? 0
            : roundMoney(
                ms.totalContributed +
                  ms.personalAdvances -
                  ms.allocatedExpenseShare -
                  ms.reimbursementsReceived,
              );

        return {
          memberId: ms.member.id,
          totalContributions: ms.totalContributed,
          totalPersonalAdvances: ms.personalAdvances,
          totalExpenseShares: ms.allocatedExpenseShare,
          reimbursementsReceived: ms.reimbursementsReceived,
          refundsReceived: nextRefund,
          netBalance: nextNetBalance,
          settlementStatus: nextStatus,
          settledAt: nextStatus === 'completed' ? today : '',
        };
      });

      await onFinalizeSettlements(entries, false);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalizeAll() {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const entries = overview.memberSummaries.map((ms) => {
        const totalRefund =
          ms.netBalance > 0
            ? roundMoney(ms.refundsReceived + ms.netBalance)
            : ms.refundsReceived;
        return {
          memberId: ms.member.id,
          totalContributions: ms.totalContributed,
          totalPersonalAdvances: ms.personalAdvances,
          totalExpenseShares: ms.allocatedExpenseShare,
          reimbursementsReceived: ms.reimbursementsReceived,
          refundsReceived: totalRefund,
          netBalance: 0,
          settlementStatus: 'completed' as const,
          settledAt: today,
        };
      });
      await onFinalizeSettlements(entries, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2744]">
            Final Settlement &amp; Balance Reconciliation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Audits total contributions, personal advances, expense shares,
            reimbursements, and remaining group cash.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>View Full Report &amp; PDF</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinalizeAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {saving
                  ? 'Finalizing...'
                  : 'Finalize All Settlements & Close Trip'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Formula & Refund Policy Bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8">
          <p className="text-xs font-semibold text-slate-500">
            TripMate Balance Formula
          </p>
          <p className="mt-1.5 font-mono-num text-sm font-medium text-[#0F2744]">
            Member Balance = Contributions + Personal Advances − Allocated
            Expense Shares − Reimbursements − Refunds
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Remaining Group Fund Cash:{' '}
            <span className="font-mono-num font-semibold text-teal-700">
              {formatCurrency(overview.remainingGroupFund, currency)}
            </span>{' '}
            · Total Refunds Disbursed:{' '}
            <span className="font-mono-num font-semibold text-[#0F2744]">
              {formatCurrency(overview.refundsPaidOut, currency)}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
          <label className="block text-xs font-semibold text-slate-500">
            Group Fund Refund Policy
          </label>
          <select
            value={trip.refundPolicy}
            disabled={!isAdmin}
            onChange={(e) =>
              onChangeRefundPolicy(e.target.value as RefundPolicy)
            }
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
          >
            <option value="proportional">
              Proportional to Surplus Balance
            </option>
            <option value="equal">Equal Split of Unused Fund</option>
            <option value="carry_forward">Carry Forward to Next Trip</option>
          </select>
        </div>
      </div>

      {/* Member Settlement Matrix */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3 text-right">Contributions</th>
                <th className="px-4 py-3 text-right">Personal Adv.</th>
                <th className="px-4 py-3 text-right">Expense Share</th>
                <th className="px-4 py-3 text-right">Reimb. Paid</th>
                <th className="px-4 py-3 text-right">Refunds Paid</th>
                <th className="px-4 py-3 text-right">Net Balance</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overview.memberSummaries.map((ms) => {
                const isPositive = ms.netBalance > 0.01;
                const isNegative = ms.netBalance < -0.01;
                return (
                  <tr key={ms.member.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {ms.member.memberName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ms.member.role === 'admin' ? 'Administrator' : 'Member'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.totalContributed, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.personalAdvances, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.allocatedExpenseShare, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.reimbursementsReceived, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.refundsReceived, currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num">
                      <span
                        className={`font-bold ${
                          isPositive
                            ? 'text-teal-700'
                            : isNegative
                              ? 'text-red-600'
                              : 'text-slate-600'
                        }`}
                      >
                        {isPositive
                          ? `+${formatCurrency(ms.netBalance, currency)}`
                          : formatCurrency(ms.netBalance, currency)}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {isPositive
                          ? 'Entitled to receive'
                          : isNegative
                            ? 'Owes group'
                            : 'Settled'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isAdmin ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleToggleMemberSettled(ms.member.id)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                            ms.settlementStatus === 'completed'
                              ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {ms.settlementStatus === 'completed'
                            ? 'Completed'
                            : 'Mark Settled'}
                        </button>
                      ) : (
                        <span
                          className={`text-xs font-semibold ${
                            ms.settlementStatus === 'completed'
                              ? 'text-teal-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {ms.settlementStatus === 'completed'
                            ? 'Completed'
                            : 'Pending'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Action Plan */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-base font-semibold text-[#0F2744]">
          Recommended Settlement Transfers
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Step-by-step collections and refunds to bring every member&apos;s
          balance to 0.
        </p>

        {overview.suggestedTransfers.length === 0 ? (
          <p className="mt-4 text-sm text-teal-700 font-medium">
            All member balances are currently settled at zero.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {overview.suggestedTransfers.map((tr, idx) => (
              <div
                key={`${tr.fromLabel}-${tr.toLabel}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-slate-900">
                    {tr.fromLabel}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-[#0F2744]">
                    {tr.toLabel}
                  </span>
                </div>
                <span
                  className={`font-mono-num font-bold ${
                    tr.kind === 'debtor_to_pool'
                      ? 'text-red-600'
                      : 'text-teal-700'
                  }`}
                >
                  {formatCurrency(tr.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
