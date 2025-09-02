import React from 'react';
import './Gauge.css';

interface GaugeProps {
  time: number; // Time in milliseconds
}

const MAX_TIME = 100000; // 100 seconds in ms

const getGaugeColor = (percentage: number): string => {
  if (percentage > 50) return '#4caf50'; // Green
  if (percentage > 20) return '#ffc107'; // Yellow
  return '#f44336'; // Red
};

const Gauge: React.FC<GaugeProps> = ({ time }) => {
  const percentage = (time / MAX_TIME) * 100;
  const timeDisplay = (time / 1000).toFixed(2);
  const gaugeColor = getGaugeColor(percentage);

  return (
    <div className="gauge-wrapper">
      <div className="gauge-container">
        <div 
          className="gauge-bar" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: gaugeColor 
          }}
        ></div>
        <span className="gauge-text">{timeDisplay}s</span>
      </div>
    </div>
  );
};

export default Gauge;
