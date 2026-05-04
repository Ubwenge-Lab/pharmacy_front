// frontend/src/app/pharmacy-rejected/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

export default function PharmacyRejectedPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pharmacyData, setPharmacyData] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    representativeName: '',
    phone: '',
    address: '',
    dateOfIncorporation: '',
    rdbCertificate: '',
    pharmacyLicense: '',
  });

  // Redirect if user is not rejected pharmacy
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'PHARMACY') {
      router.push('/dashboard');
      return;
    }

    if (user.pharmacyStatus === 'APPROVED') {
      router.push('/pharmacy/dashboard');
      return;
    }

    if (user.pharmacyStatus === 'PENDING') {
      router.push('/pending-approval');
      return;
    }

    // Load existing pharmacy data
    loadPharmacyData();
  }, [user, router]);

  const loadPharmacyData = async () => {
    try {
      const res = await api.get('/pharmacies/profile/me');
      setPharmacyData(res.data);
      setFormData({
        name: res.data.name || '',
        representativeName: res.data.representativeName || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        dateOfIncorporation: res.data.dateOfIncorporation 
          ? new Date(res.data.dateOfIncorporation).toISOString().split('T')[0] 
          : '',
        rdbCertificate: res.data.rdbCertificate || '',
        pharmacyLicense: res.data.pharmacyLicense || '',
      });
    } catch (error) {
      console.error('Failed to load pharmacy data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.patch('/pharmacies/profile/resubmit', formData);
      toast.success(t('success.applicationResubmitted'));
      // Refresh user data to update status
      window.location.href = '/pending-approval';
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('extras.errors.failedToResubmit'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleFileUpload = async (field: 'rdbCertificate' | 'pharmacyLicense', file: File) => {
    // In a real implementation, upload to S3 or your file storage
    // For now, we'll use base64 encoding
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        [field]: reader.result as string,
      }));
      toast.success(t('success.documentUploaded'));
    };
    reader.readAsDataURL(file);
  };

  if (!user || user.role !== 'PHARMACY' || user.pharmacyStatus !== 'REJECTED') {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-red-600 via-orange-600 to-yellow-600 flex items-center justify-center px-4 py-8 relative overflow-hidden">
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
      <div className="max-w-3xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-12 relative z-10 max-h-[90vh] overflow-y-auto">
      {/* Header */}
        <div className="text-center mb-8">
        <div className="text-6xl mb-4"></div>
        <h1 className="text-3xl md:text-4xl font-bold text-red-600 dark:text-red-500 mb-4">
          {t('extras.pharmacyRejected.title')}
          </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
          {t('extras.pharmacyRejected.subtitle')}
          </p>
      </div>

      {/* Rejection Reason */}
        {pharmacyData?.rejectionReason && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-3xl"></div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t('extras.pharmacyRejected.rejectionReasonLabel')}
                </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {pharmacyData.rejectionReason}
                </p>
            </div>
          </div>
        </div>
      )}

        {/* Resubmission Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('extras.pharmacyRejected.pharmacyNameRequired')}
              </label>
            <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('extras.pharmacyRejected.representativeNameRequired')}
              </label>
            <input
                type="text"
                value={formData.representativeName}
                onChange={(e) => setFormData({ ...formData, representativeName: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('extras.pharmacyRejected.phoneNumberRequired')}
              </label>
            <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('extras.pharmacyRejected.dateOfIncorporationRequired')}
              </label>
            <input
                type="date"
                value={formData.dateOfIncorporation}
                onChange={(e) => setFormData({ ...formData, dateOfIncorporation: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('extras.pharmacyRejected.addressRequired')}
            </label>
          <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
        </div>

        {/* Document Uploads */}
          <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('extras.pharmacyRejected.rdbCertificateRequired')}
              </label>
            <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('rdbCertificate', file);
                }}
                className="w-full"
              />
            {formData.rdbCertificate && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                 {t('extras.pharmacyRejected.documentUploaded')}
                </p>
            )}
            </div>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('extras.pharmacyRejected.pharmacyLicenseRequired')}
              </label>
            <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('pharmacyLicense', file);
                }}
                className="w-full"
              />
            {formData.pharmacyLicense && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                 {t('extras.pharmacyRejected.documentUploaded')}
                </p>
            )}
            </div>
        </div>

        {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-linear-to-r from-orange-600 to-red-600 text-white py-4 rounded-xl font-bold hover:from-orange-700 hover:to-red-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {loading ? (
                <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('pharmacyRejected.resubmitting')}</span>
              </div>
            ) : (
                t('extras.pharmacyRejected.resubmitApplication')
              )}
            </button>
            
          <button
              type="button"
              onClick={handleLogout}
              className="px-8 py-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
            >
            {t('common.logout')}
            </button>
        </div>
      </form>

      {/* Contact Info */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('extras.pharmacyRejected.contactSupport')}
          </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Email: <span className="text-orange-600 dark:text-orange-400 font-medium">support@evuze.com</span>
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