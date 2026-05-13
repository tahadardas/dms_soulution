# Inventory & Costing Rules

- Inventory movements are immutable events.
- Stock on hand derived from movements (or cached with reconciliation).
- Costing method configurable per company:
  FIFO or Weighted Average (set once per fiscal period unless migration tool).
- COGS computed on sale posting, not in UI.
- Recipe/Ingredients for restaurant items must deduct raw materials stock.
