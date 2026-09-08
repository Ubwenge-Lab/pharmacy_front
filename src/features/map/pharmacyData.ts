// src/features/map/pharmacyData.ts

export interface PharmacyLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  status: 'OPEN' | 'CLOSED';
  distance?: number; // km from user – populated at runtime
  isActive: boolean;
  rating?: number;
  hours: string;
  region: string;
}

export const DEFAULT_CENTER: [number, number] = [-1.9441, 30.0619]; // Kigali
export const DEFAULT_ZOOM = 13;
export const ADMIN_DEFAULT_ZOOM = 8;
