import React from 'react';

const KPICards = ({ shoots }) => {
  const totalShoots = shoots.length;
  const activeShoots = shoots.filter(s => s.status !== 'cancelled');
  const scheduledShoots = shoots.filter(s => s.status === 'scheduled').length;
  const completedShoots = shoots.filter(s => s.status === 'completed').length;
  const cancelledShoots = shoots.filter(s => s.status === 'cancelled').length;
  const doneShoots = shoots.filter(s => s.status === 'shootdone').length;
  const upcomingLaunch = activeShoots.filter(s => new Date(s.launchDate) > new Date()).length;
  
  // Calculate total value - ensure budget is treated as number
  const totalBudget = activeShoots.reduce((sum, shoot) => {
    // Convert budget to number, handle both string and number values
    const budgetValue = typeof shoot.budget === 'number' 
      ? shoot.budget 
      : parseInt(shoot.budget) || 0;
    return sum + budgetValue;
  }, 0);

  const metrics = [
    { label: 'Total Launches', value: totalShoots, icon: '📋', color: '#6366f1' },
    // { label: 'Upcoming', value: upcomingLaunch, icon: '🎯', color: '#3b82f6' },
    { label: 'Scheduled', value: scheduledShoots, icon: '📅', color: '#10b981' },
    { label: 'Shoots Done', value: doneShoots, icon: '🎬', color: '#3b82f6' },
    { label: 'Completed', value: completedShoots, icon: '✅', color: '#f59e0b' },
    { label: 'Cancelled', value: cancelledShoots, icon: '❌', color: '#ef4444' },
    { label: 'Total Budget', value: `₹${totalBudget.toLocaleString('en-IN')}`, icon: '💰', color: '#8b5cf6' }
  ];

  return (
    <div className="kpi-grid">
      {metrics.map((metric, index) => (
        <div key={index} className="kpi-card" style={{ borderTopColor: metric.color }}>
          <div className="kpi-header">
            <span className="kpi-icon">{metric.icon}</span>
            <span className="kpi-label">{metric.label}</span>
          </div>
          <div className="kpi-value">{metric.value}</div>
        </div>
      ))}
    </div>
  );
};

export default KPICards;