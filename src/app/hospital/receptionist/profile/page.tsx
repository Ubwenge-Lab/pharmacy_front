'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Calendar, Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const NAVY = '#1E3A5F';
const TEAL = '#38BDF8';
const GRADIENT = 'linear-gradient(90deg, #0284C7 0%, #38BDF8 100%)';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-4 text-sm text-gray-700 outline-none ' +
  'focus:ring-2 disabled:bg-white disabled:text-gray-600 transition-all min-h-11';

const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

export default function ReceptionistProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const hospitalId = (user as any)?.hospitalId || '';

  const [p, setProfile] = useState<any>({
    fullName: '', phone: '', email: '', username: '', department: '', address: '', dateOfJoining: '', jobTitle: '', roleLabel: '', joinedAt: ''
  });
  const [loading, setLoading] = useState(true);
  const [errorProp, setErrorProp] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', username: '', department: '', address: '', dateOfJoining: ''
  });

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false);
      setErrorProp('No hospital session found. Please log in.');
      return;
    }
    api.get(`/hospitals/${hospitalId}/receptionist/profile`)
      .then(res => {
        const data = res.data?.data || res.data;
        setProfile(data);
        setForm({
          fullName: data.fullName || '', phone: data.phone || '', email: data.email || '',
          username: data.username || '', department: data.department || '', address: data.address || '',
          dateOfJoining: data.dateOfJoining || ''
        });
      })
      .catch(() => setErrorProp('Failed to fetch profile.'))
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
    // reset so selecting the same file again still fires onChange
    e.target.value = '';
  };

  return (
    <div className="space-y-6">

      {/* ── Hero header ── */}
      <div className="rounded-2xl px-6 sm:px-10 py-7" style={{ background: '#EBF5FF' }}>
        <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: NAVY }}>{t('hospital.myProfile', 'My Profile')}</h1>
        <p className="mt-2 text-sm sm:text-base" style={{ color: TEAL }}>
          {t('hospital.updatePersonalInfo', 'Update your personal information')}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {errorProp && (
          <div className="w-full bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {errorProp}
          </div>
        )}
        {loading && (
          <div className="w-full p-8 text-center text-gray-500 animate-pulse">Loading profile...</div>
        )}

        {/* ── Profile summary card ── */}
        <div className="w-full lg:w-80 lg:shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: '#EBF5FF' }}
              >
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={44} style={{ color: '#2563EB' }} />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 bg-white rounded-full p-1 shadow border border-gray-100 transition-transform hover:scale-110"
                aria-label="Change photo"
              >
                <Pencil size={13} style={{ color: '#2563EB' }} />
              </button>
            </div>
            <p className="mt-4 font-bold text-lg text-gray-900">{p.fullName}</p>
            <p className="text-sm text-gray-400 mt-0.5">{p.jobTitle}</p>
            <span
              className="mt-3 inline-flex px-4 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: '#EBF5FF', color: '#2563EB' }}
            >
              {p.roleLabel}
            </span>
          </div>

          <div className="border-t border-gray-100 my-5" />

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Mail size={16} style={{ color: TEAL }} className="shrink-0" />
              <span className="break-all">{p.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Phone size={16} style={{ color: TEAL }} className="shrink-0" />
              <span>{p.phone}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Calendar size={16} style={{ color: TEAL }} className="shrink-0" />
              <span>{t('hospital.joinedOn', 'Joined on')} {p.joinedAt}</span>
            </div>
          </div>

          <button
            onClick={() => setEditing((v) => !v)}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-blue-50"
            style={{ borderColor: '#2563EB', color: '#2563EB' }}
          >
            <Pencil size={14} />
            {editing ? t('common.cancel') : t('hospital.editProfile', 'Edit Profile')}
          </button>
        </div>

        {/* ── Personal information form ── */}
        <div className="flex-1 w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full p-2" style={{ backgroundColor: '#EBF5FF' }}>
              <User size={18} style={{ color: '#2563EB' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: NAVY }}>{t('hospital.personalInformation', 'Personal Information')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t('hospital.fullName', 'Full Name')}</label>
              <input type="text" value={form.fullName} disabled={!editing} onChange={set('fullName')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>
            <div>
              <label className={labelCls}>{t('hospital.phoneNumber', 'Phone Number')}</label>
              <input type="text" value={form.phone} disabled={!editing} onChange={set('phone')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>{t('hospital.emailAddress', 'Email Address')}</label>
              <input type="email" value={form.email} disabled={!editing} onChange={set('email')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>

            <div>
              <label className={labelCls}>{t('hospital.username', 'Username')}</label>
              <input type="text" value={form.username} disabled={!editing} onChange={set('username')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>
            <div>
              <label className={labelCls}>{t('hospital.department', 'Department')}</label>
              <input type="text" value={form.department} disabled={!editing} onChange={set('department')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>{t('hospital.address', 'Address')}</label>
              <input type="text" value={form.address} disabled={!editing} onChange={set('address')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>{t('hospital.dateOfJoining', 'Date of joining')}</label>
              <input type="date" value={form.dateOfJoining} disabled={!editing} onChange={set('dateOfJoining')}
                className={inputCls} style={{ '--tw-ring-color': TEAL } as React.CSSProperties} />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              disabled={!editing}
              onClick={() => setEditing(false)}
              className="px-10 min-h-11 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-30"
              style={{ background: GRADIENT }}
            >
              {t('hospital.saveChanges', 'Save Changes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
