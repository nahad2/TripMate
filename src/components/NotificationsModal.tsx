import { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { apiFetch } from '../api';
import { formatTimestamp } from '../utils/format';

interface NotificationRow {
  id: number;
  trip_id: number | null;
  trip_name: string | null;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

interface NotificationsModalProps {
  onClose: () => void;
  onOpenTrip: (tripId: number) => void;
  onChanged: () => void;
}

export function NotificationsModal({ onClose, onOpenTrip, onChanged }: NotificationsModalProps) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationRow[] }>('/api/notifications');
      setItems(res.notifications);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    await load();
    onChanged();
  }

  async function markRead(id: number, tripId: number | null) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    onChanged();
    if (tripId) {
      onOpenTrip(tripId);
    } else {
      load();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-lg"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading notifications...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              You have no notifications yet.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => markRead(item.id, item.trip_id)}
                className={`w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors ${
                  item.is_read ? 'opacity-70' : 'bg-teal-50/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {formatTimestamp(item.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                {item.trip_name && (
                  <span className="mt-1.5 inline-block text-xs font-medium text-teal-700">
                    {item.trip_name}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
