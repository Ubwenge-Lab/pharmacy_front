'use client';

import { useEffect } from 'react';

/**
 * Registers the offline-shell service worker (public/sw.js).
 *
 * Production only: in `next dev` a service worker would sit between the
 * browser and hot reloading, so test it with `npm run build && npm start`.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal — the app works without it, it just won't have an offline page
    });
  }, []);

  return null;
}
