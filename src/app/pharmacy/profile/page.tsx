'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CameraIcon, DocumentTextIcon, PencilIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import api, { unwrapItem } from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import type { PharmacyProfile } from '@/types';

const BLUE = '#1B72C8';

function getInitials(name: string = '') {
  return name
    .split(/\s+/)
    .filter(w => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w))
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function PharmacyProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PharmacyProfile | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile picture state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/pharmacies/profile/me')
      .then(r => {
        const d = unwrapItem<PharmacyProfile>(r.data);
        setProfile(d);
        setOwnerName(d?.representativeName ?? d?.ownerName ?? d?.name ?? '');
        setLogoUrl(d?.logoUrl ?? null);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/pharmacies/profile/me', { representativeName: ownerName });
      setEditing(false);
      toast.success(t('common.changesSaved', 'Changes saved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
    setSaving(false);
  };

  // ── Profile picture upload ──────────────────────────────────────────────
  const handlePhotoClick = () => {
    // Programmatically open the hidden file input
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    // Client-side validation: images only, max 5 MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('upload.invalidImageType', 'Please upload a JPEG, PNG, or WebP image.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('upload.imageTooLarge', 'Image must be under 5 MB.'));
      return;
    }

    setUploadingPhoto(true);
    try {
      // Step 1: Upload file → base64 data URI via the shared upload endpoint
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/upload/medication-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newLogoUrl: string = uploadRes.data?.url;
      if (!newLogoUrl) throw new Error('Upload response missing url');

      // Step 2: Persist the URL on the pharmacy profile
      await api.put('/pharmacies/profile/me', { logoUrl: newLogoUrl });

      // Step 3: Update local state so the avatar reflects immediately
      setLogoUrl(newLogoUrl);
      toast.success(t('pharmacyOwner.photoUpdated', 'Profile photo updated.'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        {t('common.loading')}
      </div>
    );
  }

  const initials = getInitials(ownerName);
  const licenseDate = profile?.dateOfIncorporation ? new Date(profile.dateOfIncorporation) : null;
  const isExpired = licenseDate ? licenseDate < new Date() : false;

  const registrationRows = [
    { label: t('pharmacyOwner.pharmacyName'), value: profile?.name ?? '—' },
    { label: t('pharmacyOwner.registrationNumber'), value: profile?.rdbCertificate ? 'On file' : '—' },
    {
      label: t('pharmacyOwner.approvalDate'),
      value: profile?.approvedAt
        ? new Date(profile.approvedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—',
    },
    {
      label: t('pharmacyOwner.licenseExpiry'),
      value: licenseDate
        ? licenseDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
        (isExpired ? ` — ${t('pharmacyOwner.expired')}` : '')
        : '—',
      expired: isExpired,
    },
    { label: t('common.address'), value: profile?.address ?? '—' },
    { label: t('common.phone'), value: profile?.phone ?? '—' },
  ];

  const docs = [
    profile?.pharmacyLicense ? { label: t('pharmacyOwner.pharmacyLicense'), value: profile.pharmacyLicense } : null,
    profile?.rdbCertificate  ? { label: t('pharmacyOwner.nationalId'),       value: profile.rdbCertificate  } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div
        className="rounded-2xl p-6 lg:p-8"
        style={{ background: 'linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)' }}
      >
        <h1 className="text-3xl lg:text-4xl font-bold text-brand-navy">
          {t('pharmacyOwner.myProfileTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('pharmacyOwner.pharmacyOwnerBreadcrumb')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: User card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col items-center text-center">

          {/* Avatar with working upload button */}
          <div className="relative mb-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={ownerName || 'Profile photo'}
                className="w-20 h-20 rounded-full object-cover select-none"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold select-none"
                style={{ background: 'linear-gradient(135deg, #3BAAEF 0%, #1B72C8 100%)' }}
              >
                {initials || '?'}
              </div>
            )}

            {/* Hidden file input — triggered by the camera button below */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              aria-hidden="true"
              onChange={handlePhotoChange}
            />

            {/* Camera button */}
            <button
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60 bg-brand-navy"
              aria-label={t('pharmacyOwner.clickToUpdatePhoto')}
              title={t('pharmacyOwner.clickToUpdatePhoto')}
            >
              {uploadingPhoto ? (
                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <CameraIcon className="w-[13px] h-[13px]" />
              )}
            </button>
          </div>

          <h3 className="font-bold text-gray-900 text-base leading-snug">{ownerName || '—'}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{t('pharmacyOwner.role')}</p>

          <span
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {t('pharmacyOwner.approved')}
          </span>

          {/* Pharmacy details */}
          <div className="w-full mt-5 pt-4 border-t border-gray-100 space-y-3 text-left">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Pharmacy</p>
              <p className="text-sm font-medium text-gray-800">{profile?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t('common.phone')}</p>
              <p className="text-sm font-medium text-gray-800">{profile?.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t('common.address')}</p>
              <p className="text-sm font-medium text-gray-800">{profile?.address ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Right: Info cards */}
        <div className="lg:col-span-2 space-y-5">

          {/* Personal Information */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">{t('pharmacyOwner.personalInformation')}</h3>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #3BAAEF 0%, #1B72C8 100%)' }}
                >
                  <PencilIcon className="w-[13px] h-[13px]" />
                  {t('pharmacyOwner.editProfile')}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #3BAAEF 0%, #1B72C8 100%)' }}
                  >
                    {saving ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  {t('pharmacyOwner.ownerName')}
                </p>
                {editing ? (
                  <input
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': BLUE } as React.CSSProperties}
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-800">{ownerName || '—'}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  {t('pharmacyOwner.emailAddress')}
                </p>
                <p className="text-sm font-medium text-gray-800">{profile?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  {t('common.phone')}
                </p>
                <p className="text-sm font-medium text-gray-800">{profile?.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Role
                </p>
                <p className="text-sm font-medium text-gray-800">{t('pharmacyOwner.role')}</p>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">{t('pharmacyOwner.registrationDetails')}</h3>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {t('pharmacyOwner.approved')}
              </span>
            </div>
            <div className="space-y-0">
              {registrationRows.map(({ label, value, expired }) => (
                <div
                  key={label}
                  className="flex justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm text-gray-500">{label}</p>
                  <p
                    className="text-sm font-medium text-right max-w-[55%]"
                    style={{ color: expired ? '#EF4444' : '#111827' }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submitted Documents — full width */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">{t('pharmacyOwner.submittedDocuments')}</h3>
        <div className="space-y-3">
          {docs.length === 0 && (
            <p className="text-sm text-gray-400 py-2">{t('staffPages.noDocOnFile')}</p>
          )}
          {docs.map(doc => (
            <div
              key={doc.label}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#EBF4FF' }}
                >
                  <DocumentTextIcon className="w-[18px] h-[18px] text-brand-navy" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{doc.label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{doc.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Warning notice */}
        <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <ExclamationCircleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">{t('pharmacyOwner.documentsNotice')}</p>
        </div>
      </div>

    </div>
  );
}
