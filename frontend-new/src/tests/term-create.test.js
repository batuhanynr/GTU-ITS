import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Upload from '../pages/Chair/UploadInternshipPDF';
import api from '../services/api';
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/authService', () => ({ getCurrentUser: () => ({ role: { name: 'Commission Chair' } }), getToken: () => 'test-token' }));
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue({ data: [] }); });
async function fill() {
    render(<Upload />);
    fireEvent.click(screen.getByText('Dönem Ekle'));
    fireEvent.change(screen.getByLabelText('Dönem Adı:'), { target: { value: 'Summer 2027' } });
    fireEvent.change(screen.getByLabelText('Başlangıç Tarihi:'), { target: { value: '2027-06-01' } });
    fireEvent.change(screen.getByLabelText('Bitiş Tarihi:'), { target: { value: '2027-09-01' } });
    fireEvent.click(screen.getAllByText('Dönem Ekle')[1]);
}
test('selects the server-created term after a successful save', async () => {
    api.post.mockResolvedValue({ data: { id: 5, name: 'Summer 2027' } });
    await fill();
    await screen.findByText('Dönem başarıyla eklendi!');
    expect(screen.getByLabelText('Dönem Seçimi')).toHaveValue('5');
    expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/terms'), expect.objectContaining({ name: 'Summer 2027' }), expect.any(Object));
});
test('keeps input open when saving fails and does not show success', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Duplicate term' } } });
    await fill();
    await screen.findByText('Duplicate term');
    expect(screen.getByLabelText('Dönem Adı:')).toHaveValue('Summer 2027');
    expect(screen.queryByText('Dönem başarıyla eklendi!')).not.toBeInTheDocument();
});
