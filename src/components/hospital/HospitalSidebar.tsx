'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  UserCog,
  Clock,
  Bell,
  MessageSquare,
  Pill,
  Settings,
  DollarSign,
  Network,
  Package,
  BarChart2,
  LogOut,
  X,
  User,
  Search,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAVY = '#1E3A5F';
const TEAL = '#38BDF8';

const DOCTOR_NAV = [
  { href: '/hospital/doctor/dashboard',     icon: LayoutDashboard, labelKey: 'hospital.dashboard' },
  { href: '/hospital/doctor/appointments',  icon: CalendarDays,    labelKey: 'hospital.appointments' },
  { href: '/hospital/doctor/consultations', icon: ClipboardList,   labelKey: 'hospital.consultations' },
  { href: '/hospital/doctor/patient',       icon: Users,           labelKey: 'hospital.patients' },
  { href: '/hospital/doctor/schedule',      icon: Clock,           labelKey: 'hospital.schedule' },
  { href: '/hospital/doctor/messages',      icon: MessageSquare,   labelKey: 'hospital.messages' },
  { href: '/hospital/doctor/prescription',  icon: Pill,            labelKey: 'hospital.prescriptions' },
  { href: '/hospital/doctor/settings',      icon: Settings,        labelKey: 'hospital.settings' },
];

const ADMIN_NAV = [
  { href: '/hospital/admin/dashboard',    icon: LayoutDashboard, labelKey: 'hospital.dashboard' },
  { href: '/hospital/admin/staff',        icon: UserCog,         labelKey: 'hospital.staffManagement' },
  { href: '/hospital/admin/departments',  icon: Network,         labelKey: 'hospital.departments' },
  { href: '/hospital/admin/appointments', icon: CalendarDays,    labelKey: 'hospital.appointments' },
  { href: '/hospital/admin/schedule',     icon: Bell,            labelKey: 'hospital.schedule' },
  { href: '/hospital/admin/finance',      icon: DollarSign,      labelKey: 'hospital.finance' },
  { href: '/hospital/admin/inventory',    icon: Package,         labelKey: 'hospital.inventoryProcurement' },
  { href: '/hospital/admin/reports',      icon: BarChart2,       labelKey: 'hospital.reports' },
  { href: '/hospital/admin/settings',     icon: Settings,        labelKey: 'hospital.settings' },
];

const NURSE_NAV = [
  { href: '/hospital/nurse/dashboard',   icon: LayoutDashboard, labelKey: 'hospital.dashboard' },
  { href: '/hospital/nurse/schedule',    icon: Clock,           labelKey: 'hospital.schedule' },
  { href: '/hospital/nurse/patients',    icon: Users,           labelKey: 'hospital.patients' },
  { href: '/hospital/nurse/vitals',      icon: ClipboardList,   labelKey: 'hospital.vitalsAssessments' },
  { href: '/hospital/nurse/medications', icon: Pill,            labelKey: 'hospital.medicationAdministration' },
  { href: '/hospital/nurse/notes',       icon: MessageSquare,   labelKey: 'hospital.nursingNotes' },
  { href: '/hospital/nurse/messages',    icon: MessageSquare,   labelKey: 'hospital.messages' },
  { href: '/hospital/nurse/settings',    icon: Settings,        labelKey: 'hospital.settings' },
];

const RECEPTIONIST_NAV = [
  { href: '/hospital/receptionist/dashboard',            icon: LayoutDashboard, labelKey: 'hospital.dashboard' },
  { href: '/hospital/receptionist/appointment-list',     icon: CalendarDays,    labelKey: 'hospital.appointments' },
  { href: '/hospital/receptionist/checkingQueue',        icon: Clock,           labelKey: 'hospital.checkingQueue' },
  { href: '/hospital/receptionist/patient-list',          icon: ClipboardList,   labelKey: 'hospital.patientList' },
  { href: '/hospital/receptionist/patient-registration', icon: Search,          labelKey: 'hospital.patientRegistration' },
  { href: '/hospital/receptionist/walkin-registration',  icon: UserPlus,        labelKey: 'hospital.walkinRegistration' },
  { href: '/hospital/receptionist/leave-request',        icon: Users,           labelKey: 'hospital.leaveRequest' },
  { href: '/hospital/receptionist/notifications',        icon: Bell,            labelKey: 'common.notifications' },
  { href: '/hospital/receptionist/profile',              icon: User,            labelKey: 'hospital.profile' },
  { href: '/hospital/receptionist/change-password',      icon: UserCog,         labelKey: 'common.changePassword' },
];

const PORTAL_LABEL_KEY: Record<'doctor' | 'admin' | 'nurse' | 'receptionist', string> = {
  doctor:       'hospital.doctorPortal',
  admin:        'hospital.adminPortal',
  nurse:        'hospital.nursePortal',
  receptionist: 'hospital.receptionistPortal',
};

interface Props {
  portalType: 'doctor' | 'admin' | 'nurse' | 'receptionist';
  open?: boolean;
  onClose?: () => void;
}

export default function HospitalSidebar({ portalType, open = false, onClose }: Props) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { t } = useTranslation();

  const nav =
    portalType === 'doctor'       ? DOCTOR_NAV :
    portalType === 'nurse'        ? NURSE_NAV :
    portalType === 'receptionist' ? RECEPTIONIST_NAV :
    ADMIN_NAV;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{ backgroundColor: NAVY }}
    >
      {/* Header */}
      <div className="px-6 py-7 border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <p className="text-white text-2xl font-bold tracking-tight">E-Vuze</p>
          <p className="text-white/60 text-sm mt-0.5">{t(PORTAL_LABEL_KEY[portalType])}</p>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-white/10" aria-label="Close sidebar">
          <X size={18} className="text-white/70" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {nav.map(({ href, icon: Icon, labelKey }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                active ? 'text-white shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              style={active ? { backgroundColor: TEAL } : {}}
            >
              <Icon size={18} />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 pb-5 shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/10 text-sm font-medium"
        >
          <LogOut size={18} />
          {t('hospital.signOut')}
        </button>
      </div>
    </aside>
  );
}
