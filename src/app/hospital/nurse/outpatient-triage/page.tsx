'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, Clock, SkipForward } from 'lucide-react';
import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';

const NAVY = '#1E3A5F';
const TEAL = '#0284C7';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: '#DBEAFE', text: '#1D4ED8' },
  'Waiting':     { bg: '#FEF9C3', text: '#A16207' },
  'Completed':   { bg: '#DCFCE7', text: '#15803D' },
  'ARRIVED':     { bg: '#FEF9C3', text: '#A16207' },
  'IN_TRIAGE':   { bg: '#DBEAFE', text: '#1D4ED8' },
};

interface QueuePatient {
  id: string;
  name: string;
  age: string;
  gender: string;
  token: string;
  appointmentTime: string;
  waitMinutes: number;
  status: string;
  doctor: string;
  consultationType: string;
  allergies: string[];
}

interface Vitals {
  systolic: string; diastolic: string;
  temperature: string; weight: string; height: string;
  heartRate: string; oxygenSaturation: string;
  respiratoryRate: string; notes: string;
}

const EMPTY_VITALS: Vitals = {
  systolic: '', diastolic: '', temperature: '', weight: '',
  height: '', heartRate: '', oxygenSaturation: '',
  respiratoryRate: '', notes: '',
};

function VitalInput({ label, value, onChange, unit, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? '—'}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
        {unit && <span className="shrink-0 text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

function QueueCard({ patient, selected, onClick }: { patient: QueuePatient; selected: boolean; onClick: () => void }) {
  const style = STATUS_STYLES[patient.status] ?? STATUS_STYLES['Waiting'];
  return (
    <button onClick={onClick} className={`w-full rounded-xl border p-3 text-left transition-all ${selected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/30'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: NAVY }}>
            {patient.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{patient.name}</p>
            <p className="text-[11px] text-gray-400">Appt {patient.appointmentTime} · Age {patient.age}</p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold" style={{ color: TEAL }}>{patient.token}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: style.bg, color: style.text }}>
          {patient.status}
        </span>
        {patient.waitMinutes > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="h-3 w-3" /> {patient.waitMinutes} min
          </span>
        )}
      </div>
    </button>
  );
}

function TriageForm({ patient, appointmentId, queue, onSelectNext, onSaved }: {
  patient: QueuePatient; appointmentId: string;
  queue: QueuePatient[]; onSelectNext: (id: string) => void; onSaved: () => void;
}) {
  const [vitals, setVitals] = useState<Vitals>(EMPTY_VITALS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setVitals(EMPTY_VITALS); setSaved(false); setError(''); }, [patient.id]);

  function set(key: keyof Vitals) { return (v: string) => setVitals((prev) => ({ ...prev, [key]: v })); }

  async function handleSave() {
    if (!vitals.systolic || !vitals.diastolic || !vitals.temperature || !vitals.heartRate || !vitals.oxygenSaturation || !vitals.weight) {
      setError('Please fill in Blood Pressure, Temperature, Weight, Heart Rate, and O2 Saturation before saving.');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.post(`/appointments/${appointmentId}/triage`, {
        bloodPressure: `${vitals.systolic}/${vitals.diastolic}`,
        temperature: parseFloat(vitals.temperature),
        weight: parseFloat(vitals.weight),
        heartRate: parseInt(vitals.heartRate, 10),
        oxygenSaturation: parseInt(vitals.oxygenSaturation, 10),
        notes: vitals.notes || undefined,
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save triage vitals. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const nextIdx = queue.findIndex((p) => p.id === patient.id) + 1;
  const nextPatient = queue[nextIdx];
  const initials = patient.name.split(' ').map((n) => n[0]).join('').slice(0, 2);

  return (
    <div className="flex flex-col gap-4">
      {/* Patient header */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ background: NAVY }}>{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold" style={{ color: NAVY }}>{patient.name}</h2>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: STATUS_STYLES[patient.status]?.bg, color: STATUS_STYLES[patient.status]?.text }}>{patient.token}</span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: STATUS_STYLES[patient.status]?.bg, color: STATUS_STYLES[patient.status]?.text }}>{patient.status}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">Age {patient.age} · {patient.gender}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Appt: {patient.appointmentTime}</span>
              {patient.waitMinutes > 0 && <span className="flex items-center gap-1 font-semibold text-amber-600"><Clock className="h-3.5 w-3.5" /> Waiting: {patient.waitMinutes} min</span>}
              <span className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5" /> {patient.consultationType} · {patient.doctor}</span>
            </div>
          </div>
          {patient.allergies.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-semibold text-red-600">Allergies: {patient.allergies.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Vitals form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: NAVY }}>Record Triage Vitals</h3>
          <span className="text-xs text-gray-400">All fields recommended before sending to doctor</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Blood Pressure</label>
            <div className="flex items-center gap-1">
              <input type="number" value={vitals.systolic} onChange={(e) => set('systolic')(e.target.value)} placeholder="Systolic" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
              <span className="text-gray-400">/</span>
              <input type="number" value={vitals.diastolic} onChange={(e) => set('diastolic')(e.target.value)} placeholder="Diastolic" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
              <span className="shrink-0 text-xs text-gray-400">mmHg</span>
            </div>
          </div>
          <VitalInput label="Temperature" value={vitals.temperature} onChange={set('temperature')} unit="°C" placeholder="36.5" />
          <VitalInput label="Weight" value={vitals.weight} onChange={set('weight')} unit="kg" placeholder="70" />
          <VitalInput label="Height" value={vitals.height} onChange={set('height')} unit="cm" placeholder="170" />
          <VitalInput label="Heart Rate" value={vitals.heartRate} onChange={set('heartRate')} unit="bpm" placeholder="72" />
          <VitalInput label="Oxygen Saturation" value={vitals.oxygenSaturation} onChange={set('oxygenSaturation')} unit="SpO₂ %" placeholder="98" />
          <VitalInput label="Respiratory Rate" value={vitals.respiratoryRate} onChange={set('respiratoryRate')} unit="/min" placeholder="16" />
        </div>
        <div className="mt-4 flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Notes</label>
          <textarea rows={3} value={vitals.notes} onChange={(e) => setVitals((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Add any triage observations..."
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleSave} disabled={saving || saved}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{ background: TEAL }}>
              {saved ? '✓ Sent to Doctor' : saving ? 'Saving…' : '⟳ Save Vitals & Send to Doctor'}
            </button>
          </div>
          {nextPatient && (
            <button onClick={() => onSelectNext(nextPatient.id)} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
              <SkipForward className="h-4 w-4" /> Skip to Next Patient
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OutpatientTriageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hospitalId = useHospitalId();

  const [queue, setQueue] = useState<{ patient: QueuePatient; appointmentId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get('patientId') ?? '');

  const loadQueue = () => {
    if (!hospitalId) return;
    setLoading(true);
    api.get<any[]>(`/hospitals/${hospitalId}/receptionist/queue`)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        const arrivedItems = raw
          .filter((a) => a.status === 'ARRIVED' || a.status === 'IN_TRIAGE')
          .map((a, idx) => ({
            appointmentId: a.id,
            patient: {
              id: a.id,
              name: a.patientName ?? 'Unknown',
              age: '—',
              gender: '—',
              token: `T-${String(idx + 1).padStart(3, '0')}`,
              appointmentTime: a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
              waitMinutes: a.scheduledAt ? Math.max(0, Math.floor((Date.now() - new Date(a.scheduledAt).getTime()) / 60000)) : 0,
              status: a.status,
              doctor: a.doctorName ?? 'TBD',
              consultationType: a.type ?? 'IN_PERSON',
              allergies: [] as string[],
            } satisfies QueuePatient,
          }));
        setQueue(arrivedItems);
        if (!selectedId && arrivedItems.length > 0) {
          setSelectedId(arrivedItems[0].patient.id);
        }
      })
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadQueue(); }, [hospitalId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(id: string) {
    setSelectedId(id);
    router.replace(`/hospital/nurse/outpatient-triage?patientId=${id}`, { scroll: false });
  }

  const patients = queue.map((q) => q.patient);
  const selected = queue.find((q) => q.patient.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl px-8 py-6" style={{ background: '#EBF5FF' }}>
        <h1 className="text-3xl font-bold" style={{ color: NAVY }}>Outpatient Triage</h1>
        <p className="mt-1 text-sm font-medium" style={{ color: TEAL }}>Record vitals for today&apos;s outpatient appointment queue</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
        <span className="rounded-lg bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">Outpatient Module</span>
        <span className="text-xs text-blue-500">This is the Outpatient Triage workflow — not the Inpatient Ward Round.</span>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Queue */}
        <div className="w-full shrink-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:w-72 xl:w-80">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: NAVY }}>Today&apos;s Queue</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{patients.length} patients</span>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading queue…</p>
          ) : patients.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No patients in the triage queue right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {patients.map((p) => <QueueCard key={p.id} patient={p} selected={p.id === selectedId} onClick={() => handleSelect(p.id)} />)}
            </div>
          )}
        </div>
        {/* Triage form */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <TriageForm patient={selected.patient} appointmentId={selected.appointmentId} queue={patients} onSelectNext={handleSelect} onSaved={loadQueue} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white text-gray-400 text-sm">
              {loading ? 'Loading…' : 'Select a patient from the queue to begin triage'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutpatientTriagePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400 animate-pulse">Loading triage...</div>}>
      <OutpatientTriageContent />
    </Suspense>
  );
}
