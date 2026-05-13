import React, { useState, useEffect, useMemo } from 'react';
import { 
    Button, Card, CardContent, CardHeader,
    Input, Modal, PageHeader, Select, StatusBadge, 
    Table, useToast, Column 
} from '@dms/ui';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';

interface User {
    id: number;
    username: string;
    role_id: string;
    branch_id: number | null;
    created_at: string;
    settings: any;
}

interface Role {
    id: string;
    name: string;
    description: string;
}

const UserManagementPage: React.FC = () => {
    const { t } = useTranslation();
    const api = useApi();
    const toast = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role_id: '',
        branch_id: '' as string | number
    });

    const fetchUsers = async () => {
        try {
            const data = await api<User[]>('/users');
            setUsers(data || []);
        } catch (err: any) {
            toast.error(t('errors.users.fetchFailed'));
        }
    };

    const fetchRoles = async () => {
        try {
            const data = await api<Role[]>('/users/roles');
            setRoles(data || []);
        } catch (err: any) {
            console.error('Failed to fetch roles', err);
        }
    };

    const fetchBranches = async () => {
        try {
            const data = await api<{ items: any[] }>('/branches');
            setBranches(data.items || []);
        } catch (err: any) {
            console.error('Failed to fetch branches', err);
        }
    };

    useEffect(() => {
        Promise.all([fetchUsers(), fetchRoles(), fetchBranches()])
            .finally(() => setLoading(false));
    }, []);

    const handleOpenAddModal = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            password: '',
            role_id: roles[0]?.id || '',
            branch_id: ''
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '', 
            role_id: user.role_id,
            branch_id: user.branch_id || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.username.trim()) {
            toast.error(t('settings.users.usernameRequired', 'Username is required'));
            return;
        }
        if (!editingUser && !formData.password.trim()) {
            toast.error(t('settings.users.passwordRequired', 'Password is required'));
            return;
        }

        try {
            const payload = {
                username: formData.username,
                role_id: formData.role_id,
                branch_id: formData.branch_id === '' ? null : Number(formData.branch_id),
                ...(formData.password.trim() ? { password: formData.password } : {})
            };

            if (editingUser) {
                await api(`/users/${editingUser.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                toast.success(t('toast.users.updated'));
            } else {
                await api('/users', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                toast.success(t('toast.users.created'));
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || t('errors.users.saveFailed'));
        }
    };

    const handleDelete = async (user: User) => {
        if (!window.confirm(t('common.confirmDelete', 'Are you sure you want to delete this?'))) return;
        try {
            await api(`/users/${user.id}`, { method: 'DELETE' });
            toast.success(t('toast.users.deleted'));
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || t('errors.users.deleteFailed'));
        }
    };

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns: Column<User>[] = useMemo(() => [
        {
            header: t('settings.users.username'),
            accessorKey: 'username',
            cell: (row) => (
                <div style={{ fontWeight: 600 }}>{row.username}</div>
            )
        },
        {
            header: t('settings.users.role'),
            accessorKey: 'role_id',
            cell: (row) => (
                <StatusBadge variant="info" size="sm">
                    👤 {row.role_id}
                </StatusBadge>
            )
        },
        {
            header: t('settings.users.branch'),
            accessorKey: 'branch_id',
            cell: (row) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {row.branch_id ? (
                        <>📍 {branches.find(b => b.id === row.branch_id)?.name || row.branch_id}</>
                    ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            🌍 {t('settings.users.allBranches')}
                        </span>
                    )}
                </span>
            )
        },
        {
            header: t('settings.users.createdAt'),
            accessorKey: 'created_at',
            cell: (row) => new Date(row.created_at).toLocaleDateString()
        },
        {
            header: t('common.actions'),
            cell: (row) => (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(row)}>
                        {t('common.edit')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                        {t('common.delete')}
                    </Button>
                </div>
            )
        }
    ], [t, branches]);

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <PageHeader
                title={t('settings.users.title')}
                subtitle={t('settings.users.subtitle')}
                backButton={<BackButton />}
                actions={
                    <Button variant="primary" onClick={handleOpenAddModal}>
                        ➕ {t('settings.users.addUser')}
                    </Button>
                }
            />

            <Card style={{ marginTop: '24px' }}>
                <CardHeader>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <Input
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table 
                        data={filteredUsers} 
                        columns={columns} 
                        isLoading={loading} 
                    />
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingUser ? t('settings.users.editUser') : t('settings.users.addUser')}
                footer={
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSubmit}>
                            {t('common.save')}
                        </Button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input
                        label={t('settings.users.username')}
                        required
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                    />

                    <Input
                        label={t('settings.users.password')}
                        type="password"
                        placeholder={editingUser ? t('settings.users.leaveBlankToKeep') : ''}
                        required={!editingUser}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />

                    <Select
                        label={t('settings.users.role')}
                        required
                        value={formData.role_id}
                        onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                    >
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name || r.id}</option>
                        ))}
                    </Select>

                    <Select
                        label={t('settings.users.branch')}
                        value={formData.branch_id}
                        onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                    >
                        <option value="">{t('settings.users.allBranches')}</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </Select>
                </div>
            </Modal>
        </div>
    );
};

export default UserManagementPage;
