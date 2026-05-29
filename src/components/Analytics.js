import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { 
  Users, Video, PieChart as PieChartIcon, Activity, Target, IndianRupee,
  Filter, Download, Building, Clock, Eye
} from 'lucide-react';
import { format, startOfMonth, isWithinInterval } from 'date-fns';
import { db } from '../config';

const Analytics = () => {
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [shootGroupsData, setShootGroupsData] = useState([]);
  
  // New state variables for enhanced filtering
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Derived data for filters
  const [uniqueBrands, setUniqueBrands] = useState([]);
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [shootExpenses, setShootExpenses] = useState([]);


  useEffect(() => {
    loadShoots();
  }, []);

  // useEffect(() => {
  //   if (shoots.length > 0) {
  //     // Extract unique values for filters
  //     const brands = [...new Set(shoots.map(s => s.brandName).filter(Boolean))];
  //     const users = [...new Set(shoots.map(s => s.updatedUserEmail).filter(Boolean))];
  //     setUniqueBrands(brands);
  //     setUniqueUsers(users);
      
  //     // Calculate shoot expenses
  //     calculateShootExpenses();
  //   }
  // }, [shoots, shootGroupsData]);

  const loadShoots = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'shoots'));
      const shootsData = [];
      querySnapshot.forEach((doc) => {
        const shootData = { id: doc.id, ...doc.data() };
        // Don't filter out any status here - let the status filter handle it
        shootsData.push(shootData);
      });
      setShoots(shootsData);

      const groupsSnapshot = await getDocs(collection(db, 'shootgroups'));
      const groupsData = [];
      groupsSnapshot.forEach((doc) => {
        groupsData.push({ id: doc.id, ...doc.data() });
      });
      setShootGroupsData(groupsData);
    } catch (error) {
      console.error("Error loading shoots:", error);
    } finally {
      setLoading(false);
    }
  };

 useEffect(() => {
  if (shoots.length > 0) {
    // 1. Extract unique values
    const brands = [...new Set(shoots.map(s => s.brandName).filter(Boolean))];
    const users = [...new Set(shoots.map(s => s.updatedUserEmail).filter(Boolean))];
    setUniqueBrands(brands);
    setUniqueUsers(users);
    
    // 2. Calculate expenses directly inside
    const expenses = shootGroupsData.map(group => {
      const relatedShoots = shoots.filter(s => s.shootId === group.Shootid);
      const relatedBrands = [...new Set(relatedShoots.map(s => s.brandName).filter(Boolean))];
      const models = [...new Set(relatedShoots.map(s => s.modelName).filter(Boolean))];
      const editors = [...new Set(relatedShoots.map(s => s.editor).filter(Boolean))];
      const photographers = [...new Set(relatedShoots.map(s => s.photographer).filter(Boolean))];
      
      return {
        shootId: group.Shootid,
        shootName: group.Shootname,
        shootDate: group.ShootDate,
        brands: relatedBrands.join(', '),
        models: models.join(', '),
        editors: editors.join(', '),
        photographers: photographers.join(', '),
        totalBudget: group.Totalbudget || 0,
        foodTravelBudget: group.Food_Travelbudget || 0,
        makeupBudget: group.Makeupbudget || 0,
        modelBudget: group.Modelbudget || 0,
        propsBudget: group.Propsbudget || 0,
        shootBudget: group.Shootbudget || 0,
        stylistBudget: group.Stylistbudget || 0,
        launchCount: relatedShoots.length,
        status: group.status || 'pending',
        createdAt: group.createdAt,
        updatedTime: group.updatedTime,
        updatedUserEmail: group.updatedUserEmail
      };
    });
    
    setShootExpenses(expenses);
  }
}, [shoots, shootGroupsData, setUniqueBrands, setUniqueUsers, setShootExpenses]);

  // Enhanced filter function - filters based on SHOOT status (from shootgroups)
  const filterByCustomCriteria = (item) => {
    let isValid = true;
    
    // Date range filter
    if (useCustomRange && item.shootDate) {
      const shootDate = new Date(item.shootDate);
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      if (!isWithinInterval(shootDate, { start, end })) {
        isValid = false;
      }
    } else if (!useCustomRange && item.shootDate) {
      const shootDate = new Date(item.shootDate);
      if (shootDate.getMonth() !== selectedMonth || shootDate.getFullYear() !== selectedYear) {
        isValid = false;
      }
    }
    
    // Brand filter
    if (selectedBrand !== 'all' && item.brands && !item.brands.includes(selectedBrand)) {
      isValid = false;
    }
    
    // User (updated by) filter
    if (selectedUser !== 'all' && item.updatedUserEmail !== selectedUser) {
      isValid = false;
    }
    
    // Status filter - based on SHOOT status (from shootgroups)
    if (selectedStatus !== 'all' && item.status !== selectedStatus) {
      isValid = false;
    }
    
    return isValid;
  };

  // Filtered shoot expenses
  const filteredShootExpenses = shootExpenses.filter(filterByCustomCriteria);

  // Get all available shoot statuses for filter dropdown
  // const getAvailableStatuses = () => {
  //   const statuses = new Set();
  //   shootExpenses.forEach(expense => {
  //     if (expense.status) {
  //       statuses.add(expense.status);
  //     }
  //   });
  //   return Array.from(statuses);
  // };

  // Department wise analytics
  const getDepartmentAnalytics = () => {
    const departments = {
      'Media Team': { shoots: 0, budget: 0, launches: 0 },
      'Brand Team': { shoots: 0, budget: 0, launches: 0 },
      'Production': { shoots: 0, budget: 0, launches: 0 },
      'Post Production': { shoots: 0, budget: 0, launches: 0 }
    };
    
    filteredShootExpenses.forEach(expense => {
      // Assign based on editor/photographer or other criteria
      if (expense.editors && expense.editors.length > 0) {
        departments['Media Team'].shoots++;
        departments['Media Team'].budget += expense.totalBudget;
        departments['Media Team'].launches += expense.launchCount;
      }
      if (expense.brands && expense.brands.length > 0) {
        departments['Brand Team'].shoots++;
        departments['Brand Team'].budget += expense.totalBudget;
        departments['Brand Team'].launches += expense.launchCount;
      }
    });
    
    return Object.entries(departments).map(([name, data]) => ({
      name,
      shoots: data.shoots,
      budget: data.budget,
      launches: data.launches
    }));
  };

  // User activity tracking
  const getUserActivity = () => {
    const userMap = new Map();
    
    shootExpenses.forEach(expense => {
      if (expense.updatedUserEmail && expense.updatedUserEmail !== 'Unknown') {
        const data = userMap.get(expense.updatedUserEmail) || {
          updates: 0,
          shoots: 0,
          lastUpdated: null
        };
        data.updates++;
        data.shoots++;
        if (expense.updatedTime) {
          const updateDate = new Date(expense.updatedTime);
          if (!data.lastUpdated || updateDate > data.lastUpdated) {
            data.lastUpdated = updateDate;
          }
        }
        userMap.set(expense.updatedUserEmail, data);
      }
    });
    
    return Array.from(userMap, ([name, data]) => ({
      name,
      updates: data.updates,
      shoots: data.shoots,
      lastUpdated: data.lastUpdated ? format(data.lastUpdated, 'MMM dd, yyyy') : 'N/A'
    })).sort((a, b) => b.updates - a.updates).slice(0, 10);
  };

  // Shoot Status Analytics - based on SHOOT status (from shootgroups)
  const getShootStatusAnalytics = () => {
    const statusCount = {};
    
    filteredShootExpenses.forEach(expense => {
      const status = expense.status || 'pending';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    return Object.entries(statusCount).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count
    })).filter(item => item.count > 0);
  };

  // Brand wise expense breakdown
  const getBrandExpenseBreakdown = () => {
    const brandMap = new Map();
    
    filteredShootExpenses.forEach(expense => {
      const brands = expense.brands.split(', ');
      brands.forEach(brand => {
        if (brand && brand !== 'N/A') {
          const data = brandMap.get(brand) || {
            totalBudget: 0,
            foodTravel: 0,
            makeup: 0,
            modelBudget: 0,
            props: 0,
            shootBudget: 0,
            stylist: 0,
            shoots: 0,
            launches: 0
          };
          data.totalBudget += expense.totalBudget;
          data.foodTravel += expense.foodTravelBudget;
          data.makeup += expense.makeupBudget;
          data.modelBudget += expense.modelBudget;
          data.props += expense.propsBudget;
          data.shootBudget += expense.shootBudget;
          data.stylist += expense.stylistBudget;
          data.shoots++;
          data.launches += expense.launchCount;
          brandMap.set(brand, data);
        }
      });
    });
    
    return Array.from(brandMap, ([name, data]) => ({
      name,
      totalBudget: data.totalBudget,
      foodTravel: data.foodTravel,
      makeup: data.makeup,
      modelBudget: data.modelBudget,
      props: data.props,
      shootBudget: data.shootBudget,
      stylist: data.stylist,
      shoots: data.shoots,
      launches: data.launches,
      avgBudgetPerShoot: data.shoots > 0 ? data.totalBudget / data.shoots : 0
    })).sort((a, b) => b.totalBudget - a.totalBudget);
  };

  // Summary stats
  const totalShoots = filteredShootExpenses.length;
  const totalBudget = filteredShootExpenses.reduce((sum, s) => sum + (s.totalBudget || 0), 0);
  const totalLaunches = filteredShootExpenses.reduce((sum, s) => sum + (s.launchCount || 0), 0);
  const avgBudgetPerShoot = totalShoots > 0 ? totalBudget / totalShoots : 0;

  const COLORS = ['#5b8fb9', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec489a', '#14b8a6', '#a855f7', '#34d399', '#fb923c'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Status color mapping
  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Video shoot analytics & performance metrics</p>
        </div>
      </div>

      {/* Enhanced Filter Section */}
      <div className="filter-section">
        <div className="filter-header">
          <Filter size={18} />
          <h3>Advanced Filters</h3>
        </div>
        <div className="filter-grid">
          <div className="filter-group">
            <label>Date Range</label>
            <div className="date-range-toggle">
              <button 
                className={!useCustomRange ? 'active' : ''}
                onClick={() => setUseCustomRange(false)}
              >
                Month/Year
              </button>
              <button 
                className={useCustomRange ? 'active' : ''}
                onClick={() => setUseCustomRange(true)}
              >
                Custom Range
              </button>
            </div>
            {!useCustomRange ? (
              <div className="month-year-selector">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                  {months.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="custom-date-range">
                <input 
                  type="date" 
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
                <span>to</span>
                <input 
                  type="date" 
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
            )}
          </div>
          
          <div className="filter-group">
            <label>Brand</label>
            <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
              <option value="all">All Brands</option>
              {uniqueBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>User (Last Updated By)</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
              <option value="all">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Shoot Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="shootdone">Shoot Done</option>
              <option value="completed">Completed</option>
              <option value="readytogo">Ready to Go</option>
              <option value="launchdone">Launch Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        <div className="filter-actions">
          <button className="btn-secondary" onClick={() => {
            setSelectedBrand('all');
            setSelectedUser('all');
            setSelectedDepartment('all');
            setSelectedStatus('all');
            setUseCustomRange(false);
            setSelectedMonth(new Date().getMonth());
            setSelectedYear(new Date().getFullYear());
          }}>
            Clear Filters
          </button>
          <button className="btn-primary">
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="analytics-summary-grid-five">
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#5b8fb9' }}>
            <Video size={24} />
          </div>
          <div className="summary-info">
            <h3>Total Shoots</h3>
            <p className="summary-value">{totalShoots}</p>
            <span className="summary-label">Filtered shoots</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#10b981' }}>
            <IndianRupee size={24} />
          </div>
          <div className="summary-info">
            <h3>Total Budget</h3>
            <p className="summary-value">₹{totalBudget.toLocaleString('en-IN')}</p>
            <span className="summary-label">Filtered budget</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#f59e0b' }}>
            <Target size={24} />
          </div>
          <div className="summary-info">
            <h3>Total Launches</h3>
            <p className="summary-value">{totalLaunches}</p>
            <span className="summary-label">Products launched</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#8b5cf6' }}>
            <Clock size={24} />
          </div>
          <div className="summary-info">
            <h3>Avg Budget/Shoot</h3>
            <p className="summary-value">₹{Math.round(avgBudgetPerShoot).toLocaleString('en-IN')}</p>
            <span className="summary-label">Per shoot average</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#06b6d4' }}>
            <Building size={24} />
          </div>
          <div className="summary-info">
            <h3>Active Brands</h3>
            <p className="summary-value">{new Set(filteredShootExpenses.flatMap(e => e.brands.split(', ')).filter(Boolean)).size}</p>
            <span className="summary-label">This period</span>
          </div>
        </div>
      </div>

      {/* Shoot Status Analytics Card - Based on SHOOT status */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <Activity size={20} />
            <h2>Shoot Status Analytics</h2>
          </div>
          <span className="card-badge">Status Distribution (Shoot Level)</span>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={getShootStatusAnalytics()}
              cx="50%"
              cy="50%"
              label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              dataKey="count"
            >
              {getShootStatusAnalytics().map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name, props) => [`${value} shoot(s)`, props.payload.status]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Brand Wise Expense Breakdown */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <PieChartIcon size={20} />
            <h2>Brand Wise Expense Breakdown</h2>
          </div>
          <span className="card-badge">Budget & Launch Distribution</span>
        </div>
        <div className="two-columns">
          <div className="chart-column">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={getBrandExpenseBreakdown().slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  label={({ name, percent }) => {
                    const percentage = (percent * 100).toFixed(0);
                    return percentage > 5 ? `${name.substring(0, 10)}: ${percentage}%` : '';
                  }}
                  labelLine={false}
                  outerRadius={120}
                  innerRadius={50}
                  dataKey="totalBudget"
                >
                  {getBrandExpenseBreakdown().slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#1e293b" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #5b8fb9', borderRadius: '8px' }}
                  formatter={(value, name, props) => {
                    const item = props.payload;
                    return (
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{item.name}</div>
                        <div>💰 Total: ₹{item.totalBudget.toLocaleString('en-IN')}</div>
                        <div>🎬 Shoots: {item.shoots}</div>
                        <div>📦 Launches: {item.launches}</div>
                        <div>📊 Avg/Shoot: ₹{Math.round(item.avgBudgetPerShoot).toLocaleString('en-IN')}</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="table-column">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Shoots</th>
                  <th>Launches</th>
                  <th>Total Budget</th>
                  <th>Avg/Shoot</th>
                </tr>
              </thead>
              <tbody>
                {getBrandExpenseBreakdown().map((brand, idx) => (
                  <tr key={idx}>
                    <td><strong>{brand.name}</strong></td>
                    <td>{brand.shoots}</td>
                    <td>{brand.launches}</td>
                    <td>₹{brand.totalBudget.toLocaleString('en-IN')}</td>
                    <td>₹{Math.round(brand.avgBudgetPerShoot).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expense Breakdown by Category */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <IndianRupee size={20} />
            <h2>Expense Breakdown by Category</h2>
          </div>
          <span className="card-badge">Budget Distribution</span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={getBrandExpenseBreakdown().slice(0, 8)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #5b8fb9', borderRadius: '8px' }}
              formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
            />
            <Legend />
            <Bar dataKey="foodTravel" stackId="a" fill="#5b8fb9" name="Food & Travel" />
            <Bar dataKey="makeup" stackId="a" fill="#06b6d4" name="Makeup" />
            <Bar dataKey="modelBudget" stackId="a" fill="#10b981" name="Model" />
            <Bar dataKey="props" stackId="a" fill="#8b5cf6" name="Props" />
            <Bar dataKey="shootBudget" stackId="a" fill="#f59e0b" name="Shoot" />
            <Bar dataKey="stylist" stackId="a" fill="#ec489a" name="Stylist" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department Wise Analytics */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <Building size={20} />
            <h2>Department Wise Analytics</h2>
          </div>
          <span className="card-badge">Performance by Department</span>
        </div>
        <div className="two-columns">
          <div className="chart-column">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getDepartmentAnalytics()}
                  cx="50%"
                  cy="50%"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="budget"
                >
                  {getDepartmentAnalytics().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="table-column">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Shoots</th>
                  <th>Launches</th>
                  <th>Budget</th>
                </tr>
              </thead>
              <tbody>
                {getDepartmentAnalytics().map((dept, idx) => (
                  <tr key={idx}>
                    <td><strong>{dept.name}</strong></td>
                    <td>{dept.shoots}</td>
                    <td>{dept.launches}</td>
                    <td>₹{dept.budget.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Activity Tracking */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <Users size={20} />
            <h2>User Activity Tracking</h2>
          </div>
          <span className="card-badge">Last Updated By</span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={getUserActivity()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #5b8fb9', borderRadius: '8px' }}
              formatter={(value, name, props) => {
                const item = props.payload;
                return (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{item.name}</div>
                    <div>🔄 Updates: {item.updates}</div>
                    <div>🎬 Shoots: {item.shoots}</div>
                    <div>📅 Last Updated: {item.lastUpdated}</div>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="updates" fill="#5b8fb9" name="Number of Updates" radius={[8, 8, 0, 0]} />
            <Bar dataKey="shoots" fill="#10b981" name="Shoots Handled" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Shoot Expenses Table */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <Eye size={20} />
            <h2>Shoot/Launch Wise Expenses</h2>
          </div>
          <span className="card-badge">Detailed Breakdown</span>
        </div>
        <div className="table-responsive">
          <table className="analytics-table full-width">
            <thead>
              <tr>
                <th>Shoot Name</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Editor</th>
                <th>Photographer</th>
                <th>Launches</th>
                <th>Total Budget</th>
                <th>Shoot Status</th>
                <th>Last Updated By</th>
                <th>Shoot Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredShootExpenses.slice(0, 20).map((expense, idx) => (
                <tr key={idx}>
                  <td>{expense.shootName || 'N/A'}</td>
                  <td>{expense.brands || 'N/A'}</td>
                  <td>{expense.models || 'N/A'}</td>
                  <td>{expense.editors || 'N/A'}</td>
                  <td>{expense.photographers || 'N/A'}</td>
                  <td>{expense.launchCount}</td>
                  <td>₹{expense.totalBudget.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`status-badge status-${expense.status}`} style={{ backgroundColor: getStatusColor(expense.status) }}>
                      {expense.status || 'N/A'}
                    </span>
                  </td>
                  <td>{expense.updatedUserEmail || 'N/A'}</td>
                  <td>{expense.shootDate ? format(new Date(expense.shootDate), 'MMM dd, yyyy') : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .filter-section {
          background: #1e293b;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid #334155;
        }
        .filter-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          color: #e2e8f0;
        }
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-group label {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }
        .filter-group select, .filter-group input {
          padding: 8px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #e2e8f0;
          font-size: 14px;
        }
        .date-range-toggle {
          display: flex;
          gap: 8px;
        }
        .date-range-toggle button {
          padding: 6px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #94a3b8;
          cursor: pointer;
          font-size: 12px;
        }
        .date-range-toggle button.active {
          background: #5b8fb9;
          color: white;
          border-color: #5b8fb9;
        }
        .month-year-selector {
          display: flex;
          gap: 8px;
        }
        .custom-date-range {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .filter-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #334155;
        }
        .table-responsive {
          overflow-x: auto;
        }
        .full-width {
          width: 100%;
          min-width: 1200px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          color: white;
        }
        .btn-primary, .btn-secondary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          border: none;
        }
        .btn-primary {
          background: #5b8fb9;
          color: white;
        }
        .btn-secondary {
          background: #334155;
          color: #e2e8f0;
        }
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #5b8fb9;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Analytics;