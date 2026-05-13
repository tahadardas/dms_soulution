import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from './useCurrency';
import { formatMoney, normalizeLocale } from '../utils/format';

export const useCurrencyFormatter = () => {
    const { i18n } = useTranslation();
    const currency = useCurrency();
    
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    
    const formatCurrency = useCallback(
        (value: number) => formatMoney(value, currency, locale),
        [currency, locale]
    );

    return { formatCurrency, currency, locale };
};
