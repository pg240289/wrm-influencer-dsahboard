import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './MasterData.css';

function MasterData() {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('categories');

  // Categories
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState({ name: '', description: '', status: 'active' });
  const [editingCatId, setEditingCatId] = useState(null);

  // Countries
  const [countries, setCountries] = useState([]);
  const [countryForm, setCountryForm] = useState({ name: '', code: '', status: 'active' });
  const [editingCountryId, setEditingCountryId] = useState(null);

  // States
  const [states, setStates] = useState([]);
  const [stateForm, setStateForm] = useState({ name: '', country_id: '', status: 'active' });
  const [editingStateId, setEditingStateId] = useState(null);
  const [stateCountryFilter, setStateCountryFilter] = useState('');

  // Cities
  const [cities, setCities] = useState([]);
  const [cityForm, setCityForm] = useState({ name: '', state_id: '', status: 'active' });
  const [editingCityId, setEditingCityId] = useState(null);
  const [cityCountryFilter, setCityCountryFilter] = useState('');
  const [cityStateFilter, setCityStateFilter] = useState('');
  const [cityStates, setCityStates] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCountries();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'states') fetchStates();
    if (activeTab === 'cities') fetchCities();
  }, [activeTab, stateCountryFilter, cityStateFilter]);

  // When city country filter changes, load states for that country
  useEffect(() => {
    if (cityCountryFilter) {
      axios.get(`/states?country_id=${cityCountryFilter}`).then(res => setCityStates(res.data)).catch(() => setCityStates([]));
    } else {
      setCityStates([]);
    }
    setCityStateFilter('');
  }, [cityCountryFilter]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/categories');
      setCategories(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchCountries = async () => {
    try {
      const res = await axios.get('/countries');
      setCountries(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchStates = async () => {
    try {
      const params = stateCountryFilter ? `?country_id=${stateCountryFilter}` : '';
      const res = await axios.get(`/states${params}`);
      setStates(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchCities = async () => {
    try {
      const params = cityStateFilter ? `?state_id=${cityStateFilter}` : '';
      const res = await axios.get(`/cities${params}`);
      setCities(res.data);
    } catch (err) { console.error(err); }
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // ---- Category CRUD ----
  const saveCategory = async () => {
    if (!catForm.name.trim()) { showError('Category name is required'); return; }
    try {
      setLoading(true);
      if (editingCatId) {
        await axios.put(`/categories/${editingCatId}`, catForm);
        showSuccess('Category updated');
      } else {
        await axios.post('/categories', catForm);
        showSuccess('Category created');
      }
      setCatForm({ name: '', description: '', status: 'active' });
      setEditingCatId(null);
      fetchCategories();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save category');
    } finally { setLoading(false); }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await axios.delete(`/categories/${id}`);
      showSuccess('Category deleted');
      fetchCategories();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete category');
    }
  };

  // ---- Country CRUD ----
  const saveCountry = async () => {
    if (!countryForm.name.trim()) { showError('Country name is required'); return; }
    try {
      setLoading(true);
      if (editingCountryId) {
        await axios.put(`/countries/${editingCountryId}`, countryForm);
        showSuccess('Country updated');
      } else {
        await axios.post('/countries', countryForm);
        showSuccess('Country created');
      }
      setCountryForm({ name: '', code: '', status: 'active' });
      setEditingCountryId(null);
      fetchCountries();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save country');
    } finally { setLoading(false); }
  };

  const deleteCountry = async (id) => {
    if (!window.confirm('Delete this country? This will fail if states exist under it.')) return;
    try {
      await axios.delete(`/countries/${id}`);
      showSuccess('Country deleted');
      fetchCountries();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete country');
    }
  };

  // ---- State CRUD ----
  const saveState = async () => {
    if (!stateForm.name.trim()) { showError('State name is required'); return; }
    if (!stateForm.country_id) { showError('Please select a country'); return; }
    try {
      setLoading(true);
      if (editingStateId) {
        await axios.put(`/states/${editingStateId}`, stateForm);
        showSuccess('State updated');
      } else {
        await axios.post('/states', stateForm);
        showSuccess('State created');
      }
      setStateForm({ name: '', country_id: '', status: 'active' });
      setEditingStateId(null);
      fetchStates();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save state');
    } finally { setLoading(false); }
  };

  const deleteState = async (id) => {
    if (!window.confirm('Delete this state? This will fail if cities exist under it.')) return;
    try {
      await axios.delete(`/states/${id}`);
      showSuccess('State deleted');
      fetchStates();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete state');
    }
  };

  // ---- City CRUD ----
  const saveCity = async () => {
    if (!cityForm.name.trim()) { showError('City name is required'); return; }
    if (!cityForm.state_id) { showError('Please select a state'); return; }
    try {
      setLoading(true);
      if (editingCityId) {
        await axios.put(`/cities/${editingCityId}`, cityForm);
        showSuccess('City updated');
      } else {
        await axios.post('/cities', cityForm);
        showSuccess('City created');
      }
      setCityForm({ name: '', state_id: '', status: 'active' });
      setEditingCityId(null);
      fetchCities();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save city');
    } finally { setLoading(false); }
  };

  const deleteCity = async (id) => {
    if (!window.confirm('Delete this city?')) return;
    try {
      await axios.delete(`/cities/${id}`);
      showSuccess('City deleted');
      fetchCities();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete city');
    }
  };

  const canEdit = isManager();

  return (
    <div className="master-data-container">
      {/* Header */}
      <div className="master-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div>
            <h1>Master Data</h1>
            <p>Manage categories, countries, states and cities</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="master-alert master-alert-error">{error}<button onClick={() => setError('')}>x</button></div>}
      {success && <div className="master-alert master-alert-success">{success}<button onClick={() => setSuccess('')}>x</button></div>}

      {/* Tabs */}
      <div className="master-tabs">
        {['categories', 'countries', 'states', 'cities'].map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="master-section">
          {canEdit && (
            <div className="master-form-row">
              <input
                type="text"
                placeholder="Category name"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              />
              <select value={catForm.status} onChange={(e) => setCatForm({ ...catForm, status: e.target.value })} style={{ maxWidth: '130px' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button className="btn-save" onClick={saveCategory} disabled={loading}>
                {editingCatId ? 'Update' : 'Add'}
              </button>
              {editingCatId && (
                <button className="btn-cancel" onClick={() => { setEditingCatId(null); setCatForm({ name: '', description: '', status: 'active' }); }}>
                  Cancel
                </button>
              )}
            </div>
          )}
          <table className="master-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => (
                <tr key={cat.id}>
                  <td>{i + 1}</td>
                  <td>{cat.name}</td>
                  <td>{cat.description || '-'}</td>
                  <td><span className={`status-badge status-${cat.status}`}>{cat.status}</span></td>
                  {canEdit && (
                    <td className="action-cell">
                      <button className="btn-action btn-edit" onClick={() => { setEditingCatId(cat.id); setCatForm({ name: cat.name, description: cat.description || '', status: cat.status || 'active' }); }}>Edit</button>
                      <button className="btn-action btn-delete" onClick={() => deleteCategory(cat.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {categories.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="empty-row">No categories found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Countries Tab */}
      {activeTab === 'countries' && (
        <div className="master-section">
          {canEdit && (
            <div className="master-form-row">
              <input
                type="text"
                placeholder="Country name"
                value={countryForm.name}
                onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Code (e.g. IN)"
                value={countryForm.code}
                onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value })}
                style={{ maxWidth: '120px' }}
              />
              <select value={countryForm.status} onChange={(e) => setCountryForm({ ...countryForm, status: e.target.value })} style={{ maxWidth: '130px' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button className="btn-save" onClick={saveCountry} disabled={loading}>
                {editingCountryId ? 'Update' : 'Add'}
              </button>
              {editingCountryId && (
                <button className="btn-cancel" onClick={() => { setEditingCountryId(null); setCountryForm({ name: '', code: '', status: 'active' }); }}>
                  Cancel
                </button>
              )}
            </div>
          )}
          <table className="master-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {countries.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.name}</td>
                  <td>{c.code || '-'}</td>
                  <td><span className={`status-badge status-${c.status}`}>{c.status}</span></td>
                  {canEdit && (
                    <td className="action-cell">
                      <button className="btn-action btn-edit" onClick={() => { setEditingCountryId(c.id); setCountryForm({ name: c.name, code: c.code || '', status: c.status || 'active' }); }}>Edit</button>
                      <button className="btn-action btn-delete" onClick={() => deleteCountry(c.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {countries.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="empty-row">No countries found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* States Tab */}
      {activeTab === 'states' && (
        <div className="master-section">
          <div className="master-filter-row">
            <label>Filter by Country:</label>
            <select value={stateCountryFilter} onChange={(e) => setStateCountryFilter(e.target.value)}>
              <option value="">All Countries</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {canEdit && (
            <div className="master-form-row">
              <input
                type="text"
                placeholder="State name"
                value={stateForm.name}
                onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })}
              />
              <select
                value={stateForm.country_id}
                onChange={(e) => setStateForm({ ...stateForm, country_id: e.target.value ? parseInt(e.target.value) : '' })}
              >
                <option value="">Select Country</option>
                {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={stateForm.status} onChange={(e) => setStateForm({ ...stateForm, status: e.target.value })} style={{ maxWidth: '130px' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button className="btn-save" onClick={saveState} disabled={loading}>
                {editingStateId ? 'Update' : 'Add'}
              </button>
              {editingStateId && (
                <button className="btn-cancel" onClick={() => { setEditingStateId(null); setStateForm({ name: '', country_id: '', status: 'active' }); }}>
                  Cancel
                </button>
              )}
            </div>
          )}
          <table className="master-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Country</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {states.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.name}</td>
                  <td>{s.country_name || '-'}</td>
                  <td><span className={`status-badge status-${s.status}`}>{s.status}</span></td>
                  {canEdit && (
                    <td className="action-cell">
                      <button className="btn-action btn-edit" onClick={() => { setEditingStateId(s.id); setStateForm({ name: s.name, country_id: s.country_id, status: s.status || 'active' }); }}>Edit</button>
                      <button className="btn-action btn-delete" onClick={() => deleteState(s.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {states.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="empty-row">No states found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Cities Tab */}
      {activeTab === 'cities' && (
        <div className="master-section">
          <div className="master-filter-row">
            <label>Country:</label>
            <select value={cityCountryFilter} onChange={(e) => setCityCountryFilter(e.target.value)}>
              <option value="">All</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label>State:</label>
            <select value={cityStateFilter} onChange={(e) => setCityStateFilter(e.target.value)} disabled={!cityCountryFilter}>
              <option value="">All</option>
              {cityStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {canEdit && (
            <div className="master-form-row">
              <input
                type="text"
                placeholder="City name"
                value={cityForm.name}
                onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
              />
              <select
                value={cityForm.state_id}
                onChange={(e) => setCityForm({ ...cityForm, state_id: e.target.value ? parseInt(e.target.value) : '' })}
              >
                <option value="">Select State</option>
                {(cityCountryFilter ? cityStates : states).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={cityForm.status} onChange={(e) => setCityForm({ ...cityForm, status: e.target.value })} style={{ maxWidth: '130px' }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button className="btn-save" onClick={saveCity} disabled={loading}>
                {editingCityId ? 'Update' : 'Add'}
              </button>
              {editingCityId && (
                <button className="btn-cancel" onClick={() => { setEditingCityId(null); setCityForm({ name: '', state_id: '', status: 'active' }); }}>
                  Cancel
                </button>
              )}
            </div>
          )}
          <table className="master-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>State</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {cities.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.name}</td>
                  <td>{c.state_name || '-'}</td>
                  <td><span className={`status-badge status-${c.status}`}>{c.status}</span></td>
                  {canEdit && (
                    <td className="action-cell">
                      <button className="btn-action btn-edit" onClick={() => { setEditingCityId(c.id); setCityForm({ name: c.name, state_id: c.state_id, status: c.status || 'active' }); }}>Edit</button>
                      <button className="btn-action btn-delete" onClick={() => deleteCity(c.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {cities.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="empty-row">No cities found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MasterData;
