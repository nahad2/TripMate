import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { apiFetch } from '../api';
import type { User } from '../types';

interface ProfileSettingsModalProps {
  user: User;
  onClose: () => void;
  onUpdated: (user: User) => void;
  onAccountDeleted: () => void;
}

export function ProfileSettingsModal({
  user,
  onClose,
  onUpdated,
  onAccountDeleted,
}: ProfileSettingsModalProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [notifyExpenses, setNotifyExpenses] = useState(Boolean(user.notify_expenses));
  const [notifyAnnouncements, setNotifyAnnouncements] = useState(Boolean(user.notify_announcements));
  const [notifyRequests, setNotifyRequests] = useState(Boolean(user.notify_requests));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setError('Profile image must be smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone,
          bio,
          avatar_url: avatarUrl,
          notify_expenses: notifyExpenses,
          notify_announcements: notifyAnnouncements,
          notify_requests: notifyRequests,
        }),
      });
      onUpdated(res.user);
      setSuccess('Profile and notification preferences saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    try {
      await apiFetch('/api/auth/delete-account', { method: 'POST' });
      onAccountDeleted();
    } catch (err) {
      setError((err as Error).message);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Profile & Account Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              {success}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center font-display font-bold text-xl overflow-hidden shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              <p className="mt-1 text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Short Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Notification Preferences</h3>
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              <span>Expense & reimbursement updates</span>
              <input
                type="checkbox"
                checked={notifyExpenses}
                onChange={(e) => setNotifyExpenses(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              <span>Trip announcements & schedule changes</span>
              <input
                type="checkbox"
                checked={notifyAnnouncements}
                onChange={(e) => setNotifyAnnouncements(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              <span>Join requests & trip invitations</span>
              <input
                type="checkbox"
                checked={notifyRequests}
                onChange={(e) => setNotifyRequests(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-medium text-red-700 hover:text-red-800"
              >
                Request Account Deletion
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
