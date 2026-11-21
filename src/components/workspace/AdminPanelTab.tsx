import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Shield, Sliders, ArrowLeftRight, History } from 'lucide-react';
import { apiFetch } from '../../api';
import type {
  ActivityLogItem,
  TripDetail,
  TripFinanceSummary,
  TripMember,
  TripMembership,
  User,
} from '../../types';
import { formatMoney, formatTimestamp } from '../../utils/format';
import { RoleLabel } from '../StatusLabel';

const PERMISSION_FIELDS = [
  { key: 'can_manage_members', label: 'Manage Members & Join Requests' },
  { key: 'can_approve_expenses', label: 'Approve / Reject Expenses' },
  { key: 'can_manage_contributions', label: 'Verify Contributions & Reimbursements' },
  { key: 'can_edit_expenses', label: 'Create Expense Corrections & Categories' },
  { key: 'can_manage_notes', label: 'Pin, Archive & Delete Notes' },
  { key: 'can_publish_announcements', label: 'Publish Announcements' },
  { key: 'can_view_reports', label: 'View Financial Reports' },
  { key: 'can_manage_schedule', label: 'Manage Trip Schedule' },
] as const;

interface AdminPanelTabProps {
  trip: TripDetail;
  currentUser: User;
  membership: TripMembership;
  summary: TripFinanceSummary;
  members: TripMember[];
  pendingOwnershipTransfer: {
    id: number;
    to_user_name: string;
    previous_owner_new_role: string;
  } | null;
  onRefreshWorkspace: () => void;
}

export function AdminPanelTab({
  trip,
  currentUser,
  membership,
  summary,
  members,
  pendingOwnershipTransfer,
  onRefreshWorkspace,
}: AdminPanelTabProps) {
  const isOwner = membership.role === 'owner';

  const [section, setSection] = useState<'permissions' | 'logs' | 'settings' | 'transfer'>(
    isOwner ? 'permissions' : 'logs'
  );
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [logSearch, setLogSearch] = useState('');

  // Settings form
  const [tripName, setTripName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate, setStartDate] = useState(trip.start_date);
  const [endDate, setEndDate] = useState(trip.end_date);
  const [description, setDescription] = useState(trip.description);
  const [visibility, setVisibility] = useState<'public' | 'private'>(trip.visibility);
  const [showMemberCount, setShowMemberCount] = useState(Boolean(trip.show_member_count));
  const [status, setStatus] = useState(trip.status);
  const [estimatedBudget, setEstimatedBudget] = useState(
    String(trip.estimated_budget_minor / 100)
  );
  const [expectedPerMember, setExpectedPerMember] = useState(
    String(trip.expected_per_member_minor / 100)
  );

  // Ownership transfer form
  const eligibleTargets = members.filter((m) => m.user_id !== currentUser.id);
  const [transferTargetId, setTransferTargetId] = useState<number>(
    eligibleTargets[0]?.user_id ?? 0
  );
  const [prevOwnerNewRole, setPrevOwnerNewRole] = useState<'admin' | 'member'>('admin');

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    const res = await apiFetch<{ logs: ActivityLogItem[] }>(`/api/trips/${trip.id}/activity-logs`);
    setLogs(res.logs);
  }, [trip.id]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  async function changeRole(userId: number, role: 'admin' | 'member') {
    setError(null);
    try {
      await apiFetch(`/api/trips/${trip.id}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setFeedback(`Updated member role to ${role}.`);
      onRefreshWorkspace();
      loadLogs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function togglePermission(member: TripMember, key: string, nextValue: boolean) {
    setError(null);
    const payload: Record<string, boolean> = {};
    for (const f of PERMISSION_FIELDS) {
      payload[f.key] = Boolean((member as unknown as Record<string, number>)[f.key]);
    }
    payload[key] = nextValue;

    try {
      await apiFetch(`/api/trips/${trip.id}/members/${member.user_id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onRefreshWorkspace();
      loadLogs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/trips/${trip.id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: tripName,
          destination,
          start_date: startDate,
          end_date: endDate,
          description,
          visibility,
          show_member_count: showMemberCount,
          status,
          estimated_budget: Number(estimatedBudget) || 0,
          expected_per_member: Number(expectedPerMember) || 0,
        }),
      });
      setFeedback('Trip settings saved.');
      onRefreshWorkspace();
      loadLogs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function initiateTransfer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/trips/${trip.id}/ownership-transfer`, {
        method: 'POST',
        body: JSON.stringify({
          to_user_id: transferTargetId,
          previous_owner_new_role: prevOwnerNewRole,
        }),
      });
      setFeedback('Ownership transfer request sent. Waiting for recipient acceptance.');
      onRefreshWorkspace();
      loadLogs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const filteredLogs = logs.filter((l) => {
    if (!logSearch.trim()) return true;
    const q = logSearch.toLowerCase();
    return (
      l.summary.toLowerCase().includes(q) ||
      l.actor_name.toLowerCase().includes(q) ||
      l.action_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Admin KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="block text-xs text-slate-500">Group Fund Balance</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-teal-700">
            {formatMoney(summary.availableGroupFundMinor)}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="block text-xs text-slate-500">Pending Expenses</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-amber-700">
            {summary.pendingExpenseRequestsCount}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="block text-xs text-slate-500">Pending Join Requests</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-slate-900">
            {summary.pendingJoinRequestsCount}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="block text-xs text-slate-500">Reimbursements Owed</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(summary.remainingPersonalLiabilityMinor)}
          </span>
        </div>
      </div>

      {/* Section Switcher */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start w-fit">
        {isOwner && (
          <button
            type="button"
            onClick={() => setSection('permissions')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
              section === 'permissions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Roles & Permissions
          </button>
        )}
        <button
          type="button"
          onClick={() => setSection('logs')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
            section === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Immutable Activity Logs
        </button>
        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setSection('settings')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                section === 'settings' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Trip Settings
            </button>
            <button
              type="button"
              onClick={() => setSection('transfer')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                section === 'transfer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Ownership Transfer
            </button>
          </>
        )}
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

      {/* Roles & Granular Admin Permissions */}
      {section === 'permissions' && isOwner && (
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Assign Admin Roles & Granular Permissions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All permission checks are enforced server-side. Admins cannot grant themselves
                higher privileges or transfer ownership.
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              {members.map((m) => (
                <div key={m.user_id} className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-slate-900">{m.name}</span>
                      <RoleLabel role={m.role} />
                    </div>
                    {m.role !== 'owner' && (
                      <div className="flex items-center gap-2">
                        {m.role === 'member' ? (
                          <button
                            type="button"
                            onClick={() => changeRole(m.user_id, 'admin')}
                            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg"
                          >
                            Promote to Admin
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => changeRole(m.user_id, 'member')}
                            className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
                          >
                            Demote to Member
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {m.role === 'admin' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                      {PERMISSION_FIELDS.map((pf) => {
                        const checked = Boolean(
                          (m as unknown as Record<string, number>)[pf.key]
                        );
                        return (
                          <label
                            key={pf.key}
                            className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => togglePermission(m, pf.key, e.target.checked)}
                              className="accent-teal-700 shrink-0"
                            />
                            <span>{pf.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Immutable Activity Logs */}
      {section === 'logs' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Financial & Administrative Audit Trail
              </h2>
              <p className="text-xs text-slate-500">
                Append-only history; cannot be edited or deleted through Admin controls.
              </p>
            </div>
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filter logs by user or action..."
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-56"
            />
          </div>

          <div className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No matching activity logs found.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm text-slate-900">{log.summary}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {log.actor_name} ·{' '}
                      <span className="font-mono">{log.action_type}</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                    {formatTimestamp(log.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Trip Settings (Owner Only) */}
      {section === 'settings' && isOwner && (
        <form
          onSubmit={saveSettings}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <h2 className="text-base font-semibold text-slate-900">Trip Configuration</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trip Name</label>
              <input
                type="text"
                required
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trip Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TripDetail['status'])}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="planning">Planning</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed (Lock Financials)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estimated Total Budget (৳)
              </label>
              <input
                type="number"
                min="0"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expected Per Member (৳)
              </label>
              <input
                type="number"
                min="0"
                value={expectedPerMember}
                onChange={(e) => setExpectedPerMember(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showMemberCount}
              onChange={(e) => setShowMemberCount(e.target.checked)}
              className="accent-teal-700"
            />
            <span>Display participant count on public trip discovery</span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
            >
              Save Trip Settings
            </button>
          </div>
        </form>
      )}

      {/* Ownership Transfer (Owner Only) */}
      {section === 'transfer' && isOwner && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Transfer Trip Ownership</h2>
            <p className="text-xs text-slate-500 mt-1">
              Each trip always has exactly one active Owner. Ownership transfers only after the
              selected member accepts the request from their dashboard.
            </p>
          </div>

          {pendingOwnershipTransfer && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              Pending transfer to <strong>{pendingOwnershipTransfer.to_user_name}</strong>{' '}
              (you will transition to {pendingOwnershipTransfer.previous_owner_new_role}).
            </div>
          )}

          {eligibleTargets.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add at least one more active member before transferring ownership.
            </p>
          ) : (
            <form onSubmit={initiateTransfer} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select New Owner
                </label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  {eligibleTargets.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Role After Transfer
                </label>
                <select
                  value={prevOwnerNewRole}
                  onChange={(e) => setPrevOwnerNewRole(e.target.value as 'admin' | 'member')}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="admin">Remain as Admin (Full Permissions)</option>
                  <option value="member">Become Regular Member</option>
                </select>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
              >
                Send Ownership Transfer Request
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
