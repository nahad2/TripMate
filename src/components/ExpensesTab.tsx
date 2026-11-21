import { useEffect, useState } from 'react';
import { Check, Plus, Search, Trash2, X } from 'lucide-react';
import {
  computeEqualShares,
  formatCurrency,
  roundMoney,
} from '../lib/calculations.ts';
import {
  EXPENSE_CATEGORIES,
  type PaymentSource,
  type SplitMethod,
  type TripDetailPayload,
} from '../lib/tripmate-types.ts';

interface ExpensesTabProps {
  detail: TripDetailPayload;
  openModalTrigger: number;
  onAddExpense: (payload: {
    title: string;
    category: string;
    totalAmount: number;
    paidByMemberId: number;
    paymentSource: PaymentSource;
    splitMethod: SplitMethod;
    expenseDate: string;
    notes?: string;
    participants: Array<{ memberId: number; shareAmount: number }>;
    createReimbursement?: boolean;
  }) => Promise<void>;
  onApproveExpense: (id: number) => Promise<void>;
  onDeleteExpense: (id: number) => Promise<void>;
}

export function ExpensesTab({
  detail,
  openModalTrigger,
  onAddExpense,
  onApproveExpense,
  onDeleteExpense,
}: ExpensesTabProps) {
  const { trip, members, expenses, myRole, myMemberId } = detail;
  const isAdmin = myRole === 'admin';
  const currency = trip.currency;
  const memberMap = new Map(members.map((m) => [m.id, m.memberName]));

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'group_fund' | 'personal'
  >('all');
  const [modalOpen, setModalOpen] = useState(false);

  // Add Expense form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState<number>(
    myMemberId ?? members[0]?.id ?? 0,
  );
  const [paymentSource, setPaymentSource] =
    useState<PaymentSource>('group_fund');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [notes, setNotes] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>(
    members.map((m) => m.id),
  );
  const [customShares, setCustomShares] = useState<Record<number, string>>({});
  const [individualMemberId, setIndividualMemberId] = useState<number>(
    myMemberId ?? members[0]?.id ?? 0,
  );
  const [createReimbursement, setCreateReimbursement] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (openModalTrigger > 0) {
      setSelectedMemberIds(members.map((m) => m.id));
      setPaidByMemberId(myMemberId ?? members[0]?.id ?? 0);
      setIndividualMemberId(myMemberId ?? members[0]?.id ?? 0);
      setModalOpen(true);
    }
  }, [openModalTrigger, members, myMemberId]);

  const parsedTotal = Number(totalAmount || 0);

  const equalPreviewShares =
    splitMethod === 'equal' && parsedTotal > 0
      ? computeEqualShares(parsedTotal, selectedMemberIds)
      : [];

  const customAllocatedSum = roundMoney(
    members.reduce(
      (sum, m) => sum + Number(customShares[m.id] || 0),
      0,
    ),
  );

  function toggleParticipant(id: number) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function distributeEquallyToCustom() {
    if (parsedTotal <= 0 || members.length === 0) return;
    const shares = computeEqualShares(
      parsedTotal,
      members.map((m) => m.id),
    );
    const next: Record<number, string> = {};
    for (const s of shares) {
      next[s.memberId] = String(s.shareAmount);
    }
    setCustomShares(next);
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Expense title is required.');
      return;
    }
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      setFormError('Total amount must be greater than zero.');
      return;
    }

    let participants: Array<{ memberId: number; shareAmount: number }> = [];
    if (splitMethod === 'equal') {
      if (selectedMemberIds.length === 0) {
        setFormError('Select at least one participating member.');
        return;
      }
      participants = computeEqualShares(parsedTotal, selectedMemberIds);
    } else if (splitMethod === 'individual') {
      participants = [{ memberId: individualMemberId, shareAmount: parsedTotal }];
    } else {
      participants = members
        .map((m) => ({
          memberId: m.id,
          shareAmount: roundMoney(Number(customShares[m.id] || 0)),
        }))
        .filter((p) => p.shareAmount > 0);

      if (participants.length === 0) {
        setFormError('Assign a positive share to at least one member.');
        return;
      }
      if (Math.abs(customAllocatedSum - parsedTotal) > 0.05) {
        setFormError(
          `Custom shares sum to ${formatCurrency(customAllocatedSum, currency)}, which must equal ${formatCurrency(parsedTotal, currency)}.`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      await onAddExpense({
        title: title.trim(),
        category,
        totalAmount: parsedTotal,
        paidByMemberId,
        paymentSource,
        splitMethod,
        expenseDate,
        notes,
        participants,
        createReimbursement:
          paymentSource === 'personal' ? createReimbursement : false,
      });
      setTitle('');
      setTotalAmount('');
      setNotes('');
      setCustomShares({});
      setModalOpen(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      !search.trim() ||
      exp.title.toLowerCase().includes(search.toLowerCase()) ||
      exp.notes.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      categoryFilter === 'All' || exp.category === categoryFilter;
    const matchesSource =
      sourceFilter === 'all' || exp.paymentSource === sourceFilter;
    return matchesSearch && matchesCat && matchesSource;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2744]">
            Expenses &amp; Split Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage equal, custom, and individual expenses while excluding
            non-participating members.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedMemberIds(members.map((m) => m.id));
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0F2744] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#173963] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expense title or notes..."
            className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-teal-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'group_fund', 'personal'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  sourceFilter === src
                    ? 'bg-white text-[#0F2744] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {src === 'all'
                  ? 'All Sources'
                  : src === 'group_fund'
                    ? 'Group Fund'
                    : 'Personal'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expense Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredExpenses.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500">
              No expenses found for the current filters.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Log First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3">Date &amp; Title</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Paid By / Source</th>
                  <th className="px-5 py-3">Participants &amp; Shares</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {exp.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {exp.expenseDate.replace('T', ' ')}
                        {exp.notes ? ` · ${exp.notes}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {exp.category}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">
                        {exp.paymentSource === 'group_fund'
                          ? 'Group Fund'
                          : memberMap.get(exp.paidByMemberId) ?? 'Member'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {exp.paymentSource === 'group_fund'
                          ? `Logged by ${memberMap.get(exp.paidByMemberId) ?? 'Admin'}`
                          : 'Personal Advance'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-medium text-slate-700 capitalize">
                        {exp.splitMethod} split · {exp.participants.length}/
                        {members.length} members
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {exp.participants
                          .slice(0, 3)
                          .map(
                            (p) =>
                              `${(memberMap.get(p.memberId) ?? 'Member').split(' ')[0]} (${p.shareAmount})`,
                          )
                          .join(', ')}
                        {exp.participants.length > 3
                          ? ` +${exp.participants.length - 3} more`
                          : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium">
                      {exp.approvalStatus === 'approved' ? (
                        <span className="text-teal-700">Approved</span>
                      ) : (
                        <span className="text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-num font-semibold text-[#0F2744]">
                      {formatCurrency(exp.totalAmount, currency)}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {exp.approvalStatus === 'pending' && (
                            <button
                              type="button"
                              onClick={() => onApproveExpense(exp.id)}
                              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(exp.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                            aria-label={`Delete ${exp.title}`}
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

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#0F2744]">
                  {isAdmin ? 'Add Trip Expense' : 'Submit Expense Entry'}
                </h2>
                <p className="text-xs text-slate-500">
                  Choose payment source, split method, and participating members.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-5 space-y-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Expense Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Sunset Boat Charter or Highway Breakfast"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Total Amount ({currency})
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="1200"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Person Who Paid
                  </label>
                  <select
                    value={paidByMemberId}
                    onChange={(e) => setPaidByMemberId(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.memberName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Source */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Payment Source
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentSource('group_fund')}
                    className={`rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                      paymentSource === 'group_fund'
                        ? 'border-[#0F2744] bg-slate-50 text-[#0F2744]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-semibold">Group Fund</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Deducts directly from collected pool
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentSource('personal')}
                    className={`rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                      paymentSource === 'personal'
                        ? 'border-teal-600 bg-teal-50/50 text-[#0F2744]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-semibold">Personal Money (Advance)</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Credits payer for reimbursement
                    </p>
                  </button>
                </div>

                {paymentSource === 'personal' && (
                  <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createReimbursement}
                      onChange={(e) => setCreateReimbursement(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600"
                    />
                    <span>
                      Also add a pending reimbursement entry for{' '}
                      {memberMap.get(paidByMemberId) ?? 'payer'}
                    </span>
                  </label>
                )}
              </div>

              {/* Split Method */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Expense-Sharing Method
                  </label>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                    {(['equal', 'custom', 'individual'] as const).map(
                      (method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setSplitMethod(method)}
                          className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                            splitMethod === method
                              ? 'bg-white text-[#0F2744] shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {method}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {splitMethod === 'equal' && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Uncheck non-participating members (they will be charged
                        0)
                      </span>
                      <span className="font-mono-num font-semibold text-[#0F2744]">
                        {selectedMemberIds.length > 0 && parsedTotal > 0
                          ? `${formatCurrency(equalPreviewShares[0]?.shareAmount ?? 0, currency)} / person`
                          : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {members.map((m) => {
                        const checked = selectedMemberIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleParticipant(m.id)}
                                className="h-4 w-4 rounded border-slate-300 text-teal-600"
                              />
                              <span className="font-medium text-slate-800">
                                {m.memberName}
                              </span>
                            </span>
                            <span className="font-mono-num text-slate-500">
                              {checked
                                ? (equalPreviewShares.find(
                                    (s) => s.memberId === m.id,
                                  )?.shareAmount ?? 0)
                                : 0}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {splitMethod === 'custom' && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <div className="mb-2.5 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={distributeEquallyToCustom}
                        className="font-medium text-teal-700 hover:underline cursor-pointer"
                      >
                        Auto-fill equal baseline
                      </button>
                      <span
                        className={`font-mono-num font-semibold ${
                          Math.abs(customAllocatedSum - parsedTotal) <= 0.05
                            ? 'text-teal-700'
                            : 'text-amber-700'
                        }`}
                      >
                        Allocated: {formatCurrency(customAllocatedSum, currency)}{' '}
                        / {formatCurrency(parsedTotal, currency)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5"
                        >
                          <span className="truncate text-xs font-medium text-slate-800">
                            {m.memberName}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={customShares[m.id] ?? ''}
                            onChange={(e) =>
                              setCustomShares((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right font-mono-num text-xs focus:border-teal-600 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {splitMethod === 'individual' && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Assign 100% of expense to single member
                    </label>
                    <select
                      value={individualMemberId}
                      onChange={(e) =>
                        setIndividualMemberId(Number(e.target.value))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.memberName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Receipt reference or activity notes"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#0F2744] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#173963] disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
