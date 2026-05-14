import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
    suffix?: string;
    prefix?: string;
    multiline?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
    ({ className = '', label, error, hint, suffix, prefix, id, multiline, ...props }, ref) => {
        const inputId = id || React.useId();

        return (
            <div className="dms-input-wrapper">
                {label && <label htmlFor={inputId} className="dms-label">{label}</label>}
                <div className={`dms-input-container ${error ? 'dms-input-container--error' : ''} ${multiline ? 'dms-input-container--multiline' : ''}`}>
                    {prefix && <span className="dms-input-prefix">{prefix}</span>}
                    {multiline ? (
                        <textarea
                            ref={ref as React.Ref<HTMLTextAreaElement>}
                            id={inputId}
                            className={`dms-input dms-textarea ${className}`}
                            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            ref={ref as React.Ref<HTMLInputElement>}
                            id={inputId}
                            className={`dms-input ${className}`}
                            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
                        />
                    )}
                    {suffix && <span className="dms-input-suffix">{suffix}</span>}
                </div>
                {hint && <span className="dms-hint-text">{hint}</span>}
                {error && <span className="dms-error-text">{error}</span>}
            </div>
        );
    }
);
Input.displayName = 'Input';
