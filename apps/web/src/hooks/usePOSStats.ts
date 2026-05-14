import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';

export const usePOSStats = (sessionId: number | null) => {
    const api = useApi();
    const [stats, setStats] = useState({
        openingCash: 0,
        netCashFlow: 0,
        expectedCash: 0,
        totalSales: 0,
        totalReturns: 0
    });
    const [loading, setLoading] = useState(false);

    const loadStats = useCallback(async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const res = await api<any>(`/pos/sessions/${sessionId}/stats`);
            setStats(res);
        } catch (err) {
            console.error('Failed to load session stats', err);
        } finally {
            setLoading(false);
        }
    }, [api, sessionId]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    return {
        stats,
        loading,
        refresh: loadStats
    };
};
