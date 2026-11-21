import { useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../api';

const PRESET_COVERS = [
  {
    label: 'Mountain Ridge',
    url: '/src/assets/images/trip_cover_mountains_1795281225911.jpg',
  },
  {
    label: 'Coastal Lagoon',
    url: '/src/assets/images/trip_cover_coast_1795281225701.jpg',
  },
  {
    label: 'Heritage Courtyard',
    url: '/src/assets/images/trip_cover_heritage_1795281225591.jpg',
  },
  {
    label: 'Tea Highlands',
    url: '/src/assets/images/trip_cover_highlands_1795281225148.jpg',
  },
];

interface CreateTripModalProps {
  onClose: () => void;
  onCreated: (tripId: number) => void;
}

export function CreateTripModal({ onClose, onCreated }: CreateTripModalProps) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('2026-12-10');
  const [endDate, setEndDate] = useState('2026-12-14');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [expectedPerMember, setExpectedPerMember] = useState('');
  const [coverImage, setCoverImage] = useState(PRESET_COVERS[0].url);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ id: number }>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name,
          destination,
          start_date: startDate,
          end_date: endDate,
          description,
          visibility,
          cover_image: coverImage,
          estimated_budget: estimatedBudget ? Number(estimatedBudget) : 0,
          expected_per_member: expectedPerMember ? Number(expectedPerMember) : 0,
        }),
      });
      onCreated(res.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Create New Trip</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trip Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bandarban Winter Trek"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Ruma & Boga Lake"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Starting Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ending Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Trip Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline key stops, travel mode, or expectations..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estimated Total Budget (৳)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
                placeholder="e.g. 40000"
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expected Per Member (৳)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={expectedPerMember}
                onChange={(e) => setExpectedPerMember(e.target.value)}
                placeholder="e.g. 8000"
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  visibility === 'private'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">Private</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Invite-only. Hidden from public discovery.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  visibility === 'public'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">Public</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Discoverable; visitors can request to join.
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cover Theme</label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COVERS.map((c) => (
                <button
                  key={c.url}
                  type="button"
                  onClick={() => setCoverImage(c.url)}
                  className={`rounded-lg overflow-hidden border-2 transition-colors ${
                    coverImage === c.url ? 'border-teal-700' : 'border-transparent'
                  }`}
                >
                  <img
                    src={c.url}
                    alt={c.label}
                    className="w-full h-14 object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
