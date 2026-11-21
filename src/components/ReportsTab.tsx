import { Download, Printer } from 'lucide-react';
import { formatCurrency } from '../lib/calculations.ts';
import { exportTripReportPdf } from '../lib/pdf-report.ts';
import type {
  TripDetailPayload,
  TripFinancialOverview,
} from '../lib/tripmate-types.ts';

interface ReportsTabProps {
  detail: TripDetailPayload;
  overview: TripFinancialOverview;
}

export function ReportsTab({ detail, overview }: ReportsTabProps) {
  const { trip, members, expenses } = detail;
  const currency = trip.currency;
  const memberMap = new Map(members.map((m) => [m.id, m.memberName]));
  const approvedExpenses = expenses.filter(
    (e) => e.approvalStatus === 'approved',
  );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2744]">
            Financial Report &amp; PDF Export
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Complete category-wise expense breakdown, member-wise financial
            ledger, and downloadable PDF archive.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print View</span>
          </button>

          <button
            type="button"
            onClick={() => exportTripReportPdf(detail, overview)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2744] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173963] cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="print-clean space-y-8 rounded-xl border border-slate-200 bg-white p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              TripMate Official Financial Report
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#0F2744]">
              {trip.tripName}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {trip.destination} · {trip.startDate} to {trip.endDate} ·
              Currency: {currency}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Status: {trip.status.toUpperCase()}</p>
            <p className="mt-1">
              Generated: {new Date().toISOString().slice(0, 10)}
            </p>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-xs text-slate-500">Expected Budget</p>
            <p className="mt-1 font-mono-num text-base font-bold text-[#0F2744]">
              {formatCurrency(overview.totalExpectedBudget, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Collected</p>
            <p className="mt-1 font-mono-num text-base font-bold text-[#0F2744]">
              {formatCurrency(overview.totalCollectedMoney, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Additional Top-Ups</p>
            <p className="mt-1 font-mono-num text-base font-bold text-teal-700">
              {formatCurrency(overview.totalAdditionalContributions, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Trip Expenses</p>
            <p className="mt-1 font-mono-num text-base font-bold text-[#0F2744]">
              {formatCurrency(overview.totalTripExpense, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Remaining Group Fund</p>
            <p className="mt-1 font-mono-num text-base font-bold text-teal-700">
              {formatCurrency(overview.remainingGroupFund, currency)}
            </p>
          </div>
        </div>

        {/* Category-wise Expense Table */}
        <div>
          <h3 className="font-display text-base font-semibold text-[#0F2744]">
            Category-Wise Expense Summary
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4 text-right">Transactions</th>
                  <th className="py-2 pr-4 text-right">Share %</th>
                  <th className="py-2 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.categoryBreakdown.map((cat) => (
                  <tr key={cat.category}>
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {cat.category}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-num text-slate-600">
                      {cat.count}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-num text-slate-600">
                      {cat.percentage.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono-num font-semibold text-[#0F2744]">
                      {formatCurrency(cat.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Member-wise Financial Summary */}
        <div>
          <h3 className="font-display text-base font-semibold text-[#0F2744]">
            Member-Wise Financial Records
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 pr-3 text-right">Contributions</th>
                  <th className="py-2 pr-3 text-right">Personal Adv.</th>
                  <th className="py-2 pr-3 text-right">Expense Share</th>
                  <th className="py-2 pr-3 text-right">Reimbursed</th>
                  <th className="py-2 pr-3 text-right">Refunds</th>
                  <th className="py-2 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.memberSummaries.map((ms) => (
                  <tr key={ms.member.id}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {ms.member.memberName}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.totalContributed, currency)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.personalAdvances, currency)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.allocatedExpenseShare, currency)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.reimbursementsReceived, currency)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.refundsReceived, currency)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono-num font-bold ${
                        ms.netBalance > 0
                          ? 'text-teal-700'
                          : ms.netBalance < 0
                            ? 'text-red-600'
                            : 'text-slate-600'
                      }`}
                    >
                      {ms.netBalance > 0
                        ? `+${formatCurrency(ms.netBalance, currency)}`
                        : formatCurrency(ms.netBalance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Itemized Expense Ledger */}
        <div>
          <h3 className="font-display text-base font-semibold text-[#0F2744]">
            Approved Expense Transactions ({approvedExpenses.length})
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Paid By</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-2 pr-3 font-mono-num text-xs text-slate-600">
                      {exp.expenseDate.slice(0, 10)}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {exp.title}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{exp.category}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {exp.paymentSource === 'group_fund'
                        ? 'Group Fund'
                        : `${memberMap.get(exp.paidByMemberId) ?? 'Member'} (Personal)`}
                    </td>
                    <td className="py-2 text-right font-mono-num font-semibold text-[#0F2744]">
                      {formatCurrency(exp.totalAmount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
