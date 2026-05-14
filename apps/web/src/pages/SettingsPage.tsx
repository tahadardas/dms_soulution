import React, { useEffect, useState } from 'react';
import { 
    Button, LoadingState, Tabs, useTheme, useToast, 
    StandardPage 
} from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';
import { Account } from '../types/accounting';

// Sub-components
import { AccountingSettings } from './settings-components/AccountingSettings';
import { InventorySettings } from './settings-components/InventorySettings';
import { POSSettings } from './settings-components/POSSettings';

import '../styles/SettingsPage.css';

type SettingsCategory = 'accounting' | 'costing' | 'inventory' | 'pos' | 'printing' | 'theme';

const DEFAULT_SETTINGS = {
    accounting: {
        chartOfAccountsMapping: { posCash: '', posBank: '', revenue: '', discounts: '', taxPayable: '', inventory: '', cogs: '' },
        currencyCode: 'USD',
        postingPolicy: 'IMMEDIATE',
        fiscalYearStartMonth: 1,
        fiscalYearStartDay: 1,
        fiscalPeriodType: 'MONTHLY',
        allowManualJournalEntries: true
    },
    costing: { defaultAllocationMethod: 'DIRECT', allocationBasis: 'SALES', costCentersEnabled: false, defaultCostCenter: 'GENERAL', costClassificationDefault: 'DIRECT', autoCalculateUnitCost: true },
    inventory: { valuationMethod: 'WAC', defaultUnit: 'Unit', lowStockThresholdGlobal: 10, autoDeductStockOnSale: true, allowNegativeStock: false, quantityPrecision: 2, unitConversionPolicy: 'STRICT' },
    pos: { tablesEnabled: true, serviceChargePercentage: 0, allowDiscounts: true, maxDiscountPercentage: 100, discountReasonRequired: false, tipsEnabled: true, allowReturns: true, returnWindowMinutes: 1440, returnReasonRequired: true },
    printing: { defaultReceiptTemplate: 'standard', defaultKOTTemplate: 'kitchen-basic', defaultZReportTemplate: 'z-report', autoPrintReceipt: true, autoPrintKOT: true },
    theme: { mode: 'light', accentColor: '#3b82f6', borderRadius: 8 }
};

export const SettingsPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { setTheme } = useTheme();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsCategory>('accounting');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const [data, accountsData] = await Promise.all([
                    api<any>('/settings'),
                    api<{ items: Account[] }>('/accounting/accounts')
                ]);
                
                setSettings(prev => ({
                    ...prev,
                    ...data,
                    accounting: { ...prev.accounting, ...data.accounting },
                    pos: { ...prev.pos, ...data.pos },
                    inventory: { ...prev.inventory, ...data.inventory }
                }));
                
                setAccounts(accountsData.items || []);
                if (data.theme?.mode) setTheme(data.theme.mode as any);
            } catch (err) {
                console.error('Failed to load settings', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, [api, setTheme]);

    const saveCategory = async () => {
        setIsSaving(true);
        try {
            await api(`/settings/${activeTab}`, {
                method: 'PUT',
                body: JSON.stringify(settings[activeTab])
            });
            toast.success(t('toast.settings.saved'));
        } catch (err: any) {
            toast.error(err.message || t('errors.settings.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'accounting', label: t('settings.tabs.accounting') },
        { id: 'inventory', label: t('settings.tabs.inventory') },
        { id: 'pos', label: t('settings.tabs.pos') },
        { id: 'theme', label: t('settings.tabs.theme') }
    ];

    if (isLoading) return <LoadingState />;

    return (
        <StandardPage
            title={t('settings.title')}
            subtitle={t('settings.subtitle')}
            actions={
                <PermissionGate perm={PERMISSIONS.SET_MANAGE_SETTINGS}>
                    <Button variant="primary" isLoading={isSaving} onClick={saveCategory}>
                        {t('common.saveChanges')}
                    </Button>
                </PermissionGate>
            }
        >
            <Tabs 
                tabs={tabs} 
                defaultTab="accounting" 
                onTabChange={(tab) => setActiveTab(tab as SettingsCategory)} 
                className="mb-6"
            />

            <div className="settings-content max-w-4xl">
                {activeTab === 'accounting' && (
                    <AccountingSettings settings={settings} setSettings={setSettings} accounts={accounts} />
                )}
                {activeTab === 'inventory' && (
                    <InventorySettings settings={settings} setSettings={setSettings} />
                )}
                {activeTab === 'pos' && (
                    <POSSettings settings={settings} setSettings={setSettings} />
                )}
            </div>
        </StandardPage>
    );
};

export default SettingsPage;
