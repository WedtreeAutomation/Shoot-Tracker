import React, { useState } from 'react';

const ShootForm = ({ onClose, onSubmit, initialData,onDelete }) => {
  // Helper function to convert "10:00 AM" to "10:00" for time input
  const convertTo24Hour = (time12h) => {
    if (!time12h) return '';
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (modifier === 'PM' && hours !== '12') {
      hours = String(parseInt(hours, 10) + 12);
    }
    if (modifier === 'AM' && hours === '12') {
      hours = '00';
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  // Helper function to convert "10:00" to "10:00 AM"
  const convertTo12Hour = (time24h) => {
    if (!time24h) return '';
    let [hours, minutes] = time24h.split(':');
    const hour = parseInt(hours, 10);
    const modifier = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${modifier}`;
  };

  const [formData, setFormData] = useState({
    brandName: initialData?.brandName || '',
    shootDate: initialData?.shootDate || '',
    shootTime: initialData?.shootTime ? convertTo24Hour(initialData.shootTime) : '',
    orderDate: initialData?.orderDate || '',
    poNumber: initialData?.poNumber || '',
    supplier: initialData?.supplier || '',
    price: initialData?.price || '',
    quantity: initialData?.quantity || '',
    postId: initialData?.postId || '',
    collection: initialData?.collection || '',
    product: initialData?.product || '',
    modelName: initialData?.modelName || '',
    photographer: initialData?.photographer || '',
    status: initialData?.status || 'pending',
    budget: initialData?.budget || '',
    notes: initialData?.notes || '',
    launchDate: initialData?.launchDate || '',
    launchTime: initialData?.launchTime ? convertTo24Hour(initialData.launchTime) : '',
    remark: initialData?.remark || '',
    // location: initialData?.location || '',
    // rescheduleStatus: 'current', // ADD THIS
    // rescheduleRemark: '' // Convert launch time to 24-hour format for input
  });

  // Determine if it's create mode (no initialData) or edit mode
  const isEditMode = !!initialData;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isEditMode && formData.rescheduleStatus === 'rescheduled' && !formData.rescheduleRemark.trim()) {
      alert('Please provide a remark for rescheduling');
      return;
    }
    
    // Convert times back to 12-hour format for storage
    const submitData = {
      ...formData,
      shootTime: formData.shootTime ? convertTo12Hour(formData.shootTime) : '',
      launchTime: formData.launchTime ? convertTo12Hour(formData.launchTime) : '', // Convert launch time
      price: formData.price ? Number(formData.price) : 0,
      quantity: formData.quantity ? Number(formData.quantity) : 0,
      budget: formData.budget ? Number(formData.budget) : 0
    };
    onSubmit(initialData ? { ...submitData, id: initialData.id } : submitData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
const handleDelete = () => {
  if (onDelete && initialData?.id) {
    onDelete(initialData.id);
    onClose(); // close modal after delete
  }
};
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initialData ? 'Edit Launch' : 'Schedule New Launch'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
            <label>Brand Name *</label>
            <select
              name="brandName"
              value={formData.brandName}
              onChange={handleChange}
              required
            >
              <option value="">Select Brand</option>
              <option value="Prashanti Sarees">Prashanti Sarees</option>
              <option value="Maatshi">Maatshi</option>
              <option value="Wedtree">Wedtree</option>
              <option value="Manmandir">Manmandir</option>
            </select>
            </div>

            {/* Product Details */}
            <div className="form-group">
              <label>Post ID *</label>
              <input
                type="text"
                name="postId"
                value={formData.postId}
                onChange={handleChange}
                required
                placeholder="e.g., MTS-AD-001"
              />
            </div>
            
            
            {/* Launch Information - NEW SECTION */}
            <div className="form-group">
              <label>Launch Date *</label>
              <input
                type="date"
                name="launchDate"
                value={formData.launchDate}
                onChange={handleChange}
                {...(isEditMode ? {} : { min: new Date().toISOString().split('T')[0] })}
                required
                placeholder="Expected launch date"
              />
            </div>
            
            <div className="form-group">
              <label>Launch Time</label>
              <input
                type="time"
                name="launchTime"
                value={formData.launchTime}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Collection *</label>
              <input
                type="text"
                name="collection"
                value={formData.collection}
                onChange={handleChange}
                required
                placeholder="e.g., Summer Ethnic 2025"
              />
            </div>
            
            <div className="form-group">
              <label>Launch Status</label>
              {/* <input type="text" value={initialData ? formData.status : 'Pending'} disabled/> */}
              <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              disabled={!isEditMode}
            >
              {/* <option value="">Select Brand</option> */}
              <option value="Pending">Pending</option>
              <option value="Rescheduled">Rescheduled</option>
              
            </select>
            </div>

            

            <div className="form-group">
              <label>Remark</label>
              <input
                type="text"
                name="remark"
                value={formData.remark}
                onChange={handleChange}
                placeholder="Add remark for rescheduling"
              />
            </div>

          </div>
          
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {initialData ? 'Update Launch' : 'Schedule Launch'}
            </button>
            <button type="button" className="btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShootForm;