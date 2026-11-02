'use client';

/**
 * LocationPicker — reusable Leaflet/OpenStreetMap map component.
 *
 * Renders an interactive map centred on Kigali. The user can:
 *   1. Click anywhere on the map to drop a pin.
 *   2. Drag the existing pin to a new position.
 *   3. Press "Use My Location" to capture live GPS coordinates.
 *
 * Props:
 *   latitude / longitude — controlled values (can be undefined while unset)
 *   onChange(lat, lng)   — called whenever the pin moves
 *   required             — if true the outer label shows a red asterisk
 *   label                — section heading (defaults to "Pin Your Location")
 */

import { useEffect, useRef, useState } from 'react';
import { MapPinIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
  required?: boolean;
  label?: string;
  /** Height of the map container. Defaults to "300px". */
  height?: string;
  /**
   * Don't load Leaflet or any map tiles until the user opens the map (or taps
   * "Use My Location"). Use on pages where the map would otherwise be the
   * heaviest thing on first load, e.g. /signup.
   */
  lazy?: boolean;
}

// Kigali city centre as the default map centre
const DEFAULT_CENTER: [number, number] = [-1.9706, 30.1044];
const DEFAULT_ZOOM = 13;

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  required = false,
  label = 'Pin Your Location',
  height = '300px',
  lazy = false,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // In lazy mode the map stays a placeholder until the user asks for it
  const [mapActive, setMapActive] = useState(!lazy || (latitude !== undefined && longitude !== undefined));
  // Latest coordinates, read when Leaflet finishes loading — in lazy mode the
  // user may have pinned via GPS while the import was still in flight.
  const coordsRef = useRef({ latitude, longitude });
  coordsRef.current = { latitude, longitude };
  // Store Leaflet map + marker instances in refs so React doesn't re-create them
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // ── Bootstrap Leaflet (client-side only) ─────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    if (typeof window === 'undefined') return;
    if (!mapActive) return; // lazy mode: wait until the user opens the map
    if (leafletMapRef.current) return; // already initialised

    // Dynamic import keeps Leaflet out of the SSR bundle
    import('leaflet').then((L) => {
      // Guard against component being unmounted or map already initialized during async import
      if (!isMounted || !mapRef.current || leafletMapRef.current) return;

      // Check if the container already has an internal Leaflet ID (prevents "Map container already initialized" error)
      // @ts-ignore
      if (mapRef.current._leaflet_id) return;

      // Fix default marker icon paths broken by bundlers
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const { latitude, longitude } = coordsRef.current;
      const initialCenter: [number, number] =
        latitude !== undefined && longitude !== undefined
          ? [latitude, longitude]
          : DEFAULT_CENTER;

      const map = L.map(mapRef.current, {
        center: initialCenter,
        zoom: latitude !== undefined ? 16 : DEFAULT_ZOOM,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Place initial marker if coordinates already exist
      if (latitude !== undefined && longitude !== undefined) {
        const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
        });
        markerRef.current = marker;
      }

      // Click to place / move pin
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const roundedLat = parseFloat(lat.toFixed(6));
        const roundedLng = parseFloat(lng.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          const marker = L.marker([roundedLat, roundedLng], { draggable: true }).addTo(map);
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
          });
          markerRef.current = marker;
        }
        onChange(roundedLat, roundedLng);
      });

      leafletMapRef.current = map;
    });

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
    // Run once the map is active (on mount, unless lazy)
  }, [mapActive]);

  // ── Sync external lat/lng changes into the map ───────────────────────────
  useEffect(() => {
    if (!leafletMapRef.current) return;
    if (latitude === undefined || longitude === undefined) return;

    import('leaflet').then((L) => {
      const map = leafletMapRef.current;
      if (!map) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
        });
        markerRef.current = marker;
      }
      map.setView([latitude, longitude], 16);
    });
  }, [latitude, longitude]);

  // ── GPS handler ──────────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    setMapActive(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));

        // Notify the parent so its controlled state (latitude/longitude props) updates.
        onChange(lat, lng);
        setGpsLoading(false);

        // Also update the map directly — we cannot rely solely on the prop
        // re-render cycle because the sync useEffect does another async
        // import('leaflet') which may lose the race against this callback,
        // leaving the map panned to Kigali with no marker placed.
        //
        // If the map is already initialised (common case — user clicks the
        // button after the map has rendered), move immediately.
        const map = leafletMapRef.current;
        if (!map) return; // map not ready yet; the sync useEffect will handle it when props arrive

        import('leaflet').then((L) => {
          if (!leafletMapRef.current) return; // unmounted between callback and import resolve
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.on('dragend', () => {
              const p = marker.getLatLng();
              onChange(parseFloat(p.lat.toFixed(6)), parseFloat(p.lng.toFixed(6)));
            });
            markerRef.current = marker;
          }
          map.setView([lat, lng], 16);
        });
      },
      (err) => {
        // Map Geolocation API error codes to human-readable messages
        let message = 'Could not get location.';
        if (err.code === err.PERMISSION_DENIED) {
          message = 'Location access was denied. Please allow location access in your browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable. Try pinning your location on the map manually.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Location request timed out. Please try again.';
        }
        setGpsError(message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const hasPinned = latitude !== undefined && longitude !== undefined;

  return (
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gpsLoading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50 transition-all"
        >
          {gpsLoading
            ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
            : <MapPinIcon className="w-3.5 h-3.5" />}
          {gpsLoading ? 'Getting location…' : 'Use My Location'}
        </button>
      </div>

      {/* Instruction */}
      <p className="text-xs text-gray-400">
        Click on the map to pin your exact location, or drag the pin to adjust.
      </p>

      {/* Map container (a same-size placeholder until opened, in lazy mode) */}
      {mapActive ? (
        <div
          ref={mapRef}
          style={{ height, width: '100%', borderRadius: '0.75rem', border: hasPinned ? '2px solid var(--color-brand-teal)' : '2px solid #E5E7EB', overflow: 'hidden' }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setMapActive(true)}
          style={{ height }}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-sm font-medium text-teal-700 hover:bg-teal-50 transition-all"
        >
          <MapPinIcon className="w-6 h-6" />
          Tap to open the map
        </button>
      )}

      {/* Coordinate display */}
      {hasPinned ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
          <MapPinIcon className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="text-xs text-teal-700 font-medium">
            Lat: {latitude?.toFixed(6)} &nbsp;|&nbsp; Lng: {longitude?.toFixed(6)}
          </span>
          <span className="ml-auto text-xs text-teal-500">✓ Location pinned</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <MapPinIcon className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700">No location pinned yet — click the map above</span>
        </div>
      )}

      {/* GPS error */}
      {gpsError && (
        <p className="text-xs text-red-500">{gpsError}</p>
      )}
    </div>
  );
}
