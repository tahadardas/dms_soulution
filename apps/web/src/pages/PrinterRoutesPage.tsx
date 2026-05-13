import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Modal, PageHeader, Select, StatusBadge, Switch, Table, useToast, Column } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { Printer, PrinterRoute, PrintTemplate } from '../types/printing';
import '../styles/PrinterRoutesPage.css';

const JOB_TYPES = ['KOT', 'RECEIPT', 'REPORT'];
const STATIONS = ['KITCHEN', 'BAR', 'CASHIER'];

const PrinterRoutesPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t } = useTranslation();
    const [routes, setRoutes] = useState<PrinterRoute[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [templates, setTemplates] = useState<PrintTemplate[]>([]);
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<PrinterRoute>({
        id: 0,
        scope_type: 'DEFAULT',
        scope_value: '',
        job_type: 'KOT',
        branch_id: null,
        printer_id: 0,
        template_id: null,
        is_active: 1
    });

    const scopeOptions = useMemo(() => ([
        { value: 'DEFAULT', label: t('settings.printing.routes.scopes.default') },
        { value: 'CATEGORY', label: t('settings.printing.routes.scopes.category') },
        { value: 'STATION', label: t('settings.printing.routes.scopes.station') },
        { value: 'REPORT', label: t('settings.printing.routes.scopes.report') }
    ]), [t]);

    const jobTypeLabels = useMemo(() => ({
        KOT: t('settings.printing.routes.jobTypes.kot'),
        RECEIPT: t('settings.printing.routes.jobTypes.receipt'),
        REPORT: t('settings.printing.routes.jobTypes.report')
    }), [t]);

    const stationLabels = useMemo(() => ({
        KITCHEN: t('settings.printing.routes.stations.kitchen'),
        BAR: t('settings.printing.routes.stations.bar'),
        CASHIER: t('settings.printing.routes.stations.cashier')
    }), [t]);

    const reportOptions = useMemo(() => ([
        { value: 'Z_REPORT', label: t('settings.printing.routes.reports.zReport') }
    ]), [t]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [routesData, printersData, templatesData] = await Promise.all([
                api<{ items: PrinterRoute[] }>('/printing/routes'),
                api<{ items: Printer[] }>('/printing/printers'),
                api<{ items: PrintTemplate[] }>('/printing/templates')
            ]);
            setRoutes(routesData.items || []);
            setPrinters(printersData.items || []);
            setTemplates(templatesData.items || []);
            try {
                const categoriesData = await api<{ items: Array<{ id: number; name: string }> }>('/inventory/categories');
                setCategories(categoriesData.items || []);
            } catch {
                setCategories([]);
            }
            try {
                const branchesData = await api<{ items: Branch[] }>('/branches');
                setBranches(branchesData.items || []);
            } catch {
                setBranches([]);
            }
        } catch (err: any) {
            setError(err?.message || t('errors.printerRoutes.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openCreate = () => {
        setForm({
            id: 0,
            scope_type: 'DEFAULT',
            scope_value: '',
            job_type: 'KOT',
            branch_id: null,
            printer_id: printers[0]?.id || 0,
            template_id: null,
            is_active: 1
        });
        setIsModalOpen(true);
    };

    const openEdit = (route: PrinterRoute) => {
        setForm({
            ...route,
            scope_value: route.scope_value || '',
            template_id: route.template_id ?? null,
            is_active: typeof route.is_active === 'boolean' ? (route.is_active ? 1 : 0) : (route.is_active ?? 1)
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.printer_id) {
            toast.error(t('errors.printerRoutes.selectPrinter'));
            return;
        }
        if (form.scope_type === 'CATEGORY' && !form.scope_value) {
            toast.error(t('errors.printerRoutes.selectCategory'));
            return;
        }
        if (form.scope_type === 'STATION' && !form.scope_value) {
            toast.error(t('errors.printerRoutes.selectStation'));
            return;
        }
        if (form.scope_type === 'REPORT' && !form.scope_value) {
            toast.error(t('errors.printerRoutes.selectReport'));
            return;
        }
        try {
            if (form.id) {
                await api(`/printing/routes/${form.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(form)
                });
                toast.success(t('toast.printerRoutes.updated'));
            } else {
                await api('/printing/routes', {
                    method: 'POST',
                    body: JSON.stringify(form)
                });
                toast.success(t('toast.printerRoutes.created'));
            }
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printerRoutes.saveFailed'));
        }
    };

    const handleDelete = async (route: PrinterRoute) => {
        if (!window.confirm(t('settings.printing.routes.confirmDelete'))) return;
        try {
            await api(`/printing/routes/${route.id}`, { method: 'DELETE' });
            toast.success(t('toast.printerRoutes.deleted'));
            loadData();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printerRoutes.deleteFailed'));
        }
    };

    const availableTemplates = useMemo(() => {
        const type = form.job_type === 'REPORT' ? 'Z_REPORT' : form.job_type;
        return templates.filter(template => template.type === type);
    }, [form.job_type, templates]);

    useEffect(() => {
        if (!form.template_id) return;
        const exists = availableTemplates.some(template => template.id === form.template_id);
        if (!exists) {
            setForm(prev => ({ ...prev, template_id: null }));
        }
    }, [availableTemplates, form.template_id]);

    const scopeLabel = (route: PrinterRoute) => {
        if (route.scope_type === 'DEFAULT') return t('settings.printing.routes.scopes.default');
        if (route.scope_type === 'CATEGORY') {
            const category = categories.find(cat => String(cat.id) === String(route.scope_value));
            return category
                ? t('settings.printing.routes.scopeLabels.category', { name: category.name })
                : t('settings.printing.routes.scopeLabels.categoryFallback', { id: route.scope_value });
        }
        if (route.scope_type === 'STATION') return t('settings.printing.routes.scopeLabels.station', { station: route.scope_value });
        if (route.scope_type === 'REPORT') return t('settings.printing.routes.scopeLabels.report', { report: route.scope_value });
        return route.scope_type;
    };

    const columns: Column<PrinterRoute>[] = useMemo(
        () => [
            {
                header: t('settings.printing.routes.table.jobType'),
                accessorKey: 'job_type',
                cell: (row: PrinterRoute) => jobTypeLabels[row.job_type as keyof typeof jobTypeLabels] || row.job_type
            },
            {
                header: t('settings.printing.routes.table.scope'),
                accessorKey: 'scope_type',
                cell: (row: PrinterRoute) => scopeLabel(row)
            },
            {
                header: t('settings.printing.routes.table.printer'),
                accessorKey: 'printer_id',
                cell: (row: PrinterRoute) => row.printer_name || `#${row.printer_id}`
            },
            {
                header: t('settings.printing.routes.table.template'),
                accessorKey: 'template_id',
                cell: (row: PrinterRoute) => row.template_name || t('common.default')
            },
            {
                header: t('settings.printing.routes.table.status'),
                accessorKey: 'is_active',
                cell: (row: PrinterRoute) => (
                    <StatusBadge variant={(row.is_active ?? 1) === 1 ? 'success' : 'warning'} size="sm">
                        {(row.is_active ?? 1) === 1 ? t('common.active') : t('common.disabled')}
                    </StatusBadge>
                )
            },
            {
                header: t('common.actions'),
                accessorKey: 'id',
                cell: (row: PrinterRoute) => (
                    <div className="printer-routes-page__actions">
                        <PermissionGate
                            perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                            tooltip={t('errors.printerRoutes.manageDenied')}
                        >
                            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>{t('common.edit')}</Button>
                        </PermissionGate>
                        <PermissionGate
                            perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                            tooltip={t('errors.printerRoutes.manageDenied')}
                        >
                            <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>{t('common.delete')}</Button>
                        </PermissionGate>
                    </div>
                )
            }
        ],
        [categories, jobTypeLabels, scopeLabel, t]
    );

    return (
        <div className="printer-routes-page">
            <PageHeader
                title={t('settings.printing.routes.title')}
                subtitle={t('settings.printing.routes.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                        tooltip={t('errors.printerRoutes.manageDenied')}
                    >
                        <Button variant="primary" onClick={openCreate}>
                            {t('settings.printing.routes.actions.add')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="printer-routes-page__error">{error}</div>}
            {isLoading && <div className="printer-routes-page__loading">{t('settings.printing.routes.loading')}</div>}

            <div className="printer-routes-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings.printing.routes.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="printer-routes-page__summary-grid">
                            <div>
                                <div className="printer-routes-page__summary-label">{t('settings.printing.routes.summary.routes')}</div>
                                <div className="printer-routes-page__summary-value">{routes.length}</div>
                            </div>
                            <div>
                                <div className="printer-routes-page__summary-label">{t('settings.printing.routes.summary.active')}</div>
                                <div className="printer-routes-page__summary-value">{routes.filter(route => (route.is_active ?? 1) === 1).length}</div>
                            </div>
                            <div>
                                <div className="printer-routes-page__summary-label">{t('settings.printing.routes.summary.printers')}</div>
                                <div className="printer-routes-page__summary-value">{printers.length}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.printing.routes.table.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={routes} columns={columns} isLoading={isLoading} />
                    {!isLoading && routes.length === 0 && (
                        <div className="printer-routes-page__empty">{t('settings.printing.routes.empty')}</div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={form.id ? t('settings.printing.routes.modal.editTitle') : t('settings.printing.routes.modal.addTitle')}
                footer={(
                    <div className="printer-routes-page__modal-actions">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSave}>
                            {form.id ? t('common.saveChanges') : t('settings.printing.routes.actions.create')}
                        </Button>
                    </div>
                )}
            >
                <div className="printer-routes-page__modal">
                    <Select
                        label={t('settings.printing.routes.form.jobType')}
                        value={form.job_type}
                        onChange={(event) => setForm(prev => ({ ...prev, job_type: event.target.value }))}
                    >
                        {JOB_TYPES.map((job) => (
                            <option key={job} value={job}>{jobTypeLabels[job as keyof typeof jobTypeLabels] || job}</option>
                        ))}
                    </Select>
                    <Select
                        label={t('settings.printing.routes.form.scopeType')}
                        value={form.scope_type}
                        onChange={(event) => setForm(prev => ({ ...prev, scope_type: event.target.value, scope_value: '' }))}
                    >
                        {scopeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Select>
                    {form.scope_type === 'CATEGORY' && (
                        <Select
                            label={t('settings.printing.routes.form.category')}
                            value={form.scope_value || ''}
                            onChange={(event) => setForm(prev => ({ ...prev, scope_value: event.target.value }))}
                        >
                            <option value="">{t('settings.printing.routes.form.categoryPlaceholder')}</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </Select>
                    )}
                    {form.scope_type === 'STATION' && (
                        <Select
                            label={t('settings.printing.routes.form.station')}
                            value={form.scope_value || ''}
                            onChange={(event) => setForm(prev => ({ ...prev, scope_value: event.target.value }))}
                        >
                            <option value="">{t('settings.printing.routes.form.stationPlaceholder')}</option>
                            {STATIONS.map((station) => (
                                <option key={station} value={station}>{stationLabels[station as keyof typeof stationLabels] || station}</option>
                            ))}
                        </Select>
                    )}
                    {form.scope_type === 'REPORT' && (
                        <Select
                            label={t('settings.printing.routes.form.report')}
                            value={form.scope_value || ''}
                            onChange={(event) => setForm(prev => ({ ...prev, scope_value: event.target.value }))}
                        >
                            <option value="">{t('settings.printing.routes.form.reportPlaceholder')}</option>
                            {reportOptions.map((report) => (
                                <option key={report.value} value={report.value}>{report.label}</option>
                            ))}
                        </Select>
                    )}
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
                        label={t('settings.printing.routes.form.printer')}
                        value={form.printer_id ? String(form.printer_id) : ''}
                        onChange={(event) => setForm(prev => ({ ...prev, printer_id: Number(event.target.value) }))}
                    >
                        <option value="">{t('settings.printing.routes.form.printerPlaceholder')}</option>
                        {printers.map((printer) => (
                            <option key={printer.id} value={printer.id}>
                                {printer.name} ({printer.target})
                            </option>
                        ))}
                    </Select>
                    <Select
                        label={t('settings.printing.routes.form.template')}
                        value={form.template_id ? String(form.template_id) : ''}
                        onChange={(event) => setForm(prev => ({ ...prev, template_id: event.target.value ? Number(event.target.value) : null }))}
                    >
                        <option value="">{t('settings.printing.routes.form.templateDefault')}</option>
                        {availableTemplates.map((template) => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                    </Select>
                    <div className="printer-routes-page__switch">
                        <div>
                            <div className="printer-routes-page__switch-title">{t('common.active')}</div>
                            <div className="printer-routes-page__switch-subtitle">{t('settings.printing.routes.form.activeHint')}</div>
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

export default PrinterRoutesPage;
