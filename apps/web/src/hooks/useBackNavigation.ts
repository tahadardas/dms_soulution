import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFallbackPathForRole } from '../routes';

const canNavigateBack = () => {
    if (typeof window === 'undefined') return false;
    const state = window.history.state as { idx?: number } | null;
    if (state && typeof state.idx === 'number') {
        return state.idx > 0;
    }
    return window.history.length > 1;
};

export const useBackNavigation = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const fallbackPath = getFallbackPathForRole(user?.role);

    const goBack = useCallback(() => {
        if (canNavigateBack()) {
            navigate(-1);
            return;
        }
        navigate(fallbackPath, { replace: true });
    }, [navigate, fallbackPath]);

    return { goBack, fallbackPath };
};
