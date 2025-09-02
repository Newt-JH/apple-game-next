import React from 'react';
import './GameHeader.css';

interface GameHeaderProps {
  score: number;
  onMenuClick: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ score, onMenuClick }) => {
  return (
    <div className="game-header">
      <div className="score-display">
        Score: <span>{score}</span>
      </div>
      <button className="menu-icon-button" onClick={onMenuClick}>
        ☰
      </button>
    </div>
  );
};

export default GameHeader;
