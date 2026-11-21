import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Mail, Trash2, UserPlus, X } from 'lucide-react';
import { apiFetch } from '../../api';
import type { TripMember, TripMembership, User } from '../../types';
import { formatDate } from '../../utils/format';
import { RoleLabel, StatusLabel } from '../StatusLabel';

interface JoinRequestRow {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  message: string;
  status: string;
  created_at: string;
}

interface InvitationRow {
  id: number;
  invited_email: string;
  invited_by_name: string;
  status: string;
  created_at: string;
}

interface MembersTabProps {
  tripId: number;
  currentUser: User;
  membership: TripMembership;
  members: TripMember[];
  onRefreshWorkspace: () => void;
}

export function MembersTab({
  tripId,
  currentUser,
  membership,
  members,
  onRefreshWorkspace,
}: MembersTabProps) {
  const canManageMembers =
    membership.role === 'owner' || membership.permissions.can_manage_members;

  const [inviteEmail, setInviteEmail] = useState('');
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadQueues = useCallback(async () => {
    if (!canManageMembers) return;
    try {
      const [jrRes, invRes] = await Promise.all([
        apiFetch<{ requests: JoinRequestRow[] }>(`/api/trips/${tripId}/join-requests`),
        apiFetch<{ invitations: InvitationRow[] }>(`/api/trips/${tripId}/invitations`),
      ]);
      setJoinRequests(jrRes.requests);
      setInvitations(invRes.invitations);
    } catch {
      // Ignore if unauthorized
    }
  }, [tripId, canManageMembers]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/trips/${tripId}/members/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setFeedback(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail('');
      loadQueues();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewJoinRequest(reqId: number, decision: 'approved' | 'rejected') {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/join-requests/${reqId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setFeedback(`Join request ${decision}.`);
      await loadQueues();
      onRefreshWorkspace();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeMember(userId: number) {
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' });
      setConfirmRemoveId(null);
      setFeedback('Member removed from trip.');
      onRefreshWorkspace();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const pendingJoinRequests = joinRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
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

      {/* Invite Form (Owner / Authorized Admin) */}
      {canManageMembers && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Invite Member by Email</h2>
          <p className="text-xs text-slate-500 mb-4">
            Send a trip invitation to a registered email or someone planning to register.
          </p>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        </section>
      )}

      {/* Pending Join Requests Queue */}
      {canManageMembers && pendingJoinRequests.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Pending Join Requests</h2>
            <span className="text-xs font-mono tabular-nums text-amber-700">
              {pendingJoinRequests.length} waiting
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingJoinRequests.map((jr) => (
              <div
                key={jr.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {jr.user_name}{' '}
                    <span className="font-normal text-xs text-slate-500">({jr.user_email})</span>
                  </p>
                  {jr.message && <p className="text-sm text-slate-600 mt-1">{jr.message}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    Requested {formatDate(jr.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => reviewJoinRequest(jr.id, 'approved')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-lg"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewJoinRequest(jr.id, 'rejected')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Members Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Active Trip Members</h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {members.length} members
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Member</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined</th>
                {canManageMembers && <th className="py-3 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {members.map((m) => (
                <tr key={m.user_id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {m.name}
                          {m.user_id === currentUser.id && (
                            <span className="ml-1.5 text-xs text-teal-700 font-normal">(You)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    <div>{m.email}</div>
                    {m.phone && <div className="text-slate-400">{m.phone}</div>}
                  </td>
                  <td className="py-3.5 px-4">
                    <RoleLabel role={m.role} />
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-500">
                    {formatDate(m.joined_at)}
                  </td>
                  {canManageMembers && (
                    <td className="py-3.5 px-6 text-right">
                      {m.role !== 'owner' &&
                        m.user_id !== currentUser.id &&
                        (m.role !== 'admin' || membership.role === 'owner') && (
                          <>
                            {confirmRemoveId === m.user_id ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => removeMember(m.user_id)}
                                  className="px-2.5 py-1 text-xs font-medium bg-red-600 text-white rounded-md"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveId(null)}
                                  className="text-xs text-slate-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveId(m.user_id)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            )}
                          </>
                        )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invitations History */}
      {canManageMembers && invitations.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Sent Invitations</h2>
          <div className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{inv.invited_email}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Invited by {inv.invited_by_name}
                  </span>
                </div>
                <StatusLabel status={inv.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
