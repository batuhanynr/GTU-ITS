import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ChairUpload from '../pages/Chair/UploadInternshipPDF';
import MemberUpload from '../pages/Member/UploadInternshipPDF';
import api from '../services/api';
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/authService', () => ({ getCurrentUser: () => ({ department: { id: 1 } }), getToken: () => 'test-token' }));
const saved = () => api.post.mock.calls.filter(([url]) => url.endsWith('/create')).map(([, form]) => JSON.parse(form.get('data')).studentId);
async function upload(Component, failSecond = false) {
    let parsed = 0;
    api.get.mockResolvedValue({ data: [{ id: 1, name: 'Summer' }] });
    api.post.mockImplementation(async (url, form) => {
        if (url.endsWith('/parse-pdf')) {
            parsed++;
            return { data: { success: true, data: { studentId: String(parsed), studentName: `Student ${parsed}`,
                internshipType: 'STAJ1', startDate: '01.07.2026', endDate: '01.08.2026', duration: 20,
                companyName: 'Company', contactName: '', contactPosition: '' } } };
        }
        if (failSecond && JSON.parse(form.get('data')).studentId === '2') throw new Error('Save failed');
        return { data: { success: true } };
    });
    render(<Component />);
    await screen.findByText('Summer');
    fireEvent.change(screen.getByLabelText('Staj Fişlerini Yükle'), { target: { files: [
        new File(['%PDF'], 'one.pdf', { type: 'application/pdf' }), new File(['%PDF'], 'two.pdf', { type: 'application/pdf' })
    ] } });
    await screen.findByDisplayValue('Student 1');
}
afterEach(() => { cleanup(); jest.clearAllMocks(); });
describe.each([['chair', ChairUpload], ['member', MemberUpload]])('%s upload', (_, Component) => {
    test('a rejected record is excluded from save all', async () => {
        await upload(Component);
        fireEvent.click(screen.getByText('Reddet'));
        fireEvent.click(screen.getByText('Onayla'));
        await screen.findByDisplayValue('Student 2');
        fireEvent.click(screen.getByText('Tümünü Onayla ve Kaydet'));
        await waitFor(() => expect(saved()).toEqual(['2']));
        await screen.findByText('Adım 1: Staj Belgelerini Yükle');
    });
    test('retry submits only failed records', async () => {
        await upload(Component, true);
        fireEvent.click(screen.getByText('Tümünü Onayla ve Kaydet'));
        await waitFor(() => expect(screen.getByDisplayValue('Student 2')).toBeInTheDocument());
        api.post.mockResolvedValue({ data: { success: true } });
        fireEvent.click(screen.getByText('Tümünü Onayla ve Kaydet'));
        await screen.findByText('Adım 1: Staj Belgelerini Yükle');
        expect(saved()).toEqual(['1', '2', '2']);
    });
});
