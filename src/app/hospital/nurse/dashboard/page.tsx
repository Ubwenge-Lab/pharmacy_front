// src/app/hospital/nurse/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import {
  CalendarIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api, { unwrapItem } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useHospitalId, useHospitalAdmissions } from '@/lib/hospital';
import type { PatientStatus } from '@/types/hospital';

interface NurseDashboardData {
  totalPatients: number;
  pendingTasks: number;
  unreadMessages: number;
}

const OVERVIEW_LIMIT = 4;

const STATUS_LABEL: Record<PatientStatus, string> = {
  ACTIVE: 'active',
  CRITICAL: 'critical',
  INACTIVE: 'inactive',
};

const STATUS_COLOR: Record<PatientStatus, string> = {
  ACTIVE: 'text-green-600',
  CRITICAL: 'text-red-600',
  INACTIVE: 'text-gray-500',
};

export default function NurseDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const hospitalId = useHospitalId();
  const { patients, loading: patientsLoading, error: patientsError } = useHospitalAdmissions(hospitalId);

  const [dashboardData, setDashboardData] = useState<NurseDashboardData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // ── GET /nurses/dashboard ──────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/nurses/dashboard');
      const data = unwrapItem<NurseDashboardData>(res.data);
      setDashboardData({
        totalPatients: typeof data?.totalPatients === 'number' ? data.totalPatients : 0,
        pendingTasks:  typeof data?.pendingTasks  === 'number' ? data.pendingTasks  : 0,
        unreadMessages: typeof data?.unreadMessages === 'number' ? data.unreadMessages : 0,
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? err?.message ?? 'Failed to load nurse dashboard statistics.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Derive Greeting Name from AuthContext ─────────────────────────
  const getNurseDisplayName = () => {
    if (!user) return 'Nurse';
    const prof = user.profile as any;
    if (prof?.firstName) {
      return `${prof.firstName} ${prof.lastName ?? ''}`.trim();
    }
    if (prof?.name) return prof.name;
    if ((user as any).firstName) {
      return `${(user as any).firstName} ${(user as any).lastName ?? ''}`.trim();
    }
    if ((user as any).name) return (user as any).name;
    if (user.email) {
      const local = user.email.split('@')[0] ?? '';
      return local
        .split(/[._-]/)
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ') || 'Nurse';
    }
    return 'Nurse';
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('hospital.goodMorning');
    if (h < 17) return t('hospital.goodAfternoon');
    return t('hospital.goodEvening');
  };

  const statCards = [
    {
      key: 'patients',
      icon: UserGroupIcon,
      color: '#2563EB',
      title: t('hospital.totalPatients', 'Total Patients'),
      subtitle: t('hospital.todayActiveAppointments', 'Appointments today excluding cancelled & no-show'),
      action: t('hospital.viewPatients', 'View Patients'),
      href: '/hospital/nurse/patients',
      value: dashboardData?.totalPatients ?? 0,
    },
    {
      key: 'pendingTasks',
      icon: ClipboardDocumentListIcon,
      color: '#F97316',
      title: t('hospital.pendingTasks', 'Pending Tasks'),
      subtitle: t('hospital.waitingForTriage', 'Arrived patients waiting for triage'),
      action: t('hospital.viewVitals', 'View Vitals'),
      href: '/hospital/nurse/vitals',
      value: dashboardData?.pendingTasks ?? 0,
    },
    {
      key: 'unreadMessages',
      icon: ChatBubbleLeftRightIcon,
      color: '#0EA5E9',
      title: t('hospital.unreadMessages', 'Unread Messages'),
      subtitle: t('hospital.unreadNotifications', 'Unread notifications & alerts'),
      action: t('hospital.viewMessages', 'View Messages'),
      href: '/hospital/nurse/messages',
      value: dashboardData?.unreadMessages ?? 0,
    },
  ];

  const overviewPatients = patients.slice(0, OVERVIEW_LIMIT);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl relative overflow-hidden w-full" style={{ background: '#EBF5FF', padding: '28px 48px' }}>
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden sm:block sm:w-48 md:w-64 lg:w-96 xl:w-[500px]"
          viewBox="0 0 320 140" fill="none" preserveAspectRatio="xMidYMid meet"
        >
          <polyline points="0,70 55,70 80,15 108,125 135,30 162,105 188,70 320,70" stroke="#1E4D8C" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black mb-3" style={{ color: '#1a3470' }}>
            {getGreeting()}, {getNurseDisplayName()}.
          </h1>
          <p className="text-lg" style={{ color: '#0284C7' }}>{t('hospital.welcomeNurse')}</p>
          <Link
            href="/hospital/nurse/schedule"
            className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{
              background: 'linear-gradient(to right, #0284C7, #38BDF8)',
              width: '140px',
              height: '44px',
              borderRadius: '16px',
            }}
          >
            <CalendarIcon className="w-4 h-4" /> {t('hospital.viewSchedule')}
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700">
          <p className="font-medium">{error}</p>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 underline shrink-0"
          >
            <ArrowPathIcon className="w-4 h-4" /> {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {/* 3 Stat Cards Driven by GET /nurses/dashboard */}
      <div className="grid gap-5 md:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              className="rounded-2xl bg-white px-6 py-5 min-h-[180px] flex flex-col shadow-sm"
              style={{ border: `1px solid ${card.color}40` }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Icon className="h-5 w-5" style={{ color: card.color }} />
                <h3 className="text-sm font-semibold text-gray-800">{card.title}</h3>
              </div>

              {loading ? (
                <div className="h-12 w-24 bg-gray-200 rounded-xl animate-pulse my-1" />
              ) : (
                <h2 className="text-5xl font-light" style={{ color: card.color }}>
                  {card.value}
                </h2>
              )}

              <p className="mt-3 text-xs text-gray-500">{card.subtitle}</p>

              <div className="flex-1" />
              <div className="border-t border-gray-200 my-4" />
              <Link href={card.href} className="flex items-center justify-between group/action">
                <span className="text-xs font-medium group-hover/action:underline" style={{ color: card.color }}>
                  {card.action}
                </span>
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover/action:translate-x-1" style={{ color: card.color }} />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Patient Overview */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-6 w-6 text-[#2563EB]" />
            <h2 className="text-lg font-bold text-gray-800">{t('hospital.patientOverview')}</h2>
          </div>
          <Link href="/hospital/nurse/patients" className="text-sm font-bold text-[#2563EB] hover:underline">
            {t('common.viewAll')}
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-2 sm:p-4 divide-y divide-gray-100">
          {patientsLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">{t('common.loading', 'Loading...')}</div>
          ) : patientsError ? (
            <div className="py-8 text-center text-sm text-red-500">{patientsError}</div>
          ) : overviewPatients.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">{t('hospital.noPatientsFound')}</div>
          ) : overviewPatients.map((patient) => (
            <div
              key={patient.id}
              className="relative grid grid-cols-12 gap-4 py-4 items-center px-2 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer"
            >
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 border-r border-gray-200 pr-2">
                <span className="text-sm font-bold text-gray-400">{patient.patientId}</span>
              </div>

              <div className="col-span-5 sm:col-span-3 pl-1">
                <div className="font-bold text-gray-900 text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis">
                  {patient.name}
                </div>
                <div className="text-xs font-semibold text-gray-400 mt-0.5">
                  {[patient.gender !== '—' ? patient.gender : null, patient.age !== '—' ? patient.age : null].filter(Boolean).join(', ') || '—'}
                </div>
              </div>

              <div className="col-span-5 sm:col-span-2 text-center sm:text-left">
                <span className={`text-sm font-bold ${STATUS_COLOR[patient.status]}`}>
                  {t(`hospital.${STATUS_LABEL[patient.status]}`, STATUS_LABEL[patient.status])}
                </span>
              </div>

              <div className="col-span-12 sm:col-span-5 grid grid-cols-2 gap-2 text-center sm:text-left pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('hospital.condition')}</div>
                  <div className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5 uppercase">{patient.condition}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('hospital.lastVisit')}</div>
                  <div className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{patient.lastVisit}</div>
                </div>
              </div>

              <div className="absolute right-4 sm:relative sm:right-auto col-span-12 sm:col-span-1 flex justify-end">
                <ArrowRightIcon className="h-5 w-5 text-gray-700 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <Link href="/hospital/nurse/patients" className="text-sm font-bold text-[#2563EB] hover:underline">
            {t('hospital.viewAllPatients')}
          </Link>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-[#2563EB]" />
            <h2 className="font-semibold text-gray-800">{t('hospital.todaySchedule')}</h2>
          </div>

          <Link href="/hospital/nurse/schedule" className="text-sm text-[#2563EB]">{t('hospital.viewFullSchedule')}</Link>
        </div>

        <div className="px-5 py-8 text-center text-sm text-gray-400">
          {t('hospital.scheduleNotAvailable', "Today's schedule isn't available yet.")}
        </div>
      </div>
    </div>
  );
}
