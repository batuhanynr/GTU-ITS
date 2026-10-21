import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import authService from '../../services/authService';
import './AddCommissionMember.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AddCommissionMember = () => {
    const [currentMembers, setCurrentMembers] = useState([]);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        temporaryPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
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

    // Fetch current members on component mount
    useEffect(() => {
        fetchCurrentMembers();
    }, []);

    const fetchCurrentMembers = async () => {
        try {
            const user = authService.getCurrentUser();
            if (!user || !user.department) {
                setError('Kullanıcı bölümü bulunamadı.');
                return;
            }

            const response = await axios.get(`${API_URL}/department-members/${user.department.id}`);
            setCurrentMembers(response.data);
        } catch (error) {
            console.error('Error fetching members:', error);
            setError('Komisyon üyeleri yüklenirken hata oluştu.');
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
        setSuccess('');
    };

    const handleRemoveMember = async (memberId) => {
        showConfirm('Bu komisyon üyesini kaldırmak istediğinizden emin misiniz?', async () => {
            setLoading(true);
            setError('');
            setSuccess('');

            try {
                await axios.delete(`${API_URL}/remove-commission-member/${memberId}`);
                showToast('Komisyon üyesi başarıyla kaldırıldı.', 'success');
                fetchCurrentMembers(); // Refresh the list
            } catch (error) {
                console.error('Error removing member:', error);
                showToast(error.response?.data?.error || 'Üye kaldırılırken hata oluştu.', 'error');
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

        try {
            const user = authService.getCurrentUser();
            if (!user || !user.department) {
                setError('Kullanıcı bölümü bulunamadı.');
                setLoading(false);
                return;
            }

            const response = await axios.post(`${API_URL}/create-commission-member`, {
                departmentId: user.department.id,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                temporaryPassword: formData.temporaryPassword
            });

            showToast(response.data.message || 'Komisyon üyesi başarıyla eklendi!', 'success');
            setFormData({ firstName: '', lastName: '', email: '', temporaryPassword: '' });
            fetchCurrentMembers(); // Refresh the list
        } catch (error) {
            console.error('Error creating member:', error);
            showToast(error.response?.data?.error || 'Üye eklenirken hata oluştu.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Komisyon Üyesi Ekleme</h2>
            <p>Yeni komisyon üyelerini atayın veya mevcut üyeleri yönetin.</p>

            <div className="content-layout">
                {/* Left Side - Form */}
                <div className="form-container-card">
                    <h3>Yeni Üye Ekleme Formu</h3>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <form className="formatted-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="firstName">İsim:</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                placeholder="Örn: Ali"
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
                                placeholder="Örn: Yılmaz"
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
                                placeholder="Örn: ali.yilmaz@gtu.edu.tr"
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

                        <button 
                            type="submit" 
                            className="btn-submit"
                            disabled={loading}
                        >
                            <i className="fa-solid fa-user-plus"></i>
                            {loading ? ' Kaydediliyor...' : ' Üyeyi Kaydet'}
                        </button>
                    </form>
                </div>

                {/* Right Side - Current Members */}
                <div className="table-container-card">
                    <h3>Mevcut Komisyon Üyeleri</h3>
                    <p>Her bölümde en fazla 2 üye bulunabilir.</p>

                    {currentMembers.length === 0 ? (
                        <div className="info-bar">
                            <i className="fa-solid fa-circle-info"></i>
                            Bu bölümde henüz komisyon üyesi atanmamış.
                        </div>
                    ) : (
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th>İsim Soyisim</th>
                                    <th>E-posta</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentMembers.map(member => (
                                    <tr key={member.id}>
                                        <td>{member.name}</td>
                                        <td>{member.email}</td>
                                        <td>
                                            <button 
                                                className="btn-sil" 
                                                onClick={() => handleRemoveMember(member.id)}
                                                disabled={loading}
                                            >
                                                <i className="fa-solid fa-trash"></i> Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {currentMembers.length >= 2 && (
                        <div className="warning-message" style={{ marginTop: '15px' }}>
                            <i className="fa-solid fa-exclamation-triangle"></i>
                            Maksimum üye sayısına ulaşıldı. Yeni üye eklemek için mevcut bir üyeyi kaldırın.
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

export default AddCommissionMember;
