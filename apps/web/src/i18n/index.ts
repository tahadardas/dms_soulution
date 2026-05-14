import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';
import ar from './locales/ar/common.json';

export const LANGUAGE_STORAGE_KEY = 'dms-language';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

const detectLanguage = (): string => {
    if (typeof window === 'undefined') return 'ar';
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
    // Default to Arabic for this POS system
    return 'ar';
};

const applyDirection = (lang: string) => {
    if (typeof document === 'undefined') return;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
};

// Initialize with detected language first
let initialLanguage = detectLanguage();

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { common: en },
            ar: { common: ar }
        },
        lng: initialLanguage,
        fallbackLng: 'en',
        defaultNS: 'common',
        interpolation: {
            escapeValue: false
        }
    });

applyDirection(i18n.language);

// If running in Electron, load language from Electron store asynchronously
if (isElectron) {
    (window as any).electronAPI.getLanguage().then((lang: string) => {
        if (lang && (lang === 'ar' || lang === 'en') && lang !== i18n.language) {
            i18n.changeLanguage(lang);
        }
    }).catch(() => {
        // Fallback to detected language if Electron API fails
    });
}

i18n.on('languageChanged', (lang) => {
    applyDirection(lang);
    if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        // Persist to Electron store if available
        if (isElectron) {
            (window as any).electronAPI.saveLanguage(lang).catch(() => {
                // Silently fail if Electron API is unavailable
            });
        }
    }
});

export default i18n;

