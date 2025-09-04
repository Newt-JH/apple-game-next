import React, { useMemo } from 'react';
import './GameHeader.css';

type Props = {
  score: number;
  time: number;              // 0 ~ MAX_TIME (ms)
  onMenuClick: () => void;
};

// Board.tsx의 MAX_TIME과 동일해야 합니다.
const MAX_TIME = 100000;

// 남은 퍼센트에 따라 색상 단계(초록→노랑→빨강)
function gaugeColor(pct: number): string {
  if (pct >= 60) return '#22c55e'; // green-500
  if (pct >= 30) return '#facc15'; // yellow-400
  return '#ef4444';                // red-500
}

const GameHeader: React.FC<Props> = ({ score, time, onMenuClick }) => {
  const pct = useMemo(() => {
    const p = (time / MAX_TIME) * 100;
    return Math.max(0, Math.min(100, p));
  }, [time]);

  // 0.01초(센티초) 단위 표기
  const secondsPrecise = useMemo(() => {
    const s = Math.max(0, time) / 1000; // ms → s
    return s.toFixed(2);                // 0.01초 단위
  }, [time]);

  const fillColor = useMemo(() => gaugeColor(pct), [pct]);

  return (
    <header className="game-header one-line">
      {/* 좌측: 점수 */}
      <div className="header-left">
        <span className="score-label">점수</span>
        <span className="score-value">{score}</span>
      </div>

      {/* 가운데: 타임 게이지 */}
      <div
        className="header-gauge slim"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="남은 시간"
      >
        <div
          className="header-gauge-fill"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
        <div className="header-gauge-text">{secondsPrecise}s</div>
      </div>

      {/* 우측: 햄버거 버튼 */}
      <button
        className="menu-icon-button"
        aria-label="메뉴 열기"
        onClick={onMenuClick}
        type="button"
      />
    </header>
  );
};

export default GameHeader;
