import React from 'react';
import './Apple.css';

interface AppleProps {
  x: number;
  y: number;
}

const Apple: React.FC<AppleProps> = ({ x, y }) => {
  return (
    <div
      className="apple"
      style={{ left: `${x}px`, top: `${y}px` }}
    ></div>
  );
};

export default Apple;
