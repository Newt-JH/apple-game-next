import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GameHeader from './GameHeader';
import Cell from './Cell';
import Modal from './Modal';
import ParticleContainer from './ParticleContainer';
import Menu from './Menu';
import './Board.css';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 17;
const MAX_TIME = 100000;

const MAX_HEARTS = 5;
const HEART_COOKIE = 'lives';

// --- 쿠키 유틸 ---
const setCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return; // SSR 방지
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${
    60 * 60 * 24 * 365
  }`;
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

function generateRandomNumber() {
  const probabilities = [1,1,1,1,1,1,2,2,2,2,2,3,3,3,3,4,4,4,5,5,6,6,7,8,9];
  const randomIndex = Math.floor(Math.random() * probabilities.length);
  return probabilities[randomIndex];
}
function generateRandomBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => generateRandomNumber())
  );
}

type AdMode = 'recharge' | 'revive' | null;

const Board: React.FC = () => {
  const router = useRouter();

  const [score, setScore] = useState(0);
  const [time, setTime] = useState(MAX_TIME);
  const [isTimeOver, setIsTimeOver] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [boardData, setBoardData] = useState<number[][]>(generateRandomBoard());
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
  const [adMode, setAdMode] = useState<AdMode>(null);        // 'recharge' | 'revive'
  const [adChoiceOpen, setAdChoiceOpen] = useState(false);   // 선택 모달(광고 보시겠어요?)
  const [adPlayingOpen, setAdPlayingOpen] = useState(false); // 실제 광고(목업) 모달
  const [pendingRestart, setPendingRestart] = useState(false);

  const timerRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // --- 셀 크기 계산 ---
  const setCellSize = useCallback(() => {
    if (typeof document === "undefined" || !boardRef.current) return;
    const boardElement = boardRef.current;
    const boardWidth = boardElement.clientWidth - 8;
    const boardHeight = boardElement.clientHeight - 30;
    const cellWidth = (boardWidth - (BOARD_WIDTH - 1) * 1) / BOARD_WIDTH;
    const cellHeight = (boardHeight - (BOARD_HEIGHT - 1) * 1) / BOARD_HEIGHT;
    const size = Math.floor(Math.min(cellWidth, cellHeight));
    document.documentElement.style.setProperty("--cell-size", `${size}px`);
    document.documentElement.style.setProperty("--font-size", `${size * 0.5}px`);
    document.documentElement.style.setProperty("--cell-padding", `${size * 0.1}px`);
  }, []);

  useEffect(() => {
    setCellSize();
    window.addEventListener('resize', setCellSize);
    return () => window.removeEventListener('resize', setCellSize);
  }, [setCellSize]);

  // --- 타이머 ---
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

  // --- 페이지 진입 시: 리로드면 하트 1개 소모, 0개면 충전 유도 ---
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

  // --- 하트 소모 ---
  const spendHeart = (n = 1): number => {
    let lives = parseInt(getCookie(HEART_COOKIE) ?? `${hearts}`, 10);
    if (isNaN(lives)) lives = hearts;
    const next = clamp(lives - n, 0, MAX_HEARTS);
    setCookie(HEART_COOKIE, String(next));
    setHearts(next);
    return next;
  };

  // --- 재시작 & 초기화 ---
  const doRestart = () => {
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
  }, []); // 내부에서 최신 상태 참조 OK

  // --- 광고 선택 모달 버튼들 ---
  const openAdFlow = () => {
    // 선택 모달 닫고 실제 광고 모달 열기
    setAdChoiceOpen(false);
    setAdPlayingOpen(true);
  };

  // 광고 모달 닫힘(시청 완료 처리)
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

  // --- 터치 핸들러 ---
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
      setTime(prev => Math.min(MAX_TIME, prev + 2000)); // +2초 고정

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
  }, [isTimeOver, isAnimating, isMenuOpen, adChoiceOpen, adPlayingOpen, selectedCells, boardData]);

  // --- 시간 종료 시: 점수 < 100 → 리바이브 제안 ---
  useEffect(() => {
    if (isTimeOver) {
      if (score < 100) {
        setAdMode('revive');
        setAdChoiceOpen(true);
      }
    }
  }, [isTimeOver, score]);

  return (
    <div className="game-container">
      <GameHeader
        score={score}
        time={time}                 // 게이지 노출용
        onMenuClick={() => setIsMenuOpen(true)}
      />

      <div
        className={`board ${isAnimating || isMenuOpen || adChoiceOpen || adPlayingOpen ? 'locked' : ''}`}
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
              // 홈으로
              setAdChoiceOpen(false);
              router.push('/home');
            } else {
              // 끝내기: 점수 모달 없이 그냥 닫음(원하면 여기서 종료 모달 띄우기 가능)
              setAdChoiceOpen(false);
            }
          }}
        />
      )}

      {/* 실제 광고 모달(목업) : 닫기 = 시청완료 처리 */}
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

/** ====== 광고 재생(목업) 모달 ====== */
function AdPlayingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-adplay">
        <div className="fake-ad">광고 재생 중… (목업)</div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            광고 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
