import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  FileBarChart2,
  LayoutDashboard,
  Megaphone,
  Menu,
  NotebookPen,
  PiggyBank,
  Receipt,
  Scale,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../api';
import type {
  ActivityLogItem,
  TripDetail,
  TripFinanceSummary,
  TripMember,
  TripMembership,
  User,
} from '../types';
import { OverviewTab } from './workspace/OverviewTab';
import { MembersTab } from './workspace/MembersTab';
import { BudgetTab } from './workspace/BudgetTab';
import { ContributionsTab } from './workspace/ContributionsTab';
import { ExpensesTab } from './workspace/ExpensesTab';
import { NotepadTab } from './workspace/NotepadTab';
import { AnnouncementsTab } from './workspace/AnnouncementsTab';
import { ScheduleTab } from './workspace/ScheduleTab';
import { SettlementTab } from './workspace/SettlementTab';
import { ReportsTab } from './workspace/ReportsTab';
import { AdminPanelTab } from './workspace/AdminPanelTab';

interface TripWorkspacePayload {
  trip: TripDetail;
  membership: TripMembership;
  summary: TripFinanceSummary;
  members: TripMember[];
  pendingOwnershipTransfer: {
    id: number;
    to_user_name: string;
    previous_owner_new_role: string;
  } | null;
}

interface TripWorkspaceProps {
  tripId: number;
  currentUser: User;
  onBackToDashboard: () => void;
}

export function TripWorkspace({ tripId, currentUser, onBackToDashboard }: TripWorkspaceProps) {
  const [data, setData] = useState<TripWorkspacePayload | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [triggerExpenseModal, setTriggerExpenseModal] = useState(false);
  const [triggerContributionModal, setTriggerContributionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const [wsRes, logRes] = await Promise.all([
        apiFetch<TripWorkspacePayload>(`/api/trips/${tripId}`),
        apiFetch<{ logs: ActivityLogItem[] }>(`/api/trips/${tripId}/activity-logs`),
      ]);
      setData(wsRes);
      setRecentLogs(logRes.logs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    loadWorkspace();
  }, [loadWorkspace]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-sm text-slate-600">Loading trip workspace...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center space-y-4">
          <p className="text-sm font-medium text-red-700">{error || 'Workspace unavailable.'}</p>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { trip, membership, summary, members, pendingOwnershipTransfer } = data;
  const isAdminOrOwner = membership.role === 'owner' || membership.role === 'admin';

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'budget', label: 'Budget', icon: PiggyBank },
    { id: 'contributions', label: 'Contributions', icon: Wallet },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'notepad', label: 'Notepad', icon: NotebookPen },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays },
    { id: 'settlement', label: 'Settlement', icon: Scale },
    { id: 'reports', label: 'Reports', icon: FileBarChart2 },
    ...(isAdminOrOwner ? [{ id: 'admin', label: 'Admin Panel', icon: ShieldCheck }] : []),
  ];

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  function selectTab(id: string) {
    setActiveTab(id);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (256px) */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Trips
          </button>
          <span className="font-display font-bold text-sm text-slate-900">TripMate</span>
        </div>

        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{trip.name}</p>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{trip.destination}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
          Signed in as <strong className="text-slate-800">{currentUser.name}</strong>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Breadcrumb Bar */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open trip navigation"
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="text-slate-500 hover:text-slate-900 hidden sm:inline whitespace-nowrap shrink-0"
              >
                Dashboard
              </button>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-500 truncate max-w-[160px] sm:max-w-[240px]">
                {trip.name}
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900 whitespace-nowrap shrink-0">
                {activeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {trip.status !== 'completed' && trip.status !== 'archived' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('expenses');
                  setTriggerExpenseModal(true);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
              >
                + Add Expense
              </button>
            )}
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative bg-white w-72 max-w-[80vw] h-full flex flex-col shadow-xl">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <span className="font-display font-bold text-base text-slate-900">TripMate</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{trip.name}</p>
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Dashboard
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg ${
                        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewTab
              trip={trip}
              membership={membership}
              summary={summary}
              recentLogs={recentLogs}
              onNavigate={setActiveTab}
              onQuickAddExpense={() => {
                setActiveTab('expenses');
                setTriggerExpenseModal(true);
              }}
              onQuickAddContribution={() => {
                setActiveTab('contributions');
                setTriggerContributionModal(true);
              }}
            />
          )}

          {activeTab === 'members' && (
            <MembersTab
              tripId={trip.id}
              currentUser={currentUser}
              membership={membership}
              members={members}
              onRefreshWorkspace={loadWorkspace}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetTab
              trip={trip}
              summary={summary}
              members={members}
              onGoToContributions={() => setActiveTab('contributions')}
            />
          )}

          {activeTab === 'contributions' && (
            <ContributionsTab
              tripId={trip.id}
              tripStatus={trip.status}
              currentUser={currentUser}
              membership={membership}
              members={members}
              initialShowModal={triggerContributionModal}
              onModalHandled={() => setTriggerContributionModal(false)}
              onFinancialChanged={loadWorkspace}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesTab
              tripId={trip.id}
              tripStatus={trip.status}
              currentUser={currentUser}
              membership={membership}
              members={members}
              initialShowModal={triggerExpenseModal}
              onModalHandled={() => setTriggerExpenseModal(false)}
              onFinancialChanged={loadWorkspace}
            />
          )}

          {activeTab === 'notepad' && (
            <NotepadTab tripId={trip.id} currentUser={currentUser} membership={membership} />
          )}

          {activeTab === 'announcements' && (
            <AnnouncementsTab tripId={trip.id} membership={membership} />
          )}

          {activeTab === 'schedule' && <ScheduleTab tripId={trip.id} membership={membership} />}

          {activeTab === 'settlement' && (
            <SettlementTab
              tripId={trip.id}
              membership={membership}
              onFinancialChanged={loadWorkspace}
            />
          )}

          {activeTab === 'reports' && <ReportsTab tripId={trip.id} />}

          {activeTab === 'admin' && isAdminOrOwner && (
            <AdminPanelTab
              trip={trip}
              currentUser={currentUser}
              membership={membership}
              summary={summary}
              members={members}
              pendingOwnershipTransfer={pendingOwnershipTransfer}
              onRefreshWorkspace={loadWorkspace}
            />
          )}
        </main>
      </div>
    </div>
  );
}
