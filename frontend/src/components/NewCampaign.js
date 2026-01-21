import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './NewCampaign.css';

function NewCampaign() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState([]);
  const [brands, setBrands] = useState([]);

  const [formData, setFormData] = useState({
    campaign_name: '',
    objective: '',
    brand: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    assigned_user_ids: []
  });

  useEffect(() => {
    // Fetch users, influencers, and brands for assignment
    const fetchData = async () => {
      try {
        // Fetch users
        const usersResponse = await axios.get('/users');
        setUsers(usersResponse.data.filter(u => u.is_active));

        // Fetch active influencers
        const influencersResponse = await axios.get('/influencers', {
          params: { status: 'active' }
        });
        setInfluencers(influencersResponse.data);

        // Fetch active brands
        const brandsResponse = await axios.get('/brands');
        setBrands(brandsResponse.data.filter(b => b.status === 'active'));
      } catch (err) {
        console.log('Could not fetch data for assignment');
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserAssignment = (userId) => {
    setFormData(prev => {
      const currentAssignments = prev.assigned_user_ids;
      if (currentAssignments.includes(userId)) {
        return {
          ...prev,
          assigned_user_ids: currentAssignments.filter(id => id !== userId)
        };
      } else {
        return {
          ...prev,
          assigned_user_ids: [...currentAssignments, userId]
        };
      }
    });
  };

  const handleInfluencerSelection = (influencerId, platform) => {
    setSelectedInfluencers(prev => {
      const existing = prev.find(item =>
        item.influencer_id === influencerId && item.platform === platform
      );

      if (existing) {
        // Remove this influencer-platform combo
        return prev.filter(item =>
          !(item.influencer_id === influencerId && item.platform === platform)
        );
      } else {
        // Add new influencer-platform combo
        return [...prev, { influencer_id: influencerId, platform }];
      }
    });
  };

  const isInfluencerSelected = (influencerId, platform) => {
    return selectedInfluencers.some(item =>
      item.influencer_id === influencerId && item.platform === platform
    );
  };

  const getPlatformsForInfluencer = (influencer) => {
    const platforms = [];
    if (influencer.instagram_followers > 0) platforms.push('Instagram');
    if (influencer.youtube_subscribers > 0) platforms.push('YouTube');
    if (influencer.tiktok_followers > 0) platforms.push('TikTok');
    if (influencer.twitter_followers > 0) platforms.push('Twitter');
    return platforms;
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const validateForm = () => {
    if (!formData.campaign_name.trim()) {
      setError('Campaign name is required');
      return false;
    }
    if (!formData.objective.trim()) {
      setError('Objective is required');
      return false;
    }
    if (!formData.brand) {
      setError('Brand is required');
      return false;
    }
    if (!formData.start_date) {
      setError('Start date is required');
      return false;
    }
    if (formData.end_date && formData.start_date > formData.end_date) {
      setError('End date must be after start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare payload - only send assigned_user_ids if there are any
      const payload = {
        campaign_name: formData.campaign_name,
        objective: formData.objective,
        brand: parseInt(formData.brand),
        description: formData.description,
        status: formData.status,
        start_date: formData.start_date,
        end_date: formData.end_date || null
      };

      // Only include assigned_user_ids if user selected some
      if (formData.assigned_user_ids.length > 0) {
        payload.assigned_user_ids = formData.assigned_user_ids;
      }

      // Include influencer selections if any
      if (selectedInfluencers.length > 0) {
        payload.influencer_assignments = selectedInfluencers;
      }

      const response = await axios.post('/campaigns', payload);

      // Redirect to the newly created campaign detail page
      navigate(`/campaign/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create campaign. Please try again.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="new-campaign-container">
      <div className="new-campaign-header">
        <div className="header-left">
          <button className="btn-back" onClick={handleCancel}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div>
            <h1>Create New Campaign</h1>
            <p>Set up a new influencer marketing campaign</p>
          </div>
        </div>
      </div>

      <div className="new-campaign-content">
        {error && (
          <div className="alert-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 6v4M10 13v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {error}
            <button className="alert-close" onClick={() => setError('')}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="campaign-form">
          {/* Basic Information Section */}
          <div className="form-section">
            <div className="section-header">
              <h2>Basic Information</h2>
              <p>Enter the core details about your campaign</p>
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="campaign_name">
                  Campaign Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="campaign_name"
                  name="campaign_name"
                  value={formData.campaign_name}
                  onChange={handleChange}
                  placeholder="e.g., Summer Product Launch 2025"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="brand">
                  Brand <span className="required">*</span>
                </label>
                <select
                  id="brand"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select brand...</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="objective">
                  Campaign Objective <span className="required">*</span>
                </label>
                <select
                  id="objective"
                  name="objective"
                  value={formData.objective}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select objective...</option>
                  <option value="Brand Awareness">Brand Awareness</option>
                  <option value="Product Launch">Product Launch</option>
                  <option value="Engagement">Engagement</option>
                  <option value="Lead Generation">Lead Generation</option>
                  <option value="Sales Conversion">Sales Conversion</option>
                  <option value="Content Creation">Content Creation</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the campaign goals, target audience, and key messaging..."
                  rows="4"
                />
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="form-section">
            <div className="section-header">
              <h2>Campaign Timeline</h2>
              <p>Define when your campaign will run</p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="start_date">
                  Start Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_date">
                  End Date
                </label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date}
                />
              </div>

              <div className="form-group">
                <label htmlFor="status">
                  Status <span className="required">*</span>
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Assignment Section (Admin Only) */}
          {users.length > 0 && (
            <div className="form-section">
              <div className="section-header">
                <h2>Assign Team Members</h2>
                <p>Select users who can access this campaign (you will be automatically assigned)</p>
              </div>

              <div className="users-assignment-grid">
                {users.map(u => (
                  <label key={u.id} className="user-assignment-card">
                    <input
                      type="checkbox"
                      checked={formData.assigned_user_ids.includes(u.id)}
                      onChange={() => handleUserAssignment(u.id)}
                    />
                    <div className="user-card-content">
                      <div className="user-avatar-small">
                        {(u.first_name || u.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <div className="user-name">{u.first_name} {u.last_name}</div>
                        <div className="user-email">{u.email}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Influencer Selection Section */}
          {influencers.length > 0 && (
            <div className="form-section">
              <div className="section-header">
                <h2>Select Influencers (Optional)</h2>
                <p>Choose influencers and platforms for this campaign</p>
              </div>

              <div className="influencers-assignment-grid">
                {influencers.map(inf => {
                  const platforms = getPlatformsForInfluencer(inf);
                  if (platforms.length === 0) return null;

                  return (
                    <div key={inf.id} className="influencer-assignment-container">
                      <div className="influencer-header-info">
                        <div className="user-avatar-small">
                          {inf.profile_pic ? (
                            <img src={inf.profile_pic} alt={inf.name} />
                          ) : (
                            inf.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="influencer-info">
                          <div className="influencer-name">{inf.name}</div>
                          <div
                            className="influencer-tier-badge"
                            style={{
                              backgroundColor:
                                inf.tier === 'Mega' ? '#8b5cf6' :
                                inf.tier === 'Macro' ? '#3b82f6' :
                                inf.tier === 'Micro' ? '#10b981' : '#6b7280'
                            }}
                          >
                            {inf.tier}
                          </div>
                        </div>
                      </div>

                      <div className="platform-checkboxes">
                        {platforms.map(platform => (
                          <label key={platform} className="platform-checkbox-label">
                            <input
                              type="checkbox"
                              checked={isInfluencerSelected(inf.id, platform)}
                              onChange={() => handleInfluencerSelection(inf.id, platform)}
                            />
                            <span className="platform-name">{platform}</span>
                            <span className="platform-followers">
                              {platform === 'Instagram' && formatNumber(inf.instagram_followers)}
                              {platform === 'YouTube' && formatNumber(inf.youtube_subscribers)}
                              {platform === 'TikTok' && formatNumber(inf.tiktok_followers)}
                              {platform === 'Twitter' && formatNumber(inf.twitter_followers)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedInfluencers.length > 0 && (
                <div className="selection-summary">
                  ✓ {selectedInfluencers.length} influencer-platform combination(s) selected
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Create Campaign
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewCampaign;
