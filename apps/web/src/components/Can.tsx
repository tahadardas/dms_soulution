import React from 'react';
import { PermissionCode } from '../lib/permissions';
import { PermissionMode, useCan } from '../hooks/useCan';

export interface CanProps {
    perm?: PermissionCode;
    perms?: PermissionCode[];
    mode?: PermissionMode;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ perm, perms, mode = 'any', fallback = null, children }) => {
    const allowed = useCan(perm, perms, mode);
    if (!allowed) return <>{fallback}</>;
    return <>{children}</>;
};

export default Can;
