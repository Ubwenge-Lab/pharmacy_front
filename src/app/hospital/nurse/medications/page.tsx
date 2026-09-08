'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    Search,
    Filter,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    XCircle,
    RotateCcw,
    Pill,
} from 'lucide-react';
import { MedicationStatus } from '@/types/hospital';
import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';

interface MarRecordPayload {
    id: string;
    medicationName?: string;
    dose?: string;
    route?: string;
    scheduledAt?: string;
    administeredAt?: string;
    notes?: string;
    nurse?: { firstName?: string; lastName?: string };
    admission?: { patient?: { firstName?: string; lastName?: string } };
}

// Local type — admissionId is needed to POST new MAR entries. Route is kept as
// a plain string here because the backend can return free-form values that don't
// match the MedicationRoute union ('—' fallback included).
interface MarRow {
    id: string;
    admissionId: string;
    patientName: string;
    medicationName: string;
    dosage: string;
    route: string;
    scheduledTime: string;
    status: MedicationStatus;
    assignedNurse: string;
}

interface MedicationStatsSummary {
    missedDoses: number;
    dueToday: number;
    upcomingMedications: number;
    administeredToday: number;
}

const EMPTY_STATS: MedicationStatsSummary = {
    missedDoses: 0,
    dueToday: 0,
    upcomingMedications: 0,
    administeredToday: 0,
};

function formatTime(value?: string) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function deriveMedicationStatus(item: MarRecordPayload): MedicationStatus {
    if (item.administeredAt) return 'ADMINISTERED';

    const scheduled = item.scheduledAt ? new Date(item.scheduledAt) : null;
    if (!scheduled || Number.isNaN(scheduled.getTime())) return 'UPCOMING';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    if (scheduled >= startOfToday && scheduled < endOfToday) return 'DUE';
    if (scheduled < now) return 'OVERDUE';
    return 'UPCOMING';
}

function buildStats(rows: { status: MedicationStatus }[]): MedicationStatsSummary {
    const counts = rows.reduce((acc, row) => {
        if (row.status === 'ADMINISTERED') acc.administeredToday += 1;
        if (row.status === 'DUE') acc.dueToday += 1;
        if (row.status === 'OVERDUE' || row.status === 'MISSED') acc.missedDoses += 1;
        if (row.status === 'UPCOMING') acc.upcomingMedications += 1;
        return acc;
    }, { ...EMPTY_STATS });

    return counts;
}

export default function MedicationAdministrationPage() {
    const { t } = useTranslation();
    const hospitalId = useHospitalId();

    const [searchTerm, setSearchTerm] = useState('');
    const [medicationSearch, setMedicationSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(t('hospital.allStatus'));
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [medications, setMedications] = useState<MarRow[]>([]);
    const [stats, setStats] = useState<MedicationStatsSummary>(EMPTY_STATS);
    const [recordingId, setRecordingId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!hospitalId) {
            setMedications([]);
            setStats(EMPTY_STATS);
            setError(null);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        const loadMar = async () => {
            setLoading(true);
            setError(null);

            try {
                const admissionsResponse = await api.get(`/inpatient/admissions?hospitalId=${hospitalId}`);
                const admissionPayload = admissionsResponse.data;
                const admissionList = Array.isArray(admissionPayload)
                    ? admissionPayload
                    : Array.isArray(admissionPayload?.data)
                        ? admissionPayload.data
                        : [];

                const results = await Promise.allSettled(
                    admissionList.map((admission: any) =>
                        api.get(`/inpatient/admissions/${admission.id}/mar`).then(res => ({ admissionId: admission.id as string, res }))
                    )
                );

                const rows = results.flatMap((result) => {
                    if (result.status !== 'fulfilled') return [];
                    const { admissionId, res } = result.value;
                    const payload = res.data;
                    const marList = Array.isArray(payload)
                        ? payload
                        : Array.isArray(payload?.data)
                            ? payload.data
                            : [];

                    return marList.map((item: MarRecordPayload): MarRow => {
                        const patientName = [item.admission?.patient?.firstName ?? '', item.admission?.patient?.lastName ?? '']
                            .filter(Boolean)
                            .join(' ') || 'Unknown patient';

                        return {
                            id: item.id,
                            admissionId,
                            patientName,
                            medicationName: item.medicationName || 'Medication',
                            dosage: item.dose || '—',
                            route: (item.route || '—') as MarRow['route'],
                            scheduledTime: formatTime(item.scheduledAt || item.administeredAt),
                            status: deriveMedicationStatus(item),
                            assignedNurse: [item.nurse?.firstName ?? '', item.nurse?.lastName ?? '']
                                .filter(Boolean)
                                .join(' ') || 'Nurse',
                        };
                    });
                });

                if (!cancelled) {
                    setMedications(rows);
                    setStats(buildStats(rows));
                }
            } catch {
                if (!cancelled) {
                    setError('Unable to load medication records right now.');
                    setMedications([]);
                    setStats(EMPTY_STATS);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadMar();

        return () => {
            cancelled = true;
        };
    }, [hospitalId]);

    const handleRecord = useCallback(async (med: MarRow) => {
        setRecordingId(med.id);
        try {
            await api.post(`/inpatient/admissions/${med.admissionId}/mar`, {
                medicationName: med.medicationName,
                dose: med.dosage,
                route: med.route !== '—' ? med.route : undefined,
                administeredAt: new Date().toISOString(),
            });
            setMedications(prev => prev.map(m => m.id === med.id ? { ...m, status: 'ADMINISTERED' as const } : m));
            setStats(prev => ({ ...prev, administeredToday: prev.administeredToday + 1, dueToday: Math.max(0, prev.dueToday - 1) }));
            toast.success(`${med.medicationName} recorded as administered.`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to record administration — please try again.');
        } finally {
            setRecordingId(null);
        }
    }, []);

    const handleMarkMissed = useCallback(async (med: MarRow) => {
        setRecordingId(med.id);
        try {
            await api.post(`/inpatient/admissions/${med.admissionId}/mar`, {
                medicationName: med.medicationName,
                dose: med.dosage,
                route: med.route !== '—' ? med.route : undefined,
                administeredAt: new Date().toISOString(),
                notes: 'DOSE NOT ADMINISTERED — marked as missed by nurse',
            });
            setMedications(prev => prev.map(m => m.id === med.id ? { ...m, status: 'MISSED' as const } : m));
            setStats(prev => ({ ...prev, missedDoses: prev.missedDoses + 1, dueToday: Math.max(0, prev.dueToday - 1) }));
            toast.success(`${med.medicationName} marked as missed.`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to mark dose as missed — please try again.');
        } finally {
            setRecordingId(null);
        }
    }, []);

    const filteredMedications = useMemo(() => medications.filter((med) => {
        const matchesPatient = med.patientName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMed = med.medicationName.toLowerCase().includes(medicationSearch.toLowerCase());
        const matchesStatus = statusFilter === t('hospital.allStatus') || med.status === statusFilter;
        const matchesDate = !selectedDate || med.scheduledTime.includes(selectedDate);
        return matchesPatient && matchesMed && matchesStatus && matchesDate;
    }), [medications, medicationSearch, searchTerm, selectedDate, statusFilter, t]);

    const getStatusStyle = (status: MedicationStatus) => {
        switch (status) {
            case 'ADMINISTERED':
                return 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]';
            case 'DUE':
                return 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]';
            case 'OVERDUE':
            case 'MISSED':
                return 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]';
            case 'UPCOMING':
                return 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]';
            default:
                return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="p-6 lg:p-8 space-y-8">
            {/* Header */}
            <div className="rounded-3xl p-8 shadow-sm relative overflow-hidden" style={{ background: '#EBF5FF' }}>
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-[#1E3A5F]">{t('hospital.medicationsTitle')}</h1>
                    <p className="mt-2 max-w-2xl font-medium" style={{ color: '#0284C7' }}>
                       {t('hospital.medicationsSubtitle')}
                    </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#38BDF8] opacity-5 rounded-full -mr-20 -mt-20 blur-3xl" />
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label={t('hospital.missedDoses')}
                    value={loading ? 0 : stats.missedDoses}
                    icon={<XCircle className="w-6 h-6 text-[#DC2626]" />}
                    bgColor="bg-[#FEF2F2]"
                    borderColor="border-[#FEE2E2]"
                />
                <StatCard
                    label={t('hospital.dueToday')}
                    value={loading ? 0 : stats.dueToday}
                    icon={<Clock className="w-6 h-6 text-[#38BDF8]" />}
                    bgColor="bg-[#F0F9FF]"
                    borderColor="border-[#E0F2FE]"
                />
                <StatCard
                    label={t('hospital.upcomingMedications')}
                    value={loading ? 0 : stats.upcomingMedications}
                    icon={<AlertCircle className="w-6 h-6 text-[#D97706]" />}
                    bgColor="bg-[#FFFBEB]"
                    borderColor="border-[#FEF3C7]"
                />
                <StatCard
                    label={t('hospital.administeredToday')}
                    value={loading ? 0 : stats.administeredToday}
                    icon={<CheckCircle2 className="w-6 h-6 text-[#16A34A]" />}
                    bgColor="bg-[#F0FDF4]"
                    borderColor="border-[#DCFCE7]"
                />
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4" />
                    <input
                        type="text"
                        placeholder={t('hospital.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] transition-all"
                    />
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4" />
                    <input
                        type="text"
                        placeholder={t('hospital.searchMedications')}
                        value={medicationSearch}
                        onChange={(e) => setMedicationSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] transition-all"
                    />
                </div>
                <div className="relative min-w-[160px]">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] appearance-none cursor-pointer"
                    >
                        <option>{t('hospital.allStatus')}</option>
                        <option value="ADMINISTERED">{t('hospital.administered')}</option>
                        <option value="DUE">{t('hospital.due')}</option>
                        <option value="UPCOMING">{t('hospital.upcoming')}</option>
                        <option value="MISSED">{t('hospital.missed')}</option>
                        <option value="OVERDUE">{t('hospital.overdue')}</option>
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4 pointer-events-none" />
                </div>
                <div className="relative min-w-[160px]">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
                    />
                </div>
                <button
                    onClick={() => {
                        setSearchTerm('');
                        setMedicationSearch('');
                        setStatusFilter(t('hospital.allStatus'));
                        setSelectedDate('');
                    }}
                    className="px-6 py-2.5 border border-[#E2E8F0] text-[#64748B] text-sm font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    {t('hospital.resetFilters')}
                </button>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.patientName')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.medicationsTitle')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.dosage')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.route')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.scheduledTime')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.status')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.assignedNurse')}</th>
                                <th className="px-6 py-5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('hospital.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <tr key={idx}>
                                        <td colSpan={8} className="px-6 py-8">
                                            <div className="h-8 animate-pulse rounded-lg bg-gray-100" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredMedications.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <h3 className="text-[#1E3A5F] font-bold">{t('hospital.noMedications')}</h3>
                                        <p className="text-[#64748B] text-sm mt-1">{t('hospital.tryAdjustingFilters')}</p>
                                    </td>
                                </tr>
                            ) : filteredMedications.map((med) => (
                                <tr key={med.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-[#1E3A5F]">{med.patientName}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Pill className="w-4 h-4 text-[#38BDF8]" />
                                            </div>
                                            <span className="text-sm font-medium text-[#1E3A5F]">{med.medicationName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm text-[#64748B]">{med.dosage}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm text-[#64748B]">{med.route}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-[#1E3A5F]">{med.scheduledTime}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusStyle(med.status)}`}>
                                            {med.status === 'ADMINISTERED' ? t('hospital.administered') : med.status === 'DUE' ? t('hospital.due') : med.status === 'OVERDUE' ? t('hospital.overdue') : med.status === 'MISSED' ? t('hospital.missed') : med.status === 'UPCOMING' ? t('hospital.upcoming') : med.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm text-[#64748B]">{med.assignedNurse}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            {med.status === 'DUE' || med.status === 'OVERDUE' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleRecord(med)}
                                                        disabled={recordingId === med.id}
                                                        className="px-4 py-2 bg-[#38BDF8] text-white rounded-lg text-xs font-bold hover:bg-[#0EA5E9] transition-all shadow-sm disabled:opacity-50"
                                                    >
                                                        {recordingId === med.id ? '…' : t('hospital.record')}
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkMissed(med)}
                                                        disabled={recordingId === med.id}
                                                        className="px-3 py-2 text-[#64748B] hover:text-[#DC2626] rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                    >
                                                        {t('hospital.missed')}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="px-4 py-2 bg-gray-100 text-[#1E3A5F] rounded-lg text-xs font-bold hover:bg-gray-200 transition-all">
                                                        {t('hospital.details')}
                                                    </button>
                                                    <button className="px-3 py-2 text-[#38BDF8] hover:text-[#0EA5E9] rounded-lg text-xs font-bold transition-all">
                                                        {t('hospital.history')}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, bgColor, borderColor }: { label: string; value: number; icon: React.ReactNode; bgColor: string; borderColor: string }) {
    return (
        <div className={`p-6 rounded-3xl bg-white border ${borderColor} shadow-sm flex items-center gap-5 hover:shadow-md transition-all group`}>
            <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-black text-[#1E3A5F]">{value}</p>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
        </div>
    );
}
