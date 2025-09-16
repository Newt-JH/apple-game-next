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

/** ===================== 간소화된 패턴 상수 ===================== */


/** 100% 성공 보장 보드 생성 - 절대 고립된 숫자가 생기지 않는 방법 */
function generateGuaranteedBoard(_weights: { p12: number; p13: number; p22: number }): number[][] {
  const board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
  const filled = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(false));

  // 합이 10인 완전한 패턴들만 사용 (절대 부분적으로 덮어쓰지 않음)
  const patterns = [
    // 1x2 가로 패턴들
    { shape: [[1,9]], width: 2, height: 1 },
    { shape: [[2,8]], width: 2, height: 1 },
    { shape: [[3,7]], width: 2, height: 1 },
    { shape: [[4,6]], width: 2, height: 1 },
    { shape: [[5,5]], width: 2, height: 1 },

    // 2x1 세로 패턴들
    { shape: [[1],[9]], width: 1, height: 2 },
    { shape: [[2],[8]], width: 1, height: 2 },
    { shape: [[3],[7]], width: 1, height: 2 },
    { shape: [[4],[6]], width: 1, height: 2 },
    { shape: [[5],[5]], width: 1, height: 2 },

    // 1x3 가로 패턴들
    { shape: [[1,2,7]], width: 3, height: 1 },
    { shape: [[1,3,6]], width: 3, height: 1 },
    { shape: [[1,4,5]], width: 3, height: 1 },
    { shape: [[2,2,6]], width: 3, height: 1 },
    { shape: [[2,3,5]], width: 3, height: 1 },
    { shape: [[2,4,4]], width: 3, height: 1 },
    { shape: [[3,3,4]], width: 3, height: 1 },

    // 3x1 세로 패턴들
    { shape: [[1],[2],[7]], width: 1, height: 3 },
    { shape: [[1],[3],[6]], width: 1, height: 3 },
    { shape: [[1],[4],[5]], width: 1, height: 3 },
    { shape: [[2],[2],[6]], width: 1, height: 3 },
    { shape: [[2],[3],[5]], width: 1, height: 3 },
    { shape: [[2],[4],[4]], width: 1, height: 3 },
    { shape: [[3],[3],[4]], width: 1, height: 3 },

    // 2x2 패턴들
    { shape: [[1,2],[3,4]], width: 2, height: 2 },
    { shape: [[1,1],[3,5]], width: 2, height: 2 },
    { shape: [[1,2],[2,5]], width: 2, height: 2 },
    { shape: [[1,1],[4,4]], width: 2, height: 2 },
    { shape: [[2,2],[2,4]], width: 2, height: 2 },
    { shape: [[2,3],[1,4]], width: 2, height: 2 },
    { shape: [[3,3],[2,2]], width: 2, height: 2 }
  ];

  // 패턴을 배치할 수 있는지 체크하는 함수
  function canPlacePattern(row: number, col: number, pattern: typeof patterns[0]): boolean {
    if (row + pattern.height > BOARD_HEIGHT || col + pattern.width > BOARD_WIDTH) {
      return false;
    }

    for (let r = 0; r < pattern.height; r++) {
      for (let c = 0; c < pattern.width; c++) {
        if (filled[row + r][col + c]) {
          return false;
        }
      }
    }
    return true;
  }

  // 패턴을 배치하는 함수
  function placePattern(row: number, col: number, pattern: typeof patterns[0]): void {
    for (let r = 0; r < pattern.height; r++) {
      for (let c = 0; c < pattern.width; c++) {
        board[row + r][col + c] = pattern.shape[r][c];
        filled[row + r][col + c] = true;
      }
    }
  }

  // 보드를 완전히 채울 때까지 반복
  let attempts = 0;
  while (attempts < 1000) { // 무한 루프 방지
    let allFilled = true;

    // 빈 공간을 찾아서 패턴으로 채우기
    for (let r = 0; r < BOARD_HEIGHT && allFilled; r++) {
      for (let c = 0; c < BOARD_WIDTH && allFilled; c++) {
        if (!filled[r][c]) {
          allFilled = false;

          // 이 위치에 배치 가능한 패턴들을 찾기
          const availablePatterns = patterns.filter(p => canPlacePattern(r, c, p));

          if (availablePatterns.length > 0) {
            // 랜덤하게 하나 선택해서 배치
            const selectedPattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
            placePattern(r, c, selectedPattern);
          }
        }
      }
    }

    if (allFilled) break;
    attempts++;
  }

  // 혹시 못 채운 곳이 있다면 1x2 패턴으로 강제로 채우기
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH - 1; c++) {
      if (!filled[r][c] && !filled[r][c + 1]) {
        const pattern1x2 = patterns[Math.floor(Math.random() * 5)]; // 첫 5개는 1x2 패턴
        placePattern(r, c, pattern1x2);
      }
    }
  }

  return board;
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

      setParticles(prev => [...prev, ...newParticles]);
      setFallingApples(prev => [...prev, ...newFalling]);

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

      // 개별 애니메이션들이 자동으로 정리되도록 타이머 설정
      newParticles.forEach(particle => {
        window.setTimeout(() => {
          setParticles(prev => prev.filter(p => p.id !== particle.id));
        }, 1200);
      });

      newFalling.forEach(apple => {
        window.setTimeout(() => {
          setFallingApples(prev => prev.filter(a => a.id !== apple.id));
        }, 1400);
      });

      window.setTimeout(() => {
        setIsAnimating(false);
      }, 100);
    } else {
      setSelectedCells(new Set());
      setStartCell(null);
    }
  }, [isTimeOver, isMenuOpen, adChoiceOpen, adPlayingOpen, selectedCells, boardData]);

  /** ===== 모바일에서 스와이프 뒤로가기 방지 ===== */
  useEffect(() => {
    const preventSwipeBack = (e: TouchEvent) => {
      // 화면 가장자리에서 시작하는 스와이프를 감지하여 방지
      const touch = e.touches[0];
      if (touch && touch.clientX < 50) { // 왼쪽 가장자리 50px 이내
        e.preventDefault();
      }
    };

    const preventContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // 스와이프 뒤로가기 방지 (왼쪽 가장자리만)
    document.addEventListener('touchstart', preventSwipeBack, { passive: false });
    document.addEventListener('contextmenu', preventContextMenu);

    // cleanup
    return () => {
      document.removeEventListener('touchstart', preventSwipeBack);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);

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
