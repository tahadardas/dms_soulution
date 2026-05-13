import React from 'react';
import './Switch.css';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, label, className = '', ...props }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            className={`dms-switch ${checked ? 'dms-switch--checked' : ''} ${className}`}
            onClick={() => onCheckedChange(!checked)}
            {...props}
        >
            <span className="dms-switch__thumb" />
        </button>
    );
};
