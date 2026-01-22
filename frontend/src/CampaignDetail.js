import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './CampaignDetail.css';

// Utility functions
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  if(num)
   return num.toString(); 
  else 
  return null;
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
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewsMode, setViewsMode] = useState('cumulative');
  const [likesMode, setLikesMode] = useState('cumulative');
  const [commentsMode, setCommentsMode] = useState('cumulative');

  useEffect(() => {
    fetchCampaignData();
  }, [id]);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [campaignRes, analyticsRes] = await Promise.all([
        axios.get(`/campaigns/${id}`),
        axios.get(`/campaigns/${id}/analytics`)
      ]);
      setCampaign(campaignRes.data);
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
              <ResponsiveContainer width="100%" height={300}>
                {getChartData(viewsMode, 'views').length > 0 ? (
                  <LineChart data={getChartData(viewsMode, 'views')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#999" 
                      fontSize={12}
                      tickFormatter={(value) => formatDate(value)}
                    />
                    <YAxis 
                      stroke="#999" 
                      fontSize={12}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="views" 
                      stroke="#E94196" 
                      strokeWidth={2} 
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                ) : (
                  <div className="chart-empty-state">
                    <p>No data available for this period</p>
                  </div>
                )}
              </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={250}>
                  {getChartData(likesMode, 'likes').length > 0 ? (
                    <LineChart data={getChartData(likesMode, 'likes')}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#999" 
                        fontSize={12}
                        tickFormatter={(value) => formatDate(value)}
                      />
                      <YAxis 
                        stroke="#999" 
                        fontSize={12}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="likes" 
                        stroke="#E94196" 
                        strokeWidth={2} 
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  ) : (
                    <div className="chart-empty-state">
                      <p>No data available</p>
                    </div>
                  )}
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={250}>
                  {getChartData(commentsMode, 'comments').length > 0 ? (
                    <LineChart data={getChartData(commentsMode, 'comments')}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#999" 
                        fontSize={12}
                        tickFormatter={(value) => formatDate(value)}
                      />
                      <YAxis 
                        stroke="#999" 
                        fontSize={12}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="comments" 
                        stroke="#E94196" 
                        strokeWidth={2} 
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  ) : (
                    <div className="chart-empty-state">
                      <p>No data available</p>
                    </div>
                  )}
                </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={400}>
                {analytics.daily_metrics && analytics.daily_metrics.length > 0 ? (
                  <BarChart data={analytics.daily_metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#999" 
                      fontSize={12}
                      tickFormatter={(value) => formatDate(value)}
                    />
                    <YAxis stroke="#999" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="content_count" fill="#E94196" radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : (
                  <div className="chart-empty-state">
                    <p>No publishing data available</p>
                  </div>
                )}
              </ResponsiveContainer>
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
                    <img src={content.thumbnail || 'https://via.placeholder.com/400x300'} alt="" />
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
            <h3 className="section-title">Influencers ({campaign.influencers.length})</h3>
            {campaign.influencers && campaign.influencers.length > 0 ? (
              <div className="influencers-table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Platform</th>
                      <th>Followers</th>
                      <th>Content</th>
                      <th>Views</th>
                      <th>Likes</th>
                      <th>Comments</th>
                      <th>Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.influencers.map((influencer, idx) => {
                      const infEngagement = influencer.total_views > 0
                        ? ((influencer.total_likes + influencer.total_comments) / influencer.total_views * 100).toFixed(2)
                        : '0.00';
                      return (
                    <tr key={influencer.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="influencer-cell">
                          <div className="influencer-avatar">
                            {influencer.name.charAt(0)}
                          </div>
                          <div>
                            <div className="influencer-name">{influencer.name}</div>
                            <div className="influencer-username">{influencer.username}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="platform-badge">
                          <span className={`platform-icon ${influencer.platform.toLowerCase()}`}></span>
                          {influencer.platform}
                        </span>
                      </td>
                      <td>{formatNumber(influencer.followers)}</td>
                      <td>{influencer.total_content}</td>
                      <td>{formatNumber(influencer.total_views)}</td>
                      <td>{formatNumber(influencer.total_likes)}</td>
                      <td>{formatNumber(influencer.total_comments)}</td>
                      <td>
                        <span className="engagement-badge">{infEngagement}%</span>
                      </td>
                    </tr>
                      );
                    })}
                  </tbody>
                </table>
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
            <h3 className="section-title">All Content ({campaign.content.length})</h3>
            {campaign.content && campaign.content.length > 0 ? (
              <div className="content-gallery">
                {campaign.content.map((content) => (
                <div key={content.id} className="gallery-card">
                  <div className="gallery-thumbnail">
                    <img src={content.thumbnail || 'https://via.placeholder.com/400x300'} alt="" />
                  </div>
                  <div className="gallery-info">
                    <div className="gallery-creator">
                      <div className="creator-info">
                        <span className="creator-name">{content.influencer_username}</span>
                        <span className={`platform-badge-mini ${content.platform.toLowerCase()}`}>
                          <span className={`platform-icon ${content.platform.toLowerCase()}`}></span>
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