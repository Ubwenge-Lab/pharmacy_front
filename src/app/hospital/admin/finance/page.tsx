'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BanknotesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import RevenueChart from '@/components/hospital/finance/RevenueChart';
import PaymentBreakdownChart from '@/components/hospital/finance/PaymentBreakdownChart';
import InvoiceTable from '@/components/hospital/finance/InvoiceTable';
import RefundTable from '@/components/hospital/finance/RefundTable';
import { useTranslation } from 'react-i18next';
import { useHospitalId, useHospitalDashboardStats } from '@/lib/hospital';
import api from '@/lib/api';
import type { InvoiceStatus } from '@/types/hospital';
import type { PaymentBreakdownItem } from '@/components/hospital/finance/PaymentBreakdownChart';
import type { RefundItem } from '@/components/hospital/finance/RefundTable';

const REFUNDS: RefundItem[] = [
  { id: 'RF-008', amount: 1_000, status: 'APPROVED', date: '2023-05-21' },
  { id: 'RF-007', amount: 17_000, status: 'REJECTED', date: '2023-05-19' },
  { id: 'RF-006', amount: 67_090, status: 'PENDING', date: '2023-05-10' },
  { id: 'RF-005', amount: 34_100, status: 'REJECTED', date: '2023-05-18' },
];

export default function HospitalAdminFinancePage() {
  const { t, i18n } = useTranslation();
  const hospitalId = useHospitalId();

  // Stats and Weekly Revenue via hook
  const { stats, weeklyRevenue, loading: statsLoading, error: statsError } = useHospitalDashboardStats(hospitalId);
  const dashError = statsError;

  // Invoices via independent useEffect
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState(false);
  const [isEndpointMissing, setIsEndpointMissing] = useState(false);

  useEffect(() => {
    if (!hospitalId) {
      setInvoicesLoading(false);
      return;
    }

    let active = true;
    setInvoicesLoading(true);
    setInvoicesError(false);
    setIsEndpointMissing(false);

    api.get(`/hospitals/${hospitalId}/invoices?limit=100`)
      .then((res) => {
        if (!active) return;
        const rawList = res.data?.data || res.data;
        if (Array.isArray(rawList)) {
          setInvoices(rawList);
        } else {
          setInvoices([]);
        }
        setInvoicesLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 404) {
          setIsEndpointMissing(true);
          setInvoices([]);
        } else {
          setInvoicesError(true);
        }
        setInvoicesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hospitalId]);

  // Map API invoices to local Invoice shape expected by InvoiceTable
  const mappedInvoices = useMemo(() => {
    return invoices.map((inv: any) => ({
      id: inv.id,
      patientName: inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : 'Unknown Patient',
      totalAmount: inv.totalAmount ?? 0,
      status: inv.paymentStatus as InvoiceStatus,
      dueDate: inv.issuedAt,
      createdAt: inv.issuedAt,
      appointmentId: inv.appointmentId,
    }));
  }, [invoices]);

  // Calculate dynamic pending payments metrics (from UNPAID and INSURANCE_PENDING)
  const pendingPaymentsValue = useMemo(() => {
    return invoices
      .filter((inv) => inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'INSURANCE_PENDING')
      .reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
  }, [invoices]);

  const pendingInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'INSURANCE_PENDING').length;
  }, [invoices]);

  // Calculate dynamic overdue payments metrics
  const overduePaymentsValue = useMemo(() => {
    return invoices
      .filter((inv) => inv.paymentStatus === 'UNPAID' && new Date(inv.issuedAt) < new Date())
      .reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
  }, [invoices]);

  const overdueInvoicesCount = useMemo(() => {
    return invoices.filter((inv) => inv.paymentStatus === 'UNPAID' && new Date(inv.issuedAt) < new Date()).length;
  }, [invoices]);

  const PAYMENT_BREAKDOWN: PaymentBreakdownItem[] = [
    { name: t('hospital.mobileMoney'), value: 1_530_769, color: '#1E4D8C' },
    { name: t('hospital.cash'), value: 2_037_670, color: '#93c5fd' },
  ];

  const FINANCE_KPIS = [
    {
      label: t('hospital.totalRevenue'),
      value: `RWF ${(stats?.totalRevenue ?? 0).toLocaleString(i18n.language || 'en')}`,
      sub: stats ? `${stats.totalAppointments?.allTime ?? 0} total appointments` : '—',
      trend: true,
      icon: <BanknotesIcon className="w-5 h-5" />,
      accentColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      loading: statsLoading,
    },
    {
      label: t('hospital.pendingPayments'),
      value: `RWF ${pendingPaymentsValue.toLocaleString(i18n.language || 'en')}`,
      sub: `${pendingInvoicesCount} ` + t('hospital.invoices'),
      trend: false,
      icon: <ExclamationTriangleIcon className="w-5 h-5" />,
      accentColor: 'bg-red-100',
      iconColor: 'text-red-500',
      loading: invoicesLoading,
    },
    {
      label: t('hospital.overduePayments'),
      value: `RWF ${overduePaymentsValue.toLocaleString(i18n.language || 'en')}`,
      sub: `${overdueInvoicesCount} ` + t('hospital.invoices'),
      trend: false,
      icon: <BanknotesIcon className="w-5 h-5" />,
      accentColor: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      loading: invoicesLoading,
    },
    {
      label: t('hospital.monthlyRevenue') || 'Monthly Revenue',
      value: `RWF ${(stats?.monthlyRevenue ?? 0).toLocaleString(i18n.language || 'en')}`,
      sub: stats ? `${stats.totalAppointments?.thisMonth ?? 0} appointments this month` : '—',
      trend: true,
      icon: <ClockIcon className="w-5 h-5" />,
      accentColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
      loading: statsLoading,
    },
  ];

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-7 bg-brand-hero relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-brand-navy">{t('hospital.finance')}</h1>
          <p className="mt-1 text-sm font-medium" style={{ color: '#0284C7' }}>{t('hospital.financeDescription')}</p>
        </div>
        <svg
          className="absolute right-6 bottom-0 opacity-20 hidden sm:block"
          width="120" height="72" viewBox="0 0 120 72" fill="none"
        >
          <rect x="0" y="36" width="16" height="36" rx="4" fill="#1E4D8C" />
          <rect x="26" y="18" width="16" height="54" rx="4" fill="#1E4D8C" />
          <rect x="52" y="28" width="16" height="44" rx="4" fill="#1E4D8C" />
          <rect x="78" y="10" width="16" height="62" rx="4" fill="#1E4D8C" />
          <rect x="104" y="24" width="16" height="48" rx="4" fill="#1E4D8C" />
          <polyline points="8,30 34,14 60,22 86,6 112,18" stroke="#2D9B8A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>

      {/* Error banner above KPI card section if statsError is true */}
      {dashError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl shadow-sm">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">
            Failed to load dashboard statistics. Some values may not be fully up to date.
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {FINANCE_KPIS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kpi.accentColor}`}>
                <span className={kpi.iconColor}>{kpi.icon}</span>
              </div>
              <span className="text-gray-300 text-lg leading-none">⋯</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">{kpi.label}</p>
            {kpi.loading ? (
              <div className="mt-2 h-8 w-36 bg-slate-100 rounded animate-pulse" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
            )}
            {kpi.loading ? (
              <div className="mt-2 h-4 w-20 bg-slate-100 rounded animate-pulse" />
            ) : kpi.trend ? (
              <span className="mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">{kpi.sub}</span>
            ) : (
              <span className="mt-2 inline-block text-xs text-slate-400">{kpi.sub}</span>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
        <RevenueChart
          data={weeklyRevenue}
          title={t('hospital.revenueOverview')}
          showExpenses={false}
          defaultPeriod="Weekly"
          variant="bar"
        />
        <PaymentBreakdownChart
          data={PAYMENT_BREAKDOWN}
          title={t('hospital.paymentBreakdown')}
        />
      </div>

      {/* Invoice table + Refund panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
        <InvoiceTable
          invoices={mappedInvoices}
          loading={invoicesLoading}
          error={invoicesError}
          isEndpointMissing={isEndpointMissing}
          onExport={() => console.log('export')}
        />
        <RefundTable
          refunds={REFUNDS}
          onViewAll={() => console.log('view all refunds')}
        />
      </div>

    </div>
  );
}
