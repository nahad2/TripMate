import { useState } from 'react';
import { Download, LogOut, Plus, Sparkles, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/calculations.ts';
import type { TripListItem, UserProfile } from '../lib/tripmate-types.ts';

interface ProfileTripsTabProps {
  user: UserProfile;
  trips: TripListItem[];
  activeTripId: number | null;
  onSelectTrip: (tripId: number) => void;
  onOpenCreateTrip: () => void;
  onCreateSampleTrip: () => Promise<void>;
  onDeleteTrip: (tripId: number) => Promise<void>;
  onUpdateProfile: (payload: {
    name: string;
    phone: string;
    defaultCurrency: string;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function ProfileTripsTab({
  user,
  trips,
  activeTripId,
  onSelectTrip,
  onOpenCreateTrip,
  onCreateSampleTrip,
  onDeleteTrip,
  onUpdateProfile,
  onSignOut,
}: ProfileTripsTabProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [defaultCurrency, setDefaultCurrency] = useState(user.defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onUpdateProfile({ name, phone, defaultCurrency });
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2744]">
            All Trips &amp; Account Profile
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Switch between ongoing, upcoming, and completed trips or update your
            traveler profile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/export-project-zip"
            download="tripmate-full-project.zip"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#0F2744] hover:border-teal-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-teal-700" />
            <span>Download Project (.zip)</span>
          </a>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-700 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5"
        >
          <h2 className="font-display text-base font-semibold text-[#0F2744]">
            Traveler Profile
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Phone / Payment Handle
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., +880 1711-000000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Default Currency
              </label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>

            {savedNotice && (
              <p className="text-xs font-medium text-teal-700">
                Profile changes saved.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[#0F2744] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173963] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Trips Directory */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2744]">
                Your Trips ({trips.length})
              </h2>
              <p className="text-xs text-slate-500">
                Select any trip to inspect its dashboard and ledger.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCreateSampleTrip}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                <span>Load Sample Trip</span>
              </button>
              <button
                type="button"
                onClick={onOpenCreateTrip}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Trip</span>
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {trips.map((t) => {
              const isActive = t.id === activeTripId;
              return (
                <div
                  key={t.id}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    isActive
                      ? 'border-teal-600 bg-teal-50/25'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="h-28 w-full bg-slate-100">
                    {t.coverImage ? (
                      <img
                        src={t.coverImage}
                        alt={t.destination}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#0F2744] text-xs font-medium text-white">
                        {t.destination}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-slate-500">
                      {t.destination} ·{' '}
                      <span className="capitalize">{t.status}</span> ·{' '}
                      {t.myRole === 'admin' ? 'Admin' : 'Member'}
                    </p>
                    <h3 className="mt-1 font-display text-base font-bold text-[#0F2744]">
                      {t.tripName}
                    </h3>
                    <p className="mt-1 font-mono-num text-xs text-slate-600">
                      Collected: {formatCurrency(t.totalCollected, t.currency)}{' '}
                      · Spent: {formatCurrency(t.totalExpenses, t.currency)}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => onSelectTrip(t.id)}
                        className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        {isActive ? 'Currently Open' : 'Open Workspace'}
                      </button>

                      {t.myRole === 'admin' && (
                        <button
                          type="button"
                          onClick={() => onDeleteTrip(t.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          aria-label={`Delete ${t.tripName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
