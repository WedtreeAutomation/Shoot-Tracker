import React, { useState, useEffect } from 'react';
import KPICards from './KPICards';
import FilterBar from './FilterBar';
import { Film, Download, Save, X, Edit2, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const Dashboard = ({ userData, theme }) => {
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [filters, setFilters] = useState({
    brand: '',
    collection: '',
    status: 'all',
    search: '',
    startDate: '',
    endDate: ''
  });
  
  // Table sorting state
  const [sortField, setSortField] = useState('launchDate');
  const [sortDirection, setSortDirection] = useState('desc');

  // Multi-select states for bulk schedule
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedShoots, setSelectedShoots] = useState([]);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState('');
  const [bulkScheduleTime, setBulkScheduleTime] = useState('');
  const [bulkScheduleStatus, setBulkScheduleStatus] = useState('scheduled');
  const [bulkModelName, setBulkModelName] = useState('');
  const [bulkBudget, setBulkBudget] = useState('');
  const [bulkEditor, setBulkEditor] = useState('');
  const [bulkMakeupArtist, setBulkMakeupArtist] = useState('');
  const [bulkStylist, setBulkStylist] = useState('');
  const [bulkCameraMan, setBulkCameraMan] = useState('');
  const [bulkDesigner, setBulkDesigner] = useState('');
  const [shootName, setShootName] = useState('');
  const [shootId, setShootId] = useState('');
  const [bulkLocation, setBulkLocation] = useState('');
  const [selectedPhotographers, setSelectedPhotographers] = useState([]);
  const [mediaMembers, setMediaMembers] = useState([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [editors, setEditors] = useState([]);
  const [newEditorName, setNewEditorName] = useState('');
  const [showAddEditorInput, setShowAddEditorInput] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  
  // New row for inline addition
  const [newRow, setNewRow] = useState({
    brandName: '',
    postId: '',
    product: '',
    collection: '',
    launchDate: '',
    launchTime: '',
    status: 'pending',
    shootId: '',
    shootName: '',
    shootDate: '',
    shootTime: '',
    photographer: '',
    editor: '',
    modelName: '',
    budget: '',
    location: '',
    makeupArtist: '',
    stylist: '',
    cameraMan: '',
    designer: '',
    remarks: ''
  });
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Field categories for role-based access
  const brandTeamEditableFields = ['brandName', 'postId', 'product', 'collection', 'launchDate', 'launchTime'];
  const mediaTeamEditableFields = ['status', 'remarks'];
  const allOtherFields = ['shootId', 'shootName', 'shootDate', 'shootTime', 'photographer', 'editor', 'modelName', 'budget', 'location', 'makeupArtist', 'stylist', 'cameraMan', 'designer'];

  // Location options
  const locationOptions = ['Indoor', 'Outdoor', 'Store'];

  // Function to get brand prefix
  const getBrandPrefix = (brandName) => {
    const brandMap = {
      'Prashanti': 'PS',
      'Maatshi': 'MA',
      'Wedtree': 'WD',
      'Manmandir': 'MM'
    };
    return brandMap[brandName] || null;
  };

  // Function to generate sequential Post ID
  const generatePostId = async (brandName) => {
    const prefix = getBrandPrefix(brandName);
    if (!prefix) {
      // If brand doesn't have a prefix, generate a generic ID
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `BR-${year}${month}${day}-${random}`;
    }

    try {
      // Get all shoots with this brand
      const querySnapshot = await getDocs(collection(db, 'shoots'));
      const brandShoots = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.brandName === brandName) {
          brandShoots.push(data);
        }
      });

      // Find the highest number for this brand
      let maxNumber = 0;
      brandShoots.forEach(shoot => {
        if (shoot.postId && shoot.postId.startsWith(prefix)) {
          const numberPart = shoot.postId.substring(prefix.length);
          const num = parseInt(numberPart, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      // Generate next number (max + 1)
      const nextNumber = maxNumber + 1;
      const paddedNumber = String(nextNumber).padStart(3, '0');
      return `${prefix}${paddedNumber}`;
    } catch (error) {
      console.error("Error generating Post ID:", error);
      // Fallback to timestamp-based ID
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `${prefix}-${year}${month}${day}-${random}`;
    }
  };

  // Function to check if user can edit a specific field
  const canEditField = (field) => {
    const userRole = userData?.role;
    
    if (userRole === 'Admin' || userRole === 'Manager') {
      return true;
    } else if (userRole === 'Brand Team') {
      return brandTeamEditableFields.includes(field) || field === 'remarks' || field === 'status';
    } else if (userRole === 'Media Team') {
      return mediaTeamEditableFields.includes(field) || allOtherFields.includes(field);
    }
    return false;
  };

  // Function to check if user can add new launches
  const canAddNewLaunch = () => {
    const userRole = userData?.role;
    return userRole === 'Admin' || userRole === 'Manager' || userRole === 'Brand Team';
  };

  // Function to check if user can delete
  const canDelete = () => {
    const userRole = userData?.role;
    return userRole === 'Admin' || userRole === 'Manager';
  };

  useEffect(() => {
    loadMediaMembers();
  }, []);

  const loadMediaMembers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'MediaTeamMembers'));
      const members = [];
      querySnapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() });
      });
      setMediaMembers(members.filter(m => m.memberRole === 'Photographer'));
      setEditors(members.filter(m => m.memberRole === 'Editor'));
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  // Load shoots from Firebase on mount
  useEffect(() => {
    loadShoots();
  }, []);

  const loadShoots = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'shoots'));
      const shootsData = [];
      querySnapshot.forEach((doc) => {
        shootsData.push({ id: doc.id, ...doc.data() });
      });
      
      const sortedShoots = shootsData.sort((a, b) => {
        if (!a.launchDate) return 1;
        if (!b.launchDate) return -1;
        return new Date(b.launchDate) - new Date(a.launchDate);
      });
      
      setShoots(sortedShoots);
    } catch (error) {
      console.error("Error loading launches:", error);
      alert("Failed to load launches. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const convertTo12Hour = (time24h) => {
    if (!time24h) return '';
    let [hours, minutes] = time24h.split(':');
    const hour = parseInt(hours, 10);
    const modifier = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${modifier}`;
  };

  const getTrackingFields = () => {
    return {
      updatedUserEmail: userData?.email || 'Unknown',
      updatedTime: new Date().toISOString(),
    };
  };

  const generateShootId = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `SHOOT-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  // Inline edit handlers
  const startEditing = (shoot) => {
    setEditingRow(shoot.id);
    setEditingData({ ...shoot });
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditingData({});
  };

  const saveEditing = async () => {
    try {
      const shootRef = doc(db, 'shoots', editingRow);
      const updateData = {
        ...editingData,
        ...getTrackingFields(),
        budget: editingData.budget ? Number(editingData.budget) : 0
      };
      delete updateData.id;
      
      await updateDoc(shootRef, updateData);
      await loadShoots();
      setEditingRow(null);
      setEditingData({});
    } catch (error) {
      console.error("Error updating launch:", error);
      alert("Failed to update launch");
    }
  };

  const handleInlineChange = (field, value) => {
    setEditingData(prev => ({ ...prev, [field]: value }));
  };

  // Add new row
  const startAddingNew = () => {
    setIsAddingNew(true);
    setNewRow({
      brandName: '',
      postId: '',
      product: '',
      collection: '',
      launchDate: '',
      launchTime: '',
      status: 'pending',
      shootId: '',
      shootName: '',
      shootDate: '',
      shootTime: '',
      photographer: '',
      editor: '',
      modelName: '',
      budget: '',
      location: '',
      makeupArtist: '',
      stylist: '',
      cameraMan: '',
      designer: '',
      remarks: ''
    });
  };

  const cancelAddingNew = () => {
    setIsAddingNew(false);
    setNewRow({
      brandName: '',
      postId: '',
      product: '',
      collection: '',
      launchDate: '',
      launchTime: '',
      status: 'pending',
      shootId: '',
      shootName: '',
      shootDate: '',
      shootTime: '',
      photographer: '',
      editor: '',
      modelName: '',
      budget: '',
      location: '',
      makeupArtist: '',
      stylist: '',
      cameraMan: '',
      designer: '',
      remarks: ''
    });
  };

  const saveNewRow = async () => {
    if (!newRow.brandName.trim()) {
      alert('Brand Name is required');
      return;
    }

    try {
      // Auto-generate Post ID
      const autoGeneratedPostId = await generatePostId(newRow.brandName);
      
      const shootWithTracking = {
        ...newRow,
        postId: autoGeneratedPostId, // Use auto-generated Post ID
        ...getTrackingFields(),
        editor: newRow.editor || 'Unknown',
        budget: newRow.budget ? Number(newRow.budget) : 0,
        createdAt: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date())
      };
      
      await addDoc(collection(db, 'shoots'), shootWithTracking);
      await loadShoots();
      setIsAddingNew(false);
      cancelAddingNew();
    } catch (error) {
      console.error("Error adding launch:", error);
      alert("Failed to add launch");
    }
  };

  const handleNewRowChange = (field, value) => {
    setNewRow(prev => ({ ...prev, [field]: value }));
  };

  const handleDeleteShoot = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'shoots', deleteId));
      await loadShoots();
      setShowDeleteModal(false);
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting launch:", error);
      alert("Failed to delete launch.");
    }
  };

  const toggleSelectionMode = () => {
    if (userData?.role === 'Brand Team') return;
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedShoots([]);
    }
  };

  const handleSelectShoot = (id) => {
    if (selectedShoots.includes(id)) {
      setSelectedShoots(selectedShoots.filter(selectedId => selectedId !== id));
    } else {
      setSelectedShoots([...selectedShoots, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedShoots.length === filteredShoots.length) {
      setSelectedShoots([]);
    } else {
      setSelectedShoots(filteredShoots.map(shoot => shoot.id));
    }
  };

  const handleBulkSchedule = () => {
    if (selectedShoots.length === 0) {
      alert('Please select at least one launch to schedule shoot');
      return;
    }
    
    const firstBrand = shoots.find(s => s.id === selectedShoots[0])?.brandName || 'Combined';
    const formattedDate = new Date().toLocaleDateString('en-IN');
    setShootName(`${firstBrand} - Shoot ${formattedDate}`);
    setShootId(generateShootId());
    setShowBulkScheduleModal(true);
  };

  const confirmBulkSchedule = async () => {
    if (!bulkScheduleDate) {
      alert('Please select a date for the bulk schedule');
      return;
    }
    
    if (!shootName.trim()) {
      alert('Please enter a Shoot Name');
      return;
    }

    try {
      const perShootBudget = bulkBudget ? Number(bulkBudget) / selectedShoots.length : null;
      
      for (const id of selectedShoots) {
        const shootRef = doc(db, 'shoots', id);
        const updateData = {
          status: bulkScheduleStatus,
          shootDate: bulkScheduleDate,
          shootId: shootId,
          shootName: shootName.trim(),
          ...(bulkScheduleTime && { shootTime: convertTo12Hour(bulkScheduleTime) }),
          ...(bulkModelName && { modelName: bulkModelName }),
          ...(bulkStylist && { stylist: bulkStylist }),
          ...(bulkCameraMan && { cameraMan: bulkCameraMan }),
          ...(bulkLocation && { location: bulkLocation }),
          ...(bulkMakeupArtist && { makeupArtist: bulkMakeupArtist }),
          ...(perShootBudget && { budget: Math.round(perShootBudget) }),
          ...getTrackingFields()
        };
        await updateDoc(shootRef, updateData);
      }

      await addDoc(collection(db, 'shootgroups'), {
        Shootid: shootId,
        Shootname: shootName.trim(),
        ...(bulkMakeupArtist && { makeupArtist: bulkMakeupArtist }),
        ...(bulkModelName && { modelName: bulkModelName }),
        ...(bulkStylist && { stylist: bulkStylist }),
        ...(bulkLocation && { location: bulkLocation }),
        status: 'pending',
        Food_Travelbudget: 0,
        Makeupbudget: 0,
        Modelbudget: 0,
        Propsbudget: 0,
        Shootbudget: 0,
        Stylistbudget: 0,
        Totalbudget: 0,
        ShootDate: bulkScheduleDate,
        ShootTime: bulkScheduleTime || '',
        createdAt: new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
      });
      
      await loadShoots();
      
      setShowBulkScheduleModal(false);
      setBulkScheduleDate('');
      setBulkScheduleTime('');
      setBulkScheduleStatus('scheduled');
      setBulkModelName('');
      setSelectedPhotographers([]);
      setBulkBudget('');
      setBulkEditor('');
      setShootName('');
      setShootId('');
      setBulkLocation(''); 
      setSelectedShoots([]);
      setSelectionMode(false);
    } catch (error) {
      console.error("Error bulk scheduling:", error);
      alert("Failed to bulk schedule. Check console for details.");
    }
  };

  // Apply filters
  const filteredShoots = shoots.filter(shoot => {
    if (filters.brand && shoot.brandName !== filters.brand) return false;
    if (filters.collection && shoot.collection !== filters.collection) return false;
    if (filters.status !== 'all' && shoot.status !== filters.status) return false;
    if (filters.search && !shoot.brandName?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !shoot.collection?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !shoot.postId?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !shoot.product?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    
    if (filters.startDate && shoot.launchDate && shoot.launchDate < filters.startDate) return false;
    if (filters.endDate && shoot.launchDate && shoot.launchDate > filters.endDate) return false;
    
    return true;
  });

  // Sorting function
  const sortedShoots = [...filteredShoots].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? -1 : 1;
    if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? 1 : -1;
    
    if (sortField === 'launchDate' || sortField === 'shootDate') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const uniqueBrands = [...new Set(shoots.map(s => s.brandName))];
  const uniqueCollections = [...new Set(shoots.map(s => s.collection))];

  // Export to CSV function
  const exportToCSV = () => {
    const headers = [
      'Brand Name', 'Post ID', 'Product', 'Collection', 'Launch Date', 'Launch Time', 'Status',
      'Shoot ID', 'Shoot Name', 'Shoot Date', 'Shoot Time', 'Photographer',
      'Editor', 'Model Name', 'Budget', 'Location', 'Makeup Artist', 'Stylist', 
      'Camera Man', 'Designer', 'Remarks'
    ];

    const rows = sortedShoots.map(shoot => [
      shoot.brandName || '', shoot.postId || '', shoot.product || '', shoot.collection || '',
      shoot.launchDate || '', shoot.launchTime || '', shoot.status || '', shoot.shootId || '', shoot.shootName || '',
      shoot.shootDate || '', shoot.shootTime || '', shoot.photographer || '', shoot.editor || '',
      shoot.modelName || '', shoot.budget || '', shoot.location || '', shoot.makeupArtist || '',
      shoot.stylist || '', shoot.cameraMan || '', shoot.designer || '', shoot.remarks || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `launches_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get status color based on the image provided
  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#f59e0b';
      case 'scheduled': return '#3b82f6';
      case 'Rescheduled': return '#8b5cf6';
      case 'shootdone': return '#8b5cf6';
      case 'readytogo': return '#06b6d4';
      case 'launchdone': return '#6366f1';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Render cell based on field type with dropdowns for specific fields
  const renderEditableCell = (shoot, field) => {
    const value = editingData[field] || '';
    
    // Check if user can edit this field
    if (!canEditField(field)) {
      return <span className="readonly-cell">{value || '-'}</span>;
    }
    
    if (field === 'status') {
      return (
        <select
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="shootdone">Shoot Done</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="readytogo">Ready to Go</option>
          <option value="Rescheduled">Rescheduled</option>
        </select>
      );
    }
    
    if (field === 'brandName') {
      return (
        <select
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="">Select Brand</option>
          <option value="Prashanti">Prashanti</option>
          <option value="Wedtree">Wedtree</option>
          <option value="Maatshi">Maatshi</option>
          <option value="Manmandir">Manmandir</option>
        </select>
      );
    }
    
    if (field === 'location') {
      return (
        <select
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="">Select Location</option>
          {locationOptions.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      );
    }
    
    if (field === 'photographer' || field === 'cameraMan') {
      return (
        <div className="dropdown-with-add">
          <select
            value={value}
            onChange={(e) => handleInlineChange(field, e.target.value)}
            className="inline-select"
          >
            <option value="">Select {field === 'photographer' ? 'Photographer' : 'Camera Man'}</option>
            {mediaMembers.map(member => (
              <option key={member.id} value={member.memberName}>
                {member.memberName}
              </option>
            ))}
          </select>
        </div>
      );
    }
    
    if (field === 'editor') {
      return (
        <div className="dropdown-with-add">
          <select
            value={value}
            onChange={(e) => handleInlineChange(field, e.target.value)}
            className="inline-select"
          >
            <option value="">Select Editor</option>
            {editors.map(editor => (
              <option key={editor.id} value={editor.memberName}>
                {editor.memberName}
              </option>
            ))}
          </select>
        </div>
      );
    }
    
    if (field === 'launchDate' || field === 'shootDate' || field === 'launchTime') {
      if (field === 'launchTime') {
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleInlineChange(field, e.target.value)}
            className="inline-input"
          />
        );
      }
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-input"
        />
      );
    }
    
    if (field === 'budget') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-input"
          placeholder="0"
        />
      );
    }
    
    if (field === 'remarks') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-input"
          placeholder="Enter remarks..."
          style={{ minWidth: '150px' }}
        />
      );
    }

    if (field === 'shootTime') {
      return (
        <input
          type="time"
          value={value}
          onChange={(e) => handleInlineChange(field, e.target.value)}
          className="inline-input"
        />
      );
    }
    
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleInlineChange(field, e.target.value)}
        className="inline-input"
        placeholder={`Enter ${field}`}
      />
    );
  };

  const renderNewRowCell = (field) => {
    const value = newRow[field] || '';
    
    // Check if user can add this field
    if (!canEditField(field)) {
      if (field === 'brandName') return <span className="readonly-cell">-</span>;
      return <span className="readonly-cell">-</span>;
    }
    
    if (field === 'status') {
      return (
        <select
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="shootdone">Shoot Done</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="readytogo">Ready to Go</option>
          <option value="Rescheduled">Rescheduled</option>
        </select>
      );
    }
    
    if (field === 'location') {
      return (
        <select
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="">Select Location</option>
          {locationOptions.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      );
    }
    
    if (field === 'photographer' || field === 'cameraMan') {
      return (
        <select
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="">Select {field === 'photographer' ? 'Photographer' : 'Camera Man'}</option>
          {mediaMembers.map(member => (
            <option key={member.id} value={member.memberName}>
              {member.memberName}
            </option>
          ))}
        </select>
      );
    }
    
    if (field === 'editor') {
      return (
        <select
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="">Select Editor</option>
          {editors.map(editor => (
            <option key={editor.id} value={editor.memberName}>
              {editor.memberName}
            </option>
          ))}
        </select>
      );
    }

    if (field === 'brandName') {
      return (
        <select
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-select"
        >
          <option value="">Select Brand</option>
          <option value="Prashanti">Prashanti</option>
          <option value="Wedtree">Wedtree</option>
          <option value="Maatshi">Maatshi</option>
          <option value="Manmandir">Manmandir</option>
        </select>
      );
    }
    
    if (field === 'launchDate' || field === 'shootDate' || field === 'launchTime') {
      if (field === 'launchTime') {
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleNewRowChange(field, e.target.value)}
            className="inline-input"
          />
        );
      }
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-input"
        />
      );
    }
    
    if (field === 'budget') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-input"
          placeholder="0"
        />
      );
    }
    
    if (field === 'remarks') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-input"
          placeholder="Enter remarks..."
          style={{ minWidth: '150px' }}
        />
      );
    }

    if (field === 'shootTime') {
      return (
        <input
          type="time"
          value={newRow[field] || ''}
          onChange={(e) => handleNewRowChange(field, e.target.value)}
          className="inline-input"
        />
      );
    }
    
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleNewRowChange(field, e.target.value)}
        className="inline-input"
        placeholder={`Enter ${field}`}
      />
    );
  };

  const addNewPhotographer = async () => {
    if (!newMemberName.trim()) return;
    try {
      await addDoc(collection(db, 'MediaTeamMembers'), {
        memberName: newMemberName,
        memberRole: 'Photographer'
      });
      setNewMemberName('');
      setShowAddInput(false);
      await loadMediaMembers();
    } catch (err) {
      console.error("Error adding photographer:", err);
    }
  };

  const addNewEditor = async () => {
    if (!newEditorName.trim()) return;
    try {
      await addDoc(collection(db, 'MediaTeamMembers'), {
        memberName: newEditorName,
        memberRole: 'Editor'
      });
      setNewEditorName('');
      setShowAddEditorInput(false);
      await loadMediaMembers();
    } catch (err) {
      console.error("Error adding editor:", err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading launches from Firebase...</p>
      </div>
    );
  }

  // Define all columns for consistent alignment
  const columns = [
    { key: 'brandName', label: 'Brand Name', sortable: true },
    { key: 'postId', label: 'Post ID', sortable: true },
    { key: 'product', label: 'Launch Title', sortable: true },
    { key: 'collection', label: 'Product Type', sortable: true },
    { key: 'launchDate', label: 'Launch Date', sortable: true },
    { key: 'launchTime', label: 'Launch Time', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'shootId', label: 'Shoot ID', sortable: true },
    { key: 'shootName', label: 'Shoot Name', sortable: true },
    { key: 'shootDate', label: 'Shoot Date', sortable: true },
    { key: 'shootTime', label: 'Shoot Time', sortable: true },
    { key: 'photographer', label: 'Photographer', sortable: true },
    { key: 'editor', label: 'Editor', sortable: true },
    { key: 'modelName', label: 'Model Name', sortable: true },
    { key: 'budget', label: 'Budget', sortable: true },
    { key: 'location', label: 'Location', sortable: true },
    { key: 'makeupArtist', label: 'Makeup Artist', sortable: true },
    { key: 'stylist', label: 'Stylist', sortable: true },
    { key: 'cameraMan', label: 'Camera Man', sortable: true },
    { key: 'designer', label: 'Designer', sortable: true },
    { key: 'remarks', label: 'Remarks', sortable: true }
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Hi {userData?.name || 'User'}!</h1>
          <p>Manage and schedule product launches and photo/video shoots</p>
        </div>
      </div>

      <KPICards shoots={filteredShoots} />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        uniqueBrands={uniqueBrands}
        uniqueCollections={uniqueCollections}
      />

      {/* Add Cameraman and Editor Buttons - Only for Admin, Manager, Media Team */}
      {(userData?.role === 'Admin' || userData?.role === 'Manager' || userData?.role === 'Media Team') && (
        <div className="add-members-bar">
          <div className="add-members-group">
            {!showAddInput ? (
              <button className="btn-primary" onClick={() => setShowAddInput(true)}>
                + Add Cameraman
              </button>
            ) : (
              <div className="add-member-inline">
                <input
                  type="text"
                  placeholder="Enter cameraman name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="inline-input-small"
                />
                <button className="btn-primary-small" onClick={addNewPhotographer}>Save</button>
                <button className="btn-secondary-small" onClick={() => { setShowAddInput(false); setNewMemberName(''); }}>Cancel</button>
              </div>
            )}
            
            {!showAddEditorInput ? (
              <button className="btn-primary" onClick={() => setShowAddEditorInput(true)}>
                + Add Editor
              </button>
            ) : (
              <div className="add-member-inline">
                <input
                  type="text"
                  placeholder="Enter editor name"
                  value={newEditorName}
                  onChange={(e) => setNewEditorName(e.target.value)}
                  className="inline-input-small"
                />
                <button className="btn-primary-small" onClick={addNewEditor}>Save</button>
                <button className="btn-secondary-small" onClick={() => { setShowAddEditorInput(false); setNewEditorName(''); }}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export and Add New Row Buttons */}
      <div className="action-bar">
        <div className="result-count">
          {sortedShoots.length} launch(es) found
        </div>
        <div className="action-buttons-group">
          <button className="btn-primary" onClick={exportToCSV}>
            <Download size={16} />
            Export to CSV
          </button>
          {canAddNewLaunch() && (
            <button className="btn-primary" onClick={startAddingNew}>
              + Add New Launch
            </button>
          )}
        </div>
      </div>

      {userData?.role !== 'Brand Team' && (
        <div className="selection-mode-wrapper">
          <button className={`selection-mode-toggle ${selectionMode ? 'active' : ''}`} onClick={toggleSelectionMode}>
            {selectionMode ? '✓ Selection Mode' : <><Film size={16} /> Bulk Schedule</>}
          </button>
        </div>
      )}

      {selectionMode && selectedShoots.length > 0 && (
        <div className="bulk-actions-bar">
          <div className="bulk-info">
            <strong>{selectedShoots.length}</strong> launch(es) selected
          </div>
          <div className="bulk-buttons">
            <button className="btn-primary" onClick={handleBulkSchedule}>
              Bulk Schedule ({selectedShoots.length})
            </button>
            <button className="btn-secondary" onClick={handleSelectAll}>
              {selectedShoots.length === filteredShoots.length ? 'Deselect All' : 'Select All'}
            </button>
            <button className="exit-mode-btn" onClick={toggleSelectionMode}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Excel-like Editable Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {selectionMode && <th className="checkbox-col"><input type="checkbox" checked={selectedShoots.length === sortedShoots.length && sortedShoots.length > 0} onChange={handleSelectAll} /></th>}
              {columns.map(col => (
                <th 
                  key={col.key} 
                  onClick={() => col.sortable && handleSort(col.key)} 
                  className={col.sortable ? 'sortable' : ''}
                >
                  {col.label}
                  {col.sortable && <span className="sort-icon">{getSortIcon(col.key)}</span>}
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* New Row */}
            {isAddingNew && canAddNewLaunch() && (
              <tr className="new-row">
                {selectionMode && <td className="checkbox-cell"></td>}
                {columns.map(col => (
                  <td key={col.key}>
                    {renderNewRowCell(col.key)}
                  </td>
                ))}
                <td className="actions-cell">
                  <button className="btn-icon save-btn" onClick={saveNewRow} title="Save">
                    <Check size={16} />
                  </button>
                  <button className="btn-icon cancel-btn" onClick={cancelAddingNew} title="Cancel">
                    <X size={16} />
                  </button>
                </td>
              </tr>
            )}
            
            {/* Existing Rows */}
            {sortedShoots.length === 0 && !isAddingNew ? (
              <tr>
                <td colSpan={columns.length + (selectionMode ? 2 : 1)} className="empty-state">
                  No launches found matching your filters
                  <div>
                    <button className="btn-secondary" onClick={() => setFilters({ brand: '', collection: '', status: 'all', search: '', startDate: '', endDate: '' })}>
                      Clear Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedShoots.map((shoot) => (
                <tr key={shoot.id} className={selectionMode && selectedShoots.includes(shoot.id) ? 'selected-row' : ''}>
                  {selectionMode && (
                    <td className="checkbox-cell">
                      <input type="checkbox" checked={selectedShoots.includes(shoot.id)} onChange={() => handleSelectShoot(shoot.id)} />
                    </td>
                  )}
                  
                  {editingRow === shoot.id ? (
                    // Edit mode
                    <>
                      {columns.map(col => (
                        <td key={col.key}>
                          {renderEditableCell(shoot, col.key)}
                        </td>
                      ))}
                      <td className="actions-cell">
                        <button className="btn-icon save-btn" onClick={saveEditing} title="Save">
                          <Save size={14} />
                        </button>
                        <button className="btn-icon cancel-btn" onClick={cancelEditing} title="Cancel">
                          <X size={14} />
                        </button>
                      </td>
                    </>
                  ) : (
                    // View mode
                    <>
                      {columns.map(col => {
                        if (col.key === 'status') {
                          const statusValue = shoot[col.key] || 'pending';
                          return (
                            <td key={col.key}>
                              <span 
                                className="status-badge"
                                style={{ 
                                  backgroundColor: `${getStatusColor(statusValue)}20`,
                                  color: getStatusColor(statusValue),
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  textTransform: 'capitalize',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block'
                                }}
                              >
                                {statusValue}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'budget') {
                          return (
                            <td key={col.key}>
                              {shoot[col.key] ? `₹${shoot[col.key].toLocaleString()}` : '-'}
                            </td>
                          );
                        }
                        if (col.key === 'launchTime') {
                          return (
                            <td key={col.key}>
                              {shoot.launchTime ? convertTo12Hour(shoot.launchTime) : '-'}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key}>
                            {shoot[col.key] || '-'}
                          </td>
                        );
                      })}
                      <td className="actions-cell">
                        {/* Edit button - only show if user can edit at least one field */}
                        {(userData?.role === 'Admin' || userData?.role === 'Manager' || 
                          userData?.role === 'Brand Team' || userData?.role === 'Media Team') && (
                          <button className="btn-icon edit-btn" onClick={() => startEditing(shoot)} title="Edit">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {/* Delete button - only Admin and Manager */}
                        {canDelete() && (
                          <button className="btn-icon delete-btn" onClick={() => handleDeleteShoot(shoot.id)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Schedule Modal */}
      {showBulkScheduleModal && (
        <div className="calendar-modal-overlay" onClick={() => setShowBulkScheduleModal(false)}>
          <div className="calendar-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2>Bulk Schedule - Group Launches into One Shoot</h2>
              <button className="calendar-close-btn" onClick={() => setShowBulkScheduleModal(false)}>×</button>
            </div>
            <div className="bulk-schedule-form" style={{ padding: "24px" }}>
              <div className="bulk-info-box" style={{ marginBottom: "20px", padding: "12px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg-surface)" }}>
                <p>📋 You have selected <strong>{selectedShoots.length}</strong> launch(es):</p>
              </div>
              <div className="form-group">
                <label>Shoot Name *</label>
                <input value={shootName} onChange={(e) => setShootName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Shoot ID</label>
                <input value={shootId} readOnly />
              </div>
              <div className="form-group">
                <label>Shoot Date</label>
                <input type="date" value={bulkScheduleDate} onChange={(e) => setBulkScheduleDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Shoot Time</label>
                <input type="time" value={bulkScheduleTime} onChange={(e) => setBulkScheduleTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <select value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)}>
                  <option value="">Select Location</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Model Name</label>
                <input value={bulkModelName} onChange={(e) => setBulkModelName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Makeup Artist</label>
                <input value={bulkMakeupArtist} onChange={(e) => setBulkMakeupArtist(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Stylist</label>
                <input value={bulkStylist} onChange={(e) => setBulkStylist(e.target.value)} />
              </div>
              <div className="calendar-form-actions" style={{ marginTop: "24px" }}>
                <button className="calendar-btn-secondary" onClick={() => setShowBulkScheduleModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={confirmBulkSchedule}>Schedule {selectedShoots.length}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
      <div className="calendar-modal-overlay" onClick={() => setShowDeleteModal(false)}>
        <div className="calendar-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="calendar-modal-header">
            <h2>Delete Launch</h2>
            <button className="calendar-close-btn" onClick={() => setShowDeleteModal(false)}>×</button>
          </div>
          <div className="delete-confirm-body" style={{ padding: "24px" }}>
            <p>Are you sure you want to delete this launch?</p>
          </div>
          <div className="calendar-form-actions" style={{ marginTop: "0", padding: "16px 24px", borderTop: "1px solid var(--border-color)" }}>
            <button className="calendar-btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
            <button className="btn-danger" onClick={confirmDelete}>Delete</button>
          </div>
        </div>
      </div>
    )}

      <style>{`
        .dashboard-container {
          padding: 24px;
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
        }

        .dashboard-header {
          margin-bottom: 24px;
        }

        .dashboard-header h1 {
          font-size: 28px;
          margin-bottom: 8px;
          color: var(--text-primary);
        }

        .dashboard-header p {
          color: var(--text-muted);
        }

        .add-members-bar {
          margin-bottom: 16px;
          display: flex;
          justify-content: flex-end;
        }

        .add-members-group {
          display: flex;
          gap: 12px;
        }

        .add-member-inline {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .inline-input-small {
          padding: 6px 10px;
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--input-text);
          font-size: 12px;
        }

        .btn-primary-small {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }

        .btn-secondary-small {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }

        .action-bar {
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .result-count {
          font-size: 14px;
          color: var(--text-muted);
        }

        .action-buttons-group {
          display: flex;
          gap: 12px;
        }

        .selection-mode-wrapper {
          margin-bottom: 16px;
          display: flex;
          justify-content: flex-end;
        }

        .table-container {
          overflow-x: auto;
          margin-top: 20px;
          background: var(--bg-primary);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: max-content;
        }

        .data-table thead tr {
          background: var(--bg-secondary);
        }

        .data-table th {
          padding: 12px 10px;
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          white-space: nowrap;
        }

        .data-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .data-table th.sortable:hover {
          background: var(--bg-tertiary);
        }

        .sort-icon {
          margin-left: 6px;
          font-size: 11px;
          opacity: 0.7;
        }

        .data-table td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .data-table tbody tr:hover {
          background: var(--hover-bg);
        }

        .data-table tbody tr.selected-row {
          background: var(--selected-bg);
        }

        .data-table tbody tr.new-row {
          background: var(--bg-secondary);
        }

        .checkbox-col, .checkbox-cell {
          width: 40px;
          text-align: center;
        }

        .actions-col, .actions-cell {
          width: 80px;
          text-align: center;
          white-space: nowrap;
        }

        .inline-input, .inline-select {
          width: 100%;
          min-width: 100px;
          padding: 6px 8px;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 6px;
          color: var(--input-text);
          font-size: 12px;
        }

        .inline-input:focus, .inline-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .actions-cell {
          display: flex;
          gap: 6px;
          justify-content: center;
          align-items: center;
        }

        .btn-icon {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          transform: scale(1.05);
        }

        .edit-btn { color: #3b82f6; }
        .edit-btn:hover { background: #3b82f620; }
        
        .delete-btn { color: #ef4444; }
        .delete-btn:hover { background: #ef444420; }
        
        .save-btn { color: #10b981; }
        .save-btn:hover { background: #10b98120; }
        
        .cancel-btn { color: #f59e0b; }
        .cancel-btn:hover { background: #f59e0b20; }

        .btn-primary {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }

        .btn-secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-secondary:hover { background: var(--bg-tertiary); }

        .btn-danger {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-danger:hover { background: #dc2626; }

        .selection-mode-toggle {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .selection-mode-toggle.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .bulk-actions-bar {
          background: var(--bg-secondary);
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid var(--border-color);
        }

        .bulk-buttons {
          display: flex;
          gap: 12px;
        }

        .exit-mode-btn {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--bg-primary);
          border-radius: 16px;
          max-width: 500px;
          width: 90%;
          max-height: 90%;
          overflow-y: auto;
          border: 1px solid var(--border-color);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
          font-size: 18px;
          margin: 0;
          color: var(--text-primary);
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 24px;
          cursor: pointer;
        }

        .bulk-schedule-form, .delete-confirm-body {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
        }

        .form-group input, .form-group select {
          width: 100%;
          padding: 8px 12px;
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--input-text);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color);
        }

        .bulk-info-box {
          background: var(--bg-secondary);
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 20px;
          border: 1px solid var(--border-color);
        }

        .empty-state {
          text-align: center;
          padding: 60px !important;
          color: var(--text-muted);
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .spinner {
          border: 4px solid var(--border-color);
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        .readonly-cell {
          color: var(--text-muted);
          padding: 4px 0;
          display: inline-block;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;