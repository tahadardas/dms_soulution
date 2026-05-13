import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, PageHeader, Select, StatusBadge, Switch, Table, useToast, Column } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { useTranslation } from 'react-i18next';
import { PrintTemplate } from '../types/printing';
import '../styles/PrinterTemplatesPage.css';

const TEMPLATE_TYPES = ['KOT', 'RECEIPT', 'Z_REPORT'];

const SAMPLE_PAYLOADS: Record<string, Record<string, any>> = {
    KOT: {
        order_number: 'ORD-123456',
        created_at: '2026-01-29 19:45',
        table_number: 'T5',
        branch_name: 'Main Branch',
        items: '- 2 x Burger\n- 1 x Fries',
        notes: '- No onions\n- Extra spicy'
    },
    RECEIPT: {
        order_number: 'ORD-123456',
        created_at: '2026-01-29 19:45',
        table_number: 'T5',
        items: '- 2 x Burger\n- 1 x Fries',
        total: '18.50'
    },
    Z_REPORT: {
        session_id: 'SESSION-123',
        start_time: '2026-01-29 08:00',
        end_time: '2026-01-29 23:00',
        orders_count: '42',
        total_sales: '482.75',
        closing_cash: '220.00',
        branch_name: 'Main Branch',
        cashier: 'admin'
    }
};

const renderTemplate = (template: string, payload: Record<string, any>) => {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
        const value = key.split('.').reduce((acc: any, part: string) => acc?.[part], payload);
        if (value === undefined || value === null) return '';
        return String(value);
    });
};

const PrinterTemplatesPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t } = useTranslation();
    const [templates, setTemplates] = useState<PrintTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<PrintTemplate>({
        id: 0,
        name: '',
        type: 'KOT',
        content: '',
        is_default: 0,
        is_active: 1
    });

    const templateTypeLabels = useMemo(() => ({
        KOT: t('settings.printing.templates.types.kot'),
        RECEIPT: t('settings.printing.templates.types.receipt'),
        Z_REPORT: t('settings.printing.templates.types.zReport')
    }), [t]);

    const loadTemplates = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api<{ items: PrintTemplate[] }>('/printing/templates');
            setTemplates(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.printTemplates.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, t]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const openCreate = () => {
        setForm({
            id: 0,
            name: '',
            type: 'KOT',
            content: '',
            is_default: 0,
            is_active: 1
        });
        setIsModalOpen(true);
    };

    const openEdit = (template: PrintTemplate) => {
        setForm({
            ...template,
            is_default: typeof template.is_default === 'boolean' ? (template.is_default ? 1 : 0) : (template.is_default ?? 0),
            is_active: typeof template.is_active === 'boolean' ? (template.is_active ? 1 : 0) : (template.is_active ?? 1)
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error(t('errors.printTemplates.nameRequired'));
            return;
        }
        if (!form.content.trim()) {
            toast.error(t('errors.printTemplates.contentRequired'));
            return;
        }
        try {
            if (form.id) {
                await api(`/printing/templates/${form.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(form)
                });
                toast.success(t('toast.printTemplates.updated'));
            } else {
                await api('/printing/templates', {
                    method: 'POST',
                    body: JSON.stringify(form)
                });
                toast.success(t('toast.printTemplates.created'));
            }
            setIsModalOpen(false);
            loadTemplates();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printTemplates.saveFailed'));
        }
    };

    const handleDelete = async (template: PrintTemplate) => {
        if (!window.confirm(t('settings.printing.templates.confirmDisable', { name: template.name }))) return;
        try {
            await api(`/printing/templates/${template.id}`, { method: 'DELETE' });
            toast.success(t('toast.printTemplates.disabled'));
            loadTemplates();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printTemplates.disableFailed'));
        }
    };

    const preview = useMemo(() => {
        const payload = SAMPLE_PAYLOADS[form.type] || {};
        return renderTemplate(form.content || '', payload);
    }, [form.content, form.type]);

    const columns: Column<PrintTemplate>[] = useMemo(
        () => [
            {
                header: t('settings.printing.templates.table.template'),
                accessorKey: 'name',
                cell: (row: PrintTemplate) => (
                    <div className="printer-templates-page__name">
                        <div className="printer-templates-page__title">{row.name}</div>
                        <div className="printer-templates-page__meta">{templateTypeLabels[row.type as keyof typeof templateTypeLabels] || row.type}</div>
                    </div>
                )
            },
            {
                header: t('settings.printing.templates.table.type'),
                accessorKey: 'type',
                cell: (row: PrintTemplate) => templateTypeLabels[row.type as keyof typeof templateTypeLabels] || row.type
            },
            {
                header: t('settings.printing.templates.table.default'),
                accessorKey: 'is_default',
                cell: (row: PrintTemplate) => (
                    <StatusBadge variant={(row.is_default ?? 0) === 1 ? 'success' : 'neutral'} size="sm">
                        {(row.is_default ?? 0) === 1 ? t('common.default') : t('common.optional')}
                    </StatusBadge>
                )
            },
            {
                header: t('settings.printing.templates.table.status'),
                accessorKey: 'is_active',
                cell: (row: PrintTemplate) => (
                    <StatusBadge variant={(row.is_active ?? 1) === 1 ? 'success' : 'warning'} size="sm">
                        {(row.is_active ?? 1) === 1 ? t('common.active') : t('common.disabled')}
                    </StatusBadge>
                )
            },
            {
                header: t('common.actions'),
                accessorKey: 'id',
                cell: (row: PrintTemplate) => (
                    <div className="printer-templates-page__actions">
                        <PermissionGate
                            perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                            tooltip={t('errors.printTemplates.manageDenied')}
                        >
                            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>{t('common.edit')}</Button>
                        </PermissionGate>
                        <PermissionGate
                            perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                            tooltip={t('errors.printTemplates.manageDenied')}
                        >
                            <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>{t('common.disable')}</Button>
                        </PermissionGate>
                    </div>
                )
            }
        ],
        [t, templateTypeLabels]
    );

    return (
        <div className="printer-templates-page">
            <PageHeader
                title={t('settings.printing.templates.title')}
                subtitle={t('settings.printing.templates.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                        tooltip={t('errors.printTemplates.manageDenied')}
                    >
                        <Button variant="primary" onClick={openCreate}>
                            {t('settings.printing.templates.actions.add')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="printer-templates-page__error">{error}</div>}
            {isLoading && <div className="printer-templates-page__loading">{t('settings.printing.templates.loading')}</div>}

            <div className="printer-templates-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings.printing.templates.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="printer-templates-page__summary-grid">
                            <div>
                                <div className="printer-templates-page__summary-label">{t('settings.printing.templates.summary.templates')}</div>
                                <div className="printer-templates-page__summary-value">{templates.length}</div>
                            </div>
                            <div>
                                <div className="printer-templates-page__summary-label">{t('settings.printing.templates.summary.defaults')}</div>
                                <div className="printer-templates-page__summary-value">{templates.filter(t => (t.is_default ?? 0) === 1).length}</div>
                            </div>
                            <div>
                                <div className="printer-templates-page__summary-label">{t('settings.printing.templates.summary.active')}</div>
                                <div className="printer-templates-page__summary-value">{templates.filter(t => (t.is_active ?? 1) === 1).length}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.printing.templates.table.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={templates} columns={columns} isLoading={isLoading} />
                    {!isLoading && templates.length === 0 && (
                        <div className="printer-templates-page__empty">{t('settings.printing.templates.empty')}</div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={form.id ? t('settings.printing.templates.modal.editTitle') : t('settings.printing.templates.modal.addTitle')}
                footer={(
                    <div className="printer-templates-page__modal-actions">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSave}>
                            {form.id ? t('common.saveChanges') : t('settings.printing.templates.actions.create')}
                        </Button>
                    </div>
                )}
            >
                <div className="printer-templates-page__modal">
                    <Input
                        label={t('settings.printing.templates.form.name')}
                        value={form.name}
                        onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
                    />
                    <Select
                        label={t('settings.printing.templates.form.type')}
                        value={form.type}
                        onChange={(event) => setForm(prev => ({ ...prev, type: event.target.value as PrintTemplate['type'] }))}
                    >
                        {TEMPLATE_TYPES.map((type) => (
                            <option key={type} value={type}>{templateTypeLabels[type as keyof typeof templateTypeLabels] || type}</option>
                        ))}
                    </Select>
                    <label className="printer-templates-page__label">{t('settings.printing.templates.form.content')}</label>
                    <textarea
                        className="dms-input printer-templates-page__textarea"
                        rows={10}
                        value={form.content}
                        onChange={(event) => setForm(prev => ({ ...prev, content: event.target.value }))}
                    />
                    <div className="printer-templates-page__switch">
                        <div>
                            <div className="printer-templates-page__switch-title">{t('settings.printing.templates.form.defaultTitle')}</div>
                            <div className="printer-templates-page__switch-subtitle">{t('settings.printing.templates.form.defaultHint')}</div>
                        </div>
                        <Switch
                            checked={(form.is_default ?? 0) === 1}
                            onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_default: checked ? 1 : 0 }))}
                        />
                    </div>
                    <div className="printer-templates-page__preview">
                        <div className="printer-templates-page__preview-title">{t('settings.printing.templates.preview.title')}</div>
                        <pre className="printer-templates-page__preview-box">{preview || t('settings.printing.templates.preview.empty')}</pre>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PrinterTemplatesPage;
