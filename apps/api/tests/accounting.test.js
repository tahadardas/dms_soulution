const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { AccountingService } = require('../src/services/accountingService');

const createDb = () => {
    const db = initDB();
    return { db, service: new AccountingService(db) };
};

test('unbalanced draft requires a reason and cannot be posted', () => {
    const { db, service } = createDb();
    const cash = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const sales = db.prepare("SELECT id FROM accounts WHERE code = '4100'").get();

    assert.throws(() => service.createJournalEntry({
        date: '2026-01-01',
        description: 'Missing reason',
        source_type: 'MANUAL',
        source_id: null,
        lines: [
            { account_id: cash.id, debit: 100, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 90 }
        ]
    }, { allowUnbalanced: true }), /reason/i);

    const draft = service.createJournalEntry({
        date: '2026-01-01',
        description: 'Document under review',
        source_type: 'MANUAL',
        source_id: null,
        lines: [
            { account_id: cash.id, debit: 100, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 90 }
        ]
    }, { allowUnbalanced: true, unbalancedReason: 'Awaiting supplier rounding correction' });

    assert.throws(() => service.postEntry(draft.id), /not balanced/i);
    db.close();
});

test('duplicate posted source documents are blocked', () => {
    const { db, service } = createDb();
    const cash = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const sales = db.prepare("SELECT id FROM accounts WHERE code = '4100'").get();
    const makeEntry = () => service.createJournalEntry({
        date: '2026-01-01',
        description: 'Sales source',
        source_type: 'SALES_INVOICE',
        source_id: 'INV-1',
        lines: [
            { account_id: cash.id, debit: 50, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 50 }
        ]
    });

    const entry = makeEntry();
    service.postEntry(entry.id);
    assert.throws(() => makeEntry(), /already been posted/i);
    db.close();
});

test('trial balance exposes debit and credit balances and remains balanced', () => {
    const { db, service } = createDb();
    const cash = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const sales = db.prepare("SELECT id FROM accounts WHERE code = '4100'").get();
    const entry = service.createJournalEntry({
        date: '2026-01-01',
        description: 'Balanced sale',
        source_type: 'MANUAL',
        source_id: null,
        lines: [
            { account_id: cash.id, debit: 75, credit: 0 },
            { account_id: sales.id, debit: 0, credit: 75 }
        ]
    });
    service.postEntry(entry.id);

    const trial = service.getTrialBalance();
    assert.equal(Math.round(trial.totals.total_debit), Math.round(trial.totals.total_credit));
    assert.ok(trial.items.some(row => row.code === '1010' && row.normal_side === 'DEBIT' && row.debit_balance === 75));
    assert.ok(trial.items.some(row => row.code === '4100' && row.normal_side === 'CREDIT' && row.credit_balance === 75));
    db.close();
});
