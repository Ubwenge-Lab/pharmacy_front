// src/services/pharmacyDashboard.ts
//
// Owner dashboard and owner analytics both need stats and analytics. They go
// through these functions so opening the second page within the TTL does not
// repeat the calls. Both return the raw response body, the same value the
// pages passed to unwrapItem() before.

import api from '@/lib/api';
import { cachedRequest } from '@/lib/requestCache';

const DASHBOARD_TTL_MS = 30_000;

export function fetchPharmacyStats(options: { force?: boolean } = {}): Promise<unknown> {
  return cachedRequest(
    'pharmacy:dashboard:stats',
    async () => (await api.get('/pharmacies/dashboard/stats')).data,
    { ttlMs: DASHBOARD_TTL_MS, force: options.force },
  );
}

export function fetchPharmacyAnalytics(options: { force?: boolean } = {}): Promise<unknown> {
  return cachedRequest(
    'pharmacy:dashboard:analytics',
    async () => (await api.get('/pharmacies/dashboard/analytics')).data,
    { ttlMs: DASHBOARD_TTL_MS, force: options.force },
  );
}
