import React from 'react';
import './GameHeader.css';

interface GameHeaderProps {
  score: number;
  onMenuClick: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ score, onMenuClick }) => {
  return (
    <div className="game-header">
      <div className="header-left-group"> {/* New div for score and hearts */}
        <div className="score-display">
          Score: <span>{score}</span>
        </div>
      </div>
      <div className="header-right-group">
        <button className="menu-icon-button" onClick={onMenuClick}>
          ☰
        </button>
      </div>
    </div>
  );
};

export default GameHeader;
