import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Archive,
  Edit3,
  History,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch } from '../../api';
import type {
  ExpenseNote,
  ExpenseRecord,
  GeneralNote,
  NoteHistoryItem,
  TripMembership,
  User,
} from '../../types';
import { formatMoney, formatTimestamp } from '../../utils/format';

interface NotepadTabProps {
  tripId: number;
  currentUser: User;
  membership: TripMembership;
}

export function NotepadTab({ tripId, currentUser, membership }: NotepadTabProps) {
  const canManageNotes =
    membership.role === 'owner' || membership.permissions.can_manage_notes;

  const [section, setSection] = useState<'general' | 'expense'>('general');
  const [generalNotes, setGeneralNotes] = useState<GeneralNote[]>([]);
  const [expenseNotes, setExpenseNotes] = useState<ExpenseNote[]>([]);
  const [history, setHistory] = useState<NoteHistoryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    type: 'general' | 'expense';
    id: number;
    title: string;
  } | null>(null);

  // Drafts preserved in memory across tab toggles
  const [genTitle, setGenTitle] = useState('');
  const [genContent, setGenContent] = useState('');
  const [genPinned, setGenPinned] = useState(false);
  const [editingGenId, setEditingGenId] = useState<number | null>(null);

  const [expTitle, setExpTitle] = useState('');
  const [expContent, setExpContent] = useState('');
  const [linkedExpenseId, setLinkedExpenseId] = useState<string>('');
  const [editingExpNoteId, setEditingExpNoteId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [notesRes, expRes] = await Promise.all([
      apiFetch<{
        generalNotes: GeneralNote[];
        expenseNotes: ExpenseNote[];
        history: NoteHistoryItem[];
      }>(`/api/trips/${tripId}/notes`),
      apiFetch<{ expenses: ExpenseRecord[] }>(`/api/trips/${tripId}/expenses`),
    ]);
    setGeneralNotes(notesRes.generalNotes);
    setExpenseNotes(notesRes.expenseNotes);
    setHistory(notesRes.history);
    setExpenses(expRes.expenses);
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitGeneralNote(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingGenId) {
        await apiFetch(`/api/trips/${tripId}/general-notes/${editingGenId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: genTitle, content: genContent, is_pinned: genPinned }),
        });
      } else {
        await apiFetch(`/api/trips/${tripId}/general-notes`, {
          method: 'POST',
          body: JSON.stringify({ title: genTitle, content: genContent, is_pinned: genPinned }),
        });
      }
      setGenTitle('');
      setGenContent('');
      setGenPinned(false);
      setEditingGenId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function togglePin(note: GeneralNote) {
    await apiFetch(`/api/trips/${tripId}/general-notes/${note.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    load();
  }

  async function toggleArchive(note: GeneralNote) {
    await apiFetch(`/api/trips/${tripId}/general-notes/${note.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: !note.is_archived }),
    });
    load();
  }

  async function deleteGeneralNote(id: number) {
    await apiFetch(`/api/trips/${tripId}/general-notes/${id}`, { method: 'DELETE' });
    load();
  }

  async function submitExpenseNote(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingExpNoteId) {
        await apiFetch(`/api/trips/${tripId}/expense-notes/${editingExpNoteId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: expTitle, content: expContent }),
        });
      } else {
        await apiFetch(`/api/trips/${tripId}/expense-notes`, {
          method: 'POST',
          body: JSON.stringify({
            expense_id: linkedExpenseId ? Number(linkedExpenseId) : null,
            title: expTitle,
            content: expContent,
          }),
        });
      }
      setExpTitle('');
      setExpContent('');
      setLinkedExpenseId('');
      setEditingExpNoteId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredGeneral = generalNotes.filter((n) => {
    if (!showArchived && n.is_archived) return false;
    if (showArchived && !n.is_archived) return false;
    if (q && !n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
    return true;
  });

  const filteredExpenseNotes = expenseNotes.filter((n) => {
    if (
      q &&
      !n.title.toLowerCase().includes(q) &&
      !n.content.toLowerCase().includes(q) &&
      !(n.expense_title || '').toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const selectedHistory = historyTarget
    ? history.filter((h) => h.note_type === historyTarget.type && h.note_id === historyTarget.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => {
              setSection('general');
              setShowForm(false);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              section === 'general' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            General Notes ({generalNotes.filter((n) => !n.is_archived).length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSection('expense');
              setShowForm(false);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              section === 'expense' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Expense Notes ({expenseNotes.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {section === 'general' && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border ${
                showArchived
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {showArchived ? 'Viewing Archived' : 'Show Archived'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingGenId(null);
              setEditingExpNoteId(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {section === 'general' ? 'New General Note' : 'New Expense Note'}
          </button>
        </div>
      </div>

      {section === 'expense' && (
        <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700">
          Expense Notes provide context and explanations for financial records. They never create
          additional financial transactions or affect settlement calculations.
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Composer Form */}
      {showForm && section === 'general' && (
        <form
          onSubmit={submitGeneralNote}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {editingGenId ? 'Edit General Note' : 'Create General Note'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            required
            value={genTitle}
            onChange={(e) => setGenTitle(e.target.value)}
            placeholder="Note title (e.g. Hotel Check-in & Emergency Contacts)"
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <textarea
            rows={4}
            required
            value={genContent}
            onChange={(e) => setGenContent(e.target.value)}
            placeholder="Write non-financial trip details, bus times, packing reminders..."
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <div className="flex items-center justify-between">
            {canManageNotes ? (
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genPinned}
                  onChange={(e) => setGenPinned(e.target.checked)}
                  className="accent-teal-700"
                />
                <span>Pin note to top</span>
              </label>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
            >
              Save General Note
            </button>
          </div>
        </form>
      )}

      {showForm && section === 'expense' && (
        <form
          onSubmit={submitExpenseNote}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {editingExpNoteId ? 'Edit Expense Note' : 'Add Expense Note'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!editingExpNoteId && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Link to Existing Expense (optional)
              </label>
              <select
                value={linkedExpenseId}
                onChange={(e) => setLinkedExpenseId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">General financial clarification (unlinked)</option>
                {expenses.map((exp) => (
                  <option key={exp.id} value={String(exp.id)}>
                    #{exp.id} · {exp.title} ({formatMoney(exp.amount_minor)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="text"
            required
            value={expTitle}
            onChange={(e) => setExpTitle(e.target.value)}
            placeholder="Title (e.g. Reason for split variance)"
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <textarea
            rows={3}
            required
            value={expContent}
            onChange={(e) => setExpContent(e.target.value)}
            placeholder="Explain payment context, receipt reference, or correction justification..."
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
            >
              Save Expense Note
            </button>
          </div>
        </form>
      )}

      {/* Notes Grid */}
      {section === 'general' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredGeneral.length === 0 ? (
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              No {showArchived ? 'archived' : 'active'} general notes found.
            </div>
          ) : (
            filteredGeneral.map((note) => {
              const canEdit = canManageNotes || note.author_id === currentUser.id;
              return (
                <article
                  key={note.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{note.title}</h3>
                      {note.is_pinned === 1 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 shrink-0">
                          <Pin className="w-3.5 h-3.5" />
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                      {note.content}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {note.author_name} · {formatTimestamp(note.updated_at)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryTarget({ type: 'general', id: note.id, title: note.title })
                        }
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        <History className="w-3.5 h-3.5" />
                        History
                      </button>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGenId(note.id);
                              setGenTitle(note.title);
                              setGenContent(note.content);
                              setGenPinned(Boolean(note.is_pinned));
                              setShowForm(true);
                            }}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {canManageNotes && (
                            <>
                              <button
                                type="button"
                                onClick={() => togglePin(note)}
                                className="hover:text-teal-700"
                              >
                                {note.is_pinned ? 'Unpin' : 'Pin'}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleArchive(note)}
                                className="inline-flex items-center gap-1 hover:text-slate-900"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                {note.is_archived ? 'Restore' : 'Archive'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteGeneralNote(note.id)}
                                className="text-red-700 hover:text-red-800"
                                aria-label="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExpenseNotes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              No expense notes recorded yet.
            </div>
          ) : (
            filteredExpenseNotes.map((note) => {
              const canEdit = canManageNotes || note.author_id === currentUser.id;
              return (
                <article
                  key={note.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{note.title}</h3>
                    {note.expense_title && (
                      <span className="text-xs font-mono text-teal-700">
                        Linked: {note.expense_title} (
                        {formatMoney(note.expense_amount_minor ?? 0)})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{note.content}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {note.author_name} · {formatTimestamp(note.updated_at)}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryTarget({ type: 'expense', id: note.id, title: note.title })
                        }
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        <History className="w-3.5 h-3.5" />
                        History
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpNoteId(note.id);
                            setExpTitle(note.title);
                            setExpContent(note.content);
                            setShowForm(true);
                          }}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Edit History Modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Edit History: {historyTarget.title}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto divide-y divide-slate-100">
              {selectedHistory.length === 0 ? (
                <p className="text-sm text-slate-500">No previous edits recorded for this note.</p>
              ) : (
                selectedHistory.map((h) => (
                  <div key={h.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Previous version saved by {h.edited_by_name}</span>
                      <span className="font-mono">{formatTimestamp(h.edited_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{h.previous_title}</p>
                    <p className="text-xs text-slate-600 whitespace-pre-line">
                      {h.previous_content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
