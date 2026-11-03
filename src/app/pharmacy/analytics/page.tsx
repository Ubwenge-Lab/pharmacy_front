'use client';

import { formatCurrency } from '@/lib/currency';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { unwrapItem } from '@/lib/api';
import { abortable } from '@/lib/requestCache';
import { fetchPharmacyStats, fetchPharmacyAnalytics } from '@/services/pharmacyDashboard';
import type { PharmacyAnalytics, PharmacyStats } from '@/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const DONUT_COLORS = ['#2563EB', '#60A5FA', '#6B84A8', '#8B5CF6', '#EF4444'];

const MOCK_ANALYTICS = {
  totalRevenue: 78000, totalOrders: 4, avgOrderValue: 20000, itemsSold: 46,
  revenueChange: 12,   ordersChange: -8, avgValueChange: 4,  targetRevenue: 85000,
};
const MOCK_STATS = {
  revenueByBranch: [
    { name: 'MedPlus Main',     revenue: 58500, percentage: 75 },
    { name: 'Remera Pharmacy',  revenue: 19500, percentage: 25 },
  ],
  monthlyComparison: [
    { name: 'MedPlus Main', revenue: 58500 },
    { name: 'Kimironko',     revenue: 12000 },
    { name: 'Remera',       revenue: 19500 },
  ],
  revenueOverTime: {
    '3M': [
      { month: 'Feb', revenue: 40000 },
      { month: 'Mar', revenue: 48000 },
      { month: 'Apr', revenue: 58000 },
    ],
    '6M': [
      { month: 'Nov', revenue: 28000 },
      { month: 'Dec', revenue: 35000 },
      { month: 'Jan', revenue: 31000 },
      { month: 'Feb', revenue: 40000 },
      { month: 'Mar', revenue: 48000 },
      { month: 'Apr', revenue: 58000 },
    ],
    '1Y': [
      { month: 'May', revenue: 20000 },
      { month: 'Jun', revenue: 24000 },
      { month: 'Jul', revenue: 22000 },
      { month: 'Aug', revenue: 30000 },
      { month: 'Sep', revenue: 27000 },
      { month: 'Oct', revenue: 33000 },
      { month: 'Nov', revenue: 28000 },
      { month: 'Dec', revenue: 35000 },
      { month: 'Jan', revenue: 31000 },
      { month: 'Feb', revenue: 40000 },
      { month: 'Mar', revenue: 48000 },
      { month: 'Apr', revenue: 58000 },
    ],
  },
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n ?? 0);
};

const currentMonthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

// ── Donut legend ──────────────────────────────────────────────────────────────
function DonutLegend({ data }: { data: { name: string; percentage: number }[] }) {

  const BADGE_BG_COLORS = ['#EBF5FF', '#F0FDF4', '#F3F4F6', '#F5F3FF', '#FEF2F2'];
  const BADGE_TEXT_COLORS = ['#2563EB', '#334155', '#4B5563', '#7C3AED', '#DC2626'];

  return (
    <div className="flex flex-col gap-2 mt-2">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2 text-sm">
          <span 
            className="w-3 h-3 rounded-sm shrink-0" 
            style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} 
          />
          <span className="text-gray-600 flex-1">{d.name}</span>
          
          {/* Dynamically style the background and text color based on index */}
          <span 
            className="px-2 py-0.5 text-xs font-semibold rounded-md min-w-[38px] text-center"
            style={{ 
              backgroundColor: BADGE_BG_COLORS[i % BADGE_BG_COLORS.length],
              color: BADGE_TEXT_COLORS[i % BADGE_TEXT_COLORS.length]
            }}
          >
            {d.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Progress row (Monthly Summary) ───────────────────────────────────────────
function ProgressRow({ label, sub, change, color }: { label: string; sub: string; change: number; color: string }) {
  const pct    = Math.min(Math.abs(change), 100);
  const isPos  = change >= 0;
  const sign   = isPos ? '+' : '';
  const clr    = isPos ? '#2563EB' : '#DC2626';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
        <span className="text-sm font-bold" style={{ color: clr }}>{sign}{change}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subColor, icon }: {
  label: string; value: string | number; sub: string; subColor?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm border border-gray-100">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-brand-navy/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs mt-0.5" style={{ color: subColor ?? '#6B7280' }}>{sub}</p>
      </div>
    </div>
  );
}

export default function PharmacyAnalyticsPage() {
  const { t } = useTranslation();
  const [loading,   setLoading]   = useState(true);
  const [analytics, setAnalytics] = useState<PharmacyAnalytics | null>(null);
  const [stats,     setStats]     = useState<PharmacyStats | null>(null);
  const [trendTab,  setTrendTab]  = useState<'3M' | '6M' | '1Y'>('6M');

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      abortable(fetchPharmacyAnalytics(), ctrl.signal),
      abortable(fetchPharmacyStats(), ctrl.signal),
    ])
      .then(([aRes, sRes]) => {
        setAnalytics(unwrapItem<PharmacyAnalytics>(aRes));
        setStats(unwrapItem<PharmacyStats>(sRes));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  const a = { ...MOCK_ANALYTICS, ...analytics };
  const s = {
    revenueByBranch:    stats?.revenueByBranch    ?? MOCK_STATS.revenueByBranch,
    monthlyComparison:  stats?.revenueByBranch    ?? MOCK_STATS.revenueByBranch,
    revenueOverTime:    stats?.revenueOverTime     ?? MOCK_STATS.revenueOverTime,
  };

  // Handle flat array from API — map to 6M bucket
  const trendData: any[] = Array.isArray(s.revenueOverTime)
    ? s.revenueOverTime
    : (s.revenueOverTime[trendTab] ?? MOCK_STATS.revenueOverTime['6M']);

  // Build donut data (percentage field might not exist — derive from revenue)
  const totalBranchRevenue = s.revenueByBranch.reduce((sum: number, b: any) => sum + (b.revenue ?? 0), 0);
  const donutData = s.revenueByBranch.map((b: any) => ({
    name:       b.name,
    revenue:    b.revenue ?? 0,
    percentage: b.percentage ?? (totalBranchRevenue ? Math.round((b.revenue / totalBranchRevenue) * 100) : 0),
  }));

  const latestRevenue = fmt(trendData[trendData.length - 1]?.revenue ?? 0);

  const statCards = [
    {
      label: t('analytics.totalRevenue'),
      value: formatCurrency(a.totalRevenue),
      sub:   a.revenueChange != null ? `${a.revenueChange > 0 ? '+' : ''}${a.revenueChange}% ${t('analytics.vsLastMonth')}` : t('analytics.thisMonth'),
      subColor: a.revenueChange > 0 ? '#16A34A' : a.revenueChange < 0 ? '#DC2626' : undefined,
      icon: <svg className="w-5 h-5" fill="none" stroke="#1E4D8C" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: t('analytics.totalOrders'),
      value: a.totalOrders ?? 0,
      sub:   t('analytics.thisMonth'),
      icon: <svg className="w-5 h-5" fill="none" stroke="#1E4D8C" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    },
    {
      label: t('analytics.avgOrderValue2'),
      value: formatCurrency(a.avgOrderValue),
      sub:   a.avgValueChange != null ? `${a.avgValueChange > 0 ? '+' : ''}${a.avgValueChange}%` : '',
      subColor: a.avgValueChange > 0 ? '#16A34A' : a.avgValueChange < 0 ? '#DC2626' : undefined,
      icon: <svg className="w-5 h-5" fill="none" stroke="#1E4D8C" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    },
    {
      label: t('analytics.itemsSold'),
      value: a.itemsSold ?? 0,
      sub:   t('analytics.units'),
      icon: <svg className="w-5 h-5" fill="none" stroke="#1E4D8C" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl px-6 py-5 flex items-center justify-between" style={{ background: '#E0F2FE' }}>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ color: '#1E3A8A' }}>{t('analytics.analyticsTitle')}</h1>
          <p className="text-sm text-white/60 mt-0.5" style={{ color: '#38BDF8'}}>{t('analytics.trackPerformance')}</p>
          
          <button className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0284C7] to-[#38BDF8] hover:opacity-90 transition">
          <CalendarDaysIcon className="w-4 h-4 text-white/60" />
          {t('analytics.thisMonth')}
        </button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} subColor={c.subColor} icon={c.icon} />
        ))}
      </div>

      {/* ── Charts Row 1: Donut + Bar ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Donut — Inventory Distribution / Revenue by branch */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-0.5">{t('analytics.inventoryDistribution')}</p>
          <h2 className="text-base font-bold text-gray-900 mb-4">{t('analytics.revenueByBranch')}</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="revenue" paddingAngle={3}>
                  {donutData.map((_: any, i: number) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [formatCurrency(v), '']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
            <DonutLegend data={donutData} />
          </div>
        </div>

        {/* Bar — Monthly Comparison */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-0.5">{t('analytics.monthlyComparison')}</p>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">{t('analytics.revenueByBranch')}</h2>
            <span className="text-xs text-blue-500 font-medium">{currentMonthLabel}</span>
          </div>
          {s.revenueByBranch.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={s.revenueByBranch} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), '']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {s.revenueByBranch.map((_: any, i: number) => (
                    <Cell key={i} fill={i === 0 ? '#1746A2' : '#6B84A8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">{t('analytics.noDataYet')}</div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Summary + Revenue Trend ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Monthly Performance Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-0.5">{t('analytics.monthlyPerformance')}</p>
          <h2 className="text-base font-bold text-gray-900 mb-5">{t('analytics.summary')}</h2>
          <div className="space-y-4">
            <ProgressRow
              label={t('analytics.revenueGrowth')}
              sub={`${formatCurrency(a.totalRevenue)} ${t('analytics.vsLastMonth')}`}
              change={a.revenueChange ?? 0}
              color="#1E4D8C"
            />
            <ProgressRow
              label={t('analytics.orderGrowth')}
              sub={`${a.totalOrders ?? 0} ${t('analytics.totalOrders').toLowerCase()} ${t('analytics.thisMonth').toLowerCase()}`}
              change={a.ordersChange ?? 0}
              color="#2D9B8A"
            />
            <ProgressRow
              label={t('analytics.avgOrderValue2')}
              sub={`${formatCurrency(a.avgOrderValue)} avg`}
              change={a.avgValueChange ?? 0}
              color="#1E4D8C"
            />
          </div>

          {a.targetRevenue && (
        <div className="mt-5 flex items-center gap-3 text-xs text-gray-500">
          {/* The Exclamation Badge Icon Component */}
          <div className="w-7 h-7 rounded-lg bg-blue-50/80 flex items-center justify-center text-blue-600 shrink-0">
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2.5} 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 9v4m0 4h.01"              />
            </svg>
          </div>
          
          {/* The Text Field */}
          <div className="leading-tight">
            {t('analytics.onTrackToHit')}{' '}
            <span className="font-bold text-gray-900">{formatCurrency(a.targetRevenue)}</span>{' '}
            {t('analytics.thisMonthDot')}
          </div>
        </div>
          )}
        </div>

        {/* Revenue Trend */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500 mb-0.5">{t('analytics.revenueTrend')}</p>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              {trendTab === '1Y' ? t('analytics.last12Months') : trendTab === '6M' ? t('analytics.last6Months') : t('analytics.last3Months')}
            </h2>
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              {(['3M', '6M', '1Y'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTrendTab(tab)}
                  className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                  style={trendTab === tab
                    ? { backgroundColor: '#fff', color: '#1E4D8C', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { color: '#9CA3AF' }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), '']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#2D9B8A" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#2D9B8A' }} />
              </LineChart>
            </ResponsiveContainer>
            {/* Annotation badge */}
            <div
              className="absolute bottom-8 right-4 px-3 py-1 rounded-full text-white text-xs font-bold shadow-md pointer-events-none bg-brand-navy"
            >
              {latestRevenue} {t('analytics.made')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
