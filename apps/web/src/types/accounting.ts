export interface Account {
    id: number;
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | string;
    parent_id?: number | null;
    is_system?: number;
    is_active?: number;
    is_control?: number;
}
