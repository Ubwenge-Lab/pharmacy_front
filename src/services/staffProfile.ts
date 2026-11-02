// src/services/staffProfile.ts
//
// The only place that calls GET /staff/profile/me. Sidebar, PermissionGate,
// the dashboard, the profile page and the medication form all read through
// fetchStaffProfile(), so one page load makes one call.

import api from '@/lib/api';
import { cachedRequest, invalidateRequest } from '@/lib/requestCache';

export const STAFF_PROFILE_KEY = 'staff:profile:me';
const STAFF_PROFILE_TTL_MS = 60_000;

export function fetchStaffProfile<T = any>(options: { force?: boolean } = {}): Promise<T> {
  return cachedRequest<T>(
    STAFF_PROFILE_KEY,
    async () => (await api.get('/staff/profile/me')).data as T,
    { ttlMs: STAFF_PROFILE_TTL_MS, force: options.force },
  );
}

/** Call after PUT /staff/profile/me so permission checks and the sidebar re-read. */
export function invalidateStaffProfile(): void {
  invalidateRequest(STAFF_PROFILE_KEY);
}
