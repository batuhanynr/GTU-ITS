import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import authService from '../../services/authService';
import './GradeInternship.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const GradeInternship = () => {
    const [terms, setTerms] = useState([]);
    const [selectedTermId, setSelectedTermId] = useState('');
    const [gradeFilter, setGradeFilter] = useState('ungraded');
    const [studentTypeFilter, setStudentTypeFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [studentGrades, setStudentGrades] = useState({});
    const [studentNotes, setStudentNotes] = useState({});
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    // Tracks unsaved grade/note edits so we can warn before they are discarded.
    const [isDirty, setIsDirty] = useState(false);
    // Internship ids the user actually edited, so only those are submitted (not unchanged rows).
    const [editedIds, setEditedIds] = useState(() => new Set());
    // True while a save is in flight, to block double submits and term/filter changes.
    const [saving, setSaving] = useState(false);

    // Toast notification helper
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
    };

    // Fetch terms from backend
    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const response = await axios.get(`${API_URL}/terms`);
                setTerms(response.data);
                if (response.data.length > 0) {
                    setSelectedTermId(response.data[0].id);
                }
            } catch (err) {
                console.error('Error fetching terms:', err);
                setError('Failed to load terms');
            }
        };
        fetchTerms();
    }, []);

    // Fetch students when term or filters change
    useEffect(() => {
        if (!selectedTermId) return;

        const fetchStudents = async () => {
            setLoading(true);
            setError(null);
            try {
                const user = authService.getCurrentUser();
                if (!user || !user.department) {
                    setError('Kullanıcı bölümü bulunamadı.');
                    setLoading(false);
                    return;
                }

                const queryParams = new URLSearchParams();
                if (gradeFilter !== 'all') {
                    queryParams.append('gradeFilter', gradeFilter);
                }
                if (studentTypeFilter !== 'all') {
                    queryParams.append('studentTypeFilter', studentTypeFilter);
                }

                const response = await axios.get(
                    `${API_URL}/students/${user.department.id}/${selectedTermId}?${queryParams.toString()}`
                );
                setStudents(response.data);

                // Initialize grades and notes from backend data
                const grades = {};
                const notes = {};
                response.data.forEach(student => {
                    if (student.currentInternship?.grade) {
                        grades[student.currentInternship.id] = student.currentInternship.grade;
                    }
                    if (student.currentInternship?.gradeComment) {
                        notes[student.currentInternship.id] = student.currentInternship.gradeComment;
                    }
                });
                setStudentGrades(grades);
                setStudentNotes(notes);
                setIsDirty(false); // freshly loaded data is not dirty
                setEditedIds(new Set()); // nothing edited yet for this load
            } catch (err) {
                console.error('Error fetching students:', err);
                setError('Failed to load students');
            } finally {
                setLoading(false);
            }
        };

        fetchStudents();
    }, [selectedTermId, gradeFilter, studentTypeFilter]);

    // Filtreleme (local search only)
    const filteredStudents = students.filter(student => {
        // İsim araması
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            if (!student.name.toLowerCase().includes(query) && 
                !student.id.includes(query)) {
                return false;
            }
        }
        return true;
    });

    const markEdited = (internshipId) => setEditedIds(prev => new Set(prev).add(internshipId));

    const handleGradeChange = (internshipId, grade) => {
        setStudentGrades(prev => ({
            ...prev,
            [internshipId]: grade
        }));
        setIsDirty(true);
        markEdited(internshipId);
    };

    const handleNoteChange = (internshipId, note) => {
        setStudentNotes(prev => ({
            ...prev,
            [internshipId]: note
        }));
        setIsDirty(true);
        markEdited(internshipId);
    };

    // Warn before an action that would reload the list and discard unsaved edits.
    const confirmDiscardIfDirty = () =>
        !isDirty || window.confirm('Kaydedilmemiş notlar var. Devam ederseniz kaybolacak. Devam edilsin mi?');

    const handleSaveGrades = async () => {
        if (saving) return; // a save is already in flight; do not submit the same edits twice
        try {
            // Collect all modified grades from the full loaded list, not just search-visible rows.
            const gradesToSubmit = [];

            students.forEach(student => {
                const internshipId = student.currentInternship?.id;
                if (!internshipId) return;

                // Only submit rows the user actually edited, so unchanged rows can't overwrite others.
                if (!editedIds.has(internshipId)) return;

                const grade = studentGrades[internshipId];
                const gradeComment = studentNotes[internshipId]?.trim();

                // Only submit if grade is set
                if (grade && (grade === 'S' || grade === 'U')) {
                    const gradeData = {
                        // Send internshipId so the exact internship is graded, not the first match.
                        internshipId,
                        studentId: student.id,
                        internshipOrder: student.currentInternship.internshipOrder,
                        grade,
                        // Optimistic lock: the grade and comment the user started from; reject if changed since.
                        expectedGrade: student.currentInternship.grade ?? null,
                        expectedGradeComment: student.currentInternship.gradeComment ?? null
                    };

                    // Only add gradeComment if it has content
                    if (gradeComment) {
                        gradeData.gradeComment = gradeComment;
                    }

                    gradesToSubmit.push(gradeData);
                }
            });

            if (gradesToSubmit.length === 0) {
                showToast('Kaydedilecek not bulunamadı. Lütfen en az bir öğrenciye not verin.', 'warning');
                return;
            }

            setSaving(true); // block further submits and term/filter changes until this finishes

            console.log('Submitting grades:', gradesToSubmit);

            // Submit bulk grades
            const response = await axios.post(
                `${API_URL}/grade-internships-bulk`,
                { grades: gradesToSubmit },
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );

            console.log('Grade submission response:', response.data);

            const { successCount, errorCount, errors } = response.data;
            if (errorCount > 0) {
                // Name the records that failed so they are not silently dropped.
                const failed = errors.map(e => {
                    const s = students.find(st => st.currentInternship?.id === e.internshipId);
                    return s ? `${s.name} (${s.id})` : (e.studentId || e.internshipId);
                }).join(', ');
                showToast(`${successCount} not kaydedildi, ${errorCount} kaydedilemedi: ${failed}`, 'warning');
            } else {
                showToast(`${successCount} öğrencinin notu başarıyla kaydedildi!`, 'success');
            }

            // Refresh the student list
            const user = authService.getCurrentUser();
            const queryParams = new URLSearchParams();
            if (gradeFilter !== 'all') {
                queryParams.append('gradeFilter', gradeFilter);
            }
            if (studentTypeFilter !== 'all') {
                queryParams.append('studentTypeFilter', studentTypeFilter);
            }
            const refreshResponse = await axios.get(
                `${API_URL}/students/${user.department.id}/${selectedTermId}?${queryParams.toString()}`
            );
            setStudents(refreshResponse.data);

            // Keep pending edits for rows that failed so they can be retried; clear saved rows.
            const failedIds = new Set((errors || []).map(e => e.internshipId));
            const grades = {}, notes = {};
            refreshResponse.data.forEach(student => {
                const id = student.currentInternship?.id;
                if (!id) return;
                if (failedIds.has(id)) {
                    if (studentGrades[id] !== undefined) grades[id] = studentGrades[id];
                    if (studentNotes[id] !== undefined) notes[id] = studentNotes[id];
                } else {
                    if (student.currentInternship.grade) grades[id] = student.currentInternship.grade;
                    if (student.currentInternship.gradeComment) notes[id] = student.currentInternship.gradeComment;
                }
            });
            setStudentGrades(grades);
            setStudentNotes(notes);
            setIsDirty(errorCount > 0); // remaining failed edits are still unsaved
            setEditedIds(failedIds); // only failed/conflicting rows stay pending for retry
        } catch (err) {
            console.error('Full error object:', err);
            console.error('Error response:', err.response);
            console.error('Error message:', err.message);
            
            let errorMessage = 'Notları kaydederken bir hata oluştu.';
            
            if (err.response) {
                // Server responded with error
                errorMessage = err.response.data?.error || err.response.data?.message || `Server error: ${err.response.status}`;
                console.error('Server error data:', err.response.data);
            } else if (err.request) {
                // Request made but no response
                errorMessage = 'Sunucuya ulaşılamadı. Lütfen backend sunucusunun çalıştığından emin olun.';
                console.error('No response received:', err.request);
            } else {
                // Error in request setup
                errorMessage = err.message;
            }
            
            showToast(`Hata: ${errorMessage}`, 'error');
            // Edits are preserved (editedIds untouched) so a failed save can be retried.
        } finally {
            setSaving(false);
        }
    };

    const getGradeValue = (student) => {
        const internshipId = student.currentInternship?.id;
        if (!internshipId) return '';
        
        // Check local state first
        if (studentGrades[internshipId] !== undefined) {
            return studentGrades[internshipId];
        }
        return student.currentInternship.grade || '';
    };

    const getNoteValue = (student) => {
        const internshipId = student.currentInternship?.id;
        if (!internshipId) return '';
        
        // Check local state first
        if (studentNotes[internshipId] !== undefined) {
            return studentNotes[internshipId];
        }
        return student.currentInternship.gradeComment || '';
    };

    // Get term dates for range check
    const getTermDates = () => {
        const term = terms.find(t => t.id === selectedTermId);
        if (!term) return { start: '', end: '' };
        return {
            start: term.startDate.split('T')[0],
            end: term.endDate.split('T')[0]
        };
    };

    const isOutOfTermRange = (startDate, endDate) => {
        const termDates = getTermDates();
        if (!termDates.start || !termDates.end) return false;
        return startDate < termDates.start || endDate > termDates.end;
    };

    return (
        <div>
            <h2>Staj Puanlandır</h2>
            <p>Öğrencilerin staj çalışmalarını değerlendirin ve notlandırın.</p>

            {error && <div className="error-message">{error}</div>}

            {/* Filtreler ve Arama */}
            <div className="filters-card">
                <div className="filter-row">
                    <div className="filter-group">
                        <label htmlFor="term-select">Dönem Seçiniz:</label>
                        <select 
                            id="term-select"
                            value={selectedTermId}
                            onChange={(e) => { const v = parseInt(e.target.value); if (confirmDiscardIfDirty()) setSelectedTermId(v); }}
                            disabled={loading || saving}
                        >
                            {terms.map(term => (
                                <option key={term.id} value={term.id}>{term.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="grade-filter">Puana Göre Filtrele:</label>
                        <select 
                            id="grade-filter"
                            value={gradeFilter}
                            onChange={(e) => { const v = e.target.value; if (confirmDiscardIfDirty()) setGradeFilter(v); }}
                            disabled={loading || saving}
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
                            onChange={(e) => { const v = e.target.value; if (confirmDiscardIfDirty()) setStudentTypeFilter(v); }}
                            disabled={loading || saving}
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
                        disabled={loading || saving}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>
                            <i className="fa-solid fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Puanlama Tablosu */}
            <div className="table-container-card">
                <div className="table-header-info">
                    <h3>{terms.find(t => t.id === selectedTermId)?.name || 'Dönem'} Staj Puanlama</h3>
                    <span className="student-count">{filteredStudents.length} öğrenci</span>
                </div>
                
                <div className="info-legend">
                    <span className="legend-item">
                        <span className="legend-box out-of-range"></span>
                        Kırmızı çerçeve: Dönem dışı tarih
                    </span>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '30px' }}>Yükleniyor...</div>
                ) : (
                    <table className="styled-table grading-table">
                        <thead>
                            <tr>
                                <th style={{width: '10%'}}>Numara</th>
                                <th style={{width: '15%'}}>Ad Soyad</th>
                                <th style={{width: '15%'}}>Staj Yeri</th>
                                    <th style={{width: '10%'}}>Başlangıç</th>
                                <th style={{width: '10%'}}>Bitiş</th>
                                <th style={{width: '12%'}}>Staj Notu</th>
                                <th style={{width: '28%'}}>Açıklama (Opsiyonel)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                                        <i className="fa-solid fa-circle-info"></i> Seçili filtrelere uygun öğrenci bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(student => {
                                    const internship = student.currentInternship;
                                    if (!internship) return null;

                                    const outOfRange = isOutOfTermRange(
                                        internship.startDate?.split('T')[0],
                                        internship.endDate?.split('T')[0]
                                    );
                                    
                                    return (
                                        <tr key={`${student.id}-${internship.id}`} className={outOfRange ? 'out-of-term-range' : ''}>
                                            <td>{student.id}</td>
                                            <td>{student.name}</td>
                                            <td>{internship.company || 'N/A'}</td>
                                            <td>{internship.startDate ? new Date(internship.startDate).toLocaleDateString('tr-TR') : 'N/A'}</td>
                                            <td>{internship.endDate ? new Date(internship.endDate).toLocaleDateString('tr-TR') : 'N/A'}</td>
                                            <td>
                                                <select
                                                    className="grade-select"
                                                    value={getGradeValue(student)}
                                                    onChange={(e) => handleGradeChange(internship.id, e.target.value)}
                                                    disabled={saving}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    <option value="S">S (Başarılı)</option>
                                                    <option value="U">U (Başarısız)</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="note-input"
                                                    placeholder="Açıklama ekleyin..."
                                                    value={getNoteValue(student)}
                                                    onChange={(e) => handleNoteChange(internship.id, e.target.value)}
                                                    disabled={saving}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
                
                <div className="table-footer">
                    <button 
                        className="btn-save-grades" 
                        onClick={handleSaveGrades}
                        disabled={loading || saving}
                    >
                        <i className="fa-solid fa-save"></i> 
                        Tüm Notları Kaydet
                    </button>
                </div>
            </div>

            {/* Toast Notification */}
            {toast.show && (
                <div className={`toast-notification toast-${toast.type}`}>
                    <div className="toast-content">
                        <i className={`fa-solid fa-${
                            toast.type === 'success' ? 'check-circle' :
                            toast.type === 'error' ? 'exclamation-circle' :
                            toast.type === 'warning' ? 'exclamation-triangle' :
                            'info-circle'
                        }`}></i>
                        <span>{toast.message}</span>
                    </div>
                    <button className="toast-close" onClick={() => setToast({ show: false, message: '', type: '' })}>
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>
            )}
        </div>
    );
};

export default GradeInternship;
