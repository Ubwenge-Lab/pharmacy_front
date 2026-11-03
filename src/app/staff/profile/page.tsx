'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  PencilSquareIcon,
  DocumentTextIcon,
  PhotoIcon,
  EyeIcon,
  ExclamationCircleIcon,
  CheckIcon,
  XMarkIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { openFile } from '@/lib/openFile';
import { fetchStaffProfile, invalidateStaffProfile } from '@/services/staffProfile';

interface StaffProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  nationalId?: string;
  gender?: string;
  dateOfBirth?: string;
  status: string;
  createdAt: string;
  licenseUrl?: string;
  licenseExpiry?: string;
  nationalIdExpiry?: string;
  user: { email: string; role: string };
  branch: {
    name: string;
    address: string;
    phone?: string;
    pharmacy: { name: string };
  };
  permissions?: { permissions: string[] };
}

interface EditForm {
  firstName: string;
  lastName: string;
  phone: string;
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-medium">
        {value}
      </div>
    </div>
  );
}

function EditField({
  label, value, onChange, disabled = false,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2.5 bg-white border-2 border-blue-300 rounded-lg text-sm text-gray-800 font-medium outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:border-gray-200 disabled:text-gray-500"
      />
    </div>
  );
}

export default function StaffProfilePage() {
  const { t } = useTranslation();
  const { permissions, loading: permsLoading } = useStaffPermissions();
  const [profile, setProfile]       = useState<StaffProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [isEditing, setIsEditing]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState<EditForm>({ firstName: '', lastName: '', phone: '' });

  useEffect(() => {
    fetchStaffProfile<StaffProfile>()
      .then(data => {
        setProfile(data);
        setForm({
          firstName: data.firstName ?? '',
          lastName:  data.lastName  ?? '',
          phone:     data.phone     ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = () => {
    if (!profile) return;
    setForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone ?? '' });
    setIsEditing(true);
  };

  const handleCancel = () => setIsEditing(false);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error(t('form.firstLastRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/staff/profile/me', {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        phone:     form.phone.trim() || undefined,
      });
      invalidateStaffProfile();
      setProfile(res.data);
      setIsEditing(false);
      toast.success(t('profile.updateSuccess'));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!profile) return <div className="text-center py-20 text-gray-500">{t('profile2.profileNotFound')}</div>;

  const initials    = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase();
  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const isApproved  = profile.status === 'ACTIVE';
  const roleLabel   = profile.user.role.charAt(0) + profile.user.role.slice(1).toLowerCase();

  const documents = [
    profile.licenseUrl ? {
      label:  t('staffPages.pharmacistLicense'),
      expiry: profile.licenseExpiry
        ? `${t('staffPages.docExpires')} ${new Date(profile.licenseExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : `${t('staffPages.docExpires')} —`,
      url:  profile.licenseUrl,
      icon: DocumentTextIcon,
    } : null,
    profile.nationalId ? {
      label:  t('staffPages.nationalIdCert'),
      expiry: profile.nationalIdExpiry
        ? `${t('staffPages.docExpired')} ${new Date(profile.nationalIdExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : `${t('staffPages.docIdPrefix')} ${profile.nationalId}`,
      url:  null,
      icon: PhotoIcon,
    } : null,
  ].filter(Boolean) as { label: string; expiry: string; url: string | null; icon: React.ComponentType<{ className?: string }> }[];

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-4 lg:p-6">

      {/* ── Hero ── */}
      <div
        className="rounded-2xl px-8 py-8"
        style={{ background: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)' }}
      >
        <h1 className="text-3xl font-extrabold text-gray-900">{t('profile2.myProfile')}</h1>
        <p className="mt-1 text-gray-500 text-sm">
          {profile.branch.pharmacy.name} / {roleLabel}
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">

        {/* ── Left: Identity card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3 relative"
            style={{ background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' }}
          >
            {initials}
            <span className="absolute bottom-0 right-0 w-6 h-6 bg-white rounded-full flex items-center justify-center border-2 border-white shadow">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-400 flex items-center justify-center">
                <EyeIcon className="w-2 h-2 text-white" />
              </span>
            </span>
          </div>

          <p className="font-bold text-gray-900 text-base">{profile.firstName} {profile.lastName}</p>
          <p className="text-gray-400 text-sm mt-0.5">{roleLabel}</p>

          <StatusBadge
            status={isApproved ? 'ACTIVE' : profile.status}
            label={isApproved ? t('common.active') : profile.status}
            className="mt-2"
          />

          <div className="mt-5 w-full space-y-3 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('form.pharmacy')}</p>
              <p className="font-semibold text-gray-800 mt-0.5">{profile.branch.pharmacy.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('form.branch')}</p>
              <p className="font-semibold text-gray-800 mt-0.5">{profile.branch.name}</p>
            </div>
            {(profile.phone || profile.branch.phone) && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('form.phone')}</p>
                <p className="font-semibold text-gray-800 mt-0.5">{profile.phone || profile.branch.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: stacked cards ── */}
        <div className="space-y-5">

          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 text-base">{t('profile2.personalInfo')}</h2>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(93.49deg, #0284C7 0%, #38BDF8 102.32%)' }}
                  >
                    {saving
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckIcon className="w-3.5 h-3.5" />}
                    {t('common.save')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(93.49deg, #0284C7 0%, #38BDF8 102.32%)' }}
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" />
                  {t('pharmacyOwner.editProfile')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <EditField label={t('profile2.firstName')}           value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
                  <EditField label={t('profile2.lastName')}            value={form.lastName}  onChange={v => setForm(f => ({ ...f, lastName: v }))} />
                  <EditField label={t('staffPages.phoneNumberLabel')}  value={form.phone}     onChange={v => setForm(f => ({ ...f, phone: v }))} />
                  <EditField label={t('staffPages.emailAddressLabel')} value={profile.user.email} onChange={() => {}} disabled />
                </>
              ) : (
                <>
                  <ReadField label={t('staffPages.fullName')}          value={`${profile.firstName} ${profile.lastName}`} />
                  <ReadField label={t('staffPages.emailAddressLabel')} value={profile.user.email} />
                  <ReadField label={t('staffPages.phoneNumberLabel')}  value={profile.phone || '—'} />
                  <ReadField label={t('form.role')}                    value={roleLabel} />
                </>
              )}
            </div>
          </div>

          {/* Registration Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900 text-base">{t('pharmacyOwner.registrationDetails')}</h2>
              <StatusBadge
                status={isApproved ? 'APPROVED' : 'PENDING'}
                label={isApproved ? t('pharmacyOwner.approved') : t('branch.pending')}
              />
            </div>

            <div className="space-y-0 text-sm divide-y divide-gray-50">
              {[
                { label: t('pharmacyOwner.pharmacyName'), value: profile.branch.pharmacy.name },
                { label: t('form.branch'),                value: profile.branch.name },
                { label: t('staffMgmt.memberSince'),      value: memberSince },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <p className="text-gray-400 font-medium">{label}</p>
                  <p className="font-semibold text-gray-800">{value}</p>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <p className="text-gray-400 font-medium">{t('staffPages.licenseStatus')}</p>
                <p className={`font-semibold ${isApproved ? 'text-gray-800' : 'text-orange-500'}`}>
                  {isApproved ? t('staffPages.licenseValid') : t('staffPages.actionRequired')}
                </p>
              </div>
            </div>
          </div>

          {/* Submitted Documents */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 text-base mb-4">{t('pharmacyOwner.submittedDocuments')}</h2>

            <div className="space-y-3">
              {documents.length === 0 && (
                <p className="text-sm text-gray-400 py-2">{t('staffPages.noDocOnFile')}</p>
              )}
              {documents.map(({ label, expiry, url, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{expiry}</p>
                    </div>
                  </div>
                  {url && (
                    <button
                      type="button"
                      onClick={() => openFile(url)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 text-blue-500 text-xs font-semibold hover:bg-blue-50 transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                      {t('common.view')}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-100">
              <ExclamationCircleIcon className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">
                {t('pharmacyOwner.documentsNotice')}
              </p>
            </div>
          </div>

          {/* ── Permissions panel ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0F7F6' }}>
                <ShieldCheckIcon className="w-4 h-4" style={{ color: '#2D9B8A' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{t('staffMgmt.permissions')}</h3>
                <p className="text-xs text-gray-400">
                  {permsLoading
                    ? t('common.loading')
                    : `${permissions.length} ${t('staffMgmt.selected')}`}
                </p>
              </div>
            </div>

            {permsLoading ? (
              <div className="flex justify-center py-4"><LoadingSpinner /></div>
            ) : permissions.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <LockClosedIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-500">{t('staffMgmt.noPermissionsAssigned', 'No permissions assigned yet. Contact your branch manager.')}</p>
              </div>
            ) : (
              // Group permissions by category for a cleaner read
              (() => {
                const groups: Record<string, string[]> = {
                  Orders:        ['VIEW_ORDERS','ACCEPT_ORDERS','UPDATE_ORDER_STATUS','CANCEL_ORDERS'],
                  Inventory:     ['VIEW_INVENTORY','ADD_MEDICATION','EDIT_MEDICATION','DELETE_MEDICATION','MANAGE_STOCK_TRANSFERS'],
                  Payments:      ['VIEW_PAYMENTS','PROCESS_PAYMENTS','ISSUE_REFUNDS'],
                  Prescriptions: ['VIEW_PRESCRIPTIONS','APPROVE_PRESCRIPTIONS','REJECT_PRESCRIPTIONS'],
                  Analytics:     ['VIEW_ANALYTICS','VIEW_REPORTS','EXPORT_DATA'],
                  Customers:     ['VIEW_CUSTOMERS','MANAGE_CUSTOMER_INFO'],
                  'Staff & Settings': ['VIEW_STAFF','MANAGE_STAFF','MANAGE_BRANCH_SETTINGS'],
                };
                const groupColors: Record<string, { bg: string; text: string; dot: string }> = {
                  Orders:             { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
                  Inventory:          { bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-400'   },
                  Payments:           { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400'  },
                  Prescriptions:      { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
                  Analytics:          { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
                  Customers:          { bg: 'bg-pink-50',   text: 'text-pink-700',   dot: 'bg-pink-400'   },
                  'Staff & Settings': { bg: 'bg-gray-100',  text: 'text-gray-700',   dot: 'bg-gray-400'   },
                };
                return (
                  <div className="space-y-3">
                    {Object.entries(groups).map(([groupName, groupPerms]) => {
                      const active = groupPerms.filter(p => permissions.includes(p));
                      if (active.length === 0) return null;
                      const c = groupColors[groupName];
                      return (
                        <div key={groupName}>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                            {groupName}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {active.map(perm => (
                              <span key={perm}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                                {perm.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
