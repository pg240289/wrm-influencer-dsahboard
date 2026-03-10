import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './BrandForm.css';

function BrandForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isManager } = useAuth();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  });

  useEffect(() => {
    if (!isManager()) {
      navigate('/brands');
      return;
    }

    axios.get('/categories').then(res => {
      setAvailableCategories(res.data);
    }).catch(() => {});

    if (isEditMode) {
      fetchBrand();
    }
  }, [id, isEditMode]);

  const fetchBrand = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/brands/${id}`);
      const brand = response.data;

      setFormData({
        name: brand.name || '',
        description: brand.description || '',
        status: brand.status || 'active'
      });

      setSelectedCategoryIds(brand.category_ids || []);
      setError(null);
    } catch (err) {
      setError('Failed to load brand data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

      const payload = {
        name: formData.name,
        description: formData.description,
        status: formData.status || 'active',
        category_ids: selectedCategoryIds
      };

      console.log('Submitting payload:', payload);

      if (isEditMode) {
        const response = await axios.put(`/brands/${id}`, payload);
        console.log('Update response:', response.data);
      } else {
        const response = await axios.post('/brands', payload);
        console.log('Create response:', response.data);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/brands');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save brand');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode && !formData.name) {
    return (
      <div className="brand-form-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading brand data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-form-container">
      {/* Header */}
      <div className="form-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/brands')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div>
            <h1>{isEditMode ? 'Edit Brand' : 'Add New Brand'}</h1>
            <p>{isEditMode ? 'Update brand information' : 'Add a new brand to your master list'}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="brand-form">
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
            Brand saved successfully! Redirecting...
          </div>
        )}

        {/* Basic Information */}
        <div className="form-section">
          <h2 className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Brand Information
          </h2>

          <div className="form-grid">
            <div className="form-group required full-width">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter brand name"
                required
              />
            </div>

            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description about the brand..."
                rows="4"
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
                  {selectedCategoryIds.length === 0 ? (
                    <span style={{ color: '#9ca3af' }}>Select categories...</span>
                  ) : (
                    selectedCategoryIds.map(catId => {
                      const cat = availableCategories.find(c => c.id === catId);
                      return cat ? (
                        <span key={catId} style={{
                          background: '#eef2ff', color: '#4338ca', padding: '2px 8px',
                          borderRadius: '12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          {cat.name}
                          <span
                            onClick={(e) => { e.stopPropagation(); setSelectedCategoryIds(prev => prev.filter(id => id !== catId)); }}
                            style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                          >x</span>
                        </span>
                      ) : null;
                    })
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
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategoryIds(prev => [...prev, cat.id]);
                            } else {
                              setSelectedCategoryIds(prev => prev.filter(id => id !== cat.id));
                            }
                          }}
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <span className="field-hint">Select categories associated with this brand</span>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/brands')}
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
              isEditMode ? 'Update Brand' : 'Create Brand'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BrandForm;
