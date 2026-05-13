import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, Select, Switch, useToast } from '@dms/ui';
import { useApi } from '../../hooks/useApi';
import { Unit, UnitConversion } from '../../types/products';
import PermissionGate from '../PermissionGate';
import { PERMISSIONS } from '../../lib/permissions';
import { useTranslation } from 'react-i18next';
import '../../styles/ProductCatalog.css';

export interface UnitManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated?: () => void;
}

const formatUnitLabel = (unit: Unit) => `${unit.name} (${unit.abbreviation})`;

export const UnitManager: React.FC<UnitManagerProps> = ({ isOpen, onClose, onUpdated }) => {
    const api = useApi();
    const toast = useToast();
    const { t } = useTranslation();
    const [units, setUnits] = useState<Unit[]>([]);
    const [conversions, setConversions] = useState<UnitConversion[]>([]);
    const [drafts, setDrafts] = useState<Record<number, Unit>>({});
    const [newName, setNewName] = useState('');
    const [newAbbr, setNewAbbr] = useState('');
    const [conversionDraft, setConversionDraft] = useState({
        from_unit_id: '',
        to_unit_id: '',
        multiplier: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        setIsLoading(true);
        try {
            const [unitsData, conversionsData] = await Promise.all([
                api<{ items: Unit[] }>('/inventory/units'),
                api<{ items: UnitConversion[] }>('/inventory/units/conversions')
            ]);
            setUnits(unitsData.items || []);
            setConversions(conversionsData.items || []);
            const map: Record<number, Unit> = {};
            (unitsData.items || []).forEach(item => {
                map[item.id] = { ...item };
            });
            setDrafts(map);
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.units.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            load();
        }
    }, [isOpen]);

    const canCreateUnit = useMemo(() => newName.trim().length > 0 && newAbbr.trim().length > 0, [newName, newAbbr]);
    const canCreateConversion = useMemo(() => (
        conversionDraft.from_unit_id &&
        conversionDraft.to_unit_id &&
        Number(conversionDraft.multiplier) > 0
    ), [conversionDraft]);

    const handleCreateUnit = async () => {
        if (!canCreateUnit) {
            toast.error(t('errors.products.units.nameRequired'));
            return;
        }
        setIsSaving(true);
        try {
            await api('/inventory/units', {
                method: 'POST',
                body: JSON.stringify({ name: newName.trim(), abbreviation: newAbbr.trim() })
            });
            toast.success(t('toast.products.units.created'));
            setNewName('');
            setNewAbbr('');
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.units.createFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateUnit = async (id: number) => {
        const draft = drafts[id];
        if (!draft?.name?.trim() || !draft?.abbreviation?.trim()) {
            toast.error(t('errors.products.units.nameRequired'));
            return;
        }
        setIsSaving(true);
        try {
            await api(`/inventory/units/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: draft.name.trim(),
                    abbreviation: draft.abbreviation.trim(),
                    is_active: draft.is_active ?? 1
                })
            });
            toast.success(t('toast.products.units.updated'));
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.units.updateFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchiveUnit = async (id: number) => {
        setIsSaving(true);
        try {
            await api(`/inventory/units/${id}`, { method: 'DELETE' });
            toast.success(t('toast.products.units.archived'));
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.units.archiveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateConversion = async () => {
        if (!canCreateConversion) {
            toast.error(t('errors.products.units.conversionFieldsRequired'));
            return;
        }
        if (conversionDraft.from_unit_id === conversionDraft.to_unit_id) {
            toast.error(t('errors.products.units.conversionSameUnit'));
            return;
        }
        setIsSaving(true);
        try {
            await api('/inventory/units/conversions', {
                method: 'POST',
                body: JSON.stringify({
                    from_unit_id: Number(conversionDraft.from_unit_id),
                    to_unit_id: Number(conversionDraft.to_unit_id),
                    multiplier: Number(conversionDraft.multiplier)
                })
            });
            toast.success(t('toast.products.units.conversionSaved'));
            setConversionDraft({ from_unit_id: '', to_unit_id: '', multiplier: '' });
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.units.conversionSaveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConversion = async (id: number) => {
        setIsSaving(true);
        try {
            await api(`/inventory/units/conversions/${id}`, { method: 'DELETE' });
            toast.success(t('toast.products.units.conversionRemoved'));
            await load();
            onUpdated?.();
        } catch (err: any) {
            toast.error(err?.message || t('errors.products.units.conversionDeleteFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('products.units.title')}
            footer={(
                <div className="catalog-modal__footer">
                    <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
                </div>
            )}
        >
            <div className="catalog-modal">
                <Card className="catalog-card">
                    <CardHeader>
                        <CardTitle>{t('products.units.newTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="catalog-form">
                            <Input label={t('products.units.fields.name')} value={newName} onChange={(event) => setNewName(event.target.value)} />
                            <Input label={t('products.units.fields.abbreviation')} value={newAbbr} onChange={(event) => setNewAbbr(event.target.value)} />
                            <PermissionGate
                                perm={PERMISSIONS.PRD_EDIT}
                                tooltip={t('errors.products.manageUnitsDenied')}
                            >
                                <Button variant="primary" onClick={handleCreateUnit} disabled={!canCreateUnit} isLoading={isSaving}>
                                    {t('products.units.actions.create')}
                                </Button>
                            </PermissionGate>
                        </div>
                    </CardContent>
                </Card>

                <Card className="catalog-card">
                    <CardHeader>
                        <CardTitle>{t('products.units.existingTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading && <div className="catalog-state">{t('products.units.loading')}</div>}
                        {!isLoading && units.length === 0 && (
                            <div className="catalog-state">{t('products.units.empty')}</div>
                        )}
                        {!isLoading && units.length > 0 && (
                            <div className="catalog-list">
                                {units.map((unit) => {
                                    const draft = drafts[unit.id] || unit;
                                    return (
                                        <div key={unit.id} className="catalog-row">
                                            <Input
                                                label={t('products.units.fields.name')}
                                                value={draft.name}
                                                onChange={(event) => setDrafts(prev => ({
                                                    ...prev,
                                                    [unit.id]: { ...draft, name: event.target.value }
                                                }))}
                                            />
                                            <Input
                                                label={t('products.units.fields.abbreviation')}
                                                value={draft.abbreviation}
                                                onChange={(event) => setDrafts(prev => ({
                                                    ...prev,
                                                    [unit.id]: { ...draft, abbreviation: event.target.value }
                                                }))}
                                            />
                                            <div className="catalog-switch">
                                                <span className="catalog-switch__label">{t('common.active')}</span>
                                                <Switch
                                                    checked={Boolean(draft.is_active ?? 1)}
                                                    onCheckedChange={(checked) => setDrafts(prev => ({
                                                        ...prev,
                                                        [unit.id]: { ...draft, is_active: checked ? 1 : 0 }
                                                    }))}
                                                />
                                            </div>
                                            <div className="catalog-actions">
                                                <PermissionGate
                                                    perm={PERMISSIONS.PRD_EDIT}
                                                    tooltip={t('errors.products.manageUnitsDenied')}
                                                >
                                                    <Button size="sm" variant="primary" isLoading={isSaving} onClick={() => handleUpdateUnit(unit.id)}>
                                                        {t('common.save')}
                                                    </Button>
                                                </PermissionGate>
                                                <PermissionGate
                                                    perm={PERMISSIONS.PRD_EDIT}
                                                    tooltip={t('errors.products.manageUnitsDenied')}
                                                >
                                                    <Button size="sm" variant="secondary" isLoading={isSaving} onClick={() => handleArchiveUnit(unit.id)}>
                                                        {t('products.units.actions.archive')}
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

                <Card className="catalog-card">
                    <CardHeader>
                        <CardTitle>{t('products.units.conversionsTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="catalog-form">
                            <Select
                                value={conversionDraft.from_unit_id}
                                onChange={(event) => setConversionDraft(prev => ({ ...prev, from_unit_id: event.target.value }))}
                            >
                                <option value="">{t('products.units.conversions.from')}</option>
                                {units.map((unit) => (
                                    <option key={unit.id} value={unit.id}>{formatUnitLabel(unit)}</option>
                                ))}
                            </Select>
                            <Select
                                value={conversionDraft.to_unit_id}
                                onChange={(event) => setConversionDraft(prev => ({ ...prev, to_unit_id: event.target.value }))}
                            >
                                <option value="">{t('products.units.conversions.to')}</option>
                                {units.map((unit) => (
                                    <option key={unit.id} value={unit.id}>{formatUnitLabel(unit)}</option>
                                ))}
                            </Select>
                            <Input
                                label={t('products.units.conversions.multiplier')}
                                type="number"
                                value={conversionDraft.multiplier}
                                onChange={(event) => setConversionDraft(prev => ({ ...prev, multiplier: event.target.value }))}
                            />
                            <PermissionGate
                                perm={PERMISSIONS.PRD_EDIT}
                                tooltip={t('errors.products.manageUnitsDenied')}
                            >
                                <Button variant="primary" onClick={handleCreateConversion} disabled={!canCreateConversion} isLoading={isSaving}>
                                    {t('products.units.actions.saveConversion')}
                                </Button>
                            </PermissionGate>
                        </div>

                        {conversions.length === 0 && !isLoading && (
                            <div className="catalog-state">{t('products.units.conversions.empty')}</div>
                        )}
                        {conversions.length > 0 && (
                            <div className="catalog-list catalog-list--compact">
                                {conversions.map((conversion) => (
                                    <div key={conversion.id} className="catalog-row catalog-row--compact">
                                        <div className="catalog-conversion">
                                            <span>{conversion.from_name} ({conversion.from_abbr})</span>
                                            <span className="catalog-conversion__arrow">{t('products.units.conversions.arrow')}</span>
                                            <span>{conversion.to_name} ({conversion.to_abbr})</span>
                                            <span className="catalog-conversion__multiplier">{t('products.units.conversions.multiplierValue', { value: conversion.multiplier })}</span>
                                        </div>
                                        <PermissionGate
                                            perm={PERMISSIONS.PRD_EDIT}
                                            tooltip={t('errors.products.manageUnitsDenied')}
                                        >
                                            <Button size="sm" variant="secondary" isLoading={isSaving} onClick={() => handleDeleteConversion(conversion.id)}>
                                                {t('common.remove')}
                                            </Button>
                                        </PermissionGate>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Modal>
    );
};

export default UnitManager;
