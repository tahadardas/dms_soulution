import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, hint, id, ...props }, ref) => {
        const inputId = id || React.useId();

        return (
            <div className="dms-input-wrapper">
                {label && <label htmlFor={inputId} className="dms-label">{label}</label>}
                <input
                    ref={ref}
                    id={inputId}
                    className={`dms-input ${error ? 'dms-input--error' : ''} ${className}`}
                    {...props}
                />
                {hint && <span className="dms-hint-text">{hint}</span>}
                {error && <span className="dms-error-text">{error}</span>}
            </div>
        );
    }
);
Input.displayName = 'Input';
