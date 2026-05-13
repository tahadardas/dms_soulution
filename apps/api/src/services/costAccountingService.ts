import {
    CostCenter,
    AllocationRule,
    ProductUnitCost,
    CostKPIs,
    CostType,
    CostCenterTypeSchema, // Note: Enum schema isn't a value, but types are useful. Importing value if needed or just typing.
    AllocationMethodSchema
} from '@dms/shared';

// In-memory store for demo. In real app, use DB.
export class CostAccountingService {
    private costCenters: CostCenter[] = [];
    private rules: AllocationRule[] = [];
    private productCosts: Map<string, ProductUnitCost[]> = new Map(); // ProductId -> Costs

    constructor() {
        // Seed some data
        this.costCenters = [
            { id: 'cc-1', name: 'Kitchen', code: 'KIT', type: 'COST' },
            { id: 'cc-2', name: 'Delivery', code: 'DEL', type: 'COST' },
            { id: 'cc-3', name: 'Admin', code: 'ADM', type: 'COST' },
            { id: 'cc-4', name: 'Dining', code: 'DIN', type: 'PROFIT' },
        ];
    }

    // --- Cost Centers ---
    getCostCenters() {
        return this.costCenters;
    }

    addCostCenter(center: CostCenter) {
        this.costCenters.push(center);
        return center;
    }

    // --- Allocation Rules ---
    getRules() {
        return this.rules;
    }

    addRule(rule: AllocationRule) {
        this.rules.push(rule);
        return rule;
    }

    // --- Logic: Run Allocation ---
    // This is a simplified simulation. 
    // Real implementation involves fetching GL balances filtered by Cost Center and Date Range.
    async runAllocation(period: string, totalIndirectCosts: number, salesData: any[]): Promise<any> {
        // 1. Identify Indirect Costs to allocate (e.g., Admin Rent, Utilities)
        // Assume totalIndirectCosts is passed for now.

        // 2. Identify Targets (Cost Centers or Products) based on Rules
        const allocationResults = [];

        // Example: Allocate Admin costs to Kitchen and Dining based on 50/50 rule if exists, else Default.
        // For this prompt, let's implement the specific logic:
        // Rule: % / Activity / Sales / Units.

        for (const rule of this.rules) {
            if (!rule.isActive) continue;

            let allocatedAmount = 0;

            // Logic for different methods
            if (rule.method === 'PERCENTAGE') {
                // Simple % of the source pool. 
                // Needs Context: What is the Source Pool Amount? 
                // In a real engine, we'd query: select sum(amount) from GL where costCenter = rule.sourceCostCenterId
                const sourcePoolAmount = 10000; // MOCK
                const factor = rule.factor ?? 0;
                allocatedAmount = sourcePoolAmount * (factor / 100);
            } else if (rule.method === 'SALES') {
                // Allocate based on revenue share of the target
                // specific logic omitted for brevity in mock
                allocatedAmount = 500;
            }

            allocationResults.push({
                ruleId: rule.id,
                targetId: rule.targetCostCenterId || rule.targetProductCategoryId,
                amount: allocatedAmount,
                method: rule.method
            });
        }

        return allocationResults;
    }

    // --- KPIs: Unit Cost & Margins ---
    calculateUnitCost(productId: string, period: string,
        directMaterial: number, directLabor: number, allocatedOverhead: number): ProductUnitCost {

        const total = directMaterial + directLabor + allocatedOverhead;
        const result: ProductUnitCost = {
            productId,
            productName: 'Unknown', // fetch name
            period,
            materialCost: directMaterial,
            laborCost: directLabor,
            overheadCost: allocatedOverhead,
            totalUnitCost: total
        };

        // Store
        if (!this.productCosts.has(productId)) {
            this.productCosts.set(productId, []);
        }
        this.productCosts.get(productId)?.push(result);

        return result;
    }

    getKPIs(period: string): CostKPIs {
        // Mock Aggregation
        return {
            period,
            grossMargin: 50000,
            netMargin: 12000,
            grossMarginPercent: 0.65,
            netMarginPercent: 0.15,
            totalFixedCost: 20000,
            totalVariableCost: 15000,
            breakevenPoint: 25000
        };
    }
}
