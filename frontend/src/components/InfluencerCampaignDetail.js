import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './InfluencerCampaignDetail.css';

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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="inf-cd-tooltip">
        <p className="inf-cd-tooltip-label">{formatDate(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: '2px 0', fontSize: '13px' }}>
            {`${entry.name || entry.dataKey}: ${formatNumber(entry.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function InfluencerCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Chart modes
  const [viewsMode, setViewsMode] = useState('cumulative');
  const [likesMode, setLikesMode] = useState('cumulative');
  const [commentsMode, setCommentsMode] = useState('cumulative');

  // Content link state
  const [addingContentFor, setAddingContentFor] = useState(null);
  const [newContentType, setNewContentType] = useState('Post');
  const [newContentUrl, setNewContentUrl] = useState('');
  const [editingContentId, setEditingContentId] = useState(null);
  const [editContentUrl, setEditContentUrl] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignRes, analyticsRes] = await Promise.all([
        axios.get(`/influencer/me/campaign/${id}`),
        axios.get(`/influencer/me/campaign/${id}/analytics`)
      ]);
      setCampaign(campaignRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load campaign details');
    }
    setLoading(false);
  };

  const calculateCumulative = (data, key) => {
    let runningTotal = 0;
    return data.map(item => {
      runningTotal += item[key];
      return { ...item, [key]: runningTotal };
    });
  };

  const getChartData = (mode, dataKey) => {
    if (!analytics || !analytics.daily_metrics) return [];
    if (mode === 'cumulative') {
      return calculateCumulative(analytics.daily_metrics, dataKey);
    }
    return analytics.daily_metrics;
  };

  const handleAddContent = async (assignmentId) => {
    if (!newContentUrl.trim()) return;
    try {
      const res = await axios.post(`/influencer/me/assignments/${assignmentId}/content`, {
        content_type: newContentType,
        url: newContentUrl.trim()
      });
      setCampaign(prev => ({
        ...prev,
        assignments: prev.assignments.map(a =>
          a.id === assignmentId
            ? { ...a, content_links: [...(a.content_links || []), res.data] }
            : a
        )
      }));
      setNewContentType('Post');
      setNewContentUrl('');
      setAddingContentFor(null);
      setSuccess('Content link added');
      setTimeout(() => setSuccess(''), 3000);
      // Refresh analytics
      axios.get(`/influencer/me/campaign/${id}/analytics`).then(r => setAnalytics(r.data)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add content link');
    }
  };

  const handleUpdateContent = async (assignmentId, contentId) => {
    if (!editContentUrl.trim()) return;
    try {
      await axios.put(`/influencer/me/content/${contentId}`, { url: editContentUrl.trim() });
      setCampaign(prev => ({
        ...prev,
        assignments: prev.assignments.map(a =>
          a.id === assignmentId
            ? { ...a, content_links: (a.content_links || []).map(cl => cl.id === contentId ? { ...cl, url: editContentUrl.trim() } : cl) }
            : a
        )
      }));
      setEditingContentId(null);
      setEditContentUrl('');
      setSuccess('Content link updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update content link');
    }
  };

  const handleDeleteContent = async (assignmentId, contentId) => {
    if (!window.confirm('Delete this content link?')) return;
    try {
      await axios.delete(`/influencer/me/content/${contentId}`);
      setCampaign(prev => ({
        ...prev,
        assignments: prev.assignments.map(a =>
          a.id === assignmentId
            ? { ...a, content_links: (a.content_links || []).filter(cl => cl.id !== contentId) }
            : a
        )
      }));
      setSuccess('Content link deleted');
      setTimeout(() => setSuccess(''), 3000);
      axios.get(`/influencer/me/campaign/${id}/analytics`).then(r => setAnalytics(r.data)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete content link');
    }
  };

  if (loading) {
    return <div className="inf-campaign-detail"><div className="inf-cd-loading">Loading campaign details...</div></div>;
  }

  if (!campaign) {
    return (
      <div className="inf-campaign-detail">
        <div className="inf-cd-error-page">
          <p>{error || 'Campaign not found'}</p>
          <button className="inf-cd-btn-back" onClick={() => navigate('/influencer/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const assignments = campaign.assignments || [];

  return (
    <div className="inf-campaign-detail">
      {/* Header */}
      <div className="inf-cd-header">
        <button className="inf-cd-btn-back" onClick={() => navigate('/influencer/dashboard')}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div>
          <h1>{campaign.campaign_name}</h1>
          <p className="inf-cd-brand">{campaign.brand_name}</p>
        </div>
        <span className={`inf-cd-status status-${campaign.status}`}>{campaign.status}</span>
      </div>

      {/* Alerts */}
      {error && <div className="inf-cd-alert inf-cd-alert-error">{error}<button onClick={() => setError('')}>x</button></div>}
      {success && <div className="inf-cd-alert inf-cd-alert-success">{success}<button onClick={() => setSuccess('')}>x</button></div>}

      {/* Stats Cards */}
      <div className="inf-cd-stats-grid">
        <div className="inf-cd-stat-card">
          <div className="inf-cd-stat-icon">📦</div>
          <div className="inf-cd-stat-info">
            <div className="inf-cd-stat-value">{campaign.my_total_content || 0}</div>
            <div className="inf-cd-stat-label">Content Pieces</div>
          </div>
        </div>
        <div className="inf-cd-stat-card">
          <div className="inf-cd-stat-icon">👁️</div>
          <div className="inf-cd-stat-info">
            <div className="inf-cd-stat-value">{formatNumber(campaign.my_total_views)}</div>
            <div className="inf-cd-stat-label">Total Views</div>
          </div>
        </div>
        <div className="inf-cd-stat-card">
          <div className="inf-cd-stat-icon">❤️</div>
          <div className="inf-cd-stat-info">
            <div className="inf-cd-stat-value">{formatNumber(campaign.my_total_likes)}</div>
            <div className="inf-cd-stat-label">Total Likes</div>
          </div>
        </div>
        <div className="inf-cd-stat-card">
          <div className="inf-cd-stat-icon">💬</div>
          <div className="inf-cd-stat-info">
            <div className="inf-cd-stat-value">{formatNumber(campaign.my_total_comments)}</div>
            <div className="inf-cd-stat-label">Total Comments</div>
          </div>
        </div>
        <div className="inf-cd-stat-card">
          <div className="inf-cd-stat-icon">🔄</div>
          <div className="inf-cd-stat-info">
            <div className="inf-cd-stat-value">{formatNumber(campaign.my_total_shares)}</div>
            <div className="inf-cd-stat-label">Total Shares</div>
          </div>
        </div>
        <div className="inf-cd-stat-card">
          <div className="inf-cd-stat-icon">📈</div>
          <div className="inf-cd-stat-info">
            <div className="inf-cd-stat-value">{campaign.my_engagement_rate || 0}%</div>
            <div className="inf-cd-stat-label">Engagement Rate</div>
          </div>
        </div>
      </div>

      {/* Campaign Info */}
      <div className="inf-cd-info">
        {campaign.description && <p className="inf-cd-desc">{campaign.description}</p>}
        <div className="inf-cd-meta">
          <div className="inf-cd-meta-item">
            <span className="inf-cd-meta-label">Start Date</span>
            <span className="inf-cd-meta-value">{formatDate(campaign.start_date)}</span>
          </div>
          {campaign.end_date && (
            <div className="inf-cd-meta-item">
              <span className="inf-cd-meta-label">End Date</span>
              <span className="inf-cd-meta-value">{formatDate(campaign.end_date)}</span>
            </div>
          )}
          <div className="inf-cd-meta-item">
            <span className="inf-cd-meta-label">Platforms</span>
            <span className="inf-cd-meta-value">{assignments.map(a => a.platform).join(', ') || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inf-cd-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
          Performance
        </button>
        <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>
          My Content
        </button>
        <button className={activeTab === 'top' ? 'active' : ''} onClick={() => setActiveTab('top')}>
          Top Performers
        </button>
      </div>

      {/* Performance Tab */}
      {activeTab === 'overview' && (
        <div className="inf-cd-charts-section">
          {/* Views Chart */}
          <div className="inf-cd-chart-card">
            <div className="inf-cd-chart-header">
              <h3>Views Over Time</h3>
              <div className="inf-cd-chart-toggle">
                <button className={viewsMode === 'cumulative' ? 'active' : ''} onClick={() => setViewsMode('cumulative')}>Cumulative</button>
                <button className={viewsMode === 'daily' ? 'active' : ''} onClick={() => setViewsMode('daily')}>Daily</button>
              </div>
            </div>
            {getChartData(viewsMode, 'views').length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={getChartData(viewsMode, 'views')}>
                  <defs>
                    <linearGradient id="infViewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#667eea" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" stroke="#999" fontSize={12} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                  <YAxis stroke="#999" fontSize={12} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="views" stroke="#667eea" strokeWidth={2.5} fill="url(#infViewsGradient)" dot={{ r: 4, fill: '#667eea', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="inf-cd-chart-empty">
                <p>No views data available yet</p>
              </div>
            )}
          </div>

          {/* Likes & Comments Charts */}
          <div className="inf-cd-charts-row">
            <div className="inf-cd-chart-card">
              <div className="inf-cd-chart-header">
                <h3>Likes</h3>
                <div className="inf-cd-chart-toggle">
                  <button className={likesMode === 'cumulative' ? 'active' : ''} onClick={() => setLikesMode('cumulative')}>Cumulative</button>
                  <button className={likesMode === 'daily' ? 'active' : ''} onClick={() => setLikesMode('daily')}>Daily</button>
                </div>
              </div>
              {getChartData(likesMode, 'likes').length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={getChartData(likesMode, 'likes')}>
                    <defs>
                      <linearGradient id="infLikesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E94196" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#E94196" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="date" stroke="#999" fontSize={11} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                    <YAxis stroke="#999" fontSize={11} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="likes" stroke="#E94196" strokeWidth={2.5} fill="url(#infLikesGradient)" dot={{ r: 3, fill: '#E94196', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="inf-cd-chart-empty"><p>No likes data available</p></div>
              )}
            </div>

            <div className="inf-cd-chart-card">
              <div className="inf-cd-chart-header">
                <h3>Comments</h3>
                <div className="inf-cd-chart-toggle">
                  <button className={commentsMode === 'cumulative' ? 'active' : ''} onClick={() => setCommentsMode('cumulative')}>Cumulative</button>
                  <button className={commentsMode === 'daily' ? 'active' : ''} onClick={() => setCommentsMode('daily')}>Daily</button>
                </div>
              </div>
              {getChartData(commentsMode, 'comments').length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={getChartData(commentsMode, 'comments')}>
                    <defs>
                      <linearGradient id="infCommentsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="date" stroke="#999" fontSize={11} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                    <YAxis stroke="#999" fontSize={11} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="comments" stroke="#10b981" strokeWidth={2.5} fill="url(#infCommentsGradient)" dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="inf-cd-chart-empty"><p>No comments data available</p></div>
              )}
            </div>
          </div>

          {/* Publishing Timeline */}
          {analytics && analytics.daily_metrics && analytics.daily_metrics.length > 0 && (
            <div className="inf-cd-chart-card">
              <div className="inf-cd-chart-header">
                <h3>Publishing Timeline</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.daily_metrics}>
                  <defs>
                    <linearGradient id="infBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#667eea" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#764ba2" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" stroke="#999" fontSize={12} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                  <YAxis stroke="#999" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="content_count" fill="url(#infBarGradient)" radius={[8, 8, 0, 0]} name="Posts" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="inf-cd-content-tab">
          {assignments.map(assignment => {
            const contentLinks = assignment.content_links || [];
            return (
              <div key={assignment.id} className="inf-cd-content-section">
                <div className="inf-cd-content-header">
                  <h2>
                    <span className="inf-cd-platform-badge">{assignment.platform}</span>
                    Content Links ({contentLinks.length})
                  </h2>
                  <button className="inf-cd-btn-add" onClick={() => {
                    setAddingContentFor(addingContentFor === assignment.id ? null : assignment.id);
                    setNewContentType('Post');
                    setNewContentUrl('');
                  }}>
                    + Add Content
                  </button>
                </div>

                {/* Assignment Stats */}
                <div className="inf-cd-assignment-stats">
                  <span>{formatNumber(assignment.total_views || 0)} views</span>
                  <span>{formatNumber(assignment.total_likes || 0)} likes</span>
                  <span>{formatNumber(assignment.total_comments || 0)} comments</span>
                  <span>{formatNumber(assignment.followers || 0)} followers</span>
                  {assignment.agreed_amount && <span>Amount: {assignment.agreed_amount}</span>}
                  <span>Status: {assignment.status || 'pending'}</span>
                </div>

                {addingContentFor === assignment.id && (
                  <div className="inf-cd-add-form">
                    <select value={newContentType} onChange={(e) => setNewContentType(e.target.value)}>
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
                      placeholder="Enter content URL"
                    />
                    <button className="inf-cd-btn-save" onClick={() => handleAddContent(assignment.id)}>Save</button>
                    <button className="inf-cd-btn-cancel" onClick={() => setAddingContentFor(null)}>Cancel</button>
                  </div>
                )}

                {contentLinks.length === 0 ? (
                  <p className="inf-cd-empty">No content links added yet. Click "+ Add Content" to add your first link.</p>
                ) : (
                  <div className="inf-cd-content-list">
                    {contentLinks.map(cl => (
                      <div key={cl.id} className="inf-cd-content-row">
                        <span className="inf-cd-content-type">{cl.content_type}</span>
                        {editingContentId === cl.id ? (
                          <div className="inf-cd-edit-inline">
                            <input
                              type="url"
                              value={editContentUrl}
                              onChange={(e) => setEditContentUrl(e.target.value)}
                            />
                            <button className="inf-cd-btn-save" onClick={() => handleUpdateContent(assignment.id, cl.id)}>Save</button>
                            <button className="inf-cd-btn-cancel" onClick={() => setEditingContentId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <a href={cl.url || '#'} target="_blank" rel="noopener noreferrer" className="inf-cd-content-url">
                              {(cl.url || '').length > 50 ? cl.url.substring(0, 50) + '...' : (cl.url || 'No URL')}
                            </a>
                            <div className="inf-cd-content-metrics">
                              {(cl.views || 0) > 0 && <span className="inf-cd-metric">{formatNumber(cl.views)} views</span>}
                              {(cl.likes || 0) > 0 && <span className="inf-cd-metric">{formatNumber(cl.likes)} likes</span>}
                              {(cl.comments || 0) > 0 && <span className="inf-cd-metric">{formatNumber(cl.comments)} comments</span>}
                            </div>
                            <div className="inf-cd-content-actions">
                              <button className="inf-cd-btn-edit" onClick={() => { setEditingContentId(cl.id); setEditContentUrl(cl.url); }}>Edit</button>
                              <button className="inf-cd-btn-delete" onClick={() => handleDeleteContent(assignment.id, cl.id)}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Top Performers Tab */}
      {activeTab === 'top' && (
        <div className="inf-cd-top-section">
          <h3 className="inf-cd-section-title">Top Performing Content</h3>
          {analytics && analytics.top_performers && analytics.top_performers.length > 0 ? (
            <div className="inf-cd-top-list">
              {analytics.top_performers.map((content, idx) => (
                <div key={content.id} className="inf-cd-top-card">
                  <div className="inf-cd-top-rank">#{idx + 1}</div>
                  <div className="inf-cd-top-info">
                    <div className="inf-cd-top-header-row">
                      <span className="inf-cd-platform-badge">{content.platform}</span>
                      <span className="inf-cd-content-type">{content.content_type}</span>
                      {content.published_at && <span className="inf-cd-top-date">{formatDate(content.published_at)}</span>}
                    </div>
                    {content.url && (
                      <a href={content.url} target="_blank" rel="noopener noreferrer" className="inf-cd-top-url">
                        {content.url.length > 60 ? content.url.substring(0, 60) + '...' : content.url}
                      </a>
                    )}
                    <div className="inf-cd-top-stats">
                      <span>{formatNumber(content.views)} views</span>
                      <span>{formatNumber(content.likes)} likes</span>
                      <span>{formatNumber(content.comments)} comments</span>
                      {content.engagement_rate > 0 && <span>{content.engagement_rate}% eng.</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="inf-cd-chart-empty">
              <p>No content performance data available yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InfluencerCampaignDetail;
