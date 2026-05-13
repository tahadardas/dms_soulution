export interface LedgerLine {
    entry_id: string;
    date: string;
    entry_description: string;
    line_description?: string | null;
    source_type?: string | null;
    source_id?: string | null;
    debit: number;
    credit: number;
    running_balance: number;
}

export interface LedgerReport {
    account: {
        id: number;
        code: string;
        name: string;
        type: string;
    };
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
    items: LedgerLine[];
}

export interface TrialBalanceRow {
    id: number;
    code: string;
    name: string;
    type: string;
    total_debit: number;
    total_credit: number;
    net_balance: number;
}

export interface TrialBalanceReport {
    items: TrialBalanceRow[];
    totals: {
        total_debit: number;
        total_credit: number;
        net_balance: number;
    };
}
