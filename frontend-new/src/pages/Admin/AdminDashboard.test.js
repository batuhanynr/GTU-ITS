import { render, screen } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import authService from '../../services/authService';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../../services/authService', () => ({ isAuthenticated: jest.fn(), getCurrentUser: jest.fn(), logout: jest.fn() }));
jest.mock('../../components/Header', () => () => null);
jest.mock('./CommissionChairAssignment', () => () => null);
jest.mock('./CommissionStatus', () => () => null);

beforeEach(() => jest.clearAllMocks());

test.each([
    ['Commission Member', '/member-dashboard'],
    ['Commission Chair', '/chair-dashboard'],
    ['Unknown', '/'],
])('blocks %s from admin controls', (name, destination) => {
    authService.isAuthenticated.mockReturnValue(true);
    authService.getCurrentUser.mockReturnValue({ role: { name } });
    render(<AdminDashboard />);
    expect(mockNavigate).toHaveBeenCalledWith(destination, { replace: true });
    expect(screen.queryByText('Komisyon Başkanı Atama')).not.toBeInTheDocument();
});

test('allows the general admin', () => {
    authService.isAuthenticated.mockReturnValue(true);
    authService.getCurrentUser.mockReturnValue({ name: 'Admin', role: { name: 'General Admin' } });
    render(<AdminDashboard />);
    expect(screen.getByText('Komisyon Başkanı Atama')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
});

test('redirects guests to login', () => {
    authService.isAuthenticated.mockReturnValue(false);
    render(<AdminDashboard />);
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Komisyon Başkanı Atama')).not.toBeInTheDocument();
});
