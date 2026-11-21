import { jsPDF } from 'jspdf';
import { formatCurrency } from './calculations.ts';
import type {
  TripDetailPayload,
  TripFinancialOverview,
} from './tripmate-types.ts';

export function exportTripReportPdf(
  detail: TripDetailPayload,
  overview: TripFinancialOverview,
): void {
  const { trip, members, expenses } = detail;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  let y = 44;

  const ensureSpace = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 42) {
      doc.addPage();
      y = 44;
    }
  };

  // Navy header strip
  doc.setFillColor(15, 39, 68);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TripMate Financial & Settlement Report', margin, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${trip.tripName}  |  ${trip.destination}  |  ${trip.startDate} to ${trip.endDate}`,
    margin,
    56,
  );
  doc.text(
    `Currency: ${trip.currency}  |  Status: ${trip.status.toUpperCase()}  |  Generated: ${new Date().toISOString().slice(0, 10)}`,
    margin,
    72,
  );

  y = 112;
  doc.setTextColor(15, 23, 42);

  // Executive Financial Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Executive Financial Summary', margin, y);
  y += 16;

  const summaryRows: Array<[string, string]> = [
    [
      'Total Expected Budget',
      formatCurrency(overview.totalExpectedBudget, trip.currency),
    ],
    [
      'Initial Contributions Collected',
      formatCurrency(overview.totalInitialContributions, trip.currency),
    ],
    [
      'Additional Contributions Collected',
      formatCurrency(overview.totalAdditionalContributions, trip.currency),
    ],
    [
      'Total Collected Money',
      formatCurrency(overview.totalCollectedMoney, trip.currency),
    ],
    [
      'Total Trip Expenses',
      formatCurrency(overview.totalTripExpense, trip.currency),
    ],
    [
      'Expenses Paid from Group Fund',
      formatCurrency(overview.expensesPaidFromGroupFund, trip.currency),
    ],
    [
      'Personal Advances Paid by Members',
      formatCurrency(overview.expensesPaidFromPersonal, trip.currency),
    ],
    [
      'Completed Reimbursements',
      formatCurrency(overview.completedReimbursements, trip.currency),
    ],
    [
      'Pending Reimbursements',
      formatCurrency(overview.pendingReimbursementsAmount, trip.currency),
    ],
    [
      'Remaining Group Fund Cash',
      formatCurrency(overview.remainingGroupFund, trip.currency),
    ],
  ];

  doc.setFontSize(9.5);
  summaryRows.forEach(([label, val], idx) => {
    ensureSpace(18);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 11, pageWidth - margin * 2, 16, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 6, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val, pageWidth - margin - 6, y, { align: 'right' });
    y += 16;
  });

  y += 14;
  ensureSpace(60);

  // Category Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Category-Wise Expense Breakdown', margin, y);
  y += 16;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 11, pageWidth - margin * 2, 16, 'F');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Category', margin + 6, y);
  doc.text('Entries', margin + 250, y);
  doc.text('Share %', margin + 330, y);
  doc.text('Amount', pageWidth - margin - 6, y, { align: 'right' });
  y += 16;

  overview.categoryBreakdown.forEach((cat) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(cat.category, margin + 6, y);
    doc.text(String(cat.count), margin + 250, y);
    doc.text(`${cat.percentage.toFixed(1)}%`, margin + 330, y);
    doc.setFont('helvetica', 'bold');
    doc.text(
      formatCurrency(cat.amount, trip.currency),
      pageWidth - margin - 6,
      y,
      { align: 'right' },
    );
    y += 16;
  });

  y += 16;
  ensureSpace(70);

  // Member-Wise Settlement Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Member-Wise Financial Summary & Final Settlement', margin, y);
  y += 16;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 11, pageWidth - margin * 2, 16, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Member', margin + 4, y);
  doc.text('Contrib.', margin + 128, y, { align: 'right' });
  doc.text('Advances', margin + 195, y, { align: 'right' });
  doc.text('Exp. Share', margin + 268, y, { align: 'right' });
  doc.text('Reimb.', margin + 332, y, { align: 'right' });
  doc.text('Refunds', margin + 392, y, { align: 'right' });
  doc.text('Net Balance', pageWidth - margin - 4, y, { align: 'right' });
  y += 16;

  overview.memberSummaries.forEach((ms) => {
    ensureSpace(18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(ms.member.memberName.slice(0, 20), margin + 4, y);
    doc.text(String(ms.totalContributed), margin + 128, y, { align: 'right' });
    doc.text(String(ms.personalAdvances), margin + 195, y, { align: 'right' });
    doc.text(String(ms.allocatedExpenseShare), margin + 268, y, {
      align: 'right',
    });
    doc.text(String(ms.reimbursementsReceived), margin + 332, y, {
      align: 'right',
    });
    doc.text(String(ms.refundsReceived), margin + 392, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    const balText =
      ms.netBalance > 0
        ? `+${ms.netBalance} (Receive)`
        : ms.netBalance < 0
          ? `${ms.netBalance} (Owes)`
          : '0 (Settled)';
    doc.text(balText, pageWidth - margin - 4, y, { align: 'right' });
    y += 16;
  });

  y += 16;
  ensureSpace(60);

  // Approved Expense Ledger
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Expense Ledger', margin, y);
  y += 16;

  const memberById = new Map(members.map((m) => [m.id, m.memberName]));
  const approvedExpenses = expenses.filter((e) => e.approvalStatus === 'approved');

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 11, pageWidth - margin * 2, 16, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Date', margin + 4, y);
  doc.text('Title', margin + 72, y);
  doc.text('Category', margin + 230, y);
  doc.text('Paid By / Source', margin + 335, y);
  doc.text('Amount', pageWidth - margin - 4, y, { align: 'right' });
  y += 16;

  approvedExpenses.forEach((exp) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const payer = memberById.get(exp.paidByMemberId) ?? 'Member';
    const sourceLabel =
      exp.paymentSource === 'personal' ? `${payer} (Personal)` : 'Group Fund';
    doc.text(exp.expenseDate.slice(0, 10), margin + 4, y);
    doc.text(exp.title.slice(0, 32), margin + 72, y);
    doc.text(exp.category.slice(0, 18), margin + 230, y);
    doc.text(sourceLabel.slice(0, 22), margin + 335, y);
    doc.setFont('helvetica', 'bold');
    doc.text(
      formatCurrency(exp.totalAmount, trip.currency),
      pageWidth - margin - 4,
      y,
      { align: 'right' },
    );
    y += 15;
  });

  const safeSlug = trip.tripName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  doc.save(`tripmate-${safeSlug || 'trip'}-report.pdf`);
}
