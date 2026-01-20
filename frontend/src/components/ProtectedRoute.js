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
    return <Navigate to="/" replace />;
  }

  if (requiredAnyRole && !hasAnyRole(requiredAnyRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;

