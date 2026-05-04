// frontend/src/app/pending-approval/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

export default function PendingApprovalPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'PHARMACY') { router.push('/dashboard'); return; }
    if (user.pharmacyStatus !== 'PENDING') { router.push('/pharmacy/dashboard'); }
  }, [user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user || user.role !== 'PHARMACY' || user.pharmacyStatus !== 'PENDING') {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center px-4 py-8 relative overflow-hidden">
    {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
      <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
    </div>

    {/* Language Switcher - Top Right */}
      <div className="absolute top-6 right-6 z-20">
      <LanguageSwitcher />
    </div>

    {/* Main Card */}
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-12 relative z-10">
      {/* Animated Loading Spinner */}
        <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-8 border-gray-200 dark:border-gray-700"></div>
            <div className="absolute inset-0 w-32 h-32 rounded-full border-8 border-transparent border-t-green-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-5xl"></div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-500 mb-4">
          {t('pending.title')}
          </h1>
          
        <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">
          {t('pending.subtitle')}
          </p>

        <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
          {t('pending.processing')}
            <span className="inline-block w-8 text-left">{dots}</span>
        </p>
      </div>

      {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="text-3xl">ℹ</div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('pending.infoTitle')}
              </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('pending.infoText')}
              </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
        <div className="text-center mb-8">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {t('pending.timeline')}
          </p>
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          24-48 {t('pending.hours')}
          </p>
      </div>

      {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
            onClick={handleLogout}
            className="px-8 py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all transform hover:scale-105"
          >
          {t('common.logout')}
          </button>
      </div>

      {/* Contact Info */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('pending.contactInfo')}
          </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          {t('pending.email')}: <span className="text-purple-600 dark:text-purple-400 font-medium">support@evuze.com</span>
        </p>
      </div>
    </div>

    {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm opacity-75">
      {t('landing.copyright2025')}
      </div>
  </div>
);
}