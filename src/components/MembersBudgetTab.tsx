import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { formatCurrency } from '../lib/calculations.ts';
import type {
  MemberRole,
  TripDetailPayload,
  TripFinancialOverview,
} from '../lib/tripmate-types.ts';

interface MembersBudgetTabProps {
  detail: TripDetailPayload;
  overview: TripFinancialOverview;
  onAddMember: (payload: {
    memberName: string;
    memberEmail: string;
    assignedBudget: number;
    role: MemberRole;
  }) => Promise<void>;
  onUpdateMember: (
    memberId: number,
    payload: { assignedBudget?: number; role?: MemberRole },
  ) => Promise<void>;
  onRemoveMember: (memberId: number) => Promise<void>;
}

export function MembersBudgetTab({
  detail,
  overview,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
}: MembersBudgetTabProps) {
  const { trip, myRole } = detail;
  const isAdmin = myRole === 'admin';
  const currency = trip.currency;

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [assignedBudget, setAssignedBudget] = useState(
    String(trip.defaultMemberBudget || 2500),
  );
  const [role, setRole] = useState<MemberRole>('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!memberName.trim() || !memberEmail.includes('@')) {
      setError('Enter a valid member name and email address.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddMember({
        memberName: memberName.trim(),
        memberEmail: memberEmail.trim(),
        assignedBudget: Number(assignedBudget || 0),
        role,
      });
      setMemberName('');
      setMemberEmail('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveBudget(memberId: number) {
    const val = Number(budgetDraft);
    if (!Number.isFinite(val) || val < 0) return;
    await onUpdateMember(memberId, { assignedBudget: val });
    setEditingBudgetId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2744]">
            Members &amp; Individual Budgets
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Assign individual trip budgets and manage Trip Administrator or
            Group Member roles.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-right">
          <p className="text-xs text-slate-500">Total Expected Budget</p>
          <p className="font-mono-num text-xl font-bold text-[#0F2744]">
            {formatCurrency(overview.totalExpectedBudget, currency)}
          </p>
        </div>
      </div>

      {isAdmin && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            Add Group Member
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            If the member later signs in with the same email, their account
            links automatically to this trip.
          </p>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                required
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g., Sajib Ahmed"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                required
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="sajib@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Individual Budget ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={assignedBudget}
                onChange={(e) => setAssignedBudget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="member">Group Member</option>
                <option value="admin">Trip Administrator</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F2744] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#173963] disabled:opacity-60 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>{submitting ? 'Adding...' : 'Add Member'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-right">Assigned Budget</th>
                <th className="px-5 py-3 text-right">Initial Paid</th>
                <th className="px-5 py-3 text-right">Additional Paid</th>
                <th className="px-5 py-3 text-right">Unpaid Budget</th>
                {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overview.memberSummaries.map((ms) => {
                const m = ms.member;
                const isEditing = editingBudgetId === m.id;
                return (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {m.memberName}
                      </p>
                      <p className="text-xs text-slate-500">{m.memberEmail}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {isAdmin ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            onUpdateMember(m.id, {
                              role: e.target.value as MemberRole,
                            })
                          }
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          <option value="member">Group Member</option>
                          <option value="admin">Trip Administrator</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-slate-700">
                          {m.role === 'admin'
                            ? 'Trip Administrator'
                            : 'Group Member'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-num">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={budgetDraft}
                            onChange={(e) => setBudgetDraft(e.target.value)}
                            className="w-24 rounded border border-teal-600 px-2 py-1 text-right text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveBudget(m.id)}
                            className="rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => {
                            setEditingBudgetId(m.id);
                            setBudgetDraft(String(ms.assignedBudget));
                          }}
                          className={`font-semibold text-[#0F2744] ${
                            isAdmin
                              ? 'hover:text-teal-700 hover:underline cursor-pointer'
                              : ''
                          }`}
                        >
                          {formatCurrency(ms.assignedBudget, currency)}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-num text-slate-700">
                      {formatCurrency(ms.initialContributed, currency)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-num text-teal-700">
                      {formatCurrency(ms.additionalContributed, currency)}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right font-mono-num font-medium ${
                        ms.unpaidBudget > 0 ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {ms.unpaidBudget > 0
                        ? formatCurrency(ms.unpaidBudget, currency)
                        : 'Paid'}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveMember(m.id)}
                          className="inline-flex items-center rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          aria-label={`Remove ${m.memberName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
