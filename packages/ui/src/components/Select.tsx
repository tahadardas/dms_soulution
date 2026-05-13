import React from 'react';
import './Select.css';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className = '', label, error, hint, id, children, ...props }, ref) => {
        const selectId = id || React.useId();

        return (
            <div className="dms-select-wrapper">
                {label && <label htmlFor={selectId} className="dms-label">{label}</label>}
                <select
                    ref={ref}
                    id={selectId}
                    className={`dms-select ${error ? 'dms-select--error' : ''} ${className}`}
                    {...props}
                >
                    {children}
                </select>
                {hint && <span className="dms-hint-text">{hint}</span>}
                {error && <span className="dms-error-text">{error}</span>}
            </div>
        );
    }
);

Select.displayName = 'Select';
