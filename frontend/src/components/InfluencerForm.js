import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './InfluencerForm.css';

function InfluencerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isManager } = useAuth();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    profile_pic: '',
    bio: '',
    city: '',
    state: '',
    country: 'India',

    // Instagram
    instagram_handle: '',
    instagram_followers: '',
    instagram_url: '',
    rate_per_post_instagram: '',
    rate_per_reel_instagram: '',
    rate_per_story_instagram: '',

    // YouTube
    youtube_handle: '',
    youtube_subscribers: '',
    youtube_url: '',
    rate_per_video_youtube: '',
    rate_per_short_youtube: '',

    // TikTok
    tiktok_handle: '',
    tiktok_followers: '',
    tiktok_url: '',

    // Twitter
    twitter_handle: '',
    twitter_followers: '',
    twitter_url: '',

    // Other
    categories: '',
    past_brands: '',
    worked_with_wrm: false,
    wrm_notes: '',
    currency: 'INR',
    status: 'active'
  });

  useEffect(() => {
    if (!isManager()) {
      navigate('/influencers');
      return;
    }

    if (isEditMode) {
      fetchInfluencer();
    }
  }, [id, isEditMode]);

  const fetchInfluencer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/influencers/${id}`);
      const inf = response.data;

      setFormData({
        name: inf.name || '',
        email: inf.email || '',
        phone: inf.phone || '',
        profile_pic: inf.profile_pic || '',
        bio: inf.bio || '',
        city: inf.city || '',
        state: inf.state || '',
        country: inf.country || 'India',

        instagram_handle: inf.instagram_handle || '',
        instagram_followers: inf.instagram_followers || '',
        instagram_url: inf.instagram_url || '',
        rate_per_post_instagram: inf.rate_per_post_instagram || '',
        rate_per_reel_instagram: inf.rate_per_reel_instagram || '',
        rate_per_story_instagram: inf.rate_per_story_instagram || '',

        youtube_handle: inf.youtube_handle || '',
        youtube_subscribers: inf.youtube_subscribers || '',
        youtube_url: inf.youtube_url || '',
        rate_per_video_youtube: inf.rate_per_video_youtube || '',
        rate_per_short_youtube: inf.rate_per_short_youtube || '',

        tiktok_handle: inf.tiktok_handle || '',
        tiktok_followers: inf.tiktok_followers || '',
        tiktok_url: inf.tiktok_url || '',

        twitter_handle: inf.twitter_handle || '',
        twitter_followers: inf.twitter_followers || '',
        twitter_url: inf.twitter_url || '',

        categories: (inf.categories || []).join(', '),
        past_brands: (inf.past_brands || []).join(', '),
        worked_with_wrm: inf.worked_with_wrm || false,
        wrm_notes: inf.wrm_notes || '',
        currency: inf.currency || 'INR',
        status: inf.status || 'active'
      });

      setError(null);
    } catch (err) {
      setError('Failed to load influencer data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare data for submission
      const submitData = {
        ...formData,
        instagram_followers: parseInt(formData.instagram_followers) || 0,
        youtube_subscribers: parseInt(formData.youtube_subscribers) || 0,
        tiktok_followers: parseInt(formData.tiktok_followers) || 0,
        twitter_followers: parseInt(formData.twitter_followers) || 0,
        rate_per_post_instagram: parseFloat(formData.rate_per_post_instagram) || null,
        rate_per_reel_instagram: parseFloat(formData.rate_per_reel_instagram) || null,
        rate_per_story_instagram: parseFloat(formData.rate_per_story_instagram) || null,
        rate_per_video_youtube: parseFloat(formData.rate_per_video_youtube) || null,
        rate_per_short_youtube: parseFloat(formData.rate_per_short_youtube) || null,
        categories: formData.categories.split(',').map(c => c.trim()).filter(Boolean),
        past_brands: formData.past_brands.split(',').map(b => b.trim()).filter(Boolean)
      };

      if (isEditMode) {
        await axios.put(`/api/influencers/${id}`, submitData);
      } else {
        await axios.post('/api/influencers', submitData);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/influencers');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save influencer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="influencer-form-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading influencer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="influencer-form-container">
      {/* Header */}
      <div className="form-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/influencers')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div>
            <h1>{isEditMode ? 'Edit Influencer' : 'Add New Influencer'}</h1>
            <p>{isEditMode ? 'Update influencer information' : 'Add a new influencer to your master list'}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="influencer-form">
        {error && (
          <div className="alert alert-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 6v4M10 13v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Influencer saved successfully! Redirecting...
          </div>
        )}

        {/* Basic Information */}
        <div className="form-section">
          <h2 className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Basic Information
          </h2>

          <div className="profile-pic-section">
            <div className="profile-pic-preview">
              {formData.profile_pic ? (
                <img src={formData.profile_pic} alt="Profile" />
              ) : (
                <span>{formData.name ? formData.name.charAt(0).toUpperCase() : '?'}</span>
              )}
            </div>
            <div className="profile-pic-input">
              <label>Profile Picture URL</label>
              <input
                type="url"
                name="profile_pic"
                value={formData.profile_pic}
                onChange={handleChange}
                placeholder="https://example.com/photo.jpg"
              />
              <span className="field-hint">Enter a direct URL to the influencer's profile photo</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group required">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter influencer name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@example.com"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Brief description about the influencer..."
                rows="3"
              />
            </div>

            <div className="form-group full-width">
              <label>Categories</label>
              <input
                type="text"
                name="categories"
                value={formData.categories}
                onChange={handleChange}
                placeholder="Fashion, Lifestyle, Beauty (comma-separated)"
              />
              <span className="field-hint">Separate multiple categories with commas</span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="form-section">
          <h2 className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C6.7 2 4 4.7 4 8c0 4 6 10 6 10s6-6 6-10c0-3.3-2.7-6-6-6z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Location
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Mumbai"
              />
            </div>

            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Maharashtra"
              />
            </div>

            <div className="form-group">
              <label>Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="India"
              />
            </div>
          </div>
        </div>

        {/* Instagram */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="platform-icon">📷</span>
            Instagram
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Handle</label>
              <input
                type="text"
                name="instagram_handle"
                value={formData.instagram_handle}
                onChange={handleChange}
                placeholder="@username"
              />
            </div>

            <div className="form-group">
              <label>Followers</label>
              <input
                type="number"
                name="instagram_followers"
                value={formData.instagram_followers}
                onChange={handleChange}
                placeholder="100000"
              />
            </div>

            <div className="form-group full-width">
              <label>Profile URL</label>
              <input
                type="url"
                name="instagram_url"
                value={formData.instagram_url}
                onChange={handleChange}
                placeholder="https://instagram.com/username"
              />
            </div>

            <div className="form-group">
              <label>Rate per Post ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_post_instagram"
                value={formData.rate_per_post_instagram}
                onChange={handleChange}
                placeholder="25000"
              />
            </div>

            <div className="form-group">
              <label>Rate per Reel ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_reel_instagram"
                value={formData.rate_per_reel_instagram}
                onChange={handleChange}
                placeholder="35000"
              />
            </div>

            <div className="form-group">
              <label>Rate per Story ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_story_instagram"
                value={formData.rate_per_story_instagram}
                onChange={handleChange}
                placeholder="10000"
              />
            </div>
          </div>
        </div>

        {/* YouTube */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="platform-icon">▶️</span>
            YouTube
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Channel Name</label>
              <input
                type="text"
                name="youtube_handle"
                value={formData.youtube_handle}
                onChange={handleChange}
                placeholder="Channel Name"
              />
            </div>

            <div className="form-group">
              <label>Subscribers</label>
              <input
                type="number"
                name="youtube_subscribers"
                value={formData.youtube_subscribers}
                onChange={handleChange}
                placeholder="50000"
              />
            </div>

            <div className="form-group full-width">
              <label>Channel URL</label>
              <input
                type="url"
                name="youtube_url"
                value={formData.youtube_url}
                onChange={handleChange}
                placeholder="https://youtube.com/@channelname"
              />
            </div>

            <div className="form-group">
              <label>Rate per Video ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_video_youtube"
                value={formData.rate_per_video_youtube}
                onChange={handleChange}
                placeholder="100000"
              />
            </div>

            <div className="form-group">
              <label>Rate per Short ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_short_youtube"
                value={formData.rate_per_short_youtube}
                onChange={handleChange}
                placeholder="20000"
              />
            </div>
          </div>
        </div>

        {/* TikTok */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="platform-icon">🎵</span>
            TikTok
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Handle</label>
              <input
                type="text"
                name="tiktok_handle"
                value={formData.tiktok_handle}
                onChange={handleChange}
                placeholder="@username"
              />
            </div>

            <div className="form-group">
              <label>Followers</label>
              <input
                type="number"
                name="tiktok_followers"
                value={formData.tiktok_followers}
                onChange={handleChange}
                placeholder="80000"
              />
            </div>

            <div className="form-group full-width">
              <label>Profile URL</label>
              <input
                type="url"
                name="tiktok_url"
                value={formData.tiktok_url}
                onChange={handleChange}
                placeholder="https://tiktok.com/@username"
              />
            </div>
          </div>
        </div>

        {/* Twitter */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="platform-icon">🐦</span>
            Twitter/X
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Handle</label>
              <input
                type="text"
                name="twitter_handle"
                value={formData.twitter_handle}
                onChange={handleChange}
                placeholder="@username"
              />
            </div>

            <div className="form-group">
              <label>Followers</label>
              <input
                type="number"
                name="twitter_followers"
                value={formData.twitter_followers}
                onChange={handleChange}
                placeholder="45000"
              />
            </div>

            <div className="form-group full-width">
              <label>Profile URL</label>
              <input
                type="url"
                name="twitter_url"
                value={formData.twitter_url}
                onChange={handleChange}
                placeholder="https://twitter.com/username"
              />
            </div>
          </div>
        </div>

        {/* Brand Collaborations */}
        <div className="form-section">
          <h2 className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Brand Collaborations
          </h2>

          <div className="form-grid">
            <div className="form-group full-width">
              <label>Past Brands</label>
              <input
                type="text"
                name="past_brands"
                value={formData.past_brands}
                onChange={handleChange}
                placeholder="Nike, Adidas, Puma (comma-separated)"
              />
              <span className="field-hint">Brands they've worked with in the past</span>
            </div>

            <div className="form-group full-width">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="worked_with_wrm"
                  checked={formData.worked_with_wrm}
                  onChange={handleChange}
                />
                <span>Worked with White Rivers Media</span>
              </label>
            </div>

            {formData.worked_with_wrm && (
              <div className="form-group full-width">
                <label>WRM Notes</label>
                <textarea
                  name="wrm_notes"
                  value={formData.wrm_notes}
                  onChange={handleChange}
                  placeholder="Internal notes about past collaborations..."
                  rows="3"
                />
              </div>
            )}
          </div>
        </div>

        {/* Currency */}
        <div className="form-section">
          <h2 className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 6v8M7 8h4.5a1.5 1.5 0 010 3H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Currency
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Currency</label>
              <select name="currency" value={formData.currency} onChange={handleChange}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/influencers')}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditMode ? 'Update Influencer' : 'Create Influencer'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default InfluencerForm;
