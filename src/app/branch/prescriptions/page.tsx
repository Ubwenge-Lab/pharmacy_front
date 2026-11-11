'use client';

/**
 * /branch/prescriptions — Pharmacist Review & Transcription Queue (Uganda)
 * Lists prescriptions uploaded at this branch (walk-in + patient uploads),
 * lets the pharmacist review/correct the AI extraction, then confirms:
 *  - "Confirm only" — marks APPROVED (available for the POS cart / patient)
 *  - "Confirm + Order" — creates a structured order on behalf of the patient
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  ClipboardDocumentCheckIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  status: string;
  aiProcessingStatus: string;
  aiProcessingError?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string; phone: string };
  prescriptionMedications: {
    id: string;
    medicationName: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    quantity: number;
    matchedMedication?: {
      id: string;
      name: string;
      price: number;
      quantity: number;
      imageUrl?: string | null;
    } | null;
  }[];
}

interface EditableItem {
  medicationId?: string;
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-teal-100 text-teal-700',
  REJECTED: 'bg-red-100 text-red-700',
  DISPENSED: 'bg-blue-100 text-blue-700',
};

const AI_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-teal-100 text-teal-700',
  FAILED: 'bg-red-100 text-red-700',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PrescriptionQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [editable, setEditable] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true);
    try {
      const res = await api.get('/prescriptions/branch', {
        params: status ? { status } : {},
      });
      setItems(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (item: QueueItem) => {
    setSelected(item);
    // Pre-fill from AI extraction (or matched meds), falling back to manual entry
    setEditable(
      item.prescriptionMedications.length > 0
        ? item.prescriptionMedications.map((m) => ({
            medicationId: m.matchedMedication?.id,
            name: m.matchedMedication?.name ?? m.medicationName,
            dosage: m.dosage ?? '',
            frequency: m.frequency ?? '',
            duration: m.duration ?? '',
            quantity: m.quantity || 1,
          }))
        : [],
    );
  };

  const updateEditable = (idx: number, patch: Partial<EditableItem>) => {
    setEditable((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addRow = () =>
    setEditable((prev) => [...prev, { name: '', quantity: 1 }]);

  const removeRow = (idx: number) =>
    setEditable((prev) => prev.filter((_, i) => i !== idx));

  const confirm = async (createOrder: boolean) => {
    if (!selected) return;
    if (editable.length === 0) { toast.error('Add at least one medication'); return; }
    if (editable.some((it) => !it.name.trim())) { toast.error('Every line needs a medication name'); return; }

    setSaving(true);
    if (createOrder) setCreatingOrder(true);
    try {
      const res = await api.post(`/prescriptions/${selected.id}/confirm-transcription`, {
        items: editable.map((it) => ({
          medicationId: it.medicationId || undefined,
          name: it.name.trim(),
          dosage: it.dosage || undefined,
          frequency: it.frequency || undefined,
          duration: it.duration || undefined,
          quantity: it.quantity,
        })),
        createOrder,
        type: 'PICKUP',
        paymentMethod: 'CASH',
      });
      toast.success(
        createOrder
          ? `Prescription approved — order ${res.data.order?.orderNumber ?? ''} created`
          : 'Prescription approved',
      );
      setSelected(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
      setCreatingOrder(false);
    }
  };

  // ── Detail view ───────────────────────────────────────────────────────────

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto py-6 px-4">
        <button onClick={() => setSelected(null)} className="text-sm text-brand-teal mb-4 hover:underline">
          ← Back to queue
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="w-7 h-7 text-brand-teal" />
          Review Prescription
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] ?? 'bg-gray-100'}`}>
              {selected.status}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${AI_COLORS[selected.aiProcessingStatus] ?? 'bg-gray-100'}`}>
              AI: {selected.aiProcessingStatus}
            </span>
            <span className="text-gray-500">
              {selected.patient.firstName} {selected.patient.lastName} · {selected.patient.phone}
            </span>
            <span className="text-gray-400 text-xs">
              {new Date(selected.createdAt).toLocaleString()}
            </span>
          </div>
          {selected.aiProcessingError && (
            <p className="text-xs text-red-500 mt-2">AI error: {selected.aiProcessingError}</p>
          )}
          {selected.notes && (
            <p className="text-sm text-gray-500 mt-2 italic">"{selected.notes}"</p>
          )}
        </div>

        {selected.fileUrl && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-brand-teal" /> Original prescription
            </h2>
            {selected.fileType === 'application/pdf' ? (
              <iframe src={selected.fileUrl} title="Prescription PDF" className="w-full h-72 rounded-xl border border-gray-200" />
            ) : (
              <img src={selected.fileUrl} alt="Prescription" className="w-full max-h-72 object-contain rounded-xl border border-gray-200" />
            )}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-white">
              Medications {selected.aiProcessingStatus === 'FAILED' && <span className="text-xs text-red-500 font-normal">(AI failed — enter manually)</span>}
            </h2>
            <button onClick={addRow} className="text-xs font-medium text-brand-teal flex items-center gap-1">
              <PlusIcon className="w-4 h-4" /> Add line
            </button>
          </div>

          <div className="space-y-3">
            {editable.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  placeholder="Medication name *"
                  value={it.name}
                  onChange={(e) => updateEditable(idx, { name: e.target.value })}
                  className="col-span-4 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
                <input
                  placeholder="Dosage"
                  value={it.dosage ?? ''}
                  onChange={(e) => updateEditable(idx, { dosage: e.target.value })}
                  className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
                />
                <input
                  placeholder="Frequency"
                  value={it.frequency ?? ''}
                  onChange={(e) => updateEditable(idx, { frequency: e.target.value })}
                  className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
                />
                <input
                  placeholder="Duration"
                  value={it.duration ?? ''}
                  onChange={(e) => updateEditable(idx, { duration: e.target.value })}
                  className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => updateEditable(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="col-span-1 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-center"
                />
                <button onClick={() => removeRow(idx)} className="col-span-1 text-red-400 hover:text-red-600 p-1">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            {editable.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                No medications yet — AI extraction may still be running, or add them manually.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button
              onClick={() => confirm(false)}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && !creatingOrder ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
              Approve (ready for POS / patient)
            </button>
            <button
              onClick={() => confirm(true)}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creatingOrder ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlusIcon className="w-5 h-5" />}
              Approve + Create Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Queue list ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="w-7 h-7 text-brand-teal" />
            Prescription Review Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review AI-extracted prescriptions, correct them, and confirm for fulfillment.
          </p>
        </div>
        <div className="flex gap-2">
          {['', 'PENDING', 'APPROVED'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setStatusFilter(s); load(s); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-brand-teal text-white border-brand-teal' : 'text-gray-500 border-gray-300 dark:border-gray-600 hover:border-brand-teal'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <XCircleIcon className="w-10 h-10 mx-auto mb-3" />
          <p>No prescriptions in the queue.</p>
          <Link href="/branch/prescription-upload" className="text-brand-teal text-sm hover:underline inline-block mt-2">
            Upload a prescription →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openDetail(item)}
              className="w-full text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-brand-teal hover:shadow-md transition-all"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100'}`}>
                  {item.status}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${AI_COLORS[item.aiProcessingStatus] ?? 'bg-gray-100'}`}>
                  AI: {item.aiProcessingStatus}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-white">
                  {item.patient.firstName} {item.patient.lastName}
                </span>
                <span className="text-xs text-gray-400">{item.patient.phone}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4 text-gray-300" />
                <span className="text-xs text-gray-500 truncate">{item.fileName}</span>
                {item.prescriptionMedications.length > 0 && (
                  <span className="text-xs text-brand-teal ml-auto">
                    {item.prescriptionMedications.length} medication(s) extracted
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
