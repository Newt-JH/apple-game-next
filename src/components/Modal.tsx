import React from 'react';
import './Modal.css';

interface ModalProps {
  isActive: boolean;
  title: string;
  message: string;
  primaryButtonText?: string;
  onPrimaryButtonClick?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
}

const Modal: React.FC<ModalProps> = ({
  isActive,
  title,
  message,
  primaryButtonText,
  onPrimaryButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
}) => {
  if (!isActive) return null;

  return (
    <div className="modal-container active">
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-title">{title}</div>
          <div className="modal-text">{message}</div>
          <div className="modal-buttons">
            {secondaryButtonText && onSecondaryButtonClick && (
              <button className="modal-button secondary" onClick={onSecondaryButtonClick}>
                {secondaryButtonText}
              </button>
            )}
            {primaryButtonText && onPrimaryButtonClick && (
              <button className="modal-button primary" onClick={onPrimaryButtonClick}>
                {primaryButtonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
