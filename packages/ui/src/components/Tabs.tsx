import React, { useState } from 'react';
import './Tabs.css';

export interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

export interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
    onTabChange?: (tabId: string) => void;
    children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab, onTabChange, children }) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        onTabChange?.(tabId);
    };

    return (
        <div className="dms-tabs">
            <div className="dms-tabs__list" role="tablist">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`dms-tabs__tab ${activeTab === tab.id ? 'dms-tabs__tab--active' : ''}`}
                        onClick={() => handleTabClick(tab.id)}
                    >
                        {tab.icon && <span className="dms-tabs__icon">{tab.icon}</span>}
                        {tab.label}
                    </button>
                ))}
            </div>
            {children}
        </div>
    );
};

export interface TabPanelProps {
    tabId: string;
    activeTab: string;
    children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ tabId, activeTab, children }) => {
    if (tabId !== activeTab) return null;
    return <div className="dms-tabs__panel" role="tabpanel">{children}</div>;
};
