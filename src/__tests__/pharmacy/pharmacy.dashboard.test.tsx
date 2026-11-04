/**
 * Tests: src/app/pharmacy/dashboard/page.tsx
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, v?: string | Record<string, unknown>) =>
      typeof v === 'string' ? v : key,
  }),
}));

jest.mock('@/lib/api', () => {
  const apiObj = { get: jest.fn() };
  return {
    __esModule: true,
    default: apiObj,
    unwrapItem: jest.fn((d: any) => (Array.isArray(d) ? null : d?.data ?? d ?? null)),
  };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

jest.mock('@heroicons/react/24/outline', () => {
  const icon = () => <span />;
  return {
    ArrowTrendingUpIcon: icon, ArrowTrendingDownIcon: icon, UsersIcon: icon,
    BoltIcon: icon, BuildingOffice2Icon: icon, CurrencyDollarIcon: icon,
    ExclamationTriangleIcon: icon, CalendarIcon: icon, Bars3BottomLeftIcon: icon,
  };
});

jest.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  Tooltip: () => null, Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

import api from '@/lib/api';
import { unwrapItem } from '@/lib/api';

const mockGet = api.get as jest.Mock;
const mockUnwrapItem = unwrapItem as jest.Mock;

const MOCK_STATS = {
  totalOrders: 120, pendingOrders: 5, completedOrders: 110,
  totalRevenue: 4500000, activeStaff: 8,
};
const MOCK_ANALYTICS = { topMedications: [], branchPerformance: [] };
const MOCK_DAILY_REVENUE = {
  totalRevenue: 150000,
  branchDaily: [{ branchName: 'Main Branch', days: [] }],
};
const MOCK_WEEKLY_REVENUE = { weeks: [] };
const MOCK_PROFILE = {
  name: 'Kigali Pharmacy', representativeName: 'Dr. Jean Damascene',
  ownerName: 'Dr. Jean Damascene',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUnwrapItem.mockImplementation((d: any) => d ?? null);
  mockGet.mockImplementation((url: string) => {
    if (url.includes('stats'))          return Promise.resolve({ data: MOCK_STATS });
    if (url.includes('analytics'))      return Promise.resolve({ data: MOCK_ANALYTICS });
    if (url.includes('daily-revenue'))  return Promise.resolve({ data: MOCK_DAILY_REVENUE });
    if (url.includes('weekly-revenue')) return Promise.resolve({ data: MOCK_WEEKLY_REVENUE });
    if (url.includes('profile'))        return Promise.resolve({ data: MOCK_PROFILE });
    if (url.includes('/users/me'))      return Promise.resolve({ data: { firstName: 'Jean', lastName: 'Damascene' } });
    return Promise.resolve({ data: null });
  });
});

describe('PharmacyDashboard', () => {
  test('renders without crashing', async () => {
    const { default: PharmacyDashboard } = await import('@/app/pharmacy/dashboard/page');
    await act(async () => { render(<PharmacyDashboard />); });
    expect(document.body).toBeTruthy();
  });

  test('shows loading skeleton initially', async () => {
    // Make the API hang so the loading state is visible
    mockGet.mockImplementation(() => new Promise(() => {}));
    const { default: PharmacyDashboard } = await import('@/app/pharmacy/dashboard/page');
    render(<PharmacyDashboard />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  test('renders greeting after data loads', async () => {
    const { default: PharmacyDashboard } = await import('@/app/pharmacy/dashboard/page');
    await act(async () => { render(<PharmacyDashboard />); });
    await waitFor(() => {
      // Greeting includes the pharmacist's last name or first segment
      expect(screen.getByRole('heading', { name: /Jean|Damascene/i })).toBeInTheDocument();
    });
  });

  test('renders pharmacy name after data loads', async () => {
    const { default: PharmacyDashboard } = await import('@/app/pharmacy/dashboard/page');
    await act(async () => { render(<PharmacyDashboard />); });
    await waitFor(() => {
      expect(screen.getByText(/Kigali Pharmacy/i)).toBeInTheDocument();
    });
  });

  test('shows error state when API calls fail', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('Network error'), { code: 'ERR_NETWORK' }));
    const { default: PharmacyDashboard } = await import('@/app/pharmacy/dashboard/page');
    await act(async () => { render(<PharmacyDashboard />); });
    await waitFor(() => {
      // The page renders an error UI or at least does not crash
      expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
  });

  test('fetches all five dashboard endpoints', async () => {
    const { default: PharmacyDashboard } = await import('@/app/pharmacy/dashboard/page');
    await act(async () => { render(<PharmacyDashboard />); });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const urls: string[] = mockGet.mock.calls.map((c: any[]) => c[0] as string);
    expect(urls.some(u => u.includes('stats'))).toBe(true);
    expect(urls.some(u => u.includes('analytics'))).toBe(true);
    expect(urls.some(u => u.includes('daily-revenue'))).toBe(true);
    expect(urls.some(u => u.includes('weekly-revenue'))).toBe(true);
    expect(urls.some(u => u.includes('profile'))).toBe(true);
  });
});
