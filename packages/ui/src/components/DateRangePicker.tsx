import React from 'react';
import { Input } from './Input';
import './DateRangePicker.css';

interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    label?: string;
    startLabel: string;
    endLabel: string;
    separatorLabel: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    value,
    onChange,
    label,
    startLabel,
    endLabel,
    separatorLabel
}) => {

    const handleChange = (field: keyof DateRange, val: string) => {
        onChange({ ...value, [field]: val });
    };

    return (
        <div className="dms-date-range-picker">
            {label && <span className="dms-label">{label}</span>}
            <div className="dms-date-inputs">
                <Input
                    type="date"
                    value={value.startDate}
                    onChange={e => handleChange('startDate', e.target.value)}
                    aria-label={startLabel}
                />
                <span className="dms-date-separator">{separatorLabel}</span>
                <Input
                    type="date"
                    value={value.endDate}
                    onChange={e => handleChange('endDate', e.target.value)}
                    aria-label={endLabel}
                />
            </div>
        </div>
    );
};
