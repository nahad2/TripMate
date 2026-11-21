import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  Plus,
  Receipt,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../../api';
import type {
  ExpenseRecord,
  ReimbursementRecord,
  TripMember,
  TripMembership,
  User,
} from '../../types';
import { formatDate, formatMoney } from '../../utils/format';
import { StatusLabel } from '../StatusLabel';

interface MemberReimbursementSummary {
  member_id: number;
  member_name: string;
  personal_paid_minor: number;
  reimbursed_minor: number;
  pending_reimbursement_minor: number;
}

interface ExpensesTabProps {
  tripId: number;
  tripStatus: string;
  currentUser: User;
  membership: TripMembership;
  members: TripMember[];
  initialShowModal?: boolean;
  onModalHandled?: () => void;
  onFinancialChanged: () => void;
}

export function ExpensesTab({
  tripId,
  tripStatus,
  currentUser,
  membership,
  members,
  initialShowModal = false,
  onModalHandled,
  onFinancialChanged,
}: ExpensesTabProps) {
  const canApprove =
    membership.role === 'owner' || membership.permissions.can_approve_expenses;
  const canEditApproved =
    membership.role === 'owner' || membership.permissions.can_edit_expenses;
  const canManageReimb =
    membership.role === 'owner' || membership.permissions.can_manage_contributions;
  const isLocked = tripStatus === 'completed' || tripStatus === 'archived';

  const [subView, setSubView] = useState<'expenses' | 'reimbursements'>('expenses');
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementRecord[]>([]);
  const [reimbSummary, setReimbSummary] = useState<MemberReimbursementSummary[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add Expense Modal state
  const [showAddExpense, setShowAddExpense] = useState(initialShowModal);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Transportation');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidById, setPaidById] = useState<number>(currentUser.id);
  const [paymentSource, setPaymentSource] = useState<'group_fund' | 'personal'>('group_fund');
  const [splitType, setSplitType] = useState<'equal' | 'custom' | 'individual' | 'participation'>(
    'equal'
  );
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>(() =>
    members.map((m) => m.user_id)
  );
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
  const [receiptNote, setReceiptNote] = useState('');
  const [notes, setNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Reject / Needs Correction modal
  const [reviewTarget, setReviewTarget] = useState<{
    id: number;
    title: string;
    action: 'rejected' | 'needs_correction';
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approved Expense Audited Correction modal
  const [correctTarget, setCorrectTarget] = useState<ExpenseRecord | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Custom Category input
  const [newCategoryName, setNewCategoryName] = useState('');

  // Reimbursement modal
  const [showAddReimb, setShowAddReimb] = useState(false);
  const [reimbMemberId, setReimbMemberId] = useState<number>(members[0]?.user_id ?? currentUser.id);
  const [reimbAmount, setReimbAmount] = useState('');
  const [reimbMethod, setReimbMethod] = useState('bKash');
  const [reimbDate, setReimbDate] = useState(new Date().toISOString().slice(0, 10));
  const [reimbNote, setReimbNote] = useState('');
  const [reimbStatus, setReimbStatus] = useState<'completed' | 'pending'>('completed');

  useEffect(() => {
    if (initialShowModal) {
      setShowAddExpense(true);
      onModalHandled?.();
    }
  }, [initialShowModal, onModalHandled]);

  useEffect(() => {
    setSelectedParticipants(members.map((m) => m.user_id));
  }, [members]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes, reimbRes] = await Promise.all([
        apiFetch<{ expenses: ExpenseRecord[] }>(`/api/trips/${tripId}/expenses`),
        apiFetch<{ categories: string[] }>(`/api/trips/${tripId}/categories`),
        apiFetch<{
          reimbursements: ReimbursementRecord[];
          memberBreakdown: MemberReimbursementSummary[];
        }>(`/api/trips/${tripId}/reimbursements`),
      ]);
      setExpenses(expRes.expenses);
      setCategories(catRes.categories);
      setReimbursements(reimbRes.reimbursements);
      setReimbSummary(reimbRes.memberBreakdown);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function toggleParticipant(uid: number) {
    if (splitType === 'individual') {
      setSelectedParticipants([uid]);
      return;
    }
    setSelectedParticipants((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  async function handleSubmitExpense(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title,
        description,
        amount: Number(amount),
        category,
        expense_date: expenseDate,
        paid_by_member_id: paidById,
        payment_source: paymentSource,
        split_type: splitType,
        participant_ids: selectedParticipants,
        custom_shares:
          splitType === 'custom'
            ? selectedParticipants.map((uid) => ({
                memberId: uid,
                amount: Number(customAmounts[uid] || 0),
              }))
            : undefined,
        receipt_note: receiptNote,
        notes,
        auto_approve: canApprove ? autoApprove : false,
      };
      await apiFetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowAddExpense(false);
      setTitle('');
      setDescription('');
      setAmount('');
      setReceiptNote('');
      setNotes('');
      setCustomAmounts({});
      setFeedback('Expense recorded successfully.');
      await loadAll();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewExpense(
    expenseId: number,
    status: 'approved' | 'rejected' | 'needs_correction' | 'cancelled',
    reason?: string
  ) {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/expenses/${expenseId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejection_reason: reason }),
      });
      setReviewTarget(null);
      setRejectReason('');
      setFeedback(`Expense marked ${status.replace('_', ' ')}.`);
      await loadAll();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCorrection(e: FormEvent) {
    e.preventDefault();
    if (!correctTarget) return;
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/expenses/${correctTarget.id}/correct`, {
        method: 'POST',
        body: JSON.stringify({
          new_amount: Number(correctedAmount),
          reason: correctionReason,
        }),
      });
      setCorrectTarget(null);
      setCorrectedAmount('');
      setCorrectionReason('');
      setFeedback('Audited correction adjustment entry created. Original record preserved.');
      await loadAll();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiFetch(`/api/trips/${tripId}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName }),
      });
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddReimbursement(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/reimbursements`, {
        method: 'POST',
        body: JSON.stringify({
          member_id: reimbMemberId,
          amount: Number(reimbAmount),
          payment_date: reimbDate,
          payment_method: reimbMethod,
          note: reimbNote,
          status: reimbStatus,
        }),
      });
      setShowAddReimb(false);
      setReimbAmount('');
      setReimbNote('');
      setFeedback('Reimbursement transaction recorded.');
      await loadAll();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function completeReimbursement(reimbId: number) {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/reimbursements/${reimbId}/complete`, {
        method: 'PATCH',
      });
      await loadAll();
      onFinancialChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const filteredExpenses = expenses.filter((exp) => {
    if (statusFilter !== 'all' && exp.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !exp.title.toLowerCase().includes(q) &&
        !exp.paid_by_name.toLowerCase().includes(q) &&
        !exp.category.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const customTotalEntered = selectedParticipants.reduce(
    (acc, uid) => acc + (Number(customAmounts[uid]) || 0),
    0
  );
  const enteredExpenseAmount = Number(amount) || 0;

  return (
    <div className="space-y-6">
      {/* Header & Sub-View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubView('expenses')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              subView === 'expenses' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Expense Ledger
          </button>
          <button
            type="button"
            onClick={() => setSubView('reimbursements')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              subView === 'reimbursements'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Reimbursements
          </button>
        </div>

        {!isLocked && subView === 'expenses' && (
          <button
            type="button"
            onClick={() => setShowAddExpense(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Submit Expense
          </button>
        )}

        {!isLocked && subView === 'reimbursements' && canManageReimb && (
          <button
            type="button"
            onClick={() => setShowAddReimb(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Record Reimbursement
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-sm text-emerald-900">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {subView === 'expenses' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, payer, category..."
                className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {['all', 'pending', 'approved', 'rejected', 'needs_correction'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize whitespace-nowrap ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading expenses...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No expenses match your filter.
              </div>
            ) : (
              filteredExpenses.map((exp) => (
                <div key={exp.id} className="p-5 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                        <StatusLabel status={exp.status} />
                        <span aria-hidden="true">·</span>
                        <span>{exp.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDate(exp.expense_date)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {exp.payment_source === 'personal'
                            ? `Personal Money (${exp.paid_by_name})`
                            : `Central Group Fund (recorded by ${exp.paid_by_name})`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{exp.split_type} split</span>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900">{exp.title}</h3>
                      {exp.description && (
                        <p className="text-sm text-slate-600">{exp.description}</p>
                      )}
                      {exp.receipt_note && (
                        <p className="text-xs text-slate-500 font-mono">
                          Ref: {exp.receipt_note}
                        </p>
                      )}
                      {exp.rejection_reason && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 inline-block">
                          Reason: {exp.rejection_reason}
                        </p>
                      )}
                    </div>

                    <div className="text-left md:text-right shrink-0">
                      <span
                        className={`text-lg font-bold font-mono tabular-nums ${
                          exp.amount_minor < 0 ? 'text-teal-700' : 'text-slate-900'
                        }`}
                      >
                        {formatMoney(exp.amount_minor, exp.amount_minor < 0)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Submitted by {exp.submitted_by_name}
                      </span>
                    </div>
                  </div>

                  {/* Participant Shares Breakdown */}
                  {exp.participants.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-500">Shares:</span>
                      {exp.participants.map((p) => (
                        <span key={p.member_id} className="font-mono tabular-nums">
                          {p.member_name}: {formatMoney(p.share_minor)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Workflow Actions */}
                  {!isLocked && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {exp.status === 'pending' && canApprove && (
                        <>
                          <button
                            type="button"
                            onClick={() => reviewExpense(exp.id, 'approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReviewTarget({
                                id: exp.id,
                                title: exp.title,
                                action: 'needs_correction',
                              })
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-medium rounded-md"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Needs Correction
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReviewTarget({
                                id: exp.id,
                                title: exp.title,
                                action: 'rejected',
                              })
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium rounded-md"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}

                      {exp.status === 'pending' && exp.submitted_by === currentUser.id && (
                        <button
                          type="button"
                          onClick={() => reviewExpense(exp.id, 'cancelled')}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Cancel Request
                        </button>
                      )}

                      {exp.status === 'approved' && !exp.parent_expense_id && canEditApproved && (
                        <button
                          type="button"
                          onClick={() => {
                            setCorrectTarget(exp);
                            setCorrectedAmount(String(exp.amount_minor / 100));
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Create Correction Adjustment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Reimbursements View */
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Personal Payment & Reimbursement Status
              </h2>
              <p className="text-xs text-slate-500">
                Tracks out-of-pocket group expenses paid personally by members and repayments from
                the Central Group Fund.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Member</th>
                    <th className="py-3 px-4 text-right">Personal Paid</th>
                    <th className="py-3 px-4 text-right">Reimbursed</th>
                    <th className="py-3 px-4 text-right">Pending Reimb.</th>
                    <th className="py-3 px-6 text-right">Owed to Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reimbSummary.map((row) => {
                    const owed = Math.max(0, row.personal_paid_minor - row.reimbursed_minor);
                    return (
                      <tr key={row.member_id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-6 font-medium text-slate-900">
                          {row.member_name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                          {formatMoney(row.personal_paid_minor)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                          {formatMoney(row.reimbursed_minor)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-700">
                          {row.pending_reimbursement_minor > 0
                            ? formatMoney(row.pending_reimbursement_minor)
                            : '—'}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatMoney(owed)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Reimbursement Transactions</h2>
            </div>
            {reimbursements.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No reimbursement transactions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reimbursements.map((r) => (
                  <div
                    key={r.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Paid to {r.member_name} ·{' '}
                        <span className="font-mono tabular-nums">
                          {formatMoney(r.amount_minor)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(r.payment_date)} · {r.payment_method}
                        {r.note ? ` · ${r.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusLabel status={r.status} />
                      {r.status === 'pending' && canManageReimb && !isLocked && (
                        <button
                          type="button"
                          onClick={() => completeReimbursement(r.id)}
                          className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Submit Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Submit Expense Request</h2>
              <button
                type="button"
                onClick={() => setShowAddExpense(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expense Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Lunch at Restaurant"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
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
                    placeholder="1200"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Person Who Paid
                  </label>
                  <select
                    value={paidById}
                    onChange={(e) => setPaidById(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Custom Category inline for Admins */}
              {canEditApproved && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Add custom category..."
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg"
                  >
                    Add Category
                  </button>
                </div>
              )}

              {/* Payment Source */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Payment Source
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentSource('group_fund')}
                    className={`p-3 text-left border rounded-lg ${
                      paymentSource === 'group_fund'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-900">
                      Central Group Fund
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Deducted directly from collected pool cash
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentSource('personal')}
                    className={`p-3 text-left border rounded-lg ${
                      paymentSource === 'personal'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-900">
                      Personal Money
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Paid out-of-pocket; tracked for reimbursement
                    </span>
                  </button>
                </div>
              </div>

              {/* 4-Way Expense Splitting */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Splitting Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'equal', label: 'Equal Split' },
                    { id: 'participation', label: 'Participation' },
                    { id: 'custom', label: 'Custom Amounts' },
                    { id: 'individual', label: 'Individual' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        const next = mode.id as
                          | 'equal'
                          | 'custom'
                          | 'individual'
                          | 'participation';
                        setSplitType(next);
                        if (next === 'individual' && selectedParticipants.length > 1) {
                          setSelectedParticipants([selectedParticipants[0]]);
                        }
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        splitType === mode.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participating Members */}
              <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Participating Members ({selectedParticipants.length})
                  </span>
                  {splitType === 'custom' && (
                    <span
                      className={`font-mono tabular-nums ${
                        Math.round(customTotalEntered * 100) ===
                        Math.round(enteredExpenseAmount * 100)
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      Assigned: ৳{customTotalEntered.toFixed(2)} / ৳
                      {enteredExpenseAmount.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {members.map((m) => {
                    const checked = selectedParticipants.includes(m.user_id);
                    return (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-slate-50 border border-slate-200"
                      >
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer flex-1">
                          <input
                            type={splitType === 'individual' ? 'radio' : 'checkbox'}
                            checked={checked}
                            onChange={() => toggleParticipant(m.user_id)}
                            className="accent-teal-700"
                          />
                          <span>{m.name}</span>
                        </label>
                        {splitType === 'custom' && checked && (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={customAmounts[m.user_id] ?? ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [m.user_id]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="w-24 px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white text-right"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Receipt Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
                    placeholder="e.g. Receipt #418"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description / Note
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Context for participants"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {canApprove ? (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="w-4 h-4 accent-teal-700"
                  />
                  <span>Approve immediately (authorized Admin/Owner)</span>
                </label>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  Member-submitted expenses enter the Pending Approval queue before affecting group
                  totals.
                </p>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject / Needs Correction Reason Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {reviewTarget.action === 'rejected' ? 'Reject Expense' : 'Request Correction'}:{' '}
              {reviewTarget.title}
            </h3>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a clear reason for the submitting member..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReviewTarget(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => reviewExpense(reviewTarget.id, reviewTarget.action, rejectReason)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg disabled:opacity-50"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audited Correction Modal */}
      {correctTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCorrection}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl"
          >
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Audited Expense Correction
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Preserves "{correctTarget.title}" ({formatMoney(correctTarget.amount_minor)}) and
                records a separate adjustment entry in the ledger.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Corrected Final Amount (৳)
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={correctedAmount}
                onChange={(e) => setCorrectedAmount(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason for Correction
              </label>
              <textarea
                rows={2}
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Vendor refunded ৳300 discount on checkout"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCorrectTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
              >
                Post Adjustment Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Reimbursement Modal */}
      {showAddReimb && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddReimbursement}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Record Reimbursement</h3>
              <button
                type="button"
                onClick={() => setShowAddReimb(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recipient</label>
              <select
                value={reimbMemberId}
                onChange={(e) => setReimbMemberId(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (৳)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={reimbAmount}
                  onChange={(e) => setReimbAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={reimbDate}
                  onChange={(e) => setReimbDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={reimbMethod}
                  onChange={(e) => setReimbMethod(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="bKash">bKash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={reimbStatus}
                  onChange={(e) => setReimbStatus(e.target.value as 'completed' | 'pending')}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={reimbNote}
                onChange={(e) => setReimbNote(e.target.value)}
                placeholder="e.g. Settling Konglak lunch advance"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddReimb(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
              >
                Save Reimbursement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
