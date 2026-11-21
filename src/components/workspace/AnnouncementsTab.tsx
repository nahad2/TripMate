import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, Megaphone, Plus } from 'lucide-react';
import { apiFetch } from '../../api';
import type { AnnouncementItem, TripMembership } from '../../types';
import { formatTimestamp } from '../../utils/format';

interface AnnouncementsTabProps {
  tripId: number;
  membership: TripMembership;
}

export function AnnouncementsTab({ tripId, membership }: AnnouncementsTabProps) {
  const canPublish =
    membership.role === 'owner' || membership.permissions.can_publish_announcements;

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<{ announcements: AnnouncementItem[] }>(
      `/api/trips/${tripId}/announcements`
    );
    setAnnouncements(res.announcements);
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ title, message, priority }),
      });
      setTitle('');
      setMessage('');
      setPriority('normal');
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trip Announcements</h1>
          <p className="text-sm text-slate-600">
            Important updates published to all active trip members.
          </p>
        </div>

        {canPublish && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Publish Announcement
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && canPublish && (
        <form
          onSubmit={handlePublish}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Departure time updated to 10:00 PM"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="normal">Normal Update</option>
                <option value="urgent">Urgent Notice</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write clear details for all travelers..."
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
              Publish to Members
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            No announcements published yet.
          </div>
        ) : (
          announcements.map((a) => (
            <article
              key={a.id}
              className={`bg-white border rounded-xl p-5 space-y-2 ${
                a.priority === 'urgent' ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.priority === 'urgent' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  ) : (
                    <Megaphone className="w-4 h-4 text-teal-700 shrink-0" />
                  )}
                  <h2 className="text-base font-semibold text-slate-900">{a.title}</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {formatTimestamp(a.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{a.message}</p>
              <p className="text-xs text-slate-500">
                {a.priority === 'urgent' ? 'Urgent · ' : ''}Published by {a.author_name}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
