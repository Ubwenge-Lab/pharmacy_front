// frontend/src/app/page.tsx 
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { removeAuthTokens, clearUserCache } from '@/lib/auth';
import { isPatientEnabled, checkAndSetDevMode } from '@/lib/features';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';


export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && user) {
      switch (user.role) {
        case 'PATIENT': router.push('/patient/dashboard'); break;
        case 'PHARMACY':
          if (user.pharmacyStatus === 'APPROVED') {
            router.push('/pharmacy/dashboard');
          } else if (user.pharmacyStatus === 'PENDING') {
            router.push('/pending-approval');
          } else if (user.pharmacyStatus === 'REJECTED') {
            router.push('/pharmacy-rejected');
          } else {
            removeAuthTokens();
            clearUserCache();
            setTimeout(() => window.location.reload(), 100);
          }
          break;
        case 'SUPER_ADMIN': router.push('/super-admin/dashboard'); break;
        case 'BRANCH_MANAGER': router.push('/branch/dashboard'); break;
        case 'PHARMACIST':
        case 'CASHIER':
        case 'NURSE': router.push('/staff/dashboard'); break;
        default:
          // If the cookie is corrupted or role is unauthorized, clear it!
          removeAuthTokens();
          clearUserCache();
          setTimeout(() => window.location.reload(), 100);
          break;
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    checkAndSetDevMode();
  }, []);

  const patientEnabled = isPatientEnabled();

  // Render the landing page while the session check is still running instead of
  // a spinner: the spinner was what got server-rendered, so the hero (the LCP
  // element) only appeared after all the JS had loaded. Logged-in users are
  // still redirected by the effect above as soon as the check finishes.
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F7FF' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 border-brand-teal border-t-transparent" />
          <p className="font-medium text-brand-navy">{t('landing.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8FBFF' }}>

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div>
          <span className="text-2xl font-extrabold text-brand-navy">E-Vuze</span>
          <p className="text-xs font-medium text-brand-teal">{t('landing.brandTagline')}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/login"
            className="px-5 py-2 rounded-lg font-semibold text-sm border-2 transition-all hover:bg-gray-50 text-brand-navy border-brand-navy">
            {t('landing.login')}
          </Link>
          <Link href="/signup"
            className="px-5 py-2 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 shadow-md bg-brand-teal">
            {t('landing.signUp')}
          </Link>
        </div>
      </nav>

      <main className="flex-1">

        {/* HERO */}
        <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-24">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border text-brand-navy border-[#BDD9FF]"
            style={{ background: '#EAF4FF' }}>
            <span className="w-2 h-2 rounded-full animate-pulse bg-brand-teal" />
            {patientEnabled ? t('landing.badgePatient') : t('landing.badgePharmacy')}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-4 max-w-4xl text-brand-navy-dark">
            {patientEnabled ? (
              <>
                {t('landing.heroTitlePatientPre')}{' '}
                <span className="text-brand-teal">{t('landing.heroTitlePatientHighlight')}</span>
              </>
            ) : (
              <>
                {t('landing.heroTitlePharmacyPre')}{' '}
                <span className="text-brand-teal">{t('landing.heroTitlePharmacyHighlight')}</span>
              </>
            )}
          </h1>

          <p className="text-lg text-gray-500 max-w-2xl mb-10 leading-relaxed">
            {patientEnabled
              ? t('landing.heroSubtitlePatient')
              : t('landing.heroSubtitlePharmacy')}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white text-base shadow-lg transition-all hover:opacity-90 hover:-translate-y-0.5 bg-brand-teal">
              {patientEnabled ? t('landing.getStarted') : t('landing.registerPharmacy')}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base border-2 transition-all hover:bg-gray-50 text-brand-navy border-[#d1dff5]">
              {t('landing.login')}
            </Link>

          </div>
        </section>


        {/* WHY CHOOSE EVUZE */}
        <section className="py-20 px-6 bg-brand-navy">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-14">{t('landing.whyChooseTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              {[
                {
                  svg: <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                  title: t('landing.featureFindTitle'),
                  desc: t('landing.featureFindDesc'),
                },
                {
                  svg: <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
                  title: t('landing.featureConnectTitle'),
                  desc: t('landing.featureConnectDesc'),
                },
                {
                  svg: <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
                  title: t('landing.featureSecureTitle'),
                  desc: t('landing.featureSecureDesc'),
                },
              ].map(({ svg, title, desc }) => (
                <div key={title} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 text-white"
                    style={{ background: 'rgba(255,255,255,0.12)' }}>
                    {svg}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 text-center bg-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-brand-navy-dark">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            {patientEnabled
              ? t('landing.ctaSubtitlePatient')
              : t('landing.ctaSubtitlePharmacy')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {patientEnabled && (
              <Link href="/signup"
                className="px-7 py-3 rounded-xl font-bold text-white text-sm shadow-md transition-all hover:opacity-90 bg-brand-teal">
                {t('landing.ctaImPatient')}
              </Link>
            )}
            <Link href="/signup"
              className="px-7 py-3 rounded-xl font-bold text-sm border-2 transition-all hover:bg-blue-50 text-brand-navy border-brand-navy">
              {patientEnabled ? t('landing.ctaImPharmacy') : t('landing.registerPharmacy')}
            </Link>
          </div>
        </section>

      </main>

      <footer className="py-5 text-center text-sm text-gray-400 border-t border-gray-100 bg-white">
        {t('landing.footerCopyright')}
      </footer>
    </div>
  );
}
