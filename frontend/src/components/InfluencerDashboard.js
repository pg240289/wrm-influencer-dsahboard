import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './InfluencerDashboard.css';

function InfluencerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('campaigns');
  const [profile, setProfile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});

  // Location master data
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  // Social account connection
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchData();
    fetchSocialAccounts();
    axios.get('/countries').then(res => setCountries(res.data)).catch(() => {});
  }, []);

  // Handle OAuth callback query params
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    if (oauthSuccess) {
      setSuccess(`${oauthSuccess.charAt(0).toUpperCase() + oauthSuccess.slice(1)} connected successfully!`);
      setTimeout(() => setSuccess(''), 5000);
      setSearchParams({});
      fetchSocialAccounts();
      fetchData();
    }
    if (oauthError) {
      setError(`OAuth error: ${oauthError.replace(/_/g, ' ')}`);
      setSearchParams({});
    }
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, campaignsRes] = await Promise.all([
        axios.get('/influencer/me'),
        axios.get('/influencer/me/campaigns')
      ]);
      const p = profileRes.data;
      setProfile(p);
      setCampaigns(campaignsRes.data);
      setProfileForm({
        bio: p.bio || '',
        phone: p.phone || '',
        profile_pic: p.profile_pic || '',
        country_id: p.country_id || '',
        state_id: p.state_id || '',
        city_id: p.city_id || '',
        instagram_handle: p.instagram_handle || '',
        instagram_url: p.instagram_url || '',
        youtube_handle: p.youtube_handle || '',
        youtube_url: p.youtube_url || '',
        facebook_handle: p.facebook_handle || '',
        facebook_url: p.facebook_url || '',
        twitter_handle: p.twitter_handle || '',
        twitter_url: p.twitter_url || '',
        linkedin_handle: p.linkedin_handle || '',
        linkedin_url: p.linkedin_url || '',
      });
      // Load states/cities for existing location
      if (p.country_id) {
        const statesRes = await axios.get(`/states?country_id=${p.country_id}`);
        setStates(statesRes.data);
        if (p.state_id) {
          const citiesRes = await axios.get(`/cities?state_id=${p.state_id}`);
          setCities(citiesRes.data);
        }
      }
    } catch (err) {
      setError('Failed to load data');
    }
    setLoading(false);
  };

  const handleCountryChange = async (countryId) => {
    setProfileForm(prev => ({ ...prev, country_id: countryId, state_id: '', city_id: '' }));
    setCities([]);
    if (countryId) {
      const res = await axios.get(`/states?country_id=${countryId}`);
      setStates(res.data);
    } else {
      setStates([]);
    }
  };

  const handleStateChange = async (stateId) => {
    setProfileForm(prev => ({ ...prev, state_id: stateId, city_id: '' }));
    if (stateId) {
      const res = await axios.get(`/cities?state_id=${stateId}`);
      setCities(res.data);
    } else {
      setCities([]);
    }
  };

  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const saveProfile = async () => {
    try {
      const res = await axios.put('/influencer/me', profileForm);
      setProfile(res.data);
      setEditingProfile(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const fetchSocialAccounts = async () => {
    try {
      const res = await axios.get('/influencer/me/social-accounts');
      setSocialAccounts(res.data);
    } catch (err) {
      // silently fail
    }
  };

  const handleConnectSocial = async (platform) => {
    setConnectingPlatform(platform);
    try {
      const res = await axios.post(`/auth/${platform}/connect`);
      window.location.href = res.data.auth_url;
    } catch (err) {
      setError(err.response?.data?.error || `Failed to connect ${platform}`);
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectSocial = async (accountId, platform) => {
    if (!window.confirm(`Disconnect ${platform}?`)) return;
    try {
      await axios.delete(`/influencer/me/social-accounts/${accountId}`);
      setSocialAccounts(prev => prev.filter(a => a.id !== accountId));
      setSuccess(`${platform} disconnected`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleRefreshStats = async (platform) => {
    try {
      await axios.post(`/influencer/me/refresh-${platform}-stats`);
      setSuccess(`${platform} stats refreshed`);
      setTimeout(() => setSuccess(''), 3000);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to refresh ${platform} stats`);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="inf-dash">
        <div className="inf-dash-loading">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="inf-dash">
      {/* Header */}
      <header className="inf-dash-header">
        <div className="inf-dash-header-left">
          <div className="inf-dash-avatar">
            {profile?.profile_pic ? (
              <img src={profile.profile_pic} alt={profile.name} />
            ) : (
              <span>{getInitials(profile?.name)}</span>
            )}
          </div>
          <div>
            <h1>{profile?.name || 'Influencer'}</h1>
            <p className="inf-dash-email">{user?.email}</p>
            {profile?.tier && <span className={`inf-dash-tier tier-${profile.tier?.toLowerCase()}`}>{profile.tier}</span>}
          </div>
        </div>
        <button className="inf-dash-logout" onClick={logout}>Logout</button>
      </header>

      {/* Alerts */}
      {error && <div className="inf-dash-alert inf-dash-alert-error">{error}<button onClick={() => setError('')}>x</button></div>}
      {success && <div className="inf-dash-alert inf-dash-alert-success">{success}<button onClick={() => setSuccess('')}>x</button></div>}

      {/* Stats */}
      <div className="inf-dash-stats">
        <div className="inf-dash-stat-card">
          <div className="inf-dash-stat-value">{new Set(campaigns.map(c => c.id)).size}</div>
          <div className="inf-dash-stat-label">Campaigns</div>
        </div>
        <div className="inf-dash-stat-card">
          <div className="inf-dash-stat-value">{formatNumber(profile?.instagram_followers)}</div>
          <div className="inf-dash-stat-label">Instagram</div>
        </div>
        <div className="inf-dash-stat-card">
          <div className="inf-dash-stat-value">{formatNumber(profile?.youtube_subscribers)}</div>
          <div className="inf-dash-stat-label">YouTube</div>
        </div>
        <div className="inf-dash-stat-card">
          <div className="inf-dash-stat-value">{formatNumber(profile?.facebook_followers)}</div>
          <div className="inf-dash-stat-label">Facebook</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inf-dash-tabs">
        <button className={activeTab === 'campaigns' ? 'active' : ''} onClick={() => setActiveTab('campaigns')}>
          My Campaigns
        </button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
          My Profile
        </button>
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (() => {
        // Group by campaign ID to show one card per campaign
        const grouped = {};
        campaigns.forEach(c => {
          const cid = c.id;
          if (!grouped[cid]) {
            grouped[cid] = { ...c, assignments: [] };
          }
          if (c.assignment) {
            grouped[cid].assignments.push(c.assignment);
          }
        });
        const uniqueCampaigns = Object.values(grouped);

        return (
          <div className="inf-dash-campaigns">
            {uniqueCampaigns.length === 0 ? (
              <div className="inf-dash-empty">No campaigns assigned yet.</div>
            ) : (
              uniqueCampaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className="inf-dash-campaign-card inf-dash-campaign-clickable"
                  onClick={() => navigate(`/influencer/campaign/${campaign.id}`)}
                >
                  <div className="inf-dash-campaign-header">
                    <div>
                      <h3>{campaign.campaign_name}</h3>
                      <p className="inf-dash-campaign-brand">{campaign.brand_name}</p>
                    </div>
                    <span className={`inf-dash-status status-${campaign.status}`}>{campaign.status}</span>
                  </div>

                  {campaign.description && <p className="inf-dash-campaign-desc">{campaign.description}</p>}

                  <div className="inf-dash-campaign-meta">
                    <span>Platform: <strong>{campaign.assignments.map(a => a.platform).join(', ') || 'N/A'}</strong></span>
                    <span>Start: <strong>{campaign.start_date}</strong></span>
                    {campaign.end_date && <span>End: <strong>{campaign.end_date}</strong></span>}
                  </div>

                  <div className="inf-dash-view-details">View Details &rsaquo;</div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {/* Profile Tab */}
      {activeTab === 'profile' && profile && (
        <div className="inf-dash-profile">
          <div className="inf-dash-profile-header">
            <h2>My Profile</h2>
            {!editingProfile ? (
              <button className="inf-dash-btn-edit" onClick={() => setEditingProfile(true)}>Edit Profile</button>
            ) : (
              <div>
                <button className="inf-dash-btn-save" onClick={saveProfile}>Save</button>
                <button className="inf-dash-btn-cancel" onClick={() => setEditingProfile(false)}>Cancel</button>
              </div>
            )}
          </div>

          <div className="inf-dash-profile-grid">
            <div className="inf-dash-profile-section">
              <h3>Basic Info</h3>
              <div className="inf-dash-field">
                <label>Name</label>
                <span>{profile.name}</span>
              </div>
              <div className="inf-dash-field">
                <label>Email</label>
                <span>{profile.email}</span>
              </div>
              <div className="inf-dash-field">
                <label>Phone</label>
                {editingProfile ? (
                  <input name="phone" value={profileForm.phone} onChange={handleProfileChange} />
                ) : (
                  <span>{profile.phone || '-'}</span>
                )}
              </div>
              <div className="inf-dash-field">
                <label>Bio</label>
                {editingProfile ? (
                  <textarea name="bio" value={profileForm.bio} onChange={handleProfileChange} rows="3" />
                ) : (
                  <span>{profile.bio || '-'}</span>
                )}
              </div>
            </div>

            <div className="inf-dash-profile-section">
              <h3>Location</h3>
              <div className="inf-dash-field">
                <label>Country</label>
                {editingProfile ? (
                  <select value={profileForm.country_id} onChange={(e) => handleCountryChange(e.target.value ? parseInt(e.target.value) : '')}>
                    <option value="">Select Country</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <span>{profile.country || '-'}</span>
                )}
              </div>
              <div className="inf-dash-field">
                <label>State</label>
                {editingProfile ? (
                  <select value={profileForm.state_id} onChange={(e) => handleStateChange(e.target.value ? parseInt(e.target.value) : '')} disabled={!profileForm.country_id}>
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <span>{profile.state || '-'}</span>
                )}
              </div>
              <div className="inf-dash-field">
                <label>City</label>
                {editingProfile ? (
                  <select value={profileForm.city_id} onChange={(e) => setProfileForm(prev => ({ ...prev, city_id: e.target.value ? parseInt(e.target.value) : '' }))} disabled={!profileForm.state_id}>
                    <option value="">Select City</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <span>{profile.city || '-'}</span>
                )}
              </div>
            </div>

            <div className="inf-dash-profile-section">
              <h3>Social Platforms</h3>
              {[
                { label: 'Instagram', handle: 'instagram_handle', url: 'instagram_url', connectable: true, key: 'instagram' },
                { label: 'YouTube', handle: 'youtube_handle', url: 'youtube_url', connectable: false, key: 'youtube' },
                { label: 'Facebook', handle: 'facebook_handle', url: 'facebook_url', connectable: true, key: 'facebook' },
                { label: 'Twitter/X', handle: 'twitter_handle', url: 'twitter_url', connectable: false, key: 'twitter' },
                { label: 'LinkedIn', handle: 'linkedin_handle', url: 'linkedin_url', connectable: false, key: 'linkedin' },
              ].map(platform => {
                const connectedAccount = socialAccounts.find(a => a.platform === platform.key);
                return (
                  <div key={platform.label} className="inf-dash-platform">
                    <strong>{platform.label}</strong>
                    {editingProfile ? (
                      <div className="inf-dash-platform-edit">
                        <input
                          name={platform.handle}
                          value={profileForm[platform.handle]}
                          onChange={handleProfileChange}
                          placeholder="Handle"
                        />
                        <input
                          name={platform.url}
                          value={profileForm[platform.url]}
                          onChange={handleProfileChange}
                          placeholder="Profile URL"
                        />
                      </div>
                    ) : (
                      <div className="inf-dash-platform-view">
                        <span>{profile[platform.handle] || '-'}</span>
                        {profile[platform.url] && (
                          <a href={profile[platform.url]} target="_blank" rel="noopener noreferrer">View</a>
                        )}
                      </div>
                    )}
                    {/* Connect/Disconnect for Instagram & Facebook */}
                    {platform.connectable && !editingProfile && (
                      <div className="inf-dash-platform-connect">
                        {connectedAccount ? (
                          <div className="inf-dash-connected-account">
                            <span className="inf-dash-connected">Connected{connectedAccount.platform_username ? `: @${connectedAccount.platform_username}` : connectedAccount.platform_name ? `: ${connectedAccount.platform_name}` : ''}</span>
                            <button className="inf-dash-btn-refresh" onClick={() => handleRefreshStats(platform.key)}>Refresh Stats</button>
                            <button className="inf-dash-btn-disconnect" onClick={() => handleDisconnectSocial(connectedAccount.id, platform.label)}>Disconnect</button>
                          </div>
                        ) : (
                          <button
                            className="inf-dash-btn-connect"
                            onClick={() => handleConnectSocial(platform.key)}
                            disabled={connectingPlatform === platform.key}
                          >
                            {connectingPlatform === platform.key ? 'Connecting...' : `Connect ${platform.label}`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InfluencerDashboard;
