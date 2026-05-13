import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0013',
    name: 'pos_session_close_policy_defaults',
    up(db: Database): void {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'pos'").get() as { value?: string } | undefined;
        if (!row) {
            return;
        }
        const current = row?.value ? JSON.parse(row.value) : {};
        const next = {
            ...current,
            requireReasonForCashDifference: current.requireReasonForCashDifference ?? true,
            cashDifferenceRequiresManager: current.cashDifferenceRequiresManager ?? true,
            managerRequiredCashDifferenceAmount: current.managerRequiredCashDifferenceAmount ?? 25,
            allowCloseSessionWithPendingDelivery: current.allowCloseSessionWithPendingDelivery ?? true,
            pendingDeliveryCloseRequiresManager: current.pendingDeliveryCloseRequiresManager ?? false,
            requireReasonForVoid: current.requireReasonForVoid ?? true,
            managerRequiredVoidAfterPayment: current.managerRequiredVoidAfterPayment ?? true,
            managerRequiredReprint: current.managerRequiredReprint ?? true
        };

        db.prepare(`
            INSERT INTO settings (key, value)
            VALUES ('pos', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `).run(JSON.stringify(next));
    }
};
