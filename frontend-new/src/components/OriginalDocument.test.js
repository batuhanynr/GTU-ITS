import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OriginalDocument from './OriginalDocument';
import axios from 'axios';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../services/authService', () => ({ getToken: () => 'test-token' }));
test('legacy records show that the PDF is unavailable', () => {
    render(<OriginalDocument internship={{ id: 1, hasOriginalDocument: false }} />);
    expect(screen.getByText('PDF saklanmamış')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('PDF download includes the token and record ID', async () => {
    axios.get.mockRejectedValue(new Error('Unavailable'));
    render(<OriginalDocument internship={{ id: 42, hasOriginalDocument: true }} />);
    fireEvent.click(screen.getByText('PDF indir'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('PDF indirilemedi.'));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/internship/42/document'), {
        headers: { Authorization: 'Bearer test-token' }, responseType: 'blob'
    });
});
