import React from 'react';
import { PageHeader } from './PageHeader';

export interface StandardPageProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const StandardPage: React.FC<StandardPageProps> = ({ 
    title, 
    subtitle, 
    actions, 
    children, 
    className = '' 
}) => {
    return (
        <div className={`dms-standard-page ${className}`}>
            <PageHeader 
                title={title} 
                subtitle={subtitle} 
                actions={actions} 
            />
            <div className="dms-standard-page__content p-6">
                {children}
            </div>
        </div>
    );
};
