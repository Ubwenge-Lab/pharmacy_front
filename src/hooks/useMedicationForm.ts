/**
 * src/hooks/useMedicationForm.ts
 *
 * Shared form state, branchId resolution, validation, and submit handler
 * for the Add Medication pages across pharmacy, branch, and staff portals.
 *
 * The three portals differ only in HOW they resolve the branchId:
 *   pharmacy     → fetches GET /branches/my-branches → shows a <select> of branches
   *   branch       → calls GET /branches/my-branch-details → resolves id and name from JWT server-side
 *   staff        → fetches GET /staff/profile/me which returns branch info directly
 *
 * The hook returns state + a submit handler. JSX stays in the page component.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api, { unwrapData, unwrapItem } from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errorHandler';
import { FDA_CATEGORIES } from '@/lib/constants';
import { fetchStaffProfile } from '@/services/staffProfile';

export type MedicationFormRole = 'pharmacy' | 'branch' | 'staff';

export interface MedicationFormState {
  name: string;
  category: string;
  chemicalName: string;
  description: string;
  price: string;
  quantity: string;
  lowStockThreshold: string;
  requiresPrescription: boolean;
  // pharmacy only — ignored for branch/staff
  branchId: string;
}

export interface UseMedicationFormReturn {
  /** Current form field values */
  form: MedicationFormState;
  /** Setter — update any field */
  setForm: React.Dispatch<React.SetStateAction<MedicationFormState>>;
  /** True while the POST /medications call is in flight */
  loading: boolean;
  /** True while branch/profile data is loading on mount */
  contextLoading: boolean;
  /** pharmacy: list of branches for the <select>; empty for other roles */
  branches: { id: string; name: string }[];
  /** branch/staff: display name of the resolved branch (read-only field) */
  branchName: string;
  /** branch: true if the backend returned 403 (Role not yet permitted) */
  backendPending: boolean;
  /** Call this from the form's onSubmit */
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

const INITIAL_FORM: MedicationFormState = {
  name: '',
  category: FDA_CATEGORIES[0],
  chemicalName: '',
  description: '',
  price: '',
  quantity: '',
  lowStockThreshold: '10',
  requiresPrescription: false,
  branchId: '',
};

const REDIRECT: Record<MedicationFormRole, string> = {
  pharmacy: '/pharmacy/inventory',
  branch:   '/branch/inventory',
  staff:    '/staff/inventory',
};

export function useMedicationForm(role: MedicationFormRole): UseMedicationFormReturn {
  const { t }  = useTranslation();
  const router = useRouter();

  const [form, setForm]               = useState<MedicationFormState>(INITIAL_FORM);
  const [loading, setLoading]         = useState(false);
  const [contextLoading, setCtxLoad]  = useState(true);
  const [branches, setBranches]       = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId]       = useState('');
  const [branchName, setBranchName]   = useState('');
  const [backendPending, setBackendPending] = useState(false);

  // ── Mount: resolve branchId according to role ──────────────────────────
  useEffect(() => {
    if (role === 'pharmacy') {
      api.get('/branches/my-branches')
        .then(res => {
          const list: { id: string; name: string }[] =
            unwrapData(res.data);
          setBranches(list);
          // Auto-select when there is exactly one branch
          if (list.length === 1) {
            setForm(f => ({ ...f, branchId: list[0].id }));
          }
        })
        .catch(() => toast.error(t('errors.failedToLoadBranches')))
        .finally(() => setCtxLoad(false));

    } else if (role === 'branch') {
      // Branch manager: GET /branches/my-branch-details returns the manager's own
      // branch { id, name, address, latitude, longitude } resolved from JWT server-side.
      api.get('/branches/my-branch-details')
        .then(res => {
          const branch = unwrapItem<{ id: string; name: string }>(res.data);
          if (branch?.id)   setBranchId(branch.id);
          if (branch?.name) setBranchName(branch.name);
        })
        .catch(() => toast.error(t('errors.failedLoadBranchInfo')))
        .finally(() => setCtxLoad(false));

    } else {
      // staff: GET /staff/profile/me returns branchId and branch.name
      fetchStaffProfile()
        .then(profile => {
          setBranchName(profile?.branch?.name ?? '');
          setBranchId(profile?.branchId ?? profile?.branch?.id ?? '');
        })
        .catch(() => toast.error(t('errors.failedLoadBranchInfo')))
        .finally(() => setCtxLoad(false));
    }
  }, [role]);

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // pharmacy must have a branch selected
    if (role === 'pharmacy' && !form.branchId) {
      toast.error(t('form.selectBranch'));
      return;
    }

    // staff must have resolved a branchId
    if (role === 'staff' && !branchId) {
      toast.error(t('errors.branchNotFound'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/medications', {
        // pharmacy sends the selected branchId from the form;
        // branch/staff send the resolved one (backend also reads it from JWT)
        branchId: role === 'pharmacy' ? form.branchId : branchId || undefined,
        name:                   form.name,
        chemicalName:           form.chemicalName   || undefined,
        description:            form.description    || undefined,
        category:               form.category,
        price:                  parseFloat(form.price),
        quantity:               parseInt(form.quantity),
        lowStockThreshold:      parseInt(form.lowStockThreshold),
        requiresPrescription:   form.requiresPrescription,
      });

      toast.success(t('success.medicationAdded'));
      router.push(REDIRECT[role]);

    } catch (error: unknown) {
      if ((error as any)?.response?.status === 403) {
        // Backend hasn't granted this role access to POST /medications yet
        setBackendPending(true);
        toast.error(t('errors.backendNotEnabled'));
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    setForm,
    loading,
    contextLoading,
    branches,
    branchName,
    backendPending,
    handleSubmit,
  };
}
