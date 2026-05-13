import React from 'react';
import './StatusBadge.css';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    variant,
    size = 'md',
    className = '',
    children,
    ...props
}) => {
    return (
        <span
            className={`dms-badge dms-badge--${variant} dms-badge--${size} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
};
