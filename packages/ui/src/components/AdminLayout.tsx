import React from 'react';
import './AdminLayout.css';

export interface AdminLayoutProps {
    sidebar: React.ReactNode;
    topbar?: React.ReactNode;
    children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ sidebar, topbar, children }) => {
    return (
        <div className="dms-admin-layout">
            {sidebar}
            <div className="dms-admin-layout__main">
                {topbar}
                <main className="dms-admin-layout__content">
                    {children}
                </main>
            </div>
        </div>
    );
};
