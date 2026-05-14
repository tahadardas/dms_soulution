import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, ToastProvider } from '@dms/ui';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { POSProvider } from './context/POSContext';
import { AuthProvider } from './context/AuthContext';
import { AppConfigProvider } from './context/AppConfigContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ThemeProvider>
                <ToastProvider>
                    <AppConfigProvider>
                        <I18nextProvider i18n={i18n}>
                            <AuthProvider>
                                <POSProvider>
                                    <ErrorBoundary>
                                        <App />
                                    </ErrorBoundary>
                                </POSProvider>
                            </AuthProvider>
                        </I18nextProvider>
                    </AppConfigProvider>
                </ToastProvider>
            </ThemeProvider>
        </HashRouter>
    </React.StrictMode>,
);
