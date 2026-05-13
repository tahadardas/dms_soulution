import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, Input, PageHeader, Switch, useToast } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { useAppConfig } from '../context/AppConfigContext';
import { useTranslation } from 'react-i18next';
import '../styles/DeviceConfigPage.css';

export const DeviceConfigPage: React.FC = () => {
    const toast = useToast();
    const navigate = useNavigate();
    const { apiUrl, kioskMode, setApiUrl, setKioskMode, saveConfig, isLoading } = useAppConfig();
    const { t } = useTranslation();
    const [draftUrl, setDraftUrl] = useState(apiUrl);
    const [draftKiosk, setDraftKiosk] = useState(kioskMode);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setDraftUrl(apiUrl);
        setDraftKiosk(kioskMode);
    }, [apiUrl, kioskMode]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            setApiUrl(draftUrl);
            setKioskMode(draftKiosk);
            await saveConfig({ apiUrl: draftUrl, kioskMode: draftKiosk });
            toast.success(t('toast.deviceConfig.saved'));
        } catch (err: any) {
            toast.error(err?.message || t('errors.deviceConfig.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="device-config">
            <PageHeader
                title={t('settings.deviceConfig.title')}
                subtitle={t('settings.deviceConfig.subtitle')}
            />

            <Card>
                <CardContent>
                    {isLoading && <div className="device-config__loading">{t('settings.deviceConfig.loading')}</div>}
                    {!isLoading && (
                        <div className="device-config__form">
                            <Input
                                label={t('settings.deviceConfig.apiBaseUrl')}
                                value={draftUrl}
                                onChange={(event) => setDraftUrl(event.target.value)}
                                placeholder={t('settings.deviceConfig.apiPlaceholder')}
                            />
                            <div className="device-config__row">
                                <div>
                                    <div className="device-config__label">{t('settings.deviceConfig.kioskMode')}</div>
                                    <div className="device-config__hint">{t('settings.deviceConfig.kioskHint')}</div>
                                </div>
                                <Switch
                                    checked={draftKiosk}
                                    onCheckedChange={(checked) => setDraftKiosk(checked)}
                                />
                            </div>
                            <div className="device-config__actions">
                                <Button variant="secondary" onClick={() => navigate('/pos')}>
                                    {t('settings.deviceConfig.goToPos')}
                                </Button>
                                <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                                    {t('settings.deviceConfig.save')}
                                </Button>
                            </div>
                            <div className="device-config__note">
                                {t('settings.deviceConfig.tip')} <code>http://192.168.1.10:3000</code>.
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DeviceConfigPage;
