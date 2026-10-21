import { render, screen, fireEvent } from '@testing-library/react';
import ForgotPassword from './ForgotPassword';
import authService from '../../services/authService';
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../../components/Header', () => () => null);
jest.mock('../../services/authService', () => ({ forgotPassword: jest.fn() }));
test('mail errors keep the user on the email step', async () => {
    authService.forgotPassword.mockRejectedValue({ error: 'E-posta gönderilemedi.' });
    render(<ForgotPassword />);
    fireEvent.change(screen.getByPlaceholderText('ornek@gtu.edu.tr'), { target: { value: 'student@example.org' } });
    fireEvent.submit(screen.getByText('Kod Gönder').closest('form'));
    await screen.findByText('E-posta gönderilemedi.');
    expect(screen.getByText('Kod Gönder')).toBeInTheDocument();
    expect(screen.queryByLabelText('Doğrulama Kodu')).not.toBeInTheDocument();
    expect(screen.queryByText('Doğrulama kodu e-posta adresinize gönderildi.')).not.toBeInTheDocument();
});
