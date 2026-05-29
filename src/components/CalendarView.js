import React, { useState, useEffect,useCallback } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { Search, X, Edit2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Trash2, Filter } from 'lucide-react';
import { db } from '../config';
import { collection, getDocs, updateDoc, doc,   addDoc } from 'firebase/firestore';

const CalendarView = ({ userData }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shoots, setShoots] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [editFormData, setEditFormData] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [groupActiveTab, setGroupActiveTab] = useState('details');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    launchStatus: '',
    cameramanStatus: '',
    editorStatus: '',
    designerStatus: '',
    shootStatus: '',
    brand: '',
    startDate: '',
    endDate: ''
  });

  const [setMediaMembers] = useState([]);
  const [editors, setEditors] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [shootGroupsData, setShootGroupsData] = useState([]);
  const [showAddLaunch, setShowAddLaunch] = useState(false);
  const [selectedLaunchIds, setSelectedLaunchIds] = useState([]);

  const [expenseData, setExpenseData] = useState({
    Food_Travelbudget: '',
    Makeupbudget: '',
    Modelbudget: '',
    Propsbudget: '',
    Shootbudget: '',
    Stylistbudget: '',
    Otherexpenses: ''
  });

  // Status mapping - lower number means earlier in the workflow
  const STATUS_MAPPING = {
    'pending': 0,
    'scheduled': 1,
    'shootdone': 2,
    'completed': 3,
    'readytogo': 4,
    'launchdone': 5,
    'cancelled': 6
  };

  // Reverse mapping to get status string from number
  const STATUS_REVERSE = {
    0: 'pending',
    1: 'scheduled',
    2: 'shootdone',
    3: 'completed',
    4: 'readytogo',
    5: 'launchdone'
  };



const loadShoots = useCallback(async () => {
  try {
    const shootsSnapshot = await getDocs(collection(db, 'shoots'));
    const shootsData = [];
    shootsSnapshot.forEach((doc) => {
      shootsData.push({ id: doc.id, ...doc.data() });
    });
    setShoots(shootsData);

    const groupsSnapshot = await getDocs(collection(db, 'shootgroups'));
    const groupsData = [];
    groupsSnapshot.forEach((doc) => {
      groupsData.push({ id: doc.id, ...doc.data() });
    });
    setShootGroupsData(groupsData);
    return shootsData;
  } catch (error) {
    console.error("Error loading shoots:", error);
  }
}, [setShoots, setShootGroupsData]); // 👈 Pass stable state setters as dependencies


// 3. Define loadMediaMembers outside useEffect, wrapped in useCallback
const loadMediaMembers = useCallback(async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'MediaTeamMembers'));
    const members = [];
    querySnapshot.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() });
    });
    setEditors(members.filter(m => m.memberRole === 'Editor'));
    setPhotographers(members.filter(m => m.memberRole === 'Photographer'));
    setMediaMembers(members);
  } catch (error) {
    console.error("Error loading members:", error);
  }
}, [setEditors, setPhotographers, setMediaMembers]); // 👈 Pass stable state setters as dependencies


// 4. Your useEffect now simply calls the accessible functions safely
useEffect(() => {
  loadShoots();
  loadMediaMembers();
}, [loadShoots, loadMediaMembers]);

  // Calculate the minimum status number among all launches
  const getMinimumStatusFromLaunches = (launches) => {
    if (!launches || launches.length === 0) return 'pending';
    
    const statusNumbers = launches.map(launch => {
      const statusValue = launch.status || 'pending';
      return STATUS_MAPPING[statusValue] ?? 0;
    });
    
    const minStatusNumber = Math.min(...statusNumbers);
    return STATUS_REVERSE[minStatusNumber];
  };

  // Auto-sync group status to shootgroups collection based on minimum launch status
  const syncGroupStatusToDb = async (shootId) => {
    try {
      const allShoots = await getDocs(collection(db, 'shoots'));
      const groupLaunches = [];
      
      allShoots.forEach((doc) => {
        const shootData = doc.data();
        if (shootData.shootId === shootId) {
          groupLaunches.push(shootData);
        }
      });
      
      if (groupLaunches.length === 0) return;
      
      const minStatus = getMinimumStatusFromLaunches(groupLaunches);
      
      const groupsSnapshot = await getDocs(collection(db, 'shootgroups'));
      let existingDocId = null;
      
      groupsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (String(data.Shootid).trim().toLowerCase() === String(shootId).trim().toLowerCase()) {
          existingDocId = docSnap.id;
        }
      });
      
      if (existingDocId) {
        const shootGroupRef = doc(db, 'shootgroups', existingDocId);
        await updateDoc(shootGroupRef, {
          status: minStatus,
          ...getTrackingFields()
        });
      }
    } catch (error) {
      console.error('Error syncing group status:', error);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      setExpenseData({
        Food_Travelbudget: selectedGroup.Food_Travelbudget || 0,
        Makeupbudget: selectedGroup.Makeupbudget || 0,
        Modelbudget: selectedGroup.Modelbudget || 0,
        Propsbudget: selectedGroup.Propsbudget || 0,
        Shootbudget: selectedGroup.Shootbudget || 0,
        Stylistbudget: selectedGroup.Stylistbudget || 0,
        Otherexpenses: selectedGroup.Otherexpenses || 0
      });
    }
  }, [selectedGroup]);

  const handleAddLaunches = async () => {
    try {
      const updatePromises = selectedLaunchIds.map(async (shootDocId) => {
        const launchRef = doc(db, 'shoots', shootDocId);
        await updateDoc(launchRef, {
          shootId: selectedGroup.shootId,
          shootName: selectedGroup.shootName,
          shootDate: selectedGroup.shootDate,
          shootTime: selectedGroup.shootTime,
          location: selectedGroup.location || '',
          remarks: selectedGroup.remarks || '',
          photographer: selectedGroup.photographer,
          editor: selectedGroup.editor,
          modelName: selectedGroup.modelName,
          makeupArtist: selectedGroup.makeupArtist,
          stylist: selectedGroup.stylist,
          cameraMan: selectedGroup.cameraMan,
          designer: selectedGroup.designer,
          status: selectedGroup.status,
          ...getTrackingFields()
        });
      });

      await Promise.all(updatePromises);
      
      if (selectedGroup.groupDocId) {
        const shootGroupRef = doc(db, 'shootgroups', selectedGroup.groupDocId);
        await updateDoc(shootGroupRef, {
          location: selectedGroup.location || '',
          remarks: selectedGroup.remarks || '',
          ...getTrackingFields()
        });
      }

      const updatedShoots = await loadShoots();
      const refreshedLaunches = updatedShoots.filter(
        s => s.shootId === selectedGroup.shootId
      );

      setSelectedGroup(prev => ({
        ...prev,
        launches: refreshedLaunches
      }));

      setShowAddLaunch(false);
      setSelectedLaunchIds([]);
      
      if (selectedGroup?.shootId) {
        await syncGroupStatusToDb(selectedGroup.shootId);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to add launches');
    }
  };

  const handleExpenseUpdate = async () => {
    try {
      const total =
        Number(expenseData.Food_Travelbudget || 0) +
        Number(expenseData.Makeupbudget || 0) +
        Number(expenseData.Modelbudget || 0) +
        Number(expenseData.Propsbudget || 0) +
        Number(expenseData.Shootbudget || 0) +
        Number(expenseData.Stylistbudget || 0) +
        Number(expenseData.Otherexpenses || 0);

      const expensePayload = {
        Food_Travelbudget: Number(expenseData.Food_Travelbudget || 0),
        Makeupbudget: Number(expenseData.Makeupbudget || 0),
        Modelbudget: Number(expenseData.Modelbudget || 0),
        Propsbudget: Number(expenseData.Propsbudget || 0),
        Shootbudget: Number(expenseData.Shootbudget || 0),
        Stylistbudget: Number(expenseData.Stylistbudget || 0),
        Otherexpenses: Number(expenseData.Otherexpenses || 0),
        Totalbudget: total
      };

      if (selectedGroup.groupDocId) {
        const shootGroupRef = doc(db, 'shootgroups', selectedGroup.groupDocId);
        await updateDoc(shootGroupRef, expensePayload);
      } else {
        const groupsSnapshot = await getDocs(collection(db, 'shootgroups'));
        let existingDocId = null;

        groupsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docShootId = String(data.Shootid || '').trim().toLowerCase();
          const groupShootId = String(selectedGroup.shootId || '').trim().toLowerCase();
          const docShootName = String(data.Shootname || '').trim().toLowerCase();
          const groupShootName = String(selectedGroup.shootName || '').trim().toLowerCase();

          if (
            (groupShootId && docShootId === groupShootId) ||
            (groupShootName && docShootName === groupShootName)
          ) {
            existingDocId = docSnap.id;
          }
        });

        if (existingDocId) {
          const shootGroupRef = doc(db, 'shootgroups', existingDocId);
          await updateDoc(shootGroupRef, expensePayload);
          setSelectedGroup(prev => ({ ...prev, groupDocId: existingDocId }));
        } else {
          const newDocRef = await addDoc(collection(db, 'shootgroups'), {
            Shootid: selectedGroup.shootId || '',
            Shootname: selectedGroup.shootName || '',
            ...expensePayload
          });
          setSelectedGroup(prev => ({ ...prev, groupDocId: newDocRef.id }));
        }
      }

      setSelectedGroup(prev => ({
        ...prev,
        ...expenseData,
        Totalbudget: total
      }));

      await loadShoots();
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Failed to update expenses');
    }
  };

  const handleSaveGroupEdit = async () => {
  try {
    if (!selectedGroup?.launches?.length) return;

    const shootNameValue = editFormData.shootName || selectedGroup.shootName || '';
    const shootDateValue = editFormData.shootDate || selectedGroup.shootDate || '';
    const shootTimeValue = editFormData.shootTime || selectedGroup.shootTime || '';

    // Build payload with only defined values
    const getValue = (fieldName) => {
      const formValue = editFormData[fieldName];
      const groupValue = selectedGroup[fieldName];
      
      if (formValue !== undefined && formValue !== '') return formValue;
      if (groupValue !== undefined && groupValue !== '') return groupValue;
      return null; // Use null instead of undefined for optional fields
    };

    const updatePayload = {
      shootName: shootNameValue,
      shootDate: shootDateValue,
      shootTime: shootTimeValue,
      location: getValue('location') || '',
      remarks: getValue('remarks') || '',
      photographer: Array.isArray(editFormData.photographer)
        ? editFormData.photographer.join(', ')
        : (editFormData.photographer || selectedGroup.photographer || ''),
      ...getTrackingFields()
    };

    // Only add optional fields if they have values (not null/undefined)
    const optionalFields = ['editor', 'modelName', 'makeupArtist', 'stylist', 'designer', 'status'];
    optionalFields.forEach(field => {
      const value = getValue(field);
      if (value !== null && value !== '') {
        updatePayload[field] = value;
      }
    });

    const updatePromises = selectedGroup.launches.map((launch) => {
      const launchRef = doc(db, 'shoots', launch.id);
      return updateDoc(launchRef, updatePayload);
    });

    await Promise.all(updatePromises);
    
    if (selectedGroup?.shootId) {
      await syncGroupStatusToDb(selectedGroup.shootId);
    }
    
    const groupsSnapshot = await getDocs(collection(db, 'shootgroups'));
    let existingDocId = null;

    groupsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (
        data.Shootid === selectedGroup.shootId ||
        data.Shootname === selectedGroup.shootName ||
        data.shootName === selectedGroup.shootName
      ) {
        existingDocId = docSnap.id;
      }
    });

    if (existingDocId) {
      const shootGroupRef = doc(db, 'shootgroups', existingDocId);
      const groupUpdatePayload = {
        Shootname: shootNameValue,
        shootName: shootNameValue,
        ShootDate: shootDateValue,
        ShootTime: shootTimeValue,
        location: getValue('location') || '',
        remarks: getValue('remarks') || '',
        ...getTrackingFields()
      };
      
      // Add optional fields only if they have values
      optionalFields.forEach(field => {
        const value = getValue(field);
        if (value !== null && value !== '') {
          groupUpdatePayload[field] = value;
        }
      });
      
      // Handle photographer separately
      const photographerValue = Array.isArray(editFormData.photographer)
        ? editFormData.photographer.join(', ')
        : (editFormData.photographer || selectedGroup.photographer || '');
      if (photographerValue) {
        groupUpdatePayload.photographer = photographerValue;
      }
      
      await updateDoc(shootGroupRef, groupUpdatePayload);
    }
    
    // Update selectedGroup state
    setSelectedGroup(prev => {
      const updated = { ...prev };
      const fieldsToUpdate = ['shootName', 'shootDate', 'shootTime', 'location', 'remarks', 'status'];
      
      fieldsToUpdate.forEach(field => {
        const value = editFormData[field];
        if (value !== undefined && value !== '') {
          updated[field] = value;
        }
      });
      
      // Handle photographer
      if (editFormData.photographer !== undefined) {
        updated.photographer = Array.isArray(editFormData.photographer)
          ? editFormData.photographer.join(', ')
          : editFormData.photographer;
      }
      
      // Handle optional fields
      optionalFields.forEach(field => {
        const value = editFormData[field];
        if (value !== undefined && value !== '') {
          updated[field] = value;
        }
      });
      
      return updated;
    });
    
    await loadShoots();
    closeModal();
    alert('Changes saved successfully!');
  } catch (error) {
    console.error('Error saving group edit:', error);
    alert('Failed to save changes. Error: ' + error.message);
  }
};

  // Group shoots by shootId (if present) or by id for regular shoots
  const groupShootsByShootId = (shootsList) => {
    const groups = new Map();
    
    shootsList.forEach(shoot => {
      if (shoot.shootId && shoot.shootId !== '' && shoot.shootName && shoot.shootName !== '') {
        if (!groups.has(shoot.shootId)) {
          const matchingGroup = shootGroupsData.find(
            g =>
              String(g.Shootid ?? g.shootId ?? '').trim().toLowerCase() ===
              String(shoot.shootId ?? '').trim().toLowerCase()
          );

          groups.set(shoot.shootId, {
            shootId: shoot.shootId,
            groupDocId: matchingGroup?.id || '',
            shootName: shoot.shootName || matchingGroup?.Shootname || matchingGroup?.shootName || 'Unnamed Shoot',
            shootDate: shoot.shootDate || matchingGroup?.ShootDate,
            shootTime: shoot.shootTime || matchingGroup?.ShootTime,
            photographer: shoot.photographer,
            editor: shoot.editor,
            modelName: shoot.modelName,
            designer: shoot.designer,
            cameraMan: shoot.cameraMan,
            makeupArtist: shoot.makeupArtist,
            stylist: shoot.stylist,
            budget: shoot.budget,
            createdAt: shoot.createdAt || '',
            Food_Travelbudget: matchingGroup?.Food_Travelbudget || 0,
            Makeupbudget: matchingGroup?.Makeupbudget || 0,
            Modelbudget: matchingGroup?.Modelbudget || 0,
            Propsbudget: matchingGroup?.Propsbudget || 0,
            Shootbudget: matchingGroup?.Shootbudget || 0,
            Stylistbudget: matchingGroup?.Stylistbudget || 0,
            Otherexpenses: matchingGroup?.Otherexpenses || 0,
            Totalbudget: matchingGroup?.Totalbudget || 0,
            location: shoot.location || matchingGroup?.location || '',
            remarks: shoot.remarks || matchingGroup?.remarks || '',
            launches: []
          });
        }
        // Push the launch with all its properties
        groups.get(shoot.shootId).launches.push({ ...shoot });
      } else {
        if (!shoot.shootId || shoot.shootId === '') {
          groups.set(shoot.id, {
            id: shoot.id,
            isSingle: true,
            shootName: shoot.brandName,
            shootDate: shoot.shootDate,
            shootTime: shoot.shootTime,
            status: shoot.status,
            photographer: shoot.photographer,
            editor: shoot.editor,
            modelName: shoot.modelName,
            cameraMan: shoot.cameraMan,
            designer: shoot.designer,
            makeupArtist: shoot.makeupArtist,
            stylist: shoot.stylist,
            budget: shoot.budget,
            launch: { ...shoot },
            cameramanStatus: shoot.cameramanStatus,
            editorStatus: shoot.editorStatus,
            designerStatus: shoot.designerStatus,
            brandName: shoot.brandName
          });
        }
      }
    });
    
    const groupsArray = Array.from(groups.values());
    groupsArray.forEach(group => {
      if (group.launches && group.launches.length > 0) {
        group.status = getMinimumStatusFromLaunches(group.launches);
      }
    });
    
    return groupsArray;
  };

  const getTrackingFields = () => {
    return {
      updatedUserEmail: userData?.email || 'Unknown',
      updatedTime: new Date().toISOString(),
    };
  };

  // Apply all filters to shoots - FIXED VERSION
  const applyFilters = (shootsToFilter) => {
    if (!shootsToFilter) return [];
    
    return shootsToFilter.filter(shoot => {
      // Filter by launch status (for grouped shoots)
      if (filters.launchStatus && shoot.launches) {
        const hasMatchingLaunch = shoot.launches.some(launch => {
          const launchStatus = launch.status || 'pending';
          return launchStatus === filters.launchStatus;
        });
        if (!hasMatchingLaunch) return false;
      }
      
      // Filter by cameraman status
      if (filters.cameramanStatus) {
        if (shoot.launches) {
          const hasMatchingLaunch = shoot.launches.some(launch => {
            const camStatus = launch.cameramanStatus || launch.photographerStatus || 'pending';
            return camStatus === filters.cameramanStatus;
          });
          if (!hasMatchingLaunch) return false;
        } else if (shoot.cameramanStatus) {
          if (shoot.cameramanStatus !== filters.cameramanStatus) return false;
        }
      }
      
      // Filter by editor status - FIXED
      if (filters.editorStatus) {
        if (shoot.launches) {
          const hasMatchingLaunch = shoot.launches.some(launch => {
            const editorStat = launch.editorStatus || 'pending';
            return editorStat === filters.editorStatus;
          });
          if (!hasMatchingLaunch) return false;
        } else if (shoot.editorStatus) {
          if (shoot.editorStatus !== filters.editorStatus) return false;
        } else if (shoot.launch && shoot.launch.editorStatus) {
          // For single shoots
          if (shoot.launch.editorStatus !== filters.editorStatus) return false;
        }
      }
      
      // Filter by designer status
      if (filters.designerStatus) {
        if (shoot.launches) {
          const hasMatchingLaunch = shoot.launches.some(launch => {
            const designStatus = launch.designerStatus || 'pending';
            return designStatus === filters.designerStatus;
          });
          if (!hasMatchingLaunch) return false;
        } else if (shoot.designerStatus) {
          if (shoot.designerStatus !== filters.designerStatus) return false;
        }
      }
      
      // Filter by shoot overall status
      if (filters.shootStatus) {
        const shootStatus = shoot.status || (shoot.launch?.status) || 'pending';
        if (shootStatus !== filters.shootStatus) return false;
      }
      
      // Filter by brand
      if (filters.brand) {
        if (shoot.launches) {
          const hasMatchingBrand = shoot.launches.some(launch => 
            launch.brandName?.toLowerCase().includes(filters.brand.toLowerCase())
          );
          if (!hasMatchingBrand) return false;
        } else if (shoot.brandName) {
          if (!shoot.brandName.toLowerCase().includes(filters.brand.toLowerCase())) return false;
        } else if (shoot.launch?.brandName) {
          if (!shoot.launch.brandName.toLowerCase().includes(filters.brand.toLowerCase())) return false;
        }
      }
      
      // Filter by date range (shoot date)
      if (filters.startDate && shoot.shootDate) {
        if (new Date(shoot.shootDate) < new Date(filters.startDate)) return false;
      }
      
      if (filters.endDate && shoot.shootDate) {
        if (new Date(shoot.shootDate) > new Date(filters.endDate)) return false;
      }
      
      return true;
    });
  };

  const filterShootsBySearch = (shootsToFilter) => {
    if (!searchTerm.trim()) return shootsToFilter;
    
    const searchLower = searchTerm.toLowerCase();
    return shootsToFilter.filter(shoot => {
      const groupStatusMatches = shoot.status?.toLowerCase().includes(searchLower);
      
      if (shoot.launches) {
        const launchMatches = shoot.launches.some(launch => 
          launch.brandName?.toLowerCase().includes(searchLower) ||
          launch.collection?.toLowerCase().includes(searchLower) ||
          launch.postId?.toLowerCase().includes(searchLower) ||
          launch.photographer?.toLowerCase().includes(searchLower) ||
          launch.editor?.toLowerCase().includes(searchLower) ||
          launch.modelName?.toLowerCase().includes(searchLower) ||
          launch.makeupArtist?.toLowerCase().includes(searchLower) ||
          launch.stylist?.toLowerCase().includes(searchLower) ||
          launch.cameraMan?.toLowerCase().includes(searchLower) ||
          launch.designer?.toLowerCase().includes(searchLower) ||
          launch.status?.toLowerCase().includes(searchLower) ||
          launch.location?.toLowerCase().includes(searchLower)
        );
        
        return launchMatches || groupStatusMatches;
      }
      
      return false;
    });
  };

  const getMatchingGroups = () => {
    let allGroups = groupShootsByShootId(shoots);
    allGroups = applyFilters(allGroups);
    allGroups = filterShootsBySearch(allGroups);
    return allGroups;
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== '');
  };

  const clearAllFilters = () => {
    setFilters({
      launchStatus: '',
      cameramanStatus: '',
      editorStatus: '',
      designerStatus: '',
      shootStatus: '',
      brand: '',
      startDate: '',
      endDate: ''
    });
    setSearchTerm('');
  };

  const getUniqueBrands = () => {
    const brands = new Set();
    shoots.forEach(shoot => {
      if (shoot.brandName) brands.add(shoot.brandName);
      if (shoot.launches) {
        shoot.launches.forEach(launch => {
          if (launch.brandName) brands.add(launch.brandName);
        });
      }
    });
    return Array.from(brands).sort();
  };

  const navigateToShootWeek = (shootDate) => {
    if (shootDate) {
      setCurrentDate(new Date(shootDate));
      setShowDatePicker(false);
    }
  };

  const getShootsForDay = (date) => {
    const dayShoots = shoots.filter(shoot => {
      if (!shoot.shootDate) return false;
      return isSameDay(new Date(shoot.shootDate), date);
    });
    
    let grouped = groupShootsByShootId(dayShoots);
    grouped = applyFilters(grouped);
    grouped = filterShootsBySearch(grouped);
    return grouped;
  };

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setEditFormData({ ...group });
    setShowGroupModal(true);
  };

  const handleShootClick = (shoot) => {
    setSelectedShoot(shoot);
    setEditFormData({
      ...shoot,
      photographer: shoot.photographer
        ? shoot.photographer.split(',').map(p => p.trim())
        : [],
      cameramanStatus: shoot.cameramanStatus || 'pending',
      editorStatus: shoot.editorStatus || 'pending',
      designerStatus: shoot.designerStatus || 'pending',
      cameramanCompletedAt: shoot.cameramanCompletedAt || '',
      editorCompletedAt: shoot.editorCompletedAt || '',
      designerCompletedAt: shoot.designerCompletedAt || ''
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowGroupModal(false);
    setSelectedShoot(null);
    setSelectedGroup(null);
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setDeletingGroup(null);
  };

  const handleEditToggle = () => {
    setIsEditing(true);
  };

  const handleEditChange = (e) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleSaveEdit = async () => {
    try {
      const shootRef = doc(db, 'shoots', selectedShoot.id);
      let shootGroupRef = null;

      const groupsSnapshot = await getDocs(collection(db, 'shootgroups'));
      let existingGroupDocId = null;
      
      groupsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.Shootid === selectedShoot.shootId) {
          existingGroupDocId = docSnap.id;
        }
      });
      
      if (existingGroupDocId) {
        shootGroupRef = doc(db, 'shootgroups', existingGroupDocId);
      }
      
      const isChangingToPending = selectedShoot.status !== 'pending' && 
                                   editFormData.status === 'pending';
      
      // Handle date/time stamps for role statuses
      const now = new Date().toISOString();
      let cameramanCompletedAt = editFormData.cameramanCompletedAt || '';
      let editorCompletedAt = editFormData.editorCompletedAt || '';
      let designerCompletedAt = editFormData.designerCompletedAt || '';
      
      if (editFormData.cameramanStatus === 'completed' && selectedShoot.cameramanStatus !== 'completed') {
        cameramanCompletedAt = now;
      } else if (editFormData.cameramanStatus !== 'completed') {
        cameramanCompletedAt = '';
      }
      
      if (editFormData.editorStatus === 'completed' && selectedShoot.editorStatus !== 'completed') {
        editorCompletedAt = now;
      } else if (editFormData.editorStatus !== 'completed') {
        editorCompletedAt = '';
      }
      
      if (editFormData.designerStatus === 'completed' && selectedShoot.designerStatus !== 'completed') {
        designerCompletedAt = now;
      } else if (editFormData.designerStatus !== 'completed') {
        designerCompletedAt = '';
      }
      
      let updatedData = { 
        ...editFormData,
        ...getTrackingFields(),
        editor: editFormData.editor || '',
        photographer: Array.isArray(editFormData.photographer)
          ? editFormData.photographer.join(', ')
          : editFormData.photographer || '',
        cameramanCompletedAt,
        editorCompletedAt,
        designerCompletedAt
      };
      
      if (isChangingToPending) {
        updatedData = {
          ...updatedData,
          shootId: '',
          shootName: '',
          shootDate: '',
          shootTime: '',
          photographer: '',
          editor: '',
          modelName: '',
          makeupArtist: '',
          stylist: '',
          cameraMan: '',
          designer: '',
          budget: 0,
          cameramanStatus: 'pending',
          editorStatus: 'pending',
          designerStatus: 'pending',
          cameramanCompletedAt: '',
          editorCompletedAt: '',
          designerCompletedAt: ''
        };
      }
      
      delete updatedData.id;
      
      await updateDoc(shootRef, updatedData);
      
      // Check if all role statuses are completed and update launch status
      if (editFormData.cameramanStatus === 'completed' && 
          editFormData.editorStatus === 'completed' && 
          editFormData.designerStatus === 'completed') {
        await updateDoc(shootRef, {
          status: 'readytogo',
          ...getTrackingFields()
        });
      }
      
      if (shootGroupRef && !isChangingToPending) {
        await updateDoc(shootGroupRef, {
          makeupArtist: editFormData.makeupArtist || '',
          modelName: editFormData.modelName || '',
          stylist: editFormData.stylist || '',
          photographer: Array.isArray(editFormData.photographer)
            ? editFormData.photographer.join(', ')
            : editFormData.photographer || '',
          editor: editFormData.editor || '',
          designer: editFormData.designer || '',
          ...getTrackingFields()
        });
      }
      
      await loadShoots();
      setSelectedShoot({ ...editFormData, ...updatedData });
      setIsEditing(false);

      if (selectedShoot.shootId) {
        await syncGroupStatusToDb(selectedShoot.shootId);
      }
      
      if (isChangingToPending) {
        alert("Status changed to Pending. Shoot-related fields have been cleared.");
      }
      
      closeModal();
    } catch (error) {
      console.error("Error updating shoot:", error);
      alert("Failed to update shoot. Check console for details.");
    }
  };

  const handleRemoveLaunchFromShoot = async (launch, event) => {
    event.stopPropagation();
    
    if (window.confirm(`Are you sure you want to remove "${launch.brandName}" from this shoot?\n\nThis will set status to Pending and clear all shoot-related fields.`)) {
      try {
        const launchRef = doc(db, 'shoots', launch.id);
        const updatedData = {
          status: 'pending',
          shootId: '',
          shootName: '',
          shootDate: '',
          shootTime: '',
          photographer: '',
          editor: '',
          modelName: '',
          makeupArtist: '',
          stylist: '',
          cameraMan: '',
          designer: '',
          budget: '',
          cameramanStatus: 'pending',
          editorStatus: 'pending',
          designerStatus: 'pending',
          cameramanCompletedAt: '',
          editorCompletedAt: '',
          designerCompletedAt: '',
          ...getTrackingFields()
        };
        
        await updateDoc(launchRef, updatedData);
        
        if (launch.shootId) {
          await syncGroupStatusToDb(launch.shootId);
        }
        
        await loadShoots();
        closeModal();
        alert(`Removed "${launch.brandName}" from shoot. Status changed to Pending.`);
      } catch (error) {
        console.error("Error removing launch from shoot:", error);
        alert("Failed to remove launch. Check console for details.");
      }
    }
  };

  const handleDeleteGroup = (group) => {
    setDeletingGroup(group);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteGroup = async () => {
    if (!deletingGroup || !deletingGroup.launches) return;
    
    try {
      const updatePromises = deletingGroup.launches.map(async (launch) => {
        const launchRef = doc(db, 'shoots', launch.id);
        const updatedData = {
          shootId: '',
          shootName: '',
          shootDate: '',
          shootTime: '',
          photographer: '',
          editor: '',
          modelName: '',
          budget: '',
          status: 'pending',
          makeupArtist: '',
          stylist: '',
          cameraMan: '',
          designer: '',
          cameramanStatus: 'pending',
          editorStatus: 'pending',
          designerStatus: 'pending',
          cameramanCompletedAt: '',
          editorCompletedAt: '',
          designerCompletedAt: '',
          ...getTrackingFields()
        };
        
        return updateDoc(launchRef, updatedData);
      });
      
      await Promise.all(updatePromises);

      if (deletingGroup.groupDocId) {
        const shootGroupRef = doc(db, 'shootgroups', deletingGroup.groupDocId);
        await updateDoc(shootGroupRef, {
          Status: 'cancelled',
          ...getTrackingFields()
        });
      }

      await loadShoots();
      closeModal();
      alert(`Successfully deleted shoot "${deletingGroup.shootName}" and reset ${deletingGroup.launches.length} launch(es) to pending.`);
    } catch (error) {
      console.error("Error deleting shoot group:", error);
      alert("Failed to delete shoot. Check console for details.");
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#f59e0b';
      case 'scheduled': return '#3b82f6';
      case 'shootdone': return '#8b5cf6';
      case 'completed': return '#10b981';
      case 'readytogo': return '#06b6d4';
      case 'launchdone': return '#6366f1';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, 'MMMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'Not completed';
    try {
      const date = new Date(dateTimeString);
      return format(date, 'MMM dd, yyyy hh:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const goToSpecificDate = () => {
    if (tempDate) {
      setCurrentDate(new Date(tempDate));
      setShowDatePicker(false);
      setTempDate('');
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const matchingGroups = getMatchingGroups();
  const matchingGroupsCount = matchingGroups.length;

  const sortShootsByTime = (shootsToSort) => {
    return [...shootsToSort].sort((a, b) => {
      const timeA = a.shootTime || '';
      const timeB = b.shootTime || '';
      if (timeA && timeB) {
        const compareA = convertToComparableTime(timeA);
        const compareB = convertToComparableTime(timeB);
        return compareA - compareB;
      }
      if (timeA) return -1;
      if (timeB) return 1;
      return 0;
    });
  };

  const convertToComparableTime = (time12h) => {
    if (!time12h) return 9999;
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    
    if (modifier === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return hours * 60 + parseInt(minutes, 10);
  };

  const statusOptions = ['pending', 'scheduled', 'shootdone', 'completed', 'readytogo', 'launchdone', 'cancelled'];
  const roleStatusOptions = ['pending', 'inprogress', 'completed'];

  return (
    <>
      <div className="calendar-container">
        <div className="calendar-header">
          <h2>Weekly Shoots Calendar View</h2>
          <div className="calendar-controls">
            <div className="nav-controls">
              <button onClick={prevWeek} className="btn-icon" title="Previous Week">
                <ChevronLeft size={18} />
              </button>
              <button onClick={today} className="btn-icon">Today</button>
              <button onClick={nextWeek} className="btn-icon" title="Next Week">
                <ChevronRight size={18} />
              </button>
            </div>
            
            <div className="date-picker-container">
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)} 
                className="btn-icon date-picker-btn"
                title="Jump to specific week"
              >
                <CalendarIcon size={16} />
                <span>Jump to Week</span>
              </button>
              
              {showDatePicker && (
                <div className="date-picker-dropdown">
                  <div className="date-picker-header">
                    <span>Select a date to view that week</span>
                  </div>
                  <input
                    type="date"
                    value={tempDate}
                    onChange={(e) => setTempDate(e.target.value)}
                    className="date-picker-input"
                  />
                  <div className="date-picker-actions">
                    <button onClick={() => setShowDatePicker(false)} className="btn-secondary-small">
                      Cancel
                    </button>
                    <button onClick={goToSpecificDate} className="btn-primary-small">
                      Go to Week
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <h3>{format(weekStart, 'MMMM d')} - {format(weekEnd, 'MMMM d, yyyy')}</h3>
        </div>

        {/* Search Bar and Filter Toggle */}
        <div className="calendar-search-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by post ID, brand, collection, photographer, editor, model, status, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button onClick={clearSearch} className="clear-search-btn">
                <X size={16} />
              </button>
            )}
          </div>
          <button 
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            <span>Filters</span>
            {hasActiveFilters() && <span className="filter-badge">●</span>}
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="filter-group">
                <label>Launch Status</label>
                <select
                  value={filters.launchStatus}
                  onChange={(e) => setFilters({...filters, launchStatus: e.target.value})}
                >
                  <option value="">All</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Cameraman Status</label>
                <select
                  value={filters.cameramanStatus}
                  onChange={(e) => setFilters({...filters, cameramanStatus: e.target.value})}
                >
                  <option value="">All</option>
                  {roleStatusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Editor Status</label>
                <select
                  value={filters.editorStatus}
                  onChange={(e) => setFilters({...filters, editorStatus: e.target.value})}
                >
                  <option value="">All</option>
                  {roleStatusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Designer Status</label>
                <select
                  value={filters.designerStatus}
                  onChange={(e) => setFilters({...filters, designerStatus: e.target.value})}
                >
                  <option value="">All</option>
                  {roleStatusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Shoot Overall Status</label>
                <select
                  value={filters.shootStatus}
                  onChange={(e) => setFilters({...filters, shootStatus: e.target.value})}
                >
                  <option value="">All</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Brand</label>
                <select
                  value={filters.brand}
                  onChange={(e) => setFilters({...filters, brand: e.target.value})}
                >
                  <option value="">All Brands</option>
                  {getUniqueBrands().map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                />
              </div>

              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                />
              </div>
            </div>
            
            <div className="filters-actions">
              {hasActiveFilters() && (
                <button className="clear-filters-btn" onClick={clearAllFilters}>
                  Clear All Filters
                </button>
              )}
              <span className="filter-results-count">
                {matchingGroupsCount} result(s) found
              </span>
            </div>
          </div>
        )}

        {searchTerm && !showFilters && (
          <div className="search-results-info">
            Found <strong>{matchingGroupsCount}</strong> matching shoot(s)
            {matchingGroupsCount > 0 && (
              <button 
                className="jump-to-first-btn"
                onClick={() => matchingGroups[0]?.shootDate && navigateToShootWeek(matchingGroups[0].shootDate)}
              >
                Jump to first result
              </button>
            )}
          </div>
        )}

        <div className="calendar-grid">
          {weekDays.map(day => {
            const dayShoots = getShootsForDay(day);
            const sortedDayShoots = sortShootsByTime(dayShoots);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div key={day.toString()} className={`calendar-day ${isToday ? 'today' : ''}`}>
                <div className="day-header">
                  <div className="day-name">{format(day, 'EEEE')}</div>
                  <div className={`day-date ${isToday ? 'today-date' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                <div className="day-shoots">
                  {sortedDayShoots.length === 0 ? (
                    <div className="no-shoots">
                      {searchTerm || hasActiveFilters() ? 'No matching shoots' : 'No shoots scheduled'}
                    </div>
                  ) : (
                    sortedDayShoots.map(group => (
                      <div 
                        key={group.shootId || group.id} 
                        className="calendar-shoot-card"
                        onClick={() => group.launches ? handleGroupClick(group) : handleShootClick(group.launch)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="shoot-time">
                          {group.launches ? '🎬' : '🎬'}
                          {group.shootName}
                        </div>
                        <div className="shoot-details">
                          {group.launches ? (
                            <>
                              {group.launches && (
                                <small>{group.launches.length} Launches</small>
                              )}
                            </>
                          ) : (
                            <>
                              <strong>{group.launch?.collection}</strong>
                              <small>{group.launch?.postId}</small>
                              {group.launch?.supplier && <small>{group.launch?.supplier}</small>}
                            </>
                          )}
                        </div>
                        <div 
                          className="shoot-status"
                          style={{ 
                            backgroundColor: getStatusColor(group.status),
                            color: 'white'
                          }}
                        >
                          {group.status}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx="true">{`
        .filter-toggle-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #e2e8f0;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .filter-toggle-btn:hover {
          background: #334155;
        }
        
        .filter-toggle-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
        }
        
        .filter-badge {
          color: #f59e0b;
          font-size: 12px;
          margin-left: 4px;
        }
        
        .filters-panel {
          background: #1e293b;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid #334155;
        }
        
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .filter-group label {
          font-size: 12px;
          font-weight: 500;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #e2e8f0;
          font-size: 14px;
        }
        
        .filter-group select:focus,
        .filter-group input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        .filters-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #334155;
        }
        
        .clear-filters-btn {
          padding: 8px 16px;
          background: #ef4444;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        
        .clear-filters-btn:hover {
          background: #dc2626;
        }
        
        .filter-results-count {
          font-size: 14px;
          color: #94a3b8;
        }
        
        .search-results-info {
          background: #1e293b;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        
        .jump-to-first-btn {
          padding: 6px 12px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-size: 12px;
        }
        
        .jump-to-first-btn:hover {
          background: #2563eb;
        }
        
        .search-input-wrapper {
          flex: 1;
          position: relative;
        }
        
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }
        
        .search-input {
          width: 100%;
          padding: 10px 12px 10px 36px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 14px;
        }
        
        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        .clear-search-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
        }
        
        .clear-search-btn:hover {
          color: #e2e8f0;
        }
        
        .calendar-search-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .calendar-container {
          padding: 20px;
          background: #0f172a;
          min-height: 100vh;
          color: #e2e8f0;
        }

        .calendar-header {
          margin-bottom: 24px;
        }

        .calendar-header h2 {
          margin-bottom: 16px;
          color: #f8fafc;
        }

        .calendar-controls {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .nav-controls {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          padding: 8px 12px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #e2e8f0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .btn-icon:hover {
          background: #334155;
        }

        .date-picker-container {
          position: relative;
        }

        .date-picker-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 12px;
          z-index: 1000;
          min-width: 250px;
        }

        .date-picker-header {
          margin-bottom: 12px;
          font-size: 14px;
          color: #94a3b8;
        }

        .date-picker-input {
          width: 100%;
          padding: 8px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 4px;
          color: #e2e8f0;
          margin-bottom: 12px;
        }

        .date-picker-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .btn-secondary-small,
        .btn-primary-small {
          padding: 6px 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 12px;
        }

        .btn-secondary-small {
          background: #334155;
          color: #e2e8f0;
        }

        .btn-primary-small {
          background: #3b82f6;
          color: white;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: #334155;
          border: 1px solid #334155;
          border-radius: 8px;
          overflow: hidden;
        }

        .calendar-day {
          background: #1e293b;
          min-height: 400px;
          display: flex;
          flex-direction: column;
        }

        .calendar-day.today {
          background: #1e3a5f;
        }

        .day-header {
          padding: 12px;
          text-align: center;
          border-bottom: 1px solid #334155;
        }

        .day-name {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .day-date {
          font-size: 24px;
          font-weight: 700;
          color: #94a3b8;
        }

        .today-date {
          color: #3b82f6;
        }

        .day-shoots {
          flex: 1;
          padding: 8px;
          overflow-y: auto;
          max-height: 400px;
        }

        .no-shoots {
          text-align: center;
          color: #64748b;
          font-size: 12px;
          padding: 16px;
        }

        .calendar-shoot-card {
          background: #0f172a;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border-left: 3px solid #3b82f6;
        }

        .calendar-shoot-card:hover {
          transform: translateX(2px);
          background: #1e293b;
        }

        .shoot-time {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #94a3b8;
        }

        .shoot-details {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 6px;
        }

        .shoot-details strong {
          display: block;
          color: #e2e8f0;
          font-size: 12px;
        }

        .shoot-status {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
      `}</style>

      {/* Rest of the modals remain the same */}
      {showGroupModal && selectedGroup && (
        <div className="calendar-modal-overlay" onClick={closeModal}>
          <div className="calendar-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2>🎬 {selectedGroup.shootName}</h2>
              <button className="calendar-close-btn" onClick={closeModal}>×</button>
            </div>
            
            <div className="tabs" style={{ padding: '20px 24px 0' }}>
              <button
                className={groupActiveTab === 'details' ? 'tab active' : 'tab'}
                onClick={() => setGroupActiveTab('details')}
              >
                Details
              </button>
              <button
                className={groupActiveTab === 'launches' ? 'tab active' : 'tab'}
                onClick={() => setGroupActiveTab('launches')}
              >
                Launches
              </button>
              <button
                className={groupActiveTab === 'expenses' ? 'tab active' : 'tab'}
                onClick={() => setGroupActiveTab('expenses')}
              >
                Expenses
              </button>
              <button
                className={groupActiveTab === 'editShoot' ? 'tab active' : 'tab'}
                onClick={() => setGroupActiveTab('editShoot')}
              >
                Edit Shoot
              </button>
            </div>

            <div className="group-details-section">
              {groupActiveTab === 'details' && (
                <div className="calendar-detail-section">
                  <h3>Shoot Information</h3>
                  <div className="calendar-detail-grid">
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Shoot ID:</span>
                      <span className="calendar-detail-value">{selectedGroup.shootId || 'N/A'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Shoot Name:</span>
                      <span className="calendar-detail-value">{selectedGroup.shootName}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Shoot Date:</span>
                      <span className="calendar-detail-value">{formatDate(selectedGroup.shootDate)}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Shoot Time:</span>
                      <span className="calendar-detail-value">{selectedGroup.shootTime || 'Not set'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Created at:</span>
                      <span className="calendar-detail-value">{selectedGroup.createdAt || 'N/A'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Status:</span>
                      <span className="calendar-detail-value" style={{ color: getStatusColor(selectedGroup.status) }}>
                        {selectedGroup.status || 'N/A'}
                      </span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Cameraman:</span>
                      <span className="calendar-detail-value">
                        {[...new Set(
                          (selectedGroup.launches || [])
                            .map(l => l.photographer)
                            .filter(v => v && v !== 'Unknown')
                        )].join(', ') || 'N/A'}
                      </span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Editor:</span>
                      <span className="calendar-detail-value">
                        {[...new Set(
                          (selectedGroup.launches || [])
                            .map(l => l.editor)
                            .filter(v => v && v !== 'Unknown')
                        )].join(', ') || 'N/A'}
                      </span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Model:</span>
                      <span className="calendar-detail-value">{selectedGroup.modelName || 'N/A'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Makeup Artist:</span>
                      <span className="calendar-detail-value">{selectedGroup.makeupArtist || 'N/A'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Stylist:</span>
                      <span className="calendar-detail-value">{selectedGroup.stylist || 'N/A'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Designer:</span>
                      <span className="calendar-detail-value">
                        {[...new Set(
                          (selectedGroup.launches || [])
                            .map(l => l.designer)
                            .filter(v => v && v !== 'Unknown')
                        )].join(', ') || 'N/A'}
                      </span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Shoot Remarks:</span>
                      <span className="calendar-detail-value">{selectedGroup.remarks || 'N/A'}</span>
                    </div>
                    <div className="calendar-detail-item">
                      <span className="calendar-detail-label">Total Budget:</span>
                      <span className="calendar-detail-value">₹{(Number(selectedGroup.Totalbudget) || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}

              {groupActiveTab === 'launches' && (
                <div className="calendar-detail-section">
                  <h3>Launches in this Shoot ({selectedGroup.launches.length})</h3>
                  <div style={{ marginBottom: '12px' }}>
                    <button
                      className="btn-primary"
                      onClick={() => { setShowAddLaunch(!showAddLaunch); setSelectedLaunchIds([]); }}
                    >
                      + Add Launch
                    </button>
                  </div>
                  {showAddLaunch && (
                    <div style={{ marginBottom: '16px', border: '1px solid #334155', borderRadius: '8px', padding: '12px', background: '#1e293b' }}>
                      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                        Select launches to add (pending shoots only):
                      </p>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {shoots
                          .filter(s => !s.shootId || s.shootId === '')
                          .map(s => (
                            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#e2e8f0' }}>
                              <input
                                type="checkbox"
                                checked={selectedLaunchIds.includes(s.id)}
                                onChange={(e) => {
                                  setSelectedLaunchIds(prev =>
                                    e.target.checked
                                      ? [...prev, s.id]
                                      : prev.filter(id => id !== s.id)
                                  );
                                }}
                              />
                              <span>{s.postId || 'No Post ID'}</span>
                              {s.brandName && <span style={{ color: '#64748b' }}>— {s.brandName}</span>}
                            </label>
                          ))
                        }
                      </div>
                      {selectedLaunchIds.length > 0 && (
                        <button
                          className="btn-primary"
                          style={{ marginTop: '10px' }}
                          onClick={handleAddLaunches}
                        >
                          Add {selectedLaunchIds.length} Launch(es)
                        </button>
                      )}
                    </div>
                  )}
                  <div className="launches-list">
                    {selectedGroup.launches.map((launch, idx) => (
                      <div key={launch.id} className="launch-item" onClick={() => { closeModal(); handleShootClick(launch); }}>
                        <div className="launch-item-header">
                          <strong>{launch.brandName}</strong>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="launch-item-status" style={{ backgroundColor: getStatusColor(launch.status) }}>
                              {launch.status}
                            </span>
                            <button 
                              className="remove-launch-btn"
                              onClick={(e) => handleRemoveLaunchFromShoot(launch, e)}
                              title="Remove from shoot (set to pending)"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div className="launch-item-details">
                          <span>Collection: {launch.collection || 'N/A'}</span>
                          <span>Post ID: {launch.postId || 'N/A'}</span>
                          {launch.shootTime && <span>Time: {launch.shootTime}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {groupActiveTab === 'expenses' && (
                <div className="calendar-detail-section">
                  <h3>Expenses</h3>
                  <div className="calendar-detail-grid">
                    <div className="form-group">
                      <label>Food & Travel Budget</label>
                      <input
                        type="number"
                        min="0"
                        value={expenseData.Food_Travelbudget}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Food_Travelbudget: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Makeup Budget</label>
                      <input
                        type="number"
                        value={expenseData.Makeupbudget}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Makeupbudget: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Model Budget</label>
                      <input
                        type="number"
                        value={expenseData.Modelbudget}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Modelbudget: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Props Budget</label>
                      <input
                        type="number"
                        value={expenseData.Propsbudget}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Propsbudget: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Shoot Budget</label>
                      <input
                        type="number"
                        value={expenseData.Shootbudget}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Shootbudget: Number(e.target.value)
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Stylist Budget</label>
                      <input
                        type="number"
                        value={expenseData.Stylistbudget}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Stylistbudget: Number(e.target.value)
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Other Expenses</label>
                      <input
                        type="number"
                        min="0"
                        value={expenseData.Otherexpenses}
                        onChange={(e) =>
                          setExpenseData({
                            ...expenseData,
                            Otherexpenses: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Total Budget</label>
                      <input
                        type="number"
                        readOnly
                        value={
                          Number(expenseData.Food_Travelbudget || 0) +
                          Number(expenseData.Makeupbudget || 0) +
                          Number(expenseData.Modelbudget || 0) +
                          Number(expenseData.Propsbudget || 0) +
                          Number(expenseData.Shootbudget || 0) +
                          Number(expenseData.Stylistbudget || 0) +
                          Number(expenseData.Otherexpenses || 0)
                        }
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    <button className="btn-primary" onClick={handleExpenseUpdate}>
                      Save Expenses
                    </button>
                  </div>
                </div>
              )}

              {groupActiveTab === 'editShoot' && (
                <div className="calendar-detail-section">
                  <h3>Edit Shoot</h3>
                  <div className="calendar-detail-grid">
                    <div className="form-group">
                      <label>Shoot Name</label>
                      <input
                        type="text"
                        className="edit-input"
                        value={editFormData.shootName || selectedGroup.shootName || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, shootName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Shoot Date</label>
                      <input
                        type="date"
                        className="edit-input"
                        value={editFormData.shootDate || selectedGroup.shootDate || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, shootDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Shoot Time</label>
                      <input
                        type="time"
                        className="edit-input"
                        value={editFormData.shootTime || selectedGroup.shootTime || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, shootTime: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Model Name</label>
                      <input
                        type="text"
                        className="edit-input"
                        value={editFormData.modelName || selectedGroup.modelName || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, modelName: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Makeup Artist</label>
                      <input
                        type="text"
                        className="edit-input"
                        value={editFormData.makeupArtist || selectedGroup.makeupArtist || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, makeupArtist: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Stylist</label>
                      <input
                        type="text"
                        className="edit-input"
                        value={editFormData.stylist || selectedGroup.stylist || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, stylist: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Location</label>
                      <select
                        className="edit-input"
                        value={editFormData.location || selectedGroup.location || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                      >
                        <option value="">Select Location</option>
                        <option value="Indoor">Indoor</option>
                        <option value="Outdoor">Outdoor</option>
                        <option value="Store">Store</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Shoot Remarks</label>
                      <textarea
                        className="edit-input"
                        rows="3"
                        placeholder="Add any remarks about the shoot..."
                        value={editFormData.remarks || selectedGroup?.remarks || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    <button className="btn-primary" onClick={handleSaveGroupEdit}>
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
              {['launches', 'details'].includes(groupActiveTab) && (
                <div className="calendar-form-actions">
                  <button 
                    className="calendar-btn-delete"
                    onClick={() => handleDeleteGroup(selectedGroup)}
                  >
                    <Trash2 size={16} />
                    <span>Delete Shoot</span>
                  </button>
                  <button className="calendar-btn-secondary" onClick={closeModal}>
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingGroup && (
        <div className="calendar-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="calendar-modal-content delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2>Confirm Delete</h2>
              <button className="calendar-close-btn" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="delete-confirm-content">
              <p>Are you sure you want to delete the shoot "<strong>{deletingGroup.shootName}</strong>"?</p>
              <p className="warning-text">⚠️ This action cannot be undone!</p>
            </div>
            <div className="calendar-form-actions">
              <button className="calendar-btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="calendar-btn-delete confirm" onClick={confirmDeleteGroup}>
                Yes, Delete Shoot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Shoot Edit Modal */}
      {showModal && selectedShoot && (
        <div className="calendar-modal-overlay" onClick={closeModal}>
          <div className="calendar-modal-content edit-mode" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2>{isEditing ? 'Edit Launch Details' : 'Shoot Details'}</h2>
              <button className="calendar-close-btn" onClick={closeModal}>×</button>
            </div>
            
            <div className="calendar-shoot-details-modal">
              {!isEditing ? (
                // View Mode
                <>
                  <div className="calendar-detail-section">
                    <h3>Shoot Identification</h3>
                    <div className="calendar-detail-grid">
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Shoot ID:</span>
                        <span className="calendar-detail-value">{selectedShoot.shootId || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Shoot Name:</span>
                        <span className="calendar-detail-value">{selectedShoot.shootName || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Basic Information</h3>
                    <div className="calendar-detail-grid">
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Brand Name:</span>
                        <span className="calendar-detail-value">{selectedShoot.brandName || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Status:</span>
                        <span className="calendar-detail-value" style={{ color: getStatusColor(selectedShoot.status) }}>
                          {selectedShoot.status || 'N/A'}
                        </span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Collection:</span>
                        <span className="calendar-detail-value">{selectedShoot.collection || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Product:</span>
                        <span className="calendar-detail-value">{selectedShoot.product || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Post ID:</span>
                        <span className="calendar-detail-value">{selectedShoot.postId || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Schedule Information</h3>
                    <div className="calendar-detail-grid">
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Shoot Date:</span>
                        <span className="calendar-detail-value">{formatDate(selectedShoot.shootDate)}</span>
                      </div>
                      {selectedShoot.shootTime && (
                        <div className="calendar-detail-item">
                          <span className="calendar-detail-label">Shoot Time:</span>
                          <span className="calendar-detail-value">{selectedShoot.shootTime}</span>
                        </div>
                      )}
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Launch Date:</span>
                        <span className="calendar-detail-value">{formatDate(selectedShoot.launchDate)}</span>
                      </div>
                      {selectedShoot.launchTime && (
                        <div className="calendar-detail-item">
                          <span className="calendar-detail-label">Launch Time:</span>
                          <span className="calendar-detail-value">{selectedShoot.launchTime}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Role Statuses</h3>
                    <div className="calendar-detail-grid">
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Cameraman Status:</span>
                        <span className="calendar-detail-value" style={{ color: selectedShoot.cameramanStatus === 'completed' ? '#10b981' : '#f59e0b' }}>
                          {selectedShoot.cameramanStatus || 'pending'}
                        </span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Cameraman Completed:</span>
                        <span className="calendar-detail-value">{formatDateTime(selectedShoot.cameramanCompletedAt)}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Editor Status:</span>
                        <span className="calendar-detail-value" style={{ color: selectedShoot.editorStatus === 'completed' ? '#10b981' : '#f59e0b' }}>
                          {selectedShoot.editorStatus || 'pending'}
                        </span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Editor Completed:</span>
                        <span className="calendar-detail-value">{formatDateTime(selectedShoot.editorCompletedAt)}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Designer Status:</span>
                        <span className="calendar-detail-value" style={{ color: selectedShoot.designerStatus === 'completed' ? '#10b981' : '#f59e0b' }}>
                          {selectedShoot.designerStatus || 'pending'}
                        </span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Designer Completed:</span>
                        <span className="calendar-detail-value">{formatDateTime(selectedShoot.designerCompletedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Financial & Additional Information</h3>
                    <div className="calendar-detail-grid">
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Cameraman:</span>
                        <span className="calendar-detail-value">{selectedShoot.photographer || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Editor:</span>
                        <span className="calendar-detail-value">{selectedShoot.editor || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Model:</span>
                        <span className="calendar-detail-value">{selectedShoot.modelName || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Makeup Artist:</span>
                        <span className="calendar-detail-value">{selectedShoot.makeupArtist || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Stylist:</span>
                        <span className="calendar-detail-value">{selectedShoot.stylist || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Designer:</span>
                        <span className="calendar-detail-value">{selectedShoot.designer || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Supplier:</span>
                        <span className="calendar-detail-value">{selectedShoot.supplier || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Tracking Information</h3>
                    <div className="calendar-detail-grid">
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Last Updated By:</span>
                        <span className="calendar-detail-value">{selectedShoot.updatedUserEmail || 'N/A'}</span>
                      </div>
                      <div className="calendar-detail-item">
                        <span className="calendar-detail-label">Last Updated:</span>
                        <span className="calendar-detail-value">
                          {selectedShoot.updatedTime ? format(new Date(selectedShoot.updatedTime), 'MMM dd, yyyy hh:mm a') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // Edit Mode
                <div className="edit-mode-form">
                  <div className="calendar-detail-section">
                    <h3>Basic Information</h3>
                    <div className="form-group">
                      <label>Brand Name</label>
                      <input
                        type="text"
                        name="brandName"
                        value={editFormData.brandName || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        name="status"
                        value={editFormData.status || 'pending'}
                        onChange={handleEditChange}
                        className="edit-select"
                      >
                        <option value="pending">Pending</option>
                        <option value="scheduled">Shoot Scheduled</option>
                        <option value="shootdone">Shoot Completed</option>
                        <option value="completed">Edit Completed</option>
                        <option value="readytogo">Ready to Go</option>
                        <option value="launchdone">Launch Done</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Collection</label>
                      <input
                        type="text"
                        name="collection"
                        value={editFormData.collection || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Product</label>
                      <input
                        type="text"
                        name="product"
                        value={editFormData.product || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Post ID</label>
                      <input
                        type="text"
                        name="postId"
                        value={editFormData.postId || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      />
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Schedule Information</h3>
                    <div className="form-group">
                      <label>Launch Date</label>
                      <input
                        type="date"
                        name="launchDate"
                        value={editFormData.launchDate || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Launch Time</label>
                      <input
                        type="text"
                        name="launchTime"
                        value={editFormData.launchTime || ''}
                        onChange={handleEditChange}
                        placeholder="e.g., 10:30 AM"
                        className="edit-input"
                      />
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Role Statuses</h3>
                    <div className="form-group">
                      <label>Cameraman Status</label>
                      <select
                        name="cameramanStatus"
                        value={editFormData.cameramanStatus || 'pending'}
                        onChange={handleEditChange}
                        className="edit-input"
                      >
                        <option value="pending">Pending</option>
                        <option value="inprogress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Editor Status</label>
                      <select
                        name="editorStatus"
                        value={editFormData.editorStatus || 'pending'}
                        onChange={handleEditChange}
                        className="edit-input"
                      >
                        <option value="pending">Pending</option>
                        <option value="inprogress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Designer Status</label>
                      <select
                        name="designerStatus"
                        value={editFormData.designerStatus || 'pending'}
                        onChange={handleEditChange}
                        className="edit-input"
                      >
                        <option value="pending">Pending</option>
                        <option value="inprogress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div className="calendar-detail-section">
                    <h3>Team Members</h3>
                    <div className="form-group">
                      <label>Cameraman</label>
                      <select
                        name="photographer"
                        value={editFormData.photographer || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      >
                        <option value="">Select Cameraman</option>
                        {photographers.map((member) => (
                          <option key={member.id} value={member.memberName}>
                            {member.memberName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Editor</label>
                      <select
                        name="editor"
                        value={editFormData.editor || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      >
                        <option value="">Select Editor</option>
                        {editors.map((member) => (
                          <option key={member.id} value={member.memberName}>
                            {member.memberName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Designer</label>
                      <input
                        type="text"
                        name="designer"
                        value={editFormData.designer || ''}
                        onChange={handleEditChange}
                        placeholder="Enter designer name"
                        className="edit-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Supplier</label>
                      <input
                        type="text"
                        name="supplier"
                        value={editFormData.supplier || ''}
                        onChange={handleEditChange}
                        className="edit-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        name="notes"
                        value={editFormData.notes || ''}
                        onChange={handleEditChange}
                        rows="3"
                        className="edit-textarea"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="calendar-form-actions">
              {!isEditing ? (
                <>
                  <button className="calendar-btn-edit" onClick={handleEditToggle}>
                    <Edit2 size={16} />
                    <span>Edit Launch</span>
                  </button>
                  <button className="calendar-btn-secondary" onClick={closeModal}>
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button className="calendar-btn-secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                  <button className="calendar-btn-save" onClick={handleSaveEdit}>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarView;