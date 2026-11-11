import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, v?: string | Record<string, unknown>) => typeof v === 'string' ? v : key }),
}));
jest.mock('@/lib/api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
jest.mock('@/lib/hospital', () => ({ useHospitalId: jest.fn().mockReturnValue('h1') }));
jest.mock('next/image', () => ({ __esModule: true, default: ({ src, alt }: any) => <img src={src} alt={alt} /> }));
jest.mock('lucide-react', () => {
  const i = () => <span />;
  return { Settings: i, BadgeDollarSign: i, Megaphone: i, Building2: i, UserCircle2: i, Plus: i, ChevronRight: i, MoreVertical: i, Save: i, Loader2: i };
});
jest.mock('react-hot-toast', () => {
  const fn = Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() });
  return { __esModule: true, default: fn, toast: fn };
});
jest.mock('@/mock/hospital/settings', () => ({ MOCK_HOSPITAL_SETTINGS: { hospitalName: 'Test Hospital' } }));

import api from '@/lib/api';
import { useHospitalId } from '@/lib/hospital';
import AdminSettingsPage from '@/app/hospital/admin/settings/page';

const mockGet = api.get as jest.Mock;
const mockPatch = api.patch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useHospitalId as jest.Mock).mockReturnValue('h1');
  mockGet.mockResolvedValue({ data: { id: 'h1', name: 'Test Hospital', address: '123 St', phone: '+250', email: 'h@t.com' } });
  mockPatch.mockRejectedValue({ response: { status: 404 } });
});

describe('AdminSettingsPage', () => {
  test('renders without crashing in loading state', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    expect(() => render(<AdminSettingsPage />)).not.toThrow();
  });

  test('shows loading skeleton initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AdminSettingsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  test('calls GET /hospitals/${id} on mount', async () => {
    render(<AdminSettingsPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/hospitals/h1')));
  });

  test('calls GET /hospitals/${id}/doctors on mount', async () => {
    render(<AdminSettingsPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/doctors')));
  });

  test('renders general tab content after load', async () => {
    render(<AdminSettingsPage />);
    await waitFor(() => expect(document.body.innerHTML).toContain('hospital.general'));
  });

  test('save button triggers PATCH /hospitals/${id} (Gap S-1: returns error gracefully)', async () => {
    render(<AdminSettingsPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const saveBtn = screen.getByText('hospital.saveChanges');
    fireEvent.click(saveBtn);
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(expect.stringContaining('/hospitals/h1'), expect.any(Object)));
  });
});
