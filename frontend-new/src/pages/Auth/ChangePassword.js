import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import authService from '../../services/authService';
import axios from '../../services/api';
import './ChangePassword.css';

const ChangePassword = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    // Toast notification helper
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
    };

    useEffect(() => {
        // Check if user is authenticated
        if (!authService.isAuthenticated()) {
            navigate('/');
            return;
        }

        // Get user email
        const user = authService.getCurrentUser();
        setUserEmail(user.email);

        // Check if user actually needs to change password
        if (!user.requiresPasswordChange) {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validate passwords match
        if (formData.newPassword !== formData.confirmPassword) {
            setError('Yeni şifreler eşleşmiyor');
            setLoading(false);
            return;
        }

        // Validate password length
        if (formData.newPassword.length < 6) {
            setError('Yeni şifre en az 6 karakter olmalıdır');
            setLoading(false);
            return;
        }

        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/change-password`, {
                email: userEmail,
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            });

            // Update local storage to remove requiresPasswordChange flag
            const user = authService.getCurrentUser();
            user.requiresPasswordChange = false;
            localStorage.setItem('user', JSON.stringify(user));

            // Show success message and redirect
            showToast('Şifreniz başarıyla değiştirildi!', 'success');
            setTimeout(() => {
                if (user.role?.name === 'Commission Chair') {
                    navigate('/chair-dashboard');
                } else if (user.role?.name === 'Commission Member') {
                    navigate('/member-dashboard');
                } else {
                    navigate('/dashboard');
                }
            }, 1500);
        } catch (err) {
            console.error('Password change error:', err);
            setError(err.response?.data?.error || 'Şifre değiştirilirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <div className="change-password-container">
                <div className="change-password-box">
                    <h2>Şifre Değiştirme</h2>
                    <p className="info-text">
                        Güvenliğiniz için ilk girişte geçici şifrenizi değiştirmeniz gerekmektedir.
                    </p>
                    
                    {error && <div className="error-message">{error}</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="currentPassword">Mevcut Şifre (Geçici Şifre)</label>
                            <input
                                type="password"
                                id="currentPassword"
                                name="currentPassword"
                                placeholder="Geçici şifrenizi giriniz"
                                value={formData.currentPassword}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="newPassword">Yeni Şifre</label>
                            <input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                placeholder="Yeni şifrenizi giriniz (en az 6 karakter)"
                                value={formData.newPassword}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                placeholder="Yeni şifrenizi tekrar giriniz"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
                        </button>
                    </form>
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
        </>
    );
};

export default ChangePassword;
