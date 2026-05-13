import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, Switch, useToast } from '@dms/ui';
import { useApi } from '../../hooks/useApi';
import { Category } from '../../types/products';
import PermissionGate from '../PermissionGate';
import { PERMISSIONS } from '../../lib/permissions';
import { useTranslation } from 'react-i18next';
import '../../styles/ProductCatalog.css';

export interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated?: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, onUpdated }) => {
    const api = useApi();
    const toast = useToast();
    const { t } = useTranslation();
    const [items, setItems] = useState<Category[]>([]);
    const [drafts, setDrafts] = useState<Record<number, Category>>({});
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await api<{ items: Category[] }>('/inventory/categories');
            setItems(data.items || []);
            const map: Record<number, Category> = {};
            (data.items || []).forEach(item => {
                map[item.id] = { ...item };
            });
            setDrafts(map);
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.categories.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            load();
        }
    }, [isOpen]);

    const canSubmit = useMemo(() => newName.trim().length > 0, [newName]);

    const handleCreate = async () => {
        if (!canSubmit) {
            toast.error(t('errors.products.categories.nameRequired'));
            return;
        }
        setIsSaving(true);
        try {
            await api('/inventory/categories', {
                method: 'POST',
                body: JSON.stringify({ 
                    name: newName.trim(), 
                    description: newDescription.trim() || null,
                    color: newColor.trim() || null
                })
            });
            toast.success(t('toast.products.categories.created'));
            setNewName('');
            setNewDescription('');
            setNewColor('#3b82f6');
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.categories.createFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async (id: number) => {
        const draft = drafts[id];
        if (!draft?.name?.trim()) {
            toast.error(t('errors.products.categories.nameRequired'));
            return;
        }
        setIsSaving(true);
        try {
            await api(`/inventory/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: draft.name.trim(),
                    description: draft.description?.trim() || null,
                    color: draft.color?.trim() || null,
                    is_active: draft.is_active ?? 1
                })
            });
            toast.success(t('toast.products.categories.updated'));
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.categories.updateFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchive = async (id: number) => {
        setIsSaving(true);
        try {
            await api(`/inventory/categories/${id}`, { method: 'DELETE' });
            toast.success(t('toast.products.categories.archived'));
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.categories.archiveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('products.categories.title')}
            footer={(
                <div className="catalog-modal__footer">
                    <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
                </div>
            )}
        >
            <div className="catalog-modal">
                <Card className="catalog-card">
                    <CardHeader>
                        <CardTitle>{t('products.categories.newTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="catalog-form">
                            <Input
                                label={t('products.categories.fields.name')}
                                value={newName}
                                onChange={(event) => setNewName(event.target.value)}
                            />
                            <Input
                                label={t('products.categories.fields.description')}
                                value={newDescription}
                                onChange={(event) => setNewDescription(event.target.value)}
                            />
                            <Input
                                label={t('products.categories.fields.color') || 'Color'}
                                type="color"
                                value={newColor}
                                onChange={(event) => setNewColor(event.target.value)}
                                className="catalog-form__color"
                            />
                            <PermissionGate
                                perm={PERMISSIONS.PRD_EDIT}
                                tooltip={t('errors.products.manageCategoriesDenied')}
                            >
                                <Button variant="primary" onClick={handleCreate} disabled={!canSubmit} isLoading={isSaving}>
                                    {t('products.categories.actions.create')}
                                </Button>
                            </PermissionGate>
                        </div>
                    </CardContent>
                </Card>

                <Card className="catalog-card">
                    <CardHeader>
                        <CardTitle>{t('products.categories.existingTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading && <div className="catalog-state">{t('products.categories.loading')}</div>}
                        {!isLoading && items.length === 0 && (
                            <div className="catalog-state">{t('products.categories.empty')}</div>
                        )}
                        {!isLoading && items.length > 0 && (
                            <div className="catalog-list">
                                {items.map((item) => {
                                    const draft = drafts[item.id] || item;
                                    return (
                                        <div key={item.id} className="catalog-row">
                                            <Input
                                                label={t('products.categories.fields.name')}
                                                value={draft.name}
                                                onChange={(event) => setDrafts(prev => ({
                                                    ...prev,
                                                    [item.id]: { ...draft, name: event.target.value }
                                                }))}
                                            />
                                            <Input
                                                label={t('products.categories.fields.description')}
                                                value={draft.description || ''}
                                                onChange={(event) => setDrafts(prev => ({
                                                    ...prev,
                                                    [item.id]: { ...draft, description: event.target.value }
                                                }))}
                                            />
                                            <Input
                                                label={t('products.categories.fields.color') || 'Color'}
                                                type="color"
                                                value={draft.color || '#3b82f6'}
                                                onChange={(event) => setDrafts(prev => ({
                                                    ...prev,
                                                    [item.id]: { ...draft, color: event.target.value }
                                                }))}
                                                className="catalog-form__color"
                                            />
                                            <div className="catalog-switch">
                                                <span className="catalog-switch__label">{t('common.active')}</span>
                                                <Switch
                                                    checked={Boolean(draft.is_active ?? 1)}
                                                    onCheckedChange={(checked) => setDrafts(prev => ({
                                                        ...prev,
                                                        [item.id]: { ...draft, is_active: checked ? 1 : 0 }
                                                    }))}
                                                />
                                            </div>
                                            <div className="catalog-actions">
                                                <PermissionGate
                                                    perm={PERMISSIONS.PRD_EDIT}
                                                    tooltip={t('errors.products.manageCategoriesDenied')}
                                                >
                                                    <Button size="sm" variant="primary" isLoading={isSaving} onClick={() => handleUpdate(item.id)}>
                                                        {t('common.save')}
                                                    </Button>
                                                </PermissionGate>
                                                <PermissionGate
                                                    perm={PERMISSIONS.PRD_EDIT}
                                                    tooltip={t('errors.products.manageCategoriesDenied')}
                                                >
                                                    <Button size="sm" variant="secondary" isLoading={isSaving} onClick={() => handleArchive(item.id)}>
                                                        {t('products.categories.actions.archive')}
                                                    </Button>
                                                </PermissionGate>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Modal>
    );
};

export default CategoryManager;
