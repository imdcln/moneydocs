"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

interface CategoryBreakdown {
  _id: string;
  total: number;
  count: number;
}

interface DailyVelocity {
  day: number;
  total: number;
}

interface AnalyticsData {
  categoryBreakdown: CategoryBreakdown[];
  dailyVelocity: DailyVelocity[];
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
}

const PIE_COLORS = [
  "#10b981", "#06b6d4", "#8b5cf6", "#f59e0b",
  "#ef4444", "#ec4899", "#64748b", "#3b82f6",
  "#22c55e", "#a855f7", "#f97316", "#14b8a6",
];

const CATEGORY_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, { label: c.label, icon: c.icon }])
);

const formatIDRShort = (val: number): string => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold">{payload[0].name}</p>
      <p className="text-[var(--color-primary-light)]">Rp {payload[0].value.toLocaleString("id-ID")}</p>
    </div>
  );
};

export default function AnalyticsCharts({ monthYear }: { monthYear: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"pie" | "bar">("pie");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/analytics?monthYear=${monthYear}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [monthYear]);

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-48 animate-pulse" />
    );
  }

  if (!data || (data.categoryBreakdown.length === 0 && data.dailyVelocity.length === 0)) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-slate-500 text-sm">
        <p className="text-2xl mb-1">📊</p>
        <p>No data yet for this month</p>
      </div>
    );
  }

  const pieData = data.categoryBreakdown.map((c) => ({
    name: CATEGORY_MAP[c._id]?.label ?? c._id,
    value: c.total,
    icon: CATEGORY_MAP[c._id]?.icon ?? "📦",
  }));

  const barData = data.dailyVelocity.map((d) => ({
    day: `${d.day}`,
    expense: d.total,
  }));

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Tab switcher */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setView("pie")}
          className={`flex-1 py-3 text-xs font-semibold transition-colors ${
            view === "pie" ? "text-[var(--color-primary-light)] border-b-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          🍩 Categories
        </button>
        <button
          onClick={() => setView("bar")}
          className={`flex-1 py-3 text-xs font-semibold transition-colors ${
            view === "bar" ? "text-[var(--color-primary-light)] border-b-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          📊 Daily Trend
        </button>
      </div>

      <div className="p-4">
        {view === "pie" ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
              {pieData.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-slate-400 text-xs truncate">{item.icon} {item.name}</span>
                  </div>
                  <span className="text-white text-xs font-semibold">
                    Rp {formatIDRShort(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickFormatter={formatIDRShort}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white shadow-xl">
                      <p className="text-slate-400">Day {label}</p>
                      <p className="text-red-400 font-semibold">Rp {payload[0].value?.toLocaleString("id-ID")}</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
