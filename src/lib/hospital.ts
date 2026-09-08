'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { MOCK_DOCTOR, MOCK_ADMIN, MOCK_NURSE, MOCK_RECEPTIONIST } from '@/mock/hospital/user';
import api from '@/lib/api';
import type { DashboardStats, WeeklyRevenue, PatientStatus } from '@/types/hospital';
import { isHospitalNurse } from '@/lib/auth';

/**
 * Resolves the hospitalId to use for hospital admin API calls.
 *
 * Hospital auth is now wired into AuthContext (see
 * src/docs/HOSPITAL_AUTH_INTEGRATION.md) — `user.hospitalId` is populated for
 * real HOSPITAL_ADMIN/DOCTOR/hospital-NURSE sessions. The NEXT_PUBLIC_DEV_HOSPITAL_ID
 * fallback only applies when there is no authenticated session at all, and is
 * disabled outside dev so a logged-out production user never gets a real
 * dev hospital's id.
 */
export function useHospitalId(): string | undefined {
  const { user } = useAuth();
  const fromUser = (user as { hospitalId?: string } | null)?.hospitalId;
  if (fromUser) return fromUser;
  return process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_DEV_HOSPITAL_ID : undefined;
}

/** Builds a display name from an email when no real name field exists. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || email;
}

export interface HospitalTopbarUser {
  userName: string;
  roleLabel: string;
  hospitalName: string;
  /** True when this is dev-only mock data, not a real authenticated session. */
  isMock: boolean;
}

/**
 * Resolves the current hospital admin's topbar display info.
 *
 * GAP (Blocking — see src/docs/HOSPITAL_AUTH_INTEGRATION.md, Gap 2):
 * the login response's `profile` field is the Hospital record, not a person —
 * `representativeName` on that record is used as the admin's display name
 * since no separate admin-person name field exists on the backend yet.
 *
 * Falls back to MOCK_ADMIN only when not authenticated and not in production.
 */
export function useHospitalAdminUser(): HospitalTopbarUser {
  const { user } = useAuth();

  if (user?.role === 'HOSPITAL_ADMIN' && user.hospitalId) {
    const profile = user.profile as { name?: string; representativeName?: string } | undefined;
    return {
      userName: profile?.representativeName || nameFromEmail(user.email),
      roleLabel: 'Hospital Admin',
      hospitalName: profile?.name || user.hospitalName || '',
      isMock: false,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      userName: `${MOCK_ADMIN.firstName} ${MOCK_ADMIN.lastName}`,
      roleLabel: 'Hospital Admin',
      hospitalName: MOCK_ADMIN.hospitalName,
      isMock: true,
    };
  }

  return { userName: '', roleLabel: 'Hospital Admin', hospitalName: '', isMock: false };
}

/**
 * Resolves the current doctor's topbar display info.
 *
 * GAP (Blocking — see src/docs/HOSPITAL_AUTH_INTEGRATION.md, Gap 1):
 * the doctor login response has no firstName/lastName/specialization field at
 * all (only id, email, role, hospitalId, hospitalName, status). Until a
 * doctor "/me" profile endpoint exists, the display name is derived from the
 * email and the specialization is left blank rather than invented.
 *
 * Falls back to MOCK_DOCTOR only when not authenticated and not in production.
 */
export function useHospitalDoctorUser(): HospitalTopbarUser {
  const { user } = useAuth();

  if (user?.role === 'DOCTOR' && user.hospitalId) {
    return {
      userName: nameFromEmail(user.email),
      roleLabel: 'Doctor',
      hospitalName: user.hospitalName || '',
      isMock: false,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      userName: `${MOCK_DOCTOR.firstName} ${MOCK_DOCTOR.lastName}`,
      roleLabel: MOCK_DOCTOR.specialisation,
      hospitalName: MOCK_DOCTOR.hospitalName,
      isMock: true,
    };
  }

  return { userName: '', roleLabel: 'Doctor', hospitalName: '', isMock: false };
}

/**
 * Resolves the current hospital nurse's topbar display info.
 *
 * GAP (Blocking — see src/docs/HOSPITAL_AUTH_INTEGRATION.md, Gap 1):
 * same as the doctor case — the hospital-side NURSE login response has no
 * name field. `hospitalId` presence is also what discriminates a hospital
 * nurse from a pharmacy/branch-staff nurse, since both share `role: 'NURSE'`.
 *
 * Falls back to MOCK_NURSE only when not authenticated and not in production.
 */
export function useHospitalNurseUser(): HospitalTopbarUser {
  const { user } = useAuth();

  if (user && isHospitalNurse(user)) {
    return {
      userName: nameFromEmail(user.email),
      roleLabel: 'Nurse',
      hospitalName: user.hospitalName || '',
      isMock: false,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      userName: `${MOCK_NURSE.firstName} ${MOCK_NURSE.lastName}`,
      roleLabel: 'Registered Nurse',
      hospitalName: MOCK_NURSE.hospitalName,
      isMock: true,
    };
  }

  return { userName: '', roleLabel: 'Nurse', hospitalName: '', isMock: false };
}

/**
 * Resolves the current hospital receptionist's topbar display info.
 *
 * Falls back to MOCK_RECEPTIONIST only when not authenticated and not in production.
 */
export function useHospitalReceptionistUser(): HospitalTopbarUser {
  const { user } = useAuth();

  if (user?.role === 'RECEPTIONIST' && user.hospitalId) {
    return {
      userName: nameFromEmail(user.email),
      roleLabel: 'Receptionist',
      hospitalName: user.hospitalName || '',
      isMock: false,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      userName: `${MOCK_RECEPTIONIST.firstName} ${MOCK_RECEPTIONIST.lastName}`,
      roleLabel: 'Receptionist',
      hospitalName: MOCK_RECEPTIONIST.hospitalName,
      isMock: true,
    };
  }

  return { userName: '', roleLabel: 'Receptionist', hospitalName: '', isMock: false };
}

// ── Shared hospital dashboard stats + weekly revenue ────────────────────────
//
// GET /hospitals/:id/dashboard/stats and GET /hospitals/:id/dashboard/weekly-revenue
// are used by both admin/dashboard and doctor/dashboard. Both routes now allow
// Role.HOSPITAL_ADMIN and Role.DOCTOR (see src/docs/HOSPITAL_ADMIN_DASHBOARD_STAFF_APPOINTMENTS_INTEGRATION.md,
// Gap D-1), scoped via validateHospitalReadAccess on the backend, which checks
// hospital ownership OR doctor membership. One fetch helper here means admin
// and doctor dashboards can't silently drift into different response shapes.
export interface HospitalDashboardData {
  stats: DashboardStats | null;
  weeklyRevenue: WeeklyRevenue[];
  loading: boolean;
  error: boolean;
}

export function useHospitalDashboardStats(hospitalId: string | undefined): HospitalDashboardData {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState<WeeklyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hospitalId) { setLoading(false); return; }
    let cancelled = false;

    Promise.allSettled([
      api.get<DashboardStats>(`/hospitals/${hospitalId}/dashboard/stats`),
      api.get<WeeklyRevenue[]>(`/hospitals/${hospitalId}/dashboard/weekly-revenue`),
    ]).then(([statsRes, revenueRes]) => {
      if (cancelled) return;
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
        setError(true);
      }
      if (revenueRes.status === 'fulfilled') {
        setWeeklyRevenue(Array.isArray(revenueRes.value.data) ? revenueRes.value.data : []);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [hospitalId]);

  return { stats, weeklyRevenue, loading, error };
}

// ── Shared hospital admissions (patient list) ───────────────────────────────
//
// GET /inpatient/admissions?hospitalId= is the nurse portal's real "patient
// list" source — GET /hospitals/:id/patients doesn't exist on the backend yet
// (see src/docs/BACKEND_GAPS_SUMMARY.md, Gap E-6). nurse/patients, nurse/notes
// (patient picker), and nurse/dashboard (Patient Overview) all need the same
// hospital-scoped patient list, so it's fetched here once instead of being
// copy-pasted per page. Falls back to MOCK_PATIENTS only when there's no
// hospitalId, or (in non-production) when the request errors.
export interface HospitalPatientRow {
  id: string;
  patientId: string;
  name: string;
  age: string;
  gender: string;
  lastVisit: string;
  condition: string;
  status: PatientStatus;
}

export interface HospitalAdmissionsData {
  patients: HospitalPatientRow[];
  loading: boolean;
  error: string | null;
  useMockFallback: boolean;
}

function formatAdmissionLastVisit(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function deriveAdmissionStatus(status?: string): PatientStatus {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'CRITICAL') return 'CRITICAL';
  if (normalized === 'ACTIVE') return 'ACTIVE';
  return 'INACTIVE';
}

export function useHospitalAdmissions(hospitalId: string | undefined): HospitalAdmissionsData {
  const [patients, setPatients] = useState<HospitalPatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useMockFallback, setUseMockFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!hospitalId) {
      setPatients([]);
      setLoading(false);
      setError(null);
      return () => { cancelled = true; };
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      setUseMockFallback(false);

      try {
        const response = await api.get(`/inpatient/admissions?hospitalId=${hospitalId}`);
        const payload = response.data;
        const admissions = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = admissions.map((item: any) => {
          const patient = item.patient ?? {};
          const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Unknown patient';
          const patientId = patient.mrn || patient.id || item.id || '—';
          const condition = String(item.reason || 'Stable').trim() || 'Stable';

          return {
            id: item.id,
            patientId,
            name: patientName,
            age: patient.age ? String(patient.age) : '—',
            gender: patient.gender || '—',
            lastVisit: formatAdmissionLastVisit(item.updatedAt || item.createdAt),
            condition,
            status: deriveAdmissionStatus(item.status),
          } as HospitalPatientRow;
        });

        if (!cancelled) {
          setPatients(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          const message = axios.isAxiosError(err)
            ? err.response?.data?.message || 'Unable to load patient data right now.'
            : 'Unable to load patient data right now.';
          setError(message);
          setPatients([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [hospitalId]);

  return { patients, loading, error, useMockFallback };
}
