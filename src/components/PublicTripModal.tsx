import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Calendar, Lock, MapPin, User as UserIcon, Users, X } from 'lucide-react';
import { apiFetch } from '../api';
import type { PublicTrip, User } from '../types';
import { formatDateRange } from '../utils/format';
import { StatusLabel } from './StatusLabel';
import { TripCoverImage } from './TripCoverImage';

interface PublicTripModalProps {
  tripId: number;
  currentUser: User | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onOpenTripWorkspace: (tripId: number) => void;
}

export function PublicTripModal({
  tripId,
  currentUser,
  onClose,
  onRequireAuth,
  onOpenTripWorkspace,
}: PublicTripModalProps) {
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<
    'none' | 'member' | 'pending_request' | 'rejected_request'
  >('none');
  const [joinMessage, setJoinMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{
      trip: PublicTrip;
      membershipStatus: 'none' | 'member' | 'pending_request' | 'rejected_request';
    }>(`/api/public/trips/${tripId}`)
      .then((res) => {
        if (!active) return;
        setTrip(res.trip);
        setMembershipStatus(res.membershipStatus);
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tripId, currentUser]);

  async function handleJoinRequest(e: FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/public/trips/${tripId}/join`, {
        method: 'POST',
        body: JSON.stringify({ message: joinMessage }),
      });
      setMembershipStatus('pending_request');
      setSuccess('Join request sent. An Owner or Admin will review your request.');
      setJoinMessage('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <span className="text-sm font-medium text-slate-500">Public Trip Overview</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip details"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-52 bg-slate-100 rounded-lg" />
              <div className="h-6 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-full" />
            </div>
          )}

          {!loading && error && !trip && (
            <div className="p-8 text-center text-red-700 text-sm">{error}</div>
          )}

          {!loading && trip && (
            <div>
              <TripCoverImage
                src={trip.cover_image}
                alt={trip.name}
                className="w-full h-56 object-cover"
              />
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <StatusLabel status={trip.status} />
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Financial records private to members
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{trip.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-teal-700" />
                      {trip.destination}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      {formatDateRange(trip.start_date, trip.end_date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserIcon className="w-4 h-4 text-slate-500" />
                      Organized by {trip.owner_name}
                    </span>
                    {trip.member_count !== null && (
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs">
                        <Users className="w-4 h-4 text-slate-500" />
                        {trip.member_count} participants
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1.5">About This Trip</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {trip.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  {error && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                      {success}
                    </div>
                  )}

                  {membershipStatus === 'member' ? (
                    <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          You are an active member of this trip
                        </p>
                        <p className="text-xs text-slate-600">
                          Open the full workspace to view budgets, expenses, notes, and settlements.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenTripWorkspace(trip.id)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg whitespace-nowrap shrink-0"
                      >
                        Open Workspace
                      </button>
                    </div>
                  ) : membershipStatus === 'pending_request' ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      Your join request is pending review by the trip Owner or Admin.
                    </div>
                  ) : trip.status === 'completed' || trip.status === 'archived' ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                      This trip has already concluded and is no longer accepting new join requests.
                    </div>
                  ) : (
                    <form onSubmit={handleJoinRequest} className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-900">
                        Request to Join Trip
                      </label>
                      <textarea
                        rows={2}
                        value={joinMessage}
                        onChange={(e) => setJoinMessage(e.target.value)}
                        placeholder="Introduce yourself or share how you can contribute to the group..."
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          {currentUser
                            ? `Requesting as ${currentUser.name}`
                            : 'You will be asked to sign in to submit a request.'}
                        </span>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                        >
                          {submitting
                            ? 'Sending...'
                            : currentUser
                              ? 'Send Join Request'
                              : 'Sign In to Request Join'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
