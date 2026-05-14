import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';

export const usePOSSession = (branchId: number) => {
    const api = useApi();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const checkSession = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const res = await api<any>(`/pos/sessions/active?branch_id=${branchId}`);
            setSession(res);
        } catch (err: any) {
            if (err.status === 404) {
                setSession(null);
            }
        } finally {
            setLoading(false);
        }
    }, [api, branchId]);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const openSession = async (openingBalance: number) => {
        const res = await api<any>('/pos/sessions/open', {
            method: 'POST',
            body: JSON.stringify({ branch_id: branchId, opening_balance: openingBalance })
        });
        setSession(res);
        return res;
    };

    const closeSession = async (closingBalance: number, notes?: string) => {
        const res = await api<any>(`/pos/sessions/${session.id}/close`, {
            method: 'POST',
            body: JSON.stringify({ closing_balance: closingBalance, notes })
        });
        setSession(null);
        return res;
    };

    return {
        session,
        loading,
        openSession,
        closeSession,
        refresh: checkSession
    };
};
