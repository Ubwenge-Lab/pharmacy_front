'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon,
  FolderIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';

const NAVY = '#1E3A5F';
const SKY = '#0EA5E9';

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#94A3B8',
  ACTIVE: SKY,
  UPCOMING: '#38BDF8',
};

type ViewMode = 'daily' | 'weekly' | 'monthly';
const VIEW_MODES: ViewMode[] = ['daily', 'weekly', 'monthly'];

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  description: string;
  status: string;
}

export default function NurseSchedulePage() {
  const { t } = useTranslation();
  const hospitalId = useHospitalId();

  const [view, setView] = useState<ViewMode>('daily');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState(today);

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<ScheduleItem[]>(`/hospitals/${hospitalId}/nurse/schedule?view=${view}&date=${dateFilter}`)
      .then((res) => {
        if (cancelled) return;
        setSchedule(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => { if (!cancelled) setSchedule([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hospitalId, view, dateFilter]);

  const shiftStats = [
    { key: 'shift', icon: ClockIcon, color: '#0EA5E9', title: t('hospital.currentShift'), subtitle: t('hospital.onDuty') },
    { key: 'unit', icon: FolderIcon, color: '#7C3AED', title: t('hospital.unit'), subtitle: t('hospital.generalMed') },
    { key: 'duties', icon: CheckCircleIcon, color: '#16A34A', title: String(schedule.length), subtitle: t('hospital.dutiesToday') },
    { key: 'total', icon: CalendarDaysIcon, color: '#F97316', title: t('hospital.shifts'), subtitle: t('hospital.thisWeek') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl px-4 py-5 sm:p-8" style={{ background: '#EBF5FF' }}>
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: NAVY }}>{t('hospital.nurseScheduleTitle')}</h1>
        <p className="mt-1 text-sm" style={{ color: '#0284C7' }}>{t('hospital.nurseScheduleSubtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {shiftStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="flex min-w-0 items-center gap-4 rounded-xl bg-white px-5 py-4 shadow-sm border border-gray-100" style={{ borderLeft: `4px solid ${stat.color}` }}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: `${stat.color}1A` }}>
                <Icon className="h-6 w-6" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 break-words">{stat.title}</p>
                <p className="text-xs font-medium text-slate-500 break-words">{stat.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
              style={view === mode ? { background: '#FFFFFF', color: SKY, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' } : { color: '#64748B' }}
            >
              {t(`hospital.${mode}View`)}
            </button>
          ))}
        </div>
        <div className="relative min-w-[150px]">
          <select className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-200">
            <option>{t('hospital.allDepartments')}</option>
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {/* Timeline */}
      <div className="space-y-3 rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-gray-100">
        {loading && <p className="py-12 text-center text-sm font-semibold text-slate-400">{t('common.loading')}</p>}
        {!loading && schedule.length === 0 && (
          <p className="py-12 text-center text-sm font-semibold text-slate-400">{t('hospital.noShiftsScheduled')}</p>
        )}
        {!loading && schedule.map((item) => {
          const statusColor = STATUS_COLOR[item.status] ?? '#94A3B8';
          const statusLabel =
            item.status === 'COMPLETED' ? t('hospital.completed') :
            item.status === 'ACTIVE'    ? t('hospital.active') :
            t('hospital.upcoming');

          return (
            <div key={item.id} className="flex items-center gap-3 sm:gap-5">
              <span className="hidden w-24 shrink-0 text-right text-xs font-bold text-slate-600 sm:block">{item.time}</span>
              <span className="h-12 w-1 shrink-0 rounded" style={{ background: SKY }} />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-600 sm:hidden">{item.time}</p>
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <span className="shrink-0 text-xs font-bold uppercase tracking-wide" style={{ color: statusColor }}>{statusLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
