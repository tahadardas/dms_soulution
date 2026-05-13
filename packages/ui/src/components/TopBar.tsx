import React from 'react';
import './TopBar.css';

export interface TopBarProps {
    logo?: React.ReactNode;
    title?: string;
    children?: React.ReactNode;
    actions?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ logo, title, children, actions }) => {
    return (
        <header className="dms-topbar">
            <div className="dms-topbar__left">
                {logo && <div className="dms-topbar__logo">{logo}</div>}
                {title && <h1 className="dms-topbar__title">{title}</h1>}
            </div>
            <div className="dms-topbar__center">{children}</div>
            <div className="dms-topbar__right">{actions}</div>
        </header>
    );
};
