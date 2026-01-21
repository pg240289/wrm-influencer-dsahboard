import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import './CampaignDashboard.css';

function CampaignDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout, isAdmin, isManager, hasRole } = useAuth();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get('/campaigns');
      setCampaigns(response.data);
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 401) {
        // Token expired or invalid, will be handled by AuthContext
        setError('Session expired. Please login again.');
      } else {
        setError('Failed to fetch campaigns');
      }
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="loading">Loading campaigns...</div>;
  if (error) return <div className="error">{error}</div>;

  const totalInfluencers = campaigns.reduce((sum, c) => sum + c.num_influencers, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
  const totalContent = campaigns.reduce((sum, c) => sum + (c.total_content || 0), 0);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="page-header-modern">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <div className="logo-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="url(#gradient1)"/>
                  <path d="M16 8v16M8 16h16" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="gradient1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#667eea"/>
                      <stop offset="1" stopColor="#764ba2"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="logo-text">
                <h1>Influencer Dashboard</h1>
                <p className="subtitle">Campaign Management Platform</p>
              </div>
            </div>
          </div>
          <div className="header-actions-modern">
            <button
              className="btn-secondary-header"
              onClick={() => navigate('/brands')}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Brand Master
            </button>
            <button
              className="btn-secondary-header"
              onClick={() => navigate('/influencers')}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Influencer Master
            </button>
            {isAdmin() && (
              <button
                className="btn-secondary-header"
                onClick={() => navigate('/users')}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 0 0-1.5-4.33A5 5 0 0 1 19 16v1h-6.07zM6 11a5 5 0 0 1 5 5v1H1v-1a5 5 0 0 1 5-5z" fill="currentColor"/>
                </svg>
                Manage Users & Roles
              </button>
            )}
            <div className="user-profile-compact">
              <div className="user-avatar">
                {(user?.first_name || user?.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-menu">
                <div className="user-name">{user?.first_name || user?.username}</div>
                <div className="user-email">{user?.email}</div>
              </div>
              <button className="btn-logout-compact" onClick={logout} title="Logout">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M3 3h8v2H5v10h6v2H3V3zm12 4l-4-4v3H7v2h4v3l4-4z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid-modern">
        <div className="stat-card-enhanced">
          <div className="stat-icon-wrapper stat-icon-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Campaigns</div>
            <div className="stat-value">{campaigns.length}</div>
            <div className="stat-change positive">All campaigns</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon-wrapper stat-icon-success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Campaigns</div>
            <div className="stat-value">{activeCampaigns}</div>
            <div className="stat-change positive">{completedCampaigns} completed</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon-wrapper stat-icon-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Influencers</div>
            <div className="stat-value">{totalInfluencers}</div>
            <div className="stat-change">Across all campaigns</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon-wrapper stat-icon-warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Content Pieces</div>
            <div className="stat-value">{totalContent}</div>
            <div className="stat-change">Total deliverables</div>
          </div>
        </div>
      </div>

      {/* Campaigns Table Section */}
      <div className="table-container-modern">
        <div className="table-header-modern">
          <div className="table-title-section">
            <h2>All Campaigns</h2>
            <span className="table-count">{filteredCampaigns.length}</span>
          </div>
          <div className="table-actions-section">
            <div className="search-filter-bar-modern">
              <div className="search-box-modern">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM18 18l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search campaigns or brands..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="custom-dropdown">
                <button
                  className="dropdown-trigger"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                >
                  <svg className="filter-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="dropdown-label">
                    {statusFilter === 'all' ? 'All Status' : statusFilter === 'active' ? 'Active' : 'Completed'}
                  </span>
                  <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu">
                    <button
                      className={`dropdown-item ${statusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => { setStatusFilter('all'); setIsDropdownOpen(false); }}
                    >
                      All Status
                    </button>
                    <button
                      className={`dropdown-item ${statusFilter === 'active' ? 'active' : ''}`}
                      onClick={() => { setStatusFilter('active'); setIsDropdownOpen(false); }}
                    >
                      Active
                    </button>
                    <button
                      className={`dropdown-item ${statusFilter === 'completed' ? 'active' : ''}`}
                      onClick={() => { setStatusFilter('completed'); setIsDropdownOpen(false); }}
                    >
                      Completed
                    </button>
                  </div>
                )}
              </div>
            </div>
            {isManager() && (
              <button
                className="btn-primary-modern"
                onClick={() => navigate('/campaigns/new')}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v14m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                New Campaign
              </button>
            )}
          </div>
        </div>

        <table className="modern-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Campaign Name</th>
              <th>Brand</th>
              <th>Objective</th>
              <th>Influencers</th>
              <th>Deliverables</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>End Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map((campaign, index) => (
              <tr key={campaign.id} onClick={() => navigate(`/campaign/${campaign.id}`)} style={{ cursor: 'pointer' }}>
                <td className="row-number">{index + 1}</td>
                <td>
                  <div className="campaign-name-cell">
                    <div className="campaign-avatar">
                      {campaign.campaign_name.charAt(0)}
                    </div>
                    <span className="campaign-name-text">{campaign.campaign_name}</span>
                  </div>
                </td>
                <td className="brand-cell">{campaign.brand}</td>
                <td>{campaign.objective}</td>
                <td className="center-text">{campaign.num_influencers}</td>
                <td className="deliverables-cell">
                  <span className="deliverables-badge">{campaign.total_content || 0} pieces</span>
                </td>
                <td>
                  <span className={`badge badge-${campaign.status}`}>
                    {campaign.status}
                  </span>
                </td>
                <td className="date-cell">{campaign.start_date}</td>
                <td className="date-cell">{campaign.end_date || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCampaigns.length === 0 && (
          <div className="empty-state">
            <p>No campaigns found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CampaignDashboard;