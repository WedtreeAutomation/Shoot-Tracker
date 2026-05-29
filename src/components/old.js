import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Line
} from 'recharts';
import { 
  TrendingUp, Users, Camera, Video, Calendar as CalendarIcon, 
  PieChart as PieChartIcon, Activity, Target, IndianRupee
} from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../config';

const Analytics = () => {
  const [shoots, setShoots] = useState([]);
  const [groupedShoots, setGroupedShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadShoots();
  }, []);

  const loadShoots = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'shoots'));
      const shootsData = [];
      querySnapshot.forEach((doc) => {
        const shootData = { id: doc.id, ...doc.data() };
        // Filter out cancelled shoots at the source
        if (shootData.status !== 'cancelled') {
          shootsData.push(shootData);
        }
      });
      setShoots(shootsData);
    } catch (error) {
      console.error("Error loading shoots:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group shoots by shootId (treat as single shoot)
  const groupShootsByShootId = (shootsList) => {
    const groups = new Map();
    
    shootsList.forEach(shoot => {
      // If shoot has a shootId, group it
      if (shoot.shootId && shoot.shootId !== '') {
        if (!groups.has(shoot.shootId)) {
          groups.set(shoot.shootId, {
            shootId: shoot.shootId,
            shootName: shoot.shootName || 'Unnamed Shoot',
            shootDate: shoot.shootDate,
            shootTime: shoot.shootTime,
            status: shoot.status,
            photographer: shoot.photographer,
            editor: shoot.editor,
            modelName: shoot.modelName,
            budget: 0,
            launchCount: 0,
            brands: new Set(),
            collections: new Set(),
            postIds: new Set(),
            launches: [],
            updatedTime: shoot.updatedTime,
            updatedUserEmail: shoot.updatedUserEmail
          });
        }
        const group = groups.get(shoot.shootId);
        group.launchCount += 1;
        group.budget = (group.budget || 0) + (Number(shoot.budget) || 0);
        group.launches.push(shoot);
        if (shoot.brandName) group.brands.add(shoot.brandName);
        if (shoot.collection) group.collections.add(shoot.collection);
        if (shoot.postId) group.postIds.add(shoot.postId);
      } 
    });
    
    // Convert Sets to strings for display
    const result = Array.from(groups.values()).map(group => {
      if (group.brands) {
        return {
          ...group,
          brandsList: Array.from(group.brands).join(', '),
          collectionsList: Array.from(group.collections).join(', '),
          postIdsList: Array.from(group.postIds).join(', ')
        };
      }
      return group;
    });
    
    return result;
  };

  // Helper function to check if value is valid (not unknown/empty)
  const isValidValue = (value) => {
    if (!value) return false;
    const stringValue = String(value).trim().toLowerCase();
    return stringValue !== '' && 
           stringValue !== 'unknown' &&
           stringValue !== 'unknown editor' &&
           stringValue !== 'none' &&
           stringValue !== 'n/a' &&
           stringValue !== 'na';
  };

  // Filter shoots by selected month and year
  const filterByMonth = (shootsList) => {
    return shootsList.filter(shoot => {
      if (!shoot.shootDate) return false;
      if (shoot.status === 'cancelled') return false;
      const shootDate = new Date(shoot.shootDate);
      return shootDate.getMonth() === selectedMonth && 
             shootDate.getFullYear() === selectedYear;
    });
  };

  // Get grouped shoots for current month
  const getCurrentMonthGroupedShoots = () => {
    const filteredShoots = shoots.filter(shoot => {
      if (!shoot.shootDate) return false;
      if (shoot.status === 'cancelled') return false;
      const shootDate = new Date(shoot.shootDate);
      return shootDate.getMonth() === selectedMonth && 
             shootDate.getFullYear() === selectedYear;
    });
    return groupShootsByShootId(filteredShoots);
  };

  const currentMonthGroupedShoots = getCurrentMonthGroupedShoots();
  
  // 1. DOP (Director of Photography) Video Shoot Analytics
  const getDOPAnalytics = () => {
    const dopMap = new Map();
    currentMonthGroupedShoots.forEach(shoot => {
      if (isValidValue(shoot.photographer)) {
        const data = dopMap.get(shoot.photographer) || { shoots: 0, budget: 0, launches: 0 };
        data.shoots += 1;
        data.launches += shoot.launchCount || 1;
        data.budget += shoot.budget || 0;
        dopMap.set(shoot.photographer, data);
      }
    });
    return Array.from(dopMap, ([name, data]) => ({ 
      name, 
      shoots: data.shoots,
      launches: data.launches,
      budget: data.budget,
      avgBudget: data.budget / data.shoots 
    }))
    .sort((a, b) => b.shoots - a.shoots)
    .slice(0, 10);
  };

  // 2. Editor Video Analytics
  const getEditorAnalytics = () => {
    const editorMap = new Map();
    currentMonthGroupedShoots.forEach(shoot => {
      if (isValidValue(shoot.editor)) {
        const data = editorMap.get(shoot.editor) || { shoots: 0, budget: 0, launches: 0 };
        data.shoots += 1;
        data.launches += shoot.launchCount || 1;
        data.budget += shoot.budget || 0;
        editorMap.set(shoot.editor, data);
      }
    });
    return Array.from(editorMap, ([name, data]) => ({ 
      name, 
      shoots: data.shoots,
      launches: data.launches,
      budget: data.budget,
      avgBudget: data.budget / data.shoots 
    }))
    .sort((a, b) => b.shoots - a.shoots)
    .slice(0, 10);
  };

  // 3. Brand Breakdown - Video this month
  const getBrandAnalytics = () => {
    const brandMap = new Map();
    currentMonthGroupedShoots.forEach(shoot => {
      // For grouped shoots, use the consolidated brands list
      if (shoot.brandsList) {
        const brands = shoot.brandsList.split(', ');
        brands.forEach(brand => {
          if (isValidValue(brand)) {
            const data = brandMap.get(brand) || { shoots: 0, budget: 0, launches: 0 };
            data.shoots += 1;
            data.launches += shoot.launchCount || 1;
            data.budget += shoot.budget / brands.length;
            brandMap.set(brand, data);
          }
        });
      } else if (isValidValue(shoot.brandName)) {
        const data = brandMap.get(shoot.brandName) || { shoots: 0, budget: 0, launches: 0 };
        data.shoots += 1;
        data.launches += shoot.launchCount || 1;
        data.budget += shoot.budget || 0;
        brandMap.set(shoot.brandName, data);
      }
    });
    return Array.from(brandMap, ([name, data]) => ({ 
      name, 
      shoots: data.shoots,
      launches: data.launches,
      budget: data.budget,
      avgBudget: data.budget / data.shoots 
    }))
    .sort((a, b) => b.budget - a.budget);
  };

  // 4. Model Budget + Video Analytics
  const getModelAnalytics = () => {
    const modelMap = new Map();
    currentMonthGroupedShoots.forEach(shoot => {
      if (isValidValue(shoot.modelName)) {
        const data = modelMap.get(shoot.modelName) || { shoots: 0, budget: 0, launches: 0 };
        data.shoots += 1;
        data.launches += shoot.launchCount || 1;
        data.budget += shoot.budget || 0;
        modelMap.set(shoot.modelName, data);
      }
    });
    return Array.from(modelMap, ([name, data]) => ({ 
      name, 
      shoots: data.shoots,
      launches: data.launches,
      budget: data.budget,
      avgBudget: data.budget / data.shoots 
    }))
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 10);
  };

  // 5. Weekly Load Heat Map
  const getWeeklyHeatMap = () => {
    const weeks = [];
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
    
    let weekStart = new Date(firstDayOfMonth);
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    
    while (weekStart <= lastDayOfMonth) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      if (weekEnd >= firstDayOfMonth && weekStart <= lastDayOfMonth) {
        const weekRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
        const weekData = { week: weekRange };
        weekDays.forEach(day => { weekData[day] = 0; });
        
        currentMonthGroupedShoots.forEach(shoot => {
          if (shoot.shootDate) {
            const shootDate = new Date(shoot.shootDate);
            if (shootDate >= weekStart && shootDate <= weekEnd) {
              const dayName = weekDays[shootDate.getDay() === 0 ? 6 : shootDate.getDay() - 1];
              weekData[dayName]++;
            }
          }
        });
        
        weeks.push(weekData);
      }
      
      weekStart.setDate(weekStart.getDate() + 7);
    }
    
    return { weeks, weekDays };
  };

  const COLORS = [
    '#5b8fb9',  // Oceanic Blue (primary)
    '#06b6d4',  // Cyan/Teal
    '#10b981',  // Emerald Green
    '#8b5cf6',  // Purple
    '#f59e0b',  // Amber (muted)
    '#ec489a',  // Pink
    '#14b8a6',  // Teal
    '#a855f7',  // Light Purple
    '#34d399',  // Mint Green
    '#fb923c'   // Soft Orange
  ];
  
  const dopData = getDOPAnalytics();
  const editorData = getEditorAnalytics();
  const brandData = getBrandAnalytics();
  const modelData = getModelAnalytics();
  const { weeks, weekDays } = getWeeklyHeatMap();

  // Calculate summary stats based on grouped shoots
  const totalShoots = currentMonthGroupedShoots.length;
  const totalBudget = currentMonthGroupedShoots.reduce((sum, s) => sum + (s.budget || 0), 0);
  const uniqueDOPs = new Set(currentMonthGroupedShoots.filter(s => isValidValue(s.photographer)).map(s => s.photographer)).size;
  const uniqueEditors = new Set(currentMonthGroupedShoots.filter(s => isValidValue(s.editor)).map(s => s.editor)).size;
  const avgBudgetPerShoot = totalShoots > 0 ? totalBudget / totalShoots : 0;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
        <div className="month-selector">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="month-select"
          >
            {months.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="year-select"
          >
            {[2024, 2025, 2026, 2027,2028,2029,2030].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards - Only 5 KPIs in one row */}
      <div className="analytics-summary-grid-five">
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#5b8fb9' }}>
            <Video size={24} />
          </div>
          <div className="summary-info">
            <h3>Total Shoots</h3>
            <p className="summary-value">{totalShoots}</p>
            <span className="summary-label">This month</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#10b981' }}>
            <IndianRupee size={24} />
          </div>
          <div className="summary-info">
            <h3>Total Budget</h3>
            <p className="summary-value">₹{totalBudget.toLocaleString('en-IN')}</p>
            <span className="summary-label">This month</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#f59e0b' }}>
            <Camera size={24} />
          </div>
          <div className="summary-info">
            <h3>Active DOPs</h3>
            <p className="summary-value">{uniqueDOPs}</p>
            <span className="summary-label">Photographers</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#8b5cf6' }}>
            <Users size={24} />
          </div>
          <div className="summary-info">
            <h3>Active Editors</h3>
            <p className="summary-value">{uniqueEditors}</p>
            <span className="summary-label">This month</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#ef4444' }}>
            <Target size={24} />
          </div>
          <div className="summary-info">
            <h3>Avg Budget/Shoot</h3>
            <p className="summary-value">₹{Math.round(avgBudgetPerShoot).toLocaleString('en-IN')}</p>
            <span className="summary-label">This month</span>
          </div>
        </div>
      </div>

      {/* 1. Brand Breakdown - Video this month */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <PieChartIcon size={20} />
            <h2>Brand Breakdown - Video this month</h2>
          </div>
          <span className="card-badge">By Budget & Shoot Count</span>
        </div>
        <div className="two-columns">
          <div className="chart-column">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={brandData.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  label={({ name, percent }) => {
                    const percentage = (percent * 100).toFixed(0);
                    const displayName = name.length > 10 ? name.substring(0, 8) + '..' : name;
                    return percentage > 5 ? `${displayName}: ${percentage}%` : '';
                  }}
                  labelLine={false}
                  outerRadius={100}
                  innerRadius={40}
                  paddingAngle={2}
                  dataKey="budget"
                >
                  {brandData.slice(0, 8).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      stroke="#1e293b" 
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #5b8fb9',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                  formatter={(value, name, props) => {
                    const item = brandData.find(b => b.name === props.payload.name);
                    return (
                      <div>
                        {/* <div style={{ color: '#5b8fb9', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
                          {props.payload.name}
                        </div> */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', marginTop: '6px' }}>
                          <span>💰 Budget:</span>
                          <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{value.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', marginTop: '4px' }}>
                          <span>🎬 Shoots:</span>
                          <span style={{ fontWeight: 'bold', color: '#5b8fb9' }}>{item?.shoots || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', marginTop: '4px' }}>
                          <span>📦 Launches:</span>
                          <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{item?.launches || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', marginTop: '4px' }}>
                          <span>📊 Avg/Shoot:</span>
                          <span style={{ fontWeight: 'bold', color: '#06b6d4' }}>₹{Math.round(item?.avgBudget || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', color: '#e2e8f0', paddingTop: '16px' }}
                  formatter={(value, entry, index) => {
                    const item = brandData.find(b => b.name === value);
                    return `${value}`;
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
                {brandData.map((brand, idx) => (
                  <tr key={idx}>
                    <td><strong>{brand.name}</strong></td>
                    <td>{brand.shoots}</td>
                    <td>{brand.launches || brand.shoots}</td>
                    <td>₹{brand.budget.toLocaleString('en-IN')}</td>
                    <td>₹{Math.round(brand.avgBudget).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>      

      {/* 2 & 3: DOP and Editor Charts in same row */}
      <div className="two-charts-row">
        <div className="analytics-card half-width">
          <div className="card-header">
            <div className="card-title">
              <Camera size={20} />
              <h2>DOP Video Shoot Analytics</h2>
            </div>
            <span className="card-badge">Top 10 Photographers</span>
          </div>
          <div className="card-content">
           <ResponsiveContainer width="100%" height={350}>
  <ComposedChart data={dopData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
    <XAxis 
      dataKey="name" 
      stroke="#94a3b8" 
      angle={-45} 
      textAnchor="end" 
      height={80}
      tick={{ fontSize: 12, fill: '#94a3b8' }}
    />
    <YAxis 
      yAxisId="left" 
      stroke="#94a3b8" 
      domain={[0, 'auto']}
      allowDecimals={false}
      tickFormatter={(value) => Number.isInteger(value) ? value : ''}
    />
    <YAxis yAxisId="right" orientation="right" stroke="#5b8fb9" />
    <Tooltip 
  contentStyle={{ 
    backgroundColor: '#1e293b', 
    border: '1px solid #5b8fb9',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px'
  }}
  labelStyle={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '4px' }}
  formatter={(value, name, props) => {
    const item = dopData.find(d => d.name === props.payload.name);
    if (name === 'Total Budget (₹)') {
      return [`₹${value.toLocaleString('en-IN')}`, name];
    }
    if (name === 'Number of Shoots') {
      // Return shoots count and also show launches in a custom way
      return [value, name];
    }
    return [value, name];
  }}
  // Custom content renderer
  content={({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #5b8fb9', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ color: '#5b8fb9', fontWeight: 'bold', marginBottom: '8px' }}>{data.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px' }}>
            <span>🎬 Shoots:</span>
            <span style={{ fontWeight: 'bold', color: '#5b8fb9' }}>{data.shoots}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginTop: '4px' }}>
            <span>📦 Launches:</span>
            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{data.launches || data.shoots}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginTop: '4px' }}>
            <span>💰 Budget:</span>
            <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{data.budget.toLocaleString('en-IN')}</span>
          </div>
        </div>
      );
    }
    return null;
  }}
/>
    <Legend />
    <Bar yAxisId="left" dataKey="shoots" fill="#5b8fb9" name="Number of Shoots" radius={[8, 8, 0, 0]} />
    <Line yAxisId="right" type="monotone" dataKey="budget" stroke="#c5d3cd" name="Total Budget (₹)" strokeWidth={2} dot={{ r: 4, fill: '#5b8fb9' }} />
  </ComposedChart>
</ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-card half-width">
          <div className="card-header">
            <div className="card-title">
              <Activity size={20} />
              <h2>Editor Video Analytics</h2>
            </div>
            <span className="card-badge">Top 10 Editors</span>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={350}>
  <ComposedChart data={editorData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
    <XAxis 
      dataKey="name" 
      stroke="#94a3b8" 
      angle={-45} 
      textAnchor="end" 
      height={80}
      tick={{ fontSize: 12, fill: '#94a3b8' }}
    />
    <YAxis 
      yAxisId="left" 
      stroke="#94a3b8" 
      domain={[0, 'auto']}
      allowDecimals={false}
      tickFormatter={(value) => Number.isInteger(value) ? value : ''}
    />
    <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
    <Tooltip 
  contentStyle={{ 
    backgroundColor: '#1e293b', 
    border: '1px solid #5b8fb9',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px'
  }}
  labelStyle={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '4px' }}
  formatter={(value, name, props) => {
    const item = dopData.find(d => d.name === props.payload.name);
    if (name === 'Total Budget (₹)') {
      return [`₹${value.toLocaleString('en-IN')}`, name];
    }
    if (name === 'Number of Shoots') {
      // Return shoots count and also show launches in a custom way
      return [value, name];
    }
    return [value, name];
  }}
  // Custom content renderer
  content={({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #5b8fb9', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ color: '#5b8fb9', fontWeight: 'bold', marginBottom: '8px' }}>{data.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px' }}>
            <span>🎬 Shoots:</span>
            <span style={{ fontWeight: 'bold', color: '#5b8fb9' }}>{data.shoots}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginTop: '4px' }}>
            <span>📦 Launches:</span>
            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{data.launches || data.shoots}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginTop: '4px' }}>
            <span>💰 Budget:</span>
            <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{data.budget.toLocaleString('en-IN')}</span>
          </div>
        </div>
      );
    }
    return null;
  }}
/>
    <Legend />
    <Bar yAxisId="left" dataKey="shoots" fill="#10b981" name="Number of Shoots" radius={[8, 8, 0, 0]} />
    <Line yAxisId="right" type="monotone" dataKey="budget" stroke="#c5d3cd" name="Total Budget (₹)" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
  </ComposedChart>
</ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Weekly Load Heat Map */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <CalendarIcon size={20} />
            <h2>Weekly Load Heat Map - {months[selectedMonth]} {selectedYear}</h2>
          </div>
          <span className="card-badge">Shoot Distribution by Week & Day</span>
        </div>
        <div className="heatmap-weekly-container">
          <table className="heatmap-weekly-table">
            <thead>
              <tr>
                <th>Week Range</th>
                {weekDays.map(day => <th key={day}>{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, index) => {
                const weekValues = weekDays.map(day => week[day] || 0);
                const maxShoots = Math.max(...weekValues, 1);
                const allShoots = weeks.flatMap(w => weekDays.map(day => w[day] || 0));
                const globalMax = Math.max(...allShoots, 1);
                
                return (
                  <tr key={index}>
                    <td className="week-label">{week.week}</td>
                    {weekDays.map(day => {
                      const shoots = week[day] || 0;
                      const intensity = Math.min(shoots / globalMax, 1);
                      let bgColor;
                      if (shoots === 0) {
                        bgColor = '#0f172a';
                      } else if (intensity <= 0.25) {
                        bgColor = '#1e3a5f';
                      } else if (intensity <= 0.5) {
                        bgColor = '#2c5a7a';
                      } else if (intensity <= 0.75) {
                        bgColor = '#3a7a9e';
                      } else {
                        bgColor = '#5b8fb9';
                      }
                      
                      return (
                        <td 
                          key={day} 
                          className="heatmap-weekly-cell"
                          style={{ 
                            backgroundColor: bgColor,
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                          title={`${week.week} - ${day}: ${shoots} shoot(s)`}
                        >
                          <div className="heatmap-weekly-value" style={{ 
                            color: intensity > 0.5 ? 'white' : '#e2e8f0',
                            fontWeight: shoots > 0 ? 'bold' : 'normal'
                          }}>
                            {shoots}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Model Budget & Video Analytics */}
      <div className="analytics-card">
        <div className="card-header">
          <div className="card-title">
            <IndianRupee size={20} />
            <h2>Model Budget & Video Analytics</h2>
          </div>
          <span className="card-badge">Budget Distribution</span>
        </div>
        <div className="card-content">
          <ResponsiveContainer width="100%" height={450}>
  <ComposedChart data={modelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
    <XAxis 
      dataKey="name" 
      stroke="#94a3b8" 
      angle={-45} 
      textAnchor="end" 
      height={100}
      tick={{ fontSize: 12, fill: '#94a3b8' }}
    />
    {/* <YAxis yAxisId="left" stroke="#94a3b8" /> */}
    <YAxis 
      yAxisId="left" 
      stroke="#94a3b8" 
      domain={[0, 'auto']}
      allowDecimals={false}
      tickFormatter={(value) => Number.isInteger(value) ? value : ''}
    />
    <YAxis yAxisId="right" orientation="right" stroke="#5b8fb9" />
    <Tooltip 
  contentStyle={{ 
    backgroundColor: '#1e293b', 
    border: '1px solid #5b8fb9',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px'
  }}
  labelStyle={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '4px' }}
  formatter={(value, name, props) => {
    const item = dopData.find(d => d.name === props.payload.name);
    if (name === 'Total Budget (₹)') {
      return [`₹${value.toLocaleString('en-IN')}`, name];
    }
    if (name === 'Number of Shoots') {
      // Return shoots count and also show launches in a custom way
      return [value, name];
    }
    return [value, name];
  }}
  // Custom content renderer
  content={({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #5b8fb9', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ color: '#5b8fb9', fontWeight: 'bold', marginBottom: '8px' }}>{data.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px' }}>
            <span>🎬 Shoots:</span>
            <span style={{ fontWeight: 'bold', color: '#5b8fb9' }}>{data.shoots}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginTop: '4px' }}>
            <span>📦 Launches:</span>
            <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{data.launches || data.shoots}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginTop: '4px' }}>
            <span>💰 Budget:</span>
            <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹{data.budget.toLocaleString('en-IN')}</span>
          </div>
        </div>
      );
    }
    return null;
  }}
/>
    <Legend />
    <Bar yAxisId="left" dataKey="shoots" fill="#5b8fb9" name="Number of Shoots" radius={[8, 8, 0, 0]} />
    <Line yAxisId="right" type="monotone" dataKey="budget" stroke="#c5d3cd" name="Total Budget (₹)" strokeWidth={2} dot={{ r: 4, fill: '#5b8fb9' }} />
  </ComposedChart>
</ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;