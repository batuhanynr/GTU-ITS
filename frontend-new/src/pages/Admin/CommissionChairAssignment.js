import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import './CommissionChairAssignment.css';

// API Configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const CommissionChairAssignment = () => {
    const [departments, setDepartments] = useState([]);
    const [currentChair, setCurrentChair] = useState(null);
    const [formData, setFormData] = useState({
        departmentId: '',
        firstName: '',
        lastName: '',
        email: '',
        temporaryPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });

    // Toast notification helper
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
    };

    const showConfirm = (message, onConfirm) => {
        setConfirmDialog({ show: true, message, onConfirm });
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const response = await axios.get(`${API_URL}/departments`);
            setDepartments(response.data);
        } catch (err) {
            console.error('Error fetching departments:', err);
            setError('Bölümler yüklenirken bir hata oluştu.');
        }
    };

    const fetchCurrentChair = async (departmentId) => {
        if (!departmentId) {
            setCurrentChair(null);
            return;
        }
        
        try {
            const response = await axios.get(`${API_URL}/department-chair/${departmentId}`);
            setCurrentChair(response.data);
            
            // Show warning if there's already a chair
            if (response.data) {
                setShowWarning(true);
            } else {
                setShowWarning(false);
            }
        } catch (err) {
            console.error('Error fetching current chair:', err);
            setCurrentChair(null);
            setShowWarning(false);
        }
    };

    const handleDepartmentChange = (e) => {
        const deptId = e.target.value;
        setFormData({
            ...formData,
            departmentId: deptId
        });
        setError('');
        setSuccess('');
        fetchCurrentChair(deptId);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
        setSuccess('');
    };

    const handleRemoveChair = async () => {
        if (!currentChair || !formData.departmentId) return;

        showConfirm('Bu komisyon başkanını kaldırmak istediğinizden emin misiniz?', async () => {
            setLoading(true);
            try {
                await axios.delete(`${API_URL}/remove-commission-chair/${currentChair.id}`);
                showToast('Komisyon başkanı başarıyla kaldırıldı.', 'success');
                setCurrentChair(null);
                setShowWarning(false);
            } catch (err) {
                console.error('Error removing chair:', err);
                showToast(err.response?.data?.error || 'Başkan kaldırılırken bir hata oluştu.', 'error');
            } finally {
                setLoading(false);
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Confirm replacement if there's an existing chair
        if (showWarning && currentChair) {
            showConfirm(
                `${currentChair.name} adlı kullanıcı zaten bu bölümün başkanı. Yeni başkan atandığında mevcut başkan kaldırılacak. Devam etmek istiyor musunuz?`,
                async () => {
                    await performSubmit();
                }
            );
            setLoading(false);
            return;
        }

        await performSubmit();
    };

    const performSubmit = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/create-commission-chair`, {
                departmentId: parseInt(formData.departmentId),
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                temporaryPassword: formData.temporaryPassword
            });

            showToast('Komisyon başkanı başarıyla atandı!', 'success');
            setFormData({ departmentId: formData.departmentId, firstName: '', lastName: '', email: '', temporaryPassword: '' });
            
            // Refresh current chair
            fetchCurrentChair(formData.departmentId);
        } catch (err) {
            console.error('Error assigning chair:', err);
            showToast(err.response?.data?.error || 'Atama sırasında bir hata oluştu.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectedDepartment = departments.find(d => d.id === parseInt(formData.departmentId));

    return (
        <div>
            <h2>Komisyon Başkanı Atama</h2>
            <p>Yeni komisyon başkanlarını atayın veya mevcut başkanları yönetin.</p>

            <div className="content-layout">
                {/* Left Side - Form */}
                <div className="form-container-card">
                    <h3>Yeni Başkan Ekleme Formu</h3>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <form className="formatted-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="departmentId">Bölüm Seçiniz:</label>
                            <select
                                id="departmentId"
                                name="departmentId"
                                value={formData.departmentId}
                                onChange={handleDepartmentChange}
                                required
                                disabled={loading}
                            >
                                <option value="">Bölüm seçiniz...</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="firstName">İsim:</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                placeholder="Örn: Habil"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="lastName">Soyisim:</label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                placeholder="Örn: Kalkan"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">E-posta:</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                placeholder="Örn: habil@gtu.edu.tr"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="temporaryPassword">Geçici Şifre:</label>
                            <input
                                type="password"
                                id="temporaryPassword"
                                name="temporaryPassword"
                                placeholder="Geçici şifre belirleyin"
                                value={formData.temporaryPassword}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>

                        {showWarning && currentChair && (
                            <div className="error-message" style={{ marginBottom: '20px' }}>
                                <strong>Uyarı:</strong> Bu bölümde zaten bir başkan mevcut. Yeni başkan atandığında mevcut başkan kaldırılacaktır.
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="btn-submit"
                            disabled={loading}
                        >
                            <i className="fa-solid fa-user-plus"></i>
                            {loading ? ' Kaydediliyor...' : ' Başkanı Kaydet'}
                        </button>
                    </form>
                </div>

                {/* Right Side - Current Chair */}
                <div className="table-container-card">
                    <h3>Mevcut Komisyon {selectedDepartment ? `(${selectedDepartment.name})` : ''}</h3>
                    <p>Her bölümde sadece 1 Başkan bulunabilir.</p>

                    {!formData.departmentId ? (
                        <div className="info-bar">
                            <i className="fa-solid fa-circle-info"></i>
                            Lütfen önce bir bölüm seçiniz.
                        </div>
                    ) : currentChair ? (
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th>İsim Soyisim</th>
                                    <th>E-posta</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{currentChair.name}</td>
                                    <td>{currentChair.email}</td>
                                    <td>
                                        <button 
                                            className="btn-sil" 
                                            onClick={handleRemoveChair}
                                            disabled={loading}
                                        >
                                            <i className="fa-solid fa-trash"></i> Sil
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                        <div className="info-bar">
                            <i className="fa-solid fa-circle-info"></i>
                            Bu bölümde henüz komisyon başkanı atanmamış.
                        </div>
                    )}
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

export default CommissionChairAssignment;