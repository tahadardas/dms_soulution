import React from 'react';
import { Button } from '@dms/ui';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { useTranslation } from 'react-i18next';

export interface BackButtonProps {
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
    className?: string;
    showIcon?: boolean;
}

export const BackButton: React.FC<BackButtonProps> = ({
    label,
    size = 'sm',
    variant = 'ghost',
    className,
    showIcon = true
}) => {
    const { goBack } = useBackNavigation();
    const { t } = useTranslation();
    const resolvedLabel = label || t('common.back');
    return (
        <Button size={size} variant={variant} className={className} onClick={goBack}>
            {showIcon && (
                <span className="flip-rtl" style={{ display: 'inline-flex', marginInlineEnd: '4px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </span>
            )}
            {resolvedLabel}
        </Button>
    );
};
