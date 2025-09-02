import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from './GameHeader';
import Cell from './Cell';
import Modal from './Modal';
import ParticleContainer from './ParticleContainer';
import Menu from './Menu';
import './Board.css';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 17;
const MAX_TIME = 100000;

/* =========================
   RNG & 유틸
========================= */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* =========================
   블록 타입 & 숫자 픽커
========================= */
type BlockKind = 'H2' | 'V2' | 'S2x2' | 'H3' | 'V3';

/** 난이도 ↑: 2x2는 “한눈에 안 들어오는” 조합 위주 */
const QUAD_CANDIDATES: number[][] = [
  [1, 1, 3, 5],
  [1, 2, 2, 5],
  [2, 2, 2, 4],
  [1, 1, 2, 6],
  [1, 1, 1, 7],
  [2, 3, 2, 3], // 2,3 반복으로 눈에 안 띄게
];

/** 난이도 중상: 1x3은 다양한 분산 */
const TRIPLE_CANDIDATES: number[][] = [
  [1, 2, 7], [1, 3, 6], [1, 4, 5],
  [2, 2, 6], [2, 3, 5], [2, 4, 4],
  [3, 3, 4],
];

/** 쌍은 (5,5), (4,6) 빈도 낮추기 → 가중치로 제어 */
const PAIR_WEIGHTS: Array<{ a: number; w: number }> = [
  { a: 1, w: 1.2 }, { a: 2, w: 1.1 }, { a: 3, w: 1.1 },
  { a: 4, w: 0.7 }, { a: 5, w: 0.4 }, { a: 6, w: 0.7 },
  { a: 7, w: 1.0 }, { a: 8, w: 1.0 }, { a: 9, w: 1.0 },
];

function weightedPickPair(rng: () => number): [number, number] {
  const sumW = PAIR_WEIGHTS.reduce((s, x) => s + x.w, 0);
  let r = rng() * sumW;
  for (const x of PAIR_WEIGHTS) {
    if ((r -= x.w) <= 0) return [x.a, 10 - x.a];
  }
  return [1, 9];
}
function pickTriple(rng: () => number): [number, number, number] {
  const cand = TRIPLE_CANDIDATES[randInt(rng, 0, TRIPLE_CANDIDATES.length - 1)];
  const arr = cand.slice(); shuffleInPlace(arr, rng);
  return [arr[0], arr[1], arr[2]];
}
function pickQuad(rng: () => number): [number, number, number, number] {
  const cand = QUAD_CANDIDATES[randInt(rng, 0, QUAD_CANDIDATES.length - 1)];
  const arr = cand.slice(); shuffleInPlace(arr, rng);
  return [arr[0], arr[1], arr[2], arr[3]];
}

/* =========================
   보드 생성 (난이도 조정판)
========================= */
type Ratios = { H2: number; V2: number; S2x2: number; H3: number; V3: number; };
function normalizeRatios(r: Ratios): Ratios {
  const s = r.H2 + r.V2 + r.S2x2 + r.H3 + r.V3 || 1;
  return { H2: r.H2 / s, V2: r.V2 / s, S2x2: r.S2x2 / s, H3: r.H3 / s, V3: r.V3 / s };
}
function jitterRatios(base: Ratios, rng: () => number, j = 0.04): Ratios {
  const add = (x: number) => Math.max(0, x + (rng() * 2 - 1) * j);
  return normalizeRatios({ H2: add(base.H2), V2: add(base.V2), S2x2: add(base.S2x2), H3: add(base.H3), V3: add(base.V3) });
}

/** 목표: 클리어율 ~60% → 쌍 50%, 2x2 35%, 1x3/3x1 15% */
const BASE_RATIOS: Ratios = { H2: 0.35, V2: 0.15, S2x2: 0.35, H3: 0.12, V3: 0.03 };

function generateSolvableBoardWithBlocks(
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT
): number[][] {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const rng = mulberry32(seed);

  const ratios = jitterRatios(BASE_RATIOS, rng, 0.05);

  const board: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );
  const occ: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false)
  );

  const coords: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) coords.push({ r, c });
  shuffleInPlace(coords, rng);

  const fits = (r: number, c: number) => !occ[r][c];

  const place = (kind: BlockKind, r: number, c: number): boolean => {
    if (kind === 'H2') {
      if (c + 1 >= width || !fits(r, c) || !fits(r, c + 1)) return false;
      const [a, b] = weightedPickPair(rng);
      board[r][c] = a; board[r][c + 1] = b;
      occ[r][c] = occ[r][c + 1] = true;
      return true;
    }
    if (kind === 'V2') {
      if (r + 1 >= height || !fits(r, c) || !fits(r + 1, c)) return false;
      const [a, b] = weightedPickPair(rng);
      board[r][c] = a; board[r + 1][c] = b;
      occ[r][c] = occ[r + 1][c] = true;
      return true;
    }
    if (kind === 'S2x2') {
      if (r + 1 >= height || c + 1 >= width) return false;
      if (!fits(r, c) || !fits(r, c + 1) || !fits(r + 1, c) || !fits(r + 1, c + 1)) return false;
      const q = pickQuad(rng);
      shuffleInPlace(q, rng);
      board[r][c] = q[0]; board[r][c + 1] = q[1];
      board[r + 1][c] = q[2]; board[r + 1][c + 1] = q[3];
      occ[r][c] = occ[r][c + 1] = occ[r + 1][c] = occ[r + 1][c + 1] = true;
      return true;
    }
    if (kind === 'H3') {
      if (c + 2 >= width || !fits(r, c) || !fits(r, c + 1) || !fits(r, c + 2)) return false;
      const t = pickTriple(rng);
      shuffleInPlace(t, rng);
      board[r][c] = t[0]; board[r][c + 1] = t[1]; board[r][c + 2] = t[2];
      occ[r][c] = occ[r][c + 1] = occ[r][c + 2] = true;
      return true;
    }
    if (kind === 'V3') {
      if (r + 2 >= height || !fits(r, c) || !fits(r + 1, c) || !fits(r + 2, c)) return false;
      const t = pickTriple(rng);
      shuffleInPlace(t, rng);
      board[r][c] = t[0]; board[r + 1][c] = t[1]; board[r + 2][c] = t[2];
      occ[r][c] = occ[r + 1][c] = occ[r + 2][c] = true;
      return true;
    }
    return false;
  };

  for (const { r, c } of coords) {
    if (occ[r][c]) continue;

    // 가중치에 따라 후보 풀 만들고 셔플
    const cands: BlockKind[] = [];
    const pushW = (k: BlockKind, w: number) => {
      const n = Math.max(1, Math.round(w * 5));
      for (let i = 0; i < n; i++) cands.push(k);
    };
    pushW('H2', ratios.H2);
    pushW('V2', ratios.V2);
    pushW('S2x2', ratios.S2x2);
    pushW('H3', ratios.H3);
    pushW('V3', ratios.V3);
    shuffleInPlace(cands, rng);

    let ok = false;
    for (const k of cands) {
      if (place(k, r, c)) { ok = true; break; }
    }
    if (!ok) {
      // 안전망: H2 → V2 순서로 강제
      if (!(place('H2', r, c) || place('V2', r, c))) {
        // 드문 케이스: 좌/상 역방향
        if (c - 1 >= 0 && !occ[r][c - 1]) {
          const [a, b] = weightedPickPair(rng);
          board[r][c - 1] = a; board[r][c] = b;
          occ[r][c - 1] = occ[r][c] = true;
        } else if (r - 1 >= 0 && !occ[r - 1][c]) {
          const [a, b] = weightedPickPair(rng);
          board[r - 1][c] = a; board[r][c] = b;
          occ[r - 1][c] = occ[r][c] = true;
        } else {
          board[r][c] = randInt(rng, 1, 9);
          occ[r][c] = true;
        }
      }
    }
  }

  return board;
}

/* =========================
   React 컴포넌트
========================= */

const Board: React.FC = () => {
  const [score, setScore] = useState<number>(0);
  const [time, setTime] = useState<number>(MAX_TIME);
  const [isTimeOver, setIsTimeOver] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [boardData, setBoardData] = useState<number[][]>(generateSolvableBoardWithBlocks());
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; burstX: number; burstY: number }[]
  >([]);
  const [fallingApples, setFallingApples] = useState<
    { id: number; x: number; y: number; width: number; height: number }[]
  >([]);

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

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
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
    setBoardData(generateSolvableBoardWithBlocks());
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
      const clearedCount = selectedCells.size;

      // 점수: 셀 개수만큼
      setScore(prev => prev + clearedCount);

      // 난이도 ↑: "클리어당 +2초"로 고정
      setTime(prev => Math.min(MAX_TIME, prev + 2000));

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
      <GameHeader score={score} time={time} onMenuClick={() => setIsMenuOpen(true)} />

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
