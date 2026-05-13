import React from 'react';
import { useToast } from '@dms/ui';
import { PermissionCode } from '../lib/permissions';
import { PermissionMode, useCan } from '../hooks/useCan';
import { useTranslation } from 'react-i18next';
import '../styles/PermissionGate.css';

export interface PermissionGateProps {
    perm?: PermissionCode;
    perms?: PermissionCode[];
    mode?: PermissionMode;
    hide?: boolean;
    tooltip?: string;
    toastMessage?: string;
    children: React.ReactElement;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
    perm,
    perms,
    mode = 'any',
    hide = false,
    tooltip,
    toastMessage,
    children
}) => {
    const allowed = useCan(perm, perms, mode);
    const toast = useToast();
    const { t } = useTranslation();
    const resolvedTooltip = tooltip || t('errors.permissionDenied');

    if (allowed) {
        return children;
    }

    if (hide) {
        return null;
    }

    const handleDenied = () => {
        toast.error(toastMessage || resolvedTooltip);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleDenied();
        }
    };

    const childProps: Record<string, any> = {
        disabled: true,
        'aria-disabled': true,
        style: {
            ...(children.props.style || {}),
            pointerEvents: 'none'
        }
    };

    return (
        <span
            className="permission-gate permission-gate--disabled"
            title={resolvedTooltip}
            role="button"
            tabIndex={0}
            onClick={handleDenied}
            onKeyDown={handleKeyDown}
        >
            {React.cloneElement(children, childProps)}
        </span>
    );
};

export default PermissionGate;
