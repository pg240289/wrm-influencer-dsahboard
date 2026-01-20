import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './InfluencerList.css';

function InfluencerList() {
  const navigate = useNavigate();
  const { user, isManager } = useAuth();
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [wrmFilter, setWrmFilter] = useState('');

  // Dropdown states
  const [isTierDropdownOpen, setIsTierDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isWrmDropdownOpen, setIsWrmDropdownOpen] = useState(false);

  // All available categories (extracted from influencers)
  const [allCategories, setAllCategories] = useState([]);

  useEffect(() => {
    fetchInfluencers();
  }, [tierFilter, categoryFilter, wrmFilter]);

  const fetchInfluencers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (tierFilter) params.append('tier', tierFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (wrmFilter) params.append('worked_with_wrm', wrmFilter);

      const response = await axios.get(`/influencers?${params.toString()}`);
      setInfluencers(response.data);

      // Extract unique categories
      const categoriesSet = new Set();
      response.data.forEach(inf => {
        if (inf.categories && Array.isArray(inf.categories)) {
          inf.categories.forEach(cat => categoriesSet.add(cat));
        }
      });
      setAllCategories(Array.from(categoriesSet).sort());

      setError(null);
    } catch (err) {
      setError('Failed to load influencers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering for search and follower range, then sort by followers descending
  const filteredInfluencers = influencers
    .filter(inf => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          inf.name.toLowerCase().includes(search) ||
          (inf.email && inf.email.toLowerCase().includes(search)) ||
          (inf.instagram_handle && inf.instagram_handle.toLowerCase().includes(search)) ||
          (inf.youtube_handle && inf.youtube_handle.toLowerCase().includes(search));

        if (!matchesSearch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by max_followers in descending order
      const aFollowers = a.max_followers || 0;
      const bFollowers = b.max_followers || 0;
      return bFollowers - aFollowers;
    });

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num;
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'Mega': return '#8b5cf6';
      case 'Macro': return '#3b82f6';
      case 'Micro': return '#10b981';
      case 'Nano': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getCategoryStyle = (category) => {
    const styles = {
      'Fashion': { bg: '#fef3c7', color: '#92400e', icon: '👗' },
      'Lifestyle': { bg: '#ddd6fe', color: '#5b21b6', icon: '✨' },
      'Beauty': { bg: '#fce7f3', color: '#9f1239', icon: '💄' },
      'Tech': { bg: '#dbeafe', color: '#1e40af', icon: '💻' },
      'Gaming': { bg: '#d1fae5', color: '#065f46', icon: '🎮' },
      'Gadgets': { bg: '#e0e7ff', color: '#3730a3', icon: '📱' },
      'Fitness': { bg: '#ccfbf1', color: '#115e59', icon: '💪' },
      'Health': { bg: '#dcfce7', color: '#166534', icon: '🏥' },
      'Wellness': { bg: '#f0fdf4', color: '#14532d', icon: '🧘' },
      'Food': { bg: '#fed7aa', color: '#9a3412', icon: '🍔' },
      'Travel': { bg: '#bfdbfe', color: '#1e3a8a', icon: '✈️' },
      'Music': { bg: '#fce7f3', color: '#831843', icon: '🎵' },
      'Art': { bg: '#fae8ff', color: '#701a75', icon: '🎨' },
      'Photography': { bg: '#e5e7eb', color: '#1f2937', icon: '📷' },
      'Comedy': { bg: '#fef08a', color: '#713f12', icon: '😂' },
      'Entertainment': { bg: '#fecaca', color: '#991b1b', icon: '🎬' },
      'Education': { bg: '#bfdbfe', color: '#1e40af', icon: '📚' },
      'Business': { bg: '#d1d5db', color: '#374151', icon: '💼' },
      'Finance': { bg: '#d1fae5', color: '#064e3b', icon: '💰' }
    };
    return styles[category] || { bg: '#f3f4f6', color: '#6b7280', icon: '🏷️' };
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setTierFilter('');
    setCategoryFilter('');
    setWrmFilter('');
  };

  const activeFilterCount = [tierFilter, categoryFilter, wrmFilter].filter(Boolean).length;

  return (
    <div className="influencer-list-container">
      {/* Header */}
      <div className="influencer-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>
        <div className="header-center">
          <h1>Influencer Master</h1>
          <p>Manage and discover influencers for your campaigns</p>
        </div>
        <div className="header-actions">
          {isManager() && (
            <button className="btn-primary-modern" onClick={() => navigate('/influencers/new')}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 3v14m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Influencer
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-chips">
          {/* Tier Filter */}
          <div className="custom-dropdown">
            <button
              className={`chip-trigger ${tierFilter ? 'active' : ''}`}
              onClick={() => setIsTierDropdownOpen(!isTierDropdownOpen)}
              onBlur={() => setTimeout(() => setIsTierDropdownOpen(false), 200)}
            >
              <span>{tierFilter || 'Tier'}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {isTierDropdownOpen && (
              <div className="dropdown-menu">
                <button className={`dropdown-item ${!tierFilter ? 'active' : ''}`} onClick={() => { setTierFilter(''); setIsTierDropdownOpen(false); }}>
                  All Tiers
                </button>
                <button className={`dropdown-item ${tierFilter === 'Mega' ? 'active' : ''}`} onClick={() => { setTierFilter('Mega'); setIsTierDropdownOpen(false); }}>
                  Mega (1M+)
                </button>
                <button className={`dropdown-item ${tierFilter === 'Macro' ? 'active' : ''}`} onClick={() => { setTierFilter('Macro'); setIsTierDropdownOpen(false); }}>
                  Macro (100K-1M)
                </button>
                <button className={`dropdown-item ${tierFilter === 'Micro' ? 'active' : ''}`} onClick={() => { setTierFilter('Micro'); setIsTierDropdownOpen(false); }}>
                  Micro (10K-100K)
                </button>
                <button className={`dropdown-item ${tierFilter === 'Nano' ? 'active' : ''}`} onClick={() => { setTierFilter('Nano'); setIsTierDropdownOpen(false); }}>
                  Nano (&lt;10K)
                </button>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="custom-dropdown">
            <button
              className={`chip-trigger ${categoryFilter ? 'active' : ''}`}
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              onBlur={() => setTimeout(() => setIsCategoryDropdownOpen(false), 200)}
            >
              <span>{categoryFilter || 'Category'}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {isCategoryDropdownOpen && (
              <div className="dropdown-menu scrollable">
                <button className={`dropdown-item ${!categoryFilter ? 'active' : ''}`} onClick={() => { setCategoryFilter(''); setIsCategoryDropdownOpen(false); }}>
                  All Categories
                </button>
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    className={`dropdown-item ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => { setCategoryFilter(cat); setIsCategoryDropdownOpen(false); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WRM Filter */}
          <div className="custom-dropdown">
            <button
              className={`chip-trigger ${wrmFilter ? 'active' : ''}`}
              onClick={() => setIsWrmDropdownOpen(!isWrmDropdownOpen)}
              onBlur={() => setTimeout(() => setIsWrmDropdownOpen(false), 200)}
            >
              <span>{wrmFilter === 'true' ? 'Worked with us' : wrmFilter === 'false' ? 'New' : 'History'}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {isWrmDropdownOpen && (
              <div className="dropdown-menu">
                <button className={`dropdown-item ${!wrmFilter ? 'active' : ''}`} onClick={() => { setWrmFilter(''); setIsWrmDropdownOpen(false); }}>
                  All
                </button>
                <button className={`dropdown-item ${wrmFilter === 'true' ? 'active' : ''}`} onClick={() => { setWrmFilter('true'); setIsWrmDropdownOpen(false); }}>
                  Worked with us
                </button>
                <button className={`dropdown-item ${wrmFilter === 'false' ? 'active' : ''}`} onClick={() => { setWrmFilter('false'); setIsWrmDropdownOpen(false); }}>
                  New influencers
                </button>
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button className="btn-clear-filters" onClick={clearAllFilters}>
              Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="results-card">
        <div className="results-header">
          <h3>
            {filteredInfluencers.length} Influencer{filteredInfluencers.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading influencers...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
          </div>
        ) : filteredInfluencers.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="#e2e8f0" strokeWidth="2"/>
              <path d="M32 20v24M20 32h24" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h3>No influencers found</h3>
            <p>Try adjusting your filters or add new influencers</p>
          </div>
        ) : (
          <div className="influencers-grid">
            {filteredInfluencers.map(inf => (
              <div
                key={inf.id}
                className="influencer-card"
                onClick={() => navigate(`/influencers/${inf.id}/edit`)}
              >
                <div className="card-header">
                  <div className="influencer-avatar">
                    {inf.profile_pic ? (
                      <img src={inf.profile_pic} alt={inf.name} />
                    ) : (
                      <span>{inf.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="influencer-info">
                    <h4>{inf.name}</h4>
                    <span className="location">{inf.city || 'India'}</span>
                  </div>
                  <span className="tier-badge" style={{ backgroundColor: getTierColor(inf.tier) }}>
                    {inf.tier}
                  </span>
                </div>

                <div className="card-footer">
                  <div className="card-socials">
                    {inf.instagram_followers > 0 && (
                      <div className="social-stat" title="Instagram">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#E4405F">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                        </svg>
                        <span>{formatNumber(inf.instagram_followers)}</span>
                      </div>
                    )}
                    {inf.youtube_subscribers > 0 && (
                      <div className="social-stat" title="YouTube">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span>{formatNumber(inf.youtube_subscribers)}</span>
                      </div>
                    )}
                    {inf.tiktok_followers > 0 && (
                      <div className="social-stat" title="TikTok">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                        <span>{formatNumber(inf.tiktok_followers)}</span>
                      </div>
                    )}
                    {inf.twitter_followers > 0 && (
                      <div className="social-stat" title="X">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>{formatNumber(inf.twitter_followers)}</span>
                      </div>
                    )}
                  </div>
                  {inf.worked_with_wrm && (
                    <span className="wrm-badge">WRM</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InfluencerList;
