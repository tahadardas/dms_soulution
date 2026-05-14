import React from 'react';
import { Select, Input, Switch } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { SettingSection, SettingRow } from './SettingCommon';

interface InventorySettingsProps {
    settings: any;
    setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export const InventorySettings: React.FC<InventorySettingsProps> = ({ settings, setSettings }) => {
    const { t } = useTranslation();

    const updateInventory = (updates: any) => {
        setSettings((prev: any) => ({
            ...prev,
            inventory: { ...prev.inventory, ...updates }
        }));
    };

    return (
        <div className="space-y-6">
            <SettingSection
                title={t('settings.sections.inventoryCosting')}
                description={t('settings.descriptions.inventoryCosting')}
            >
                <SettingRow label={t('settings.fields.costingMethod')}>
                    <Select
                        value={settings.inventory.valuationMethod}
                        onChange={(e) => updateInventory({ valuationMethod: e.target.value })}
                    >
                        <option value="FIFO">{t('settings.options.fifo')}</option>
                        <option value="WAC">{t('settings.options.wac')}</option>
                    </Select>
                </SettingRow>
                <SettingRow label={t('settings.fields.autoDeductStock')}>
                    <Switch
                        checked={settings.inventory.autoDeductStockOnSale}
                        onCheckedChange={(checked) => updateInventory({ autoDeductStockOnSale: checked })}
                    />
                </SettingRow>
            </SettingSection>

            <SettingSection
                title={t('settings.sections.thresholds')}
                description={t('settings.descriptions.thresholds')}
            >
                <SettingRow label={t('settings.fields.lowStockThreshold')}>
                    <Input
                        type="number"
                        value={String(settings.inventory.lowStockThresholdGlobal)}
                        onChange={(e) => updateInventory({ lowStockThresholdGlobal: Number(e.target.value) })}
                    />
                </SettingRow>
            </SettingSection>
        </div>
    );
};
