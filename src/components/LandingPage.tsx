import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  FileSpreadsheet,
  NotebookPen,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../api';
import type { PublicTrip, User } from '../types';
import { formatDateRange } from '../utils/format';
import { StatusLabel } from './StatusLabel';
import { TripCoverImage } from './TripCoverImage';

interface LandingPageProps {
  currentUser: User | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDashboard: () => void;
  onSelectPublicTrip: (tripId: number) => void;
}

export function LandingPage({
  currentUser,
  onOpenAuth,
  onOpenDashboard,
  onSelectPublicTrip,
}: LandingPageProps) {
  const [publicTrips, setPublicTrips] = useState<PublicTrip[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    apiFetch<{ trips: PublicTrip[] }>(`/api/public/trips?${params.toString()}`)
      .then((res) => {
        if (active) setPublicTrips(res.trips);
      })
      .catch(() => {
        if (active) setPublicTrips([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top Bar Contract: 1-line Brand — 4 clean nav links — 1 primary CTA */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            TripMate
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#explore"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Explore Trips
            </a>
            <a
              href="#architecture"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Financial Model
            </a>
            <a
              href="#notepad"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Notepad & Audit
            </a>
            <a
              href="#settlement"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Settlement
            </a>
          </nav>

          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Open Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-teal-700 mb-3">
                Plan Together. Spend Smart. Travel Better.
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.1] max-w-xl"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Group trip budgets and settlements without spreadsheet disputes.
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                Track partial member contributions, verify expenses before they hit the Central Group
                Fund, separate personal advances from pool cash, and reconcile final payouts down to
                the exact paisa.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => (currentUser ? onOpenDashboard() : onOpenAuth('register'))}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{currentUser ? 'Go to My Trips' : 'Start Planning a Trip'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#explore"
                  className="px-5 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 bg-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Browse Public Trips
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                <TripCoverImage
                  src="/src/assets/images/hero_group_travel_1795281226200.jpg"
                  alt="Group of travelers walking along a scenic mountain ridge overlooking a turquoise lake"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-column Key Financial Guarantees Strip */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-10 border-t border-slate-200">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <Wallet className="w-5 h-5 text-teal-700 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">Central Group Fund</h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Separates verified pool deposits from pending submissions and personal advances.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <Calculator className="w-5 h-5 text-teal-700 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">4-Mode Expense Splitting</h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Equal, custom, individual, or participation-only splits with exact integer rounding.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <ShieldCheck className="w-5 h-5 text-teal-700 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">Granular Admin RBAC</h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Owners delegate specific permissions per Admin, backed by immutable audit logs.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <FileSpreadsheet className="w-5 h-5 text-teal-700 mb-3" />
              <h2 className="text-sm font-semibold text-slate-900">Reconciled Settlement</h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Explains every member balance and minimizes final settlement transfers.
              </p>
            </div>
          </div>
        </section>

        {/* Mechanism-to-Outcome Capabilities */}
        <section id="architecture" className="bg-white border-y border-slate-200 py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Built for real-world group money workflows
              </h2>
              <p className="mt-2 text-base text-slate-600">
                Every financial edge case — delayed deposits, personal out-of-pocket meals, and
                non-participating members — is modeled explicitly.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-900">
                  01. Central Group Fund vs. Personal Payments
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  When a member pays ৳1,800 from personal cash for lunch while the fund manager is
                  away, TripMate records the expense once, tracks what participating members owe, and
                  queues a separate reimbursement transaction — never double-deducting from the group
                  fund.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <span className="block text-xs text-slate-500">Group Fund Balance</span>
                    <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                      Verified − Pool Paid − Reimbursed
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">Approval Gate</span>
                    <span className="text-sm font-medium text-slate-800">
                      Pending → Approved / Rejected
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">Correction Policy</span>
                    <span className="text-sm font-medium text-slate-800">
                      Audited adjustment entries
                    </span>
                  </div>
                </div>
              </div>

              <div
                id="notepad"
                className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-2 text-slate-900">
                  <NotebookPen className="w-5 h-5 text-teal-700" />
                  <h3 className="text-base font-semibold">02. Dual Notepad System</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  General Notes hold itineraries, hotel bookings, and emergency contacts with pinning
                  and archiving. Expense Notes link directly to approved bills to explain special
                  splits without creating duplicate ledger amounts.
                </p>
                <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                  <p>General Notes · Pinning, search, archive & edit history</p>
                  <p>Expense Notes · Linked to expense IDs · Zero duplicate math</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Public Trip Discovery Section */}
        <section id="explore" className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Explore Public Trips
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Browse open group expeditions. Private member emails, notes, and financial ledgers
                remain hidden until your join request is approved.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search destination or trip..."
                  className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 w-60"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                {['all', 'planning', 'upcoming', 'active', 'completed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="h-44 bg-slate-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-slate-100 rounded w-1/3" />
                    <div className="h-5 bg-slate-100 rounded w-4/5" />
                    <div className="h-4 bg-slate-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : publicTrips.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                No public trips match your current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="mt-3 px-4 py-2 text-xs font-medium text-teal-700 hover:text-teal-800 border border-slate-300 rounded-lg"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {publicTrips.map((trip) => (
                <article
                  key={trip.id}
                  onClick={() => onSelectPublicTrip(trip.id)}
                  className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <TripCoverImage
                      src={trip.cover_image}
                      alt={trip.name}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                      {trip.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span>{trip.destination}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                    </div>
                    <p className="mt-2.5 text-sm text-slate-600 line-clamp-2 flex-1">
                      {trip.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <StatusLabel status={trip.status} />
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {trip.member_count !== null ? `${trip.member_count} members` : trip.owner_name}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Settlement Preview Banner */}
        <section id="settlement" className="max-w-7xl mx-auto px-6 pb-16">
          <div className="bg-slate-900 text-white rounded-xl p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight">
                Transparent Final Settlement & Printable PDF Reports
              </h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                At the end of every journey, TripMate reconciles verified contributions, assigned
                expense shares, personal payments, and completed reimbursements into clear transfer
                instructions and printable financial reports.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (currentUser ? onOpenDashboard() : onOpenAuth('login'))}
              className="px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              {currentUser ? 'Open My Workspace' : 'Try Demo Workspace'}
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span className="font-display font-semibold text-slate-900 text-sm">TripMate</span>
          <span>Group Trip Planning, Budget & Expense Management Platform</span>
        </div>
      </footer>
    </div>
  );
}
