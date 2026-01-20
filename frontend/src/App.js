import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import CampaignDashboard from './CampaignDashboard';
import CampaignDetail from './CampaignDetail';
import NewCampaign from './components/NewCampaign';
import UserManagement from './components/UserManagement';
import InfluencerList from './components/InfluencerList';
import InfluencerForm from './components/InfluencerForm';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <CampaignDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaign/:id"
              element={
                <ProtectedRoute>
                  <CampaignDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/new"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Manager']}>
                  <NewCampaign />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRole="Admin">
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers"
              element={
                <ProtectedRoute>
                  <InfluencerList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers/new"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Manager']}>
                  <InfluencerForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers/:id/edit"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Manager']}>
                  <InfluencerForm />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;