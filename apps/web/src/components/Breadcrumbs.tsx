import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/Breadcrumbs.css';

export interface BreadcrumbItem {
    labelKey: string;
    label?: string;
    path: string;
}

export const Breadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
    const { t } = useTranslation();
    if (!items.length) return null;
    return (
        <nav className="app-breadcrumbs" aria-label="Breadcrumbs">
            <ol className="app-breadcrumbs__list">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    const label = item.labelKey ? t(item.labelKey) : (item.label || '');
                    return (
                        <li key={`${item.path}-${index}`} className="app-breadcrumbs__item">
                            {isLast ? (
                                <span className="app-breadcrumbs__current">{label}</span>
                            ) : (
                                <Link className="app-breadcrumbs__link" to={item.path}>
                                    {label}
                                </Link>
                            )}
                            {!isLast && <span className="app-breadcrumbs__separator">/</span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
