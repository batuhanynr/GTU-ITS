export function validateUploadStudent(student) {
    const { name, studentNumber } = student.studentInfo;
    const { companyName, startDate, endDate, duration } = student.internshipInfo;
    const filled = value => typeof value === 'string' && value.trim() && value.trim().toUpperCase() !== 'NOT FOUND';
    if (!filled(name) || !/^\d+$/.test(studentNumber) || !filled(companyName)) {
        return 'Öğrenci adı, numarası ve kurum adı doğru doldurulmalıdır.';
    }
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    // Keep malformed or reversed dates in the review queue for correction.
    if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return 'Geçerli bir başlangıç ve bitiş tarihi giriniz.';
    if (!Number.isInteger(Number(duration ?? 20)) || Number(duration ?? 20) <= 0) return 'Staj süresi pozitif bir tam sayı olmalıdır.';
    return '';
}
