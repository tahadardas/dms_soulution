const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { AccountingService } = require('../src/services/accountingService');

const createDb = () => {
    const db = initDB();
    return { db, accountingService: new AccountingService(db) };
};

test('draft journal can be unbalanced but cannot be posted', () => {
    const { db, accountingService } = createDb();
    const cash = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1010');
    const sales = db.prepare('SELECT id FROM accounts WHERE code = ?').get('4100');

    const draft = accountingService.createJournalEntry({
        date: new Date().toISOString(),
        description: 'Unbalanced draft',
        source_type: 'MANUAL',
        source_id: null,
        lines: [
            { account_id: cash.id, debit: 100, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 50 }
        ]
    }, { allowUnbalanced: true });

    assert.ok(draft.id);
    const row = db.prepare('SELECT posted FROM journal_entries WHERE id = ?').get(draft.id);
    assert.equal(row.posted, 0);

    assert.throws(() => accountingService.postEntry(draft.id), /not balanced/i);
    db.close();
});

test('post and reverse journal entry', () => {
    const { db, accountingService } = createDb();
    const cash = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1010');
    const sales = db.prepare('SELECT id FROM accounts WHERE code = ?').get('4100');

    const entry = accountingService.createJournalEntry({
        date: new Date().toISOString(),
        description: 'Balanced entry',
        source_type: 'MANUAL',
        source_id: null,
        lines: [
            { account_id: cash.id, debit: 100, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 100 }
        ]
    });

    accountingService.postEntry(entry.id);
    const posted = db.prepare('SELECT posted, posted_at FROM journal_entries WHERE id = ?').get(entry.id);
    assert.equal(posted.posted, 1);
    assert.ok(posted.posted_at);

    const reversal = accountingService.reverseEntry(entry.id);
    const reversalRow = db.prepare('SELECT posted, reversed_of FROM journal_entries WHERE id = ?').get(reversal.id);
    assert.equal(reversalRow.posted, 1);
    assert.equal(reversalRow.reversed_of, entry.id);

    db.close();
});

test('posted journals are immutable', () => {
    const { db, accountingService } = createDb();
    const cash = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1010');
    const sales = db.prepare('SELECT id FROM accounts WHERE code = ?').get('4100');

    const entry = accountingService.createJournalEntry({
        date: new Date().toISOString(),
        description: 'Immutable entry',
        source_type: 'MANUAL',
        source_id: null,
        lines: [
            { account_id: cash.id, debit: 10, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 10 }
        ]
    });
    accountingService.postEntry(entry.id);

    assert.throws(() => {
        accountingService.updateJournalEntry(entry.id, {
            date: new Date().toISOString(),
            description: 'Changed',
            lines: [
                { account_id: cash.id, debit: 20, credit: 0 },
                { account_id: sales.id, debit: 0, credit: 20 }
            ]
        });
    }, /cannot be edited/i);

    db.close();
});
