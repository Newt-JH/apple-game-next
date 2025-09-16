"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GameHeader from './GameHeader';
import Cell from './Cell';
import Modal from './Modal';
import ParticleContainer from './ParticleContainer';
import Menu from './Menu';
import './Board.css';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 14; // 세로 한 줄 추가된 상태 유지
const MAX_TIME = 100000;

// ✅ 사과 깼을 때 +2초 고정 보상
const CLEAR_BONUS_MS = 2000;

const MAX_HEARTS = 5;
const HEART_COOKIE = 'lives';

/** ===================== 통합 난이도 설정 ===================== */
const GAME_SETTINGS = {
  weights: { p12: 50, p13: 30, p22: 20 }, // 균형잡힌 난이도
  timeBonusMs: 250 // 중간 수준의 시간 보너스
};

/** ===================== 쿠키 유틸 ===================== */
const setCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return; // SSR 방지
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`;
};
const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null; // SSR 방지
  const pairs = document.cookie?.split(";") ?? [];
  for (const p of pairs) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** ===================== 패턴 화이트리스트 ===================== */
// 1x2 가로 (합 10)
const P12_H_PATTERNS: number[][] = [
  [1,9],[2,8],[3,7],[4,6],[5,5],
];
// 2x1 세로 (합 10)
const P21_V_PATTERNS: number[][] = [
  [1,9],[2,8],[3,7],[4,6],[5,5],
];
// 1x3 가로 (합 10)
const P13_H_PATTERNS: number[][] = [
  [1,1,8],[1,2,7],[1,3,6],[1,4,5],
  [2,2,6],[2,3,5],[2,4,4],
  [3,3,4],
];
// 3x1 세로 (합 10)
const P31_V_PATTERNS: number[][] = [
  [1,1,8],[1,2,7],[1,3,6],[1,4,5],
  [2,2,6],[2,3,5],[2,4,4],
  [3,3,4],
];
// 2x2 (합 10) — 행우선(4칸)
const P22_PATTERNS: number[][] = [
  [1,2,3,4],[1,1,3,5],[1,2,2,5],[1,1,4,4],
  [2,2,2,4],[2,3,1,4],[3,3,2,2],
];

/** ===== 유틸 ===== */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/** 무조건 클리어 가능한 향상된 보드 생성 */
function generateGuaranteedBoard(_weights: { p12: number; p13: number; p22: number }): number[][] {
  const board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));

  // 가로/세로 패턴을 랜덤하게 섞어서 배치
  const useVerticalBias = Math.random();

  if (useVerticalBias < 0.3) {
    // 30% 확률로 세로 패턴 위주
    fillVerticalPatterns(board);
  } else if (useVerticalBias < 0.6) {
    // 30% 확률로 가로 패턴 위주
    fillHorizontalPatterns(board);
  } else {
    // 40% 확률로 혼합 패턴
    fillMixedPatterns(board);
  }

  // 안전장치: 빈 칸이 있으면 강제로 합 10 패턴으로 채우기
  ensureAllCellsFilled(board);

  return board;
}

/** 세로 패턴 위주로 보드 채우기 */
function fillVerticalPatterns(board: number[][]) {
  for (let c = 0; c < BOARD_WIDTH; c++) {
    let r = 0;
    while (r < BOARD_HEIGHT) {
      const remainingHeight = BOARD_HEIGHT - r;

      if (remainingHeight >= 3 && Math.random() < 0.4) {
        // 3x1 세로 패턴
        const pattern = shuffle(P31_V_PATTERNS)[0];
        for (let i = 0; i < 3; i++) {
          board[r + i][c] = pattern[i];
        }
        r += 3;
      } else if (remainingHeight >= 2) {
        // 2x1 세로 패턴
        const pattern = shuffle(P21_V_PATTERNS)[0];
        board[r][c] = pattern[0];
        board[r + 1][c] = pattern[1];
        r += 2;
      } else {
        // 남은 1칸은 다음 열에서 처리
        break;
      }
    }
  }
}

/** 가로 패턴 위주로 보드 채우기 */
function fillHorizontalPatterns(board: number[][]) {
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    let c = 0;
    while (c < BOARD_WIDTH) {
      const remainingWidth = BOARD_WIDTH - c;

      if (remainingWidth >= 3 && Math.random() < 0.4) {
        // 1x3 가로 패턴
        const pattern = shuffle(P13_H_PATTERNS)[0];
        for (let i = 0; i < 3; i++) {
          board[r][c + i] = pattern[i];
        }
        c += 3;
      } else if (remainingWidth >= 2) {
        // 1x2 가로 패턴
        const pattern = shuffle(P12_H_PATTERNS)[0];
        board[r][c] = pattern[0];
        board[r][c + 1] = pattern[1];
        c += 2;
      } else {
        // 남은 1칸은 다음 행에서 처리
        break;
      }
    }
  }
}

/** 혼합 패턴으로 보드 채우기 */
function fillMixedPatterns(board: number[][]) {
  // 2x2 패턴을 몇 개 배치
  for (let r = 0; r < BOARD_HEIGHT - 1; r += 2) {
    for (let c = 0; c < BOARD_WIDTH - 1; c += 2) {
      if (Math.random() < 0.3) {
        const pattern = shuffle(P22_PATTERNS)[0];
        let k = 0;
        for (let dr = 0; dr < 2; dr++) {
          for (let dc = 0; dc < 2; dc++) {
            board[r + dr][c + dc] = pattern[k++];
          }
        }
      }
    }
  }

  // 나머지 공간을 가로/세로 패턴으로 채우기
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      if (board[r][c] === 0) {
        // 가로 패턴 시도
        if (c + 1 < BOARD_WIDTH && board[r][c + 1] === 0) {
          const pattern = shuffle(P12_H_PATTERNS)[0];
          board[r][c] = pattern[0];
          board[r][c + 1] = pattern[1];
        }
        // 세로 패턴 시도
        else if (r + 1 < BOARD_HEIGHT && board[r + 1][c] === 0) {
          const pattern = shuffle(P21_V_PATTERNS)[0];
          board[r][c] = pattern[0];
          board[r + 1][c] = pattern[1];
        }
      }
    }
  }
}

/** 모든 셀이 채워졌는지 확인하고 빈 칸 처리 */
function ensureAllCellsFilled(board: number[][]) {
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      if (board[r][c] === 0) {
        // 인접한 빈 칸과 합쳐서 패턴 만들기
        if (c + 1 < BOARD_WIDTH && board[r][c + 1] === 0) {
          const pattern = shuffle(P12_H_PATTERNS)[0];
          board[r][c] = pattern[0];
          board[r][c + 1] = pattern[1];
        } else if (r + 1 < BOARD_HEIGHT && board[r + 1][c] === 0) {
          const pattern = shuffle(P21_V_PATTERNS)[0];
          board[r][c] = pattern[0];
          board[r + 1][c] = pattern[1];
        } else {
          // 혼자 남은 칸은 인접 칸과 맞춰서 합 10 만들기
          fillSingleCell(board, r, c);
        }
      }
    }
  }
}

/** 단일 빈 칸을 인접 칸과 맞춰서 채우기 */
function fillSingleCell(board: number[][], r: number, c: number) {
  // 인접한 칸 중 0이 아닌 칸 찾기
  const neighbors = [];
  if (r > 0 && board[r-1][c] !== 0) neighbors.push({r: r-1, c, val: board[r-1][c]});
  if (r < BOARD_HEIGHT-1 && board[r+1][c] !== 0) neighbors.push({r: r+1, c, val: board[r+1][c]});
  if (c > 0 && board[r][c-1] !== 0) neighbors.push({r, c: c-1, val: board[r][c-1]});
  if (c < BOARD_WIDTH-1 && board[r][c+1] !== 0) neighbors.push({r, c: c+1, val: board[r][c+1]});

  if (neighbors.length > 0) {
    // 인접 칸과 합쳐서 10이 되도록 설정
    const neighbor = neighbors[0];
    const targetSum = 10;
    const currentSum = neighbor.val;
    const needed = targetSum - currentSum;

    if (needed > 0 && needed <= 9) {
      board[r][c] = needed;
      // 기존 패턴을 새로운 패턴으로 교체
      board[neighbor.r][neighbor.c] = currentSum;
    } else {
      // 안전한 기본값
      board[r][c] = Math.floor(Math.random() * 9) + 1;
    }
  } else {
    // 인접 칸이 없으면 기본값
    board[r][c] = Math.floor(Math.random() * 9) + 1;
  }
}

/** ===================== 타입 및 컴포넌트 ===================== */
type AdMode = 'recharge' | 'revive' | null;

const Board: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [score, setScore] = useState(0);
  const [time, setTime] = useState(MAX_TIME);
  const [isTimeOver, setIsTimeOver] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [boardData, setBoardData] = useState<number[][]>(() =>
    generateGuaranteedBoard(GAME_SETTINGS.weights)
  );
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; burstX: number; burstY: number }[]
  >([]);
  const [fallingApples, setFallingApples] = useState<
    { id: number; x: number; y: number; width: number; height: number; direction: number }[]
  >([]);

  // 하트/광고 플로우
  const [hearts, setHearts] = useState<number>(() => {
    const saved = parseInt(getCookie(HEART_COOKIE) ?? `${MAX_HEARTS}`, 10);
    return isNaN(saved) ? MAX_HEARTS : saved;
  });
  const [adMode, setAdMode] = useState<AdMode>(null);
  const [adChoiceOpen, setAdChoiceOpen] = useState(false);
  const [adPlayingOpen, setAdPlayingOpen] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);

  const timerRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  /** ===== 셀 크기 계산 ===== */
  const setCellSize = useCallback(() => {
    if (typeof document === "undefined" || !boardRef.current) return;

    const boardEl = boardRef.current;
    const availW = boardEl.clientWidth;
    const availH = boardEl.clientHeight;

    const maxCellW = availW / BOARD_WIDTH;
    const maxCellH = availH / BOARD_HEIGHT;

    const size = Math.floor(Math.min(maxCellW, maxCellH));
    document.documentElement.style.setProperty("--cell-size", `${size}px`);
    document.documentElement.style.setProperty("--font-size", `${Math.max(12, Math.floor(size * 0.5))}px`);
    document.documentElement.style.setProperty("--cell-padding", `${Math.floor(size * 0.08)}px`);

    const wrapW = size * BOARD_WIDTH;
    const wrapH = size * BOARD_HEIGHT;
    document.documentElement.style.setProperty("--board-wrap-w", `${wrapW}px`);
    document.documentElement.style.setProperty("--board-wrap-h", `${wrapH}px`);
  }, []);

  useEffect(() => {
    setCellSize();
    const onResize = () => setCellSize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [setCellSize]);

  /** ===== 타이머 ===== */
  const startTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (isMenuOpen || adChoiceOpen || adPlayingOpen) return;
      setTime(prev => {
        if (prev <= 10) {
          if (!isTimeOver) setIsTimeOver(true);
          window.clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 10;
      });
    }, 10);
  }, [isMenuOpen, adChoiceOpen, adPlayingOpen, isTimeOver]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current !== null) window.clearInterval(timerRef.current); };
  }, [startTimer]);

  /** ===== 페이지 진입: 리로드면 하트 1개 소모 ===== */
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === 'reload';

    let lives = parseInt(getCookie(HEART_COOKIE) ?? `${MAX_HEARTS}`, 10);
    if (isNaN(lives)) lives = MAX_HEARTS;

    if (isReload) {
      lives = clamp(lives - 1, 0, MAX_HEARTS);
      setCookie(HEART_COOKIE, String(lives));
    }

    setHearts(lives);

    if (lives <= 0) {
      setAdMode('recharge');
      setAdChoiceOpen(true);
    }
  }, []);

  /** ===== 하트 소모 ===== */
  const spendHeart = (n = 1): number => {
    let lives = parseInt(getCookie(HEART_COOKIE) ?? `${hearts}`, 10);
    if (isNaN(lives)) lives = hearts;
    const next = clamp(lives - n, 0, MAX_HEARTS);
    setCookie(HEART_COOKIE, String(next));
    setHearts(next);
    return next;
  };

  /** ===== 재시작 & 초기화 ===== */
  const doRestart = () => {
    setScore(0);
    setTime(MAX_TIME);
    setIsTimeOver(false);
    setIsMenuOpen(false);
    setBoardData(generateGuaranteedBoard(GAME_SETTINGS.weights));
    setSelectedCells(new Set());
    setStartCell(null);
    setIsAnimating(false);
    setParticles([]);
    setFallingApples([]);
    startTimer();
  };

  // useCallback을 굳이 쓰지 않아도 빌드는 문제없음(의존성 경고 회피)
  const handleRestart = () => {
    const afterSpend = spendHeart(1);
    if (afterSpend <= 0) {
      setPendingRestart(true);
      setAdMode('recharge');
      setAdChoiceOpen(true);
      return;
    }
    doRestart();
  };

  /** ===== 광고 선택 모달 버튼들 ===== */
  const openAdFlow = () => {
    setAdChoiceOpen(false);
    setAdPlayingOpen(true);
  };

  /** ===== 광고 모달 닫힘(시청 완료 처리) ===== */
  const onAdFinished = () => {
    setAdPlayingOpen(false);

    if (adMode === 'recharge') {
      setHearts(MAX_HEARTS);
      setCookie(HEART_COOKIE, String(MAX_HEARTS));
      if (pendingRestart) {
        setPendingRestart(false);
        doRestart();
      }
    } else if (adMode === 'revive') {
      setTime(prev => Math.min(MAX_TIME, prev + 60000));
      setIsTimeOver(false);
      startTimer();
    }
  };

  /** ===== 터치 핸들러 ===== */
  const getCellFromTouch = useCallback((touch: React.Touch) => {
    if (typeof document === "undefined") return null;
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target || !(target as HTMLElement).classList.contains("cell")) return null;
    const row = (target as HTMLElement).getAttribute("data-row");
    const col = (target as HTMLElement).getAttribute("data-col");
    if (row === null || col === null) return null;
    return { row: parseInt(row, 10), col: parseInt(col, 10) };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isTimeOver || isMenuOpen || adChoiceOpen || adPlayingOpen) return;
    const cell = getCellFromTouch(e.touches[0]);
    if (!cell) return;
    setStartCell(cell);
    setSelectedCells(new Set([`${cell.row}-${cell.col}`]));
  }, [isTimeOver, isMenuOpen, adChoiceOpen, adPlayingOpen, getCellFromTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isTimeOver || isMenuOpen || adChoiceOpen || adPlayingOpen) return;
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
  }, [isTimeOver, isMenuOpen, adChoiceOpen, adPlayingOpen, startCell, getCellFromTouch]);

  const handleTouchEnd = useCallback(() => {
    if (isTimeOver || isMenuOpen || adChoiceOpen || adPlayingOpen || selectedCells.size === 0) return;

    const isValid = isValidPattern(selectedCells, boardData);
    if (isValid) {
      setIsAnimating(true);
      const cleared = selectedCells.size;

      setScore(prev => prev + cleared);

      // ✅ 합 10 성공 시 무조건 +2초 (2000ms)
      setTime(prev => Math.min(MAX_TIME, prev + CLEAR_BONUS_MS));

      const newParticles: { id: number; x: number; y: number; burstX: number; burstY: number }[] = [];
      const newFalling: { id: number; x: number; y: number; width: number; height: number; direction: number }[] = [];

      // 선택된 셀들의 위치 정보를 계산해서 방향성 결정
      const cellPositions = Array.from(selectedCells).map(key => {
        const [row, col] = key.split('-').map(Number);
        return { row, col, key };
      }).filter(({ row, col }) => boardData[row][col] !== 0);

      // 가운데 위치 계산
      const avgCol = cellPositions.reduce((sum, pos) => sum + pos.col, 0) / cellPositions.length;

      selectedCells.forEach(key => {
        const [row, col] = key.split('-').map(Number);
        const cellValue = boardData[row][col];

        // 빈 셀(값이 0)은 애니메이션 생성하지 않음
        if (cellValue === 0) return;

        const cellElement = (typeof document !== "undefined")
          ? document.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement | null
          : null;
        if (!cellElement) return;
        const rect = cellElement.getBoundingClientRect();
        const startX = rect.left;
        const startY = rect.top;

        // 현재 셀이 평균보다 왼쪽인지 오른쪽인지 결정
        const direction = col < avgCol ? -1 : col > avgCol ? 1 : 0; // -1: 왼쪽, 0: 가운데, 1: 오른쪽

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
        newFalling.push({
          id: Date.now() + Math.random(),
          x: startX,
          y: startY,
          width: rect.width,
          height: rect.height,
          direction
        });
      });

      setParticles(newParticles);
      setFallingApples(newFalling);

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
  }, [isTimeOver, isMenuOpen, adChoiceOpen, adPlayingOpen, selectedCells, boardData]);

  /** ===== 시간 종료 시: 점수 < 100 → 리바이브 제안 ===== */
  useEffect(() => {
    if (isTimeOver) {
      if (score < 100) {
        setAdMode('revive');
        setAdChoiceOpen(true);
      }
    }
  }, [isTimeOver, score]);

  /** ===== 평면 셀 렌더 ===== */
  const flatCells = useMemo(() => {
    const arr: Array<{ r: number; c: number; v: number }> = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        arr.push({ r, c, v: boardData[r][c] });
      }
    }
    return arr;
  }, [boardData]);

  return (
    <div className="game-container">
      <GameHeader
        score={score}
        time={time}
        onMenuClick={() => setIsMenuOpen(true)}
      />

      <div
        className={`board ${isMenuOpen || adChoiceOpen || adPlayingOpen ? 'locked' : ''}`}
        ref={boardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="board-inner"
          style={{
            width: 'var(--board-wrap-w)',
            height: 'var(--board-wrap-h)',
            display: 'grid',
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, var(--cell-size))`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, var(--cell-size))`,
            gap: 0,
          }}
        >
          {flatCells.map(({ r, c, v }) => (
            <Cell
              key={`${r}-${c}`}
              value={v}
              rowIndex={r}
              colIndex={c}
              isSelected={selectedCells.has(`${r}-${c}`)}
            />
          ))}
        </div>
      </div>

      <div className="ad-banner-placeholder">광고 배너 (Ad Banner)</div>

      <Menu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onRestart={handleRestart}
        onHelpClick={() => setIsHelpOpen(true)}
      />

      {isTimeOver && !adChoiceOpen && !adPlayingOpen && score >= 100 && (
        <Modal
          isActive
          title="⏰ 시간이 종료되었습니다!"
          message={`최종 점수: ${score}`}
          primaryButtonText="다시하기"
          onPrimaryButtonClick={handleRestart}
        />
      )}

      {adChoiceOpen && (
        <Modal
          isActive
          title={adMode === 'recharge' ? '하트가 부족합니다' : '광고 시청으로 60초 추가'}
          message={
            adMode === 'recharge'
              ? '광고를 보고 하트를 풀 충전하시겠어요?'
              : '광고를 보면 남은 시간에 60초가 추가됩니다.'
          }
          primaryButtonText={adMode === 'recharge' ? '광고 시청' : '광고 보고 이어하기'}
          onPrimaryButtonClick={openAdFlow}
          secondaryButtonText={adMode === 'recharge' ? '홈으로' : '끝내기'}
          onSecondaryButtonClick={() => {
            if (adMode === 'recharge') {
              setAdChoiceOpen(false);
              router.push('/home');
            } else {
              setAdChoiceOpen(false);
            }
          }}
        />
      )}

      {adPlayingOpen && <AdPlayingModal onClose={onAdFinished} />}

      {isHelpOpen && (
        <Modal
          isActive
          title="도움말"
          message={`직사각형을 드래그해서 선택하고, 합이 10이면 사과가 제거됩니다.\n모든 사과를 없애면 클리어입니다.`}
          primaryButtonText="닫기"
          onPrimaryButtonClick={() => setIsHelpOpen(false)}
        />
      )}

      <ParticleContainer particles={particles} />

      {fallingApples.map(apple => (
        <div
          key={apple.id}
          className={`falling-apple-clone direction-${apple.direction === -1 ? 'left' : apple.direction === 1 ? 'right' : 'center'}`}
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

/** 선택된 셀들이 유효한 패턴인지 확인 */
function isValidPattern(selectedCells: Set<string>, boardData: number[][]): boolean {
  if (selectedCells.size < 2) return false;

  // 선택된 셀들의 합계 계산
  let sum = 0;
  const cells: Array<{ r: number; c: number }> = [];

  selectedCells.forEach(key => {
    const [row, col] = key.split('-').map(Number);
    const value = boardData[row][col];
    sum += value;
    cells.push({ r: row, c: col });
  });

  // 합이 10이 아니면 무효
  if (sum !== 10) return false;

  // 셀들이 연속적인 직사각형을 형성하는지 확인
  if (!isValidRectangle(cells)) return false;

  return true;
}

/** 선택된 셀들이 유효한 직사각형 패턴인지 확인 */
function isValidRectangle(cells: Array<{ r: number; c: number }>): boolean {
  if (cells.length === 0) return false;

  const rows = cells.map(cell => cell.r);
  const cols = cells.map(cell => cell.c);

  const minR = Math.min(...rows);
  const maxR = Math.max(...rows);
  const minC = Math.min(...cols);
  const maxC = Math.max(...cols);

  const expectedCells = (maxR - minR + 1) * (maxC - minC + 1);

  // 선택된 셀 수가 예상 직사각형 크기와 일치하는지 확인
  if (cells.length !== expectedCells) return false;

  // 모든 셀이 직사각형 영역 내에 있는지 확인
  const cellSet = new Set(cells.map(cell => `${cell.r}-${cell.c}`));
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (!cellSet.has(`${r}-${c}`)) {
        return false;
      }
    }
  }

  // 직사각형이면 유효 (크기 제한 없음)
  return true;
}

export default Board;

/** ====== 광고 재생(목업) 모달 ====== */
function AdPlayingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-adplay">
        <div className="fake-ad">광고 재생 중… (목업)</div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>광고 닫기</button>
        </div>
      </div>
    </div>
  );
}
