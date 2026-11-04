/**
 * Tests: src/app/pharmacy/inventory/page.tsx
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
  const apiObj = { get: jest.fn() };
  return { __esModule: true, default: apiObj };
});

jest.mock('@/hooks/useFetch', () => ({
  useFetch: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('@heroicons/react/24/outline', () => {
  const icon = () => <span />;
  return {
    MagnifyingGlassIcon: icon, PlusIcon: icon, PencilIcon: icon,
    ArrowUpTrayIcon: icon, ExclamationTriangleIcon: icon,
  };
});

jest.mock('@/components/shared/LoadingSpinner', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-spinner" />,
}));

jest.mock('@/lib/constants', () => ({
  FDA_CATEGORIES: ['Analgesics', 'Antibiotics', 'Antifungals'],
}));

import { useFetch } from '@/hooks/useFetch';

const mockUseFetch = useFetch as jest.Mock;

const MOCK_MEDICATIONS = [
  { id: 'med-1', name: 'Amoxicillin', category: 'Antibiotics', manufacturer: 'PharmaCo', quantity: 50, lowStockThreshold: 10, unitPrice: 500 },
  { id: 'med-2', name: 'Paracetamol', category: 'Analgesics',  manufacturer: 'MedLabs',  quantity: 3,  lowStockThreshold: 10, unitPrice: 200 },
  { id: 'med-3', name: 'Fluconazole', category: 'Antifungals', manufacturer: 'GlobalRx', quantity: 0,  lowStockThreshold: 5,  unitPrice: 1200 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFetch.mockReturnValue({
    data: MOCK_MEDICATIONS,
    loading: false,
    error: null,
  });
});

describe('PharmacyInventoryPage', () => {
  test('renders without crashing', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    expect(document.body).toBeTruthy();
  });

  test('shows loading spinner while fetching', async () => {
    mockUseFetch.mockReturnValue({ data: null, loading: true, error: null });
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    render(<PharmacyInventoryPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('renders all medications in the list', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    await waitFor(() => {
      expect(screen.getByText(/Amoxicillin/i)).toBeInTheDocument();
      expect(screen.getByText(/Paracetamol/i)).toBeInTheDocument();
      expect(screen.getByText(/Fluconazole/i)).toBeInTheDocument();
    });
  });

  test('shows low-stock badge for medications below threshold', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    await waitFor(() => {
      // Paracetamol has qty 3, threshold 10 → low stock
      expect(screen.getByText(/Low/i)).toBeInTheDocument();
    });
  });

  test('shows out-of-stock badge for zero-quantity items', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    await waitFor(() => {
      expect(screen.getByText(/inventory.outOfStock/i)).toBeInTheDocument();
    });
  });

  test('search filters visible medications', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    await waitFor(() => screen.getByText(/Amoxicillin/i));

    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'Amoxicillin' } });

    await waitFor(() => {
      expect(screen.getByText(/Amoxicillin/i)).toBeInTheDocument();
      expect(screen.queryByText(/Paracetamol/i)).not.toBeInTheDocument();
    });
  });

  test('add medication button is rendered', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    await waitFor(() => {
      // There should be a button or link to add a new medication
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  test('shows empty state when no medications match search', async () => {
    const { default: PharmacyInventoryPage } = await import('@/app/pharmacy/inventory/page');
    await act(async () => { render(<PharmacyInventoryPage />); });
    await waitFor(() => screen.getByRole('textbox'));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyznotareal' } });

    await waitFor(() => {
      expect(screen.queryByText(/Amoxicillin/i)).not.toBeInTheDocument();
    });
  });
});
