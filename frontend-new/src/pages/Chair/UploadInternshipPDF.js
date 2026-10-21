import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import authService from '../../services/authService';
import './UploadInternshipPDF.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const withDocument = (data, file) => {
    const form = new FormData();
    form.append('data', JSON.stringify(data));
    if (file) form.append('file', file);
    return form;
};

const UploadInternshipPDF = () => {
    const [terms, setTerms] = useState([]);
    const [selectedTermId, setSelectedTermId] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const [studentsData, setStudentsData] = useState([]);
    const [showValidation, setShowValidation] = useState(false);
    const [showAddTermModal, setShowAddTermModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });
    const [newTerm, setNewTerm] = useState({
        name: '',
        startDate: '',
        endDate: ''
    });

    // Toast notification helper
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
    };

    const showConfirm = (message, onConfirm) => {
        setConfirmDialog({ show: true, message, onConfirm });
    };

    // Fetch terms on component mount
    useEffect(() => {
        fetchTerms();
    }, []);

    const fetchTerms = async () => {
        try {
            const response = await axios.get(`${API_URL}/terms`);
            setTerms(response.data);
            if (response.data.length > 0) {
                setSelectedTermId(response.data[0].id);
            }
        } catch (err) {
            console.error('Error fetching terms:', err);
            showToast('Dönemler yüklenirken hata oluştu.', 'error');
        }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setLoading(true);
        setError(null);
        const parsedStudents = [];

        try {
            for (const file of files) {
                console.log(`Parsing file: ${file.name}`);
                
                const formData = new FormData();
                formData.append('file', file);

                const response = await axios.post(`${API_URL}/internship/parse-pdf`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (response.data.success) {
                    const parsed = response.data.data;
                    console.log('Parsed data:', parsed);

                    // Convert parsed data to student format
                    parsedStudents.push({
                        fileName: file.name,
                        originalFile: file,
                        studentInfo: {
                            name: parsed.studentName,
                            studentNumber: parsed.studentId,
                            department: parsed.studentDepartment,
                            phone: parsed.studentPhone || '',
                            email: parsed.studentEmail || `${parsed.studentId}@gtu.edu.tr`,
                            isErasmus: false
                        },
                        internshipInfo: {
                            type: parsed.internshipType,
                            startDate: formatDateForInput(parsed.startDate),
                            endDate: formatDateForInput(parsed.endDate),
                            duration: parsed.duration,
                            companyName: parsed.companyName,
                            contactName: parsed.contactName,
                            contactPosition: parsed.contactPosition,
                            companyPhone: parsed.companyPhone || '',
                            companyEmail: parsed.companyEmail || ''
                        },
                        previousInternship: null,
                        rawParsedData: parsed
                    });
                }
            }

            setUploadedFiles(files.map(f => f.name));
            setStudentsData(parsedStudents);
            
            if (parsedStudents.length > 0) {
                setShowValidation(true);
                setCurrentStudentIndex(0);
            } else {
                setError('Hiçbir dosya başarıyla ayrıştırılamadı.');
            }
        } catch (err) {
            console.error('Error parsing PDFs:', err);
            setError('PDF dosyaları ayrıştırılırken hata oluştu: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmStudent = async () => {
        const student = studentsData[currentStudentIndex];
        setLoading(true);
        setError(null);

        try {
            const user = authService.getCurrentUser();
            if (!user || !user.department) {
                throw new Error('Kullanıcı bölümü bulunamadı.');
            }

            // Prepare internship data
            const internshipData = {
                studentId: student.studentInfo.studentNumber,
                studentName: student.studentInfo.name,
                studentEmail: student.studentInfo.email,
                studentPhone: student.studentInfo.phone || '',
                companyName: student.internshipInfo.companyName,
                contactName: student.internshipInfo.contactName || null,
                contactPosition: student.internshipInfo.contactPosition || null,
                startDate: student.internshipInfo.startDate,
                endDate: student.internshipInfo.endDate,
                duration: student.internshipInfo.duration || 20,
                internshipType: student.internshipInfo.type, // Already STAJ1 or STAJ2 from dropdown
                termId: selectedTermId,
                departmentId: user.department.id,
                isErasmus: student.studentInfo.isErasmus
            };

            console.log('Creating internship:', internshipData);

            const response = await axios.post(
                `${API_URL}/internship/create`,
                withDocument(internshipData, student.originalFile),
                { headers: { Authorization: `Bearer ${authService.getToken()}` } }
            );

            console.log('Internship created:', response.data);
            
            // Move to next student or finish
            if (currentStudentIndex < studentsData.length - 1) {
                setCurrentStudentIndex(currentStudentIndex + 1);
                showToast('Staj başarıyla kaydedildi!', 'success');
            } else {
                showToast('Tüm öğrenciler başarıyla kaydedildi!', 'success');
                resetForm();
            }
        } catch (err) {
            console.error('Error creating internship:', err);
            const errorMsg = err.response?.data?.error || err.message;
            setError('Staj kaydedilirken hata oluştu: ' + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAll = async () => {
        setLoading(true);
        setError(null);

        try {
            const user = authService.getCurrentUser();
            if (!user || !user.department) {
                throw new Error('Kullanıcı bölümü bulunamadı.');
            }

            let successCount = 0;
            let failCount = 0;
            const errors = [];
            const failedStudents = [];

            // Save all students
            for (let i = 0; i < studentsData.length; i++) {
                const student = studentsData[i];
                
                try {
                    const internshipData = {
                        studentId: student.studentInfo.studentNumber,
                        studentName: student.studentInfo.name,
                        studentEmail: student.studentInfo.email,
                        studentPhone: student.studentInfo.phone || '',
                        companyName: student.internshipInfo.companyName,
                        contactName: student.internshipInfo.contactName || null,
                        contactPosition: student.internshipInfo.contactPosition || null,
                        startDate: student.internshipInfo.startDate,
                        endDate: student.internshipInfo.endDate,
                        duration: student.internshipInfo.duration || 20,
                        internshipType: student.internshipInfo.type,
                        termId: selectedTermId,
                        departmentId: user.department.id,
                        isErasmus: student.studentInfo.isErasmus
                    };

                    await axios.post(
                        `${API_URL}/internship/create`,
                        withDocument(internshipData, student.originalFile),
                        { headers: { Authorization: `Bearer ${authService.getToken()}` } }
                    );

                    successCount++;
                } catch (err) {
                    failCount++;
                    failedStudents.push(student);
                    const errorMsg = err.response?.data?.error || err.message;
                    errors.push(`${student.studentInfo.name}: ${errorMsg}`);
                    console.error(`Error saving student ${student.studentInfo.name}:`, err);
                }
            }

            // Keep only failed records so retrying cannot submit successful records twice.
            if (failedStudents.length) {
                setStudentsData(failedStudents);
                setUploadedFiles(failedStudents.map(student => student.fileName));
                setCurrentStudentIndex(0);
            }

            // Show results
            if (failCount === 0) {
                showToast(`Tüm ${successCount} öğrenci başarıyla kaydedildi!`, 'success');
                resetForm();
            } else if (successCount === 0) {
                setError(`Tüm öğrenciler kaydedilemedi:\n${errors.join('\n')}`);
                showToast('Hiçbir öğrenci kaydedilemedi!', 'error');
            } else {
                setError(`Bazı öğrenciler kaydedilemedi:\n${errors.join('\n')}`);
                showToast(`${successCount} öğrenci kaydedildi, ${failCount} öğrenci başarısız oldu.`, 'warning');
            }
        } catch (err) {
            console.error('Error in handleSaveAll:', err);
            showToast('Toplu kaydetme sırasında hata oluştu!', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRejectStudent = () => {
        showConfirm('Bu öğrenciyi reddetmek istediğinizden emin misiniz?', () => {
            // Remove rejected records from the save queue instead of only moving the cursor.
            const remaining = studentsData.filter((_, index) => index !== currentStudentIndex);
            if (!remaining.length) {
                resetForm();
            } else {
                setStudentsData(remaining);
                setUploadedFiles(remaining.map(student => student.fileName));
                setCurrentStudentIndex(Math.min(currentStudentIndex, remaining.length - 1));
            }
            showToast('Öğrenci reddedildi', 'warning');
        });
    };

    const handleSkipStudent = () => {
        console.log('Öğrenci atlandı:', studentsData[currentStudentIndex]);
        
        if (currentStudentIndex < studentsData.length - 1) {
            setCurrentStudentIndex(currentStudentIndex + 1);
        } else {
            alert('Son öğrenciye ulaştınız!');
        }
    };

    const handlePreviousStudent = () => {
        if (currentStudentIndex > 0) {
            setCurrentStudentIndex(currentStudentIndex - 1);
        }
    };

    const handleNextStudent = () => {
        if (currentStudentIndex < studentsData.length - 1) {
            setCurrentStudentIndex(currentStudentIndex + 1);
        }
    };

    const resetForm = () => {
        setShowValidation(false);
        setStudentsData([]);
        setCurrentStudentIndex(0);
        setUploadedFiles([]);
        setError(null);
    };

    const handleAddTerm = () => {
        if (!newTerm.name || !newTerm.startDate || !newTerm.endDate) {
            showToast('Lütfen tüm alanları doldurun!', 'warning');
            return;
        }
        console.log('Yeni dönem eklendi:', newTerm);
        // TODO: Backend'e gönderilecek
        setShowAddTermModal(false);
        setNewTerm({ name: '', startDate: '', endDate: '' });
        showToast('Dönem başarıyla eklendi!', 'success');
    };

    const formatDateForInput = (dateStr) => {
        if (!dateStr) return '';
        // Convert DD.MM.YYYY to YYYY-MM-DD
        const parts = dateStr.split('.');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return dateStr;
    };

    const handleInputChange = (field, value, section = 'studentInfo') => {
        const updatedStudents = [...studentsData];
        if (section === 'internshipInfo') {
            updatedStudents[currentStudentIndex].internshipInfo[field] = value;
        } else {
            updatedStudents[currentStudentIndex].studentInfo[field] = value;
        }
        setStudentsData(updatedStudents);
    };

    const currentStudent = studentsData[currentStudentIndex];

    return (
        <div>
            <h2>Staj PDF Yükleme</h2>
            <p>Yeni staj belgelerini yükleyin ve sistemin ayrıştırdığı bilgileri doğrulayın.</p>

            {error && <div className="error-message" style={{ marginBottom: '20px', padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '5px', color: '#c00' }}>{error}</div>}
            {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Yükleniyor...</div>}

            {/* ADIM 1: Dosya Yükleme */}
            {!showValidation && (
                <div className="form-container-card">
                    <h3>Adım 1: Staj Belgelerini Yükle</h3>
                    
                    <div className="formatted-form">
                        <div className="form-group">
                            <label htmlFor="donem">Dönem Seçimi</label>
                            <div className="input-group-with-button">
                                <select 
                                    id="donem"
                                    value={selectedTermId}
                                    onChange={(e) => setSelectedTermId(parseInt(e.target.value))}
                                    disabled={loading}
                                >
                                    {terms.map(term => (
                                        <option key={term.id} value={term.id}>{term.name}</option>
                                    ))}
                                </select>
                                <button className="btn-add-term" onClick={() => setShowAddTermModal(true)}>
                                    <i className="fa-solid fa-plus"></i> Dönem Ekle
                                </button>
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="staj-fisi">Staj Fişlerini Yükle</label>
                            <div style={{ flexBasis: '72%' }}>
                                <input 
                                    type="file" 
                                    id="staj-fisi" 
                                    className="custom-file-input"
                                    multiple
                                    accept=".pdf"
                                    onChange={handleFileUpload}
                                    disabled={loading}
                                />
                                {uploadedFiles.length > 0 && (
                                    <div className="uploaded-files-list">
                                        {uploadedFiles.map((fileName, index) => (
                                            <span key={index} className="file-badge">
                                                <i className="fa-solid fa-file-pdf"></i> {fileName}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="info-note" style={{ marginTop: '15px', padding: '12px', background: '#e8f4fd', border: '1px solid #bee5eb', borderRadius: '5px' }}>
                            <i className="fa-solid fa-info-circle"></i> PDF dosyalarını seçin. Her dosya otomatik olarak ayrıştırılacak ve onayınız için sunulacaktır.
                        </div>
                    </div>
                </div>
            )}

            {/* ADIM 2: Bilgi Doğrulama */}
            {showValidation && currentStudent && (
                <div className="validation-container">
                    <div className="validation-header">
                        <div>
                            <h3>Adım 2: Ayrıştırılan Bilgileri Doğrula</h3>
                            <p className="validation-subtitle">
                                Sistem tarafından PDF'den ({currentStudent.fileName}) okunan bilgileri kontrol edin ve (varsa) düzenleyin.
                            </p>
                        </div>
                        <div className="header-right">
                            <button 
                                className="close-validation-btn"
                                onClick={() => {
                                    showConfirm('Staj ekleme işlemini iptal etmek istediğinizden emin misiniz?', () => {
                                        resetForm();
                                    });
                                }}
                                title="İptal Et"
                            >
                                <i className="fa-solid fa-times"></i>
                            </button>
                            <div className="student-counter">
                                Öğrenci {currentStudentIndex + 1} / {studentsData.length}
                            </div>
                        </div>
                    </div>

                    <div className="three-column-layout">
                        {/* Öğrenci Bilgileri */}
                        <div className="info-card">
                            <h4 className="card-title">Öğrenci Bilgileri</h4>
                            <div className="compact-form-group">
                                <label>Adı Soyadı</label>
                                <input 
                                    type="text" 
                                    value={currentStudent.studentInfo.name}
                                    onChange={(e) => handleInputChange('name', e.target.value, 'studentInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>Öğrenci No</label>
                                <input 
                                    type="text" 
                                    value={currentStudent.studentInfo.studentNumber}
                                    onChange={(e) => handleInputChange('studentNumber', e.target.value, 'studentInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>Telefon</label>
                                <input 
                                    type="tel" 
                                    value={currentStudent.studentInfo.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value, 'studentInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>E-posta</label>
                                <input 
                                    type="email" 
                                    value={currentStudent.studentInfo.email}
                                    onChange={(e) => handleInputChange('email', e.target.value, 'studentInfo')}
                                />
                            </div>
                            <div className="checkbox-group">
                                <input 
                                    type="checkbox" 
                                    id={`erasmus-${currentStudentIndex}`}
                                    checked={currentStudent.studentInfo.isErasmus}
                                    onChange={(e) => handleInputChange('isErasmus', e.target.checked, 'studentInfo')}
                                />
                                <label htmlFor={`erasmus-${currentStudentIndex}`}>Erasmus Stajı</label>
                            </div>
                        </div>

                        {/* Mevcut Staj Bilgileri */}
                        <div className="info-card">
                            <h4 className="card-title">Mevcut Staj Bilgileri</h4>
                            <div className="compact-form-group">
                                <label>Staj Tipi</label>
                                <select 
                                    value={currentStudent.internshipInfo.type}
                                    onChange={(e) => handleInputChange('type', e.target.value, 'internshipInfo')}
                                >
                                    <option value="STAJ1">Zorunlu Staj 1</option>
                                    <option value="STAJ2">Zorunlu Staj 2</option>
                                </select>
                            </div>
                            <div className="compact-form-group">
                                <label>Başlangıç</label>
                                <input 
                                    type="date" 
                                    value={currentStudent.internshipInfo.startDate}
                                    onChange={(e) => handleInputChange('startDate', e.target.value, 'internshipInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>Bitiş</label>
                                <input 
                                    type="date" 
                                    value={currentStudent.internshipInfo.endDate}
                                    onChange={(e) => handleInputChange('endDate', e.target.value, 'internshipInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>Kurum Adı</label>
                                <input 
                                    type="text" 
                                    value={currentStudent.internshipInfo.companyName}
                                    onChange={(e) => handleInputChange('companyName', e.target.value, 'internshipInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>Kurum Tel.</label>
                                <input 
                                    type="tel" 
                                    value={currentStudent.internshipInfo.companyPhone || ''}
                                    onChange={(e) => handleInputChange('companyPhone', e.target.value, 'internshipInfo')}
                                />
                            </div>
                            <div className="compact-form-group">
                                <label>Kurum Mail</label>
                                <input 
                                    type="email" 
                                    value={currentStudent.internshipInfo.companyEmail || ''}
                                    onChange={(e) => handleInputChange('companyEmail', e.target.value, 'internshipInfo')}
                                />
                            </div>
                        </div>

                        {/* Önceki Staj Bilgileri */}
                        <div className="info-card">
                            <h4 className="card-title">Önceki Staj Bilgileri</h4>
                            {currentStudent.previousInternship ? (
                                <>
                                    <div className="compact-form-group">
                                        <label>Staj Tipi</label>
                                        <input 
                                            type="text" 
                                            value={currentStudent.previousInternship.type}
                                            disabled
                                            className="disabled-input"
                                        />
                                    </div>
                                    <div className="compact-form-group">
                                        <label>Başlangıç</label>
                                        <input 
                                            type="date" 
                                            value={currentStudent.previousInternship.startDate}
                                            disabled
                                            className="disabled-input"
                                        />
                                    </div>
                                    <div className="compact-form-group">
                                        <label>Bitiş</label>
                                        <input 
                                            type="date" 
                                            value={currentStudent.previousInternship.endDate}
                                            disabled
                                            className="disabled-input"
                                        />
                                    </div>
                                    <div className="compact-form-group">
                                        <label>Kurum Adı</label>
                                        <input 
                                            type="text" 
                                            value={currentStudent.previousInternship.companyName}
                                            disabled
                                            className="disabled-input"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="no-previous-internship">
                                    <i className="fa-solid fa-circle-info"></i>
                                    <p>Bu öğrencinin ilk stajıdır.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="form-buttons">
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                className="btn-submit btn-secondary" 
                                onClick={handlePreviousStudent}
                                disabled={currentStudentIndex === 0 || loading}
                            >
                                <i className="fa-solid fa-chevron-left"></i> Geri
                            </button>
                            <button 
                                className="btn-submit btn-secondary" 
                                onClick={handleNextStudent}
                                disabled={currentStudentIndex === studentsData.length - 1 || loading}
                            >
                                İleri <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-submit btn-success" onClick={handleSaveAll} disabled={loading}>
                                <i className="fa-solid fa-check"></i> {loading ? 'Kaydediliyor...' : 'Tümünü Onayla ve Kaydet'}
                            </button>
                            <button className="btn-submit btn-danger" onClick={handleRejectStudent} disabled={loading}>
                                <i className="fa-solid fa-ban"></i> Reddet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dönem Ekleme Modal */}
            {showAddTermModal && (
                <div className="modal-overlay" onClick={() => setShowAddTermModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Yeni Dönem Ekle</h3>
                            <button className="modal-close" onClick={() => setShowAddTermModal(false)}>
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="modal-form-group">
                                <label>Dönem Adı:</label>
                                <input 
                                    type="text" 
                                    placeholder="Örn: 2025-2026 Güz"
                                    value={newTerm.name}
                                    onChange={(e) => setNewTerm({...newTerm, name: e.target.value})}
                                />
                            </div>
                            
                            <div className="modal-form-group">
                                <label>Başlangıç Tarihi:</label>
                                <input 
                                    type="date"
                                    value={newTerm.startDate}
                                    onChange={(e) => setNewTerm({...newTerm, startDate: e.target.value})}
                                />
                            </div>
                            
                            <div className="modal-form-group">
                                <label>Bitiş Tarihi:</label>
                                <input 
                                    type="date"
                                    value={newTerm.endDate}
                                    onChange={(e) => setNewTerm({...newTerm, endDate: e.target.value})}
                                />
                            </div>
                        </div>
                        
                        <div className="modal-footer">
                            <button className="btn-modal-cancel" onClick={() => setShowAddTermModal(false)}>
                                İptal
                            </button>
                            <button className="btn-modal-confirm" onClick={handleAddTerm}>
                                <i className="fa-solid fa-plus"></i> Dönem Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Confirm Dialog */}
            {confirmDialog.show && (
                <div className="modal-overlay" onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}>
                    <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-header">
                            <i className="fa-solid fa-question-circle"></i>
                            <h3>Onay</h3>
                        </div>
                        <div className="confirm-body">
                            <p>{confirmDialog.message}</p>
                        </div>
                        <div className="confirm-footer">
                            <button 
                                className="btn-modal-cancel" 
                                onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}
                            >
                                İptal
                            </button>
                            <button 
                                className="btn-modal-confirm btn-confirm-danger" 
                                onClick={() => {
                                    confirmDialog.onConfirm();
                                    setConfirmDialog({ show: false, message: '', onConfirm: null });
                                }}
                            >
                                <i className="fa-solid fa-check"></i> Onayla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadInternshipPDF;
