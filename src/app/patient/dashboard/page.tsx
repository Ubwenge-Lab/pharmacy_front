// src/app/patient/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { Order } from '@/types';
import {
  ShoppingCartIcon,
  MapPinIcon,
  BoltIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/shared/StatusBadge';
import { fetchPharmacyLocations } from '@/services/pharmacies';
import { PharmacyLocation, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/features/map/pharmacyData';
import { MapSkeleton } from '@/components/map/MapStates';
import MapLayout from '@/components/map/MapLayout';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function PatientDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.profile?.firstName ?? user?.email?.split('@')[0] ?? 'there';

  const getStatusLabel = (status: string) => ({
    PENDING: t('orders2.statusPending'),
    ACCEPTED: t('orders2.statusAccepted'),
    PREPARING: t('orders2.statusPreparing'),
    OUT_FOR_DELIVERY: t('orders2.statusOutForDelivery'),
    READY_FOR_PICKUP: t('orders2.statusReadyForPickup'),
    DELIVERED: t('orders2.statusDelivered'),
    CANCELLED: t('orders2.statusCancelled'),
    COMPLETED: t('orders2.statusDelivered'),
  } as Record<string, string>)[status] ?? status;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.goodMorning');
    if (h < 17) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  const [stats, setStats] = useState({ totalOrders: 0, completedOrders: 0, pendingOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Map state
  const [mapPharmacies, setMapPharmacies] = useState<PharmacyLocation[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    loadMapPharmacies();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const ordersRes = await api.get<Order[]>('/orders/my-orders');
      const orders = ordersRes.data;
      setStats({
        totalOrders: orders.length,
        completedOrders: orders.filter((o) =>
          ['COMPLETED', 'DELIVERED'].includes(o.status)
        ).length,
        pendingOrders: orders.filter((o) =>
          ['PENDING', 'ACCEPTED', 'PREPARING'].includes(o.status)
        ).length,
      });
      setRecentOrders(orders.slice(0, 5));
    } catch {
      setStats({ totalOrders: 0, completedOrders: 0, pendingOrders: 0 });
      setRecentOrders([]);
      toast.error(t('errors.failedToLoadOrders'));
    } finally {
      setLoading(false);
    }
  };

  const loadMapPharmacies = async () => {
    try {
      const data = await fetchPharmacyLocations();
      setMapPharmacies(data.slice(0, 6));
    } catch {
      setMapPharmacies([]);
      toast.error(t('errors.failedToLoadPharmacies'));
    } finally {
      setMapLoading(false);
    }
  };

  const quickActions = [
    {
      title: t('cart.title'),
      description: t('patient.browsePharmacies'),
      icon: ShoppingCartIcon,
      href: '/patient/cart',
      color: '#1E4D8C',
      cardBg: '#EBF5FF',
      iconBg: '#BFDBFE',
    },
    {
      title: t('analytics.activeOrders'),
      description: `${stats.pendingOrders} ${t('orders2.statusPending').toLowerCase()}`,
      icon: BoltIcon,
      href: '/patient/orders',
      color: '#D97706',
      cardBg: '#FFFBEB',
      iconBg: '#FDE68A',
    },
    {
      title: t('orders2.orderCompleted'),
      description: `${stats.completedOrders} ${t('orders2.completedOrders').toLowerCase()}`,
      icon: CheckCircleIcon,
      href: '/patient/orders?status=completed',
      color: '#059669',
      cardBg: '#F0FDF4',
      iconBg: '#BBF7D0',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome hero banner */}
      <div className="rounded-2xl relative overflow-hidden w-full" style={{ background: '#EBF5FF', padding: '28px 48px' }}>
        {/* Decorative heartbeat watermark */}
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden sm:block sm:w-48 md:w-64 lg:w-96 xl:w-[500px]"
          viewBox="0 0 320 140"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
        >
          <polyline
            points="0,70 55,70 80,15 108,125 135,30 162,105 188,70 320,70"
            stroke="#1E4D8C" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>

        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black mb-3" style={{ color: '#1a3470' }}>
            {getGreeting()},<br />{firstName}.
          </h1>
          <p className="text-gray-500 text-lg mb-7">{t('dashboard.healthMetrics')}</p>
          <Link
            href="/patient/search"
            className="inline-flex items-center text-white font-semibold text-base transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #0284C7, #38BDF8)', borderRadius: '99px', padding: '20px 40px', gap: '12.79px' }}
          >
            <MapPinIcon className="w-5 h-5" />
            {t('dashboard.browseNearbyPharmacies')}
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href} className="flex">
            <div
              className="flex flex-col items-center text-center rounded-2xl px-8 pt-14 pb-8 w-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              style={{
                background: action.cardBg,
                borderBottom: `4px solid ${action.color}`,
              }}
            >
              {/* Icon container */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5  -translate-y-5"
                style={{ background: action.iconBg }}
              >
                <action.icon className="w-8 h-8" style={{ color: action.color }} />
              </div>

              {/* Text */}
              <h3 className="font-bold text-2xl mb-3" style={{ color: action.color }}>
                {action.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ─── NEARBY PHARMACIES MAP SECTION ─── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-teal/10"
            >
              <MapPinIcon className="w-6 h-6 text-brand-teal" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {t('dashboard.nearbyPharmacies')}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {mapPharmacies.length} {t('dashboard.pharmaciesOnMap')}
              </p>
            </div>
          </div>
          <Link
            href="/patient/search"
            className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 bg-brand-navy"
          >
            {t('common.viewAll')} →
          </Link>
        </div>

        <div className="p-4" style={{ height: 380 }}>
          {mapLoading ? (
            <MapSkeleton />
          ) : (
            <MapView
              pharmacies={mapPharmacies}
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              selectedId={selectedId}
              onSelectPharmacy={(p) => setSelectedId(p.id)}
              onViewDetails={(id) => router.push(`/patient/pharmacies/${id}`)}
              className="h-full rounded-xl"
            />
          )}
        </div>

        {/* Quick pharmacy chips below map */}
        {!mapLoading && mapPharmacies.length > 0 && (
          <div className="px-4 pb-4 flex gap-2 flex-wrap">
            {mapPharmacies.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  selectedId === p.id
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-teal-400'
                }`}
              >
                {p.status === 'OPEN' ? '🟢' : '🔴'} {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-brand-navy">
            {t('dashboard.recentMedicalOrders')}
          </h2>
          <Link
            href="/patient/orders"
            className="font-semibold text-sm flex items-center gap-1 hover:underline text-brand-navy"
          >
            {t('common.viewAll')} <span className="text-base">›</span>
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col" style={{ gap: '20px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-5 animate-pulse">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="space-y-2 text-right shrink-0">
                  <div className="h-5 bg-gray-100 rounded w-20" />
                  <div className="h-5 bg-gray-100 rounded w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : recentOrders.length > 0 ? (
          <div className="flex flex-col" style={{ gap: '20px' }}>
            {recentOrders.map((order) => {
              const firstItem = order.items?.[0] ?? order.orderItems?.[0];
              const medName = firstItem?.medication?.name ?? 'Medication';
              const medImage = firstItem?.medication?.imageUrl;
              const pharmacyName = order.pharmacy?.name ?? '—';
              const branchName = order.branch?.name ?? '';

              return (
                <Link key={order.id} href={`/patient/orders/${order.id}`}>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-5 hover:shadow-md transition-all cursor-pointer">
                    {/* Medication image */}
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ background: '#F0F7FF' }}
                    >
                      {medImage ? (
                        <Image src={medImage} alt={medName} width={80} height={80} className="w-full h-full object-contain p-2" />
                      ) : (
                        <ShoppingCartIcon className="w-8 h-8 text-blue-300" />
                      )}
                    </div>

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-gray-900">Order #{order.id.slice(0, 8)}</p>
                      <p className="font-extrabold text-sm mt-0.5 text-brand-teal">{medName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {pharmacyName}{branchName ? ` • ${branchName}` : ''}
                      </p>
                    </div>

                    {/* Price + status */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 text-lg">
                        {order.total?.toLocaleString()} RWF
                      </p>
                      <StatusBadge status={order.status} label={getStatusLabel(order.status)} className="mt-2" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <ClipboardDocumentListIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-700 text-lg font-semibold mb-1">
              {t('dashboard.noOrdersYet')}
            </p>
            <p className="text-sm text-gray-400">{t('dashboard.startShopping')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
