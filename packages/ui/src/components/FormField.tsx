import React from 'react';

export interface FormFieldProps {
    label?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, required, children, className = '' }) => {
    return (
        <div className={`dms-form-field ${error ? 'dms-form-field--error' : ''} ${className}`}>
            {label && (
                <label className="dms-form-field__label">
                    {label} {required && <span className="dms-form-field__required">*</span>}
                </label>
            )}
            <div className="dms-form-field__content">
                {children}
            </div>
            {error && <span className="dms-form-field__error-text">{error}</span>}
        </div>
    );
};
