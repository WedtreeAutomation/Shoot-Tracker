import React from 'react';
import { format, isValid } from 'date-fns';
import { Edit, Trash2 } from 'lucide-react';

const ShootCard = ({ shoot, onEdit, onDelete, isSelected, onSelect, selectionMode }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#f59e0b';
      case 'scheduled': return '#3b82f6';
      case 'shootdone': return '#8b5cf6';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'pending': return 'Pending';
      case 'scheduled': return 'Scheduled';
      case 'shootdone': return 'Shoot Done';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status || 'Unknown';
    }
  };

  // Function to get consistent color for a brand
  const getBrandColor = (brandName) => {
    if (!brandName) return { color: '#94a3b8', bg: '#0f172a' };
    
    const colors = [
      { name: 'Prashanti', color: '#e91e63', bg: 'rgba(233, 30, 99, 0.15)' },
      { name: 'Maatshi', color: '#00bcd4', bg: 'rgba(0, 188, 212, 0.15)' },
      { name: 'Wedtree', color: '#ff9800', bg: 'rgba(255, 152, 0, 0.15)' },
    ];
    
    const matched = colors.find(c => 
      brandName.toLowerCase().includes(c.name.toLowerCase())
    );
    
    if (matched) {
      return { color: matched.color, bg: matched.bg };
    }
    
    // Generate a consistent color based on brand name hash
    const hash = brandName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return {
      color: `hsl(${hue}, 70%, 55%)`,
      bg: `hsla(${hue}, 70%, 55%, 0.15)`
    };
  };

  const getShootType = () => {
    if (shoot.shootId) return 'Model Shoot';
    return 'Event';
  };

  // Helper function to safely format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    if (!isValid(date)) return 'Invalid date';
    return format(date, 'MMM dd, yyyy');
  };

  // Extract shoot ID
  const postId = shoot.postId || 'N/A';
  const shootType = getShootType();
  const formattedDate = formatDate(shoot.launchDate);
  const shootTime = shoot.launchTime || 'Not Set';
  const brandStyle = getBrandColor(shoot.brandName);

  // Handle card click for selection
  const handleCardClick = (e) => {
    if (selectionMode) {
      if (e.target.closest('.icon-btn-modern') || e.target.closest('.card-checkbox-modern')) {
        return;
      }
      onSelect(shoot.id);
    }
  };

  return (
    <div 
      className={`shoot-card-modern ${isSelected ? 'selected' : ''}`}
      onClick={handleCardClick}
      style={{ cursor: selectionMode ? 'pointer' : 'default' }}
    >
      {selectionMode && (
        <div className="card-checkbox-modern" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(shoot.id)}
            className="select-checkbox-modern"
          />
        </div>
      )}
      
      <div className="card-content-modern">
        <div className="card-header-modern">
          <div className="card-id-section">
            <span className="shoot-id">{postId}</span>
            {shoot.brandName && (
              <span 
                className="brand-tag"
                style={{ 
                  color: brandStyle.color, 
                  backgroundColor: brandStyle.bg,
                  border: `1px solid ${brandStyle.color}30`
                }}
              >
                {shoot.brandName}
              </span>
            )}
          </div>
          <div className="card-actions-modern" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn-modern" onClick={() => onEdit(shoot)} title="Edit">
              <Edit size={14} />
            </button>
            <button className="icon-btn-modern delete" onClick={() => onDelete(shoot.id)} title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="card-title-modern">
          <h3>{shoot.collection || shoot.brandName}</h3>
        </div>

        <div className="card-meta-modern">
          {shoot.supplier && (
            <div className="meta-item">
              <span className="meta-label">Supplier</span>
              <span className="meta-value">{shoot.supplier}</span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">Date</span>
            <span className="meta-value">{formattedDate}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Time</span>
            <span className="meta-value">{shootTime}</span>
          </div>
        </div>

        <div className="card-status-modern">
          <div 
            className="status-dot" 
            style={{ backgroundColor: getStatusColor(shoot.status) }}
          />
          <span className="status-text" style={{ color: getStatusColor(shoot.status) }}>
            {getStatusText(shoot.status)}
          </span>
        </div>

        {/* Show grouped launches count if this is a combined shoot */}
        {shoot.launchCount && shoot.launchCount > 1 && (
          <div className="group-badge">
            <span>📦 {shoot.launchCount} launches</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShootCard;