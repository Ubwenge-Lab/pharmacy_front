'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, Package, Users, BarChart2,
  Activity, GitBranch, DollarSign, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const TEAL  = '#2D9B8A';
const NAVY  = '#1E4D8C';
const BRANCH_COLORS = ['#2D9B8A', '#1E4D8C', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981'];

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
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(value)}%
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 bg-white border border-gray-100 animate-pulse space-y-3">
      <div className="w-8 h-8 rounded-xl bg-gray-100" />
      <div className="h-3 w-24 bg-gray-100 rounded" />
      <div className="h-6 w-20 bg-gray-200 rounded" />
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
        <Activity size={28} className="mx-auto text-gray-200" />
        <p>{t('dashboard.noDataYet')}</p>
      </div>
    </div>
  );
}

// Custom tooltip for charts
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

  const [stats,         setStats]         = useState<any>(null);
  const [analytics,     setAnalytics]     = useState<any>(null);
  const [dailyRevenue,  setDailyRevenue]  = useState<any>(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);

  // Which branches to show on charts (multi-select)
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [revenueView, setRevenueView] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    const controller = new AbortController();
    const s = controller.signal;

    Promise.all([
      api.get('/pharmacies/dashboard/stats',          { signal: s }),
      api.get('/pharmacies/dashboard/analytics',      { signal: s }),
      api.get('/pharmacies/dashboard/daily-revenue',  { signal: s }),
      api.get('/pharmacies/dashboard/weekly-revenue', { signal: s }),
    ])
      .then(([sRes, aRes, dRes, wRes]) => {
        const st = sRes.data?.data  ?? sRes.data;
        const an = aRes.data?.data  ?? aRes.data;
        const dr = dRes.data?.data  ?? dRes.data;
        const wr = wRes.data?.data  ?? wRes.data;
        setStats(st);
        setAnalytics(an);
        setDailyRevenue(dr);
        setWeeklyRevenue(wr);
        // Default: select all branches
        const names = (dr?.branchDaily ?? []).map((b: any) => b.branchName);
        setSelectedBranches(names);
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-8 animate-pulse bg-gray-200 h-28" />
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
        <div className="rounded-2xl p-8 text-white" style={{ backgroundColor: NAVY }}>
          <h1 className="text-3xl font-bold">{t('pharmacyOwner.ownerOverview')}</h1>
          <p className="mt-1 text-white/70">{t('pharmacyOwner.ownerOverviewSubtitle')}</p>
        </div>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Could not load dashboard data. Check your connection and refresh.
        </div>
      </div>
    );
  }

  // ── Data mapping ──────────────────────────────────────────────────────────
  const overviewCards = [
    { icon: GitBranch,     label: t('pharmacyOwner.totalBranches'),  value: stats?.totalBranches  ?? 0, dark: false },
    { icon: Users,         label: t('pharmacyOwner.totalEmployees'), value: stats?.totalEmployees ?? 0, dark: false },
    { icon: DollarSign,    label: t('pharmacyOwner.monthlyRevenue'), value: `RWF ${fmt(stats?.monthlyRevenue ?? 0)}`, dark: false },
    { icon: AlertTriangle, label: t('pharmacyOwner.totalRevenue'),  value: `RWF ${fmt(stats?.totalRevenue   ?? 0)}`, dark: true  },
  ];

  const analyticsCards = [
    { icon: TrendingUp, label: t('pharmacyOwner.monthlyRevenue'),  value: `RWF ${fmt(analytics?.totalRevenue  ?? 0)}`, change: analytics?.revenueChange   },
    { icon: BarChart2,  label: t('extras.analytics.monthlyOrders'), value: analytics?.totalOrders  ?? 0,               change: analytics?.ordersChange    },
    { icon: DollarSign, label: t('extras.analytics.avgOrderValue'), value: `RWF ${fmt(analytics?.avgOrderValue ?? 0)}`, change: analytics?.avgValueChange  },
    { icon: Package,    label: t('extras.analytics.itemsSold'),     value: analytics?.itemsSold    ?? 0,               change: analytics?.itemsChange     },
  ];

  const alerts:                 any[]  = stats?.alerts               ?? [];
  const revenueByBranch:        any[]  = stats?.revenueByBranch      ?? [];
  const inventoryDistribution:  any[]  = stats?.inventoryDistribution ?? [];

  // ── Branch revenue time-series ─────────────────────────────────────────
  // Build chart data from daily or weekly response
  const activeData     = revenueView === 'daily' ? dailyRevenue  : weeklyRevenue;
  const labelKey       = revenueView === 'daily' ? 'label'       : 'label';
  const rawLabels: string[]  = revenueView === 'daily'
    ? (dailyRevenue?.dailyTotal  ?? []).map((d: any) => d.label)
    : (weeklyRevenue?.weeklyTotal ?? []).map((d: any) => d.label);

  // Chart rows: one entry per time bucket, value per branch
  const branchTimeData: any[] = rawLabels.map((lbl, i) => {
    const row: any = { label: lbl };
    const branchArr = revenueView === 'daily'
      ? (dailyRevenue?.branchDaily  ?? [])
      : (weeklyRevenue?.branchWeekly ?? []);

    branchArr.forEach((b: any) => {
      if (selectedBranches.includes(b.branchName)) {
        row[b.branchName] = b.data[i]?.revenue ?? 0;
      }
    });
    return row;
  });

  // Pharmacy-wide total line
  const totalTimeData: any[] = revenueView === 'daily'
    ? (dailyRevenue?.dailyTotal   ?? []).map((d: any) => ({ label: d.label, revenue: d.revenue }))
    : (weeklyRevenue?.weeklyTotal ?? []).map((d: any) => ({ label: d.label, revenue: d.revenue }));

  const allBranchNames: string[] = revenueView === 'daily'
    ? (dailyRevenue?.branchDaily   ?? []).map((b: any) => b.branchName)
    : (weeklyRevenue?.branchWeekly ?? []).map((b: any) => b.branchName);

  const toggleBranch = (name: string) => {
    setSelectedBranches(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Tick sampling: for daily (30 points) show every 5th label to avoid crowding
  const tickInterval = revenueView === 'daily' ? 4 : 0;

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 lg:p-8 text-white" style={{ backgroundColor: NAVY }}>
        <h1 className="text-2xl lg:text-3xl font-bold">{t('pharmacyOwner.ownerOverview')}</h1>
        <p className="mt-1 text-white/70">{t('pharmacyOwner.ownerOverviewSubtitle')}</p>
      </div>

      {/* Alerts */}
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
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
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

      {/* Overview stat cards */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('dashboard.businessOverview')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="rounded-2xl p-5 flex items-center justify-between" style={{ backgroundColor: s.dark ? NAVY : TEAL }}>
                <div>
                  <p className="text-white/80 text-sm">{s.label}</p>
                  <p className="text-white text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/15">
                  <Icon size={22} className="text-white" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly performance cards */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('dashboard.monthlyPerformance')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analyticsCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F0F7F6' }}>
                  <Icon size={18} style={{ color: TEAL }} />
                </div>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                  {s.change !== undefined && <ChangeBadge value={s.change} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Daily / Weekly Revenue per Branch ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">{t('dashboard.revenuePerBranch')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Past 30 days, {revenueView === 'daily' ? t('pharmacyOwner.dayByDay') : t('pharmacyOwner.groupedByWeek')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Daily / Weekly toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setRevenueView('daily')}
                className={`px-3 py-1.5 rounded-md transition-all ${revenueView === 'daily' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('pharmacyOwner.daily')}
              </button>
              <button
                onClick={() => setRevenueView('weekly')}
                className={`px-3 py-1.5 rounded-md transition-all ${revenueView === 'weekly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('pharmacyOwner.weekly')}
              </button>
            </div>
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

        {/* Chart */}
        {branchTimeData.length > 0 && selectedBranches.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={branchTimeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => fmt(v)}
                width={52}
              />
              <Tooltip content={<RevenueTooltip />} />
              {selectedBranches.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={BRANCH_COLORS[allBranchNames.indexOf(name) % BRANCH_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState />}
      </div>

      {/* ── Pharmacy-wide total revenue trend (30-day) ─────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-800">{t('dashboard.totalRevenueTrend')}</h3>
          <p className="text-xs text-gray-400 mt-0.5">All branches combined, past 30 days ({revenueView === 'daily' ? 'daily' : 'weekly'})</p>
        </div>
        {totalTimeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={totalTimeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => fmt(v)}
                width={52}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="revenue" name={t('pharmacyOwner.totalRevenue')} fill={TEAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState />}
      </div>

      {/* ── Revenue by branch (this month) + Inventory distribution ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">{t('pharmacyOwner.revenueByBranch')} (This Month)</h3>
          {revenueByBranch.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByBranch} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={52} />
                <Tooltip content={<RevenueTooltip />} />
                <Bar dataKey="revenue" name={t('extras.analytics.revenueChartLabel')} fill={NAVY} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">{t('pharmacyOwner.inventoryDistribution')}</h3>
          {inventoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={inventoryDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {inventoryDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} SKUs`, 'Medications']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </div>

    </div>
  );
}
