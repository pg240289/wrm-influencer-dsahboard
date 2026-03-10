import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Configure axios defaults
if (!axios.defaults.baseURL) {
  axios.defaults.baseURL = API_BASE_URL;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor for token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get('/auth/me');
          setUser(response.data);
        } catch (error) {
          // Token is invalid, clear it
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await axios.post('/auth/login', { username, password });
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Unable to connect to server. Please try again.'
      };
    }
  };

  const createUser = async (userData) => {
    try {
      const response = await axios.post('/users', userData);
      return {
        success: true,
        user: response.data.user,
        email_sent: response.data.email_sent,
        generated_password: response.data.generated_password,
        warning: response.data.warning
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create user'
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const refreshUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  const hasRole = (roleName) => {
    return user?.roles?.includes(roleName) || false;
  };

  const hasAnyRole = (roleNames) => {
    if (!user?.roles) return false;
    return roleNames.some(role => user.roles.includes(role));
  };

  const isAdmin = () => hasRole('Admin');
  const isCampaignManager = () => hasRole('Campaign Manager') || isAdmin();
  const isCampaignExecutor = () => hasRole('Campaign Executor') || isCampaignManager();
  const isInfluencer = () => hasRole('Influencer');

  // Backward compatibility
  const isManager = () => isCampaignManager();
  const isViewer = () => isCampaignExecutor();

  const value = {
    user,
    token,
    loading,
    login,
    createUser,
    logout,
    refreshUser,
    isAuthenticated: !!user && !!token,
    hasRole,
    hasAnyRole,
    isAdmin,
    isManager,
    isViewer,
    isCampaignManager,
    isCampaignExecutor,
    isInfluencer
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

