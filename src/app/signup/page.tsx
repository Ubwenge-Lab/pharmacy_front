// frontend/src/app/signup/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import LocationPicker from '@/components/shared/LocationPicker';
import {
  EnvelopeIcon, LockClosedIcon, UserIcon, PhoneIcon,
  BuildingStorefrontIcon, BuildingOffice2Icon, EyeIcon, EyeSlashIcon,
  MapPinIcon, ClockIcon, UserGroupIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { isPatientEnabled, checkAndSetDevMode } from '@/lib/features';

type Role = 'PATIENT' | 'PHARMACY' | 'HOSPITAL';

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const patientEnabled = isPatientEnabled();
  const [role, setRole] = useState<Role>(patientEnabled ? 'PATIENT' : 'PHARMACY');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    checkAndSetDevMode();
  }, []);

  // ── Patient form state ───────────────────────────────────────────────────
  const [patientForm, setPatientForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '', address: '',
    dateOfBirth: '', gender: 'MALE',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  // ── Pharmacy form state ──────────────────────────────────────────────────
  const [pharmacyForm, setPharmacyForm] = useState({
    email: '', password: '', confirmPassword: '',
    pharmacyName: '', representativeName: '', phone: '',
    address: '', dateOfIncorporation: '',
    rdbCertificate: '',
    pharmacyLicense: '',
    businessRegistration: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  // ── Hospital form state ──────────────────────────────────────────────────
  const [hospitalForm, setHospitalForm] = useState({
    email: '', password: '', confirmPassword: '',
    hospitalName: '', representativeName: '', phone: '',
    address: '', dateOfIncorporation: '',
    rdbCertificate: '',
    hospitalLicense: '',
    businessRegistration: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  // ── Patient submit ───────────────────────────────────────────────────────
  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (patientForm.password !== patientForm.confirmPassword) {
      toast.error(t('signup.passwordsDoNotMatch')); return;
    }
    if (patientForm.password.length < 8) {
      toast.error(t('signup.passwordTooShort')); return;
    }
    if (patientForm.latitude === undefined || patientForm.longitude === undefined) {
      toast.error('Please pin your home location on the map before submitting.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...patientForm,
        // Only include lat/lng if the user actually pinned a location
        latitude: patientForm.latitude,
        longitude: patientForm.longitude,
      };
      const res = await api.post('/auth/register/patient', payload);
      toast.success(res.data.message || t('signup.accountCreated'));
      router.push(`/verify-email?email=${encodeURIComponent(patientForm.email)}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setLoading(false); }
  };

  // ── Pharmacy submit ──────────────────────────────────────────────────────
  const handlePharmacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pharmacyForm.password !== pharmacyForm.confirmPassword) {
      toast.error(t('signup.passwordsDoNotMatch')); return;
    }
    if (!pharmacyForm.rdbCertificate || !pharmacyForm.pharmacyLicense || !pharmacyForm.businessRegistration) {
      toast.error(t('signup.fillDocuments')); return;
    }
    // Coordinates are required for pharmacies
    if (pharmacyForm.latitude === undefined || pharmacyForm.longitude === undefined) {
      toast.error('Please pin your pharmacy location on the map before submitting.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register/pharmacy', pharmacyForm);
      toast.success(res.data.message || t('signup.applicationSubmitted'));
      router.push(`/verify-email?email=${encodeURIComponent(pharmacyForm.email)}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setLoading(false); }
  };

  // ── Hospital submit ──────────────────────────────────────────────────────
  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hospitalForm.password !== hospitalForm.confirmPassword) {
      toast.error(t('signup.passwordsDoNotMatch')); return;
    }
    if (hospitalForm.latitude === undefined || hospitalForm.longitude === undefined) {
      toast.error('Please pin your hospital location on the map before submitting.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register/hospital', hospitalForm);
      toast.success(res.data.message || 'Hospital application submitted for review.');
      router.push(`/verify-email?email=${encodeURIComponent(hospitalForm.email)}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally { setLoading(false); }
  };

  const inputCls = "w-full pl-11 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all text-gray-900 text-sm";
  const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

  const sidebarFeatures = [
    { icon: MapPinIcon, titleKey: 'auth.findPharmacies', descKey: 'auth.findPharmaciesDesc' },
    { icon: ClockIcon, titleKey: 'auth.saveTime', descKey: 'auth.saveTimeDesc' },
    { icon: UserGroupIcon, titleKey: 'auth.connectHealthcare', descKey: 'auth.connectHealthcareDesc' },
    { icon: ShieldCheckIcon, titleKey: 'auth.securePrivate', descKey: 'auth.securePrivateDesc' },
  ];

  return (
    <div className="min-h-screen flex relative">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10"><LanguageSwitcher /></div>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-5/12 bg-linear-to-br from-brand-navy via-[#2563a8] to-brand-navy-dark p-10 flex-col justify-between text-white">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1">E-Vuze</h1>
            <p className="text-blue-200 text-sm">{t('auth.healthcarePlatform')}</p>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-3">{t('auth.joinEvuze')}</h2>
            <p className="text-blue-100 text-sm leading-relaxed">
              {t('auth.joinDescExtended')}
            </p>
          </div>
          <div className="space-y-4">
            {sidebarFeatures.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="flex items-start gap-3">
                <Icon className="w-5 h-5 shrink-0 mt-0.5 text-teal-300" />
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{t(titleKey)}</h3>
                  <p className="text-blue-200 text-xs">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-300 text-xs">{t('signup.copyrightYear')}</p>
      </div>

      {/* RIGHT PANEL — only form area scrolls */}
      <div className="w-full lg:w-7/12 flex flex-col bg-gray-50 h-screen overflow-hidden">
        {/* Fixed header */}
        <div className="px-8 pt-6 pb-3 bg-gray-50 shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{t('signup.createAccount')}</h2>
          <p className="text-gray-500 text-sm mt-1">{t('signup.createAccountSubtitle')}</p>

          {/* Role Switcher — Pharmacy/Hospital always shown; Patient only when the feature flag is on */}
          <div className="flex mt-4 bg-gray-200 rounded-lg p-1 w-fit">
            {patientEnabled && (
              <button
                onClick={() => setRole('PATIENT')}
                className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-semibold transition-all ${role === 'PATIENT' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <UserIcon className="w-4 h-4" /> {t('signup.patientTab')}
              </button>
            )}
            <button
              onClick={() => setRole('PHARMACY')}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-semibold transition-all ${role === 'PHARMACY' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <BuildingStorefrontIcon className="w-4 h-4" /> {t('signup.pharmacyOwnerTab')}
            </button>
            <button
              onClick={() => setRole('HOSPITAL')}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-semibold transition-all ${role === 'HOSPITAL' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <BuildingOffice2Icon className="w-4 h-4" /> Hospital
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">

          {/* ═══════════════════════════════════════════════════════════════
              PATIENT FORM
          ═══════════════════════════════════════════════════════════════ */}
          {role === 'PATIENT' ? (
            <form onSubmit={handlePatientSubmit} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('signup.firstName')}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={patientForm.firstName}
                      onChange={e => setPatientForm({...patientForm, firstName: e.target.value})}
                      className={inputCls} placeholder="John" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('signup.lastName')}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={patientForm.lastName}
                      onChange={e => setPatientForm({...patientForm, lastName: e.target.value})}
                      className={inputCls} placeholder="Doe" />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.email')}</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" required value={patientForm.email}
                    onChange={e => setPatientForm({...patientForm, email: e.target.value})}
                    className={inputCls} placeholder="you@example.com" />
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.phone')}</label>
                <div className="relative">
                  <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" required value={patientForm.phone}
                    onChange={e => setPatientForm({...patientForm, phone: e.target.value})}
                    className={inputCls} placeholder="+250 7XX XXX XXX" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('signup.dateOfBirth')}</label>
                  <input type="date" required value={patientForm.dateOfBirth}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setPatientForm({...patientForm, dateOfBirth: e.target.value})}
                    className={inputCls.replace('pl-11','pl-3')} />
                </div>
                <div>
                  <label className={labelCls}>{t('signup.gender')}</label>
                  <select value={patientForm.gender}
                    onChange={e => setPatientForm({...patientForm, gender: e.target.value})}
                    className={inputCls.replace('pl-11','pl-3')}>
                    <option value="MALE">{t('signup.genderMale')}</option>
                    <option value="FEMALE">{t('signup.genderFemale')}</option>
                    <option value="OTHER">{t('signup.genderOther')}</option>
                  </select>
                </div>
              </div>

              {/* Text address */}
              <div>
                <label className={labelCls}>{t('signup.address')}</label>
                <div className="relative">
                  <MapPinIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea value={patientForm.address}
                    onChange={e => setPatientForm({...patientForm, address: e.target.value})}
                    className={`${inputCls} resize-none`} rows={2} placeholder={t('signup.yourAddress')} />
                </div>
              </div>

              {/* Map picker — optional for patients */}
              <LocationPicker
                lazy
                latitude={patientForm.latitude}
                longitude={patientForm.longitude}
                onChange={(lat, lng) => setPatientForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                required={true}
                label="Pin Your Home Location"
                height="260px"
              />

              <div>
                <label className={labelCls}>{t('signup.password')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} required minLength={8}
                    value={patientForm.password}
                    onChange={e => setPatientForm({...patientForm, password: e.target.value})}
                    className={`${inputCls} pr-10`} placeholder={t('signup.minChars')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.confirmPassword')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showConfirm ? 'text' : 'password'} required
                    value={patientForm.confirmPassword}
                    onChange={e => setPatientForm({...patientForm, confirmPassword: e.target.value})}
                    className={`${inputCls} pr-10`} placeholder={t('signup.repeatPassword')} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> {t('auth.creatingAccount')}</span>
                  : t('signup.createAccount')}
              </button>

              <p className="text-center text-sm text-gray-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/login" className="text-teal-600 font-semibold hover:underline">{t('auth.signIn')}</Link>
              </p>
            </form>

          ) : role === 'PHARMACY' ? (
          /* ═══════════════════════════════════════════════════════════════
              PHARMACY FORM
          ═══════════════════════════════════════════════════════════════ */
            <form onSubmit={handlePharmacySubmit} className="space-y-4 max-w-lg">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                ℹ {t('signup.applicationNotice')}
              </div>

              <div>
                <label className={labelCls}>{t('signup.pharmacyName')}</label>
                <div className="relative">
                  <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" required value={pharmacyForm.pharmacyName}
                    onChange={e => setPharmacyForm({...pharmacyForm, pharmacyName: e.target.value})}
                    className={inputCls} placeholder={t('signup.pharmacyNamePlaceholder')} />
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.representativeName')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" required value={pharmacyForm.representativeName}
                    onChange={e => setPharmacyForm({...pharmacyForm, representativeName: e.target.value})}
                    className={inputCls} placeholder={t('signup.representativeNamePlaceholder')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('signup.email')}</label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" required value={pharmacyForm.email}
                      onChange={e => setPharmacyForm({...pharmacyForm, email: e.target.value})}
                      className={inputCls} placeholder="pharmacy@email.com" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('signup.phone')}</label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" required value={pharmacyForm.phone}
                      onChange={e => setPharmacyForm({...pharmacyForm, phone: e.target.value})}
                      className={inputCls} placeholder="+250 7XX XXX XXX" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('signup.dateOfIncorporation')}</label>
                  <input type="date" required value={pharmacyForm.dateOfIncorporation}
                    onChange={e => setPharmacyForm({...pharmacyForm, dateOfIncorporation: e.target.value})}
                    className={inputCls.replace('pl-11','pl-3')} />
                </div>
                <div>
                  <label className={labelCls}>{t('signup.address')}</label>
                  <div className="relative">
                    <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={pharmacyForm.address}
                      onChange={e => setPharmacyForm({...pharmacyForm, address: e.target.value})}
                      className={inputCls} placeholder={t('signup.pharmacyAddressPlaceholder')} />
                  </div>
                </div>
              </div>

              {/* Map picker — REQUIRED for pharmacies */}
              <LocationPicker
                lazy
                latitude={pharmacyForm.latitude}
                longitude={pharmacyForm.longitude}
                onChange={(lat, lng) => setPharmacyForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                required={true}
                label="Pin Pharmacy Location on Map"
                height="300px"
              />

              {/* Documents */}
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    {t('signup.rdbCertificateNumber')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <ShieldCheckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={pharmacyForm.rdbCertificate}
                      onChange={e => setPharmacyForm({...pharmacyForm, rdbCertificate: e.target.value})}
                      className={inputCls} placeholder={t('signup.rdbCertificatePlaceholder')} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('signup.pharmacyLicenseNumber')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <ShieldCheckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={pharmacyForm.pharmacyLicense}
                      onChange={e => setPharmacyForm({...pharmacyForm, pharmacyLicense: e.target.value})}
                      className={inputCls} placeholder={t('signup.pharmacyLicensePlaceholder')} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('signup.businessRegistrationNumber')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={pharmacyForm.businessRegistration}
                      onChange={e => setPharmacyForm({...pharmacyForm, businessRegistration: e.target.value})}
                      className={inputCls} placeholder={t('signup.businessRegistrationPlaceholder')} />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.password')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} required minLength={8}
                    value={pharmacyForm.password}
                    onChange={e => setPharmacyForm({...pharmacyForm, password: e.target.value})}
                    className={`${inputCls} pr-10`} placeholder={t('signup.minChars')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.confirmPassword')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showConfirm ? 'text' : 'password'} required
                    value={pharmacyForm.confirmPassword}
                    onChange={e => setPharmacyForm({...pharmacyForm, confirmPassword: e.target.value})}
                    className={`${inputCls} pr-10`} placeholder={t('signup.repeatPassword')} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> {t('auth.submitting')}</span>
                  : t('auth.submitApplication')}
              </button>

              <p className="text-center text-sm text-gray-600">
                {t('auth.alreadyRegistered')}{' '}
                <Link href="/login" className="text-teal-600 font-semibold hover:underline">{t('auth.signIn')}</Link>
              </p>
            </form>

          ) : (
          /* ═══════════════════════════════════════════════════════════════
              HOSPITAL FORM
          ═══════════════════════════════════════════════════════════════ */
            <form onSubmit={handleHospitalSubmit} className="space-y-4 max-w-lg">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                ℹ Your application will be reviewed by our team within 24–48 hours.
              </div>

              <div>
                <label className={labelCls}>Hospital Name</label>
                <div className="relative">
                  <BuildingOffice2Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" required value={hospitalForm.hospitalName}
                    onChange={e => setHospitalForm({...hospitalForm, hospitalName: e.target.value})}
                    className={inputCls} placeholder="e.g. King Faisal Hospital" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Representative Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" required value={hospitalForm.representativeName}
                    onChange={e => setHospitalForm({...hospitalForm, representativeName: e.target.value})}
                    className={inputCls} placeholder="Full name of the hospital admin" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" required value={hospitalForm.email}
                      onChange={e => setHospitalForm({...hospitalForm, email: e.target.value})}
                      className={inputCls} placeholder="admin@hospital.com" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" required value={hospitalForm.phone}
                      onChange={e => setHospitalForm({...hospitalForm, phone: e.target.value})}
                      className={inputCls} placeholder="+250 7XX XXX XXX" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date of Incorporation</label>
                  <input type="date" value={hospitalForm.dateOfIncorporation}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setHospitalForm({...hospitalForm, dateOfIncorporation: e.target.value})}
                    className={inputCls.replace('pl-11','pl-3')} />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <div className="relative">
                    <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" required value={hospitalForm.address}
                      onChange={e => setHospitalForm({...hospitalForm, address: e.target.value})}
                      className={inputCls} placeholder="Hospital street address" />
                  </div>
                </div>
              </div>

              {/* Map picker — REQUIRED for hospitals */}
              <LocationPicker
                lazy
                latitude={hospitalForm.latitude}
                longitude={hospitalForm.longitude}
                onChange={(lat, lng) => setHospitalForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                required={true}
                label="Pin Hospital Location on Map"
                height="300px"
              />

              {/* Documents */}
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>RDB Certificate Number <span className="text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <ShieldCheckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={hospitalForm.rdbCertificate}
                      onChange={e => setHospitalForm({...hospitalForm, rdbCertificate: e.target.value})}
                      className={inputCls} placeholder="RDB-XXXXXXXX" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Hospital License Number <span className="text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <ShieldCheckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={hospitalForm.hospitalLicense}
                      onChange={e => setHospitalForm({...hospitalForm, hospitalLicense: e.target.value})}
                      className={inputCls} placeholder="License number" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Business Registration Number <span className="text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <BuildingOffice2Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={hospitalForm.businessRegistration}
                      onChange={e => setHospitalForm({...hospitalForm, businessRegistration: e.target.value})}
                      className={inputCls} placeholder="Business registration number" />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} required minLength={8}
                    value={hospitalForm.password}
                    onChange={e => setHospitalForm({...hospitalForm, password: e.target.value})}
                    className={`${inputCls} pr-10`} placeholder={t('signup.minChars')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('signup.confirmPassword')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showConfirm ? 'text' : 'password'} required
                    value={hospitalForm.confirmPassword}
                    onChange={e => setHospitalForm({...hospitalForm, confirmPassword: e.target.value})}
                    className={`${inputCls} pr-10`} placeholder={t('signup.repeatPassword')} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Submitting…</span>
                  : 'Submit Application'}
              </button>

              <p className="text-center text-sm text-gray-600">
                {t('auth.alreadyRegistered')}{' '}
                <Link href="/login" className="text-teal-600 font-semibold hover:underline">{t('auth.signIn')}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
