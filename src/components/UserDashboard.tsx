import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Compass,
  LogOut,
  Plus,
  Settings,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { DashboardTrip, User } from '../types';
import { formatDateRange, formatMoney, formatTimestamp } from '../utils/format';
import { RoleLabel, StatusLabel } from './StatusLabel';
import { TripCoverImage } from './TripCoverImage';
import { CreateTripModal } from './CreateTripModal';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { NotificationsModal } from './NotificationsModal';

interface DashboardData {
  stats: {
    totalJoinedTrips: number;
    activeTrips: number;
    pendingRequestsAndInvites: number;
    personalReceivableMinor: number;
    unreadNotifications: number;
  };
  myTrips: DashboardTrip[];
  pendingInvitations: Array<{
    id: number;
    trip_id: number;
    trip_name: string;
    destination: string;
    start_date: string;
    end_date: string;
    invited_by_name: string;
  }>;
  pendingJoinRequestsSent: Array<{
    id: number;
    trip_id: number;
    trip_name: string;
    destination: string;
    status: string;
  }>;
  pendingOwnershipTransfers: Array<{
    id: number;
    trip_id: number;
    trip_name: string;
    from_user_name: string;
    previous_owner_new_role: string;
  }>;
  recentActivities: Array<{
    id: number;
    trip_id: number;
    trip_name: string;
    action_type: string;
    summary: string;
    created_at: string;
    actor_name: string;
  }>;
}

interface UserDashboardProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onExplorePublic: () => void;
  onOpenTrip: (tripId: number) => void;
}

export function UserDashboard({
  user,
  onUserUpdated,
  onLogout,
  onExplorePublic,
  onOpenTrip,
}: UserDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<DashboardData>('/api/dashboard');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function respondInvitation(inviteId: number, action: 'accept' | 'decline') {
    await apiFetch(`/api/invitations/${inviteId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    setFeedback(action === 'accept' ? 'Invitation accepted. Trip added to your workspace.' : 'Invitation declined.');
    loadDashboard();
  }

  async function respondOwnershipTransfer(tripId: number, transferId: number, action: 'accept' | 'reject') {
    await apiFetch(`/api/trips/${tripId}/ownership-transfer/${transferId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    setFeedback(
      action === 'accept'
        ? 'Ownership transferred. You are now the active Trip Owner.'
        : 'Ownership transfer declined.'
    );
    loadDashboard();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onExplorePublic}
              className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              TripMate
            </button>
            <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-slate-600">
              <span className="text-slate-900 whitespace-nowrap shrink-0">Dashboard</span>
              <button
                type="button"
                onClick={onExplorePublic}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Explore Public Trips
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              aria-label="Notifications"
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              {data && data.stats.unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 bg-teal-700 text-white text-[10px] font-mono rounded-full">
                  {data.stats.unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowProfile(true)}
              aria-label="Profile Settings"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {feedback && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-sm text-emerald-900">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Welcome Section & Quick Actions */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-display font-bold text-lg overflow-hidden shrink-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                user.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Welcome back, {user.name}
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {user.email}
                {user.phone ? ` · ${user.phone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExplorePublic}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Compass className="w-4 h-4 text-teal-700" />
              Explore Public Trips
            </button>
            <button
              type="button"
              onClick={() => setShowCreateTrip(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Create New Trip
            </button>
          </div>
        </section>

        {/* Quick Statistics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <span className="block text-xs font-medium text-slate-500">Total Joined Trips</span>
            <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
              {loading ? '—' : data?.stats.totalJoinedTrips ?? 0}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <span className="block text-xs font-medium text-slate-500">Active & Upcoming</span>
            <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-teal-700">
              {loading ? '—' : data?.stats.activeTrips ?? 0}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <span className="block text-xs font-medium text-slate-500">
              Invites & Join Requests
            </span>
            <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-slate-900">
              {loading ? '—' : data?.stats.pendingRequestsAndInvites ?? 0}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <span className="block text-xs font-medium text-slate-500">
              Pending Receivables
            </span>
            <span className="mt-2 block text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {loading ? '—' : formatMoney(data?.stats.personalReceivableMinor ?? 0)}
            </span>
          </div>
        </section>

        {/* Actionable Invitations & Ownership Transfers */}
        {data &&
          (data.pendingInvitations.length > 0 ||
            data.pendingOwnershipTransfers.length > 0 ||
            data.pendingJoinRequestsSent.length > 0) && (
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                Pending Invitations & Requests
              </h2>
              <div className="divide-y divide-slate-100">
                {data.pendingOwnershipTransfers.map((ot) => (
                  <div
                    key={`ot-${ot.id}`}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Ownership Transfer: {ot.trip_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {ot.from_user_name} wants to transfer Trip Ownership to you (previous owner
                        becomes {ot.previous_owner_new_role}).
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => respondOwnershipTransfer(ot.trip_id, ot.id, 'accept')}
                        className="px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                      >
                        Accept Ownership
                      </button>
                      <button
                        type="button"
                        onClick={() => respondOwnershipTransfer(ot.trip_id, ot.id, 'reject')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}

                {data.pendingInvitations.map((inv) => (
                  <div
                    key={`inv-${inv.id}`}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{inv.trip_name}</p>
                      <p className="text-xs text-slate-600">
                        {inv.destination} · {formatDateRange(inv.start_date, inv.end_date)} · Invited
                        by {inv.invited_by_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => respondInvitation(inv.id, 'accept')}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
                      >
                        Accept Invite
                      </button>
                      <button
                        type="button"
                        onClick={() => respondInvitation(inv.id, 'decline')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}

                {data.pendingJoinRequestsSent.map((jr) => (
                  <div
                    key={`jr-${jr.id}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{jr.trip_name}</p>
                      <p className="text-xs text-slate-500">
                        {jr.destination} · Join request sent
                      </p>
                    </div>
                    <StatusLabel status={jr.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* My Trips & Recent Activity Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">My Trips</h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {data?.myTrips.length ?? 0} workspaces
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="bg-white border border-slate-200 rounded-xl h-64 animate-pulse"
                  />
                ))}
              </div>
            ) : !data || data.myTrips.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <p className="text-sm font-medium text-slate-900">
                  You have not joined or created any trips yet.
                </p>
                <p className="text-sm text-slate-600">
                  Create a new trip workspace or explore public trips to send a join request.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateTrip(true)}
                    className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
                  >
                    Create New Trip
                  </button>
                  <button
                    type="button"
                    onClick={onExplorePublic}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg"
                  >
                    Explore Public Trips
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {data.myTrips.map((trip) => (
                  <article
                    key={trip.id}
                    onClick={() => onOpenTrip(trip.id)}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors cursor-pointer flex flex-col"
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                      <TripCoverImage
                        src={trip.cover_image}
                        alt={trip.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                        {trip.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>{trip.destination}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{trip.member_count} members</span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <StatusLabel status={trip.status} />
                        <RoleLabel role={trip.role} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-4 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activities</h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {!data || data.recentActivities.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Recent trip actions will appear here.
                </div>
              ) : (
                data.recentActivities.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onOpenTrip(act.trip_id)}
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-medium text-teal-700 truncate">{act.trip_name}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatTimestamp(act.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800 leading-snug">{act.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">By {act.actor_name}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {showCreateTrip && (
        <CreateTripModal
          onClose={() => setShowCreateTrip(false)}
          onCreated={(tripId) => {
            setShowCreateTrip(false);
            onOpenTrip(tripId);
          }}
        />
      )}

      {showProfile && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={onUserUpdated}
          onAccountDeleted={() => {
            setShowProfile(false);
            onLogout();
          }}
        />
      )}

      {showNotifications && (
        <NotificationsModal
          onClose={() => setShowNotifications(false)}
          onOpenTrip={(tripId) => {
            setShowNotifications(false);
            onOpenTrip(tripId);
          }}
          onChanged={loadDashboard}
        />
      )}
    </div>
  );
}
