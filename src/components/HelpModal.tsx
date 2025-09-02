import React from 'react';
import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="help-modal-close-button" onClick={onClose}>
          X
        </button>
        <h2 className="help-modal-title">도움말</h2>
        <p className="help-modal-text">
          같은 줄에 있는 숫자들을 드래그하여 합이 10이 되도록 만드세요!
          <br />
          성공하면 점수를 얻고 시간이 추가됩니다.
          <br />
          시간 게이지가 모두 소모되면 게임 오버입니다.
          <br />
          광고를 시청하여 하트를 충전할 수 있습니다.
        </p>
      </div>
    </div>
  );
};

export default HelpModal;
