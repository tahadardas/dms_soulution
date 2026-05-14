import React from 'react';
import { Select, Input } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { SettingSection, SettingRow } from './SettingCommon';
import { Account } from '../../types/accounting';

interface AccountingSettingsProps {
    settings: any;
    setSettings: React.Dispatch<React.SetStateAction<any>>;
    accounts: Account[];
}

export const AccountingSettings: React.FC<AccountingSettingsProps> = ({ settings, setSettings, accounts }) => {
    const { t } = useTranslation();

    const updateAccounting = (updates: any) => {
        setSettings((prev: any) => ({
            ...prev,
            accounting: { ...prev.accounting, ...updates }
        }));
    };

    const updateMapping = (key: string, value: string) => {
        setSettings((prev: any) => ({
            ...prev,
            accounting: {
                ...prev.accounting,
                chartOfAccountsMapping: {
                    ...prev.accounting.chartOfAccountsMapping,
                    [key]: value
                }
            }
        }));
    };

    return (
        <div className="space-y-6">
            <SettingSection
                title={t('settings.sections.fiscalPeriods')}
                description={t('settings.descriptions.fiscalPeriods')}
            >
                <SettingRow label={t('settings.fields.fiscalYearStartMonth')}>
                    <Select
                        value={String(settings.accounting.fiscalYearStartMonth)}
                        onChange={(e) => updateAccounting({ fiscalYearStartMonth: Number(e.target.value) })}
                    >
                        {Array.from({ length: 12 }).map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                        ))}
                    </Select>
                </SettingRow>
                <SettingRow label={t('settings.fields.fiscalYearStartDay')}>
                    <Select
                        value={String(settings.accounting.fiscalYearStartDay)}
                        onChange={(e) => updateAccounting({ fiscalYearStartDay: Number(e.target.value) })}
                    >
                        {Array.from({ length: 28 }).map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                        ))}
                    </Select>
                </SettingRow>
                <SettingRow
                    label={t('settings.fields.currencyCode')}
                    description={t('settings.fields.currencyCodeHint')}
                >
                    <Input
                        value={settings.accounting.currencyCode}
                        maxLength={3}
                        onChange={(e) => updateAccounting({ currencyCode: e.target.value.toUpperCase() })}
                    />
                </SettingRow>
            </SettingSection>

            <SettingSection
                title={t('settings.sections.coaMapping')}
                description={t('settings.descriptions.coaMapping')}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: 'posCash', label: t('settings.fields.posCash') },
                        { key: 'posBank', label: t('settings.fields.posBank') },
                        { key: 'revenue', label: t('settings.fields.revenue') },
                        { key: 'discounts', label: t('settings.fields.discounts') },
                        { key: 'taxPayable', label: t('settings.fields.taxPayable') },
                        { key: 'inventory', label: t('settings.fields.inventory') },
                        { key: 'cogs', label: t('settings.fields.cogs') }
                    ].map((field) => (
                        <Select
                            key={field.key}
                            label={field.label}
                            value={settings.accounting.chartOfAccountsMapping[field.key] || ''}
                            onChange={(e) => updateMapping(field.key, e.target.value)}
                        >
                            <option value="">{t('common.unmapped')}</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.code}>{acc.code} - {acc.name}</option>
                            ))}
                        </Select>
                    ))}
                </div>
            </SettingSection>
        </div>
    );
};
