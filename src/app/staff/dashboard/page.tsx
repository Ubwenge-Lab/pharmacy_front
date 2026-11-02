'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StatusBadge from '@/components/shared/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import {
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PlusCircleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { fetchStaffProfile } from '@/services/staffProfile';

interface CurrentAttendance {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'CLOCKED_OUT' | 'COMPLETED' | 'REJECTED';
  clockInTime: string;
  clockOutTime?: string;
  totalHours?: number;
  clockInApprover?: { firstName: string; lastName: string };
  rejectionReason?: string;
}

interface StaffProfile {
  firstName: string;
  lastName: string;
  user: { email: string; role: string };
  branch: { name: string; pharmacy: { name: string } };
  status: string;
}

function HeartbeatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 12h4.5l1.5-3 3 6 1.5-3 1.5 1.5H23" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StaffDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const SHIFT_STATUS_LABELS: Record<string, string> = {
    PENDING:     t('staff.statusWaitingApproval'),
    APPROVED:    t('staff.statusActiveShift'),
    CLOCKED_OUT: t('staff.statusClockOutPending'),
    COMPLETED:   t('dashboard.completed') ?? 'Shift completed',
    REJECTED:    t('staff.statusRejected'),
  };

  const [profile, setProfile]                 = useState<StaffProfile | null>(null);
  const [todayShift, setTodayShift]           = useState<CurrentAttendance | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [actionLoading, setActionLoading]     = useState(false);
  const [transactionsToday, setTransactionsToday] = useState(0);
  const [grossSales, setGrossSales]           = useState(0);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [profileRes, shiftRes, ordersRes] = await Promise.allSettled([
        fetchStaffProfile<StaffProfile>(),
        api.get('/attendance/my-current'),
        api.get('/orders/pharmacy-orders'),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value);
      } else {
        console.error('[dashboard] profile error:', profileRes.reason?.response?.data ?? profileRes.reason);
      }

      if (shiftRes.status === 'fulfilled') {
        setTodayShift(shiftRes.value.data);
      } else {
        const code = shiftRes.reason?.response?.status;
        if (code !== 404) {
          console.error('[dashboard] shift error:', shiftRes.reason?.response?.data ?? shiftRes.reason);
        }
      }

      let allOrders: any[] = [];
      if (ordersRes.status === 'fulfilled') {
        const raw = ordersRes.value.data;
        allOrders = Array.isArray(raw) ? raw : (raw?.data ?? []);
      } else {
        console.error('[dashboard] orders error:', ordersRes.reason?.response?.data ?? ordersRes.reason);
        toast.error(`Orders failed: ${ordersRes.reason?.response?.data?.message ?? ordersRes.reason?.message ?? 'unknown error'}`);
      }

      const todayStr   = new Date().toDateString();
      const todaysOrders = allOrders.filter((o: any) => new Date(o.createdAt).toDateString() === todayStr);

      setTransactionsToday(todaysOrders.length);
      setGrossSales(todaysOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0));

      setRecentActivities(
        [...allOrders]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map((o: any) => ({
            id:        o.id.slice(0, 8).toUpperCase(),
            type:      o.prescription ? t('staff.prescription') : t('staff.order'),
            amount:    `${t('common.currency')} ${Number(o.total || 0).toLocaleString()}`,
            time:      new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawStatus: o.status,
          }))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/clock-in', {});
      toast.success(t('dashboard.clockInRequest'));
      fetchData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setActionLoading(false); }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/clock-out', {});
      toast.success(t('dashboard.clockOutRequest'));
      fetchData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setActionLoading(false); }
  };

  const formatTime = (d?: string) =>
    d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.goodMorning');
    if (h < 17) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  const shiftLabel     = todayShift ? SHIFT_STATUS_LABELS[todayShift.status] : null;
  const canClockOut    = todayShift?.status === 'APPROVED';
  const clockedIn      = !!todayShift && todayShift.status !== 'REJECTED';

  const spinner = <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-4 lg:p-6">

      {/* ── Hero ── */}
      <div
        className="relative rounded-2xl overflow-hidden px-8 py-10 lg:px-12"
        style={{ background: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)' }}
      >
        <div className="relative z-10 max-w-md">
          <p className="text-blue-500 text-sm font-medium">{getGreeting()},</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-1 leading-tight">
            {profile ? `${profile.firstName} ${profile.lastName}` : '—'}
          </h1>
          <p className="text-gray-500 mt-3 text-sm leading-relaxed">
            {t('staffPages.performanceMetrics')}
          </p>
          <Link
            href="/staff/attendance"
            className="inline-flex items-center gap-2 mt-5 text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              width: 224,
              height: 48,
              borderRadius: 10,
              background: 'linear-gradient(93.49deg, #0284C7 0%, #38BDF8 102.32%)',
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            <ClockIcon className="w-4 h-4" />
            {t('staffPages.viewSchedule')}
          </Link>
        </div>

        {/* Decorative heartbeat — matches mingcute:heartbeat-fill positioning */}
        <div
          className="absolute top-0 bottom-0 right-6 flex items-center pointer-events-none select-none"
          aria-hidden="true"
        >
          <HeartbeatIcon className="w-56 h-56 lg:w-64 lg:h-64 text-blue-300 opacity-50" />
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Transactions Today */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 mb-4">
            <ShoppingBagIcon className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-gray-500 text-sm">{t('dashboard.transactionsToday')}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{transactionsToday}</p>
        </div>

        {/* Gross Sales */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-gray-500 text-sm">{t('dashboard.grossSales')}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {t('common.currency')} {grossSales.toLocaleString()}
          </p>
          <p className="text-green-500 text-xs mt-1 font-medium">{t('staffPages.lastMonth', '+4% Last Month')}</p>
        </div>

        {/* New Sales → POS */}
        <Link
          href="/staff/orders"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-50 mb-4">
            <PlusCircleIcon className="w-5 h-5 text-pink-500" />
          </div>
          <p className="text-gray-500 text-sm">{t('dashboard.newSale')}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">POS</p>
          <p className="text-pink-400 text-xs mt-1 font-medium">{t('dashboard.goToPos')}</p>
        </Link>

        {/* Rx Check */}
        <Link
          href="/staff/prescriptions"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50 mb-4">
            <DocumentTextIcon className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-gray-500 text-sm">{t('dashboard.rxCheck')}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">Rx</p>
          <p className="text-orange-400 text-xs mt-1 font-medium">{t('dashboard.viewPrescriptions')}</p>
        </Link>
      </div>

      {/* ── Shift Cards (side by side) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Today's Shift — Clock In */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">{t('dashboard.todayShift')}</h2>

          {!clockedIn ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#F0FBF9' }}>
                <ClockIcon className="w-7 h-7 text-brand-teal" />
              </div>
              <p className="text-gray-700 font-medium text-sm">{t('dashboard.notClockedIn')}</p>
              <p className="text-gray-400 text-xs mt-1 mb-5">{t('dashboard.clickToStart')}</p>
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-7 h-[49px] rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 bg-green-700"
                aria-label="Clock in to start shift"
              >
                {actionLoading ? spinner : <ClockIcon className="w-4 h-4" />}
                {t('staff.clockIn')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {todayShift && shiftLabel && (
                <StatusBadge status={todayShift.status} label={shiftLabel} size="md" />
              )}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{t('staff.clockIn')}</p>
                <p className="text-xl font-bold text-gray-900">{formatTime(todayShift?.clockInTime)}</p>
                {todayShift?.clockInApprover && (
                  <p className="text-xs mt-1 text-brand-teal">
                    {t('dashboard.approvedBy', { name: todayShift.clockInApprover.firstName })}
                  </p>
                )}
              </div>
              {todayShift?.status === 'REJECTED' && (
                <>
                  {todayShift.rejectionReason && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <p className="text-xs text-red-600 font-medium">
                        {t('dashboard.rejectionReason', { reason: todayShift.rejectionReason })}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleClockIn}
                    disabled={actionLoading}
                    className="w-full inline-flex items-center justify-center gap-2 h-[49px] rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: '#08007C' }}
                  >
                    {actionLoading ? spinner : <ClockIcon className="w-4 h-4" />}
                    {t('dashboard.tryAgain')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* End Today's Shift — Clock Out */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">{t('staffPages.endShift')}</h2>

          {!canClockOut ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#EEF2FB' }}>
                <ClockIcon className="w-7 h-7 text-brand-navy" />
              </div>
              <p className="text-gray-700 font-medium text-sm">
                {clockedIn ? t('staff.statusClockOutPending') : t('staffPages.notClockedOut')}
              </p>
              <p className="text-gray-400 text-xs mt-1 mb-5">{t('staffPages.clockOutAvailable')}</p>
              <button
                disabled
                className="inline-flex items-center gap-2 px-7 h-[49px] rounded-xl text-white text-sm font-semibold opacity-40 cursor-not-allowed bg-indigo-900"
              >
                <ClockIcon className="w-4 h-4" />
                {t('staff.clockOut')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{t('staff.clockOut')}</p>
                <p className="text-xl font-bold text-gray-900">{formatTime(todayShift?.clockOutTime)}</p>
                {todayShift?.totalHours && (
                  <p className="text-xs text-blue-600 mt-1">
                    {t('dashboard.hoursWorkedLabel', { hours: todayShift.totalHours.toFixed(1) })}
                  </p>
                )}
              </div>
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full inline-flex items-center justify-center gap-2 h-[49px] rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity bg-indigo-900"
                aria-label="Clock out to end shift"
              >
                {actionLoading ? spinner : <ClockIcon className="w-4 h-4" />}
                {t('staff.clockOut')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity (full width) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-400" />
            <h2 className="font-bold text-gray-900">{t('dashboard.recentActivity')}</h2>
          </div>
          <Link href="/staff/orders" className="text-sm font-medium hover:underline text-brand-teal">
            {t('common.viewAll')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">{t('dashboard.transactionId')}</th>
                <th scope="col" className="px-6 py-3 font-medium">{t('dashboard.type')}</th>
                <th scope="col" className="px-6 py-3 font-medium">{t('dashboard.time')}</th>
                <th scope="col" className="px-6 py-3 font-medium text-right">{t('dashboard.amount')}</th>
                <th scope="col" className="px-6 py-3 font-medium text-center">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentActivities.map((activity, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{activity.id}</td>
                  <td className="px-6 py-4 text-gray-600">{activity.type}</td>
                  <td className="px-6 py-4 text-gray-500">{activity.time}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">{activity.amount}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={activity.rawStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentActivities.length === 0 && (
            <p className="p-8 text-center text-gray-400 text-sm">{t('dashboard.noRecentActivity')}</p>
          )}
        </div>
      </div>

    </div>
  );
}
