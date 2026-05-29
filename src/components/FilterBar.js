// import { collection } from 'firebase/firestore';
import React from 'react';

const FilterBar = ({ filters, setFilters, uniqueBrands, uniqueCollections }) => {
  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <label>🔍 SEARCH</label>
          <input
            type="text"
            placeholder="Post ID, Brand, Product..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="search-input"
          />
        </div>
        
        <div className="filter-group">
          <label>🏷️ BRAND</label>
          <select
            value={filters.brand}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
          >
            <option value="">All Brands</option>
            {uniqueBrands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>📦 COLLECTION</label>
          <select
            value={filters.collection}
            onChange={(e) => setFilters({ ...filters, collection: e.target.value })}
          >
            <option value="">All Collections</option>
            {uniqueCollections.map(collection => (
              <option key={collection} value={collection}>{collection}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>📊 STATUS</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="shootdone">Shoot Done</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-group">
          <label>📅 LAUNCH - FROM DATE</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>

        <div className="filter-group">
          <label>📅 LAUNCH - TO DATE</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
        
        <button className="clear-filters" onClick={() => setFilters({ 
          brand: '', 
          collection: '', 
          status: 'all', 
          search: '',
          startDate: '',
          endDate: ''
        })}>
          Clear All
        </button>
      </div>
    </div>
  );
};

export default FilterBar;