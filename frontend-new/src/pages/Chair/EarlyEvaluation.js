import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import authService from '../../services/authService';
import './EarlyEvaluation.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const EarlyEvaluation = () => {
    const [terms, setTerms] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('ungraded'); // Default: Puanlanmamış
    const [studentTypeFilter, setStudentTypeFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [showEvaluationModal, setShowEvaluationModal] = useState(false);
    const [evaluationData, setEvaluationData] = useState({});
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
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

    // Filtreleme
    const filteredStudents = students.filter(student => {
        // İsim araması
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            if (!student.name.toLowerCase().includes(query) && 
                !student.studentNumber.includes(query)) {
                return false;
            }
        }
        return true;
    });

    // Selection is keyed by internship id so two internships of one student stay independent.
    const handleSelectStudent = (internshipId) => {
        setSelectedStudents(prev => {
            if (prev.includes(internshipId)) {
                return prev.filter(id => id !== internshipId);
            } else {
                return [...prev, internshipId];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedStudents.length === filteredStudents.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(filteredStudents.map(s => s.currentInternship.id));
        }
    };

    const handleOpenEvaluationModal = () => {
        if (selectedStudents.length === 0) {
            alert('Lütfen en az bir öğrenci seçin!');
            return;
        }
        
        // Initialize evaluation data for selected students
        const initialData = {};
        selectedStudents.forEach(id => {
            initialData[id] = {
                grade: '',
                reason: ''
            };
        });
        setEvaluationData(initialData);
        setShowEvaluationModal(true);
    };

    const handleEvaluationChange = (studentId, field, value) => {
        setEvaluationData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }));
    };

    const handleCreateReport = async () => {
        // Validate all fields are filled
        const allFilled = selectedStudents.every(id => 
            evaluationData[id]?.grade && evaluationData[id]?.reason
        );

        if (!allFilled) {
            alert('Lütfen tüm öğrenciler için not ve sebep giriniz!');
            return;
        }

        try {
            setLoading(true);
            setError('');
            const user = authService.getCurrentUser();
            const token = localStorage.getItem('token');

            // Prepare bulk grade data keyed by internship id (selectedStudents holds internship ids).
            const grades = selectedStudents.map(internshipId => {
                const student = students.find(s => s.currentInternship.id === internshipId);
                return {
                    internshipId,
                    studentId: student.studentNumber,
                    internshipOrder: student.currentInternship.internshipOrder,
                    grade: evaluationData[internshipId].grade,
                    gradeComment: evaluationData[internshipId].reason,
                    // Carry the grade seen on screen so a stale early evaluation cannot overwrite a newer one.
                    expectedGrade: student.currentInternship.grade ?? null
                };
            });

            // First, save the grades
            const gradeResponse = await axios.post(
                `${API_URL}/grade-internships-bulk`,
                { grades },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            console.log('Grades saved:', gradeResponse.data);

            // Stop before creating the report if any grade failed, and show which students failed.
            if (gradeResponse.data.errorCount > 0) {
                const failed = gradeResponse.data.errors.map(e => {
                    const s = students.find(st => st.currentInternship?.id === e.internshipId);
                    return s ? `${s.name} (${s.studentNumber})` : (e.studentId || e.internshipId);
                }).join(', ');
                setError(`Bazı notlar kaydedilemedi, tutanak oluşturulmadı: ${failed}`);
                setLoading(false);
                return;
            }

            // Generate the report for exactly the selected internships (not all of the student's).
            const reportResponse = await axios.post(
                `${API_URL}/internship/generate-report`,
                {
                    termId: parseInt(selectedTerm),
                    departmentId: user.department.id,
                    gradeFilter: null,
                    studentTypeFilter: null,
                    internshipIds: selectedStudents
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([reportResponse.data]));
            const link = document.createElement('a');
            link.href = url;
            
            const termName = terms.find(t => t.id.toString() === selectedTerm)?.name || 'Donem';
            link.setAttribute('download', `Erken_Degerlendirme_Tutanagi_${termName.replace(/\s/g, '_')}.docx`);
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            // Close modal and show success
            setShowEvaluationModal(false);
            setShowSuccessMessage(true);
            setSelectedStudents([]);
            setEvaluationData({});

            // Refresh student list
            fetchStudents();

            // Hide success message after 3 seconds
            setTimeout(() => {
                setShowSuccessMessage(false);
            }, 3000);
        } catch (error) {
            console.error('Error creating report:', error);
            
            // Handle blob error responses
            if (error.response && error.response.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const errorData = JSON.parse(text);
                    setError(errorData.error || 'Değerlendirme kaydedilirken veya rapor oluşturulurken hata oluştu.');
                } catch (parseError) {
                    setError('Değerlendirme kaydedilirken veya rapor oluşturulurken hata oluştu.');
                }
            } else if (error.response && error.response.data && error.response.data.error) {
                setError(error.response.data.error);
            } else {
                setError('Değerlendirme kaydedilirken veya rapor oluşturulurken hata oluştu.');
            }
        } finally {
            setLoading(false);
        }
    };

    const getSelectedStudentData = () => {
        // selectedStudents holds internship ids, so match on currentInternship.id.
        return selectedStudents.map(internshipId =>
            students.find(s => s.currentInternship.id === internshipId)
        ).filter(s => s !== undefined);
    };

    return (
        <div>
            <h2>Erken Değerlendirme</h2>
            <p>Staj sürecini erken tamamlayan öğrencileri değerlendirin ve raporlayın.</p>

            {/* Error Message */}
            {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}

            {/* Success Message */}
            {showSuccessMessage && (
                <div className="success-banner">
                    <i className="fa-solid fa-circle-check"></i>
                    Erken değerlendirme tutanağı başarıyla oluşturuldu!
                </div>
            )}

            {/* Filtreler ve Arama */}
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

                {/* Arama Çubuğu */}
                <div className="search-bar">
                    <i className="fa-solid fa-search"></i>
                    <input 
                        type="text"
                        placeholder="Öğrenci adı veya numarası ile ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>
                            <i className="fa-solid fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Öğrenci Listesi Tablosu */}
            <div className="table-container-card">
                <div className="table-header-info">
                    <h3>{terms.find(t => t.id.toString() === selectedTerm)?.name || 'Seçili Dönem'} Dönemi - Erken Değerlendirme</h3>
                    <span className="student-count">
                        {loading ? 'Yükleniyor...' : `${filteredStudents.length} öğrenci`}
                    </span>
                </div>
                
                {selectedStudents.length > 0 && (
                    <div className="selection-info">
                        <i className="fa-solid fa-check-circle"></i>
                        {selectedStudents.length} öğrenci seçildi
                    </div>
                )}

                <table className="styled-table">
                    <thead>
                        <tr>
                            <th style={{width: '4%'}}>
                                <input 
                                    type="checkbox"
                                    checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th style={{width: '10%'}}>Numara</th>
                            <th style={{width: '13%'}}>Ad Soyad</th>
                            <th style={{width: '15%'}}>Önceki Staj Yeri</th>
                            <th style={{width: '15%'}}>Mevcut Staj Yeri</th>
                            <th style={{width: '12%'}}>Başlangıç</th>
                            <th style={{width: '12%'}}>Bitiş</th>
                            <th style={{width: '10%'}}>Staj Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Yükleniyor...
                                </td>
                            </tr>
                        ) : filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                                    <i className="fa-solid fa-circle-info"></i> Seçili filtrelere uygun öğrenci bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map(student => {
                                if (!student.currentInternship) return null;
                                
                                const outOfRange = isOutOfTermRange(
                                    student.currentInternship.startDate,
                                    student.currentInternship.endDate
                                );
                                
                                return (
                                    <tr key={student.currentInternship.id} className={outOfRange ? 'out-of-term-range' : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedStudents.includes(student.currentInternship.id)}
                                                onChange={() => handleSelectStudent(student.currentInternship.id)}
                                            />
                                        </td>
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
                                            <span className={`grade-badge ${student.currentInternship.grade ? `grade-${student.currentInternship.grade.toLowerCase()}` : 'grade-ungraded'}`}>
                                                {student.currentInternship.grade || '-'}
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
                        className="btn-early-evaluate"
                        onClick={handleOpenEvaluationModal}
                        disabled={loading || selectedStudents.length === 0}
                    >
                        <i className="fa-solid fa-clock-rotate-left"></i> 
                        Erken Değerlendir ({selectedStudents.length})
                    </button>
                </div>
            </div>

            {/* Evaluation Modal */}
            {showEvaluationModal && (
                <div className="modal-overlay" onClick={() => setShowEvaluationModal(false)}>
                    <div className="modal-content evaluation-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Erken Değerlendirme Formu</h3>
                            <button className="modal-close" onClick={() => setShowEvaluationModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <p className="modal-description">
                                Seçilen öğrenciler için erken değerlendirme notlarını ve sebeplerini girin.
                            </p>

                            <div className="evaluation-list">
                                {getSelectedStudentData().map(student => (
                                    <div key={student.currentInternship.id} className="evaluation-item">
                                        <div className="evaluation-student-info">
                                            <strong>{student.name}</strong>
                                            <span className="student-number">({student.studentNumber})</span>
                                            {/* Show which internship is being graded to distinguish Staj 1 / Staj 2 */}
                                            <span className="student-number"> - {student.currentInternship.internshipOrder === 'STAJ1' ? 'Staj 1' : 'Staj 2'}</span>
                                        </div>

                                        <div className="evaluation-inputs">
                                            <div className="eval-input-group">
                                                <label>Not:</label>
                                                <select
                                                    value={evaluationData[student.currentInternship.id]?.grade || ''}
                                                    onChange={(e) => handleEvaluationChange(student.currentInternship.id, 'grade', e.target.value)}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    <option value="S">S (Başarılı)</option>
                                                    <option value="U">U (Başarısız)</option>
                                                </select>
                                            </div>

                                            <div className="eval-input-group">
                                                <label>Sebep:</label>
                                                <input
                                                    type="text"
                                                    placeholder="Erken değerlendirme sebebi..."
                                                    value={evaluationData[student.currentInternship.id]?.reason || ''}
                                                    onChange={(e) => handleEvaluationChange(student.currentInternship.id, 'reason', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="modal-footer">
                            <button className="btn-modal-cancel" onClick={() => setShowEvaluationModal(false)} disabled={loading}>
                                İptal
                            </button>
                            <button className="btn-modal-confirm" onClick={handleCreateReport} disabled={loading}>
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin"></i> İşleniyor...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-file-signature"></i> Değerlendirme Tutanağı Oluştur
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EarlyEvaluation;
