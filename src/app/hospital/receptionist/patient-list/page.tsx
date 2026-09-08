'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Filter, ChevronLeft, ChevronRight,
  Users, UserCheck, AlertTriangle, UserX,
  Phone, Calendar, Droplet, Shield,
  CalendarPlus, X,
} from 'lucide-react';
import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';

const NAVY  = '#1E3A5F';
const TEAL  = '#0284C7';

type PatientListStatus = 'Active' | 'Inactive' | 'Critical';

interface PatientListEntry {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  age: number | string;
  gender: string;
  phone: string;
  bloodType: string;
  insurance: string;
  department: string;
  status: PatientListStatus;
  lastVisit: string;
  registeredAt: string;
}

const STATUS_STYLES: Record<PatientListStatus, { bg: string; text: string; dot: string }> = {
  Active:   { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  Inactive: { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400' },
  Critical: { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
};

const AVATAR_COLORS = ['#1E3A5F', '#0284C7', '#0D9488', '#7C3AED', '#B45309', '#DC2626'];
function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash)];
}

const PAGE_SIZE = 8;

function pageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function deriveStatus(raw: any): PatientListStatus {
  const s = (raw.status ?? '').toUpperCase();
  if (s === 'CRITICAL' || s === 'EMERGENCY') return 'Critical';
  if (s === 'INACTIVE' || s === 'DISCHARGED') return 'Inactive';
  return 'Active';
}

function deriveAge(p: any): number | string {
  if (p.age) return p.age;
  if (p.dateOfBirth) {
    const dob = new Date(p.dateOfBirth);
    return isNaN(dob.getTime()) ? '—' : new Date().getFullYear() - dob.getFullYear();
  }
  return '—';
}

export default function PatientListPage() {
  const router = useRouter();
  const hospitalId = useHospitalId();

  const [patients, setPatients] = useState<PatientListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState<PatientListStatus | 'All'>('All');
  const [deptFilter, setDept]         = useState('All');
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<PatientListEntry | null>(null);

  useEffect(() => {
    if (!hospitalId) { setLoading(false); return; }
    api.get<any[]>(`/hospitals/${hospitalId}/patients`)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        setPatients(raw.map((p) => ({
          id:          p.id ?? p.patientId ?? '',
          firstName:   p.firstName ?? (p.name ?? '').split(' ')[0] ?? '',
          lastName:    p.lastName  ?? (p.name ?? '').split(' ').slice(1).join(' ') ?? '',
          mrn:         p.mrn ?? p.patientId ?? p.id?.slice(0, 8).toUpperCase() ?? '—',
          age:         deriveAge(p),
          gender:      p.gender ?? '—',
          phone:       p.phone ?? p.phoneNumber ?? '—',
          bloodType:   p.bloodType ?? '—',
          insurance:   p.insuranceProvider ?? p.insurance ?? 'Self-pay',
          department:  p.department ?? p.specialization ?? 'General',
          status:      deriveStatus(p),
          lastVisit:   p.lastVisit ?? p.lastAppointment ?? p.updatedAt ?? '',
          registeredAt:p.registeredAt ?? p.createdAt ?? '',
        })));
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(patients.map(p => p.department))).sort()],
    [patients]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter(p => {
      const matchSearch =
        !q ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.phone.includes(q);
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchDept   = deptFilter   === 'All' || p.department === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [patients, search, statusFilter, deptFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function applyFilter(fn: () => void) { fn(); setPage(1); }

  const total    = patients.length;
  const active   = patients.filter(p => p.status === 'Active').length;
  const critical = patients.filter(p => p.status === 'Critical').length;
  const inactive = patients.filter(p => p.status === 'Inactive').length;

  const stats = [
    { label: 'Total Patients', value: total,    icon: Users,        border: '#3B82F6', iconBg: '#EFF6FF', iconColor: '#3B82F6' },
    { label: 'Active',         value: active,   icon: UserCheck,    border: '#10B981', iconBg: '#ECFDF5', iconColor: '#10B981' },
    { label: 'Critical',       value: critical, icon: AlertTriangle, border:'#EF4444', iconBg: '#FEF2F2', iconColor: '#EF4444' },
    { label: 'Inactive',       value: inactive, icon: UserX,        border: '#94A3B8', iconBg: '#F8FAFC', iconColor: '#94A3B8' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl px-8 py-7" style={{ background: '#EBF5FF' }}>
        <h1 className="text-3xl font-bold" style={{ color: NAVY }}>Patient List</h1>
        <p className="mt-1 text-sm font-medium" style={{ color: TEAL }}>
          Browse, search and manage all registered patients at this hospital.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm" style={{ borderLeft: `4px solid ${s.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{loading ? '—' : s.value}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: s.iconBg }}>
                  <Icon className="h-5 w-5" style={{ color: s.iconColor }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by name, MRN, or phone…"
                value={search} onChange={e => applyFilter(() => setSearch(e.target.value))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={statusFilter} onChange={e => applyFilter(() => setStatus(e.target.value as PatientListStatus | 'All'))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {(['All', 'Active', 'Inactive', 'Critical'] as const).map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
              ))}
            </select>
            <select value={deptFilter} onChange={e => applyFilter(() => setDept(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {departments.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
            </select>
            <button className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
              <Filter className="h-4 w-4" /> Filter
            </button>
            <button onClick={() => router.push('/hospital/receptionist/walkin-registration')}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ background: TEAL }}>
              <CalendarPlus className="h-4 w-4" /> Add Patient
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-3.5 text-left">Patient</th>
                    <th className="px-5 py-3.5 text-left">MRN</th>
                    <th className="px-5 py-3.5 text-left">Age / Gender</th>
                    <th className="px-5 py-3.5 text-left">Department</th>
                    <th className="px-5 py-3.5 text-left">Last Visit</th>
                    <th className="px-5 py-3.5 text-left">Insurance</th>
                    <th className="px-5 py-3.5 text-left">Status</th>
                    <th className="px-5 py-3.5 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-8 animate-pulse rounded bg-gray-100" /></td></tr>
                    ))
                  ) : pageItems.length === 0 ? (
                    <tr><td colSpan={8} className="py-14 text-center text-gray-400">No patients found matching your filters.</td></tr>
                  ) : pageItems.map(p => {
                    const initials = `${(p.firstName[0] ?? '?')}${(p.lastName[0] ?? '?')}`;
                    const bg = avatarColor(`${p.firstName}${p.lastName}`);
                    const ss = STATUS_STYLES[p.status];
                    const isSelected = selected?.id === p.id;
                    return (
                      <tr key={p.id} onClick={() => setSelected(isSelected ? null : p)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: bg }}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{p.firstName} {p.lastName}</p>
                              <p className="text-[11px] text-gray-400">{p.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-600">{p.mrn}</td>
                        <td className="px-5 py-4 text-gray-600">{p.age} · {p.gender}</td>
                        <td className="px-5 py-4 text-gray-600">{p.department}</td>
                        <td className="px-5 py-4 text-gray-600">
                          {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-4 text-gray-600 max-w-[120px] truncate">{p.insurance}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ss.bg} ${ss.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : p); }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                <span>Showing {pageItems.length} of {filtered.length} patients</span>
                <div className="flex items-center gap-1">
                  <NavBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}><ChevronLeft className="h-3.5 w-3.5" /></NavBtn>
                  {pageNumbers(safePage, totalPages).map((n, i) =>
                    n === '...'
                      ? <span key={`e${i}`} className="px-1 text-gray-400">…</span>
                      : <PageBtn key={n} n={n as number} active={n === safePage} onClick={() => setPage(n as number)} />
                  )}
                  <NavBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}><ChevronRight className="h-3.5 w-3.5" /></NavBtn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 xl:w-80 shrink-0 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#EBF5FF' }}>
              <span className="text-sm font-bold" style={{ color: NAVY }}>Patient Details</span>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-white/70">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
                  style={{ backgroundColor: avatarColor(`${selected.firstName}${selected.lastName}`) }}>
                  {selected.firstName[0]}{selected.lastName[0]}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800">{selected.firstName} {selected.lastName}</p>
                  <p className="text-xs text-gray-400 font-mono">{selected.mrn}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[selected.status].bg} ${STATUS_STYLES[selected.status].text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[selected.status].dot}`} />
                  {selected.status}
                </span>
              </div>
              <div className="space-y-3">
                <DetailRow icon={<Users className="h-4 w-4" />}    label="Age / Gender" value={`${selected.age} · ${selected.gender}`} />
                <DetailRow icon={<Phone className="h-4 w-4" />}    label="Phone"        value={selected.phone} />
                <DetailRow icon={<Droplet className="h-4 w-4" />}  label="Blood Type"   value={selected.bloodType} />
                <DetailRow icon={<Shield className="h-4 w-4" />}   label="Insurance"    value={selected.insurance} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Registered"
                  value={selected.registeredAt ? new Date(selected.registeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Last Visit"
                  value={selected.lastVisit ? new Date(selected.lastVisit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                <DetailRow icon={<Users className="h-4 w-4" />}    label="Department"   value={selected.department} />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={() => router.push('/hospital/receptionist/walkin-registration')}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm" style={{ background: TEAL }}>
                  Book Appointment
                </button>
                <button onClick={() => router.push('/hospital/receptionist/checkingQueue')}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Add to Queue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function PageBtn({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded text-xs transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {n}
    </button>
  );
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-default disabled:text-gray-300 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}
