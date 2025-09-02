'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

/** ====== 모바일 풀스크린 스타트 화면 + 하트/광고/공지/도움말 ====== **/

// ---- 상수 ----
const MAX_LIVES = 5;
const REFILL_INTERVAL_MS = 10 * 60 * 1000; // 10분
const COOKIE_DAYS = 365;

// ---- 쿠키 헬퍼 ----
function setCookie(name: string, value: string, days = COOKIE_DAYS) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}
function getCookie(name: string): string | null {
  const pairs = document.cookie?.split(';') ?? [];
  for (const p of pairs) {
    const [k, ...rest] = p.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// ---- 유틸 ----
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ---- 타입 ----
type NoticeItem = {
  id: string;
  title: string;
  date: string;
  content: string;
};

export default function HomePage() {
  const router = useRouter();

  // ---------------- 하트 상태 ----------------
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [lastRefill, setLastRefill] = useState<number>(Date.now());

  // 처음 로드 시 쿠키에서 복구 + 충전 체크
  useEffect(() => {
    const savedLives = parseInt(getCookie('lives') || `${MAX_LIVES}`, 10);
    const savedLast = parseInt(getCookie('lastRefill') || `${Date.now()}`, 10);

    // 경과시간만큼 충전
    const now = Date.now();
    const elapsed = Math.max(0, now - savedLast);
    const gained = Math.floor(elapsed / REFILL_INTERVAL_MS);
    const newLives = clamp(savedLives + gained, 0, MAX_LIVES);
    const newLastRefill =
      newLives >= MAX_LIVES ? now : savedLast + gained * REFILL_INTERVAL_MS;

    setLives(newLives);
    setLastRefill(newLastRefill);
    setCookie('lives', String(newLives));
    setCookie('lastRefill', String(newLastRefill));
  }, []);

  // 30초마다 충전 체크(백그라운드 틱)
  useEffect(() => {
    const t = setInterval(() => {
      if (lives >= MAX_LIVES) return;
      const now = Date.now();
      const elapsed = now - lastRefill;
      if (elapsed >= REFILL_INTERVAL_MS) {
        const gained = Math.floor(elapsed / REFILL_INTERVAL_MS);
        const newLives = clamp(lives + gained, 0, MAX_LIVES);
        const newLast =
          newLives >= MAX_LIVES ? now : lastRefill + gained * REFILL_INTERVAL_MS;
        setLives(newLives);
        setLastRefill(newLast);
        setCookie('lives', String(newLives));
        setCookie('lastRefill', String(newLast));
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [lives, lastRefill]);

  const timeToNext = useMemo(() => {
    if (lives >= MAX_LIVES) return 0;
    const remain = REFILL_INTERVAL_MS - (Date.now() - lastRefill);
    return Math.max(0, remain);
  }, [lives, lastRefill]);

  const mmss = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // -------------- 모달 상태 --------------
  const [helpOpen, setHelpOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [adAskOpen, setAdAskOpen] = useState(false); // "광고 보고 충전?" 모달
  const [adPlayingOpen, setAdPlayingOpen] = useState(false); // 빈 광고 모달
  const [noticeDetail, setNoticeDetail] = useState<NoticeItem | null>(null);

  // -------------- 공지 더미 데이터 --------------
  const notices: NoticeItem[] = [
    {
      id: 'n1',
      title: '[사과게임] 오픈 이벤트 진행 안내',
      date: '2025-06-14',
      content:
        '목업 공지사항입니다.\n오픈 기념 이벤트가 진행 중입니다. 게임을 플레이하고 보상을 획득하세요!',
    },
    {
      id: 'n2',
      title: '테스트 공지',
      date: '2025-06-12',
      content:
        '목업 공지사항입니다.\n버그 제보와 피드백은 언제든지 환영합니다.',
    },
    {
      id: 'n3',
      title: '일부 2레벨 사과 삭제 개선',
      date: '2025-06-12',
      content:
        '목업 공지사항입니다.\n게임 밸런스 개선을 위한 숫자 분포 조정이 적용되었습니다.',
    },
  ];

  // -------------- 액션 --------------
  const tryStartGame = () => {
    if (lives <= 0) {
      // 하트 0개 → 광고 유도
      setAdAskOpen(true);
      return;
    }
    // 하트 사용 후 /game으로 이동
    const nextLives = clamp(lives - 1, 0, MAX_LIVES);
    setLives(nextLives);
    setCookie('lives', String(nextLives));
    setCookie('lastRefill', String(lastRefill)); // 그대로
    router.push('/game');
  };

  const openAdFlow = () => {
    setAdAskOpen(false);
    setAdPlayingOpen(true);
  };

  const closeAdAndRecharge = (amount = 3) => {
    // 광고 다 봤다고 가정 → 하트 +3 (최대 5)
    const newLives = clamp(lives + amount, 0, MAX_LIVES);
    setLives(newLives);
    setCookie('lives', String(newLives));
    if (newLives >= MAX_LIVES) {
      setLastRefill(Date.now());
      setCookie('lastRefill', String(Date.now()));
    }
    setAdPlayingOpen(false);
  };

  // -------------- 스타일 --------------
  const btn = {
    padding: '14px 22px',
    fontSize: '18px',
    color: '#fff',
    background: '#e53935',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 4px 0 #b71c1c',
    cursor: 'pointer',
  } as const;

  const iconBtn = {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(0,0,0,0.35)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    cursor: 'pointer',
  } as const;

  const disabledBtn = {
    ...btn,
    background: '#9e9e9e',
    boxShadow: '0 4px 0 #7b7b7b',
    cursor: 'not-allowed',
  } as const;

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        backgroundImage: "url('/start-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: "'Pretendard', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >

      {/* 상단 좌측: 하트 + MAX + +버튼 */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 12,
          color: '#fff',
        }}
      >
        <span style={{ fontSize: 18 }}>❤️</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {lives} / {MAX_LIVES}
        </span>
        {lives >= MAX_LIVES ? (
          <span
            style={{
              marginLeft: 6,
              padding: '2px 6px',
              background: '#43a047',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            MAX
          </span>
        ) : (
          <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.9 }}>
            다음 충전 {mmss(timeToNext)}
          </span>
        )}

        <button
          style={{
            marginLeft: 8,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.25)',
            color: '#fff',
            cursor: 'pointer',
          }}
          title="광고 보고 하트 충전"
          onClick={() => setAdAskOpen(true)}
        >
          +
        </button>
      </div>

      {/* 우측 아이콘: 도움말 / 공지사항 */}
      <div style={{ position: 'absolute', right: 12, top: 80 }}>
        <button style={iconBtn} onClick={() => setHelpOpen(true)}>도움말</button>
        <button style={iconBtn} onClick={() => setNoticeOpen(true)}>공지</button>
      </div>

      {/* 중앙 타이틀 */}
      <div
        style={{
          position: 'absolute',
          top: '26%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 20,
          border: '2px solid rgba(0,0,0,0.1)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 48,
            color: '#d23f3f',
            letterSpacing: '2px',
            textShadow: '1px 1px 0 #fff',
            whiteSpace: 'nowrap',
          }}
        >
          사 과 게 임
        </h1>
      </div>

      {/* 하단 중앙: 게임 시작 버튼 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 120,
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }}
      >
        <button
          style={lives <= 0 ? disabledBtn : btn}
          onClick={tryStartGame}
          disabled={lives <= 0}
        >
          {lives > 0 ? '게임 시작!' : '하트가 부족합니다'}
        </button>
        <div style={{ marginTop: 10, color: '#fff', textShadow: '1px 1px 2px rgba(0,0,0,0.6)' }}>
          Welcome [Tester #1]!
        </div>
      </div>

      {/* ======= 모달들 ======= */}
      {/* 광고: 시청 여부 묻는 모달 */}
      {adAskOpen && (
        <Modal onClose={() => setAdAskOpen(false)}>
          <div style={{ padding: 8, color: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>광고를 보고 하트를 충전하시겠어요?</h3>
            <p style={{ opacity: 0.9 }}>광고를 끝까지 시청하면 하트가 3개 충전됩니다.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={btn} onClick={openAdFlow}>광고 시청</button>
              <button style={{ ...btn, background: '#757575', boxShadow: '0 4px 0 #616161' }} onClick={() => setAdAskOpen(false)}>닫기</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 광고 재생(빈 모달) → X 누르면 충전 */}
      {adPlayingOpen && (
        <Modal onClose={() => closeAdAndRecharge(3)} closeLabel="X(광고 닫기)">
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <div>광고 재생 중… (목업)</div>
          </div>
        </Modal>
      )}

      {/* 도움말 모달 (두 페이지) */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* 공지사항 모달 (리스트/디테일) */}
      {noticeOpen && (
        <NoticeModal
          notices={notices}
          detail={noticeDetail}
          onSelect={(n) => setNoticeDetail(n)}
          onBack={() => setNoticeDetail(null)}
          onClose={() => {
            setNoticeDetail(null);
            setNoticeOpen(false);
          }}
        />
      )}
    </main>
  );
}

/** 공통 모달 컴포넌트 */
function Modal({
  children,
  onClose,
  closeLabel = '닫기',
}: {
  children: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(92vw, 520px)',
          background: 'rgba(40,54,80,0.92)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.25)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {closeLabel}
        </button>
        {children}
      </div>
    </div>
  );
}

/** 도움말 모달 */
function HelpModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(1);
  const next = () => setPage((p) => Math.min(2, p + 1));
  const close = () => onClose();

  const Section = ({ title, bullets }: { title: string; bullets: string[] }) => (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ color: '#fff', marginTop: 0 }}>{title}</h3>
      <ul style={{ color: '#fff', opacity: 0.95, margin: 0, paddingLeft: 20 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: 6 }}>{b}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <Modal onClose={close}>
      {page === 1 ? (
        <div style={{ color: '#fff' }}>
          <h2 style={{ marginTop: 0 }}>도움말</h2>
          <Section
            title="게임 방법"
            bullets={[
              '직사각형 영역을 드래그해서 선택하세요.',
              '해당 영역의 사과 숫자 합이 10이 되면 사라집니다.',
              '모든 사과를 제거하면 클리어예요.',
            ]}
          />
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button
              style={{
                padding: '10px 16px',
                background: '#5c6bc0',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={next}
            >
              다음
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: '#fff' }}>
          <h2 style={{ marginTop: 0 }}>게임 방법 (예시)</h2>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, lineHeight: 1.6 }}>
            <div>✅ 드래그한 직사각형 내부의 합이 <b>10</b>이면 사과가 사라집니다.</div>
            <div>✅ 예) (2,3,5), (4,6), (1,2,7), (1,1,3,5) 등</div>
            <div>⚠️ 배치에 따라 제거 순서를 고민해야 할 때가 있어요.</div>
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button
              style={{
                padding: '10px 16px',
                background: '#9e9e9e',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={close}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** 공지사항 모달 */
function NoticeModal({
  notices,
  detail,
  onSelect,
  onBack,
  onClose,
}: {
  notices: NoticeItem[];
  detail: NoticeItem | null;
  onSelect: (n: NoticeItem) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    cursor: 'pointer',
    color: '#fff',
  };

  return (
    <Modal onClose={onClose}>
      {!detail ? (
        <div style={{ color: '#fff' }}>
          <h2 style={{ marginTop: 0 }}>공지사항</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notices.map((n) => (
              <div key={n.id} style={itemStyle} onClick={() => onSelect(n)}>
                <div style={{ fontWeight: 700 }}>{n.title}</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>{n.date}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <button
              style={{
                padding: '10px 16px',
                background: '#9e9e9e',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>{detail.title}</h3>
          <div style={{ opacity: 0.8, marginBottom: 10 }}>{detail.date}</div>
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {detail.content}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              style={{
                padding: '10px 16px',
                background: '#5c6bc0',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={onBack}
            >
              목록
            </button>
            <button
              style={{
                padding: '10px 16px',
                background: '#9e9e9e',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
