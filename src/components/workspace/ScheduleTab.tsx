import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Calendar, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../api';
import type { ScheduleItem, TripMembership } from '../../types';
import { formatDate } from '../../utils/format';

interface ScheduleTabProps {
  tripId: number;
  membership: TripMembership;
}

export function ScheduleTab({ tripId, membership }: ScheduleTabProps) {
  const canManage =
    membership.role === 'owner' || membership.permissions.can_manage_schedule;

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [activityTime, setActivityTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<{ schedule: ScheduleItem[] }>(`/api/trips/${tripId}/schedule`);
    setItems(res.schedule);
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          activity_date: activityDate,
          activity_time: activityTime,
          location,
          description,
        }),
      });
      setTitle('');
      setLocation('');
      setDescription('');
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(itemId: number) {
    await apiFetch(`/api/trips/${tripId}/schedule/${itemId}`, { method: 'DELETE' });
    load();
  }

  // Group chronologically by date
  const grouped = items.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    if (!acc[item.activity_date]) acc[item.activity_date] = [];
    acc[item.activity_date].push(item);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trip Schedule Planner</h1>
          <p className="text-sm text-slate-600">
            Chronological daily itinerary for activities, departures, and check-ins.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Activity
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && canManage && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <input
                type="time"
                required
                value={activityTime}
                onChange={(e) => setActivityTime(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Ruilui Helipad"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Activity Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning ridge sunrise hike"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting notes or preparation details..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
            >
              Save Activity
            </button>
          </div>
        </form>
      )}

      {dates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          No itinerary items scheduled yet.
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((dateStr) => (
            <section
              key={dateStr}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-semibold text-slate-900">{formatDate(dateStr)}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {grouped[dateStr].map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="font-mono tabular-nums text-xs font-semibold text-teal-700 pt-0.5 flex items-center gap-1 shrink-0 w-16">
                        <Clock className="w-3.5 h-3.5" />
                        {item.activity_time}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        {item.location && (
                          <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label="Remove schedule item"
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
