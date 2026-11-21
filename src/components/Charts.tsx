import { useState } from 'react';
import { formatCurrency } from '../lib/calculations.ts';
import type {
  CategoryBreakdownItem,
  MemberFinancialSummary,
} from '../lib/tripmate-types.ts';

export function CategoryDonutChart({
  categories,
  totalExpense,
  currency,
}: {
  categories: CategoryBreakdownItem[];
  totalExpense: number;
  currency: string;
}) {
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  if (categories.length === 0 || totalExpense <= 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">
        No approved expenses recorded yet.
      </div>
    );
  }

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  const activeItem =
    categories.find((c) => c.category === hoveredCat) ?? categories[0];

  return (
    <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-12">
      <div className="relative flex items-center justify-center sm:col-span-5">
        <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="20"
          />
          {categories.map((cat) => {
            const sliceLength = (cat.percentage / 100) * circumference;
            const dashOffset = -(cumulativePercent / 100) * circumference;
            cumulativePercent += cat.percentage;
            const isHovered = hoveredCat === cat.category;

            return (
              <circle
                key={cat.category}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={cat.color}
                strokeWidth={isHovered ? 24 : 20}
                strokeDasharray={`${Math.max(0, sliceLength - 1.5)} ${circumference}`}
                strokeDashoffset={dashOffset}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredCat(cat.category)}
                onMouseLeave={() => setHoveredCat(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[90px] truncate text-[11px] font-medium text-slate-500">
            {hoveredCat ? activeItem.category : 'Total Spent'}
          </span>
          <span className="mt-0.5 font-mono-num text-sm font-bold text-[#0F2744]">
            {formatCurrency(
              hoveredCat ? activeItem.amount : totalExpense,
              currency,
            )}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 sm:col-span-7">
        {categories.map((cat) => (
          <div
            key={cat.category}
            onMouseEnter={() => setHoveredCat(cat.category)}
            onMouseLeave={() => setHoveredCat(null)}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors cursor-default ${
              hoveredCat === cat.category ? 'bg-slate-100' : ''
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: cat.color }}
              />
              <span className="truncate font-medium text-slate-700">
                {cat.category}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono-num text-xs">
              <span className="text-slate-500">
                {cat.percentage.toFixed(1)}%
              </span>
              <span className="font-semibold text-[#0F2744]">
                {formatCurrency(cat.amount, currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemberContributionChart({
  summaries,
  currency,
}: {
  summaries: MemberFinancialSummary[];
  currency: string;
}) {
  if (summaries.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">
        Add trip members to view contribution and spend progress.
      </div>
    );
  }

  const maxValue = Math.max(
    1,
    ...summaries.map((s) =>
      Math.max(s.assignedBudget, s.totalContributed, s.allocatedExpenseShare),
    ),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0F2744]" />
          <span>Total Contributed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" />
          <span>Allocated Expense Share</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
          <span>Assigned Budget</span>
        </div>
      </div>

      <div className="space-y-3.5">
        {summaries.map((ms) => {
          const contribPct = Math.min(
            100,
            (ms.totalContributed / maxValue) * 100,
          );
          const sharePct = Math.min(
            100,
            (ms.allocatedExpenseShare / maxValue) * 100,
          );
          const budgetPct = Math.min(100, (ms.assignedBudget / maxValue) * 100);

          return (
            <div key={ms.member.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800 truncate max-w-[170px]">
                  {ms.member.memberName}
                </span>
                <span className="font-mono-num text-slate-600">
                  {formatCurrency(ms.totalContributed, currency)} paid ·{' '}
                  {formatCurrency(ms.allocatedExpenseShare, currency)} share
                </span>
              </div>
              <div className="relative h-4 w-full overflow-hidden rounded bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 bg-slate-200/80"
                  style={{ width: `${budgetPct}%` }}
                  title={`Assigned Budget: ${formatCurrency(ms.assignedBudget, currency)}`}
                />
                <div
                  className="absolute top-0.5 h-1.5 rounded-r bg-[#0F2744] transition-all"
                  style={{ width: `${contribPct}%` }}
                />
                <div
                  className="absolute bottom-0.5 h-1.5 rounded-r bg-teal-600 transition-all"
                  style={{ width: `${sharePct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
