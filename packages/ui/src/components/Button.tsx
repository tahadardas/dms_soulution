import React from 'react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`dms-btn dms-btn--${variant} dms-btn--${size} ${className}`}
                disabled={isLoading || disabled}
                {...props}
            >
                {isLoading && <span className="dms-btn__spinner">...</span>}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
