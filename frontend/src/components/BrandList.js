import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './BrandList.css';

function BrandList() {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/brands');
      setBrands(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load brands');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter(brand => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        brand.name.toLowerCase().includes(search) ||
        (brand.description && brand.description.toLowerCase().includes(search))
      );
    }
    return true;
  });

  return (
    <div className="brand-list-container">
      {/* Header */}
      <div className="brand-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>
        <div className="header-center">
          <h1>Brand Master</h1>
          <p>Manage and discover brands for your campaigns</p>
        </div>
        <div className="header-actions">
          {isManager() && (
            <button className="btn-primary-modern" onClick={() => navigate('/brands/new')}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 3v14m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Brand
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
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Results */}
      <div className="results-card">
        <div className="results-header">
          <h3>
            {filteredBrands.length} Brand{filteredBrands.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading brands...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="#e2e8f0" strokeWidth="2"/>
              <path d="M32 20v24M20 32h24" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h3>No brands found</h3>
            <p>Try adjusting your search or add new brands</p>
          </div>
        ) : (
          <div className="brands-grid">
            {filteredBrands.map(brand => (
              <div
                key={brand.id}
                className="brand-card"
                onClick={() => navigate(`/brands/${brand.id}/edit`)}
              >
                <div className="card-header">
                  <div className="brand-avatar">
                    <span>{brand.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="brand-info">
                    <h4>{brand.name}</h4>
                    <span className="description">
                      {brand.description || 'No description'}
                    </span>
                  </div>
                  <span className={`status-badge status-${brand.status || 'active'}`}>
                    {brand.status || 'active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandList;
