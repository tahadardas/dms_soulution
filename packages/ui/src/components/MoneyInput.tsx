import React from 'react';
import { Input, InputProps } from './Input';

export interface MoneyInputProps extends Omit<InputProps, 'type' | 'onChange'> {
    value: number;
    currency?: string;
    onChange: (value: number) => void;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({ value, currency = 'JOD', onChange, ...props }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        onChange(isNaN(val) ? 0 : val);
    };

    return (
        <div className="dms-money-input">
            <Input
                {...props}
                type="number"
                step="0.001"
                value={value || ''}
                onChange={handleChange}
                suffix={currency}
            />
        </div>
    );
};
