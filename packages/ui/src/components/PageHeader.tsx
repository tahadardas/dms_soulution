import React from 'react';
import './PageHeader.css';

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    backButton?: React.ReactNode;
    onBack?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, onBack }) => {
    return (
        <header className="dms-page-header">
            <div className="dms-page-header__left">
                {onBack && (
                    <div className="dms-page-header__back" onClick={onBack}>
                        <div className="flip-rtl">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </div>
                    </div>
                )}
                <div className="dms-page-header__text">
                    <h1 className="dms-page-header__title">{title}</h1>
                    {subtitle && <p className="dms-page-header__subtitle">{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="dms-page-header__actions">{actions}</div>}
        </header>
    );
};
