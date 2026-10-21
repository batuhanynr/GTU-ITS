import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import CommissionChairAssignment from './CommissionChairAssignment';
import CommissionStatus from './CommissionStatus';
import authService from '../../services/authService';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [activePage, setActivePage] = useState('home'); // Track active page

    useEffect(() => {
        // Check if user is authenticated
        if (!authService.isAuthenticated()) {
            navigate('/');
            return;
        }

        // Get user data
        const userData = authService.getCurrentUser();
        // Restrict the admin screen before rendering any management controls.
        if (userData?.role?.name !== 'General Admin') {
            navigate(userData?.role?.name === 'Commission Chair' ? '/chair-dashboard' :
                userData?.role?.name === 'Commission Member' ? '/member-dashboard' : '/', { replace: true });
            return;
        }
        setUser(userData);
    }, [navigate]);

    const handleLogout = () => {
        authService.logout();
        navigate('/');
    };

    if (!user) {
        return <div>Yükleniyor...</div>;
    }

    // Render content based on active page
    const renderContent = () => {
        switch (activePage) {
            case 'assign-chair':
                return <CommissionChairAssignment />;
            case 'view-status':
                return <CommissionStatus />;
            default:
                return (
                    <div>
                        <div className="info-bar">
                            <i className="fa-solid fa-circle-info"></i>
                            <strong>Bilgilendirme:</strong> Staj Takip Sistemi Admin Paneline hoş geldiniz.
                        </div>
                        <h2>Ana Sayfa</h2>
                        <p>Hoş geldiniz, <strong>{user.name || user.username}</strong>!</p>
                        <div className="card-container">
                            <div className="card">
                                <h3>Kullanıcı Bilgileri</h3>
                                <p><strong>E-posta:</strong> {user.email}</p>
                                <p><strong>Rol:</strong> {user.role?.name}</p>
                                {user.department && <p><strong>Bölüm:</strong> {user.department.name}</p>}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="dashboard-body">
            <Header />
            
            <div className="dashboard-container">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <h3>Staj Takip Sistemi</h3>
                    </div>
                    <nav className="sidebar-nav">
                        <ul>
                            <li>
                                <a 
                                    href="#!" 
                                    className={activePage === 'home' ? 'active' : ''}
                                    onClick={(e) => { e.preventDefault(); setActivePage('home'); }}
                                >
                                    <i className="fa-solid fa-house"></i>
                                    <span>Ana Sayfa</span>
                                </a>
                            </li>
                            <li>
                                <a 
                                    href="#!" 
                                    className={activePage === 'assign-chair' ? 'active' : ''}
                                    onClick={(e) => { e.preventDefault(); setActivePage('assign-chair'); }}
                                >
                                    <i className="fa-solid fa-users-gear"></i>
                                    <span>Komisyon Başkanı Atama</span>
                                </a>
                            </li>
                            <li>
                                <a 
                                    href="#!" 
                                    className={activePage === 'view-status' ? 'active' : ''}
                                    onClick={(e) => { e.preventDefault(); setActivePage('view-status'); }}
                                >
                                    <i className="fa-solid fa-list-check"></i>
                                    <span>Komisyon Durumu Görüntüle</span>
                                </a>
                            </li>
                        </ul>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="main-content">
                    {/* Top Navbar */}
                    <nav className="top-navbar">
                        <div className="nav-left">
                            <a href="#!" className="nav-icon" title="Ana Sayfa" onClick={(e) => { e.preventDefault(); setActivePage('home'); }}>
                                <i className="fa-solid fa-house"></i>
                            </a>
                        </div>
                        <div className="nav-right">
                            <div className="profile-menu">
                                <i className="fa-solid fa-circle-user profile-icon"></i>
                                <span className="profile-name">{(user.name || user.username).toUpperCase()}</span>
                            </div>
                            <button className="logout-button-small" onClick={handleLogout}>
                                <i className="fa-solid fa-right-from-bracket"></i> Çıkış
                            </button>
                        </div>
                    </nav>

                    {/* Content Area */}
                    <div className="content-area">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
