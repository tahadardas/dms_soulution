import { useEffect, useState } from 'react';
import { CURRENCY_CHANGE_EVENT, CURRENCY_STORAGE_KEY, getStoredCurrency } from '../utils/format';

export const useCurrency = () => {
    const [currency, setCurrency] = useState(getStoredCurrency);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key && event.key !== CURRENCY_STORAGE_KEY) return;
            setCurrency(getStoredCurrency());
        };

        const handleCustom = () => {
            setCurrency(getStoredCurrency());
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(CURRENCY_CHANGE_EVENT, handleCustom);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(CURRENCY_CHANGE_EVENT, handleCustom);
        };
    }, []);

    return currency;
};
