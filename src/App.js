import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, LogOut, User, Mail, Phone, Film, Edit2, X, Save, TrendingUp, Sun, Moon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import LoginPage from './components/LoginPage';
import Analytics from './components/Analytics';
import { db } from './config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userId, setUserId] = useState(null);

  // Theme state
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // Check if user is already logged in
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn');
    const storedUserId = localStorage.getItem('userId');
    
    if (loggedIn === 'true' && storedUserId) {
      loadUserData(storedUserId);
    }
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const loadUserData = async (id) => {
    try {
      const userRef = doc(db, 'shootboardUsers', id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userDataFromFirebase = userDoc.data();
        setUserData({
          id: userDoc.id,
          name: userDataFromFirebase.username,
          email: userDataFromFirebase.useremail,
          phone: userDataFromFirebase.userphone,
          role: userDataFromFirebase.userrole
        });
        setUserId(userDoc.id);
        setIsAuthenticated(true);
        
        // Update localStorage
        localStorage.setItem('userId', userDoc.id);
        localStorage.setItem('userName', userDataFromFirebase.username);
        localStorage.setItem('userEmail', userDataFromFirebase.useremail);
        localStorage.setItem('userPhone', userDataFromFirebase.userphone);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const handleLogin = (userInfo) => {
    setIsAuthenticated(true);
    setUserData({
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      phone: userInfo.phone,
      role: userInfo.role
    });
    setUserId(userInfo.id);
    
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userId', userInfo.id);
    localStorage.setItem('userName', userInfo.name);
    localStorage.setItem('userEmail', userInfo.email);
    localStorage.setItem('userPhone', userInfo.phone);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserData(null);
    setUserId(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userPhone');
  };

  const handleUpdateProfile = async (updatedName, updatedEmail, updatedPhone) => {
    if (!userId) return;
    
    try {
      const userRef = doc(db, 'shootboardUsers', userId);
      await updateDoc(userRef, {
        username: updatedName,
        useremail: updatedEmail,
        userphone: updatedPhone
      });
      
      // Update local state
      setUserData({
        ...userData,
        name: updatedName,
        email: updatedEmail,
        phone: updatedPhone
      });
      
      // Update localStorage
      localStorage.setItem('userName', updatedName);
      localStorage.setItem('userEmail', updatedEmail);
      localStorage.setItem('userPhone', updatedPhone);
      
      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          {isAuthenticated ? (
            <>
              <Route path="/shootboard-dashboard" element={
                <>
                  <Navigation 
                    onLogout={handleLogout} 
                    userData={userData}
                    onUpdateProfile={handleUpdateProfile}
                    theme={theme}
                    toggleTheme={toggleTheme}
                  />
                  <Dashboard userData={userData} theme={theme} />
                </>
              } />
              <Route path="/calendar" element={
                <>
                  <Navigation 
                    onLogout={handleLogout} 
                    userData={userData}
                    onUpdateProfile={handleUpdateProfile}
                    theme={theme}
                    toggleTheme={toggleTheme}
                  />
                  <CalendarView userData={userData} theme={theme} /> 
                </>
              } />
              <Route path="/analytics" element={
                <>
                  <Navigation 
                    onLogout={handleLogout} 
                    userData={userData}
                    onUpdateProfile={handleUpdateProfile}
                    theme={theme}
                    toggleTheme={toggleTheme}
                  />
                  <Analytics />
                </>
              } />
              <Route path="/" element={<Navigate to="/shootboard-dashboard" replace />} />
              <Route path="*" element={<Navigate to="/shootboard-dashboard" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

const Navigation = ({ onLogout, userData, onUpdateProfile, theme, toggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Update edit form when userData changes
  useEffect(() => {
    if (userData) {
      setEditName(userData.name || '');
      setEditEmail(userData.email || '');
      setEditPhone(userData.phone || '');
    }
  }, [userData]);

  // Get first letter for profile circle
  const firstLetter = userData?.name ? userData.name.charAt(0).toUpperCase() : 'U';

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  const handleEditProfile = () => {
    setEditName(userData?.name || '');
    setEditEmail(userData?.email || '');
    setEditPhone(userData?.phone || '');
    setShowEditModal(true);
    setShowDropdown(false);
    setSaveMessage('');
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setSaveMessage('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await onUpdateProfile(editName.trim(), editEmail, editPhone);
      setSaveMessage('Profile updated successfully!');
      setTimeout(() => {
        setShowEditModal(false);
        setSaveMessage('');
      }, 1500);
    } catch (error) {
      setSaveMessage('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <nav className="navigation">
        <div className="nav-brand">
          <Film size={24} className="brand-icon" />
          <span className="brand-name">Shoot Board</span>
        </div>
        <div className="nav-links">
          <Link to="/shootboard-dashboard" className={location.pathname === '/shootboard-dashboard' ? 'active' : ''}>
            <LayoutDashboard size={18} />
            <span>Launch Dashboard</span>
          </Link>

          {userData?.role !== 'Brand Team' && (
            <>
              <Link 
                to="/calendar" 
                className={location.pathname === '/calendar' ? 'active' : ''}
              >
                <Calendar size={18} />
                <span>Shoot Calendar</span>
              </Link>

              <Link 
                to="/analytics" 
                className={location.pathname === '/analytics' ? 'active' : ''}
              >
                <TrendingUp size={18} />
                <span>Analytics</span>
              </Link>
            </>
          )}

          {/* Dark/Light Mode Toggle Button */}
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Profile Dropdown */}
          <div className="profile-dropdown">
            <div 
              className="profile-circle" 
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {firstLetter}
            </div>
            
            {showDropdown && (
              <div className="dropdown-menu">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">{firstLetter}</div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-name">{userData?.name || 'User'}</div>
                    <div className="dropdown-email">{userData?.email || userData?.phone || 'No contact info'}</div>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button onClick={handleEditProfile} className="dropdown-edit-btn">
                  <Edit2 size={16} />
                  <span>Edit Profile</span>
                </button>
                <button onClick={handleLogoutClick} className="dropdown-logout-btn">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Profile</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {saveMessage && (
                <div className={`save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
                  {saveMessage.includes('success') ? '✓' : '⚠'} {saveMessage}
                </div>
              )}
              
              <div className="form-group">
                <label>
                  <User size={16} />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>
                  <Mail size={16} />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Enter your email address"
                />
              </div>
              
              <div className="form-group">
                <label>
                  <Phone size={16} />
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="spinner-small"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;