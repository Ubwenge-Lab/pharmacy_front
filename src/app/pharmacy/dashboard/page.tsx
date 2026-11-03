'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import {
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, UsersIcon,
  BoltIcon, BuildingOffice2Icon, CurrencyDollarIcon, ExclamationTriangleIcon, CalendarIcon, Bars3BottomLeftIcon,
} from '@heroicons/react/24/outline';
import api, { unwrapItem } from '@/lib/api';
import { abortable } from '@/lib/requestCache';
import { fetchPharmacyStats, fetchPharmacyAnalytics } from '@/services/pharmacyDashboard';
import type { PharmacyStats, PharmacyAnalytics, DailyRevenue, WeeklyRevenue, PharmacyProfile } from '@/types';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const BLUE  = '#1B72C8';
const BRANCH_COLORS = ['#2D9B8A', '#1E4D8C', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981'];
const SPARKLINE_COLORS = ['#2D9B8A', '#2D9B8A', '#F59E0B', '#10B981'];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n ?? 0);
}

function ChangeBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: up ? '#D1FAE5' : '#FEF3C7', color: up ? '#065F46' : '#92400E' }}
    >
      {up ? <ArrowTrendingUpIcon className="w-[11px] h-[11px]" /> : <ArrowTrendingDownIcon className="w-[11px] h-[11px]" />}
      {Math.abs(value)}%
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 bg-white border border-gray-100 animate-pulse space-y-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-gray-100" />
        <div className="h-7 w-20 bg-gray-200 rounded" />
      </div>
      <div className="h-3 w-28 bg-gray-100 rounded" />
      <div className="h-3 w-16 bg-gray-100 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return <div className="bg-white rounded-2xl border border-gray-100 animate-pulse h-72" />;
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
      <div className="text-center space-y-1">
        <BoltIcon className="w-7 h-7 mx-auto text-gray-200" />
        <p>{t('dashboard.noDataYet')}</p>
      </div>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: RWF {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function PharmacyDashboard() {
  const { t } = useTranslation();

  const [stats,         setStats]         = useState<PharmacyStats | null>(null);
  const [analytics,     setAnalytics]     = useState<PharmacyAnalytics | null>(null);
  const [dailyRevenue,  setDailyRevenue]  = useState<DailyRevenue | null>(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState<WeeklyRevenue | null>(null);
  const [profileInfo,   setProfileInfo]   = useState<PharmacyProfile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);

  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [revenueView, setRevenueView] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    const controller = new AbortController();
    const s = controller.signal;

    Promise.all([
      abortable(fetchPharmacyStats(), s),
      abortable(fetchPharmacyAnalytics(), s),
      api.get('/pharmacies/dashboard/daily-revenue',  { signal: s }),
      api.get('/pharmacies/dashboard/weekly-revenue', { signal: s }),
      api.get('/pharmacies/profile/me',               { signal: s }),
    ])
      .then(async ([sRes, aRes, dRes, wRes, pRes]) => {
        const st = unwrapItem<PharmacyStats>(sRes);
        const an = unwrapItem<PharmacyAnalytics>(aRes);
        const dr = unwrapItem<DailyRevenue>(dRes.data);
        const wr = unwrapItem<WeeklyRevenue>(wRes.data);
        let pr  = unwrapItem<PharmacyProfile>(pRes.data);

        // Workaround: backend sometimes omits representativeName — fall back to /users/me
        if (!pr?.representativeName) {
          try {
            const userRes  = await api.get('/users/me', { signal: s });
            const userData = unwrapItem(userRes.data) as any;
            if (userData?.profile?.firstName || userData?.firstName) {
              pr = {
                ...pr,
                ownerName: `${userData.profile?.firstName || userData.firstName || ''} ${userData.profile?.lastName || userData.lastName || ''}`.trim(),
              } as PharmacyProfile;
            }
          } catch { /**/ }
        }


        setStats(st);
        setAnalytics(an);
        setDailyRevenue(dr);
        setWeeklyRevenue(wr);
        setProfileInfo(pr);
        const names = (dr?.branchDaily ?? []).map((b: any) => b.branchName);
        setSelectedBranches(names);
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // ── Greeting ──────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dashboard.goodMorning')
    : hour < 18 ? t('dashboard.goodAfternoon')
    : t('dashboard.goodEvening');

  const ownerFullName  = profileInfo?.representativeName ?? profileInfo?.ownerName ?? '';
  const pharmacyName   = profileInfo?.name ?? '';
  // Extract last 1–2 words for greeting (e.g. "Dr. Jean Damascene" → "Dr. Damascene")
  const nameParts = ownerFullName.split(/\s+/).filter(Boolean);
  const greetingName = nameParts.length > 2
    ? [nameParts[0], nameParts[nameParts.length - 1]].join(' ')
    : ownerFullName;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-8 animate-pulse h-40" style={{ background: 'linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonChart /><SkeletonChart />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)' }}>
          <h1 className="text-3xl font-bold text-brand-navy">{t('pharmacyOwner.ownerOverview')}</h1>
          <p className="mt-1 text-gray-500 text-sm">{t('pharmacyOwner.ownerOverviewSubtitle')}</p>
        </div>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Could not load dashboard data. Check your connection and refresh.
        </div>
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const branchNames = (stats?.revenueByBranch ?? []).map((b: any) => b.name).slice(0, 3).join(' + ');

  const overviewCards = [
    {
      icon: BuildingOffice2Icon,
      accentColor: '#1E4D8C', iconLightBg: '#EEF2FF',
      label: t('pharmacyOwner.totalBranches'),
      value: stats?.totalBranches ?? 0,
      sub: branchNames ? `↗ ${branchNames}` : undefined,
      subColor: '#2D9B8A',
    },
    {
      icon: UsersIcon,
      accentColor: '#2D9B8A', iconLightBg: '#E0F7F4',
      label: t('pharmacyOwner.totalEmployees'),
      value: stats?.totalEmployees ?? 0,
      sub: `↗ ${t('pharmacyOwner.allActive')}`,
      subColor: '#2D9B8A',
    },
    {
      icon: CalendarIcon,
      accentColor: '#F59E0B', iconLightBg: '#FEF9E7',
      label: t('pharmacyOwner.monthlyRevenue'),
      value: `RWF ${fmt(stats?.monthlyRevenue ?? 0)}`,
      sub: `↗ ${t('analytics.thisMonth')}`,
      subColor: '#F59E0B',
    },
    {
      icon: CurrencyDollarIcon,
      accentColor: '#10B981', iconLightBg: '#E8FAF1',
      label: t('pharmacyOwner.totalRevenue'),
      value: `RWF ${fmt(stats?.totalRevenue ?? 0)}`,
      sub: `↗ ${t('pharmacyOwner.cumulativeRevenue')}`,
      subColor: '#10B981',
    },
  ];

  const analyticsCards = [
    { label: 'Monthly Revenue',  value: `RWF ${fmt(analytics?.totalRevenue  ?? 0)}`, sub: '↑ vs last month',  sparkColor: SPARKLINE_COLORS[0] },
    { label: 'Monthly Orders',   value: analytics?.totalOrders  ?? 0,                sub: 'Orders fulfilled', sparkColor: SPARKLINE_COLORS[1] },
    { label: 'Avg Order Value',  value: `RWF ${fmt(analytics?.avgOrderValue ?? 0)}`, sub: 'Per transaction',  sparkColor: SPARKLINE_COLORS[2] },
    { label: 'Items Sold',       value: analytics?.itemsSold    ?? 0,                sub: 'Units dispatched', sparkColor: SPARKLINE_COLORS[3] },
  ];

  const alerts:                any[]  = stats?.alerts               ?? [];
  const revenueByBranch:       any[]  = stats?.revenueByBranch      ?? [];
  const inventoryDistribution: any[]  = stats?.inventoryDistribution ?? [];
  const totalInventoryUnits           = inventoryDistribution.reduce((s: number, d: any) => s + (d.totalUnits ?? d.value ?? 0), 0);

  // ── Time-series charts ────────────────────────────────────────────────────
  const rawLabels: string[] = revenueView === 'daily'
    ? (dailyRevenue?.dailyTotal   ?? []).map((d: any) => d.label)
    : (weeklyRevenue?.weeklyTotal ?? []).map((d: any) => d.label);

  const branchTimeData: any[] = rawLabels.map((lbl, i) => {
    const row: any = { label: lbl };
    const branchArr = revenueView === 'daily'
      ? (dailyRevenue?.branchDaily   ?? [])
      : (weeklyRevenue?.branchWeekly ?? []);
    branchArr.forEach((b: any) => {
      if (selectedBranches.includes(b.branchName)) {
        row[b.branchName] = b.data[i]?.revenue ?? 0;
      }
    });
    return row;
  });

  const totalTimeData: any[] = revenueView === 'daily'
    ? (dailyRevenue?.dailyTotal   ?? []).map((d: any) => ({ label: d.label, revenue: d.revenue }))
    : (weeklyRevenue?.weeklyTotal ?? []).map((d: any) => ({ label: d.label, revenue: d.revenue }));

  const allBranchNames: string[] = revenueView === 'daily'
    ? (dailyRevenue?.branchDaily   ?? []).map((b: any) => b.branchName)
    : (weeklyRevenue?.branchWeekly ?? []).map((b: any) => b.branchName);

  const toggleBranch = (name: string) =>
    setSelectedBranches(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );

  const tickInterval = revenueView === 'daily' ? 4 : 0;

  return (
    <div className="space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 lg:p-10"
        style={{ background: 'linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)' }}
      >
        {/* ECG decoration */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none hidden lg:block">
          <svg width="200" height="90" viewBox="0 0 200 90" fill="none">
            <polyline
              points="0,45 28,45 42,10 58,80 72,26 84,45 110,45 124,45 138,10 154,80 168,26 180,45 200,45"
              stroke="#1E4D8C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        {pharmacyName && (
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-brand-teal">
            {pharmacyName} — {t('pharmacyOwner.role').toUpperCase()}
          </p>
        )}
        <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight text-brand-navy">
          {greeting},<br />{greetingName ? `${greetingName}.` : ''}
        </h1>
        <p className="mt-3 text-sm text-gray-500 max-w-md">{t('pharmacyOwner.performanceSubtitle')}</p>
        <Link href="/pharmacy/orders">
          <button
            className="mt-5 px-6 py-3 rounded-full text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
            style={{ backgroundColor: BLUE }}
          >
            <Bars3BottomLeftIcon className="w-[15px] h-[15px]" />
            {t('pharmacyOwner.viewAllOrders')}
          </button>
        </Link>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                backgroundColor: alert.level === 'warning' ? '#FEF3C7' : '#DBEAFE',
                color:           alert.level === 'warning' ? '#92400E' : '#1E40AF',
              }}
            >
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">{alert.branch}: </span>
                {alert.msg}
                {alert.meds && (
                  <span className="text-xs block mt-0.5 opacity-80">
                    {alert.meds.map((m: any) => `${m.name} (${m.quantity} left)`).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Overview stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="h-1.5" style={{ backgroundColor: s.accentColor }} />
              <div className="p-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: s.iconLightBg }}>
                  <Icon className="w-5 h-5" style={{ color: s.accentColor }} />
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-1">{s.value}</p>
                <p className="text-sm text-gray-600">{s.label}</p>
                {s.sub && <p className="text-xs font-medium mt-1.5" style={{ color: s.subColor ?? '#9CA3AF' }}>{s.sub}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Monthly performance cards ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('dashboard.monthlyPerformance')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analyticsCards.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mb-0.5">{s.value}</p>
              <p className="text-xs text-gray-500 mb-3">{s.sub}</p>
              {totalTimeData.length > 0 && (
                <ResponsiveContainer width="100%" height={40}>
                  <AreaChart data={totalTimeData.slice(-14)} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`sparkGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={s.sparkColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={s.sparkColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke={s.sparkColor} fill={`url(#sparkGrad-${i})`} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Revenue per Branch (time-series) ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">
              {t('dashboard.revenuePerBranch')} (Past 30 days)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {revenueView === 'daily' ? 'Day by day' : 'Grouped by week'}
            </p>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
            {(['daily', 'weekly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setRevenueView(v)}
                className={`px-3 py-1.5 rounded-md transition-all capitalize ${revenueView === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
        </div>

        {/* Branch filter pills */}
        {allBranchNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allBranchNames.map((name, i) => (
              <button
                key={name}
                onClick={() => toggleBranch(name)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedBranches.includes(name)
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
                style={selectedBranches.includes(name) ? { backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] } : {}}
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                {name}
              </button>
            ))}
          </div>
        )}

        {branchTimeData.length > 0 && selectedBranches.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={branchTimeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                {selectedBranches.map((name, i) => (
                  <linearGradient key={name} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BRANCH_COLORS[allBranchNames.indexOf(name) % BRANCH_COLORS.length]} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={BRANCH_COLORS[allBranchNames.indexOf(name) % BRANCH_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={52} />
              <Tooltip content={<RevenueTooltip />} />
              {selectedBranches.map((name, i) => {
                const colorIdx = allBranchNames.indexOf(name) % BRANCH_COLORS.length;
                return (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={BRANCH_COLORS[colorIdx]}
                    fill={`url(#grad-${i})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyState />}
      </div>

      {/* ── Total Revenue Trend + Revenue by Branch side-by-side ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Total Revenue Trend */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800">{t('dashboard.totalRevenueTrend')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              All branches, past 30 days ({revenueView === 'daily' ? 'daily' : 'weekly'})
            </p>
          </div>
          {totalTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={totalTimeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={52} />
                <Tooltip content={<RevenueTooltip />} />
                <Bar dataKey="revenue" name="Total Revenue" fill="#2D9B8A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>

        {/* Revenue by Branch — This Month (horizontal bars) */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {t('pharmacyOwner.revenueByBranch')} — This Month
          </h3>
          {revenueByBranch.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={revenueByBranch}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<RevenueTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#1E4D8C" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </div>

      {/* ── Inventory Distribution ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">{t('pharmacyOwner.inventoryDistribution')}</h3>
        {inventoryDistribution.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={220} height={220} minWidth={220}>
              <PieChart>
                <Pie
                  data={inventoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {inventoryDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => [`${v} SKUs`, 'Medications']}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="flex-1 space-y-3">
              {inventoryDistribution.map((item: any, i: number) => {
                const total = inventoryDistribution.reduce((s: number, d: any) => s + d.value, 0);
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name ?? i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm inline-block shrink-0"
                        style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
                      />
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{pct}%</span>
                  </div>
                );
              })}
              {totalInventoryUnits > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Total Units in Stock
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">
                    {totalInventoryUnits.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : <EmptyState />}
      </div>

    </div>
  );
}
