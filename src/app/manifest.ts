// frontend/src/app/manifest.ts - Web app manifest (served at /manifest.webmanifest)

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'E-Vuze Healthcare Hub',
    short_name: 'E-Vuze',
    description: "Rwanda's unified healthcare management system",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F8FBFF',
    theme_color: '#1E4D8C',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
