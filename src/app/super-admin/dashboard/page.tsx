// frontend/src/app/super-admin/dashboard/page.tsx — FIXED
// Fix #3: Added pending branch verification section connected to backend
// Backend endpoints: GET /super-admin/branches/pending
//                   PATCH /super-admin/branches/:id/approve
//                   PATCH /super-admin/branches/:id/reject

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LocationPicker from '@/components/shared/LocationPicker';
import {
  BuildingStorefrontIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

const NAVY = '#1E4D8C';
const TEAL = '#2D9B8A';

interface Analytics {
  totalPatients: number;
  totalPharmacies: number;
  approvedPharmacies: number;
  pendingPharmacies: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  platformRevenue: number;
  platformFeePerPharmacy: number;
}

interface PendingBranch {
  id: string;
  name: string;
  address: string;
  phone: string;
  branchManagerEmail: string;
  pharmacyLicense: string | null;
  createdAt: string;
  pharmacy: { id: string; name: string; representativeName: string };
  manager: { email: string } | null;
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pendingPharmacies, setPendingPharmacies] = useState<any[]>([]);
  const [pendingBranches, setPendingBranches] = useState<PendingBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchAction, setBranchAction] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<PendingBranch | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [unverifiedLocations, setUnverifiedLocations] = useState<any[]>([]);
  const [locationModal, setLocationModal] = useState<any | null>(null);
  const [locationActionLoading, setLocationActionLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, pendingRes, branchesRes, unverifiedRes] = await Promise.all([
        api.get('/super-admin/analytics'),
        api.get('/super-admin/pharmacies/pending'),
        api.get('/super-admin/branches/pending'),
        api.get('/super-admin/pharmacies/unverified-locations'),
      ]);
      setAnalytics(analyticsRes.data);
      setPendingPharmacies(pendingRes.data);
      setPendingBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setUnverifiedLocations(Array.isArray(unverifiedRes.data) ? unverifiedRes.data : []);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error(t('errors.failedToLoadDashboard'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBranch = async (branchId: string) => {
    setBranchAction(branchId);
    try {
      await api.patch(`/super-admin/branches/${branchId}/approve`);
      toast.success('Branch approved successfully');
      setPendingBranches(prev => prev.filter(b => b.id !== branchId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve branch');
    } finally {
      setBranchAction(null);
    }
  };

  const handleRejectBranch = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setBranchAction(rejectModal.id);
    try {
      await api.patch(`/super-admin/branches/${rejectModal.id}/reject`, { reason: rejectReason });
      toast.success('Branch rejected');
      setPendingBranches(prev => prev.filter(b => b.id !== rejectModal.id));
      setRejectModal(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject branch');
    } finally {
      setBranchAction(null);
    }
  };

  const handleVerifyLocation = async (verified: boolean) => {
    if (!locationModal) return;
    setLocationActionLoading(true);
    try {
      await api.patch(`/super-admin/pharmacies/${locationModal.id}/verify-location`, { verified });
      toast.success(verified ? 'Location verified.' : 'Location flagged as unverified.');
      setUnverifiedLocations(prev => prev.filter(p => p.id !== locationModal.id));
      setLocationModal(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update location status.');
    } finally {
      setLocationActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  const stats = [
    {
      name: t('superAdmin.totalPharmacies'),
      value: analytics?.totalPharmacies || 0,
      icon: BuildingStorefrontIcon,
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: t('superAdmin.pendingPharmacies'),
      value: analytics?.pendingPharmacies || 0,
      icon: ClockIcon,
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      action: () => router.push('/super-admin/pharmacies?filter=pending'),
    },
    {
      name: t('superAdmin.totalPatients'),
      value: analytics?.totalPatients || 0,
      icon: UserGroupIcon,
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: t('superAdmin.platformRevenue'),
      value: `$${analytics?.platformRevenue?.toLocaleString() || 0}`,
      icon: CurrencyDollarIcon,
      textColor: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">{t('superAdmin.title')}</h1>
        <p className="text-gray-500 mt-1">Welcome back, Super Admin! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              onClick={stat.action}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md ${stat.action ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
            >
              <div className={`${stat.bgColor} p-3 rounded-xl inline-flex mb-4`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-sm text-gray-500">{stat.name}</p>
            </div>
          );
        })}
      </div>

      {/* ── PENDING BRANCH VERIFICATION ── */}
      {/* This section is NEW — connected to backend GET /super-admin/branches/pending */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ background: '#EAF4FF' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" style={{ color: NAVY }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Branch Verification</h2>
              <p className="text-xs text-gray-400">Branches awaiting license review</p>
            </div>
          </div>
          {pendingBranches.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
              {pendingBranches.length} pending
            </span>
          )}
        </div>

        {pendingBranches.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircleIcon className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">All branches verified</p>
            <p className="text-gray-400 text-xs mt-1">No pending branch applications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pendingBranches.map((branch) => (
              <div key={branch.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5"
                    style={{ background: NAVY }}>
                    {branch.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{branch.name}</p>
                    <p className="text-xs text-gray-400 truncate">{branch.pharmacy.name}</p>
                    {branch.manager?.email && (
                      <p className="text-xs text-gray-400">{branch.manager.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {branch.pharmacyLicense ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircleIcon className="w-3 h-3" /> License uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircleIcon className="w-3 h-3" /> No license
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(branch.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {branch.pharmacyLicense && (
                    <button
                      onClick={() => {
                        const url = branch.pharmacyLicense!;
                        if (url.startsWith('data:')) {
                          const [header, base64] = url.split(',');
                          const mime = header.replace('data:', '').replace(';base64', '');
                          const binary = atob(base64);
                          const bytes = new Uint8Array(binary.length);
                          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                          const blob = new Blob([bytes], { type: mime });
                          const blobUrl = URL.createObjectURL(blob);
                          window.open(blobUrl, '_blank');
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                        } else {
                          window.open(url, '_blank');
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all hover:bg-gray-50"
                      style={{ color: NAVY, borderColor: '#BDD9FF' }}
                    >
                      {t('superAdminPages.viewLicense')}
                    </button>
                  )}
                  <button
                    onClick={() => handleApproveBranch(branch.id)}
                    disabled={branchAction === branch.id || !branch.pharmacyLicense}
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                    style={{ background: TEAL }}
                    title={!branch.pharmacyLicense ? 'Cannot approve: license not uploaded' : 'Approve branch'}
                  >
                    {branchAction === branch.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : t('superAdmin.approve')}
                  </button>
                  <button
                    onClick={() => setRejectModal(branch)}
                    disabled={branchAction === branch.id}
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50 bg-red-500 hover:bg-red-600"
                  >
                    {t('superAdmin.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── LOCATION REVIEW SECTION ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-50">
              <MapPinIcon className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Location Review</h2>
              <p className="text-xs text-gray-400">Pharmacies with unverified GPS coordinates</p>
            </div>
          </div>
          {unverifiedLocations.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              {unverifiedLocations.length} pending
            </span>
          )}
        </div>

        {unverifiedLocations.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheckIcon className="w-10 h-10 text-teal-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">All locations verified</p>
            <p className="text-gray-400 text-xs mt-1">No pharmacies awaiting location review</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {unverifiedLocations.map((pharmacy) => (
              <div key={pharmacy.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: NAVY }}>
                    {pharmacy.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{pharmacy.name}</p>
                    <p className="text-xs text-gray-400 truncate">{pharmacy.address}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPinIcon className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-mono text-gray-400">
                        {pharmacy.latitude?.toFixed(4)}, {pharmacy.longitude?.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    pharmacy.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    pharmacy.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {pharmacy.status}
                  </span>
                  <button
                    onClick={() => setLocationModal(pharmacy)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all"
                    style={{ background: TEAL }}
                  >
                    <EyeIcon className="w-3.5 h-3.5" /> Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Pharmacies */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">{t('superAdmin.pendingPharmacies')}</h2>
            <button
              onClick={() => router.push('/super-admin/pharmacies?filter=pending')}
              className="text-sm font-medium hover:underline"
              style={{ color: NAVY }}
            >
              {t('superAdmin.viewAll')}
            </button>
          </div>

          {pendingPharmacies.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 text-sm">No pending applications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPharmacies.slice(0, 5).map((pharmacy) => (
                <div
                  key={pharmacy.id}
                  onClick={() => router.push('/super-admin/pharmacies?filter=pending')}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: NAVY }}>
                      {pharmacy.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{pharmacy.name}</p>
                      <p className="text-xs text-gray-400">{pharmacy.user.email}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                    {t('superAdminPages.pending')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Platform Overview</h2>
          <div className="space-y-3">
            {[
              { icon: CheckCircleIcon, color: 'text-green-500', label: 'Approved Pharmacies', value: analytics?.approvedPharmacies || 0 },
              { icon: ShoppingCartIcon, color: 'text-blue-500', label: 'Total Orders', value: analytics?.totalOrders || 0 },
              { icon: CheckCircleIcon, color: 'text-teal-500', label: 'Completed Orders', value: analytics?.completedOrders || 0 },
            ].map(({ icon: Icon, color, label, value }) => (
              <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-gray-700 text-sm">{label}</span>
                </div>
                <span className="text-xl font-bold text-gray-900">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between p-4 rounded-xl text-white"
              style={{ background: `linear-gradient(135deg, ${TEAL}, #1a8a7a)` }}>
              <div className="flex items-center gap-3">
                <CurrencyDollarIcon className="w-5 h-5" />
                <span className="text-sm">{t('superAdminPages.totalRevenue')}</span>
              </div>
              <span className="text-xl font-bold">${analytics?.totalRevenue?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${TEAL}, #1a8a7a)` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t('superAdmin.systemStatus')}</h3>
              <p style={{ color: 'rgba(255,255,255,0.8)' }} className="text-sm">{t('superAdmin.allSystemsOperational')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">{t('superAdminPages.live')}</span>
          </div>
        </div>
      </div>

      {/* Location Review Modal */}
      {locationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{locationModal.name}</h3>
                <p className="text-xs text-gray-400">Location Review</p>
              </div>
              <button
                onClick={() => setLocationModal(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Submitted text address */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Submitted Address</p>
                  <p className="text-sm text-gray-800">{locationModal.address}</p>
                </div>
              </div>

              {/* Instruction */}
              <p className="text-xs text-gray-500">
                Check if the pin below matches the written address above. Verify if the location is legitimate.
              </p>

              {/* Map — read-only */}
              <LocationPicker
                latitude={locationModal.latitude}
                longitude={locationModal.longitude}
                onChange={() => {/* read-only */}}
                label="Submitted GPS Location"
                height="280px"
              />

              {/* Coordinate readout */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Latitude</p>
                  <p className="font-mono text-sm font-semibold text-gray-800">{locationModal.latitude}</p>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Longitude</p>
                  <p className="font-mono text-sm font-semibold text-gray-800">{locationModal.longitude}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => handleVerifyLocation(true)}
                  disabled={locationActionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ backgroundColor: TEAL }}
                >
                  <ShieldCheckIcon className="w-4 h-4" /> Verify Location
                </button>
                <button
                  onClick={() => handleVerifyLocation(false)}
                  disabled={locationActionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-all"
                >
                  <ExclamationTriangleIcon className="w-4 h-4" /> Flag as Suspicious
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Branch Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Branch</h3>
            <p className="text-sm text-gray-500 mb-4">
              You are rejecting <strong>{rejectModal.name}</strong> ({rejectModal.pharmacy.name}).
              The manager will be notified with the reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Reason for rejection (e.g. invalid license, incomplete documents...)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none resize-none"
              style={{ borderColor: rejectReason ? '#E5E7EB' : '#E5E7EB' }}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRejectBranch}
                disabled={!rejectReason.trim() || !!branchAction}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {t('superAdminPages.confirmRejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
