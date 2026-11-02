// src/hooks/useStaffPermissions.ts
//
// Reads the authenticated staff member's permission list from the shared
// staff profile (services/staffProfile.ts) and exposes a `can()` helper.
//
// Usage:
//   const { can, permissions, loading } = useStaffPermissions();
//   if (can('APPROVE_PRESCRIPTIONS')) { ... }

'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchStaffProfile } from '@/services/staffProfile';

type StaffPermission = string;

interface UseStaffPermissionsResult {
  /** True while the initial profile fetch is in-flight. */
  loading: boolean;
  /** The raw list of permission strings assigned to this staff member. */
  permissions: StaffPermission[];
  /**
   * Returns true if the staff member has the given permission.
   * Always returns true while loading (optimistic) so UIs don't flash
   * a locked state before data arrives.
   */
  can: (permission: StaffPermission) => boolean;
}

export function useStaffPermissions(): UseStaffPermissionsResult {
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // One shared request for the whole page: sidebar, gates and pages all land here.
    fetchStaffProfile()
      .then((profile) => {
        if (cancelled) return;
        // Profile shape: { permissions: { permissions: string[] } }
        const raw: string[] = profile?.permissions?.permissions ?? [];
        setPermissions(raw);
      })
      .catch(() => {
        // Silently fail — if the fetch errors, `can()` returns false
        // for all non-trivial permissions, which is the safe default.
        if (!cancelled) setPermissions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const can = useCallback(
    (permission: StaffPermission): boolean => {
      // Pessimistic while loading — avoids showing unauthorized tabs on login before permissions arrive.
      if (loading) return false;
      return permissions.includes(permission);
    },
    [loading, permissions],
  );

  return { loading, permissions, can };
}
