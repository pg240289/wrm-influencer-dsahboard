import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children, requiredRole = null, requiredAnyRole = null }) {
  const { isAuthenticated, loading, hasRole, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role requirements
  if (requiredRole && !hasRole(requiredRole)) {
    // Redirect influencers to their dashboard instead of /
    if (hasRole('Influencer')) {
      return <Navigate to="/influencer/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (requiredAnyRole && !hasAnyRole(requiredAnyRole)) {
    if (hasRole('Influencer')) {
      return <Navigate to="/influencer/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Redirect influencer users away from main dashboard to their own
  if (!requiredRole && !requiredAnyRole && hasRole('Influencer') && !hasRole('Admin') && !hasRole('Campaign Manager') && !hasRole('Campaign Executor')) {
    const currentPath = window.location.pathname;
    if (currentPath === '/') {
      return <Navigate to="/influencer/dashboard" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;

