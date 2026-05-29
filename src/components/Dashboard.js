import React, { useState, useEffect } from 'react';
import ShootForm from './ShootForm';
import KPICards from './KPICards';
import ShootCard from './ShootCard';
import FilterBar from './FilterBar';
import { Film, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { db } from '../config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const Dashboard = ({ userData }) => {
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [launchAssignments, setLaunchAssignments] = useState({});
  const [editingShoot, setEditingShoot] = useState(null);
  const [filters, setFilters] = useState({
    brand: '',
    collection: '',
    status: 'all',
    search: '',
    startDate: '',
    endDate: ''
  });
  
  // Calendar week navigation state
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [showWeekDatePicker, setShowWeekDatePicker] = useState(false);
  const [tempWeekDate, setTempWeekDate] = useState('');

  // Multi-select states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedShoots, setSelectedShoots] = useState([]);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState('');
  const [bulkScheduleTime, setBulkScheduleTime] = useState('');
  const [bulkScheduleStatus, setBulkScheduleStatus] = useState('scheduled');
  const [bulkModelName, setBulkModelName] = useState('');
  const [bulkBudget, setBulkBudget] = useState('');
  const [, setBulkEditor] = useState('');
  const [bulkMakeupArtist, setBulkMakeupArtist] = useState('');
  const [bulkStylist, setBulkStylist] = useState('');
  const [bulkCameraMan] = useState('');
  // const [bulkDesigner, setBulkDesigner] = useState('');
  const [shootName, setShootName] = useState('');
  const [shootId, setShootId] = useState('');
  const [bulkLocation, setBulkLocation] = useState('');

// const [activeTab, setActiveTab] = useState('shoot');

const [,setSelectedPhotographers] = useState([]);
 

const [mediaMembers, setMediaMembers] = useState([]);
const [newMemberName, setNewMemberName] = useState('');
const [showAddInput, setShowAddInput] = useState(false);


const [editors, setEditors] = useState([]);
const [newEditorName, setNewEditorName] = useState('');
const [showAddEditorInput, setShowAddEditorInput] = useState(false);


const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deleteId, setDeleteId] = useState(null);



// const [newMemberName, setNewMemberName] = useState('');

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

    // Optional: filter only photographers
    // const photographers = members.filter(m => m.memberRole === 'Photographer');

    setMediaMembers(members.filter(m => m.memberRole === 'Photographer'));
    setEditors(members.filter(m => m.memberRole === 'Editor'));
  } catch (error) {
    console.error("Error loading members:", error);
  }
};

useEffect(() => {

  if (showBulkScheduleModal && selectedShoots.length > 0) {

    const initialAssignments = {};

    selectedShoots.forEach((launch) => {
      initialAssignments[launch.id] = {
        photographer: launch.photographer || '',
        editor: launch.editor || '',
        designer: launch.designer || ''
      };
    });

    setLaunchAssignments(initialAssignments);
  }

}, [showBulkScheduleModal, selectedShoots]);

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
      
      // Sort shoots by launchDate in descending order (most recent first)
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

  // Generate a unique shoot ID for grouping
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

  const handleAddShoot = async (newShoot) => {
    try {
      const shootWithTracking = {
        ...newShoot,
        ...getTrackingFields(),
        editor: newShoot.editor || 'Unknown',
        createdAt: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date())
      };
      
      const docRef = await addDoc(collection(db, 'shoots'), shootWithTracking);
      const updatedShoots = [{ id: docRef.id, ...shootWithTracking }, ...shoots];
      const sortedShoots = updatedShoots.sort((a, b) => {
        if (!a.launchDate) return 1;
        if (!b.launchDate) return -1;
        return new Date(b.launchDate) - new Date(a.launchDate);
      });
      setShoots(sortedShoots);
      setShowForm(false);
      // alert("New Launch added successfully!");
    } catch (error) {
      console.error("Error adding launch:", error);
      alert("Failed to add launch. Check console for details.");
    }
  };

  const handleUpdateShoot = async (updatedShoot) => {
  try {
    const shootRef = doc(db, 'shoots', updatedShoot.id);
    
    // Find original shoot to check if status is changing to 'pending'
    const originalShoot = shoots.find(s => s.id === updatedShoot.id);
    const isChangingToPending = originalShoot && 
                                 originalShoot.status !== 'pending' && 
                                 updatedShoot.status === 'pending';
    
    let updateWithTracking = {
      ...updatedShoot,
      ...getTrackingFields(),
      editor: updatedShoot.editor || 'Unknown'
    };
    
    // If changing to pending, clear all shoot-related fields
    if (isChangingToPending) {
      updateWithTracking = {
        ...updateWithTracking,
        shootId: '',
        shootName: '',
        shootDate: '',
        shootTime: '',
        photographer: '',
        editor: '',
        modelName: '',
        budget: 0
      };
    }
    
    delete updateWithTracking.id;
    
    await updateDoc(shootRef, updateWithTracking);
    const updatedShoots = shoots.map(shoot => 
      shoot.id === updatedShoot.id ? { ...updatedShoot, ...updateWithTracking } : shoot
    );
    const sortedShoots = updatedShoots.sort((a, b) => {
      if (!a.launchDate) return 1;
      if (!b.launchDate) return -1;
      return new Date(b.launchDate) - new Date(a.launchDate);
    });
    setShoots(sortedShoots);
    setEditingShoot(null);
    setShowForm(false);
    // alert("Launch updated successfully!");
  } catch (error) {
    console.error("Error updating Launch:", error);
    alert("Failed to update launch. Check console for details.");
  }
};


// const updateEditorOnly = async () => {
//   if (!bulkEditor.trim()) {
//     alert("Please enter an Editor Name");
//     return;
//   }

//   try {
//     for (const id of selectedShoots) {
//       const shootRef = doc(db, 'shoots', id);

//       await updateDoc(shootRef, {
//         editor: bulkEditor,
//         // editorStatus: 'pending',
//         ...getTrackingFields()
//       });
//     }

//     await loadShoots();

//     // reset only editor-related state
//     setBulkEditor('');
//     setShowBulkScheduleModal(false);
//     setSelectedShoots([]);
//     setSelectionMode(false);

//     // alert(`Editor updated for ${selectedShoots.length} launch(es)`);
//   } catch (error) {
//     console.error("Error updating editor:", error);
//     alert("Failed to update editor");
//   }
// };
  // const handleDeleteShoot = async (id) => {
  //   if (window.confirm('Are you sure you want to delete this launch?')) {
  //     try {
  //       await deleteDoc(doc(db, 'shoots', id));
  //       setShoots(shoots.filter(shoot => shoot.id !== id));
  //       setSelectedShoots(selectedShoots.filter(selectedId => selectedId !== id));
  //       alert("Launch deleted successfully!");
  //     } catch (error) {
  //       console.error("Error deleting launch:", error);
  //       alert("Failed to delete launch. Check console for details.");
  //     }
  //   }
  // };

  const handleDeleteShoot = (id) => {
  setDeleteId(id);
  setShowDeleteModal(true);
};

const confirmDelete = async () => {
  try {
    await deleteDoc(doc(db, 'shoots', deleteId));

    setShoots(prev => prev.filter(shoot => shoot.id !== deleteId));
    setSelectedShoots(prev => prev.filter(id => id !== deleteId));

    setShowDeleteModal(false);
    setDeleteId(null);

    // alert("Launch deleted successfully!");
  } catch (error) {
    console.error("Error deleting launch:", error);
    // alert("Failed to delete launch.");
  }
};
  const handleEdit = (shoot) => {
    setEditingShoot(shoot);
    setShowForm(true);
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
    
    // Auto-generate shoot name suggestion based on first selected brand
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
      // Calculate per-shoot budget if total budget is entered
      const perShootBudget = bulkBudget ? Number(bulkBudget) / selectedShoots.length : null;
      
      // Update each selected launch with the same shootId and shootName
      for (const id of selectedShoots) {
        const shootRef = doc(db, 'shoots', id);
        const updateData = {
          status: bulkScheduleStatus,
          shootDate: bulkScheduleDate,
          shootId: shootId, // Same ID for all selected launches
          shootName: shootName.trim(), // Same name for all selected launches
          // editor: bulkEditor || '',
          editor: launchAssignments[id]?.editor || '',
          // photographer: bulkPhotographer || '',
          // editor: bulkEditor || '',
          // editorname: bulkEditor || '',
          // ...(bulkEditor && { editor: bulkEditor }),
          ...(bulkScheduleTime && { shootTime: convertTo12Hour(bulkScheduleTime) }),
          ...(bulkModelName && { modelName: bulkModelName }),
          ...(bulkStylist && { stylist: bulkStylist }),
          ...(bulkCameraMan && { cameraMan: bulkCameraMan }),
          // ...(bulkDesigner && { designer: bulkDesigner }),
          ...(launchAssignments[id]?.designer && {
                designer: launchAssignments[id].designer
              }),
          ...(bulkLocation && { location: bulkLocation }),
          ...(bulkMakeupArtist && { makeupArtist: bulkMakeupArtist }),
          // ...(bulkPhotographer && { photographer: bulkPhotographer }),
          // ...(selectedPhotographers.length > 0 && { photographer: selectedPhotographers.join(', ') }),
          ...(launchAssignments[id]?.photographer && {
              photographer: launchAssignments[id].photographer
            }),
          ...(perShootBudget && { budget: Math.round(perShootBudget) }),
          ...getTrackingFields()
        };
        await updateDoc(shootRef, updateData);
      }

      await addDoc(collection(db, 'shootgroups'), {
          Shootid: shootId,
          Shootname: shootName.trim(),
          // ShootDate: bulkScheduleDate,
          // ShootTime: bulkScheduleTime || '',

          // Photographer: bulkPhotographer || '',
          // Editor: bulkEditor || '',
          // ModelName: bulkModelName || '',
          // MakeupArtist: bulkMakeupArtist || '',
          // Stylist: bulkStylist || '',

          // selectedLaunches: selectedShoots,
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
          // createdAt: new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata',dateStyle: 'medium',timeStyle: 'medium'}).format(new Date())
        });
      
      

      await loadShoots();
      
      setShowBulkScheduleModal(false);
      setBulkScheduleDate('');
      setBulkScheduleTime('');
      setBulkScheduleStatus('scheduled');
      setBulkModelName('');
      // setBulkPhotographer('');
      setSelectedPhotographers([]);
      setBulkBudget('');
      setBulkEditor('');
      setShootName('');
      setShootId('');
      setBulkLocation(''); 
      setSelectedShoots([]);
      setSelectionMode(false);
      
      // const successMessage = perShootBudget 
      //   ? `Successfully scheduled ${selectedShoots.length} launch(es) with Shoot ID: ${shootId}\nShoot Name: ${shootName}`
      //   : `Successfully scheduled ${selectedShoots.length} launch(es) with Shoot ID: ${shootId}\nShoot Name: ${shootName}`;
      // alert(successMessage);
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
    
    // Filter by launchDate
    if (filters.startDate && shoot.launchDate && shoot.launchDate < filters.startDate) return false;
    if (filters.endDate && shoot.launchDate && shoot.launchDate > filters.endDate) return false;
    
    return true;
    });

  const uniqueBrands = [...new Set(shoots.map(s => s.brandName))];
  // const uniquePhotographers = [...new Set(shoots.map(s => s.photographer))];
  const uniqueCollections = [...new Set(shoots.map(s => s.collection))];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading launches from Firebase...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Hi {userData?.name || 'User'}!</h1>
          <p>Manage and schedule product launches and photo/video shoots</p>
        </div>
        {/* <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={() => {
            setEditingShoot(null);
            setShowForm(true);
          }}>
            + Create Launch Schedule
          </button>
        </div> */}
        {userData?.role !== 'Media Team' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn-primary" 
              onClick={() => {
                setEditingShoot(null);
                setShowForm(true);
              }}
            >
              + Create Launch Schedule
            </button>
          </div>
        )}
      </div>

      {/* Pass filteredShoots instead of shoots for dynamic KPI updates */}
      <KPICards shoots={filteredShoots} />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        uniqueBrands={uniqueBrands}
        uniqueCollections={uniqueCollections}
      />

      {/* Selection Mode Toggle Button */}
      {/* <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className={`selection-mode-toggle ${selectionMode ? 'active' : ''}`}
          onClick={toggleSelectionMode}
        >
          {selectionMode ? (
            '✓ Selection Mode'
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin:'4px' }}>
              <Film size={16} />
              <span>Bulk Schedule</span>
            </div>
          )}
        </button>
      </div> */}
      {userData?.role !== 'Brand Team' && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className={`selection-mode-toggle ${selectionMode ? 'active' : ''}`}
            onClick={toggleSelectionMode}
          >
            {selectionMode ? (
              '✓ Selection Mode'
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin:'4px' }}>
                <Film size={16} />
                <span>Bulk Schedule</span>
              </div>
            )}
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

      {selectionMode && selectedShoots.length === 0 && (
        <div className="selection-mode-info">
          <span>Selection Mode Active</span>
          <button className="exit-mode-small" onClick={toggleSelectionMode}>
            Cancel
          </button>
        </div>
      )}

      {(() => {
        const weekStart = startOfWeek(currentWeekDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentWeekDate, { weekStartsOn: 1 });
        const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

        const getShootsForDay = (date) =>
          filteredShoots.filter(s => s.launchDate && isSameDay(new Date(s.launchDate), date));

        const getStatusColor = (status) => {
          switch (status) {
            case 'scheduled': return '#f59e0b';
            case 'completed': return '#10b981';
            case 'shootdone': return '#3b82f6';
            case 'cancelled': return '#ef4444';
            case  'pending': return '#ff0000';
            default: return '#6b7280';
          }
        };

        const unscheduled = filteredShoots.filter(s => !s.launchDate);

        return (
          <div className="calendar-container">
            <div className="calendar-header">
              <div className="calendar-controls">
                <div className="nav-controls">
                  <button className="btn-icon" onClick={() => setCurrentWeekDate(subWeeks(currentWeekDate, 1))} title="Previous Week">
                    <ChevronLeft size={18} />
                  </button>
                  <button className="btn-icon" onClick={() => setCurrentWeekDate(new Date())}>Today</button>
                  <button className="btn-icon" onClick={() => setCurrentWeekDate(addWeeks(currentWeekDate, 1))} title="Next Week">
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="date-picker-container">
                  <button className="btn-icon date-picker-btn" onClick={() => setShowWeekDatePicker(!showWeekDatePicker)} title="Jump to week">
                    <CalendarIcon size={16} />
                    <span>Jump to Week</span>
                  </button>
                  {showWeekDatePicker && (
                    <div className="date-picker-dropdown">
                      <div className="date-picker-header">
                        <span>Select a date to view that week</span>
                      </div>
                      <input
                        type="date"
                        value={tempWeekDate}
                        onChange={(e) => setTempWeekDate(e.target.value)}
                        className="date-picker-input"
                      />
                      <div className="date-picker-actions">
                        <button className="btn-secondary-small" onClick={() => setShowWeekDatePicker(false)}>Cancel</button>
                        <button className="btn-primary-small" onClick={() => {
                          if (tempWeekDate) {
                            setCurrentWeekDate(new Date(tempWeekDate));
                            setShowWeekDatePicker(false);
                            setTempWeekDate('');
                          }
                        }}>Go to Week</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <h3>{format(weekStart, 'MMMM d')} - {format(weekEnd, 'MMMM d, yyyy')}</h3>
            </div>

            <div className="calendar-grid">
              {weekDays.map(day => {
                const dayShoots = getShootsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toString()} className={`calendar-day ${isToday ? 'today' : ''}`}>
                    <div className="day-header">
                      <div className="day-name">{format(day, 'EEEE')}</div>
                      <div className={`day-date ${isToday ? 'today-date' : ''}`}>{format(day, 'd')}</div>
                    </div>
                    <div className="day-shoots">
                      {dayShoots.length === 0 ? (
                        <div className="no-shoots">No launches</div>
                      ) : (
                        dayShoots.map(shoot => (
                          <div
                            key={shoot.id}
                            className={`calendar-shoot-card ${
                              selectionMode && selectedShoots.includes(shoot.id) ? 'selected' : ''
                            }`}
                            onClick={() =>
                              selectionMode ? handleSelectShoot(shoot.id) : handleEdit(shoot)
                            }
                          >
                            <div className="shoot-time">
                              🎬 {shoot.brandName}
                            </div>
                            <div className="shoot-details">
                              <strong>{shoot.collection}</strong>
                              <small>{shoot.postId}</small>
                              {shoot.photographer && <small>📷 {shoot.photographer}</small>}
                            </div>
                            <div
                              className="shoot-status"
                              style={{ backgroundColor: getStatusColor(shoot.status), color: 'white' }}
                            >
                              {shoot.status}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {unscheduled.length > 0 && (
              <div>
                <h4 style={{ color: '#94a3b8', margin: '24px 0 12px', fontSize: '14px' }}>
                  📋 Unscheduled Launches ({unscheduled.length})
                </h4>
                <div className="shoots-grid">
                  {unscheduled.map(shoot => (
                    <ShootCard
                      key={shoot.id}
                      shoot={shoot}
                      onEdit={handleEdit}
                      onDelete={handleDeleteShoot}
                      isSelected={selectedShoots.includes(shoot.id)}
                      onSelect={handleSelectShoot}
                      selectionMode={selectionMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredShoots.length === 0 && (
              <div className="no-results">
                <p>No launches found matching your filters</p>
                <button className="btn-secondary" onClick={() => setFilters({ brand: '', collection: '', status: 'all', search: '', startDate: '', endDate: '' })}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Bulk Schedule Modal */}
      {showBulkScheduleModal && (
            <div className="modal-overlay" onClick={() => setShowBulkScheduleModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                
                <div className="modal-header">
                  <h2>Bulk Schedule - Group Launches into One Shoot</h2>
                  <button className="close-btn" onClick={() => setShowBulkScheduleModal(false)}>×</button>
                </div>

                <div className="bulk-schedule-form">

                  {/* ✅ Info Box */}
                  <div className="bulk-info-box">
                    <p>📋 You have selected <strong>{selectedShoots.length}</strong> launch(es):</p>
                  </div>

                  {/* ✅ TAB CONTENT INSIDE MODAL */}

                  <>
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
              <select
                value={bulkLocation}
                onChange={(e) => setBulkLocation(e.target.value)}
              >
                <option value="">Select Location</option>
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor</option>
                <option value="Store">Store</option>
              </select>
            </div>


                      <div className="launch-assignment-section">

                        <h3 style={{ marginBottom: '14px', color: '#f8fafc' }}>
                          Launch-wise Assignment
                        </h3>

                        <div
                          style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: '16px',
                            scrollSnapType: 'x mandatory',
                            paddingBottom: '10px',
                            WebkitOverflowScrolling: 'touch'
                          }}
                        >

                          {selectedShoots.map((shootId, index) => {

                            const launch = shoots.find(s => s.id === shootId);

                            if (!launch) return null;

                            return (

                            <div
                              key={shootId}
                              style={{
                                minWidth: '340px',
                                maxWidth: '340px',
                                flexShrink: 0,
                                scrollSnapAlign: 'start',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '12px',
                                padding: '16px'
                              }}
                            >

                              {/* HEADER */}
                              <div style={{ marginBottom: '16px' }}>

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                  }}
                                >

                                  <h4
                                    style={{
                                      margin: 0,
                                      color: '#f8fafc',
                                      fontSize: '15px'
                                    }}
                                  >
                                    {index + 1}. {launch.brandName || 'Unnamed Launch'}
                                  </h4>

                                  <span
                                    style={{
                                      fontSize: '12px',
                                      color: '#94a3b8'
                                    }}
                                  >
                                    {launch.launchDate || 'No Launch Date'}
                                  </span>

                                </div>

                                <div
                                  style={{
                                    marginTop: '6px',
                                    fontSize: '12px',
                                    color: '#64748b'
                                  }}
                                >
                                  Post ID: {launch.postId || 'N/A'}
                                </div>

                              </div>

                              {/* PHOTOGRAPHER */}
                              <div className="form-group">
                                <label>Cameraman</label>

                                <select
                                  value={launchAssignments[launch.id]?.photographer || ''}
                                  onChange={(e) => {
                                    setLaunchAssignments(prev => ({
                                      ...prev,
                                      [launch.id]: {
                                        ...prev[launch.id],
                                        photographer: e.target.value
                                      }
                                    }));
                                  }}
                                >
                                  <option value="">Select Cameraman</option>

                                  {mediaMembers
                                    .filter(m => m.memberRole === 'Photographer')
                                    .map(member => (
                                      <option
                                        key={member.id}
                                        value={member.memberName}
                                      >
                                        {member.memberName}
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* EDITOR */}
                              <div className="form-group">
                                <label>Editor</label>

                                <select
                                  value={launchAssignments[launch.id]?.editor || ''}
                                  onChange={(e) => {
                                    setLaunchAssignments(prev => ({
                                      ...prev,
                                      [launch.id]: {
                                        ...prev[launch.id],
                                        editor: e.target.value
                                      }
                                    }));
                                  }}
                                >
                                  <option value="">Select Editor</option>

                                  {editors.map(member => (
                                    <option
                                      key={member.id}
                                      value={member.memberName}
                                    >
                                      {member.memberName}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* DESIGNER */}
                              <div className="form-group">
                                <label>Designer</label>

                                <input
                                  type="text"
                                  placeholder="Enter designer name"
                                  value={launchAssignments[launch.id]?.designer || ''}
                                  onChange={(e) => {
                                    setLaunchAssignments(prev => ({
                                      ...prev,
                                      [launch.id]: {
                                        ...prev[launch.id],
                                        designer: e.target.value
                                      }
                                    }));
                                  }}
                                />
                              </div>

                            </div>
                          );
    })}

                        </div>
                      </div>


                      

                      {/* <div className="form-group">
                        <label>Photographer</label>

                        <select
                          value={bulkPhotographer}
                          onChange={(e) => setBulkPhotographer(e.target.value)}
                        >
                          <option value="">Select Photographer</option>
                          {mediaMembers.map((member) => (
                            <option key={member.id} value={member.memberName}>
                              {member.memberName}
                            </option>
                          ))}
                        </select>
                      </div> */}

                      

                       <div className="form-group">
                          {/* <label>Photographer</label> */}
                          {/* <div style={{ border: '1px solid #334155', borderRadius: '8px', padding: '8px', background: '#0f172a', maxHeight: '160px', overflowY: 'auto' }}>
                            {mediaMembers
                              .filter(m => m.memberRole === 'Photographer')
                              .map(m => (
                                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer', fontSize: '13px', color: '#e2e8f0' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedPhotographers.includes(m.memberName)}
                                    onChange={(e) => {
                                      setSelectedPhotographers(prev =>
                                        e.target.checked
                                          ? [...prev, m.memberName]
                                          : prev.filter(name => name !== m.memberName)
                                      );
                                    }}
                                  />
                                  {m.memberName}
                                </label>
                              ))
                            }
                          </div> */}

                          {/* Add new photographer inline */}
                           {!showAddInput ? (
                            <button className="btn-primary" type="button" style={{ marginTop: '8px' }} onClick={() => setShowAddInput(true)}>
                              + Add Cameraman
                            </button>
                          ) : (
                            <div className="add-member-group" style={{ marginTop: '8px' }}>
                              <input
                                type="text"
                                placeholder="Enter photographer name"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                autoFocus
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newMemberName.trim()) {
                                    await addDoc(collection(db, 'MediaTeamMembers'), {
                                      memberName: newMemberName,
                                      memberRole: 'Photographer'
                                    });
                                    setNewMemberName('');
                                    setShowAddInput(false);
                                    await loadMediaMembers();
                                  }
                                  if (e.key === 'Escape') {
                                    setShowAddInput(false);
                                    setNewMemberName('');
                                  }
                                }} 
                              />
                               <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => { setShowAddInput(false); setNewMemberName(''); }}
                              >
                                Cancel
                              </button> 
                             </div>
                          )}
                      </div>

                      {/* <div className="form-group">
                        <label>Editor</label>

                        <select
                          value={bulkEditor}
                          onChange={(e) => setBulkEditor(e.target.value)}
                        >
                          <option value="">Select Editor</option>
                          {editors.map((member) => (
                            <option key={member.id} value={member.memberName}>
                              {member.memberName}
                            </option>
                          ))}
                        </select>
                      </div> */}
                      

                      <div className="form-group">
                          {!showAddEditorInput ? (
                            <button
                              className="btn-primary"
                              type="button"
                              onClick={() => setShowAddEditorInput(true)}
                            >
                              + Add Editor
                            </button>
                          ) : (
                            <div className="add-member-group">
                              <input
                                type="text"
                                placeholder="Enter editor name"
                                value={newEditorName}
                                onChange={(e) => setNewEditorName(e.target.value)}
                                autoFocus
                              />

                              <button
                                className="btn-primary"
                                type="button"
                                onClick={async () => {
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
                                }}
                              >
                                Save
                              </button>

                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => {
                                  setShowAddEditorInput(false);
                                  setNewEditorName('');
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div> 

                      <div className="form-group">
                        <label>Model Name </label>
                        <input value={bulkModelName} onChange={(e) => setBulkModelName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Makeup Artist</label>
                        <input value={bulkMakeupArtist} onChange={(e) => setBulkMakeupArtist(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Stylist:</label>
                        <input value={bulkStylist} onChange={(e) => setBulkStylist(e.target.value)} />
                      </div>

                      {/* <div className="form-group">
                        <label>Stylist </label>
                        <input value={bulkStylist} onChange={(e) => setBulkStylist(e.target.value)} />
                      </div>

                      <div className="form-group">
                        <label>Camera man </label>
                        <input value={bulkCameraMan} onChange={(e) => setBulkCameraMan(e.target.value)} />
                      </div> */}

                      {/* <div className="form-group">
                        <label>Designer </label>
                        <input value={bulkDesigner} onChange={(e) => setBulkDesigner(e.target.value)} />
                      </div> */}
                    </>

                  {/* ✅ Actions */}
                  <div className="form-actions">
                    <button className="btn-secondary" onClick={() => setShowBulkScheduleModal(false)}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={confirmBulkSchedule}>
                      Schedule {selectedShoots.length}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

      {showForm && (
        <ShootForm
          onClose={() => {
            setShowForm(false);
            setEditingShoot(null);
          }}
          onSubmit={editingShoot ? handleUpdateShoot : handleAddShoot}
          onDelete={handleDeleteShoot}
          initialData={editingShoot}
          userEmail={userData?.email}
          userName={userData?.name}
        />
      )}
       
      {/* //Delete Confirmation Modal  */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="modal-header">
              <h2>Delete Launch</h2>
              <button className="close-btn" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>

            <div style={{ padding: '20px' }}>
              <p>Are you sure you want to delete this launch?</p>
            </div>

            <div className="form-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>

              <button 
                className="btn-danger"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>

          </div>
        </div>
      )}

      <style>
        {`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;