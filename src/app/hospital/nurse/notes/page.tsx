'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, FileText, Clock, Users, AlertCircle,
  Calendar, Save, RotateCcw, ChevronDown,
} from 'lucide-react';
import api from '@/lib/api';
import { useHospitalId, useHospitalNurseUser, useHospitalAdmissions } from '@/lib/hospital';
import type { NursingNote } from '@/types/hospital';
import { useTranslation } from 'react-i18next';

const TODAY = new Date().toISOString().split('T')[0];

export default function NursingNotesPage() {
  const { t } = useTranslation();
  const hospitalId = useHospitalId();
  const nurseUser = useHospitalNurseUser();
  const { patients, loading: patientsLoading } = useHospitalAdmissions(hospitalId);

  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [search, setSearch] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(TODAY);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date();
    return `${TODAY} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });
  const [observationNotes, setObservationNotes] = useState('');
  const [careActivities, setCareActivities] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load notes from API
  const loadNotes = () => {
    if (!hospitalId) return;
    setLoadingNotes(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set('date', dateFilter);
    api.get<any[]>(`/hospitals/${hospitalId}/nurse/notes?${params.toString()}`)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        setNotes(raw.map((n) => ({
          id: n.id,
          patientName: n.patientName ?? 'Unknown',
          nurseName: n.nurseName ?? nurseUser.userName,
          date: n.date ?? TODAY,
          time: n.time ?? '—',
          observationNotes: n.observationNotes ?? '',
          careActivities: n.careActivities ?? '',
          additionalComments: n.additionalComments ?? '',
        })));
      })
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  };

  useEffect(() => { loadNotes(); }, [hospitalId, dateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter((note) => {
      if (patientFilter && note.patientName !== patientFilter) return false;
      if (q && !note.patientName.toLowerCase().includes(q) && !note.observationNotes.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, search, patientFilter]);

  const stats = [
    { label: t('hospital.notesToday'), value: notes.filter((n) => n.date === TODAY).length, icon: <FileText className="w-5 h-5 text-[#38BDF8]" />, bgColor: 'bg-[#F0F9FF]', borderColor: 'border-[#E0F2FE]' },
    { label: t('hospital.recentNotes'), value: notes.length, icon: <Clock className="w-5 h-5 text-purple-500" />, bgColor: 'bg-purple-50', borderColor: 'border-purple-100' },
    { label: t('hospital.patientsMonitored'), value: new Set(notes.map((n) => n.patientName)).size, icon: <Users className="w-5 h-5 text-green-500" />, bgColor: 'bg-green-50', borderColor: 'border-green-100' },
    { label: t('hospital.pendingDocumentation'), value: 0, icon: <AlertCircle className="w-5 h-5 text-red-500" />, bgColor: 'bg-red-50', borderColor: 'border-red-100' },
  ];

  const resetForm = () => {
    setSelectedPatientId('');
    setDateTime(`${TODAY} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setObservationNotes('');
    setCareActivities('');
    setAdditionalComments('');
  };

  const submitDocumentation = async () => {
    if (!selectedPatientId || !observationNotes || !hospitalId) return;
    setSubmitting(true);
    try {
      await api.post(`/hospitals/${hospitalId}/nurse/notes`, {
        patientId: selectedPatientId || undefined,
        observationNotes,
        careActivities,
        additionalComments,
        noteDate: new Date().toISOString(),
      });
      resetForm();
      loadNotes();
    } catch {
      // silently fail — note was not saved
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 bg-[#F8FAFC]">
      {/* Header */}
      <div className="rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden" style={{ background: '#EBF5FF' }}>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A5F]">{t('hospital.nursesNotesTitle')}</h1>
          <p className="mt-2 max-w-2xl font-medium" style={{ color: '#0284C7' }}>{t('hospital.nursesNotesSubtitle')}</p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 opacity-5 rounded-full -mr-20 -mt-20 blur-3xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`min-w-0 p-5 rounded-3xl bg-white border ${stat.borderColor} shadow-sm flex items-center gap-4`}>
            <div className={`w-12 h-12 shrink-0 rounded-2xl ${stat.bgColor} flex items-center justify-center`}>{stat.icon}</div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-[#1E3A5F]">{stat.value}</p>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide wrap-break-word">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - History */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('hospital.searchPatients')} className="w-full pl-12 pr-4 py-3 bg-white border border-[#E2E8F0] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] shadow-sm transition-all" />
          </div>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} className="w-full pl-4 pr-10 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#1E3A5F] appearance-none cursor-pointer">
                <option value="">{t('hospital.allPatients')}</option>
                {patients.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4 pointer-events-none" />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-3.5 h-3.5 pointer-events-none" />
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[10px] font-bold text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]" />
            </div>
          </div>
          <div className="space-y-4">
            {loadingNotes && <p className="py-8 text-center text-sm font-semibold text-[#94A3B8]">{t('common.loading')}</p>}
            {!loadingNotes && filteredNotes.length === 0 && (
              <p className="py-8 text-center text-sm font-semibold text-[#94A3B8]">{t('hospital.noNotesFound')}</p>
            )}
            {!loadingNotes && filteredNotes.map((note) => (
              <div key={note.id} className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="text-sm font-black text-[#1E3A5F]">{note.patientName}</h4>
                  <span className="shrink-0 text-[10px] font-bold text-[#94A3B8]">{note.time}</span>
                </div>
                <p className="text-[10px] text-[#64748B] mb-2">{t('hospital.by')} {note.nurseName} • {note.date}</p>
                <p className="text-xs text-[#475569] leading-relaxed line-clamp-3 group-hover:text-[#1E3A5F]">{note.observationNotes}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-8">
            <h3 className="text-xl font-bold text-[#1E3A5F]">{t('hospital.createNursesNote')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wide ml-1">{t('hospital.patientName')}</label>
                <div className="relative">
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    disabled={patientsLoading}
                    className="w-full pl-4 pr-10 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] appearance-none cursor-pointer disabled:opacity-60"
                  >
                    <option value="">{patientsLoading ? t('common.loading', 'Loading...') : t('hospital.selectPatient')}</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-5 h-5 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wide ml-1">{t('hospital.dateTime')}</label>
                <div className="relative">
                  <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] w-5 h-5 pointer-events-none" />
                  <input type="text" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8]" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wide ml-1">{t('hospital.observationNotes')}</label>
              <textarea value={observationNotes} onChange={(e) => setObservationNotes(e.target.value)} placeholder={t('hospital.observationNotesPlaceholder')} rows={4} className="w-full p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] resize-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wide ml-1">{t('hospital.careActivities')}</label>
              <textarea value={careActivities} onChange={(e) => setCareActivities(e.target.value)} placeholder={t('hospital.careActivitiesPlaceholder')} rows={3} className="w-full p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] resize-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wide ml-1">{t('hospital.additionalComments')}</label>
              <textarea value={additionalComments} onChange={(e) => setAdditionalComments(e.target.value)} placeholder={t('hospital.additionalCommentsPlaceholder')} rows={2} className="w-full p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF8] resize-none" />
            </div>
            <div className="flex flex-wrap justify-end gap-4 pt-4 border-t border-[#F1F5F9]">
              <button onClick={resetForm} className="px-8 py-3 bg-white border border-[#E2E8F0] text-[#64748B] text-sm font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> {t('hospital.resetForm')}
              </button>
              <button
                onClick={submitDocumentation}
                disabled={!selectedPatientId || !observationNotes || submitting}
                className="px-8 py-3 bg-[#38BDF8] text-white text-sm font-bold rounded-xl hover:bg-[#0EA5E9] transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" /> {submitting ? t('common.saving') : t('hospital.submitDocumentation')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
