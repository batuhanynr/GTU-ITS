import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InternshipActions from './InternshipActions';
import axios from 'axios';
import authService from '../services/authService';
jest.mock('axios', () => ({ put: jest.fn(), delete: jest.fn() }));
jest.mock('../services/authService', () => ({ getCurrentUser: jest.fn(), getToken: () => 'test-token' }));
const internship = { id: 42, company: 'Old company', startDate: '2026-07-01', endDate: '2026-08-01', durationDays: 20 };
beforeEach(() => {
    jest.clearAllMocks();
    authService.getCurrentUser.mockReturnValue({ role: { name: 'Commission Chair' } });
});
test('edits the selected internship and refreshes the list', async () => {
    const refresh = jest.fn();
    axios.put.mockResolvedValue({});
    render(<InternshipActions internship={internship} onSaved={refresh} />);
    fireEvent.click(screen.getByText('Düzenle'));
    fireEvent.change(screen.getByLabelText('Kurum'), { target: { value: 'Correct company' } });
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/internship/42'), expect.objectContaining({ companyName: 'Correct company', durationDays: 20 }), expect.any(Object));
});
test('cancelled deletion sends no request', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<InternshipActions internship={internship} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByText('Sil'));
    expect(axios.delete).not.toHaveBeenCalled();
    window.confirm.mockRestore();
});
test('members can edit but cannot delete', () => {
    authService.getCurrentUser.mockReturnValue({ role: { name: 'Commission Member' } });
    render(<InternshipActions internship={internship} onSaved={jest.fn()} />);
    expect(screen.getByText('Düzenle')).toBeInTheDocument();
    expect(screen.queryByText('Sil')).not.toBeInTheDocument();
});
