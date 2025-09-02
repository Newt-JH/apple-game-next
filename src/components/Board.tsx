import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from './GameHeader';
import Cell from './Cell';
import Modal from './Modal';
import ParticleContainer from './ParticleContainer';
import Gauge from './Gauge';
import Menu from './Menu';
import './Board.css';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 17;
const MAX_TIME = 100000;

function generateRandomNumber() {
  const probabilities = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 9];
  const randomIndex = Math.floor(Math.random() * probabilities.length);
  return probabilities[randomIndex];
}

function generateRandomBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => generateRandomNumber())
  );
}

const Board: React.FC = () => {
  const [score, setScore] = useState<number>(0);
  const [time, setTime] = useState<number>(MAX_TIME);
  const [isTimeOver, setIsTimeOver] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [boardData, setBoardData] = useState<number[][]>(generateRandomBoard());
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; burstX: number; burstY: number }[]
  >([]);
  const [fallingApples, setFallingApples] = useState<
    { id: number; x: number; y: number; width: number; height: number }[]
  >([]);

  // 브라우저 setInterval 타입은 number
  const timerRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const setCellSize = useCallback(() => {
    if (!boardRef.current) return;
    const boardElement = boardRef.current;
    const boardWidth = boardElement.clientWidth - 8;
    const boardHeight = boardElement.clientHeight - 30;
    const cellWidth = (boardWidth - (BOARD_WIDTH - 1) * 1) / BOARD_WIDTH;
    const cellHeight = (boardHeight - (BOARD_HEIGHT - 1) * 1) / BOARD_HEIGHT;
    const size = Math.floor(Math.min(cellWidth, cellHeight));
    document.documentElement.style.setProperty('--cell-size', `${size}px`);
    document.documentElement.style.setProperty('--font-size', `${size * 0.5}px`);
    document.documentElement.style.setProperty('--cell-padding', `${size * 0.1}px`);
  }, []);

  useEffect(() => {
    setCellSize();
    window.addEventListener('resize', setCellSize);
    return () => window.removeEventListener('resize', setCellSize);
  }, [setCellSize]);

  // --- TIMER LOGIC WITH PAUSE ---
  const startTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      // Pause timer if menu is open
      if (isMenuOpen) return;
      setTime(prevTime => {
        if (prevTime <= 10) {
          setIsTimeOver(true);
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          return 0;
        }
        return prevTime - 10;
      });
    }, 10);
  }, [isMenuOpen]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const handleRestart = useCallback(() => {
    setScore(0);
    setTime(MAX_TIME);
    setIsTimeOver(false);
    setIsMenuOpen(false);
    setBoardData(generateRandomBoard());
    setSelectedCells(new Set());
    setStartCell(null);
    setIsAnimating(false);
    setParticles([]);
    setFallingApples([]);
    startTimer();
  }, [startTimer]);

  const getCellFromTouch = useCallback((touch: React.Touch) => {
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target || !(target as HTMLElement).classList.contains('cell')) return null;
    const row = (target as HTMLElement).getAttribute('data-row');
    const col = (target as HTMLElement).getAttribute('data-col');
    if (row === null || col === null) return null;
    return { row: parseInt(row, 10), col: parseInt(col, 10) };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isTimeOver || isAnimating || isMenuOpen) return;
      const cell = getCellFromTouch(e.touches[0]);
      if (!cell) return;
      setStartCell(cell);
      setSelectedCells(new Set([`${cell.row}-${cell.col}`]));
    },
    [isTimeOver, isAnimating, isMenuOpen, getCellFromTouch]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isTimeOver || isAnimating || isMenuOpen) return;
      if (!startCell) return;
      const current = getCellFromTouch(e.touches[0]);
      if (!current) return;
      const rowMin = Math.min(startCell.row, current.row);
      const rowMax = Math.max(startCell.row, current.row);
      const colMin = Math.min(startCell.col, current.col);
      const colMax = Math.max(startCell.col, current.col);
      const newSelected = new Set<string>();
      for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c <= colMax; c++) {
          newSelected.add(`${r}-${c}`);
        }
      }
      setSelectedCells(newSelected);
    },
    [isTimeOver, isAnimating, isMenuOpen, startCell, getCellFromTouch]
  );

  const handleTouchEnd = useCallback(() => {
    if (isTimeOver || isAnimating || isMenuOpen || selectedCells.size === 0) return;

    let sum = 0;
    selectedCells.forEach(key => {
      const [row, col] = key.split('-').map(Number);
      sum += boardData[row][col];
    });

    const isValid = sum === 10 && selectedCells.size >= 2;
    if (isValid) {
      setIsAnimating(true);
      const clearedApplesCount = selectedCells.size;
      setScore(prevScore => prevScore + clearedApplesCount);
      setTime(prevTime => Math.min(MAX_TIME, prevTime + clearedApplesCount * 1000));

      const newParticles: { id: number; x: number; y: number; burstX: number; burstY: number }[] = [];
      const newFallingApples: { id: number; x: number; y: number; width: number; height: number }[] = [];

      selectedCells.forEach(key => {
        const [row, col] = key.split('-').map(Number);
        const cellElement = document.querySelector(
          `[data-row="${row}"][data-col="${col}"]`
        ) as HTMLElement | null;
        if (!cellElement) return;
        const rect = cellElement.getBoundingClientRect();
        const startX = rect.left;
        const startY = rect.top;
        for (let i = 0; i < 8; i++) {
          const burstX = (Math.random() - 0.5) * 80;
          const burstY = (Math.random() - 0.5) * 80;
          newParticles.push({
            id: Date.now() + Math.random(),
            x: startX + rect.width / 2,
            y: startY + rect.height / 2,
            burstX,
            burstY,
          });
        }
        newFallingApples.push({
          id: Date.now() + Math.random(),
          x: startX,
          y: startY,
          width: rect.width,
          height: rect.height,
        });
      });

      setParticles(newParticles);
      setFallingApples(newFallingApples);

      setBoardData(prev => {
        const next = prev.map(r => [...r]);
        selectedCells.forEach(key => {
          const [r, c] = key.split('-').map(Number);
          next[r][c] = 0;
        });
        return next;
      });

      setSelectedCells(new Set());
      setStartCell(null);

      window.setTimeout(() => {
        setIsAnimating(false);
        setParticles([]);
        setFallingApples([]);
      }, 1200);
    } else {
      setSelectedCells(new Set());
      setStartCell(null);
    }
  }, [isTimeOver, isAnimating, isMenuOpen, selectedCells, boardData]);

  return (
    <div className="game-container">
      <GameHeader score={score} onMenuClick={() => setIsMenuOpen(true)} />

      <div
        className={`board ${isAnimating || isMenuOpen ? 'locked' : ''}`}
        ref={boardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {boardData.map((row, rowIndex) => (
          <div key={rowIndex} className="board-row">
            {row.map((value, colIndex) => (
              <Cell
                key={`${rowIndex}-${colIndex}`}
                value={value}
                rowIndex={rowIndex}
                colIndex={colIndex}
                isSelected={selectedCells.has(`${rowIndex}-${colIndex}`)}
              />
            ))}
          </div>
        ))}
      </div>

      <Gauge time={time} />

      <div className="ad-banner-placeholder">광고 배너 (Ad Banner)</div>

      <Menu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onRestart={handleRestart}
      />

      {isTimeOver && (
        <Modal
          isActive={true}
          title="⏰ 시간이 종료되었습니다!"
          message={`최종 점수: ${score}`}
          primaryButtonText="다시하기"
          onPrimaryButtonClick={handleRestart}
        />
      )}

      <ParticleContainer particles={particles} />

      {fallingApples.map(apple => (
        <div
          key={apple.id}
          className="falling-apple-clone"
          style={{
            left: `${apple.x}px`,
            top: `${apple.y}px`,
            width: `${apple.width}px`,
            height: `${apple.height}px`,
          }}
        />
      ))}
    </div>
  );
};

export default Board;
