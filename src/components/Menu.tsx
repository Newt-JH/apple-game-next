import React from 'react';
import Link from 'next/link';
import './Menu.css';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRestart: () => void;
  onHelpClick: () => void; // New prop for help button
}

const Menu: React.FC<MenuProps> = ({ isOpen, onClose, onRestart, onHelpClick }) => {
  if (!isOpen) {
    return null;
  }

  const handleRestartClick = () => {
    onRestart();
    onClose(); // Close menu after action
  };

  const handleHelpClick = () => {
    onHelpClick();
    onClose(); // Close menu after action
  };

  return (
    <div className={`menu-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="menu-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="menu-title">Menu</h2>
        <button className="menu-button" onClick={handleRestartClick}>
          🔄 다시하기
        </button>
        <Link href="/home" className="menu-button">
          🏠 홈으로
        </Link>
        <button className="menu-button" onClick={handleHelpClick}> {/* New Help button */}
          ❓ 도움말
        </button>
        <button className="menu-button secondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
};

export default Menu;
