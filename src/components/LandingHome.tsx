import { useState } from 'react';
import { ArrowRight, CheckCircle2, Download, FileText, ShieldCheck, Wallet } from 'lucide-react';

interface LandingHomeProps {
  onSignIn: () => Promise<void>;
  signingIn: boolean;
  authError: string | null;
}

const SAMPLE_EXPENSES = [
  {
    id: 'coach',
    title: 'AC Sleeper Coach Tickets',
    category: 'Transportation',
    paidBy: 'Group Fund',
    participants: 'All 5 Members (Equal)',
    amount: 4500,
    perMember: '900 BDT each',
  },
  {
    id: 'dinner',
    title: 'Marine Drive Seafood Dinner',
    category: 'Meals',
    paidBy: 'Rafiq (Personal Advance)',
    participants: '4 of 5 Members (Nadia skipped)',
    amount: 1600,
    perMember: '400 BDT · Nadia 0',
  },
  {
    id: 'water',
    title: 'Inani Parasailing & Kayak',
    category: 'Tickets & Entrance Fees',
    paidBy: 'Tasnim (Personal Advance)',
    participants: 'Custom Split (3 Members)',
    amount: 1450,
    perMember: '600 / 600 / 250 BDT',
  },
];

export function LandingHome({
  onSignIn,
  signingIn,
  authError,
}: LandingHomeProps) {
  const [selectedSample, setSelectedSample] = useState<string>('dinner');
  const activeSample =
    SAMPLE_EXPENSES.find((item) => item.id === selectedSample) ??
    SAMPLE_EXPENSES[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones, gap-8, single-line wordmark, nav links, 1 primary CTA */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-[#0F2744] whitespace-nowrap shrink-0"
          >
            TripMate
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#capabilities"
              className="hover:text-[#0F2744] transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="hover:text-[#0F2744] transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#ledger-preview"
              className="hover:text-[#0F2744] transition-colors whitespace-nowrap shrink-0"
            >
              Settlement Math
            </a>
            <a
              href="#roles"
              className="hover:text-[#0F2744] transition-colors whitespace-nowrap shrink-0"
            >
              Roles
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2744] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#173963] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{signingIn ? 'Signing in...' : 'Sign In with Google'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split */}
        <section className="mx-auto max-w-7xl px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-between lg:col-span-6">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  Group Trip Budget · Shared Expenses · Final Settlement
                </p>
                <h1
                  className="mt-4 font-display text-4xl font-bold tracking-tight text-[#0F2744] sm:text-5xl lg:leading-[1.12]"
                  style={{ textWrap: 'balance' }}
                >
                  Group trip budgets, shared splits, and clean settlements.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                  Track staggered member contributions, additional fund top-ups,
                  selective meal participation, and personal out-of-pocket
                  payments in one transparent financial workspace—then reconcile
                  every balance to zero.
                </p>

                {authError && (
                  <div
                    role="alert"
                    className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {authError}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={onSignIn}
                    disabled={signingIn}
                    className="inline-flex items-center gap-2.5 rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>
                      {signingIn
                        ? 'Connecting Account...'
                        : 'Continue with Google'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <a
                    href="#ledger-preview"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 whitespace-nowrap shrink-0"
                  >
                    Inspect Settlement Math
                  </a>
                  <a
                    href="/api/export-project-zip"
                    download="tripmate-full-project.zip"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#0F2744] transition-colors hover:border-teal-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Download className="h-4 w-4 text-teal-700" />
                    <span>Download Project (.zip)</span>
                  </a>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-6">
                <div>
                  <p className="font-mono-num text-xl font-semibold text-[#0F2744]">
                    3 Split Modes
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Equal, custom, and individual
                  </p>
                </div>
                <div>
                  <p className="font-mono-num text-xl font-semibold text-[#0F2744]">
                    2 Fund Sources
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Group cash pool vs personal advance
                  </p>
                </div>
                <div>
                  <p className="font-mono-num text-xl font-semibold text-[#0F2744]">
                    1-Click PDF
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Category and member settlement report
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:h-96 lg:h-full">
                <img
                  src="/src/assets/images/hero_group_travel_1795201699439.jpg"
                  alt="Coastal mountain highway overlooking turquoise ocean waters at golden hour"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-6 text-white">
                  <p className="text-xs font-medium text-teal-300">
                    Sample Active Ledger · Cox&apos;s Bazar Coastal Retreat
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    5 Travelers · 12,500 BDT Collected · 12,000 BDT Spent · 500
                    BDT Cash Remaining
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-column mechanism strip */}
          <div
            id="capabilities"
            className="mt-14 grid grid-cols-1 gap-6 border-t border-slate-200 pt-10 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <p className="text-xs font-semibold text-teal-700">
                01. Staggered Deposits
              </p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#0F2744]">
                Initial &amp; Additional Budgets
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Record partial initial deposits as members pay at different
                times, and log mid-trip top-ups separately from the original
                budget.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-700">
                02. Selective Participation
              </p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#0F2744]">
                Fair Expense Splitting
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Exclude members who skipped a meal or excursion, assign custom
                amounts per person, or log single-member expenses cleanly.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-700">
                03. Personal Advances
              </p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#0F2744]">
                Reimbursement Tracking
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Separate group cash from out-of-pocket card payments so payers
                are reimbursed accurately without distorting the cash pool.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-700">
                04. End-of-Trip Audit
              </p>
              <h2 className="mt-1.5 font-display text-base font-semibold text-[#0F2744]">
                Automated Settlement &amp; PDF
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Compute exact payable and refundable balances for every member
                and export a complete category and settlement PDF report.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Settlement Math Preview */}
        <section
          id="ledger-preview"
          className="border-y border-slate-200 bg-white py-16"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <p className="text-sm font-medium text-teal-700">
                  Interactive Financial Formula
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F2744]">
                  Every BDT reconciles across contributions, advances, and
                  shares.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  TripMate records each expense once regardless of who paid the
                  bill, keeps personal advances separate from group cash, and
                  evaluates each traveler&apos;s balance using one auditable
                  equation:
                </p>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold text-slate-500">
                    Member Settlement Balance Equation
                  </p>
                  <p className="mt-2 font-mono-num text-sm font-medium text-[#0F2744] leading-relaxed">
                    Balance = Contributions + Personal Advances − Expense Shares
                    − Reimbursements − Refunds
                  </p>
                  <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-200 pt-3 text-xs text-slate-600">
                    <span>Positive (+) = Entitled to receive</span>
                    <span>Negative (−) = Owes group</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="font-display text-base font-semibold text-[#0F2744]">
                        Click an expense scenario to inspect split logic
                      </h3>
                      <p className="text-xs text-slate-500">
                        Demonstrating equal, non-participating, and custom splits
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                      {SAMPLE_EXPENSES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedSample(item.id)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            selectedSample === item.id
                              ? 'bg-white text-[#0F2744] shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {item.category.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="border-b border-slate-100 pb-3 sm:border-b-0 sm:border-r sm:pr-4">
                      <p className="text-xs text-slate-500">Expense Entry</p>
                      <p className="mt-1 font-display text-lg font-semibold text-[#0F2744]">
                        {activeSample.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {activeSample.category} · {activeSample.paidBy}
                      </p>
                    </div>
                    <div className="sm:pl-2">
                      <p className="text-xs text-slate-500">
                        Allocation Result
                      </p>
                      <p className="mt-1 font-mono-num text-lg font-semibold text-teal-700">
                        {activeSample.amount.toLocaleString()} BDT
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {activeSample.participants} · {activeSample.perMember}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow & Roles */}
        <section id="workflow" className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="text-sm font-medium text-teal-700">
                End-to-End Trip Lifecycle
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-[#0F2744]">
                From initial budget to final settlement in four organized phases
              </h2>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <Wallet className="h-5 w-5 text-teal-600" />
                  <h3 className="mt-3 font-display text-base font-semibold text-[#0F2744]">
                    01. Setup &amp; Member Budgets
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Create a trip, assign per-member budgets, and track who has
                    deposited initial funds versus pending dues.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                  <h3 className="mt-3 font-display text-base font-semibold text-[#0F2744]">
                    02. Live Expense Logging
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Log transport, stays, meals, and tickets as group fund
                    spends or personal advances with exact participant lists.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <ShieldCheck className="h-5 w-5 text-teal-600" />
                  <h3 className="mt-3 font-display text-base font-semibold text-[#0F2744]">
                    03. Admin Verification &amp; Payouts
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Approve member-submitted expenses and settle pending
                    reimbursements directly from the remaining group pool.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <FileText className="h-5 w-5 text-teal-600" />
                  <h3 className="mt-3 font-display text-base font-semibold text-[#0F2744]">
                    04. Settlement &amp; PDF Archive
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Review net balances, distribute remaining cash, mark members
                    settled, and download the official PDF summary.
                  </p>
                </div>
              </div>
            </div>

            <div id="roles" className="lg:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-[#0F2744] p-7 text-white">
                <p className="text-xs font-medium text-teal-300">
                  Role-Based Access Control
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold">
                  Built for Trip Administrators &amp; Group Members
                </h2>
                <div className="mt-6 space-y-5 border-t border-white/15 pt-5 text-sm">
                  <div>
                    <h3 className="font-semibold text-white">
                      Trip Administrator
                    </h3>
                    <p className="mt-1 text-slate-300">
                      Creates trips, manages members and budgets, approves
                      member-submitted entries, pays reimbursements, and
                      finalizes settlements.
                    </p>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="font-semibold text-white">Group Member</h3>
                    <p className="mt-1 text-slate-300">
                      Views trip balances, checks individual expense shares,
                      submits personal advances or contributions for approval,
                      and downloads settlement reports.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={signingIn}
                  className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-60 cursor-pointer"
                >
                  <span>
                    {signingIn
                      ? 'Opening Google Sign-In...'
                      : 'Sign In to Open TripMate Workspace'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-slate-500">
          <span>
            TripMate — Group Trip Budget, Expense Sharing &amp; Settlement
            Management System
          </span>
          <span>PostgreSQL Relational Ledger · Authenticated Workspace</span>
        </div>
      </footer>
    </div>
  );
}
