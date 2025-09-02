import React from 'react';
import Gauge from './Gauge';
import './GameHeader.css';

interface GameHeaderProps {
  score: number;
  time: number;
  onMenuClick: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ score, time, onMenuClick }) => {
  return (
    <div className="game-header">
      {/* 상단: 점수 + 햄버거 버튼 */}
      <div className="header-top">
        <div>점수 <span style={{ color: '#ffc107' }}>{score}</span></div>
        <button className="menu-icon-button" onClick={onMenuClick}></button>
      </div>

      {/* 게이지 */}
      <div className="header-gauge">
        <Gauge time={time} />
      </div>
    </div>
  );
};

export default GameHeader;
