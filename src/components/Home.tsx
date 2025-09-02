'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import './Home.css';

const MAX_LIVES = 5;
const REFILL_INTERVAL_MS = 10 * 60 * 1000; // 10분
const COOKIE_DAYS = 365;

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
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type NoticeItem = {
  id: string;
  title: string;
  date: string;
  content: string;
};

export default function HomePage() {
  const router = useRouter();

  // 하트 상태
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [lastRefill, setLastRefill] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  // 모달 상태
  const [helpOpen, setHelpOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeDetail, setNoticeDetail] = useState<NoticeItem | null>(null);
  const [adAskOpen, setAdAskOpen] = useState(false);
  const [adPlayingOpen, setAdPlayingOpen] = useState(false);

  // 최초 쿠키 로드 + 즉시 풀충전 체크
  useEffect(() => {
    const savedLives = parseInt(getCookie('lives') || `${MAX_LIVES}`, 10);
    const savedLast = parseInt(getCookie('lastRefill') || `${Date.now()}`, 10);
    const current = Date.now();
    const elapsed = current - savedLast;

    if (elapsed >= REFILL_INTERVAL_MS) {
      setLives(MAX_LIVES);
      setLastRefill(current);
      setCookie('lives', String(MAX_LIVES));
      setCookie('lastRefill', String(current));
    } else {
      setLives(savedLives);
      setLastRefill(savedLast);
    }
  }, []);

  // 1초 틱: 카운트다운 갱신 + 리필 시 풀충전
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (lives < MAX_LIVES) {
        const elapsed = Date.now() - lastRefill;
        if (elapsed >= REFILL_INTERVAL_MS) {
          setLives(MAX_LIVES);
          setLastRefill(Date.now());
          setCookie('lives', String(MAX_LIVES));
          setCookie('lastRefill', String(Date.now()));
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lives, lastRefill]);

  const timeToNext = useMemo(() => {
    if (lives >= MAX_LIVES) return 0;
    return Math.max(0, REFILL_INTERVAL_MS - (now - lastRefill));
  }, [lives, lastRefill, now]);

  const mmss = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // 게임 시작
    const tryStartGame = () => {
    if (lives <= 0) {
      setAdAskOpen(true); // 하트 없음 → 광고 유도 모달
      return;
    }
    const next = clamp(lives - 1, 0, MAX_LIVES);
    setLives(next);
    setCookie('lives', String(next));
    setCookie('lastRefill', String(lastRefill));
    router.push('/game');
  };

  // 광고 플로우
  const openAdFlow = () => {
    setAdAskOpen(false);
    setAdPlayingOpen(true);
  };
  const closeAdAndRecharge = () => {
    setLives(MAX_LIVES);                // 풀 충전
    const t = Date.now();
    setLastRefill(t);
    setCookie('lives', String(MAX_LIVES));
    setCookie('lastRefill', String(t));
    setAdPlayingOpen(false);
  };

  // 더미 공지 (날짜 순)
  const notices: NoticeItem[] = [
    { id: 'n1', title: '오픈 이벤트 안내', date: '2025-06-14', content: '목업 공지입니다. 오픈 기념 이벤트가 진행됩니다.' },
    { id: 'n2', title: '테스트 공지', date: '2025-06-15', content: '목업 공지입니다. 피드백은 언제든지 환영합니다.' },
    { id: 'n3', title: '버그 수정 패치', date: '2025-06-18', content: '일부 숫자가 정상적으로 표시되지 않던 문제가 수정되었습니다.' },
    { id: 'n4', title: '점검 안내', date: '2025-06-20', content: '서버 안정화를 위한 점검이 6월 20일 오전 2시 ~ 4시에 진행됩니다.' },
    { id: 'n5', title: '추가 개선 안내', date: '2025-06-22', content: '게임 난이도 조정을 위한 숫자 분포 개선이 적용되었습니다.' },
    { id: 'n6', title: '여름 이벤트 시작', date: '2025-07-01', content: '여름 맞이 특별 이벤트가 시작됩니다. 많은 참여 부탁드립니다.' },
    { id: 'n7', title: '추가 버그 수정', date: '2025-07-05', content: '광고 시청 후 하트가 정상적으로 충전되지 않던 문제가 해결되었습니다.' },
    { id: 'n8', title: '다음 업데이트 예고', date: '2025-07-10', content: '도움말과 공지사항 UI가 개선될 예정입니다.' },
  ];

  return (
    <main className="home">
      {/* 하트 박스 */}
      <div className="heart-box">
        <span>❤️</span>
        <span>{lives} / {MAX_LIVES}</span>
        {lives >= MAX_LIVES
          ? <span className="max-label">MAX</span>
          : <span>다음 충전 {mmss(timeToNext)}</span>}
        <button className="heart-plus" onClick={() => setAdAskOpen(true)}>+</button>
      </div>

      {/* 우측 아이콘 */}
      <div className="icon-box">
        <button className="icon-btn" onClick={() => setHelpOpen(true)}>?</button>
        <button className="icon-btn" onClick={() => setNoticeOpen(true)}>!</button>
      </div>

      {/* 시작 버튼 */}
      <div className="start-box">
        <button
          className="btn"
          onClick={tryStartGame}
        >
          게임 시작!
        </button>
      </div>

      {/* 광고: 하트 충전 문의 */}
      {adAskOpen && (
        <AdAskModal
          lives={lives}
          onConfirm={openAdFlow}
          onClose={() => setAdAskOpen(false)}
        />
      )}

      {/* 광고: 재생(목업) */}
      {adPlayingOpen && <AdPlayingModal onClose={closeAdAndRecharge} />}

      {/* 도움말 */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* 공지사항 */}
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

/** ===== 광고 모달들 ===== */
function AdAskModal({
  onConfirm,
  onClose,
  lives,
}: {
  onConfirm: () => void;
  onClose: () => void;
  lives: number;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-adask">
        <h2 className="modal-title">하트 충전</h2>
        <div className="modal-card">
          {lives <= 0 ? (
            <>
              <p>하트가 없습니다.</p>
              <p>광고를 보고 <b>하트를 풀 충전</b>하시겠어요?</p>
            </>
          ) : (
            <>
              <p>광고를 보면 <b>하트를 풀 충전</b>할 수 있어요.</p>
              <p>지금 보시겠어요?</p>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onConfirm}>광고 시청</button>
          <button className="btn gray" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

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

/** ===== 도움말 모달 ===== */
function HelpModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(1);
  const next = () => setPage((p) => Math.min(2, p + 1));

  return (
    <div className="modal-overlay">
      <div className="modal-help">
        {page === 1 ? (
          <div>
            <h2 className="modal-title">도움말</h2>
            <div className="modal-card">
              <p>✅ 사과를 드래그해서 선택하세요.</p>
              <p>✅ 사과 숫자의 합이 10이면 사라집니다.</p>
              <p>✅ 모든 사과를 제거하면 클리어예요.</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={next}>다음</button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="modal-title">게임 방법</h2>
            <div className="modal-card">
              <p>✅ (2,3,5), (4,6), (1,2,7) 등 <br />합이 10이 되는 조합</p>
              <p>⚠️ 배치에 따라 제거 순서를 <br />고민해야 할 때가 있어요.</p>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={onClose}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ===== 공지사항 모달 ===== */
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
  return (
    <div className="modal-overlay">
      <div className="modal-notice">
        {!detail ? (
          <div>
            <h2 className="modal-title">📢 공지사항</h2>
            <ul className="notice-list">
              {notices.map((n) => (
                <li key={n.id} className="notice-item" onClick={() => onSelect(n)}>
                  <div className="notice-title">{n.title}</div>
                  <div className="notice-date">{n.date}</div>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button className="btn gray" onClick={onClose}>닫기</button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="modal-title">{detail.title}</h2>
            <div className="notice-date">{detail.date}</div>
            <div className="notice-content">{detail.content}</div>
            <div className="modal-actions">
              <button className="btn" onClick={onBack}>목록</button>
              <button className="btn gray" onClick={onClose}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
