import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { PortalLayout } from './components/layout/PortalLayout';
import './App.css';

// Route-level code-splitting: heavy pages (charts, tables, motion) load on demand.
const Login = lazy(() => import('./pages/Login'));
const SetPassword = lazy(() => import('./pages/SetPassword'));
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const NewCampaign = lazy(() => import('./pages/NewCampaign'));
const Influencers = lazy(() => import('./pages/Influencers'));
const InfluencerForm = lazy(() => import('./pages/InfluencerForm'));
const UserManagement = lazy(() => import('./pages/UsersAndRoles'));
const Brands = lazy(() => import('./pages/Brands'));
const BrandForm = lazy(() => import('./pages/BrandForm'));
const MasterData = lazy(() => import('./pages/MasterData'));
const InfluencerHome = lazy(() => import('./pages/portal/InfluencerHome'));
const InfluencerCampaign = lazy(() => import('./pages/portal/InfluencerCampaign'));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
        <Router>
          <div className="App">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />
                <Route path="/set-password" element={<SetPassword />} />

                {/* Influencer self-service portal */}
                <Route
                  element={
                    <ProtectedRoute requiredRole="Influencer">
                      <PortalLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/influencer/dashboard" element={<InfluencerHome />} />
                  <Route path="/influencer/campaign/:id" element={<InfluencerCampaign />} />
                </Route>

                {/* Staff application — inside the App Shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<DashboardHome />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/campaign/:id" element={<CampaignDetail />} />
                  <Route
                    path="/campaigns/new"
                    element={
                      <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                        <NewCampaign />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/influencers" element={<Influencers />} />
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
                  <Route path="/brands" element={<Brands />} />
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
                    path="/analytics"
                    element={
                      <ProtectedRoute requiredAnyRole={['Admin', 'Campaign Manager']}>
                        <Analytics />
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
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
