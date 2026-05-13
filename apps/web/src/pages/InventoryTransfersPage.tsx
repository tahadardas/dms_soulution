import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, Input, PageHeader, Select, Table, useToast } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { Branch, InventoryItem, InventoryMovement } from '../types/inventory';
import { useTranslation } from 'react-i18next';
import '../styles/InventoryTransfersPage.css';

export const InventoryTransfersPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t, i18n } = useTranslation();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [recent, setRecent] = useState<InventoryMovement[]>([]);
    const [fromBranch, setFromBranch] = useState('');
    const [toBranch, setToBranch] = useState('');
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('1');
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
            const data = await api<{ items: InventoryMovement[] }>('/inventory/movements?type=TRANSFER_OUT&pageSize=10');
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

    const selectedItem = useMemo(
        () => items.find((item) => String(item.id) === productId),
        [items, productId]
    );

    const handleSubmit = async () => {
        setError('');
        if (!productId) {
            setError(t('errors.inventory.transferSelectProduct'));
            return;
        }
        if (!fromBranch || !toBranch || fromBranch === toBranch) {
            setError(t('errors.inventory.transferBranchMismatch'));
            return;
        }
        if (!Number(quantity || 0)) {
            setError(t('errors.inventory.transferQuantityRequired'));
            return;
        }
        if (!reason.trim()) {
            setError(t('errors.inventory.transferReasonRequired'));
            return;
        }

        setIsSaving(true);
        try {
            await api('/inventory/transfers', {
                method: 'POST',
                body: JSON.stringify({
                    from_branch_id: Number(fromBranch),
                    to_branch_id: Number(toBranch),
                    product_id: Number(productId),
                    quantity: Number(quantity),
                    reason: reason.trim(),
                    reference_id: reference.trim() || undefined,
                    description: description.trim() || undefined
                })
            });
            toast.success(t('toast.inventory.transferCreated'));
            setQuantity('1');
            setReason('');
            setReference('');
            setDescription('');
            loadRecent();
        } catch (err: any) {
            const message = err?.message || t('errors.inventory.transferCreateFailed');
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
                header: t('inventory.transfers.table.date'),
                accessorKey: 'date',
                cell: (row: InventoryMovement) => new Intl.DateTimeFormat(locale, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }).format(new Date(row.date))
            },
            { header: t('inventory.transfers.table.item'), accessorKey: 'product_name' },
            { header: t('inventory.transfers.table.quantity'), accessorKey: 'quantity' },
            { header: t('inventory.transfers.table.fromBranch'), accessorKey: 'branch_name' },
            { header: t('inventory.transfers.table.reason'), accessorKey: 'reason' }
        ],
        [locale, t]
    );

    return (
        <div className="inventory-transfers-page">
            <PageHeader
                title={t('inventory.transfers.title')}
                subtitle={t('inventory.transfers.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.INV_TRANSFER}
                        tooltip={t('errors.inventory.transferDenied')}
                    >
                        <Button variant="primary" onClick={handleSubmit} isLoading={isSaving}>
                            {t('inventory.transfers.actions.create')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="inventory-transfers-page__error">{error}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>{t('inventory.transfers.detailsTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="inventory-transfer-form">
                        <Select
                            label={t('inventory.transfers.fields.fromBranch')}
                            value={fromBranch}
                            onChange={(event) => setFromBranch(event.target.value)}
                        >
                            <option value="">{t('inventory.transfers.selectSource')}</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </Select>
                        <Select
                            label={t('inventory.transfers.fields.toBranch')}
                            value={toBranch}
                            onChange={(event) => setToBranch(event.target.value)}
                        >
                            <option value="">{t('inventory.transfers.selectDestination')}</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </Select>
                        <Select
                            label={t('inventory.transfers.fields.product')}
                            value={productId}
                            onChange={(event) => setProductId(event.target.value)}
                        >
                            <option value="">{t('inventory.transfers.selectProduct')}</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {t('inventory.transfers.productOption', { name: item.name, onHand: item.on_hand ?? 0 })}
                                </option>
                            ))}
                        </Select>
                        <Input
                            label={t('inventory.transfers.fields.quantity')}
                            type="number"
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                        />
                        <Input
                            label={t('inventory.transfers.fields.reason')}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                        />
                        <Input
                            label={t('inventory.transfers.fields.reference')}
                            value={reference}
                            onChange={(event) => setReference(event.target.value)}
                        />
                        <Input
                            label={t('inventory.transfers.fields.description')}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                        {selectedItem && (
                            <div className="inventory-transfer-form__hint">
                                {t('inventory.transfers.currentOnHand', {
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
                    <CardTitle>{t('inventory.transfers.recentTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {recent.length === 0 ? (
                        <div className="inventory-transfers-page__empty">{t('inventory.transfers.emptyRecent')}</div>
                    ) : (
                        <Table data={recent} columns={columns} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default InventoryTransfersPage;
