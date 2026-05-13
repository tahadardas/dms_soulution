import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import './Modal.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="dms-modal-overlay" ref={overlayRef} onClick={(e) => {
            if (e.target === overlayRef.current) onClose();
        }}>
            <div className="dms-modal">
                <div className="dms-modal-header">
                    {title && <h3 className="dms-modal-title">{title}</h3>}
                    <button className="dms-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="dms-modal-body">
                    {children}
                </div>
                {footer && <div className="dms-modal-footer">{footer}</div>}
            </div>
        </div>,
        document.body
    );
};
