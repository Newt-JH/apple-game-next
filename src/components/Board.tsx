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

const MAX_HEARTS = 5;
const HEART_COOKIE = 'lives';

/** ===================== 난이도 프리셋 ===================== */
/**
 * weights: 세 가지 블록 타입의 가중치(상대값)
 *  - p12: 1x2 (두 칸 합 10)
 *  - p13: 1x3 (세 칸 합 10)
 *  - p22: 2x2 (네 칸 합 10)
 * timeBonusMs: 합10 제거 시 주는 보상(ms)
 */
const DIFFICULTY_PRESETS: Record<
  number,
  { weights: { p12: number; p13: number; p22: number }; timeBonusMs: number }
> = {
  1: { weights: { p12: 70, p13: 20, p22: 10 }, timeBonusMs: 400 }, // Easy
  2: { weights: { p12: 55, p13: 30, p22: 15 }, timeBonusMs: 300 }, // Normal
  3: { weights: { p12: 40, p13: 35, p22: 25 }, timeBonusMs: 200 }, // Hard
  4: { weights: { p12: 28, p13: 42, p22: 30 }, timeBonusMs: 180 }, // Expert
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
// 1x2 (합 10)
const P12_PATTERNS: number[][] = [
  [1,9],[2,8],[3,7],[4,6],[5,5],
];
// 1x3 (합 10) — 순열 셔플해서 사용
const P13_PATTERNS_BASE: number[][] = [
  [1,1,8],[1,2,7],[1,3,6],[1,4,5],
  [2,2,6],[2,3,5],[2,4,4],
  [3,3,4],
];
// 2x2 (합 10) — 행우선(4칸)으로 채움, 순열 셔플
const P22_PATTERNS_BASE: number[][] = [
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
function permuted<T>(arr: T[]): T[] { return shuffle(arr); }

/** ===================== 가로 분할(2와 3만 사용) ===================== */
/**
 * 가로 10을 2와 3의 조합으로 분할(예: [2,2,3,3] 또는 [3,2,2,3] 등)
 * - 1칸 잔여가 절대로 안 생김
 * - 난수로 섞어 다양성 유지
 */
function widthSegments10(): number[] {
  const candidates: number[][] = [
    [2,2,2,2,2],
    [2,2,3,3],
    [2,3,2,3],
    [3,2,3,2],
    [3,3,2,2],
    [3,2,2,3],
  ];
  return shuffle(candidates)[0].slice();
}

/** ===================== 블록 배치(옵션2 전용) ===================== */
/**
 * 한 밴드(1행 또는 2행)를 채운다.
 * - bandH: 1 또는 2
 * - weights: {p12,p13,p22} 가중치로 타입 고르기
 * - 2행일 때 width==2이면 (2x2)와 (1x2*2) 중 가중치로 선택
 * - 2행일 때 width==3이면 자동으로 (1x3 두 줄)
 * - 1행일 때는 1x2/1x3만 사용
 */
function fillBand(
  board: number[][],
  startRow: number,
  bandH: number,
  weights: { p12: number; p13: number; p22: number },
) {
  const widths = widthSegments10(); // [2,2,3,3] 등
  let c = 0;

  // 미리 셔플한 패턴 풀(다양성↑)
  const P13_PATTERNS = shuffle(P13_PATTERNS_BASE);
  const P22_PATTERNS = shuffle(P22_PATTERNS_BASE);

  for (const w of widths) {
    if (bandH === 2) {
      if (w === 2) {
        // 2x2 vs (1x2 x 2) 선택
        const total = weights.p22 + weights.p12;
        const r = Math.random() * total;
        const use22 = (r < weights.p22) && (startRow + 1 < BOARD_HEIGHT) && (c + 1 < BOARD_WIDTH);

        if (use22) {
          // 2x2: 4칸을 패턴에서 뽑아 2x2로
          const flat = permuted(P22_PATTERNS[(Math.random() * P22_PATTERNS.length) | 0]);
          let k = 0;
          for (let dr = 0; dr < 2; dr++) {
            for (let dc = 0; dc < 2; dc++) {
              board[startRow + dr][c + dc] = flat[k++];
            }
          }
        } else {
          // 1x2 두 줄
          for (let rrow = 0; rrow < 2; rrow++) {
            const pair = permuted(P12_PATTERNS[(Math.random() * P12_PATTERNS.length) | 0]);
            board[startRow + rrow][c + 0] = pair[0];
            board[startRow + rrow][c + 1] = pair[1];
          }
        }
        c += 2;
      } else if (w === 3) {
        // 1x3 두 줄
        for (let rrow = 0; rrow < 2; rrow++) {
          const trip = permuted(P13_PATTERNS[(Math.random() * P13_PATTERNS.length) | 0]);
          board[startRow + rrow][c + 0] = trip[0];
          board[startRow + rrow][c + 1] = trip[1];
          board[startRow + rrow][c + 2] = trip[2];
        }
        c += 3;
      }
    } else {
      // bandH === 1: 1x2 또는 1x3만
      // 가중치로 선택(2는 p12, 3은 p13)
      const total = weights.p12 + weights.p13;
      const r = Math.random() * total;
      const choose3 = r >= weights.p12; // p13 쪽이 뽑힘
      const useW = choose3 ? 3 : 2;

      if (useW === 2) {
        const pair = permuted(P12_PATTERNS[(Math.random() * P12_PATTERNS.length) | 0]);
        board[startRow][c + 0] = pair[0];
        board[startRow][c + 1] = pair[1];
        c += 2;
      } else {
        const trip = permuted(P13_PATTERNS[(Math.random() * P13_PATTERNS.length) | 0]);
        board[startRow][c + 0] = trip[0];
        board[startRow][c + 1] = trip[1];
        board[startRow][c + 2] = trip[2];
        c += 3;
      }
    }
  }
}

/**
 * 항상 클리어 가능한 보드 생성(옵션2):
 * - 위→아래로 내려가며 밴드(1행/2행) 단위로 채움
 * - 밴드 내부는 2와 3의 조합으로 가로 10을 정확히 분할
 * - 블록 타입은 1x2 / 1x3 / 2x2만 사용
 * - 안전장치: 생성 후 남은 0칸이 있으면 1x2 페어로 즉시 채움
 */
function generateBoardOption2(weights: { p12: number; p13: number; p22: number }): number[][] {
  const board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));

  let r = 0;
  while (r < BOARD_HEIGHT) {
    const canTwo = r + 1 < BOARD_HEIGHT;

    // 난이도에 따라 2행 밴드를 조금 더 선호(하드 이상일수록 ↑)
    const twoRowBias =
      (weights.p22 + weights.p13) / (weights.p12 + weights.p13 + weights.p22); // 0~1 대략적 지표
    const twoRowProb = Math.min(0.8, 0.35 + twoRowBias * 0.4); // 0.35~0.75

    const bandH = canTwo && Math.random() < twoRowProb ? 2 : 1;
    fillBand(board, r, bandH, weights);
    r += bandH;
  }

  // ✅ 안전장치: 혹시라도 0이 남으면 무조건 1x2 페어로 메꿔 빈칸 방지
  for (let rr = 0; rr < BOARD_HEIGHT; rr++) {
    for (let cc = 0; cc < BOARD_WIDTH; cc++) {
      if (board[rr][cc] === 0) {
        const pair = P12_PATTERNS[Math.floor(Math.random() * P12_PATTERNS.length)];
        board[rr][cc] = pair[0];
        if (cc + 1 < BOARD_WIDTH) {
          board[rr][cc + 1] = pair[1];
          cc++;
        } else if (cc - 1 >= 0) {
          // 맨 오른쪽 1칸만 비었을 극히 드문 경우: 왼쪽 칸과 페어로 보정
          board[rr][cc - 1] = pair[0];
          board[rr][cc] = pair[1];
        }
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

  // 쿼리에서 난이도(level=1|2|3|4) 가져오기. 기본 3(Hard).
  const levelParam = Number(searchParams.get('level') ?? '3');
  const level = (levelParam >= 1 && levelParam <= 4) ? levelParam : 3;
  const preset = DIFFICULTY_PRESETS[level];
  const TIME_BONUS_MS = preset.timeBonusMs;

  const [score, setScore] = useState(0);
  const [time, setTime] = useState(MAX_TIME);
  const [isTimeOver, setIsTimeOver] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [boardData, setBoardData] = useState<number[][]>(() =>
    generateBoardOption2(preset.weights)
  );
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; burstX: number; burstY: number }[]
  >([]);
  const [fallingApples, setFallingApples] = useState<
    { id: number; x: number; y: number; width: number; height: number }[]
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

  /** ===== 셀 크기 계산 (Grid + 중앙 고정폭/고정높이 래퍼) ===== */
  const setCellSize = useCallback(() => {
    if (typeof document === "undefined" || !boardRef.current) return;

    const boardEl = boardRef.current;

    // 보드가 차지 가능한 실제 영역
    const availW = boardEl.clientWidth;
    const availH = boardEl.clientHeight;

    // 각 방향에서 가능한 최대 셀 크기
    const maxCellW = availW / BOARD_WIDTH;
    const maxCellH = availH / BOARD_HEIGHT;

    const size = Math.floor(Math.min(maxCellW, maxCellH)); // 정사각형 유지 + 최대화
    document.documentElement.style.setProperty("--cell-size", `${size}px`);
    document.documentElement.style.setProperty("--font-size", `${Math.max(12, Math.floor(size * 0.5))}px`);
    document.documentElement.style.setProperty("--cell-padding", `${Math.floor(size * 0.08)}px`);

    // 래퍼 사이즈(그리드 전체 픽셀 크기)
    const wrapW = size * BOARD_WIDTH;
    const wrapH = size * BOARD_HEIGHT;
    document.documentElement.style.setProperty("--board-wrap-w", `${wrapW}px`);
    document.documentElement.style.setProperty("--board-wrap-h", `${wrapH}px`);
  }, []);

  useEffect(() => {
    setCellSize();
    // iOS 주소창 리플로우 대응
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

  /** ===== 페이지 진입 시: 리로드면 하트 1개 소모, 0개면 충전 유도 ===== */
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === 'reload';

    let lives = parseInt(getCookie(HEART_COOKIE) ?? `${MAX_HEARTS}`, 10);
    if (isNaN(lives)) lives = MAX_HEARTS;

    if (isReload) {
      lives = clamp(lives - 1, 0, MAX_HEARTS); // 새로고침 시 소모
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
    setBoardData(generateBoardOption2(preset.weights));
    setSelectedCells(new Set());
    setStartCell(null);
    setIsAnimating(false);
    setParticles([]);
    setFallingApples([]);
    startTimer();
  };

  const handleRestart = useCallback(() => {
    const afterSpend = spendHeart(1);
    if (afterSpend <= 0) {
      setPendingRestart(true);
      setAdMode('recharge');
      setAdChoiceOpen(true);
      return;
    }
    doRestart();
  }, []); // 최신 상태 참조 OK

  /** ===== 광고 선택 모달 버튼들 ===== */
  const openAdFlow = () => {
    setAdChoiceOpen(false);
    setAdPlayingOpen(true);
  };

  /** ===== 광고 모달 닫힘(시청 완료 처리) ===== */
  const onAdFinished = () => {
    setAdPlayingOpen(false);

    if (adMode === 'recharge') {
      // 하트 풀 충전
      setHearts(MAX_HEARTS);
      setCookie(HEART_COOKIE, String(MAX_HEARTS));
      if (pendingRestart) {
        setPendingRestart(false);
        doRestart();
      }
    } else if (adMode === 'revive') {
      // 이어하기: +60초
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
    if (isTimeOver || isAnimating || isMenuOpen || adChoiceOpen || adPlayingOpen) return;
    const cell = getCellFromTouch(e.touches[0]);
    if (!cell) return;
    setStartCell(cell);
    setSelectedCells(new Set([`${cell.row}-${cell.col}`]));
  }, [isTimeOver, isAnimating, isMenuOpen, adChoiceOpen, adPlayingOpen, getCellFromTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isTimeOver || isAnimating || isMenuOpen || adChoiceOpen || adPlayingOpen) return;
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
  }, [isTimeOver, isAnimating, isMenuOpen, adChoiceOpen, adPlayingOpen, startCell, getCellFromTouch]);

  const handleTouchEnd = useCallback(() => {
    if (isTimeOver || isAnimating || isMenuOpen || adChoiceOpen || adPlayingOpen || selectedCells.size === 0) return;

    let sum = 0;
    selectedCells.forEach(key => {
      const [row, col] = key.split('-').map(Number);
      sum += boardData[row][col];
    });

    const isValid = sum === 10 && selectedCells.size >= 2;
    if (isValid) {
      setIsAnimating(true);
      const cleared = selectedCells.size;

      setScore(prev => prev + cleared);
      setTime(prev => Math.min(MAX_TIME, prev + TIME_BONUS_MS)); // 난이도별 보상

      const newParticles: { id: number; x: number; y: number; burstX: number; burstY: number }[] = [];
      const newFalling: { id: number; x: number; y: number; width: number; height: number }[] = [];

      selectedCells.forEach(key => {
        const [row, col] = key.split('-').map(Number);
        const cellElement = (typeof document !== "undefined")
          ? document.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement | null
          : null;
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
        newFalling.push({ id: Date.now() + Math.random(), x: startX, y: startY, width: rect.width, height: rect.height });
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
  }, [isTimeOver, isAnimating, isMenuOpen, adChoiceOpen, adPlayingOpen, selectedCells, boardData, TIME_BONUS_MS]);

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
        className={`board ${isAnimating || isMenuOpen || adChoiceOpen || adPlayingOpen ? 'locked' : ''}`}
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

      {/* 기본 종료 모달(100점 이상인 경우) */}
      {isTimeOver && !adChoiceOpen && !adPlayingOpen && score >= 100 && (
        <Modal
          isActive
          title="⏰ 시간이 종료되었습니다!"
          message={`최종 점수: ${score}`}
          primaryButtonText="다시하기"
          onPrimaryButtonClick={handleRestart}
        />
      )}

      {/* 광고 선택 모달 (충전/리바이브 공용) */}
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

      {/* 광고 재생(목업) — 홈과 동일한 스타일 */}
      {adPlayingOpen && <AdPlayingModal onClose={onAdFinished} />}

      {/* 도움말 */}
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

/** ====== 광고 재생(목업) 모달: 홈과 동일한 UI ====== */
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
