import Database, { Database as DatabaseType } from 'better-sqlite3';
import { getDB } from '../database';
import { AuditService } from './audit';
import crypto from 'crypto';

export interface AIInsight {
    id: string;
    type: 'ANOMALY' | 'CLASSIFICATION' | 'FORECAST';
    status: 'PENDING' | 'APPLIED' | 'DISMISSED';
    sourceType: string;
    sourceId: string;
    title: string;
    explanation: string;
    suggestedData?: any;
    createdAt: string;
}

export class InsightService {
    private db: DatabaseType;

    constructor(db: DatabaseType) {
        this.db = db;
    }

    // Heuristics: Cost Anomaly Detection
    async checkCostAnomaly(productId: number, newCost: number) {
        const product = this.db.prepare('SELECT name, cost FROM products WHERE id = ?').get(productId) as any;
        if (!product || product.cost === 0) return;

        const variance = Math.abs((newCost - product.cost) / product.cost);
        if (variance > 0.2) { // 20% variance threshold
            const id = crypto.randomUUID();
            this.db.prepare(`
                INSERT INTO ai_insights (id, type, status, source_type, source_id, title, explanation, suggested_data)
                VALUES (?, 'ANOMALY', 'PENDING', 'product', ?, ?, ?, ?)
            `).run(
                id,
                productId.toString(),
                `Cost Anomaly: ${product.name}`,
                `Significant cost variance detected (${(variance * 100).toFixed(1)}%). Previous: ${product.cost}, New: ${newCost}.`,
                JSON.stringify({ oldCost: product.cost, newCost: newCost })
            );
        }
    }

    // Heuristics: Account Classification Suggestion
    async suggestAccountClassification(accountName: string, accountId: number) {
        let suggestedType = '';
        const lowerName = accountName.toLowerCase();

        if (lowerName.includes('bank') || lowerName.includes('cash')) suggestedType = 'ASSET';
        else if (lowerName.includes('payable') || lowerName.includes('loan')) suggestedType = 'LIABILITY';
        else if (lowerName.includes('sales') || lowerName.includes('revenue')) suggestedType = 'REVENUE';
        else if (lowerName.includes('expense') || lowerName.includes('rent') || lowerName.includes('salary')) suggestedType = 'EXPENSE';

        if (suggestedType) {
            const id = crypto.randomUUID();
            this.db.prepare(`
                INSERT INTO ai_insights (id, type, status, source_type, source_id, title, explanation, suggested_data)
                VALUES (?, 'CLASSIFICATION', 'PENDING', 'account', ?, ?, ?, ?)
            `).run(
                id,
                accountId.toString(),
                'Account Classification Suggestion',
                `Based on the name "${accountName}", this account seems to be of type ${suggestedType}.`,
                JSON.stringify({ type: suggestedType })
            );
        }
    }

    getPendingInsights() {
        return this.db.prepare("SELECT * FROM ai_insights WHERE status = 'PENDING'").all();
    }

    async applyInsight(insightId: string, userId: number) {
        const insight = this.db.prepare('SELECT * FROM ai_insights WHERE id = ?').get(insightId) as any;
        if (!insight || insight.status !== 'PENDING') throw new Error('Insight not found or already processed');

        const suggestedData = JSON.parse(insight.suggested_data || '{}');

        this.db.transaction(() => {
            if (insight.type === 'CLASSIFICATION' && insight.source_type === 'account') {
                this.db.prepare('UPDATE accounts SET type = ? WHERE id = ?').run(suggestedData.type, insight.source_id);
            } else if (insight.type === 'ANOMALY' && insight.source_type === 'product') {
                // For anomaly, "applying" might mean accepting the new cost as baseline
                this.db.prepare('UPDATE products SET cost = ? WHERE id = ?').run(suggestedData.newCost, insight.source_id);
            }

            this.db.prepare(`
                UPDATE ai_insights 
                SET status = 'APPLIED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? 
                WHERE id = ?
            `).run(userId, insightId);

            AuditService.log({
                userId,
                action: 'AI_INSIGHT.APPLY',
                details: { insightId, type: insight.type, sourceId: insight.source_id }
            });
        })();
    }

    async dismissInsight(insightId: string, userId: number) {
        this.db.prepare(`
            UPDATE ai_insights 
            SET status = 'DISMISSED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? 
            WHERE id = ?
        `).run(userId, insightId);

        AuditService.log({
            userId,
            action: 'AI_INSIGHT.DISMISS',
            details: { insightId }
        });
    }
}
