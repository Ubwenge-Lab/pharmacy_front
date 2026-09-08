'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Settings,
  BadgeDollarSign,
  Megaphone,
  Building2,
  UserCircle2,
  Plus,
  ChevronRight,
  MoreVertical,
  Save,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useHospitalId } from '@/lib/hospital';
import api from '@/lib/api';
import type { HospitalSettings } from '@/types/hospital';

interface HospitalFee { id: string; service: string; price: number; status: string; }
interface HospitalAnnouncement { id: string; title: string; type: string; createdAt?: string; date?: string; time?: string; }
interface HospitalDepartment { id: string; name: string; head: string; staffCount: number; }

const NAVY     = '#1E3A5F';
const GRADIENT = 'linear-gradient(90deg, #1E4D8C 0%, #2D9B8A 100%)';

type Tab = 'general' | 'fees' | 'announcements' | 'departments';

const announcementBadge: Record<string, { bg: string; color: string }> = {
  Urgent:  { bg: '#FFF3E0', color: '#E65100' },
  Formal:  { bg: '#E3F2FD', color: '#1565C0' },
  General: { bg: '#F3F4F6', color: '#374151' },
};

const EMPTY_SETTINGS: HospitalSettings = { hospitalName: '', address: '', phone: '', email: '' };


export default function HospitalAdminSettingsPage() {
  const { t } = useTranslation();
  const hospitalId = useHospitalId();

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'general',       label: t('hospital.general'),       icon: UserCircle2     },
    { key: 'fees',          label: t('hospital.fees'),          icon: BadgeDollarSign },
    { key: 'announcements', label: t('hospital.announcements'), icon: Megaphone       },
    { key: 'departments',   label: t('hospital.departments'),   icon: Building2       },
  ];

  const [activeTab, setActiveTab] = useState<Tab>('general');

  // ?? General / Hospital profile ?????????????????????????????????????????????????
  // Read: GET /hospitals/:id (real, confirmed working).
  // Write: PATCH /hospitals/:id ? see gap doc Gap S-1. This route does not
  // exist on the backend as of this snapshot; a proposed spec (payload shape,
  // ownership check to reuse) is in the gap doc. Save is wired to call it so
  // no further frontend change is needed once the route ships ? until then it
  // will surface a 404 as an error toast rather than pretending to persist.
  const [settings, setSettings]   = useState<HospitalSettings>(EMPTY_SETTINGS);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError]     = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Departments ────────────────────────────────────────────────────────────
  // No HospitalDepartment model/table exists (Gap S-4). Derived read-only from
  // GET /hospitals/:id/doctors, grouped by specialization, same approach as
  // admin/departments. "Head" has no backend source (no isDepartmentHead field
  // exists on Doctor), so it's shown as "—" rather than invented.
  const [departments, setDepartments] = useState<HospitalDepartment[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError]     = useState(false);

  useEffect(() => {
    if (!hospitalId) { setProfileLoading(false); setDeptLoading(false); return; }

    api.get(`/hospitals/${hospitalId}`)
      .then(res => {
        const h = res.data ?? {};
        setSettings({
          hospitalName: h.name ?? '',
          address: h.address ?? '',
          phone: h.phone ?? '',
          email: h.email ?? '',
        });
      })
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));

    api.get(`/hospitals/${hospitalId}/doctors`)
      .then(res => {
        const doctors: any[] = Array.isArray(res.data) ? res.data : [];
        const bySpec = doctors.reduce((acc: Record<string, number>, doc) => {
          const key = doc.specialization ?? 'General';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});
        setDepartments(Object.entries(bySpec).map(([name, staffCount], i) => ({
          id: `dept-${i}`,
          name,
          head: '—',
          staffCount,
        })));
      })
      .catch(() => setDeptError(true))
      .finally(() => setDeptLoading(false));
  }, [hospitalId]);

  async function handleSave() {
    if (!hospitalId) return;
    setSaving(true);
    try {
      await api.patch(`/hospitals/${hospitalId}`, {
        name: settings.hospitalName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
      });
      toast.success(t('hospital.saveChanges'));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error('Save is not available yet ? the backend has no hospital-profile update endpoint (see gap doc).');
      } else {
        toast.error('Failed to save settings ? please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <div
        className="rounded-2xl px-6 py-7 flex items-center justify-between"
        style={{ background: '#EBF5FF' }}
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold truncate" style={{ color: NAVY }}>
            {t('hospital.settings')}
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: '#0284C7' }}>
            {t('hospital.settingsSubtitle')}
          </p>
        </div>
        <div className="relative opacity-20 shrink-0 ml-4" style={{ color: NAVY }}>
          <Settings size={56} />
        </div>
      </div>

      {profileError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700">
          Could not load hospital profile — check your connection and refresh.
        </div>
      )}

      {/* ── Tabs + Save Changes ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="flex items-center gap-2 min-w-0 flex-1"
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                whiteSpace: 'nowrap',
                ...(activeTab === key
                  ? { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }
                  : { background: '#fff', color: '#6b7280', border: '1px solid #d1d5db' }),
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || profileLoading}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all min-h-11 shrink-0 disabled:opacity-60"
          style={{ background: 'linear-gradient(to right, #0284C7, #38BDF8)' }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? t('common.saving') : t('hospital.saveChanges')}
        </button>
      </div>

      {/* ── Content ── */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <HospitalPageCard settings={settings} setSettings={setSettings} loading={profileLoading} />
          <FeeStructureCard />
          <AnnouncementsCard />
          <DepartmentsCard departments={departments} loading={deptLoading} error={deptError} />
        </div>
      )}
      {activeTab === 'fees'          && <FeeStructureCard full />}
      {activeTab === 'announcements' && <AnnouncementsCard full />}
      {activeTab === 'departments'   && <DepartmentsCard departments={departments} loading={deptLoading} error={deptError} full />}
    </div>
  );
}

/* ── Shared shell ── */
function CardShell({
  title, subtitle, action, children,
}: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full min-w-0">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate" style={{ color: NAVY }}>{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Not available yet — see gap doc' : undefined}
      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: '#EFF6FF', color: '#2563EB' }}
    >
      <Plus size={12} />
      {label}
    </button>
  );
}

/* ── Hospital Page ── */
function HospitalPageCard({
  settings, setSettings, loading,
}: {
  settings: HospitalSettings;
  setSettings: React.Dispatch<React.SetStateAction<HospitalSettings>>;
  loading: boolean;
}) {
  const { t } = useTranslation();

  const fields: { key: keyof HospitalSettings; label: string }[] = [
    { key: 'hospitalName', label: t('hospital.hospitalName') },
    { key: 'phone',        label: t('hospital.phoneNumber')  },
    { key: 'address',      label: t('hospital.address')      },
  ];

  return (
    <CardShell title={t('hospital.hospitalPage')} subtitle={t('hospital.updateHospitalInfo')}>
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="relative shrink-0 w-full sm:w-auto" style={{ height: 177 }}>
          <div className="relative w-full sm:w-[177px] h-[177px]">
            <Image
              src="/hospital-logo.jpg"
              alt="Hospital logo"
              fill
              className="object-cover rounded-lg"
            />
            <div
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow"
              style={{ background: GRADIENT }}
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="white">
                <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.24l-3 .76.76-3L11.5 2.5z"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 flex-1 min-w-0 text-sm">
          {loading ? (
            [0, 1, 2].map(i => <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />)
          ) : (
            fields.map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-medium block mb-0.5">{label}</label>
                <input
                  value={settings[key]}
                  onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full text-gray-700 font-medium border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </CardShell>
  );
}

/* ── Fee Structure ── */
function FeeStructureCard({ full }: { full?: boolean }) {
  const { t } = useTranslation();
  const hospitalId = useHospitalId();
  const [fees, setFees] = useState<HospitalFee[]>([]);

  useEffect(() => {
    if (!hospitalId) return;
    api.get<any[]>(`/hospitals/${hospitalId}/fees`)
      .then((res) => setFees(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFees([]));
  }, [hospitalId]);

  return (
    <CardShell
      title={t('hospital.feeStructure')}
      subtitle={t('hospital.manageServiceFees')}
      action={<ActionBtn label={t('hospital.addService')} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[260px]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left py-2 font-medium">{t('hospital.service')}</th>
              <th className="text-left py-2 font-medium">{t('hospital.price')}</th>
              <th className="text-left py-2 font-medium">{t('hospital.status')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fees.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-xs text-gray-400">No fees configured yet.</td></tr>
            ) : fees.map((fee) => (
              <tr key={fee.id}>
                <td className="py-2.5 font-medium text-gray-700">{fee.service}</td>
                <td className="py-2.5 text-gray-600">{Number(fee.price).toLocaleString()}</td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                    {fee.status === 'Active' ? t('hospital.feeStatusActive') : fee.status}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <button className="text-gray-400 hover:text-gray-600"><MoreVertical size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

/* ── Announcements ── */
function AnnouncementsCard({ full }: { full?: boolean }) {
  const { t } = useTranslation();
  const hospitalId = useHospitalId();
  const [announcements, setAnnouncements] = useState<HospitalAnnouncement[]>([]);

  useEffect(() => {
    if (!hospitalId) return;
    api.get<any[]>(`/hospitals/${hospitalId}/announcements`)
      .then((res) => setAnnouncements(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAnnouncements([]));
  }, [hospitalId]);

  return (
    <CardShell
      title={t('hospital.announcements')}
      subtitle={t('hospital.manageAnnouncements')}
      action={<ActionBtn label={t('hospital.addAnnouncement')} />}
    >
      <div className="space-y-3">
        {announcements.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No announcements yet.</p>
        ) : announcements.map((ann) => {
          const badge = announcementBadge[ann.type] ?? announcementBadge.General;
          const dateStr = ann.date ?? (ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
          return (
            <div key={ann.id}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all cursor-pointer gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full w-fit"
                  style={{ background: badge.bg, color: badge.color }}>
                  {ann.type === 'Urgent' ? t('hospital.urgentType') : ann.type === 'Formal' ? t('hospital.formalType') : ann.type === 'General' ? t('hospital.generalType') : ann.type}
                </span>
                <p className="text-sm font-semibold text-gray-700 truncate">{ann.title}</p>
                {dateStr && <p className="text-xs text-gray-400">{dateStr}</p>}
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

/* ── Departments ── */
function DepartmentsCard({
  departments, loading, error, full,
}: {
  departments: HospitalDepartment[];
  loading: boolean;
  error: boolean;
  full?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <CardShell
      title={t('hospital.departments')}
      subtitle={t('hospital.manageDepartments')}
      action={<ActionBtn label={t('hospital.addDepartment')} disabled />}
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 py-4 text-center">{t('hospital.couldNotLoadDepartments')}</div>
      ) : departments.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center">{t('hospital.noDepartmentsFound')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[260px]">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left py-2 font-medium">{t('hospital.department')}</th>
                <th className="text-left py-2 font-medium">{t('hospital.head')}</th>
                <th className="text-left py-2 font-medium">{t('hospital.staffCount')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td className="py-2.5 font-medium text-gray-700">{dept.name}</td>
                  <td className="py-2.5 text-gray-600">{dept.head}</td>
                  <td className="py-2.5 text-gray-600">{dept.staffCount}</td>
                  <td className="py-2.5 text-right">
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  );
}
