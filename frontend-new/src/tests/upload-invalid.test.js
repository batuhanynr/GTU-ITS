import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChairUpload from '../pages/Chair/UploadInternshipPDF';
import MemberUpload from '../pages/Member/UploadInternshipPDF';
import api from '../services/api';
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/authService', () => ({ getCurrentUser: () => ({ department: { id: 1 } }), getToken: () => 'token' }));
test.each([ChairUpload, MemberUpload])('unread fields stay in review and are not submitted', async Component => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: [{ id: 1, name: 'Summer' }] });
    api.post.mockResolvedValue({ data: { success: true, data: { studentId: 'NOT FOUND', studentName: 'Student', internshipType: 'STAJ1',
        startDate: '01.07.2026', endDate: '01.08.2026', duration: 20, companyName: 'Company', contactName: '', contactPosition: '' } } });
    render(<Component />);
    await screen.findByText('Summer');
    fireEvent.change(screen.getByLabelText('Staj Fişlerini Yükle'), { target: { files: [new File(['%PDF'], 'one.pdf', { type: 'application/pdf' })] } });
    await screen.findByDisplayValue('NOT FOUND');
    fireEvent.click(screen.getByText('Tümünü Onayla ve Kaydet'));
    await screen.findByText('Hiçbir öğrenci kaydedilemedi!');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('NOT FOUND')).toBeInTheDocument();
});
