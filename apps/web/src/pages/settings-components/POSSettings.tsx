import React from 'react';
import { Input, Switch } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { SettingSection, SettingRow } from './SettingCommon';

interface POSSettingsProps {
    settings: any;
    setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export const POSSettings: React.FC<POSSettingsProps> = ({ settings, setSettings }) => {
    const { t } = useTranslation();

    const updatePOS = (updates: any) => {
        setSettings((prev: any) => ({
            ...prev,
            pos: { ...prev.pos, ...updates }
        }));
    };

    return (
        <div className="space-y-6">
            <SettingSection
                title={t('settings.sections.posOps')}
                description={t('settings.descriptions.posOps')}
            >
                <SettingRow label={t('settings.fields.tablesEnabled')}>
                    <Switch
                        checked={settings.pos.tablesEnabled}
                        onCheckedChange={(checked) => updatePOS({ tablesEnabled: checked })}
                    />
                </SettingRow>
                <SettingRow label={t('settings.fields.tipsEnabled')}>
                    <Switch
                        checked={settings.pos.tipsEnabled}
                        onCheckedChange={(checked) => updatePOS({ tipsEnabled: checked })}
                    />
                </SettingRow>
            </SettingSection>

            <SettingSection
                title={t('settings.sections.returnsPolicy')}
                description={t('settings.descriptions.returnsPolicy')}
            >
                <SettingRow label={t('settings.fields.allowReturns')}>
                    <Switch
                        checked={settings.pos.allowReturns}
                        onCheckedChange={(checked) => updatePOS({ allowReturns: checked })}
                    />
                </SettingRow>
                <SettingRow label={t('settings.fields.returnWindow')}>
                    <Input
                        type="number"
                        value={String(settings.pos.returnWindowMinutes)}
                        disabled={!settings.pos.allowReturns}
                        onChange={(e) => updatePOS({ returnWindowMinutes: Number(e.target.value) })}
                    />
                </SettingRow>
            </SettingSection>
        </div>
    );
};
