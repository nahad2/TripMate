import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { RefundPolicy } from '../lib/tripmate-types.ts';

interface CreateTripModalProps {
  open: boolean;
  defaultCurrency: string;
  onClose: () => void;
  onCreateTrip: (payload: {
    tripName: string;
    destination: string;
    startDate: string;
    endDate: string;
    currency: string;
    defaultMemberBudget: number;
    refundPolicy: RefundPolicy;
    coverImage: string;
    members: Array<{ name: string; email: string; assignedBudget: number }>;
  }) => Promise<void>;
}

const COVER_OPTIONS = [
  {
    label: 'Coastal Bay',
    url: '/src/assets/images/trip_coastal_island_1795201698982.jpg',
  },
  {
    label: 'Tea Highlands',
    url: '/src/assets/images/trip_highlands_retreat_1795201698377.jpg',
  },
];

export function CreateTripModal({
  open,
  defaultCurrency,
  onClose,
  onCreateTrip,
}: CreateTripModalProps) {
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  );
  const [currency, setCurrency] = useState(defaultCurrency || 'BDT');
  const [defaultMemberBudget, setDefaultMemberBudget] = useState('2500');
  const [refundPolicy, setRefundPolicy] =
    useState<RefundPolicy>('proportional');
  const [coverImage, setCoverImage] = useState(COVER_OPTIONS[0].url);
  const [companions, setCompanions] = useState<
    Array<{ name: string; email: string }>
  >([]);
  const [compName, setCompName] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function addCompanionRow() {
    if (!compName.trim() || !compEmail.includes('@')) return;
    setCompanions((prev) => [
      ...prev,
      { name: compName.trim(), email: compEmail.trim() },
    ]);
    setCompName('');
    setCompEmail('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tripName.trim() || !destination.trim()) {
      setError('Trip name and destination are required.');
      return;
    }
    const budgetNum = Number(defaultMemberBudget || 0);
    setSubmitting(true);
    try {
      await onCreateTrip({
        tripName: tripName.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        currency,
        defaultMemberBudget: budgetNum,
        refundPolicy,
        coverImage,
        members: companions.map((c) => ({
          name: c.name,
          email: c.email,
          assignedBudget: budgetNum,
        })),
      });
      setTripName('');
      setDestination('');
      setCompanions([]);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div className="my-8 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F2744]">
              Create New Group Trip
            </h2>
            <p className="text-xs text-slate-500">
              You are automatically assigned as Trip Administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Trip Name
              </label>
              <input
                type="text"
                required
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g., Bandarban Hill Trek 2026"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Destination
              </label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Thanchi & Boga Lake"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Budget Per Member
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={defaultMemberBudget}
                onChange={(e) => setDefaultMemberBudget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Unused Group Fund Refund Policy
              </label>
              <select
                value={refundPolicy}
                onChange={(e) =>
                  setRefundPolicy(e.target.value as RefundPolicy)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="proportional">
                  Proportional to Member Surplus
                </option>
                <option value="equal">Equal Distribution</option>
                <option value="carry_forward">Carry Forward</option>
              </select>
            </div>
          </div>

          {/* Cover Theme */}
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Trip Cover Visual
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              {COVER_OPTIONS.map((opt) => (
                <button
                  key={opt.url}
                  type="button"
                  onClick={() => setCoverImage(opt.url)}
                  className={`flex items-center gap-3 rounded-lg border p-2 text-left text-xs transition-colors cursor-pointer ${
                    coverImage === opt.url
                      ? 'border-teal-600 bg-teal-50/40 font-semibold text-[#0F2744]'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <img
                    src={opt.url}
                    alt={opt.label}
                    referrerPolicy="no-referrer"
                    className="h-10 w-14 rounded object-cover"
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional initial members */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-700">
              Optional: Add Group Members Now
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="Friend's Name"
                className="min-w-[140px] flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
              <input
                type="email"
                value={compEmail}
                onChange={(e) => setCompEmail(e.target.value)}
                placeholder="friend@email.com"
                className="min-w-[160px] flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={addCompanionRow}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {companions.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {companions.map((c, idx) => (
                  <div
                    key={`${c.email}-${idx}`}
                    className="flex items-center justify-between rounded bg-white px-2.5 py-1.5 text-xs border border-slate-200"
                  >
                    <span>
                      <strong className="text-slate-800">{c.name}</strong> ·{' '}
                      <span className="text-slate-500">{c.email}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCompanions((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#0F2744] px-5 py-2 text-sm font-semibold text-white hover:bg-[#173963] disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
