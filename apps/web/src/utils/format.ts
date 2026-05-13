export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_CURRENCY = 'USD';
export const CURRENCY_STORAGE_KEY = 'dms-currency';
export const CURRENCY_CHANGE_EVENT = 'dms-currency-change';

export const normalizeLocale = (lang?: string) => {
    if (!lang) return DEFAULT_LOCALE;
    return lang.toLowerCase().startsWith('ar') ? 'ar' : DEFAULT_LOCALE;
};

export const normalizeCurrency = (currency?: string) => {
    const trimmed = (currency || DEFAULT_CURRENCY).trim();
    return trimmed ? trimmed.toUpperCase() : DEFAULT_CURRENCY;
};

export const getStoredCurrency = () => {
    if (typeof window === 'undefined') return DEFAULT_CURRENCY;
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return normalizeCurrency(stored || DEFAULT_CURRENCY);
};

export const setStoredCurrency = (currency: string) => {
    if (typeof window === 'undefined') return;
    const normalized = normalizeCurrency(currency);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, normalized);
    window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: normalized }));
};

const toDate = (value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

export const formatMoney = (
    amount: number,
    currency?: string,
    locale: string = DEFAULT_LOCALE,
    options: Intl.NumberFormatOptions = {}
) => {
    const rawCurrency = currency || getStoredCurrency();
    const normalizedCurrency = normalizeCurrency(rawCurrency);
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: normalizedCurrency,
            ...options
        });
        return formatter.format(safeAmount);
    } catch {
        // If it's not a valid ISO code, use it as a custom symbol
        const numberFormatter = new Intl.NumberFormat(locale, {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            ...options
        });
        const formattedNumber = numberFormatter.format(safeAmount);
        
        // Basic heuristic for symbol placement: Arabic/Persian usually suffix, others prefix
        const isRtl = locale.startsWith('ar') || locale.startsWith('fa');
        return isRtl ? `${formattedNumber} ${rawCurrency}` : `${rawCurrency} ${formattedNumber}`;
    }
};

export const formatNumber = (
    value: number,
    locale: string = DEFAULT_LOCALE,
    options: Intl.NumberFormatOptions = {}
) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat(locale, options).format(safeValue);
};

export const formatDate = (
    value: Date | string | number,
    locale: string = DEFAULT_LOCALE,
    options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
) => {
    const date = toDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(locale, options).format(date);
};

export const formatDateTime = (
    value: Date | string | number,
    locale: string = DEFAULT_LOCALE,
    options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }
) => {
    const date = toDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(locale, options).format(date);
};
