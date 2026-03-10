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
  const [successMessage, setSuccessMessage] = useState('');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Location master data
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

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

    // Facebook
    facebook_handle: '',
    facebook_followers: '',
    facebook_url: '',
    rate_per_post_facebook: '',
    rate_per_reel_facebook: '',
    rate_per_story_facebook: '',

    // LinkedIn
    linkedin_handle: '',
    linkedin_followers: '',
    linkedin_url: '',
    rate_per_post_linkedin: '',

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

    // Fetch categories and countries from API
    axios.get('/categories').then(res => {
      setAvailableCategories(res.data);
    }).catch(() => {});

    axios.get('/countries').then(res => {
      setCountries(res.data);
    }).catch(() => {});

    if (isEditMode) {
      fetchInfluencer();
    }
  }, [id, isEditMode]);

  // Cascading: fetch states when country changes
  useEffect(() => {
    if (selectedCountryId) {
      axios.get(`/states?country_id=${selectedCountryId}`).then(res => {
        setStates(res.data);
      }).catch(() => setStates([]));
    } else {
      setStates([]);
    }
    setSelectedStateId('');
    setSelectedCityId('');
    setCities([]);
  }, [selectedCountryId]);

  // Cascading: fetch cities when state changes
  useEffect(() => {
    if (selectedStateId) {
      axios.get(`/cities?state_id=${selectedStateId}`).then(res => {
        setCities(res.data);
      }).catch(() => setCities([]));
    } else {
      setCities([]);
    }
    setSelectedCityId('');
  }, [selectedStateId]);

  const fetchInfluencer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/influencers/${id}`);
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

        facebook_handle: inf.facebook_handle || '',
        facebook_followers: inf.facebook_followers || '',
        facebook_url: inf.facebook_url || '',
        rate_per_post_facebook: inf.rate_per_post_facebook || '',
        rate_per_reel_facebook: inf.rate_per_reel_facebook || '',
        rate_per_story_facebook: inf.rate_per_story_facebook || '',

        linkedin_handle: inf.linkedin_handle || '',
        linkedin_followers: inf.linkedin_followers || '',
        linkedin_url: inf.linkedin_url || '',
        rate_per_post_linkedin: inf.rate_per_post_linkedin || '',

        twitter_handle: inf.twitter_handle || '',
        twitter_followers: inf.twitter_followers || '',
        twitter_url: inf.twitter_url || '',

        categories: '',  // managed separately via selectedCategories
        past_brands: (inf.past_brands || []).join(', '),
        worked_with_wrm: inf.worked_with_wrm || false,
        wrm_notes: inf.wrm_notes || '',
        currency: inf.currency || 'INR',
        status: inf.status || 'active'
      });

      setSelectedCategories(inf.categories || []);

      // Set location IDs and load dependent dropdowns
      if (inf.country_id) {
        setSelectedCountryId(inf.country_id);
        const statesRes = await axios.get(`/states?country_id=${inf.country_id}`);
        setStates(statesRes.data);
        if (inf.state_id) {
          setSelectedStateId(inf.state_id);
          const citiesRes = await axios.get(`/cities?state_id=${inf.state_id}`);
          setCities(citiesRes.data);
          if (inf.city_id) {
            setSelectedCityId(inf.city_id);
          }
        }
      }

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
        facebook_followers: parseInt(formData.facebook_followers) || 0,
        linkedin_followers: parseInt(formData.linkedin_followers) || 0,
        twitter_followers: parseInt(formData.twitter_followers) || 0,
        rate_per_post_instagram: parseFloat(formData.rate_per_post_instagram) || null,
        rate_per_reel_instagram: parseFloat(formData.rate_per_reel_instagram) || null,
        rate_per_story_instagram: parseFloat(formData.rate_per_story_instagram) || null,
        rate_per_video_youtube: parseFloat(formData.rate_per_video_youtube) || null,
        rate_per_short_youtube: parseFloat(formData.rate_per_short_youtube) || null,
        rate_per_post_facebook: parseFloat(formData.rate_per_post_facebook) || null,
        rate_per_reel_facebook: parseFloat(formData.rate_per_reel_facebook) || null,
        rate_per_story_facebook: parseFloat(formData.rate_per_story_facebook) || null,
        rate_per_post_linkedin: parseFloat(formData.rate_per_post_linkedin) || null,
        categories: selectedCategories,
        past_brands: formData.past_brands.split(',').map(b => b.trim()).filter(Boolean),
        country_id: selectedCountryId || null,
        state_id: selectedStateId || null,
        city_id: selectedCityId || null
      };

      let response;
      if (isEditMode) {
        response = await axios.put(`/influencers/${id}`, submitData);
      } else {
        response = await axios.post('/influencers', submitData);
      }

      setSuccess(true);
      const data = response.data;
      if (isEditMode) {
        setSuccessMessage('Influencer updated successfully! Redirecting...');
      } else if (data.email_invited && data.email_sent) {
        setSuccessMessage('Influencer created and invitation email sent! Redirecting...');
      } else if (data.email_invited && !data.email_sent) {
        setSuccessMessage(`Influencer created. Email not configured. ${data.invite_link ? 'Invite link: ' + data.invite_link : ''}`);
      } else if (data.invite_message) {
        setSuccessMessage(data.invite_message + ' Redirecting...');
      } else {
        setSuccessMessage('Influencer created successfully! Redirecting...');
      }
      setTimeout(() => {
        navigate('/influencers');
      }, data.invite_link ? 5000 : 1500);
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
            {successMessage || 'Influencer saved successfully! Redirecting...'}
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
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  style={{
                    border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px',
                    cursor: 'pointer', minHeight: '42px', background: 'white',
                    display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center'
                  }}
                >
                  {selectedCategories.length === 0 ? (
                    <span style={{ color: '#9ca3af' }}>Select categories...</span>
                  ) : (
                    selectedCategories.map(cat => (
                      <span key={cat} style={{
                        background: '#eef2ff', color: '#4338ca', padding: '2px 8px',
                        borderRadius: '12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        {cat}
                        <span
                          onClick={(e) => { e.stopPropagation(); setSelectedCategories(prev => prev.filter(c => c !== cat)); }}
                          style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                        >x</span>
                      </span>
                    ))
                  )}
                </div>
                {categoryDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', marginTop: '4px'
                  }}>
                    {availableCategories.map(cat => (
                      <label key={cat.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                        cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #f3f4f6'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories(prev => [...prev, cat.name]);
                            } else {
                              setSelectedCategories(prev => prev.filter(c => c !== cat.name));
                            }
                          }}
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <span className="field-hint">Select one or more categories</span>
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
              <label>Country</label>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value ? parseInt(e.target.value) : '')}
              >
                <option value="">Select Country</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>State</label>
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value ? parseInt(e.target.value) : '')}
                disabled={!selectedCountryId}
              >
                <option value="">Select State</option>
                {states.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>City</label>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value ? parseInt(e.target.value) : '')}
                disabled={!selectedStateId}
              >
                <option value="">Select City</option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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

        {/* Facebook */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="platform-icon">📘</span>
            Facebook
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Page Name</label>
              <input
                type="text"
                name="facebook_handle"
                value={formData.facebook_handle}
                onChange={handleChange}
                placeholder="Page Name"
              />
            </div>

            <div className="form-group">
              <label>Followers</label>
              <input
                type="number"
                name="facebook_followers"
                value={formData.facebook_followers}
                onChange={handleChange}
                placeholder="50000"
              />
            </div>

            <div className="form-group full-width">
              <label>Page URL</label>
              <input
                type="url"
                name="facebook_url"
                value={formData.facebook_url}
                onChange={handleChange}
                placeholder="https://facebook.com/pagename"
              />
            </div>

            <div className="form-group">
              <label>Rate per Post ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_post_facebook"
                value={formData.rate_per_post_facebook}
                onChange={handleChange}
                placeholder="25000"
              />
            </div>

            <div className="form-group">
              <label>Rate per Reel ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_reel_facebook"
                value={formData.rate_per_reel_facebook}
                onChange={handleChange}
                placeholder="35000"
              />
            </div>

            <div className="form-group">
              <label>Rate per Story ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_story_facebook"
                value={formData.rate_per_story_facebook}
                onChange={handleChange}
                placeholder="10000"
              />
            </div>
          </div>
        </div>

        {/* LinkedIn */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="platform-icon">💼</span>
            LinkedIn
          </h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Profile Name</label>
              <input
                type="text"
                name="linkedin_handle"
                value={formData.linkedin_handle}
                onChange={handleChange}
                placeholder="Profile Name"
              />
            </div>

            <div className="form-group">
              <label>Followers</label>
              <input
                type="number"
                name="linkedin_followers"
                value={formData.linkedin_followers}
                onChange={handleChange}
                placeholder="10000"
              />
            </div>

            <div className="form-group full-width">
              <label>Profile URL</label>
              <input
                type="url"
                name="linkedin_url"
                value={formData.linkedin_url}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div className="form-group">
              <label>Rate per Post ({formData.currency})</label>
              <input
                type="number"
                name="rate_per_post_linkedin"
                value={formData.rate_per_post_linkedin}
                onChange={handleChange}
                placeholder="15000"
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
