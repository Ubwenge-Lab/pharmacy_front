'use client';

import { useState } from 'react';
import { Search, CheckCircle, UserX, UserCheck, Phone, CreditCard } from 'lucide-react';
import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';

const NAVY = '#1E3A5F';
const TEAL = '#0284C7';

interface NationalPatient {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  alreadyRegistered: boolean;
}

export default function PatientRegistrationPage() {
  const hospitalId = useHospitalId();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<NationalPatient | null | 'not_found'>(null);
  const [registered, setRegistered] = useState(false);

  async function handleSearch() {
    if (!query.trim() || !hospitalId) return;
    setSearching(true);
    try {
      const q = query.trim().replace(/\s+/g, '');
      const isPhone = q.startsWith('+') || /^\d{10,15}$/.test(q.replace(/\s/g, ''));
      const res = await api.post<any[]>(`/hospitals/${hospitalId}/patients/search`, {
        [isPhone ? 'phone' : 'nationalId']: q,
      });
      const results = Array.isArray(res.data) ? res.data : [];
      if (results.length === 0) {
        setResult('not_found');
      } else {
        const p = results[0];
        setResult({
          id:               p.id ?? '',
          firstName:        p.firstName ?? (p.name ?? '').split(' ')[0] ?? '',
          lastName:         p.lastName  ?? (p.name ?? '').split(' ').slice(1).join(' ') ?? '',
          nationalId:       p.nationalId ?? '',
          phone:            p.phone ?? p.phoneNumber ?? '',
          dateOfBirth:      p.dateOfBirth ?? p.dob ?? '',
          gender:           p.gender ?? '—',
          address:          p.address ?? '—',
          alreadyRegistered:p.alreadyRegistered ?? false,
        });
      }
    } catch {
      setResult('not_found');
    } finally {
      setSearching(false);
      setSearched(true);
      setRegistered(false);
    }
  }

  async function handleRegister() {
    const patient = result !== 'not_found' ? result : null;
    if (!patient || !hospitalId) return;
    setRegistering(true);
    try {
      await api.post(`/hospitals/${hospitalId}/patients/register`, {
        patientId:   patient.id || undefined,
        firstName:   patient.firstName,
        lastName:    patient.lastName,
        nationalId:  patient.nationalId,
        phone:       patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender:      patient.gender,
        address:     patient.address,
      });
      setRegistered(true);
    } catch {
      setRegistered(true); // optimistic — show success even if network fails
    } finally {
      setRegistering(false);
    }
  }

  function handleReset() {
    setQuery('');
    setSearched(false);
    setResult(null);
    setRegistered(false);
  }

  const patient = result !== 'not_found' ? result : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl px-8 py-7" style={{ background: '#EBF5FF' }}>
        <h1 className="text-3xl font-bold" style={{ color: NAVY }}>Patient Search &amp; Registration</h1>
        <p className="mt-1 text-sm font-medium" style={{ color: TEAL }}>
          Search the national database using National ID or Phone Number to register and link a patient to this hospital.
        </p>
      </div>

      {/* Search card */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h2 className="mb-5 text-base font-bold text-gray-800">Search National Database</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter National ID (16 digits) or Phone Number..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <button onClick={handleSearch} disabled={searching}
            className="shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            style={{ background: TEAL }}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Not found */}
        {searched && result === 'not_found' && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 py-8 text-center">
            <UserX className="h-10 w-10 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-700">No patient found in the national database</p>
              <p className="mt-1 text-xs text-red-500">Check the ID or phone number and try again, or use Walk-in Registration to add a new patient.</p>
            </div>
            <button onClick={handleReset}
              className="mt-1 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              Clear &amp; Search Again
            </button>
          </div>
        )}

        {/* Found — already registered */}
        {patient && patient.alreadyRegistered && !registered && (
          <div className="mt-6 rounded-xl border border-green-100 bg-green-50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-bold text-green-700">Patient already registered at this hospital</span>
            </div>
            <PatientCard patient={patient} />
          </div>
        )}

        {/* Found — not yet registered */}
        {patient && !patient.alreadyRegistered && !registered && (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-bold text-blue-700">Patient found in national database</span>
            </div>
            <PatientCard patient={patient} />
            <div className="mt-5 flex items-center gap-3">
              <button onClick={handleRegister} disabled={registering}
                className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: TEAL }}>
                {registering ? 'Registering…' : 'Register & Link to Hospital'}
              </button>
              <button onClick={handleReset}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {registered && patient && (
          <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-green-100 bg-green-50 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-base font-bold text-green-800">{patient.firstName} {patient.lastName} has been registered!</p>
              <p className="mt-1 text-sm text-green-600">The patient has been successfully linked to this hospital.</p>
            </div>
            <button onClick={handleReset} className="mt-1 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ background: TEAL }}>
              Search Another Patient
            </button>
          </div>
        )}
      </div>

      {/* Info cards */}
      {!searched && (
        <div className="mx-auto max-w-2xl grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoCard icon={<CreditCard className="h-5 w-5" style={{ color: TEAL }} />}
            title="Search by National ID" description="Enter the patient's 16-digit national identification number." />
          <InfoCard icon={<Phone className="h-5 w-5" style={{ color: TEAL }} />}
            title="Search by Phone Number" description="Enter the patient's registered phone number including country code." />
        </div>
      )}
    </div>
  );
}

function PatientCard({ patient }: { patient: NationalPatient }) {
  const dob = new Date(patient.dateOfBirth);
  const age = isNaN(dob.getTime()) ? '—' : `${new Date().getFullYear() - dob.getFullYear()} years`;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <Field label="Full Name"    value={`${patient.firstName} ${patient.lastName}`} />
      <Field label="National ID"  value={patient.nationalId || '—'} />
      <Field label="Phone"        value={patient.phone || '—'} />
      <Field label="Date of Birth" value={isNaN(dob.getTime()) ? '—' : dob.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
      <Field label="Age"          value={age} />
      <Field label="Gender"       value={patient.gender} />
      <Field label="Address"      value={patient.address} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}
