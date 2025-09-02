import React from 'react';
import Gauge from './Gauge';
import './GameHeader.css';

type Props = {
  score: number;
  time: number;
  onMenuClick: () => void;
};

const GameHeader: React.FC<Props> = ({ score, time, onMenuClick }) => {
  return (
    <header className="game-header">
      <button className="menu-icon-button" onClick={onMenuClick} aria-label="메뉴 열기">☰</button>

      <div className="header-center">
        {/* 스코어와 게이지를 같은 카드 안에 */}
        <div className="score-card">
          <div className="score-row">
            <div className="score-display">
              SCORE <span>{score}</span>
            </div>
          </div>

          {/* 카드 내부에서 게이지가 거의 가득 차도록 */}
          <div className="gauge-row">
            <Gauge time={time} />
          </div>
        </div>
      </div>

      <div className="header-right" />
    </header>
  );
};

export default GameHeader;
