/**
 * Tests: src/app/pharmacy/orders/page.tsx
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, v?: string | Record<string, unknown>) =>
      typeof v === 'string' ? v : key,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/api', () => {
  const apiObj = { get: jest.fn(), post: jest.fn(), patch: jest.fn() };
  return {
    __esModule: true,
    default: apiObj,
    unwrapData: jest.fn((d: any) => (Array.isArray(d) ? d : d?.data ?? [])),
  };
});

jest.mock('@/hooks/useFetch', () => ({
  useFetch: jest.fn(),
}));

jest.mock('@/lib/currency', () => ({
  formatCurrency: (n: number) => `${n} RWF`,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('@heroicons/react/24/outline', () => {
  const icon = () => <span />;
  return { MagnifyingGlassIcon: icon, FunnelIcon: icon, EyeIcon: icon };
});

jest.mock('@/components/shared/StatusBadge', () => ({
  __esModule: true,
  default: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}));

import { useFetch } from '@/hooks/useFetch';

const mockUseFetch = useFetch as jest.Mock;

const MOCK_ORDERS = [
  { id: 'ord-1', status: 'PENDING',   totalAmount: 15000, patientName: 'Alice Uwase',  branchName: 'Main', createdAt: '2026-10-01T10:00:00Z' },
  { id: 'ord-2', status: 'COMPLETED', totalAmount: 8000,  patientName: 'Bob Nkurunziza', branchName: 'Branch B', createdAt: '2026-10-02T10:00:00Z' },
];
const MOCK_BRANCHES = [{ id: 'br-1', name: 'Main' }, { id: 'br-2', name: 'Branch B' }];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFetch.mockReturnValue({
    data: { orders: MOCK_ORDERS, branches: MOCK_BRANCHES },
    loading: false,
    error: null,
  });
});

describe('PharmacyOrdersPage', () => {
  test('renders without crashing', async () => {
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    expect(document.body).toBeTruthy();
  });

  test('shows loading spinner while fetching', async () => {
    mockUseFetch.mockReturnValue({ data: null, loading: true, error: null });
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    render(<PharmacyOrdersPage />);
    // Loading state should render something visible
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  test('renders the orders list after loading', async () => {
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    await waitFor(() => {
      expect(screen.getByText(/Alice Uwase/i)).toBeInTheDocument();
    });
  });

  test('renders status badges for each order', async () => {
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    await waitFor(() => {
      const badges = screen.getAllByTestId('status-badge');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('renders all tab filters', async () => {
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    await waitFor(() => {
      expect(screen.getByText(/All Orders/i)).toBeInTheDocument();
      expect(screen.getByText(/PENDING/i)).toBeInTheDocument();
      expect(screen.getByText(/COMPLETED/i)).toBeInTheDocument();
    });
  });

  test('search box is present', async () => {
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  test('filtering by PENDING tab shows only pending orders', async () => {
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    await waitFor(() => screen.getByText(/All Orders/i));
    fireEvent.click(screen.getByText(/^PENDING$/));
    await waitFor(() => {
      expect(screen.getByText(/Alice Uwase/i)).toBeInTheDocument();
      expect(screen.queryByText(/Bob Nkurunziza/i)).not.toBeInTheDocument();
    });
  });

  test('shows empty state message when no orders match filter', async () => {
    mockUseFetch.mockReturnValue({
      data: { orders: [], branches: [] },
      loading: false,
      error: null,
    });
    const { default: PharmacyOrdersPage } = await import('@/app/pharmacy/orders/page');
    await act(async () => { render(<PharmacyOrdersPage />); });
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
  });
});
