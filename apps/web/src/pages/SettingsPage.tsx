import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, Input, PageHeader, Select, Switch, Tabs, useTheme, useToast } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';
import { Account } from '../types/accounting';
import { useTranslation } from 'react-i18next';
import { setStoredCurrency } from '../utils/format';
import '../styles/SettingsPage.css';

type SettingsCategory = 'accounting' | 'costing' | 'inventory' | 'pos' | 'printing' | 'theme';

const SettingSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="settings-section">
        <h3 className="settings-section__title">{title}</h3>
        {description && <p className="settings-section__description">{description}</p>}
        <Card>
            <CardContent>{children}</CardContent>
        </Card>
    </div>
);

const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
    <div className="settings-row">
        <div className="settings-row__label">
            <div className="settings-row__title">{label}</div>
            {description && <div className="settings-row__description">{description}</div>}
        </div>
        <div className="settings-row__control">{children}</div>
    </div>
);

const DEFAULT_SETTINGS = {
    accounting: {
        chartOfAccountsMapping: {
            posCash: '1010',
            posBank: '1020',
            revenue: '4100',
            discounts: '4200',
            taxPayable: '2200',
            inventory: '1200',
            cogs: '5100',
            Cash: '1010',
            Bank: '1020',
            Sales: '4100',
            COGS: '5100'
        },
        currencyCode: 'USD',
        postingPolicy: 'IMMEDIATE',
        fiscalYearStartMonth: 1,
        fiscalYearStartDay: 1,
        fiscalPeriodType: 'MONTHLY',
        allowManualJournalEntries: true
    },
    costing: {
        defaultAllocationMethod: 'DIRECT',
        allocationBasis: 'SALES',
        costCentersEnabled: false,
        defaultCostCenter: 'GENERAL',
        costClassificationDefault: 'DIRECT',
        autoCalculateUnitCost: true
    },
    inventory: {
        valuationMethod: 'WAC',
        defaultUnit: 'Unit',
        lowStockThresholdGlobal: 10,
        autoDeductStockOnSale: true,
        allowNegativeStock: false,
        quantityPrecision: 2,
        unitConversionPolicy: 'STRICT'
    },
    pos: {
        tablesEnabled: true,
        serviceChargePercentage: 0,
        allowDiscounts: true,
        maxDiscountPercentage: 100,
        discountReasonRequired: false,
        tipsEnabled: true,
        allowReturns: true,
        returnWindowMinutes: 1440,
        returnReasonRequired: true,
        shortcuts: {
            saveOrder: 'F12',
            printReceipt: 'F10',
            printKOT: 'F9',
            clearCart: 'F5'
        }
    },
    printing: {
        defaultReceiptTemplate: 'standard',
        defaultKOTTemplate: 'kitchen-basic',
        defaultZReportTemplate: 'z-report',
        autoPrintReceipt: true,
        autoPrintKOT: true
    },
    theme: {
        mode: 'light',
        accentColor: '#3b82f6',
        borderRadius: 8
    }
};

export const SettingsPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { setTheme, setAccentColor } = useTheme();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsCategory>('accounting');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            setError('');
            try {
                const [data, accountsData] = await Promise.all([
                    api<any>('/settings'),
                    api<{ items: Account[] }>('/accounting/accounts')
                ]);
                const rawCostingMethod = data.costing?.defaultAllocationMethod;
                const rawPostingPolicy = data.accounting?.postingPolicy;
                const postingPolicy = rawPostingPolicy && ['IMMEDIATE', 'MANUAL', 'BATCH'].includes(rawPostingPolicy)
                    ? rawPostingPolicy
                    : DEFAULT_SETTINGS.accounting.postingPolicy;
                const costingMethod = rawCostingMethod && ['DIRECT', 'STEP_DOWN', 'RECIPROCAL'].includes(rawCostingMethod)
                    ? rawCostingMethod
                    : DEFAULT_SETTINGS.costing.defaultAllocationMethod;
                const fiscalStartMonth = data.accounting?.fiscalYearStartMonth || data.accounting?.fiscalPeriodStartMonth;
                const returnWindow = data.pos?.returnWindowMinutes ?? data.pos?.refundWindowMinutes;
                const mapping = {
                    ...DEFAULT_SETTINGS.accounting.chartOfAccountsMapping,
                    ...data.accounting?.chartOfAccountsMapping
                };
                if (mapping.Cash && !mapping.posCash) mapping.posCash = mapping.Cash;
                if (mapping.Bank && !mapping.posBank) mapping.posBank = mapping.Bank;
                if (mapping.Sales && !mapping.revenue) mapping.revenue = mapping.Sales;
                if (mapping.COGS && !mapping.cogs) mapping.cogs = mapping.COGS;
                const themeMode = data.theme?.mode === 'dark' || data.theme?.mode === 'light'
                    ? data.theme.mode
                    : DEFAULT_SETTINGS.theme.mode;
                const inventoryMethod = data.inventory?.valuationMethod === 'FIFO' || data.inventory?.valuationMethod === 'WAC'
                    ? data.inventory.valuationMethod
                    : DEFAULT_SETTINGS.inventory.valuationMethod;
                const currencyCode = (data.accounting?.currencyCode || DEFAULT_SETTINGS.accounting.currencyCode).toUpperCase();
                setSettings({
                    accounting: {
                        ...DEFAULT_SETTINGS.accounting,
                        ...data.accounting,
                        currencyCode,
                        postingPolicy,
                        fiscalYearStartMonth: fiscalStartMonth || DEFAULT_SETTINGS.accounting.fiscalYearStartMonth,
                        fiscalYearStartDay: data.accounting?.fiscalYearStartDay || DEFAULT_SETTINGS.accounting.fiscalYearStartDay,
                        fiscalPeriodType: data.accounting?.fiscalPeriodType || DEFAULT_SETTINGS.accounting.fiscalPeriodType,
                        chartOfAccountsMapping: mapping
                    },
                    costing: {
                        ...DEFAULT_SETTINGS.costing,
                        ...data.costing,
                        defaultAllocationMethod: costingMethod || DEFAULT_SETTINGS.costing.defaultAllocationMethod,
                        allocationBasis: data.costing?.allocationBasis || DEFAULT_SETTINGS.costing.allocationBasis,
                        defaultCostCenter: data.costing?.defaultCostCenter || DEFAULT_SETTINGS.costing.defaultCostCenter,
                        costClassificationDefault: data.costing?.costClassificationDefault || DEFAULT_SETTINGS.costing.costClassificationDefault
                    },
                    inventory: { ...DEFAULT_SETTINGS.inventory, ...data.inventory, valuationMethod: inventoryMethod },
                    pos: {
                        ...DEFAULT_SETTINGS.pos,
                        ...data.pos,
                        returnWindowMinutes: returnWindow ?? DEFAULT_SETTINGS.pos.returnWindowMinutes
                    },
                    printing: { ...DEFAULT_SETTINGS.printing, ...data.printing },
                    theme: {
                        ...DEFAULT_SETTINGS.theme,
                        ...data.theme,
                        mode: themeMode,
                        accentColor: data.theme?.accentColor || data.theme?.primaryColor || DEFAULT_SETTINGS.theme.accentColor
                    }
                });
                setStoredCurrency(currencyCode);
                setAccounts(accountsData.items || []);
                if (themeMode) setTheme(themeMode);
                if (data.theme?.accentColor || data.theme?.primaryColor) {
                    setAccentColor(data.theme?.accentColor || data.theme?.primaryColor);
                }
            } catch (err: any) {
                setError(err?.message || t('errors.settings.loadFailed'));
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, [api, setAccentColor, setTheme, t]);

    const saveCategory = async () => {
        setIsSaving(true);
        setError('');
        try {
            const payload = (() => {
                if (activeTab === 'theme') {
                    return {
                        ...settings.theme,
                        primaryColor: settings.theme.accentColor
                    };
                }
                if (activeTab === 'pos') {
                    return {
                        ...settings.pos,
                        refundWindowMinutes: settings.pos.returnWindowMinutes
                    };
                }
                if (activeTab === 'accounting') {
                    return {
                        ...settings.accounting,
                        fiscalPeriodStartMonth: settings.accounting.fiscalYearStartMonth
                    };
                }
                return settings[activeTab];
            })();

            await api(`/settings/${activeTab}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (activeTab === 'accounting') {
                const nextCurrency = settings.accounting.currencyCode || DEFAULT_SETTINGS.accounting.currencyCode;
                setStoredCurrency(nextCurrency);
            }
            toast.success(t('toast.settings.saved'));
        } catch (err: any) {
            const message = err?.message || t('errors.settings.saveFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'accounting', label: t('settings.tabs.accounting') },
        { id: 'costing', label: t('settings.tabs.costing') },
        { id: 'inventory', label: t('settings.tabs.inventory') },
        { id: 'pos', label: t('settings.tabs.pos') },
        { id: 'printing', label: t('settings.tabs.printing') },
        { id: 'theme', label: t('settings.tabs.theme') }
    ];

    return (
        <div className="settings-page">
            <PageHeader
                title={t('settings.title')}
                subtitle={t('settings.subtitle')}
                backButton={<BackButton />}
                actions={
                    <PermissionGate
                        perm={PERMISSIONS.SET_MANAGE_SETTINGS}
                        tooltip={t('errors.settings.manageDenied')}
                    >
                        <Button variant="primary" isLoading={isSaving} onClick={saveCategory}>
                            {t('common.saveChanges')}
                        </Button>
                    </PermissionGate>
                }
            />

            {error && <div className="settings-error">{error}</div>}
            {isLoading && <div className="settings-loading">{t('settings.loading')}</div>}

            {!isLoading && (
                <>
                    <Tabs tabs={tabs} defaultTab="accounting" onTabChange={(tab) => setActiveTab(tab as SettingsCategory)} />

                    {activeTab === 'accounting' && (
                        <>
                            <SettingSection
                                title={t('settings.sections.fiscalPeriods')}
                                description={t('settings.descriptions.fiscalPeriods')}
                            >
                                <SettingRow label={t('settings.fields.fiscalYearStartMonth')}>
                                    <Select
                                        value={String(settings.accounting.fiscalYearStartMonth)}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                accounting: { ...prev.accounting, fiscalYearStartMonth: Number(event.target.value) }
                                            }))
                                        }
                                    >
                                        {Array.from({ length: 12 }).map((_, idx) => (
                                            <option key={idx + 1} value={idx + 1}>
                                                {idx + 1}
                                            </option>
                                        ))}
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.fiscalYearStartDay')}>
                                    <Select
                                        value={String(settings.accounting.fiscalYearStartDay)}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                accounting: { ...prev.accounting, fiscalYearStartDay: Number(event.target.value) }
                                            }))
                                        }
                                    >
                                        {Array.from({ length: 28 }).map((_, idx) => (
                                            <option key={idx + 1} value={idx + 1}>
                                                {idx + 1}
                                            </option>
                                        ))}
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.fiscalPeriodType')}>
                                    <Select
                                        value={settings.accounting.fiscalPeriodType}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                accounting: { ...prev.accounting, fiscalPeriodType: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="MONTHLY">{t('settings.options.monthly')}</option>
                                        <option value="QUARTERLY">{t('settings.options.quarterly')}</option>
                                        <option value="YEARLY">{t('settings.options.yearly')}</option>
                                    </Select>
                                </SettingRow>
                                <SettingRow
                                    label={t('settings.fields.currencyCode')}
                                    description={t('settings.fields.currencyCodeHint')}
                                >
                                    <Input
                                        value={settings.accounting.currencyCode}
                                        placeholder={t('settings.fields.currencyCodePlaceholder')}
                                        maxLength={3}
                                        onChange={(event) => {
                                            const nextCurrency = event.target.value.toUpperCase().slice(0, 3);
                                            setSettings(prev => ({
                                                ...prev,
                                                accounting: { ...prev.accounting, currencyCode: nextCurrency }
                                            }));
                                        }}
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.postingPolicies')}
                                description={t('settings.descriptions.postingPolicies')}
                            >
                                <SettingRow
                                    label={t('settings.fields.postingPolicy')}
                                    description={t('settings.fields.postingPolicyHint')}
                                >
                                    <Select
                                        value={settings.accounting.postingPolicy}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                accounting: { ...prev.accounting, postingPolicy: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="IMMEDIATE">{t('settings.options.immediate')}</option>
                                        <option value="MANUAL">{t('settings.options.manual')}</option>
                                        <option value="BATCH">{t('settings.options.batch')}</option>
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.allowManualJournal')}>
                                    <Switch
                                        checked={settings.accounting.allowManualJournalEntries}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                accounting: { ...prev.accounting, allowManualJournalEntries: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.coaMapping')}
                                description={t('settings.descriptions.coaMapping')}
                            >
                                <SettingRow label={t('settings.fields.accountMapping')}>
                                    <div className="settings-grid">
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
                                                value={(settings.accounting.chartOfAccountsMapping as any)[field.key] || ''}
                                                onChange={(event) =>
                                                    setSettings(prev => ({
                                                        ...prev,
                                                        accounting: {
                                                            ...prev.accounting,
                                                            chartOfAccountsMapping: {
                                                                ...prev.accounting.chartOfAccountsMapping,
                                                                [field.key]: event.target.value
                                                            }
                                                        }
                                                    }))
                                                }
                                            >
                                                <option value="">{t('common.unmapped')}</option>
                                                {accounts.map((account) => (
                                                    <option key={account.id} value={account.code}>
                                                        {account.code} - {account.name}
                                                    </option>
                                                ))}
                                            </Select>
                                        ))}
                                    </div>
                                </SettingRow>
                            </SettingSection>
                        </>
                    )}

                    {activeTab === 'costing' && (
                        <>
                            <SettingSection
                                title={t('settings.sections.costCenters')}
                                description={t('settings.descriptions.costCenters')}
                            >
                                <SettingRow label={t('settings.fields.costCentersEnabled')}>
                                    <Switch
                                        checked={settings.costing.costCentersEnabled}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                costing: { ...prev.costing, costCentersEnabled: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.defaultCostCenter')}>
                                    <Input
                                        value={settings.costing.defaultCostCenter}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                costing: { ...prev.costing, defaultCostCenter: event.target.value }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.allocationRules')}
                                description={t('settings.descriptions.allocationRules')}
                            >
                                <SettingRow label={t('settings.fields.allocationMethod')}>
                                    <Select
                                        value={settings.costing.defaultAllocationMethod}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                costing: { ...prev.costing, defaultAllocationMethod: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="DIRECT">{t('settings.options.direct')}</option>
                                        <option value="STEP_DOWN">{t('settings.options.stepDown')}</option>
                                        <option value="RECIPROCAL">{t('settings.options.reciprocal')}</option>
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.allocationBasis')}>
                                    <Select
                                        value={settings.costing.allocationBasis}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                costing: { ...prev.costing, allocationBasis: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="SALES">{t('settings.options.sales')}</option>
                                        <option value="UNITS">{t('settings.options.units')}</option>
                                        <option value="LABOR_HOURS">{t('settings.options.laborHours')}</option>
                                    </Select>
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.costClassification')}
                                description={t('settings.descriptions.costClassification')}
                            >
                                <SettingRow label={t('settings.fields.classificationDefault')}>
                                    <Select
                                        value={settings.costing.costClassificationDefault}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                costing: { ...prev.costing, costClassificationDefault: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="DIRECT">{t('settings.options.directClassification')}</option>
                                        <option value="INDIRECT">{t('settings.options.indirect')}</option>
                                        <option value="OVERHEAD">{t('settings.options.overhead')}</option>
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.autoCalculateUnitCost')}>
                                    <Switch
                                        checked={settings.costing.autoCalculateUnitCost}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                costing: { ...prev.costing, autoCalculateUnitCost: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>
                        </>
                    )}

                    {activeTab === 'inventory' && (
                        <>
                            <SettingSection
                                title={t('settings.sections.inventoryCosting')}
                                description={t('settings.descriptions.inventoryCosting')}
                            >
                                <SettingRow label={t('settings.fields.costingMethod')}>
                                    <Select
                                        value={settings.inventory.valuationMethod}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, valuationMethod: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="FIFO">{t('settings.options.fifo')}</option>
                                        <option value="WAC">{t('settings.options.wac')}</option>
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.autoDeductStock')}>
                                    <Switch
                                        checked={settings.inventory.autoDeductStockOnSale}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, autoDeductStockOnSale: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.unitRules')}
                                description={t('settings.descriptions.unitRules')}
                            >
                                <SettingRow label={t('settings.fields.defaultUnit')}>
                                    <Input
                                        value={settings.inventory.defaultUnit}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, defaultUnit: event.target.value }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.quantityPrecision')}>
                                    <Input
                                        type="number"
                                        value={String(settings.inventory.quantityPrecision)}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, quantityPrecision: Number(event.target.value) }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.unitConversionPolicy')}>
                                    <Select
                                        value={settings.inventory.unitConversionPolicy}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, unitConversionPolicy: event.target.value }
                                            }))
                                        }
                                    >
                                        <option value="STRICT">{t('settings.options.strict')}</option>
                                        <option value="FLEXIBLE">{t('settings.options.flexible')}</option>
                                    </Select>
                                </SettingRow>
                                <SettingRow label={t('settings.fields.allowNegativeStock')}>
                                    <Switch
                                        checked={settings.inventory.allowNegativeStock}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, allowNegativeStock: checked }
                                            }))
                                        }
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
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                inventory: { ...prev.inventory, lowStockThresholdGlobal: Number(event.target.value) }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>
                        </>
                    )}

                    {activeTab === 'pos' && (
                        <>
                            <SettingSection
                                title={t('settings.sections.posOps')}
                                description={t('settings.descriptions.posOps')}
                            >
                                <SettingRow label={t('settings.fields.tablesEnabled')}>
                                    <Switch
                                        checked={settings.pos.tablesEnabled}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, tablesEnabled: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.serviceCharge')}>
                                    <Input
                                        type="number"
                                        value={String(settings.pos.serviceChargePercentage)}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, serviceChargePercentage: Number(event.target.value) }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.tipsEnabled')}>
                                    <Switch
                                        checked={settings.pos.tipsEnabled}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, tipsEnabled: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.discountRules')}
                                description={t('settings.descriptions.discountRules')}
                            >
                                <SettingRow label={t('settings.fields.allowDiscounts')}>
                                    <Switch
                                        checked={settings.pos.allowDiscounts}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, allowDiscounts: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.maxDiscount')}>
                                    <Input
                                        type="number"
                                        value={String(settings.pos.maxDiscountPercentage)}
                                        disabled={!settings.pos.allowDiscounts}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, maxDiscountPercentage: Number(event.target.value) }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.discountReasonRequired')}>
                                    <Switch
                                        checked={settings.pos.discountReasonRequired}
                                        disabled={!settings.pos.allowDiscounts}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, discountReasonRequired: checked }
                                            }))
                                        }
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
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, allowReturns: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.returnWindow')}>
                                    <Input
                                        type="number"
                                        value={String(settings.pos.returnWindowMinutes)}
                                        disabled={!settings.pos.allowReturns}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, returnWindowMinutes: Number(event.target.value) }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.returnReasonRequired')}>
                                    <Switch
                                        checked={settings.pos.returnReasonRequired}
                                        disabled={!settings.pos.allowReturns}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                pos: { ...prev.pos, returnReasonRequired: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.keyboardShortcuts', 'Keyboard Shortcuts')}
                                description={t('settings.descriptions.keyboardShortcuts', 'Configure hotkeys for fast POS operations')}
                            >
                                <div className="settings-grid">
                                    <SettingRow label={t('settings.fields.shortcutSave', 'Save Order')}>
                                        <Input
                                            value={settings.pos.shortcuts?.saveOrder || ''}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                pos: {
                                                    ...prev.pos,
                                                    shortcuts: { ...prev.pos.shortcuts, saveOrder: e.target.value }
                                                }
                                            }))}
                                            placeholder="e.g. F12"
                                        />
                                    </SettingRow>
                                    <SettingRow label={t('settings.fields.shortcutPrintReceipt', 'Print Receipt')}>
                                        <Input
                                            value={settings.pos.shortcuts?.printReceipt || ''}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                pos: {
                                                    ...prev.pos,
                                                    shortcuts: { ...prev.pos.shortcuts, printReceipt: e.target.value }
                                                }
                                            }))}
                                            placeholder="e.g. F10"
                                        />
                                    </SettingRow>
                                    <SettingRow label={t('settings.fields.shortcutPrintKOT', 'Print Kitchen')}>
                                        <Input
                                            value={settings.pos.shortcuts?.printKOT || ''}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                pos: {
                                                    ...prev.pos,
                                                    shortcuts: { ...prev.pos.shortcuts, printKOT: e.target.value }
                                                }
                                            }))}
                                            placeholder="e.g. F9"
                                        />
                                    </SettingRow>
                                    <SettingRow label={t('settings.fields.shortcutClearCart', 'Clear Cart')}>
                                        <Input
                                            value={settings.pos.shortcuts?.clearCart || ''}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                pos: {
                                                    ...prev.pos,
                                                    shortcuts: { ...prev.pos.shortcuts, clearCart: e.target.value }
                                                }
                                            }))}
                                            placeholder="e.g. F5"
                                        />
                                    </SettingRow>
                                </div>
                            </SettingSection>
                        </>
                    )}

                    {activeTab === 'printing' && (
                        <>
                            <SettingSection
                                title={t('settings.sections.printingDefaults')}
                                description={t('settings.descriptions.printingDefaults')}
                            >
                                <SettingRow label={t('settings.fields.receiptTemplate')}>
                                    <Input
                                        value={settings.printing.defaultReceiptTemplate}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                printing: { ...prev.printing, defaultReceiptTemplate: event.target.value }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.kitchenTemplate')}>
                                    <Input
                                        value={settings.printing.defaultKOTTemplate}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                printing: { ...prev.printing, defaultKOTTemplate: event.target.value }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.zReportTemplate')}>
                                    <Input
                                        value={settings.printing.defaultZReportTemplate}
                                        onChange={(event) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                printing: { ...prev.printing, defaultZReportTemplate: event.target.value }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.autoPrintReceipt')}>
                                    <Switch
                                        checked={settings.printing.autoPrintReceipt}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                printing: { ...prev.printing, autoPrintReceipt: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label={t('settings.fields.autoPrintKOT')}>
                                    <Switch
                                        checked={settings.printing.autoPrintKOT}
                                        onCheckedChange={(checked) =>
                                            setSettings(prev => ({
                                                ...prev,
                                                printing: { ...prev.printing, autoPrintKOT: checked }
                                            }))
                                        }
                                    />
                                </SettingRow>
                            </SettingSection>

                            <SettingSection
                                title={t('settings.sections.printingShortcuts')}
                                description={t('settings.descriptions.printingShortcuts')}
                            >
                                <div className="settings-shortcuts">
                                    <Button variant="secondary" onClick={() => navigate('/printers')}>
                                        {t('settings.shortcuts.printers')}
                                    </Button>
                                    <Button variant="secondary" onClick={() => navigate('/printers/routes')}>
                                        {t('settings.shortcuts.routes')}
                                    </Button>
                                    <Button variant="secondary" onClick={() => navigate('/printers/templates')}>
                                        {t('settings.shortcuts.templates')}
                                    </Button>
                                    <Button variant="secondary" onClick={() => navigate('/printers/jobs')}>
                                        {t('settings.shortcuts.jobs')}
                                    </Button>
                                </div>
                            </SettingSection>
                        </>
                    )}

                    {activeTab === 'theme' && (
                        <SettingSection title={t('settings.sections.theme')} description={t('settings.descriptions.theme')}>
                            <SettingRow label={t('settings.fields.themeMode')}>
                                <Select
                                    value={settings.theme.mode}
                                    onChange={(event) => {
                                        const mode = event.target.value;
                                        setTheme(mode as any);
                                        setSettings(prev => ({
                                            ...prev,
                                            theme: { ...prev.theme, mode }
                                        }));
                                    }}
                                >
                                    <option value="light">{t('settings.options.light')}</option>
                                    <option value="dark">{t('settings.options.dark')}</option>
                                </Select>
                            </SettingRow>
                            <SettingRow label={t('settings.fields.accentColor')} description={t('settings.fields.accentHint')}>
                                <div className="settings-color">
                                    <Input
                                        type="color"
                                        value={settings.theme.accentColor}
                                        onChange={(event) => {
                                            const color = event.target.value;
                                            setAccentColor(color);
                                            setSettings(prev => ({
                                                ...prev,
                                                theme: { ...prev.theme, accentColor: color }
                                            }));
                                        }}
                                    />
                                    <Input
                                        type="text"
                                        value={settings.theme.accentColor}
                                        onChange={(event) => {
                                            const color = event.target.value;
                                            setAccentColor(color);
                                            setSettings(prev => ({
                                                ...prev,
                                                theme: { ...prev.theme, accentColor: color }
                                            }));
                                        }}
                                    />
                                </div>
                            </SettingRow>
                            <SettingRow label={t('settings.fields.borderRadius')}>
                                <Input
                                    type="number"
                                    value={String(settings.theme.borderRadius)}
                                    onChange={(event) =>
                                        setSettings(prev => ({
                                            ...prev,
                                            theme: { ...prev.theme, borderRadius: Number(event.target.value) }
                                        }))
                                    }
                                />
                            </SettingRow>
                        </SettingSection>
                    )}
                </>
            )}
        </div>
    );
};

export default SettingsPage;
