import { validateUploadStudent } from './validateUploadStudent';
const student = { studentInfo: { name: 'Student', studentNumber: '123' }, internshipInfo: { companyName: 'Company', startDate: '2026-07-01', endDate: '2026-08-01', duration: 20 } };
test('accepts valid reviewed fields', () => expect(validateUploadStudent(student)).toBe(''));
test.each([
    { companyName: 'NOT FOUND' }, { endDate: '2026-06-01' }, { startDate: '2026-02-30' }, { duration: 0 }
])('keeps invalid internship fields for correction: %o', fields => {
    expect(validateUploadStudent({ ...student, internshipInfo: { ...student.internshipInfo, ...fields } })).not.toBe('');
});
test('rejects unread student numbers', () => {
    expect(validateUploadStudent({ ...student, studentInfo: { ...student.studentInfo, studentNumber: 'NOT FOUND' } })).not.toBe('');
});
