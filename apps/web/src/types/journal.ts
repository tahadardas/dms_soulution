export interface JournalLine {
    id?: number;
    account_id: number;
    debit: number;
    credit: number;
    description?: string;
}

export interface JournalEntry {
    id: string;
    date: string;
    description: string;
    posted: boolean | number;
    posted_at?: string | null;
    source_type?: string | null;
    source_id?: string | null;
    reversed_of?: string | null;
    total_debit?: number;
    total_credit?: number;
    lines?: JournalLine[];
}
