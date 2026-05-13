import Database, { Database as DatabaseType } from 'better-sqlite3';
import { AccountingSettingsSchema, CostingSettingsSchema, InventorySettingsSchema, POSSettingsSchema, PrintingSettingsSchema, ThemeSettingsSchema } from '@dms/shared/src/schemas/settings';

export class SettingsService {
    private db: DatabaseType;

    constructor(db: DatabaseType) {
        this.db = db;
    }

    /**
     * Get settings for a specific category or the whole system.
     */
    getSettings(category: string = 'all'): any {
        if (category === 'all') {
            const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
            const settings: any = {};
            rows.forEach(row => {
                settings[row.key] = JSON.parse(row.value);
            });
            return settings;
        } else {
            const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(category) as { value: string } | undefined;
            return row ? JSON.parse(row.value) : null;
        }
    }

    /**
     * Update settings for a category, tracking version and history.
     */
    updateSettings(category: string, data: any, userId: number): void {
        // Validate if category is valid
        const validCategories = ['accounting', 'costing', 'inventory', 'pos', 'printing', 'theme'];
        if (!validCategories.includes(category)) {
            throw new Error(`Invalid settings category: ${category}`);
        }

        const schemaMap: Record<string, any> = {
            accounting: AccountingSettingsSchema,
            costing: CostingSettingsSchema,
            inventory: InventorySettingsSchema,
            pos: POSSettingsSchema,
            printing: PrintingSettingsSchema,
            theme: ThemeSettingsSchema
        };

        const normalizedInput = { ...(data || {}) };

        if (category === 'accounting') {
            if (normalizedInput.fiscalYearStartMonth == null && normalizedInput.fiscalPeriodStartMonth != null) {
                normalizedInput.fiscalYearStartMonth = normalizedInput.fiscalPeriodStartMonth;
            }
            if (normalizedInput.currencyCode) {
                normalizedInput.currencyCode = String(normalizedInput.currencyCode).toUpperCase();
            }
        }
        if (category === 'costing') {
            const allowedMethods = ['DIRECT', 'STEP_DOWN', 'RECIPROCAL'];
            if (normalizedInput.defaultAllocationMethod && !allowedMethods.includes(normalizedInput.defaultAllocationMethod)) {
                normalizedInput.defaultAllocationMethod = 'DIRECT';
            }
        }
        if (category === 'inventory') {
            const allowedMethods = ['WAC', 'FIFO'];
            if (normalizedInput.valuationMethod && !allowedMethods.includes(normalizedInput.valuationMethod)) {
                normalizedInput.valuationMethod = 'WAC';
            }
        }
        if (category === 'pos') {
            if (normalizedInput.returnWindowMinutes == null && normalizedInput.refundWindowMinutes != null) {
                normalizedInput.returnWindowMinutes = normalizedInput.refundWindowMinutes;
            }
        }
        if (category === 'theme') {
            if (!normalizedInput.accentColor && normalizedInput.primaryColor) {
                normalizedInput.accentColor = normalizedInput.primaryColor;
            }
        }

        const schema = schemaMap[category];
        const parsed = schema.safeParse(normalizedInput);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            const path = issue?.path?.length ? issue.path.join('.') : 'settings';
            throw new Error(`Invalid ${category} settings: ${path} ${issue.message}`);
        }
        const normalized = parsed.data;

        const current = this.db.prepare('SELECT value, version FROM settings WHERE key = ?').get(category) as { value: string, version: number } | undefined;
        const newVersion = (current?.version || 0) + 1;
        const valueJson = JSON.stringify(normalized);

        const transaction = this.db.transaction(() => {
            // Update current settings
            this.db.prepare(`
                INSERT INTO settings (key, value, version, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    version = excluded.version,
                    updated_at = excluded.updated_at
            `).run(category, valueJson, newVersion);

            // Record history
            this.db.prepare(`
                INSERT INTO settings_history (key, value, version, changed_by)
                VALUES (?, ?, ?, ?)
            `).run(category, valueJson, newVersion, userId);
        });

        transaction();
    }

    /**
     * Get history of changes for a category.
     */
    getHistory(category: string) {
        return this.db.prepare(`
            SELECT sh.*, u.username as changed_by_name
            FROM settings_history sh
            LEFT JOIN users u ON sh.changed_by = u.id
            WHERE sh.key = ?
            ORDER BY sh.version DESC
        `).all(category);
    }
}
