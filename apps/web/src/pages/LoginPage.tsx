import React, { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, useToast } from '@dms/ui';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/BackButton';
import { useTranslation } from 'react-i18next';
import '../styles/LoginPage.css';

const LoginPage: React.FC = () => {
    const { login, isLoading } = useAuth();
    const toast = useToast();
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const canSubmit = username.trim().length > 0 && password.trim().length > 0;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        try {
            await login(username, password);
            toast.success(t('toast.auth.loginSuccess'));
        } catch (err: any) {
            const message = err?.message || t('errors.auth.loginFailed');
            setError(message);
            toast.error(message);
        }
    };

    return (
        <div className="login-page">
            <PageHeader
                title={t('common.login.title')}
                subtitle={t('common.login.subtitle')}
                backButton={<BackButton />}
            />
            <Card className="login-card" padding="lg">
                <CardHeader>
                    <CardTitle>{t('common.login.cardTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className="login-form" onSubmit={handleSubmit}>
                        <Input
                            label={t('common.login.username')}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                            placeholder={t('common.login.usernamePlaceholder')}
                        />
                        <Input
                            label={t('common.login.password')}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            placeholder={t('common.login.passwordPlaceholder')}
                        />
                        {error && <div className="login-error">{error}</div>}
                        <Button type="submit" size="lg" isLoading={isLoading} disabled={!canSubmit}>
                            {t('common.login.signIn')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginPage;
