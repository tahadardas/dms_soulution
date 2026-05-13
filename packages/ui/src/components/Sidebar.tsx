import React from 'react';
import './Sidebar.css';

export interface SidebarItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    href?: string;
    onClick?: () => void;
    active?: boolean;
}

export interface SidebarSection {
    title?: string;
    items: SidebarItem[];
}

export interface SidebarProps {
    sections: SidebarSection[];
    header?: React.ReactNode;
    footer?: React.ReactNode;
    collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ sections, header, footer, collapsed }) => {
    return (
        <aside className={`dms-sidebar ${collapsed ? 'dms-sidebar--collapsed' : ''}`}>
            {header && <div className="dms-sidebar__header">{header}</div>}
            <nav className="dms-sidebar__nav">
                {sections.map((section, idx) => (
                    <div key={idx} className="dms-sidebar__section">
                        {section.title && <div className="dms-sidebar__section-title">{section.title}</div>}
                        <ul className="dms-sidebar__list">
                            {section.items.map(item => (
                                <li key={item.id}>
                                    <a
                                        href={item.href || '#'}
                                        onClick={item.onClick}
                                        className={`dms-sidebar__item ${item.active ? 'dms-sidebar__item--active' : ''}`}
                                    >
                                        {item.icon && <span className="dms-sidebar__icon">{item.icon}</span>}
                                        {!collapsed && <span className="dms-sidebar__label">{item.label}</span>}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>
            {footer && <div className="dms-sidebar__footer">{footer}</div>}
        </aside>
    );
};
