'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';

const NAVY = '#1E4D8C';
const TEAL = '#2D9B8A';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n ?? 0);
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

export default function BranchAnalyticsPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.get('/orders/pharmacy-orders', { signal: controller.signal }),
      api.get('/attendance/summary',     { signal: controller.signal }),
    ])
      .then(([ordersRes, attRes]) => {
        setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data?.data ?? []);
        setAttendanceSummary(attRes.data);
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') console.error(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  // ── Compute stats from orders ──────────────────────────────────────────────
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const pendingOrders   = orders.filter(o => o.status === 'PENDING');
  const totalRevenue    = completedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const avgOrderValue   = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  const statCards = [
    { icon: ShoppingCartIcon,  label: 'Total Orders',     value: orders.length,               dark: false },
    { icon: CheckCircleIcon,   label: 'Completed Orders', value: completedOrders.length,       dark: false },
    { icon: CurrencyDollarIcon,label: 'Total Revenue',    value: `RWF ${fmt(totalRevenue)}`,   dark: false },
    { icon: ArrowTrendingUpIcon,label: 'Avg Order Value', value: `RWF ${fmt(avgOrderValue)}`,  dark: true  },
  ];

  // ── Revenue by day (last 14 days) ──────────────────────────────────────────
  const last14: { label: string; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dateStr = d.toISOString().split('T')[0];
    const revenue = completedOrders
      .filter(o => o.createdAt?.startsWith(dateStr))
      .reduce((sum, o) => sum + (o.total ?? 0), 0);
    last14.push({ label, revenue });
  }

  // ── Order status breakdown ─────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    status: status.replace(/_/g, ' '),
    count,
  }));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 lg:p-8 text-white" style={{ backgroundColor: NAVY }}>
        <h1 className="text-2xl lg:text-3xl font-bold">{t('analytics.branchAnalytics')}</h1>
        <p className="mt-1 text-white/70">{t('analytics.branchPerformance')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-2xl p-5 flex items-center justify-between"
              style={{ backgroundColor: s.dark ? NAVY : TEAL }}
            >
              <div>
                <p className="text-white/80 text-sm">{s.label}</p>
                <p className="text-white text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/15">
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Attendance summary cards */}
      {attendanceSummary && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Attendance — Today</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t('extras.analytics.activeShifts'), value: attendanceSummary.approved  ?? 0 },
              { label: t('orderStatus.pending'),          value: attendanceSummary.pending   ?? 0 },
              { label: t('dashboard.completed'),          value: attendanceSummary.completed ?? 0 },
              { label: t('extras.branch.hoursWorked'),    value: `${(attendanceSummary.totalHoursWorked ?? 0).toFixed(1)}h` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F0F7F6' }}>
                  <ClockIcon className="w-5 h-5" style={{ color: TEAL }} />
                </div>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue trend chart */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-1">{t('analytics.revenueTrend')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('analytics.last14Days')}</p>
        {last14.some(d => d.revenue > 0) ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={last14} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={52} />
              <Tooltip content={<RevenueTooltip />} />
              <Line type="monotone" dataKey="revenue" name={t('extras.analytics.revenueChartLabel')} stroke={TEAL} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
            No completed orders in the last 14 days
          </div>
        )}
      </div>

      {/* Order status breakdown */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-1">{t('analytics.ordersByStatus')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('analytics.allTimeBreakdown')}</p>
        {statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" name={t('extras.analytics.ordersChartLabel')} fill={NAVY} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
            No orders yet
          </div>
        )}
      </div>
    </div>
  );
}
