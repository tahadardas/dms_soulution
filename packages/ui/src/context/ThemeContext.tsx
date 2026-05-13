import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    accentColor: string;
    setAccentColor: (color: string) => void; // Hex color
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    defaultAccent?: string;
    storageKey?: string;
}

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    defaultAccent = '#2563eb',
    storageKey = 'dms-theme'
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );

    const [accentColor, setAccentColor] = useState<string>(
        () => localStorage.getItem(`${storageKey}-accent`) || defaultAccent
    );

    useEffect(() => {
        const root = window.document.documentElement;

        // Remove existing
        root.classList.remove('light', 'dark');

        // Handle System
        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
            root.classList.add(systemTheme);
            root.setAttribute('data-theme', systemTheme);
        } else {
            root.classList.add(theme);
            root.setAttribute('data-theme', theme);
        }

        // Persist
        localStorage.setItem(storageKey, theme);
    }, [theme, storageKey]);

    useEffect(() => {
        // Apply Accent Color Override
        if (accentColor) {
            document.documentElement.style.setProperty('--brand-primary', accentColor);
            document.documentElement.style.setProperty('--color-primary', accentColor);
            document.documentElement.style.setProperty('--border-brand', accentColor);
            document.documentElement.style.setProperty('--border-focus', accentColor);
            document.documentElement.style.setProperty('--color-primary-hover', accentColor);
            // We might want to calculate hover shade darker logic here if needed, 
            // e.g., using tinycolor2 or manual HSL manipulation. 
            // For now, let's just set the primary.
            localStorage.setItem(`${storageKey}-accent`, accentColor);
        }
    }, [accentColor, storageKey]);

    const value = {
        theme,
        setTheme: (t: Theme) => setTheme(t),
        accentColor,
        setAccentColor: (c: string) => setAccentColor(c),
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider');

    return context;
}
