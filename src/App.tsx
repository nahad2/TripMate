/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  BarChart3,
  Coins,
  Download,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Receipt,
  Scale,
  UserCircle,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { auth } from './lib/firebase.ts';
import {
  addContributionApi,
  addExpenseApi,
  addMemberApi,
  addReimbursementApi,
  approveContributionApi,
  approveExpenseApi,
  createSampleTripApi,
  createTripApi,
  deleteContributionApi,
  deleteExpenseApi,
  deleteReimbursementApi,
  deleteTripApi,
  fetchMe,
  fetchTripDetail,
  finalizeSettlementsApi,
  removeMemberApi,
  setMemoryAuthToken,
  signInWithGoogle,
  signOutUser,
  updateMemberApi,
  updateProfile,
  updateReimbursementApi,
  updateTripApi,
} from './lib/api.ts';
import { computeTripFinancials } from './lib/calculations.ts';
import type {
  TripDetailPayload,
  TripListItem,
  UserProfile,
} from './lib/tripmate-types.ts';
import { ContributionsTab } from './components/ContributionsTab.tsx';
import { CreateTripModal } from './components/CreateTripModal.tsx';
import { DashboardTab, type WorkspaceTab } from './components/DashboardTab.tsx';
import { ExpensesTab } from './components/ExpensesTab.tsx';
import { LandingHome } from './components/LandingHome.tsx';
import { MembersBudgetTab } from './components/MembersBudgetTab.tsx';
import { ProfileTripsTab } from './components/ProfileTripsTab.tsx';
import { ReimbursementsTab } from './components/ReimbursementsTab.tsx';
import { ReportsTab } from './components/ReportsTab.tsx';
import { SettlementTab } from './components/SettlementTab.tsx';

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Members & Budget', icon: Users },
  { id: 'contributions', label: 'Contributions', icon: Coins },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'reimbursements', label: 'Reimbursements', icon: Wallet },
  { id: 'settlement', label: 'Settlement', icon: Scale },
  { id: 'reports', label: 'Reports & PDF', icon: FileText },
  { id: 'profile', label: 'Trips & Profile', icon: UserCircle },
];

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [tripDetail, setTripDetail] = useState<TripDetailPayload | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createTripOpen, setCreateTripOpen] = useState(false);
  const [addExpenseModalTrigger, setAddExpenseModalTrigger] = useState(0);

  const loadWorkspace = useCallback(async (preferredTripId?: number) => {
    setLoadingWorkspace(true);
    setActionError(null);
    try {
      const data = await fetchMe();
      setUser(data.user);
      setTrips(data.trips);

      const nextId =
        preferredTripId && data.trips.some((t) => t.id === preferredTripId)
          ? preferredTripId
          : (data.trips[0]?.id ?? null);

      setActiveTripId(nextId);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  const loadActiveTrip = useCallback(async (tripId: number | null) => {
    if (!tripId) {
      setTripDetail(null);
      return;
    }
    setLoadingTrip(true);
    try {
      const detail = await fetchTripDetail(tripId);
      setTripDetail(detail);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setLoadingTrip(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setMemoryAuthToken(token);
          setSignedIn(true);
          setAuthReady(true);
          await loadWorkspace();
        } catch (err) {
          setAuthError((err as Error).message);
          setAuthReady(true);
        }
      } else {
        setMemoryAuthToken(null);
        setSignedIn(false);
        setUser(null);
        setTrips([]);
        setActiveTripId(null);
        setTripDetail(null);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [loadWorkspace]);

  useEffect(() => {
    if (signedIn && activeTripId) {
      loadActiveTrip(activeTripId);
    } else if (!activeTripId) {
      setTripDetail(null);
    }
  }, [signedIn, activeTripId, loadActiveTrip]);

  const overview = useMemo(() => {
    if (!tripDetail) return null;
    return computeTripFinancials(
      tripDetail.members,
      tripDetail.contributions,
      tripDetail.expenses,
      tripDetail.reimbursements,
      tripDetail.settlements,
    );
  }, [tripDetail]);

  async function handleSignIn() {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOutUser();
    setActiveTab('dashboard');
  }

  async function refreshCurrentTrip() {
    if (!activeTripId) return;
    await Promise.all([loadActiveTrip(activeTripId), loadWorkspace(activeTripId)]);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="font-display text-lg font-bold text-[#0F2744]">
            TripMate
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Initializing workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <LandingHome
        onSignIn={handleSignIn}
        signingIn={signingIn}
        authError={authError}
      />
    );
  }

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0F2744] text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="font-display text-xl font-bold tracking-tight text-white">
            TripMate
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded p-1 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Trip Switcher */}
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Active Trip</span>
            <button
              type="button"
              onClick={() => setCreateTripOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-teal-300 hover:text-teal-200 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              New Trip
            </button>
          </div>
          <select
            value={activeTripId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id > 0) setActiveTripId(id);
            }}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#16365D] px-3 py-2 text-xs font-medium text-white focus:border-teal-400 focus:outline-none"
          >
            {trips.length === 0 ? (
              <option value="">No trips yet</option>
            ) : (
              trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripName}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/10 px-4 py-4 space-y-3">
          <a
            href="/api/export-project-zip"
            download="tripmate-full-project.zip"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#16365D] px-3 py-2 text-xs font-semibold text-teal-300 transition-colors hover:bg-[#1D4677] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Project (.zip)</span>
          </a>
          <div>
            <p className="truncate text-sm font-semibold text-white">
              {user?.name || 'Traveler'}
            </p>
            <p className="truncate text-xs text-slate-300">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="hidden sm:inline font-medium text-slate-700">
                TripMate
              </span>
              {tripDetail && (
                <>
                  <span className="hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="truncate font-medium text-slate-700 max-w-[180px] sm:max-w-[260px]">
                    {tripDetail.trip.tripName}
                  </span>
                </>
              )}
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-[#0F2744] whitespace-nowrap">
                {activeNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {tripDetail && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('expenses');
                  setAddExpenseModalTrigger((n) => n + 1);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2744] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#173963] whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Expense</span>
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-6">
          {actionError && (
            <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-xs font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {loadingWorkspace && !tripDetail ? (
            <div className="space-y-4">
              <div className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
              </div>
            </div>
          ) : activeTab === 'profile' && user ? (
            <ProfileTripsTab
              user={user}
              trips={trips}
              activeTripId={activeTripId}
              onSelectTrip={(id) => {
                setActiveTripId(id);
                setActiveTab('dashboard');
              }}
              onOpenCreateTrip={() => setCreateTripOpen(true)}
              onCreateSampleTrip={async () => {
                const { tripId } = await createSampleTripApi('sylhet');
                await loadWorkspace(tripId);
                setActiveTab('dashboard');
              }}
              onDeleteTrip={async (id) => {
                await deleteTripApi(id);
                await loadWorkspace();
              }}
              onUpdateProfile={async (payload) => {
                const { user: updated } = await updateProfile(payload);
                setUser(updated);
                if (activeTripId) await loadActiveTrip(activeTripId);
              }}
              onSignOut={handleSignOut}
            />
          ) : !activeTripId || (!loadingTrip && !tripDetail) ? (
            <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-10 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-teal-600" />
              <h1 className="mt-4 font-display text-2xl font-bold text-[#0F2744]">
                Welcome to TripMate
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Create your first group trip to start assigning budgets,
                logging contributions, splitting expenses, and calculating
                settlements.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreateTripOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F2744] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173963] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create New Trip
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { tripId } = await createSampleTripApi('coxs-bazar');
                    await loadWorkspace(tripId);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Load Sample Trip (Cox&apos;s Bazar)
                </button>
              </div>
            </div>
          ) : loadingTrip || !tripDetail || !overview ? (
            <div className="space-y-4">
              <div className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardTab
                  detail={tripDetail}
                  overview={overview}
                  onNavigate={setActiveTab}
                  onOpenAddExpense={() => {
                    setActiveTab('expenses');
                    setAddExpenseModalTrigger((n) => n + 1);
                  }}
                  onApproveContribution={async (id) => {
                    await approveContributionApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                  onDeleteContribution={async (id) => {
                    await deleteContributionApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                  onApproveExpense={async (id) => {
                    await approveExpenseApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                  onDeleteExpense={async (id) => {
                    await deleteExpenseApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                  onMarkReimbursementPaid={async (id) => {
                    await updateReimbursementApi(tripDetail.trip.id, id, {
                      status: 'completed',
                      paymentDate: new Date().toISOString().slice(0, 10),
                    });
                    await refreshCurrentTrip();
                  }}
                />
              )}

              {activeTab === 'members' && (
                <MembersBudgetTab
                  detail={tripDetail}
                  overview={overview}
                  onAddMember={async (payload) => {
                    await addMemberApi(tripDetail.trip.id, payload);
                    await refreshCurrentTrip();
                  }}
                  onUpdateMember={async (memberId, payload) => {
                    await updateMemberApi(tripDetail.trip.id, memberId, payload);
                    await refreshCurrentTrip();
                  }}
                  onRemoveMember={async (memberId) => {
                    await removeMemberApi(tripDetail.trip.id, memberId);
                    await refreshCurrentTrip();
                  }}
                />
              )}

              {activeTab === 'contributions' && (
                <ContributionsTab
                  detail={tripDetail}
                  overview={overview}
                  onAddContribution={async (payload) => {
                    await addContributionApi(tripDetail.trip.id, payload);
                    await refreshCurrentTrip();
                  }}
                  onApproveContribution={async (id) => {
                    await approveContributionApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                  onDeleteContribution={async (id) => {
                    await deleteContributionApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesTab
                  detail={tripDetail}
                  openModalTrigger={addExpenseModalTrigger}
                  onAddExpense={async (payload) => {
                    await addExpenseApi(tripDetail.trip.id, payload);
                    await refreshCurrentTrip();
                  }}
                  onApproveExpense={async (id) => {
                    await approveExpenseApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                  onDeleteExpense={async (id) => {
                    await deleteExpenseApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                />
              )}

              {activeTab === 'reimbursements' && (
                <ReimbursementsTab
                  detail={tripDetail}
                  overview={overview}
                  onAddReimbursement={async (payload) => {
                    await addReimbursementApi(tripDetail.trip.id, payload);
                    await refreshCurrentTrip();
                  }}
                  onUpdateReimbursement={async (id, status) => {
                    await updateReimbursementApi(tripDetail.trip.id, id, {
                      status,
                      paymentDate: new Date().toISOString().slice(0, 10),
                    });
                    await refreshCurrentTrip();
                  }}
                  onDeleteReimbursement={async (id) => {
                    await deleteReimbursementApi(tripDetail.trip.id, id);
                    await refreshCurrentTrip();
                  }}
                />
              )}

              {activeTab === 'settlement' && (
                <SettlementTab
                  detail={tripDetail}
                  overview={overview}
                  onChangeRefundPolicy={async (refundPolicy) => {
                    await updateTripApi(tripDetail.trip.id, { refundPolicy });
                    await refreshCurrentTrip();
                  }}
                  onFinalizeSettlements={async (entries, markTripCompleted) => {
                    await finalizeSettlementsApi(
                      tripDetail.trip.id,
                      entries,
                      markTripCompleted,
                    );
                    await refreshCurrentTrip();
                  }}
                  onOpenReport={() => setActiveTab('reports')}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsTab detail={tripDetail} overview={overview} />
              )}
            </>
          )}
        </main>
      </div>

      <CreateTripModal
        open={createTripOpen}
        defaultCurrency={user?.defaultCurrency ?? 'BDT'}
        onClose={() => setCreateTripOpen(false)}
        onCreateTrip={async (payload) => {
          const { tripId } = await createTripApi(payload);
          await loadWorkspace(tripId);
          setActiveTab('dashboard');
        }}
      />
    </div>
  );
}
