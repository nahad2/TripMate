import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { apiFetch } from '../../api';
import type {
  ActivityLogItem,
  ContributionRecord,
  ReimbursementRecord,
  TripDetail,
  TripSettlementReport,
} from '../../types';
import { downloadCsv, formatDate, formatDateRange, formatMoney, formatTimestamp } from '../../utils/format';

interface ReportPayload {
  generatedAt: string;
  trip: TripDetail;
  settlement: TripSettlementReport;
  categoryBreakdown: Array<{ category: string; count: number; total_minor: number }>;
  contributions: ContributionRecord[];
  expenses: Array<{
    id: number;
    title: string;
    category: string;
    expense_date: string;
    amount_minor: number;
    payment_source: string;
    split_type: string;
    paid_by_name: string;
    approved_by_name: string | null;
  }>;
  reimbursements: ReimbursementRecord[];
  activityLogs: ActivityLogItem[];
}

type ReportType =
  | 'complete'
  | 'contributions'
  | 'expenses'
  | 'categories'
  | 'reimbursements'
  | 'settlement'
  | 'activity';

interface ReportsTabProps {
  tripId: number;
}

export function ReportsTab({ tripId }: ReportsTabProps) {
  const [reportType, setReportType] = useState<ReportType>('complete');
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<ReportPayload>(`/api/trips/${tripId}/reports`)
      .then((res) => setData(res))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [tripId]);

  function handleExportCsv() {
    if (!data) return;
    const slug = data.trip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (reportType === 'contributions') {
      downloadCsv(
        `${slug}-contributions.csv`,
        ['Date', 'Member', 'Method', 'Amount (BDT)', 'Status', 'Verified By', 'Note'],
        data.contributions.map((c) => [
          c.contribution_date,
          c.member_name,
          c.payment_method,
          (c.amount_minor / 100).toFixed(2),
          c.status,
          c.verified_by_name || '',
          c.note,
        ])
      );
      return;
    }
    if (reportType === 'categories') {
      downloadCsv(
        `${slug}-categories.csv`,
        ['Category', 'Transactions', 'Total (BDT)'],
        data.categoryBreakdown.map((c) => [c.category, c.count, (c.total_minor / 100).toFixed(2)])
      );
      return;
    }
    if (reportType === 'reimbursements') {
      downloadCsv(
        `${slug}-reimbursements.csv`,
        ['Date', 'Member', 'Method', 'Amount (BDT)', 'Status', 'Note'],
        data.reimbursements.map((r) => [
          r.payment_date,
          r.member_name,
          r.payment_method,
          (r.amount_minor / 100).toFixed(2),
          r.status,
          r.note,
        ])
      );
      return;
    }
    if (reportType === 'settlement' || reportType === 'complete') {
      downloadCsv(
        `${slug}-settlement.csv`,
        [
          'Member',
          'Verified Contributions',
          'Expense Share',
          'Personal Paid',
          'Reimbursed',
          'Net Balance',
          'Status',
        ],
        data.settlement.members.map((m) => [
          m.name,
          (m.verifiedContributionMinor / 100).toFixed(2),
          (m.assignedExpenseShareMinor / 100).toFixed(2),
          (m.personalPaidMinor / 100).toFixed(2),
          (m.reimbursementsReceivedMinor / 100).toFixed(2),
          (m.netBalanceMinor / 100).toFixed(2),
          m.status,
        ])
      );
      return;
    }
    if (reportType === 'activity') {
      downloadCsv(
        `${slug}-activity.csv`,
        ['Timestamp', 'Actor', 'Action', 'Summary'],
        data.activityLogs.map((l) => [l.created_at, l.actor_name, l.action_type, l.summary])
      );
      return;
    }
    downloadCsv(
      `${slug}-expenses.csv`,
      ['Date', 'Title', 'Category', 'Paid By', 'Source', 'Split', 'Amount (BDT)'],
      data.expenses.map((e) => [
        e.expense_date,
        e.title,
        e.category,
        e.paid_by_name,
        e.payment_source,
        e.split_type,
        (e.amount_minor / 100).toFixed(2),
      ])
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
        Generating financial report...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'Unable to load reports.'}
      </div>
    );
  }

  const reportTabs: Array<{ id: ReportType; label: string }> = [
    { id: 'complete', label: 'Complete Trip Report' },
    { id: 'contributions', label: 'Member Contributions' },
    { id: 'expenses', label: 'Expense Report' },
    { id: 'categories', label: 'Category Breakdown' },
    { id: 'reimbursements', label: 'Reimbursements' },
    { id: 'settlement', label: 'Final Settlement' },
    { id: 'activity', label: 'Activity History' },
  ];

  return (
    <div className="space-y-6">
      {/* Controls (hidden when printing PDF) */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                reportType === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="print-area bg-white border border-slate-200 rounded-xl p-8 space-y-8">
        {/* Report Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">TripMate Financial Report</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{data.trip.name}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {data.trip.destination} · {formatDateRange(data.trip.start_date, data.trip.end_date)}
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-800 capitalize">
              {reportTabs.find((t) => t.id === reportType)?.label}
            </p>
            <p className="font-mono mt-0.5">Generated: {formatTimestamp(data.generatedAt)}</p>
          </div>
        </div>

        {/* Executive Financial Summary */}
        {(reportType === 'complete' || reportType === 'settlement') && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-xs text-slate-500">Verified Pool Deposits</span>
              <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-slate-900">
                {formatMoney(data.settlement.summary.verifiedContributionsMinor)}
              </span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-xs text-slate-500">Total Approved Expenses</span>
              <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-slate-900">
                {formatMoney(data.settlement.summary.totalApprovedExpensesMinor)}
              </span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-xs text-slate-500">Personal Advances</span>
              <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-slate-900">
                {formatMoney(data.settlement.summary.personalAdvancesMinor)}
              </span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="block text-xs text-slate-500">Available Group Fund</span>
              <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-teal-700">
                {formatMoney(data.settlement.summary.availableGroupFundMinor)}
              </span>
            </div>
          </div>
        )}

        {/* Member Balances */}
        {(reportType === 'complete' || reportType === 'settlement') && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Member-wise Balances</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 px-3 text-right">Contributions</th>
                  <th className="py-2 px-3 text-right">Expense Share</th>
                  <th className="py-2 px-3 text-right">Personal Paid</th>
                  <th className="py-2 px-3 text-right">Reimbursed</th>
                  <th className="py-2 pl-3 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.settlement.members.map((m) => (
                  <tr key={m.userId}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{m.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(m.verifiedContributionMinor)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(m.assignedExpenseShareMinor)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(m.personalPaidMinor)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(m.reimbursementsReceivedMinor)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(m.netBalanceMinor, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Category Breakdown */}
        {(reportType === 'complete' || reportType === 'categories') && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Category-wise Expenses</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 px-4 text-right">Transactions</th>
                  <th className="py-2 pl-4 text-right">Total Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.categoryBreakdown.map((c) => (
                  <tr key={c.category}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{c.category}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{c.count}</td>
                    <td className="py-2.5 pl-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(c.total_minor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Contributions Table */}
        {(reportType === 'complete' || reportType === 'contributions') && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Contribution Records</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 px-3">Member</th>
                  <th className="py-2 px-3">Method</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 pl-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.contributions.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{formatDate(c.contribution_date)}</td>
                    <td className="py-2 px-3 font-medium">{c.member_name}</td>
                    <td className="py-2 px-3 text-slate-600">{c.payment_method}</td>
                    <td className="py-2 px-3 capitalize text-xs">{c.status}</td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums">
                      {formatMoney(c.amount_minor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Expenses Table */}
        {(reportType === 'complete' || reportType === 'expenses') && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Approved Expense Details</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Paid By / Source</th>
                  <th className="py-2 pl-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{formatDate(e.expense_date)}</td>
                    <td className="py-2 px-3 font-medium">{e.title}</td>
                    <td className="py-2 px-3 text-slate-600">{e.category}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">
                      {e.paid_by_name} ({e.payment_source === 'personal' ? 'Personal' : 'Pool'})
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums font-medium">
                      {formatMoney(e.amount_minor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reimbursements Table */}
        {(reportType === 'complete' || reportType === 'reimbursements') && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Reimbursement Records</h2>
            {data.reimbursements.length === 0 ? (
              <p className="text-sm text-slate-500">No reimbursements recorded.</p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 px-3">Recipient</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.reimbursements.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-mono text-xs">{formatDate(r.payment_date)}</td>
                      <td className="py-2 px-3 font-medium">{r.member_name}</td>
                      <td className="py-2 px-3">{r.payment_method}</td>
                      <td className="py-2 px-3 capitalize text-xs">{r.status}</td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums">
                        {formatMoney(r.amount_minor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Activity History */}
        {(reportType === 'complete' || reportType === 'activity') && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Activity Audit Trail</h2>
            <div className="divide-y divide-slate-100 text-xs">
              {data.activityLogs.slice(0, 25).map((log) => (
                <div key={log.id} className="py-2 flex items-center justify-between gap-4">
                  <span className="text-slate-800">
                    <strong>{log.actor_name}:</strong> {log.summary}
                  </span>
                  <span className="font-mono text-slate-400 shrink-0">
                    {formatTimestamp(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
