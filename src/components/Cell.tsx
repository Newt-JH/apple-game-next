import React from 'react';
import './Cell.css';

interface CellProps {
  value: number;
  rowIndex: number;
  colIndex: number;
  isSelected: boolean;
}

const Cell: React.FC<CellProps> = ({ value, rowIndex, colIndex, isSelected }) => {
  return (
    <div
      className={`cell ${isSelected ? 'selected' : ''} ${value === 0 ? 'empty' : ''}`}
      data-row={rowIndex}
      data-col={colIndex}
    >
      {value !== 0 ? value : ''}
    </div>
  );
};

export default Cell;
