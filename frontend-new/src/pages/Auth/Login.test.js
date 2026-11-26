import { fireEvent, render, screen } from '@testing-library/react';
import Login from './Login';
import authService from '../../services/authService';

// CRA's Jest resolver cannot load React Router's package exports.
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../../services/authService', () => ({ login: jest.fn() }));

test('shows a rejected login and keeps the form available for another attempt', async () => {
    authService.login.mockRejectedValue({ error: 'E-posta veya şifre hatalı' });
    render(<Login />);

    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'test@example.org' } });
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giriş' }));

    expect(await screen.findByText('E-posta veya şifre hatalı')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş' })).toBeEnabled();
});
