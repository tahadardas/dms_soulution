import React from 'react';
import { Button, Input, Select } from '@dms/ui';
import { Account } from '../../types/accounting';
import { JournalLine } from '../../types/journal';
import { useTranslation } from 'react-i18next';
import '../../styles/JournalLinesEditor.css';

export interface JournalLinesEditorProps {
    accounts: Account[];
    lines: JournalLine[];
    onChange: (lines: JournalLine[]) => void;
    disabled?: boolean;
}

const createLine = (): JournalLine => ({
    account_id: 0,
    debit: 0,
    credit: 0,
    description: ''
});

export const JournalLinesEditor: React.FC<JournalLinesEditorProps> = ({ accounts, lines, onChange, disabled }) => {
    const { t } = useTranslation();
    const updateLine = (index: number, updates: Partial<JournalLine>) => {
        const next = [...lines];
        next[index] = { ...next[index], ...updates };
        onChange(next);
    };

    const handleDebitChange = (index: number, value: string) => {
        const debit = Number(value || 0);
        updateLine(index, { debit, credit: debit > 0 ? 0 : lines[index].credit });
    };

    const handleCreditChange = (index: number, value: string) => {
        const credit = Number(value || 0);
        updateLine(index, { credit, debit: credit > 0 ? 0 : lines[index].debit });
    };

    return (
        <div className="journal-lines">
            {lines.map((line, index) => (
                <div key={line.id ?? index} className="journal-line-row">
                    <Select
                        label={t('journals.editor.account')}
                        value={line.account_id ? String(line.account_id) : ''}
                        onChange={(event) => updateLine(index, { account_id: Number(event.target.value) })}
                        disabled={disabled}
                    >
                        <option value="">{t('journals.editor.selectAccount')}</option>
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                            </option>
                        ))}
                    </Select>
                    <Input
                        label={t('journals.editor.debit')}
                        type="number"
                        value={String(line.debit || '')}
                        onChange={(event) => handleDebitChange(index, event.target.value)}
                        disabled={disabled}
                    />
                    <Input
                        label={t('journals.editor.credit')}
                        type="number"
                        value={String(line.credit || '')}
                        onChange={(event) => handleCreditChange(index, event.target.value)}
                        disabled={disabled}
                    />
                    <Input
                        label={t('journals.editor.memo')}
                        value={line.description || ''}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                        disabled={disabled}
                    />
                    <div className="journal-line-row__actions">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onChange(lines.filter((_, idx) => idx !== index))}
                            disabled={disabled}
                        >
                            {t('common.remove')}
                        </Button>
                    </div>
                </div>
            ))}
            <div className="journal-lines__footer">
                <Button variant="secondary" size="sm" onClick={() => onChange([...lines, createLine()])} disabled={disabled}>
                    {t('journals.editor.addLine')}
                </Button>
            </div>
        </div>
    );
};

export default JournalLinesEditor;
