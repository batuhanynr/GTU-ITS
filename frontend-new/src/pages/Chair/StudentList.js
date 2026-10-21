import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import authService from '../../services/authService';
import './StudentList.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const StudentList = () => {
    const [terms, setTerms] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [studentTypeFilter, setStudentTypeFilter] = useState('all');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch terms on component mount
    useEffect(() => {
        fetchTerms();
    }, []);

    // Fetch students when term or filters change
    useEffect(() => {
        if (selectedTerm) {
            fetchStudents();
        }
    }, [selectedTerm, gradeFilter, studentTypeFilter]);

    const fetchTerms = async () => {
        try {
            const response = await axios.get(`${API_URL}/terms`);
            setTerms(response.data);
            if (response.data.length > 0) {
                setSelectedTerm(response.data[0].id.toString());
            }
        } catch (error) {
            console.error('Error fetching terms:', error);
            setError('Dönemler yüklenirken hata oluştu.');
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        setError('');
        
        try {
            const user = authService.getCurrentUser();
            if (!user || !user.department) {
                setError('Kullanıcı bölümü bulunamadı.');
                setLoading(false);
                return;
            }

            const params = new URLSearchParams();
            if (gradeFilter !== 'all') params.append('gradeFilter', gradeFilter);
            if (studentTypeFilter !== 'all') params.append('studentTypeFilter', studentTypeFilter);

            const response = await axios.get(
                `${API_URL}/students/${user.department.id}/${selectedTerm}?${params.toString()}`
            );
            setStudents(response.data);
        } catch (error) {
            console.error('Error fetching students:', error);
            setError('Öğrenciler yüklenirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // Get term dates for the selected term
    const getSelectedTermDates = () => {
        const term = terms.find(t => t.id.toString() === selectedTerm);
        if (term) {
            return {
                start: new Date(term.startDate).toISOString().split('T')[0],
                end: new Date(term.endDate).toISOString().split('T')[0]
            };
        }
        return { start: '', end: '' };
    };

    // Tarihin dönem dışında olup olmadığını kontrol et
    const isOutOfTermRange = (startDate, endDate) => {
        const termDates = getSelectedTermDates();
        if (!termDates.start || !termDates.end) return false;
        
        const start = new Date(startDate).toISOString().split('T')[0];
        const end = new Date(endDate).toISOString().split('T')[0];
        return start < termDates.start || end > termDates.end;
    };

    const getGradeBadgeClass = (grade) => {
        if (grade === 'S') return 'grade-s';
        if (grade === 'U') return 'grade-u';
        return 'grade-ungraded';
    };

    const getGradeDisplay = (grade) => {
        if (grade === 'S') return 'S';
        if (grade === 'U') return 'U';
        return '-';
    };

    const handleGenerateReport = async () => {
        try {
            const user = authService.getCurrentUser();
            if (!user || !user.department) {
                setError('Kullanıcı bölümü bulunamadı.');
                return;
            }

            setLoading(true);
            setError('');

            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_URL}/internship/generate-report`,
                {
                    termId: parseInt(selectedTerm),
                    departmentId: user.department.id,
                    gradeFilter: gradeFilter === 'all' ? null : gradeFilter,
                    studentTypeFilter: studentTypeFilter === 'all' ? null : studentTypeFilter
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            const termName = terms.find(t => t.id.toString() === selectedTerm)?.name || 'Donem';
            link.setAttribute('download', `Komisyon_Degerlendirme_Tutanagi_${termName.replace(/\s/g, '_')}.docx`);
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error generating report:', error);
            
            // Handle blob error responses
            if (error.response && error.response.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const errorData = JSON.parse(text);
                    setError(errorData.error || 'Rapor oluşturulurken hata oluştu.');
                } catch (parseError) {
                    setError('Rapor oluşturulurken hata oluştu.');
                }
            } else if (error.response && error.response.data && error.response.data.error) {
                setError(error.response.data.error);
            } else {
                setError('Rapor oluşturulurken hata oluştu.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Öğrenci Listesi</h2>
            <p>Seçilen döneme ait staj yapan öğrencileri ve not durumlarını listeleyin.</p>

            {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}

            {/* Filtreler */}
            <div className="filters-card">
                <div className="filter-row">
                    <div className="filter-group">
                        <label htmlFor="term-select">Dönem Seçiniz:</label>
                        <select 
                            id="term-select"
                            value={selectedTerm}
                            onChange={(e) => setSelectedTerm(e.target.value)}
                            disabled={loading || terms.length === 0}
                        >
                            {terms.length === 0 ? (
                                <option>Dönem bulunamadı</option>
                            ) : (
                                terms.map(term => (
                                    <option key={term.id} value={term.id}>
                                        {term.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="grade-filter">Puana Göre Filtrele:</label>
                        <select 
                            id="grade-filter"
                            value={gradeFilter}
                            onChange={(e) => setGradeFilter(e.target.value)}
                            disabled={loading}
                        >
                            <option value="all">Tümü</option>
                            <option value="S">Başarılı (S)</option>
                            <option value="U">Başarısız (U)</option>
                            <option value="ungraded">Puanlanmamış</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="type-filter">Staj Tipi:</label>
                        <select 
                            id="type-filter"
                            value={studentTypeFilter}
                            onChange={(e) => setStudentTypeFilter(e.target.value)}
                            disabled={loading}
                        >
                            <option value="all">Tümü</option>
                            <option value="first">Zorunlu Staj 1</option>
                            <option value="second">Zorunlu Staj 2</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Öğrenci Listesi Tablosu */}
            <div className="table-container-card">
                <div className="table-header-info">
                    <h3>{terms.find(t => t.id.toString() === selectedTerm)?.name || 'Seçili Dönem'} Staj Listesi</h3>
                    <span className="student-count">
                        {loading ? 'Yükleniyor...' : `${students.length} öğrenci`}
                    </span>
                </div>
                
                <div className="info-legend">
                    <span className="legend-item">
                        <span className="legend-box out-of-range"></span>
                        Kırmızı çerçeve: Dönem dışı tarih
                    </span>
                </div>

                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>Numara</th>
                            <th>Ad Soyad</th>
                            <th>Önceki Staj Yeri</th>
                            <th>Mevcut Staj Yeri</th>
                            <th>Başlangıç Tarihi</th>
                            <th>Bitiş Tarihi</th>
                            <th>Staj Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Yükleniyor...
                                </td>
                            </tr>
                        ) : students.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                                    <i className="fa-solid fa-circle-info"></i> Seçili filtrelere uygun öğrenci bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            students.map((student, index) => {
                                if (!student.currentInternship) return null;
                                
                                const outOfRange = isOutOfTermRange(
                                    student.currentInternship.startDate,
                                    student.currentInternship.endDate
                                );
                                
                                return (
                                    <tr key={`${student.id}-${student.currentInternship.id}`} className={outOfRange ? 'out-of-term-range' : ''}>
                                        <td>{student.studentNumber}</td>
                                        <td>{student.name}</td>
                                        <td>
                                            {student.previousInternship 
                                                ? student.previousInternship.company 
                                                : <span className="no-data">-</span>
                                            }
                                        </td>
                                        <td>{student.currentInternship.company}</td>
                                        <td>{new Date(student.currentInternship.startDate).toLocaleDateString('tr-TR')}</td>
                                        <td>{new Date(student.currentInternship.endDate).toLocaleDateString('tr-TR')}</td>
                                        <td>
                                            <span className={`grade-badge ${getGradeBadgeClass(student.currentInternship.grade)}`}>
                                                {getGradeDisplay(student.currentInternship.grade)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                
                <div className="table-footer">
                    <button 
                        className="btn-generate-report"
                        onClick={handleGenerateReport}
                        disabled={loading || students.length === 0}
                    >
                        <i className="fa-solid fa-file-signature"></i> 
                        Komisyon Değerlendirme Tutanağı Oluştur
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentList;
