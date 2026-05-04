// frontend/src/app/reset-password/page.tsx
'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import { LockClosedIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, MapPinIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { t } from 'i18next';

function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCodeChange = (idx: number, val: string) => {
    if (val.length > 1 || !/^\d*$/.test(val)) return;
    const next = [...code]; next[idx] = val; setCode(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };
  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(p)) return;
    setCode(p.split('').concat(Array(6 - p.length).fill('')));
    inputRefs.current[Math.min(p.length, 5)]?.focus();
  };

  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    numSym: /[\d\W]/.test(newPassword),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeStr = code.join('');
    if (codeStr.length !== 6) { toast.error(t('resetPassword.invalidCode')); return; }
    if (newPassword !== confirmPassword) { toast.error(t('resetPassword.passwordMismatch')); return; }
    if (newPassword.length < 8) { toast.error(t('resetPassword.passwordTooShort')); return; }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, resetCode: codeStr, newPassword, confirmPassword });
      toast.success(t('resetPassword.success'));
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('resetPassword.error'));
    } finally { setLoading(false); }
  };

  const inputCls = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm pr-10";

  return (
    <div className="min-h-screen flex relative">
    <div className="absolute top-4 right-4 z-10"><LanguageSwitcher /></div>

    {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-5/12 bg-linear-to-br from-[#1E4D8C] via-[#2563a8] to-[#1a3d6f] p-10 flex-col justify-between text-white">
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Evuze</h1>
          <p className="text-blue-200 text-sm">{t('auth.healthcarePlatform')}</p>
        </div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-3">{t('resetPassword.title')}</h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            {t('extras.auth.resetSubtitle')}
            </p>
        </div>
        <div className="space-y-4">
          {[
              { icon: MapPinIcon,    titleKey: 'extras.auth.featureFindPharmacies', descKey: 'extras.auth.featureFindPharmaciesShort' },
              { icon: ClockIcon,    titleKey: 'extras.auth.featureSaveTime',        descKey: 'extras.auth.featureSaveTimeShort' },
              { icon: UserGroupIcon, titleKey: 'extras.auth.featureConnect',        descKey: 'extras.auth.featureConnectShort' },
              { icon: ShieldCheckIcon, titleKey: 'extras.auth.featureSecure',       descKey: 'extras.auth.featureSecureShort' },
            ].map(({ icon: Icon, titleKey, descKey }) => (
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
      <p className="text-blue-300 text-xs">{t('landing.copyrightFull')}</p>
    </div>

    {/* RIGHT PANEL — scrollable */}
      <div className="w-full lg:w-7/12 flex flex-col bg-gray-50 h-screen overflow-hidden">
      <div className="px-8 pt-6 pb-3 bg-gray-50 shrink-0">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
          <LockClosedIcon className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{t('resetPassword.title')}</h2>
        <p className="text-gray-500 text-sm mt-1">{t('resetPassword.subtitle')}</p>
        {email && <p className="text-xs text-teal-600 font-medium mt-1">{t('extras.common.codeSentTo')} {email}</p>}
        </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          {/* Code inputs */}
            <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">{t('resetPassword.resetCode')}</label>
            <div className="flex gap-2">
              {code.map((digit, idx) => (
                  <input key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleCodeChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)} onPaste={handlePaste}
                    className="w-12 h-12 text-center text-lg font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    disabled={loading} />
              ))}
              </div>
            <p className="text-xs text-gray-400 mt-1">{t('resetPassword.codeHint')}</p>
          </div>

          {/* New password */}
            <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('resetPassword.newPassword')}</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} required value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} className={inputCls} placeholder={t('resetPassword.newPassword')} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
            </div>
            {/* Requirements */}
              <div className="mt-2 grid grid-cols-2 gap-1">
              {[
                  { ok: checks.length, label: t('resetPassword.minLength') },
                  { ok: checks.upper, label: t('resetPassword.uppercase') },
                  { ok: checks.lower, label: t('resetPassword.lowercase') },
                  { ok: checks.numSym, label: t('resetPassword.numberOrSymbol') },
                ].map(({ ok, label }) => (
                  <div key={label} className={`flex items-center gap-1 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{ok ? '' : ''}</span><span>{label}</span>
                </div>
              ))}
              </div>
          </div>

          {/* Confirm password */}
            <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('resetPassword.confirmPassword')}</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} required value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} className={inputCls} placeholder={t('resetPassword.confirmPassword')} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirm ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{t('form.passwordsDoNotMatch')}</p>
            )}
            </div>

          <button type="submit"
              disabled={loading || code.join('').length !== 6 || !Object.values(checks).every(Boolean) || newPassword !== confirmPassword}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('extras.auth.resetting')}</>
              : t('resetPassword.resetButton')}
            </button>

          <div className="text-center">
            <Link href="/login" className="text-sm text-teal-600 font-semibold hover:underline">
              ← {t('resetPassword.backToLogin')}
              </Link>
          </div>
        </form>
      </div>
    </div>
  </div>
);
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500 text-sm">{t('common.loading')}</div></div>}>
    <ResetPasswordForm />
  </Suspense>
);
}