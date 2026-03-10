import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

function SetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const [inviteData, setInviteData] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await axios.get(`/auth/verify-invite?token=${token}`);
        if (response.data.valid) {
          setInviteData(response.data);
          setTokenValid(true);
        } else {
          setError(response.data.error || 'Invalid invitation link.');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired invitation link.');
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post('/auth/set-password', { token, password });

      if (response.data.token) {
        setSuccess('Password set successfully! Redirecting...');
        // Store token and redirect
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        setTimeout(() => {
          window.location.href = '/influencer/dashboard';
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. Please try again.');
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Verifying Invitation</h1>
            <p>Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Invalid Invitation</h1>
          </div>
          <div className="auth-error">{error}</div>
          <div className="auth-footer">
            <p>
              <a href="/login" style={{ color: '#667eea' }}>Go to Login</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome, {inviteData?.name}!</h1>
          <p>Set your password to get started</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success" style={{
          background: '#d1fae5', color: '#065f46', padding: '12px 16px',
          borderRadius: '8px', marginBottom: '16px', textAlign: 'center'
        }}>{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={inviteData?.email || ''}
              disabled
              style={{ background: '#f3f4f6' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="Enter your password (min 6 characters)"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm your password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
          >
            {submitting ? 'Setting Password...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetPassword;
