import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, PageHeader, Select, StatusBadge, Switch, Table, useToast, Column } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { Printer } from '../types/printing';
import { PrinterService } from '../services/printer.service';
import { ElectronPrinter, PrinterConfig } from '../types/window';
import '../styles/PrintersPage.css';

const TYPE_OPTIONS = ['NETWORK', 'USB', 'WINDOWS', 'PDF'];
const TARGET_OPTIONS = ['CASHIER', 'KITCHEN', 'BAR', 'LABEL'];

const PrintersPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t } = useTranslation();
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Electron System Printers State
    const [systemPrinters, setSystemPrinters] = useState<ElectronPrinter[]>([]);
    const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({ receiptPrinter: null, kitchenPrinter: null });
    const [isElectron] = useState(PrinterService.isAvailable());

    const [form, setForm] = useState<Printer>({
        id: 0,
        name: '',
        branch_id: null,
        type: 'NETWORK',
        target: 'KITCHEN',
        ip_address: '',
        port: 9100,
        is_active: 1,
        display_name: '',
        windows_printer_name: '',
        device_id: '',
        paper_width: 80
    });

    const typeLabels = useMemo(() => ({
        NETWORK: t('settings.printing.printers.types.network'),
        USB: t('settings.printing.printers.types.usb'),
        WINDOWS: t('settings.printing.printers.types.windows'),
        PDF: t('settings.printing.printers.types.pdf')
    }), [t]);

    const targetLabels = useMemo(() => ({
        CASHIER: t('settings.printing.printers.targets.cashier'),
        KITCHEN: t('settings.printing.printers.targets.kitchen'),
        BAR: t('settings.printing.printers.targets.bar'),
        LABEL: t('settings.printing.printers.targets.label')
    }), [t]);

    const typeOptions = useMemo(() => (
        TYPE_OPTIONS.map((value) => ({ value, label: typeLabels[value as keyof typeof typeLabels] || value }))
    ), [typeLabels]);

    const targetOptions = useMemo(() => (
        TARGET_OPTIONS.map((value) => ({ value, label: targetLabels[value as keyof typeof targetLabels] || value }))
    ), [targetLabels]);

    const loadPrinters = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api<{ items: Printer[] }>('/printing/printers');
            setPrinters(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.printers.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, t]);

    const loadBranches = useCallback(async () => {
        try {
            const data = await api<{ items: Branch[] }>('/branches');
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, [api]);

    const loadSystemPrinters = useCallback(async () => {
        if (!isElectron) return;
        const list = await PrinterService.getPrinters();
        setSystemPrinters(list);
        const config = await PrinterService.getConfig();
        setPrinterConfig(config);
    }, [isElectron]);

    useEffect(() => {
        loadPrinters();
        loadBranches();
        loadSystemPrinters();
    }, [loadBranches, loadPrinters, loadSystemPrinters]);

    const handleSaveSystemConfig = async () => {
        const success = await PrinterService.saveConfig(printerConfig);
        if (success) {
            toast.success('Printer configuration saved');
        } else {
            toast.error('Failed to save printer configuration');
        }
    };

    const handleTestPrint = async (printerName: string) => {
        await PrinterService.printTest(printerName);
        toast.success(`Test print sent to ${printerName}`);
    };

    const openCreate = () => {
        setForm({
            id: 0,
            name: '',
            branch_id: null,
            type: 'NETWORK',
            target: 'KITCHEN',
            ip_address: '',
            port: 9100,
            is_active: 1
        });
        setIsModalOpen(true);
    };

    const openEdit = (printer: Printer) => {
        setForm({
            ...printer,
            port: printer.port ?? 9100,
            is_active: typeof printer.is_active === 'boolean' ? (printer.is_active ? 1 : 0) : (printer.is_active ?? 1)
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error(t('errors.printers.nameRequired'));
            return;
        }
        try {
            if (form.id) {
                await api(`/printing/printers/${form.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(form)
                });
                toast.success(t('toast.printers.updated'));
            } else {
                await api('/printing/printers', {
                    method: 'POST',
                    body: JSON.stringify(form)
                });
                toast.success(t('toast.printers.created'));
            }
            setIsModalOpen(false);
            loadPrinters();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printers.saveFailed'));
        }
    };

    const handleDisable = async (printer: Printer) => {
        if (!window.confirm(t('settings.printing.printers.confirmDisable', { name: printer.name }))) return;
        try {
            await api(`/printing/printers/${printer.id}`, { method: 'DELETE' });
            toast.success(t('toast.printers.disabled'));
            loadPrinters();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printers.disableFailed'));
        }
    };

    const summary = useMemo(() => {
        const online = printers.filter((p) => (p.is_active ?? 1) === 1).length;
        const kitchens = printers.filter((p) => p.target === 'KITCHEN').length;
        return { online, kitchens };
    }, [printers]);

    const columns: Column<Printer>[] = useMemo(
        () => [
            {
                header: t('settings.printing.printers.table.printer'),
                accessorKey: 'name',
                cell: (row: Printer) => (
                    <div className="printers-page__name">
                        <div className="printers-page__title">{row.name}</div>
                        <div className="printers-page__meta">{row.branch_name || t('common.allBranches')}</div>
                    </div>
                )
            },
            {
                header: t('settings.printing.printers.table.target'),
                accessorKey: 'target',
                cell: (row: Printer) => targetLabels[row.target as keyof typeof targetLabels] || row.target
            },
            {
                header: t('settings.printing.printers.table.type'),
                accessorKey: 'type',
                cell: (row: Printer) => typeLabels[row.type as keyof typeof typeLabels] || row.type
            },
            {
                header: t('settings.printing.printers.table.address'),
                accessorKey: 'ip_address',
                cell: (row: Printer) => row.ip_address ? `${row.ip_address}:${row.port || 9100}` : t('common.placeholder')
            },
            {
                header: t('settings.printing.printers.table.status'),
                accessorKey: 'is_active',
                cell: (row: Printer) => (
                    <StatusBadge variant={(row.is_active ?? 1) === 1 ? 'success' : 'warning'} size="sm">
                        {(row.is_active ?? 1) === 1 ? t('common.enabled') : t('common.disabled')}
                    </StatusBadge>
                )
            },
            {
                header: t('common.actions'),
                accessorKey: 'id',
                cell: (row: Printer) => (
                    <div className="printers-page__actions">
                        <PermissionGate
                            perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                            tooltip={t('errors.printers.manageDenied')}
                        >
                            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                {t('common.edit')}
                            </Button>
                        </PermissionGate>
                        <PermissionGate
                            perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                            tooltip={t('errors.printers.manageDenied')}
                        >
                            <Button variant="danger" size="sm" onClick={() => handleDisable(row)}>
                                {t('common.disable')}
                            </Button>
                        </PermissionGate>
                    </div>
                )
            }
        ],
        [t, targetLabels, typeLabels]
    );

    return (
        <div className="printers-page">
            <PageHeader
                title={t('settings.printing.printers.title')}
                subtitle={t('settings.printing.printers.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                        tooltip={t('errors.printers.manageDenied')}
                    >
                        <Button variant="primary" onClick={openCreate}>
                            {t('settings.printing.printers.actions.add')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="printers-page__error">{error}</div>}

            {/* Electron Device Printers Section */}
            {isElectron && (
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>System Printers (Device)</CardTitle>
                            <Button variant="secondary" size="sm" onClick={loadSystemPrinters}> Refresh List</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h3 className="text-sm font-medium mb-2">Sales Printer (Receipts)</h3>
                                <Select
                                    value={printerConfig.receiptPrinter || ''}
                                    onChange={(e) => setPrinterConfig(prev => ({ ...prev, receiptPrinter: e.target.value || null }))}
                                >
                                    <option value="">Select Printer</option>
                                    {systemPrinters.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </Select>
                                {printerConfig.receiptPrinter && (
                                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => handleTestPrint(printerConfig.receiptPrinter!)}>
                                        Test Print
                                    </Button>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-2">Kitchen Printer (Order Tickets)</h3>
                                <Select
                                    value={printerConfig.kitchenPrinter || ''}
                                    onChange={(e) => setPrinterConfig(prev => ({ ...prev, kitchenPrinter: e.target.value || null }))}
                                >
                                    <option value="">Select Printer</option>
                                    {systemPrinters.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </Select>
                                {printerConfig.kitchenPrinter && (
                                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => handleTestPrint(printerConfig.kitchenPrinter!)}>
                                        Test Print
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Button onClick={handleSaveSystemConfig}>Save Configuration</Button>

                        <h3 className="text-sm font-medium mt-6 mb-2">Detected System Printers</h3>
                        <div className="border rounded-md">
                            <Table
                                data={systemPrinters}
                                columns={[
                                    { header: 'Name', accessorKey: 'name', cell: (p: any) => p.name },
                                    { header: 'Status', accessorKey: 'status', cell: (p: any) => p.status === 0 ? 'Ready' : 'Other' },
                                    { header: 'Default', accessorKey: 'isDefault', cell: (p: any) => p.isDefault ? 'Yes' : 'No' },
                                    { header: 'Action', accessorKey: 'name', cell: (p: any) => <Button variant="ghost" size="sm" onClick={() => handleTestPrint(p.name)}>Test</Button> }
                                ]}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {isLoading && <div className="printers-page__loading">{t('settings.printing.printers.loading')}</div>}

            {/* Existing Layout for Network Printers */}
            <div className="printers-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings.printing.printers.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="printers-page__summary-grid">
                            <div>
                                <div className="printers-page__summary-label">{t('settings.printing.printers.summary.enabled')}</div>
                                <div className="printers-page__summary-value">{summary.online}</div>
                            </div>
                            <div>
                                <div className="printers-page__summary-label">{t('settings.printing.printers.summary.kitchen')}</div>
                                <div className="printers-page__summary-value">{summary.kitchens}</div>
                            </div>
                            <div>
                                <div className="printers-page__summary-label">{t('common.total')}</div>
                                <div className="printers-page__summary-value">{printers.length}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.printing.printers.table.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={printers} columns={columns} isLoading={isLoading} />
                    {!isLoading && printers.length === 0 && (
                        <div className="printers-page__empty">{t('settings.printing.printers.empty')}</div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={form.id ? t('settings.printing.printers.modal.editTitle') : t('settings.printing.printers.modal.addTitle')}
                footer={(
                    <div className="printers-page__modal-actions">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSave}>
                            {form.id ? t('common.saveChanges') : t('settings.printing.printers.actions.create')}
                        </Button>
                    </div>
                )}
            >
                <div className="printers-page__modal">
                    <Input
                        label={t('settings.printing.printers.form.name')}
                        value={form.name}
                        onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
                    />
                    <Select
                        label={t('common.branch')}
                        value={form.branch_id ? String(form.branch_id) : ''}
                        onChange={(event) => setForm(prev => ({ ...prev, branch_id: event.target.value ? Number(event.target.value) : null }))}
                    >
                        <option value="">{t('common.allBranches')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </Select>
                    <Select
                        label={t('settings.printing.printers.form.type')}
                        value={form.type}
                        onChange={(event) => setForm(prev => ({ ...prev, type: event.target.value }))}
                    >
                        {typeOptions.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </Select>
                    <Select
                        label={t('settings.printing.printers.form.target')}
                        value={form.target}
                        onChange={(event) => setForm(prev => ({ ...prev, target: event.target.value }))}
                    >
                        {targetOptions.map((target) => (
                            <option key={target.value} value={target.value}>{target.label}</option>
                        ))}
                    </Select>

                    {/* USB/WINDOWS specific fields */}
                    {(form.type === 'USB' || form.type === 'WINDOWS') && (
                        <div className="printers-page__usb-fields">
                            {isElectron ? (
                                <Select
                                    label="Windows Printer Name"
                                    value={form.windows_printer_name || ''}
                                    onChange={(event) => setForm(prev => ({
                                        ...prev,
                                        windows_printer_name: event.target.value || '',
                                        name: prev.name || event.target.value || ''
                                    }))}
                                >
                                    <option value="">Select Windows Printer</option>
                                    {systemPrinters.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </Select>
                            ) : (
                                <Input
                                    label="Windows Printer Name"
                                    value={form.windows_printer_name || ''}
                                    onChange={(event) => setForm(prev => ({ ...prev, windows_printer_name: event.target.value }))}
                                    placeholder="e.g. POS-80"
                                />
                            )}
                            <Input
                                label="Device ID (Workstation Key)"
                                value={form.device_id || ''}
                                onChange={(event) => setForm(prev => ({ ...prev, device_id: event.target.value }))}
                                placeholder="e.g. CASHIER-PC-01"
                            />
                            {isElectron && !form.device_id && (
                                <Button variant="ghost" size="sm" onClick={async () => {
                                    const info = await PrinterService.getDeviceInfo();
                                    if (info?.deviceKey) {
                                        setForm(prev => ({ ...prev, device_id: info.deviceKey }));
                                    }
                                }}>
                                    Auto-fill Device ID
                                </Button>
                            )}
                            <Input
                                label="Paper Width (mm)"
                                type="number"
                                value={String(form.paper_width ?? 80)}
                                onChange={(event) => setForm(prev => ({ ...prev, paper_width: Number(event.target.value) || 80 }))}
                            />
                            {!isElectron && (
                                <div className="printers-page__usb-notice">
                                    إعداد طابعات USB يحتاج تشغيل نسخة سطح المكتب.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Network fields - show only for NETWORK type */}
                    {(form.type === 'NETWORK') && (
                        <>
                            <Input
                                label={t('settings.printing.printers.form.ipAddress')}
                                placeholder="192.168.1.10"
                                value={form.ip_address || ''}
                                onChange={(event) => setForm(prev => ({ ...prev, ip_address: event.target.value }))}
                            />
                            <Input
                                label={t('settings.printing.printers.form.port')}
                                type="number"
                                value={String(form.port ?? 9100)}
                                onChange={(event) => setForm(prev => ({ ...prev, port: Number(event.target.value) }))}
                            />
                        </>
                    )}

                    <div className="printers-page__switch">
                        <div>
                            <div className="printers-page__switch-title">{t('common.enabled')}</div>
                            <div className="printers-page__switch-subtitle">{t('settings.printing.printers.form.enabledHint')}</div>
                        </div>
                        <Switch
                            checked={(form.is_active ?? 1) === 1}
                            onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked ? 1 : 0 }))}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PrintersPage;
