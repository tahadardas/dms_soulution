import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { PermissionCode } from '../lib/permissions';

export type PermissionMode = 'any' | 'all';

const resolvePermissions = (perm?: PermissionCode, perms?: PermissionCode[]) => {
    if (perms && perms.length > 0) return perms;
    if (perm) return [perm];
    return [];
};

export const useCan = (perm?: PermissionCode, perms?: PermissionCode[], mode: PermissionMode = 'any') => {
    const { hasPermission } = useAuth();
    const list = useMemo(() => resolvePermissions(perm, perms), [perm, perms]);

    return useMemo(() => {
        if (list.length === 0) return true;
        if (mode === 'all') {
            return list.every((permission) => hasPermission(permission));
        }
        return list.some((permission) => hasPermission(permission));
    }, [hasPermission, list, mode]);
};
