import React, { useState, useEffect, useCallback } from 'react';
import { 
    Button, Card, CardContent, CardHeader, CardTitle, 
    Input, PageHeader, Table, useToast, Column 
} from '@dms/ui';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';

interface BackupInfo {
    id: string;
    filename: string;
    size: number;
    createdAt: string;
}

const BackupManagementPage: React.FC = () => {
    const { t } = useTranslation();
    const api = useApi();
    const toast = useToast();
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [backupConfig, setBackupConfig] = useState({ backupPath: '' });
    const [isConfigLoading, setIsConfigLoading] = useState(true);

    const loadBackups = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api<{ items: BackupInfo[] }>('/admin/backups');
            const itemsWithId = (data.items || []).map(item => ({ ...item, id: item.filename }));
            setBackups(itemsWithId);
        } catch (err: any) {
            toast.error(t('errors.backups.loadFailed', 'Failed to load backups'));
        } finally {
            setLoading(false);
        }
    }, [api, t, toast]);

    const loadConfig = useCallback(async () => {
        setIsConfigLoading(true);
        try {
            const data = await api<{ backupPath: string }>('/admin/backups/config');
            setBackupConfig(data);
        } catch (err: any) {
            console.error('Failed to load backup config', err);
        } finally {
            setIsConfigLoading(false);
        }
    }, [api]);

    useEffect(() => {
        loadBackups();
        loadConfig();
    }, [loadBackups, loadConfig]);

    const handleCreateBackup = async () => {
        setIsCreating(true);
        try {
            await api('/admin/backups', { method: 'POST' });
            toast.success(t('toast.backups.created', 'Backup created successfully'));
            loadBackups();
        } catch (err: any) {
            toast.error(err.message || t('errors.backups.createFailed', 'Failed to create backup'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleRestore = async (filename: string) => {
        if (!window.confirm(t('common.confirmRestore', 'Are you sure? This will replace the current database and require a restart.'))) {
            return;
        }

        try {
            await api('/admin/backups/restore', {
                method: 'POST',
                body: JSON.stringify({ filename })
            });
            toast.success(t('toast.backups.restored', 'Backup restored. Please restart the application.'));
        } catch (err: any) {
            toast.error(err.message || t('errors.backups.restoreFailed', 'Failed to restore backup'));
        }
    };

    const handleDelete = async (filename: string) => {
        if (!window.confirm(t('common.confirmDelete', 'Are you sure you want to delete this backup?'))) {
            return;
        }

        try {
            await api(`/admin/backups/${filename}`, { method: 'DELETE' });
            toast.success(t('toast.backups.deleted', 'Backup deleted'));
            loadBackups();
        } catch (err: any) {
            toast.error(err.message || t('errors.backups.deleteFailed', 'Failed to delete backup'));
        }
    };

    const handleSaveConfig = async () => {
        try {
            await api('/admin/backups/config', {
                method: 'PUT',
                body: JSON.stringify(backupConfig)
            });
            toast.success(t('toast.backups.configSaved', 'Backup path updated'));
            loadBackups(); // Reload list as path changed
        } catch (err: any) {
            toast.error(err.message || t('errors.backups.configSaveFailed', 'Failed to save configuration'));
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const columns: Column<BackupInfo>[] = [
        {
            header: t('settings.backups.filename', 'Filename'),
            accessorKey: 'filename',
        },
        {
            header: t('settings.backups.date', 'Date'),
            accessorKey: 'createdAt',
            cell: (row) => new Date(row.createdAt).toLocaleString(),
        },
        {
            header: t('settings.backups.size', 'Size'),
            accessorKey: 'size',
            cell: (row) => formatSize(row.size),
        },
        {
            header: t('common.actions'),
            cell: (row) => (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="sm" onClick={() => handleRestore(row.filename)}>
                        🔄 {t('common.restore', 'Restore')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(row.filename)}>
                        🗑️ {t('common.delete', 'Delete')}
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <PageHeader
                title={t('settings.backups.title', 'Backup Management')}
                subtitle={t('settings.backups.subtitle', 'Create and manage database backups')}
                backButton={<BackButton />}
                actions={
                    <Button variant="primary" onClick={handleCreateBackup} isLoading={isCreating}>
                        💾 {t('settings.backups.create', 'Take Backup Now')}
                    </Button>
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings.backups.config', 'Configuration')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <Input
                                    label={t('settings.backups.path', 'Backup Storage Path')}
                                    value={backupConfig.backupPath}
                                    onChange={(e) => setBackupConfig({ backupPath: e.target.value })}
                                    disabled={isConfigLoading}
                                />
                            </div>
                            <Button variant="secondary" onClick={handleSaveConfig} disabled={isConfigLoading}>
                                {t('common.save', 'Save Path')}
                            </Button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                            {t('settings.backups.pathHint', 'Backups will be stored in this directory. Make sure the application has write permissions.')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings.backups.history', 'Backup History')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table<BackupInfo> 
                            data={backups} 
                            columns={columns as any} 
                            isLoading={loading} 
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default BackupManagementPage;
