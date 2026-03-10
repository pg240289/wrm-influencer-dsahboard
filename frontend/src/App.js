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
import BrandList from './components/BrandList';
import BrandForm from './components/BrandForm';
import SetPassword from './components/SetPassword';
import InfluencerDashboard from './components/InfluencerDashboard';
import InfluencerCampaignDetail from './components/InfluencerCampaignDetail';
import MasterData from './components/MasterData';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
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
                <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
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
                <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                  <InfluencerForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers/:id/edit"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                  <InfluencerForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands"
              element={
                <ProtectedRoute>
                  <BrandList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands/new"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                  <BrandForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands/:id/edit"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                  <BrandForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/masters"
              element={
                <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                  <MasterData />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencer/dashboard"
              element={
                <ProtectedRoute requiredRole="Influencer">
                  <InfluencerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencer/campaign/:id"
              element={
                <ProtectedRoute requiredRole="Influencer">
                  <InfluencerCampaignDetail />
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