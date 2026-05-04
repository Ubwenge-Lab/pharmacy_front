// frontend/src/app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import { EnvelopeIcon, ShieldCheckIcon, ClockIcon, MapPinIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error(t('form.enterEmail')); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      toast.success(t('forgotPassword.success'));
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('forgotPassword.error'));
    } finally { setLoading(false); }
  };

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
          <h2 className="text-2xl font-bold mb-3">{t('forgotPassword.title')}</h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            {t('extras.auth.forgotSubtitle')}
            </p>
        </div>
        <div className="space-y-4">
          {[
              { icon: MapPinIcon, titleKey: 'extras.auth.featureFindPharmacies', descKey: 'extras.auth.featureFindPharmaciesShort' },
              { icon: ClockIcon,  titleKey: 'extras.auth.featureSaveTime',       descKey: 'extras.auth.featureSaveTimeShort' },
              { icon: UserGroupIcon, titleKey: 'extras.auth.featureConnect',     descKey: 'extras.auth.featureConnectShort' },
              { icon: ShieldCheckIcon, titleKey: 'extras.auth.featureSecure',    descKey: 'extras.auth.featureSecureShort' },
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

    {/* RIGHT PANEL */}
      <div className="w-full lg:w-7/12 flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
          <EnvelopeIcon className="w-7 h-7 text-blue-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('forgotPassword.title')}</h2>
        <p className="text-gray-500 text-sm mb-8">{t('forgotPassword.infoText')}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('auth.email')}</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm transition-all" />
            </div>
          </div>

          <button type="submit" disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('extras.auth.sending')}</>
              : t('forgotPassword.sendCode')}
            </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-teal-600 font-semibold hover:underline">
            ← {t('forgotPassword.backToLogin')}
            </Link>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
             {t('extras.auth.checkSpamFolder')}
            </p>
        </div>
      </div>
    </div>
  </div>
);
}