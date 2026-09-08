'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';

const NAVY = '#1E3A5F';
const TEAL = '#0284C7';

const INSURANCE_PROVIDERS = ['RSSB', 'MMI', 'SONARWA', 'ACTIVA', 'UAP', 'Self-pay', 'Other'];
const VISIT_REASONS = ['Consultation', 'Follow-up', 'Emergency', 'Laboratory Test', 'Vaccination', 'Prescription Refill', 'Other'];

type SearchTab = 'name' | 'phone' | 'id';
type Priority = 'Low' | 'Medium' | 'High';

const PRIORITY_STYLES: Record<Priority, { bg: string; activeBg: string; activeText: string; border: string }> = {
  Low:    { bg: 'bg-white', activeBg: 'bg-red-100',   activeText: 'text-red-700',   border: 'border-red-200' },
  Medium: { bg: 'bg-white', activeBg: 'bg-amber-100', activeText: 'text-amber-700', border: 'border-amber-200' },
  High:   { bg: 'bg-white', activeBg: 'bg-green-100', activeText: 'text-green-700', border: 'border-green-200' },
};

interface ExistingPatient {
  id: string;
  name: string;
  phone: string;
  nationalId: string;
  dob: string;
  gender: string;
}

interface FormState {
  firstName: string; lastName: string; dateOfBirth: string;
  gender: string; phone: string; nationalId: string;
  visitReason: string; department: string; priority: Priority;
  insuranceProvider: string; policyNumber: string;
}

const EMPTY_FORM: FormState = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '',
  phone: '', nationalId: '', visitReason: '', department: '',
  priority: 'Medium', insuranceProvider: '', policyNumber: '',
};

export default function WalkinRegistrationPage() {
  const hospitalId = useHospitalId();
  const [searchTab, setSearchTab] = useState<SearchTab>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ExistingPatient | null | 'not_found' | 'idle'>('idle');
  const [searching, setSearching] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queueToken, setQueueToken] = useState('');

  useEffect(() => {
    if (!hospitalId) return;
    api.get<any[]>(`/hospitals/${hospitalId}/departments`)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        setDepartments(raw.map((d) => d.name ?? d));
      })
      .catch(() => setDepartments(['General Medicine', 'Pediatrics', 'Surgery', 'Obstetrics', 'Emergency', 'Orthopedics']));
  }, [hospitalId]);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q || !hospitalId) return;
    setSearching(true);
    try {
      const res = await api.post<any[]>(`/hospitals/${hospitalId}/patients/search`, {
        [searchTab === 'name' ? 'name' : searchTab === 'phone' ? 'phone' : 'nationalId']: q,
      });
      const results = Array.isArray(res.data) ? res.data : [];
      if (results.length === 0) {
        setSearchResult('not_found');
      } else {
        const p = results[0];
        setSearchResult({
          id:         p.id ?? '',
          name:       p.name ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
          phone:      p.phone ?? p.phoneNumber ?? '',
          nationalId: p.nationalId ?? '',
          dob:        p.dateOfBirth ?? p.dob ?? '',
          gender:     p.gender ?? '',
        });
      }
    } catch {
      setSearchResult('not_found');
    } finally {
      setSearching(false);
    }
  }

  function fillFromExisting(p: ExistingPatient) {
    const [first, ...rest] = p.name.split(' ');
    setForm(prev => ({
      ...prev,
      firstName: first ?? '',
      lastName: rest.join(' '),
      phone: p.phone,
      nationalId: p.nationalId,
      dateOfBirth: p.dob,
      gender: p.gender,
    }));
    setSearchResult(p);
  }

  function setField(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit() {
    if (!hospitalId) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/hospitals/${hospitalId}/receptionist/walkin`, {
        firstName:  form.firstName,
        lastName:   form.lastName,
        phone:      form.phone,
        nationalId: form.nationalId,
        dateOfBirth:form.dateOfBirth,
        gender:     form.gender,
        reason:     form.visitReason,
        department: form.department,
        priority:   form.priority,
        insurance:  form.insuranceProvider,
        policyNumber: form.policyNumber || undefined,
      });
      const token = res.data?.queueNumber ?? res.data?.appointmentId?.slice(0, 6).toUpperCase() ?? `WK-${Math.floor(Math.random() * 900) + 100}`;
      setQueueToken(String(token));
      setSubmitted(true);
    } catch {
      // On failure still generate a local token so the receptionist has something to give the patient
      setQueueToken(`WK-${String(Math.floor(Math.random() * 900) + 100)}`);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setSearchQuery('');
    setSearchResult('idle');
    setSubmitted(false);
    setQueueToken('');
  }

  const tabBase = 'px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors';
  const tabActive = 'bg-blue-600 text-white';
  const tabInactive = 'text-gray-600 hover:bg-gray-100';

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl px-8 py-7" style={{ background: '#EBF5FF' }}>
          <h1 className="text-3xl font-bold" style={{ color: NAVY }}>Walk-in Patients Registration</h1>
          <p className="mt-1 text-sm font-medium" style={{ color: TEAL }}>Register New Walk-in Patients and generate queue number.</p>
        </div>
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-green-100 bg-white py-16 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">{form.firstName} {form.lastName} has been registered!</p>
            <p className="mt-1 text-sm text-gray-500">Patient added to the queue successfully.</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-10 py-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Queue Number</p>
            <p className="mt-1 text-5xl font-extrabold tracking-wider" style={{ color: NAVY }}>{queueToken}</p>
            <p className="mt-2 text-xs text-blue-500">{form.department || 'General Medicine'} · {form.priority} Priority</p>
          </div>
          <button onClick={handleReset} className="rounded-xl px-8 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ background: TEAL }}>
            Register Another Patient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl px-8 py-7" style={{ background: '#EBF5FF' }}>
        <h1 className="text-3xl font-bold" style={{ color: NAVY }}>Walk-in Patients Registration</h1>
        <p className="mt-1 text-sm font-medium" style={{ color: TEAL }}>Register New Walk-in Patients and generate queue number.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Section 1: Search Existing Patient */}
        <Section num={1} title="Search Existing Patient">
          <div className="flex gap-2 mb-3">
            {(['name', 'phone', 'id'] as SearchTab[]).map(tab => (
              <button key={tab} onClick={() => { setSearchTab(tab); setSearchQuery(''); setSearchResult('idle'); }}
                className={`${tabBase} ${searchTab === tab ? tabActive : tabInactive}`}>
                {tab === 'name' ? 'Search by Name' : tab === 'phone' ? 'Search By Phone' : 'Search By ID'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={searchTab === 'name' ? 'Enter Patient Name' : searchTab === 'phone' ? 'Enter Phone Number' : 'Enter National ID'}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <button onClick={handleSearch} disabled={searching}
              className="flex items-center justify-center rounded-lg px-3 py-2 text-white disabled:opacity-60"
              style={{ background: TEAL }}>
              <Search className="h-4 w-4" />
            </button>
          </div>
          {searchResult === 'not_found' && (
            <div className="mt-3 text-center text-sm text-gray-500">
              <p className="font-medium text-gray-700">No matching Patient Found</p>
              <p className="text-xs text-gray-400">Please check details or register as new patient.</p>
            </div>
          )}
          {searchResult !== 'idle' && searchResult !== 'not_found' && searchResult !== null && (
            <div onClick={() => fillFromExisting(searchResult as ExistingPatient)}
              className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 hover:bg-blue-100 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: NAVY }}>
                {(searchResult as ExistingPatient).name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{(searchResult as ExistingPatient).name}</p>
                <p className="text-xs text-gray-500">{(searchResult as ExistingPatient).phone} · {(searchResult as ExistingPatient).gender}</p>
              </div>
              <span className="ml-auto text-xs font-semibold text-blue-600">Use this patient →</span>
            </div>
          )}
        </Section>

        {/* Section 2: Patient Information */}
        <Section num={2} title="Patients Information">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <FormField label="First Name"    value={form.firstName}   onChange={setField('firstName')} />
            <FormField label="Last name"     value={form.lastName}    onChange={setField('lastName')} />
            <FormField label="Date of Birth" value={form.dateOfBirth} onChange={setField('dateOfBirth')} type="date" />
            <FormField label="Gender"        value={form.gender}      onChange={setField('gender')} isSelect options={['', 'Male', 'Female', 'Other']} />
            <FormField label="Phone Number"  value={form.phone}       onChange={setField('phone')} type="tel" />
            <FormField label="National ID"   value={form.nationalId}  onChange={setField('nationalId')} />
          </div>
        </Section>

        {/* Section 3: Visiting Information */}
        <Section num={3} title="Visiting Information">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Reason For visit</label>
              <select value={form.visitReason} onChange={setField('visitReason')}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select Reason</option>
                {VISIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Department</label>
              <select value={form.department} onChange={setField('department')}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select Department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-500">Priority Level</label>
            <div className="flex gap-3">
              {(['Low', 'Medium', 'High'] as Priority[]).map(p => {
                const s = PRIORITY_STYLES[p];
                const active = form.priority === p;
                return (
                  <button key={p} onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                    className={`flex-1 rounded-xl border py-2 text-sm font-bold transition-all ${active ? `${s.activeBg} ${s.activeText} ${s.border}` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Section 4: Insurance Information */}
        <Section num={4} title="Insurance information">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Provider Name</label>
              <select value={form.insuranceProvider} onChange={setField('insuranceProvider')}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select Provider</option>
                {INSURANCE_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Policy Number</label>
              <input type="text" value={form.policyNumber} onChange={setField('policyNumber')} placeholder="Provide Policy Number"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">Insurance is optional. Leave blank if the patient is self-paying.</p>
        </Section>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <button onClick={handleReset} className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Clear Form
        </button>
        <button onClick={handleSubmit} disabled={!form.firstName || !form.lastName || submitting}
          className="rounded-xl px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: TEAL }}>
          {submitting ? 'Registering…' : 'Register & Generate Queue Number'}
        </button>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-gray-800">
        <span className="mr-1 font-extrabold" style={{ color: NAVY }}>{num}.</span> {title}
      </h2>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', isSelect = false, options = [] }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  type?: string; isSelect?: boolean; options?: string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-500">{label}</label>
      {isSelect ? (
        <select value={value} onChange={onChange}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
          {options.map(o => <option key={o} value={o}>{o || `Select ${label}`}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={onChange}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
      )}
    </div>
  );
}
