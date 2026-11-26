import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import authService from '../../services/authService';
import './Login.css';

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        // Clear error when user starts typing
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authService.login(formData.email, formData.password);
            console.log('Login successful:', response);
            
            // Check if user needs to change password
            if (response.user.requiresPasswordChange) {
                navigate('/change-password');
            } else {
                // Redirect based on role
                if (response.user.role?.name === 'Commission Chair') {
                    navigate('/chair-dashboard');
                } else if (response.user.role?.name === 'Commission Member') {
                    navigate('/member-dashboard');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.error || 'Giriş yapılırken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        navigate('/forgot-password');
    };

    return (
        <>
            <Header />
            <div className="login-container">
                <h1 className="system-title">Staj Takip Sistemi</h1>
                <div className="login-box">
                    <h2>Giriş Yap</h2>
                    
                    {error && <div className="error-message">{error}</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="email">E-posta</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                placeholder="E-posta adresinizi giriniz"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="password">Şifre</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="Şifrenizi giriniz"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="forgot-password">
                            <a href="#!" onClick={handleForgotPassword}>Şifremi unuttum</a>
                        </div>
                        <button 
                            type="submit" 
                            className="login-button"
                            disabled={loading}
                        >
                            {loading ? 'Giriş yapılıyor...' : 'Giriş'}
                        </button>
                    </form>
                </div>
                {process.env.REACT_APP_STAGING === 'true' && <p className="login-environment">Staging ortamı</p>}
            </div>
        </>
    );
};

export default Login;
