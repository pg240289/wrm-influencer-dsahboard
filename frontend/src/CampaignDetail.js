import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './contexts/AuthContext';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './CampaignDetail.css';

// Utility functions
const formatNumber = (num) => {
  if (num == null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTooltipValue = (value, name) => {
  return [formatNumber(value), name];
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{formatDate(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} className="tooltip-value" style={{ color: entry.color }}>
            {`${entry.name || entry.dataKey}: ${formatNumber(entry.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isCampaignManager, isCampaignExecutor } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewsMode, setViewsMode] = useState('cumulative');
  const [likesMode, setLikesMode] = useState('cumulative');
  const [commentsMode, setCommentsMode] = useState('cumulative');

  // Add influencer state
  const [showAddInfluencer, setShowAddInfluencer] = useState(false);
  const [availableInfluencers, setAvailableInfluencers] = useState([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [addingInfluencer, setAddingInfluencer] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Content link management
  const [addingContentFor, setAddingContentFor] = useState(null); // assignment_id
  const [newContentUrl, setNewContentUrl] = useState('');
  const [newContentType, setNewContentType] = useState('Post');
  const [editingContentId, setEditingContentId] = useState(null);
  const [editContentUrl, setEditContentUrl] = useState('');

  // Date filter for analytics
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    fetchCampaignData();
  }, [id]);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      setError(null);
      const campaignRes = await axios.get(`/campaigns/${id}`);
      const campaignData = campaignRes.data;
      setCampaign(campaignData);

      // Set default date filters: campaign start_date to today
      const today = new Date().toISOString().split('T')[0];
      const startDate = campaignData.start_date || today;
      setFilterStartDate(startDate);
      setFilterEndDate(today);

      // Fetch analytics with default date range
      const analyticsRes = await axios.get(`/campaigns/${id}/analytics`, {
        params: { start_date: startDate, end_date: today }
      });
      setAnalytics(analyticsRes.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching campaign:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this campaign.');
      } else {
        setError('Failed to load campaign data. Please try again.');
      }
      setLoading(false);
    }
  };

  const fetchAnalytics = async (startDate, endDate) => {
    try {
      setAnalyticsLoading(true);
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await axios.get(`/campaigns/${id}/analytics`, { params });
      setAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setFilterStartDate(val);
    if (val && filterEndDate) {
      fetchAnalytics(val, filterEndDate);
    }
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setFilterEndDate(val);
    if (filterStartDate && val) {
      fetchAnalytics(filterStartDate, val);
    }
  };

  const fetchAvailableInfluencers = async () => {
    try {
      const res = await axios.get('/influencers', { params: { status: 'active', for_campaign: true } });
      setAvailableInfluencers(res.data);
    } catch (err) {
      setAvailableInfluencers([]);
    }
  };

  const handleAddInfluencer = async () => {
    if (!selectedInfluencerId || !selectedPlatform) return;
    setAddingInfluencer(true);
    try {
      await axios.post(`/campaigns/${id}/influencers`, {
        influencer_id: parseInt(selectedInfluencerId),
        platform: selectedPlatform
      });
      setActionSuccess('Influencer added successfully');
      setSelectedInfluencerId('');
      setSelectedPlatform('');
      setShowAddInfluencer(false);
      fetchCampaignData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to add influencer');
      setTimeout(() => setActionError(''), 3000);
    }
    setAddingInfluencer(false);
  };

  const handleAddContent = async (assignmentId) => {
    if (!newContentUrl.trim()) return;
    try {
      await axios.post(`/campaigns/${id}/influencers/${assignmentId}/content`, {
        url: newContentUrl,
        content_type: newContentType
      });
      setAddingContentFor(null);
      setNewContentUrl('');
      setNewContentType('Post');
      setActionSuccess('Content link added');
      fetchCampaignData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to add content');
      setTimeout(() => setActionError(''), 3000);
    }
  };

  const handleUpdateContent = async (contentId) => {
    if (!editContentUrl.trim()) return;
    try {
      await axios.put(`/campaigns/${id}/content/${contentId}`, { url: editContentUrl });
      setEditingContentId(null);
      setEditContentUrl('');
      setActionSuccess('Content link updated');
      fetchCampaignData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to update content');
      setTimeout(() => setActionError(''), 3000);
    }
  };

  const handleDeleteContent = async (contentId) => {
    if (!window.confirm('Delete this content link?')) return;
    try {
      await axios.delete(`/campaigns/${id}/content/${contentId}`);
      setActionSuccess('Content link deleted');
      fetchCampaignData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to delete content');
      setTimeout(() => setActionError(''), 3000);
    }
  };

  const handleRemoveInfluencer = async (assignmentId) => {
    if (!window.confirm('Remove this influencer from the campaign?')) return;
    try {
      await axios.delete(`/campaigns/${id}/influencers/${assignmentId}`);
      setActionSuccess('Influencer removed');
      fetchCampaignData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to remove influencer');
      setTimeout(() => setActionError(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="campaign-detail-container">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-stats">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
          <div className="skeleton-content"></div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="campaign-detail-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>{error || 'Campaign not found'}</h3>
          <p>We couldn't load the campaign details. Please check your connection and try again.</p>
          <button className="retry-button" onClick={fetchCampaignData}>Retry</button>
          <button className="back-button" onClick={() => navigate('/')}>Back to Campaigns</button>
        </div>
      </div>
    );
  }

  const platformColors = {
    'YouTube': '#FF6B6B',
    'Instagram': '#E94196',
    'X (Twitter)': '#4A90E2',
    'Facebook': '#5B7FDB',
    'TikTok': '#00F2EA'
  };

  // Calculate cumulative values
  const calculateCumulative = (data, key) => {
    let runningTotal = 0;
    return data.map(item => {
      runningTotal += item[key];
      return {
        ...item,
        [key]: runningTotal
      };
    });
  };

  // Get chart data based on mode
  const getChartData = (mode, dataKey) => {
    if (!analytics || !analytics.daily_metrics) return [];
    if (mode === 'cumulative') {
      return calculateCumulative(analytics.daily_metrics, dataKey);
    }
    return analytics.daily_metrics;
  };

  // Calculate engagement rate
  const engagementRate = campaign.total_views > 0 
    ? ((campaign.total_likes + campaign.total_comments) / campaign.total_views * 100).toFixed(2)
    : '0.00';

  return (
    <div className="campaign-detail-container">
      {/* Back Button */}
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Campaigns
      </button>

      {/* Campaign Header */}
      <div className="campaign-header">
        <div className="campaign-header-left">
          <div className="campaign-icon">
            {campaign.campaign_name.charAt(0)}
          </div>
          <div className="campaign-header-info">
            <div className="campaign-title-row">
              <h1>{campaign.campaign_name}</h1>
              <span className={`status-badge status-${campaign.status}`}>
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </span>
            </div>
            <div className="campaign-meta">
              <span className="campaign-objective">📊 {campaign.objective}</span>
              <span className="campaign-brand">🏢 {campaign.brand_name}</span>
              {campaign.start_date && (
                <span className="campaign-dates">
                  📅 {formatDate(campaign.start_date)}
                  {campaign.end_date && ` - ${formatDate(campaign.end_date)}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="detail-stats-grid">
        <div className="detail-stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-label">Influencers</div>
            <div className="stat-value-small">{campaign.num_influencers}</div>
          </div>
        </div>
        <div className="detail-stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-label">Content Pieces</div>
            <div className="stat-value-small">{campaign.total_content}</div>
          </div>
        </div>
        <div className="detail-stat-card highlight">
          <div className="stat-icon">👁️</div>
          <div className="stat-content">
            <div className="stat-label">Total Views</div>
            <div className="stat-value-small">{formatNumber(campaign.total_views)}</div>
          </div>
        </div>
        <div className="detail-stat-card highlight">
          <div className="stat-icon">❤️</div>
          <div className="stat-content">
            <div className="stat-label">Total Likes</div>
            <div className="stat-value-small">{formatNumber(campaign.total_likes)}</div>
          </div>
        </div>
        <div className="detail-stat-card highlight">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <div className="stat-label">Total Comments</div>
            <div className="stat-value-small">{formatNumber(campaign.total_comments)}</div>
          </div>
        </div>
        <div className="detail-stat-card highlight">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-label">Engagement Rate</div>
            <div className="stat-value-small">{engagementRate}%</div>
          </div>
        </div>
      </div>

      {campaign.description && (
        <div className="description-section">
          <div className="description-content">
            <span className="description-label">Description:</span>
            <span className="description-text">{campaign.description}</span>
          </div>
          <span className="created-date">Created {formatDate(campaign.created_at)}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            Graph
          </button>
          <button 
            className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`tab ${activeTab === 'top-performers' ? 'active' : ''}`}
            onClick={() => setActiveTab('top-performers')}
          >
            Top Performers
          </button>
          <button 
            className={`tab ${activeTab === 'influencers' ? 'active' : ''}`}
            onClick={() => setActiveTab('influencers')}
          >
            Influencers
          </button>
          <button 
            className={`tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            Content
          </button>
        </div>
      </div>

      {/* Date Filter - shown for analytics tabs */}
      {(activeTab === 'graph' || activeTab === 'timeline' || activeTab === 'top-performers') && (
        <div className="date-filter-bar">
          <div className="date-filter-group">
            <label htmlFor="filter-start">From</label>
            <input
              id="filter-start"
              type="date"
              value={filterStartDate}
              onChange={handleStartDateChange}
            />
          </div>
          <div className="date-filter-group">
            <label htmlFor="filter-end">To</label>
            <input
              id="filter-end"
              type="date"
              value={filterEndDate}
              onChange={handleEndDateChange}
            />
          </div>
          {analyticsLoading && <span className="analytics-loading-indicator">Loading...</span>}
        </div>
      )}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'graph' && (
          <div className="graph-section">
            <h3 className="section-title">Stats Graphs</h3>

            {/* Views Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h4>Views</h4>
                <div className="chart-toggle">
                  <button
                    className={viewsMode === 'cumulative' ? 'toggle-active' : ''}
                    onClick={() => setViewsMode('cumulative')}
                  >
                    Cumulative
                  </button>
                  <button
                    className={viewsMode === 'daily' ? 'toggle-active' : ''}
                    onClick={() => setViewsMode('daily')}
                  >
                    Daily
                  </button>
                </div>
              </div>
              {getChartData(viewsMode, 'views').length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={getChartData(viewsMode, 'views')}>
                    <defs>
                      <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#667eea" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#999"
                      fontSize={12}
                      tickFormatter={(value) => formatDate(value)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#999"
                      fontSize={12}
                      tickFormatter={(value) => formatNumber(value)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#667eea"
                      strokeWidth={2.5}
                      fill="url(#viewsGradient)"
                      dot={{ r: 4, fill: '#667eea', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: '#667eea', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-no-data">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M7 16l4-6 4 4 5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>No views data available for this period</p>
                </div>
              )}
            </div>

            {/* Likes and Comments Charts */}
            <div className="charts-row">
              <div className="chart-card half">
                <div className="chart-header">
                  <h4>Likes</h4>
                  <div className="chart-toggle">
                    <button
                      className={likesMode === 'cumulative' ? 'toggle-active' : ''}
                      onClick={() => setLikesMode('cumulative')}
                    >
                      Cumulative
                    </button>
                    <button
                      className={likesMode === 'daily' ? 'toggle-active' : ''}
                      onClick={() => setLikesMode('daily')}
                    >
                      Daily
                    </button>
                  </div>
                </div>
                {getChartData(likesMode, 'likes').length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={getChartData(likesMode, 'likes')}>
                      <defs>
                        <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E94196" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#E94196" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#999"
                        fontSize={11}
                        tickFormatter={(value) => formatDate(value)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#999"
                        fontSize={11}
                        tickFormatter={(value) => formatNumber(value)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="likes"
                        stroke="#E94196"
                        strokeWidth={2.5}
                        fill="url(#likesGradient)"
                        dot={{ r: 3, fill: '#E94196', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 5, fill: '#E94196', strokeWidth: 2, stroke: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-no-data">
                    <p>No likes data available</p>
                  </div>
                )}
              </div>

              <div className="chart-card half">
                <div className="chart-header">
                  <h4>Comments</h4>
                  <div className="chart-toggle">
                    <button
                      className={commentsMode === 'cumulative' ? 'toggle-active' : ''}
                      onClick={() => setCommentsMode('cumulative')}
                    >
                      Cumulative
                    </button>
                    <button
                      className={commentsMode === 'daily' ? 'toggle-active' : ''}
                      onClick={() => setCommentsMode('daily')}
                    >
                      Daily
                    </button>
                  </div>
                </div>
                {getChartData(commentsMode, 'comments').length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={getChartData(commentsMode, 'comments')}>
                      <defs>
                        <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#999"
                        fontSize={11}
                        tickFormatter={(value) => formatDate(value)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#999"
                        fontSize={11}
                        tickFormatter={(value) => formatNumber(value)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="comments"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#commentsGradient)"
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-no-data">
                    <p>No comments data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-section">
            <div className="section-header">
              <div>
                <h3 className="section-title">Content Publishing Timeline</h3>
                <p className="section-subtitle">Daily frequency of content published during the campaign</p>
              </div>
              {analytics.daily_metrics && analytics.daily_metrics.length > 0 && (
                <div className="timeline-summary">
                  <span>Total Days: {analytics.daily_metrics.length}</span>
                  <span>Avg/Day: {(campaign.total_content / analytics.daily_metrics.length).toFixed(1)}</span>
                </div>
              )}
            </div>
            <div className="chart-card">
              {analytics.daily_metrics && analytics.daily_metrics.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.daily_metrics}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#667eea" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#764ba2" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#999"
                      fontSize={12}
                      tickFormatter={(value) => formatDate(value)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis stroke="#999" fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="content_count" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-no-data">
                  <p>No publishing data available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'top-performers' && (
          <div className="top-performers-section">
            <h3 className="section-title">Top Performing Content</h3>
            {analytics.top_performers && analytics.top_performers.length > 0 ? (
              <div className="content-grid">
                {analytics.top_performers.slice(0, 6).map((content, idx) => (
                <div key={content.id} className="content-card">
                  <div className="content-thumbnail">
                    <img src={content.thumbnail || 'https://placehold.co/400x300'} alt="" />
                    <div className="content-overlay">
                      <div className="rank-badge">{idx + 1}</div>
                    </div>
                  </div>
                  <div className="content-info">
                    <div className="influencer-mini">
                      <div className="influencer-avatar-mini">
                        {content.influencer_name.charAt(0)}
                      </div>
                      <div>
                        <div className="influencer-name-mini">{content.influencer_name}</div>
                        <div className="platform-badge-mini">
                          <span className={`platform-icon ${content.platform.toLowerCase()}`}></span>
                          {content.content_type}
                        </div>
                      </div>
                    </div>
                    <div className="content-stats">
                      <div className="stat-item">
                        <span>👁</span>
                        <strong>{formatNumber(content.views)}</strong>
                      </div>
                      <div className="stat-item">
                        <span>❤️</span>
                        <strong>{formatNumber(content.likes)}</strong>
                      </div>
                      <div className="stat-item">
                        <span>💬</span>
                        <strong>{formatNumber(content.comments)}</strong>
                      </div>
                      <div className="stat-item">
                        <span>📈</span>
                        <strong>{content.engagement_rate}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No content data available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'influencers' && (
          <div className="influencers-section">
            <div className="section-header-row">
              <h3 className="section-title">Influencers ({(campaign.influencers || []).length})</h3>
              {isCampaignExecutor() && (
                <button className="btn-add-influencer" onClick={() => { setShowAddInfluencer(!showAddInfluencer); if (!showAddInfluencer) fetchAvailableInfluencers(); }}>
                  {showAddInfluencer ? 'Cancel' : '+ Add Influencer'}
                </button>
              )}
            </div>

            {actionSuccess && <div className="action-alert action-alert-success">{actionSuccess}</div>}
            {actionError && <div className="action-alert action-alert-error">{actionError}</div>}

            {showAddInfluencer && (
              <div className="add-influencer-form">
                <select value={selectedInfluencerId} onChange={(e) => setSelectedInfluencerId(e.target.value)}>
                  <option value="">Select Influencer</option>
                  {availableInfluencers.map(inf => (
                    <option key={inf.id} value={inf.id}>{inf.name} ({inf.tier || 'N/A'})</option>
                  ))}
                </select>
                <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)}>
                  <option value="">Select Platform</option>
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Facebook">Facebook</option>
                  <option value="X (Twitter)">X (Twitter)</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
                <button className="btn-save-action" onClick={handleAddInfluencer} disabled={addingInfluencer || !selectedInfluencerId || !selectedPlatform}>
                  {addingInfluencer ? 'Adding...' : 'Add'}
                </button>
              </div>
            )}

            {campaign.influencers && campaign.influencers.length > 0 ? (
              <div className="influencer-assignments-list">
                {campaign.influencers.map((influencer, idx) => {
                  const infEngagement = influencer.total_views > 0
                    ? ((influencer.total_likes + influencer.total_comments) / influencer.total_views * 100).toFixed(2)
                    : '0.00';
                  const contentLinks = influencer.content_links || [];
                  return (
                    <div key={influencer.assignment_id || influencer.id} className="assignment-card">
                      <div className="assignment-card-header">
                        <div className="influencer-cell">
                          <div className="influencer-avatar">{(influencer.name || 'U').charAt(0)}</div>
                          <div>
                            <div className="influencer-name">{influencer.name || 'Unknown'}</div>
                            <span className="platform-badge">
                              <span className={`platform-icon ${(influencer.platform || '').toLowerCase()}`}></span>
                              {influencer.platform || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="assignment-card-stats">
                          <span title="Followers">{formatNumber(influencer.followers || 0)} followers</span>
                          <span title="Content">{contentLinks.length} posts</span>
                          <span title="Views">{formatNumber(influencer.total_views || 0)} views</span>
                          <span title="Engagement">{infEngagement}% eng.</span>
                          {isCampaignManager() && (
                            <button className="btn-remove-inf" onClick={() => handleRemoveInfluencer(influencer.assignment_id)}>Remove</button>
                          )}
                        </div>
                      </div>

                      <div className="assignment-content-links">
                        <div className="content-links-header">
                          <span className="content-links-label">Content Links ({contentLinks.length})</span>
                          {isCampaignExecutor() && addingContentFor !== influencer.assignment_id && (
                            <button className="btn-edit-link" onClick={() => { setAddingContentFor(influencer.assignment_id); setNewContentUrl(''); setNewContentType('Post'); }}>
                              + Add Link
                            </button>
                          )}
                        </div>

                        {addingContentFor === influencer.assignment_id && (
                          <div className="add-content-form">
                            <select value={newContentType} onChange={(e) => setNewContentType(e.target.value)} style={{ maxWidth: '120px' }}>
                              <option value="Post">Post</option>
                              <option value="Reel">Reel</option>
                              <option value="Story">Story</option>
                              <option value="Video">Video</option>
                              <option value="Short">Short</option>
                            </select>
                            <input
                              type="url"
                              value={newContentUrl}
                              onChange={(e) => setNewContentUrl(e.target.value)}
                              placeholder="Enter content URL..."
                              style={{ flex: 1 }}
                            />
                            <button className="btn-save-action btn-sm" onClick={() => handleAddContent(influencer.assignment_id)} disabled={!newContentUrl.trim()}>Add</button>
                            <button className="btn-cancel-action btn-sm" onClick={() => setAddingContentFor(null)}>Cancel</button>
                          </div>
                        )}

                        {contentLinks.length > 0 ? (
                          <div className="content-links-list">
                            {contentLinks.map((content, cIdx) => (
                              <div key={content.id} className="content-link-row">
                                <span className="content-link-index">{cIdx + 1}.</span>
                                <span className="content-link-type">{content.content_type}</span>
                                {editingContentId === content.id ? (
                                  <div className="link-edit-inline" style={{ flex: 1 }}>
                                    <input type="url" value={editContentUrl} onChange={(e) => setEditContentUrl(e.target.value)} style={{ flex: 1 }} />
                                    <button className="btn-save-action btn-sm" onClick={() => handleUpdateContent(content.id)}>Save</button>
                                    <button className="btn-cancel-action btn-sm" onClick={() => setEditingContentId(null)}>Cancel</button>
                                  </div>
                                ) : (
                                  <>
                                    <a href={content.url || '#'} target="_blank" rel="noopener noreferrer" className="content-link-url">
                                      {(content.url || '').length > 50 ? content.url.substring(0, 50) + '...' : (content.url || 'No URL')}
                                    </a>
                                    {content.views > 0 && <span className="content-link-stat">{formatNumber(content.views)} views</span>}
                                    {isCampaignExecutor() && (
                                      <div className="content-link-actions">
                                        <button className="btn-edit-link" onClick={() => { setEditingContentId(content.id); setEditContentUrl(content.url); }}>Edit</button>
                                        <button className="btn-remove-inf" onClick={() => handleDeleteContent(content.id)}>Del</button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-content-links">No content links added yet</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>No influencers assigned to this campaign</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="content-section">
            <h3 className="section-title">All Content ({(campaign.content || []).length})</h3>
            {campaign.content && campaign.content.length > 0 ? (
              <div className="content-gallery">
                {campaign.content.map((content) => (
                <div key={content.id} className="gallery-card">
                  <div className="gallery-thumbnail">
                    <img src={content.thumbnail || 'https://placehold.co/400x300'} alt="" />
                  </div>
                  <div className="gallery-info">
                    <div className="gallery-creator">
                      <div className="creator-info">
                        <span className="creator-name">{content.influencer_name || content.influencer_username}</span>
                        <span className={`platform-badge-mini ${(content.platform || '').toLowerCase()}`}>
                          <span className={`platform-icon ${(content.platform || '').toLowerCase()}`}></span>
                          {content.content_type}
                        </span>
                      </div>
                      <span className="gallery-date">{formatDate(content.published_at)}</span>
                    </div>
                    <div className="gallery-stats-row">
                      <div className="stat-badge">
                        <span>👁</span>
                        <span>{formatNumber(content.views)}</span>
                      </div>
                      <div className="stat-badge">
                        <span>❤️</span>
                        <span>{formatNumber(content.likes)}</span>
                      </div>
                      <div className="stat-badge">
                        <span>💬</span>
                        <span>{formatNumber(content.comments)}</span>
                      </div>
                      <div className="stat-badge highlight">
                        <span>📈</span>
                        <span>{content.engagement_rate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No content available for this campaign</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CampaignDetail;