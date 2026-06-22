import React, { useState } from 'react';
import { Mail, Phone, Film, ArrowRight, Camera, Calendar, BarChart3, Sparkles, Shield, Rocket } from 'lucide-react';
import { db } from '../config';
import { collection, query, where, getDocs } from 'firebase/firestore';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Query Firestore for user with matching email AND phone
      const usersRef = collection(db, 'shootboardUsers');
      const q = query(
        usersRef, 
        where('useremail', '==', email),
        where('userphone', '==', phone)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // User found with matching email and phone
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        // Pass user info to parent component
        onLogin({
          email: userData.useremail,
          phone: userData.userphone,
          name: userData.username,
          role: userData.userrole,
          id: userDoc.id
        });
      } else {
        // Check if email exists but phone doesn't match
        const emailQuery = query(usersRef, where('useremail', '==', email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          setError('Invalid phone number for this email.');
        } else {
          // Check if phone exists but email doesn't match
          const phoneQuery = query(usersRef, where('userphone', '==', phone));
          const phoneSnapshot = await getDocs(phoneQuery);
          
          if (!phoneSnapshot.empty) {
            setError('Invalid email address for this phone number.');
          } else {
            setError('No account found with these credentials.');
          }
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError('An error occurred during login. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left Side - Brand Section */}
        <div className="login-left">
          <div className="login-brand-content">
            <div className="brand-logo">
              <Film size={48} className="brand-logo-icon" />
            </div>
            <h1 className="brand-title">Shoot Board</h1>
            <p className="brand-tagline">Product Launch and Shoot Management across brands</p>
            
            <div className="brand-features">
              <div className="feature-chip">
                <Rocket size={14} />
                <span>Product Launch</span>
              </div>
              <div className="feature-chip">
                <Camera size={14} />
                <span>Photo Shoots</span>
              </div>
              <div className="feature-chip">
                <Calendar size={14} />
                <span>Schedule Management</span>
              </div>
              <div className="feature-chip">
                <BarChart3 size={14} />
                <span>Analytics Dashboard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="login-right">
          <div className="login-form-container">
            <div className="login-header">
              <div className="welcome-badge">
                <Sparkles size={16} />
                <span>Welcome Back!</span>
              </div>
              <h2>Sign In</h2>
              <p>Enter your credentials to access the portal</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <div className="input-with-icon">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="login-submit-btn" disabled={isLoading}>
                {isLoading ? (
                  <div className="spinner-small"></div>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* <div className="demo-section">
              <div className="demo-header">
                <Shield size={14} />
                <span>Demo Credentials</span>
              </div>
              <div className="demo-credentials">
                <div className="demo-item">
                  <Mail size={12} />
                  <span>anand@wedtree.com</span>
                </div>
                <div className="demo-item">
                  <Phone size={12} />
                  <span>9876543210</span>
                </div>
              </div>
              <p className="demo-note">Use both credentials to login</p>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;