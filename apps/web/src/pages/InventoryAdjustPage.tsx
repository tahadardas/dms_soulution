import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, Input, PageHeader, Select, Table, useToast } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { Branch, InventoryItem, InventoryMovement } from '../types/inventory';
import { useTranslation } from 'react-i18next';
import '../styles/InventoryAdjustPage.css';

type AdjustmentType = 'IN' | 'OUT' | 'ADJUST';

export const InventoryAdjustPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t, i18n } = useTranslation();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [recent, setRecent] = useState<InventoryMovement[]>([]);
    const [type, setType] = useState<AdjustmentType>('IN');
    const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
    const [productId, setProductId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [unitCost, setUnitCost] = useState('');
    const [reason, setReason] = useState('');
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const loadItems = useCallback(async () => {
        try {
            const data = await api<{ items: InventoryItem[] }>('/inventory/items?pageSize=200&isActive=true');
            setItems(data.items || []);
        } catch {
            setItems([]);
        }
    }, [api]);

    const loadBranches = useCallback(async () => {
        try {
            const data = await api<{ items: Branch[] }>('/branches');
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, [api]);

    const loadRecent = useCallback(async () => {
        try {
            const data = await api<{ items: InventoryMovement[] }>('/inventory/movements?type=ADJUST&pageSize=10');
            setRecent(data.items || []);
        } catch {
            setRecent([]);
        }
    }, [api]);

    useEffect(() => {
        loadItems();
        loadBranches();
        loadRecent();
    }, [loadBranches, loadItems, loadRecent]);

    useEffect(() => {
        if (type !== 'IN') {
            setUnitCost('');
        }
    }, [type]);

    const selectedItem = useMemo(
        () => items.find((item) => String(item.id) === productId),
        [items, productId]
    );

    const effectiveQuantity = useMemo(() => {
        const qty = Number(quantity || 0);
        if (!qty) return 0;
        if (type !== 'ADJUST') return qty;
        return direction === 'INCREASE' ? qty : -qty;
    }, [direction, quantity, type]);

    const handleSubmit = async () => {
        setError('');
        if (!productId) {
            setError(t('errors.inventory.adjustSelectProduct'));
            return;
        }
        if (!effectiveQuantity) {
            setError(t('errors.inventory.adjustQuantityRequired'));
            return;
        }
        if (type === 'ADJUST' && !reason.trim()) {
            setError(t('errors.inventory.adjustReasonRequired'));
            return;
        }
        setIsSaving(true);
        try {
            await api('/inventory/movements', {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    product_id: Number(productId),
                    quantity: effectiveQuantity,
                    unit_cost: unitCost ? Number(unitCost) : undefined,
                    reason: reason.trim() || undefined,
                    reference_id: reference.trim() || undefined,
                    description: description.trim() || undefined,
                    branch_id: branchId ? Number(branchId) : undefined
                })
            });
            toast.success(t('toast.inventory.adjustSaved'));
            setQuantity('1');
            setUnitCost('');
            setReason('');
            setReference('');
            setDescription('');
            loadRecent();
        } catch (err: any) {
            const message = err?.message || t('errors.inventory.adjustSaveFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

    const columns: Column<any>[] = useMemo(
        () => [
            {
                header: t('inventory.adjust.table.date'),
                accessorKey: 'date',
                cell: (row: InventoryMovement) => new Intl.DateTimeFormat(locale, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }).format(new Date(row.date))
            },
            { header: t('inventory.adjust.table.item'), accessorKey: 'product_name' },
            { header: t('inventory.adjust.table.quantity'), accessorKey: 'quantity' },
            { header: t('inventory.adjust.table.reason'), accessorKey: 'reason' }
        ],
        [locale, t]
    );

    return (
        <div className="inventory-adjust-page">
            <PageHeader
                title={t('inventory.adjust.title')}
                subtitle={t('inventory.adjust.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.INV_ADJUST}
                        tooltip={t('errors.inventory.adjustDenied')}
                    >
                        <Button variant="primary" onClick={handleSubmit} isLoading={isSaving}>
                            {t('inventory.adjust.actions.save')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="inventory-adjust-page__error">{error}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>{t('inventory.adjust.newMovement')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="inventory-adjust-form">
                        <Select label={t('inventory.adjust.fields.type')} value={type} onChange={(event) => setType(event.target.value as AdjustmentType)}>
                            <option value="IN">{t('inventory.adjust.types.in')}</option>
                            <option value="OUT">{t('inventory.adjust.types.out')}</option>
                            <option value="ADJUST">{t('inventory.adjust.types.adjust')}</option>
                        </Select>
                        {type === 'ADJUST' && (
                            <Select
                                label={t('inventory.adjust.fields.direction')}
                                value={direction}
                                onChange={(event) => setDirection(event.target.value as 'INCREASE' | 'DECREASE')}
                            >
                                <option value="INCREASE">{t('inventory.adjust.direction.increase')}</option>
                                <option value="DECREASE">{t('inventory.adjust.direction.decrease')}</option>
                            </Select>
                        )}
                        <Select
                            label={t('inventory.adjust.fields.product')}
                            value={productId}
                            onChange={(event) => setProductId(event.target.value)}
                        >
                            <option value="">{t('inventory.adjust.selectProduct')}</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {t('inventory.adjust.productOption', { name: item.name, onHand: item.on_hand ?? 0 })}
                                </option>
                            ))}
                        </Select>
                        <Input
                            label={t('inventory.adjust.fields.quantity')}
                            type="number"
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                        />
                        <Input
                            label={t('inventory.adjust.fields.unitCost')}
                            type="number"
                            value={unitCost}
                            onChange={(event) => setUnitCost(event.target.value)}
                            disabled={type !== 'IN'}
                        />
                        <Select
                            label={t('inventory.adjust.fields.branch')}
                            value={branchId}
                            onChange={(event) => setBranchId(event.target.value)}
                        >
                            <option value="">{t('inventory.adjust.defaultBranch')}</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </Select>
                        <Input
                            label={t('inventory.adjust.fields.reason')}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={t('inventory.adjust.reasonPlaceholder')}
                        />
                        <Input
                            label={t('inventory.adjust.fields.reference')}
                            value={reference}
                            onChange={(event) => setReference(event.target.value)}
                        />
                        <Input
                            label={t('inventory.adjust.fields.description')}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                        {selectedItem && (
                            <div className="inventory-adjust-form__hint">
                                {t('inventory.adjust.currentOnHand', {
                                    quantity: selectedItem.on_hand ?? 0,
                                    unit: selectedItem.unit_abbr || ''
                                })}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('inventory.adjust.recentTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {recent.length === 0 ? (
                        <div className="inventory-adjust-page__empty">{t('inventory.adjust.emptyRecent')}</div>
                    ) : (
                        <Table data={recent} columns={columns} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default InventoryAdjustPage;
