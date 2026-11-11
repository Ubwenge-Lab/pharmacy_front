// frontend/src/app/login/page.tsx

import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in — E-Vuze',
  description:
    'Sign in to E-Vuze to manage your pharmacy, place medication orders, or access your patient dashboard.',
};

const features = [
  {
    title: 'Find Pharmacies Near You',
    desc:  'Locate open pharmacies, check stock, and order medications from your area.',
  },
  {
    title: 'Save Time',
    desc:  'Order online and pick up or receive delivery — no more waiting in queues.',
  },
  {
    title: 'Connect with Healthcare',
    desc:  'Manage prescriptions and stay connected with your pharmacy and care team.',
  },
  {
    title: 'Secure & Private',
    desc:  'Your health data is encrypted and never shared without your consent.',
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — server-rendered, no JS needed */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-brand-navy via-[#2563a8] to-brand-navy-dark p-12 flex-col justify-between text-white">
        <div>
          <div className="mb-16">
            <h1 className="text-4xl font-bold mb-2">E-Vuze</h1>
            <p className="text-blue-100 text-lg">Healthcare Platform</p>
          </div>

          <div className="mb-12">
            <h2 className="text-5xl font-bold mb-6">Welcome back</h2>
            <p className="text-xl text-blue-100 leading-relaxed">
              Your complete pharmacy and healthcare management platform.
            </p>
          </div>

          <div className="space-y-6">
            <p className="text-xl font-semibold mb-4">With E-Vuze you can</p>
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-8 h-8 shrink-0 mt-1 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                  <p className="text-blue-100">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-blue-200 text-sm">
          Trusted by pharmacies and patients across Rwanda.
        </div>
      </div>

      {/* Right panel — interactive form, client component */}
      <LoginForm />
    </div>
  );
}
