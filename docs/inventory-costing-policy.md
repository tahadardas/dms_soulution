# Inventory Costing Policy

## Current Production Policy

DMS SOULUTION currently supports Weighted Average Cost (WAC) only.

FIFO is intentionally disabled. The system must not silently use WAC when FIFO is selected. If a user or setting attempts to enable FIFO, the API rejects it until real FIFO inventory layers are implemented.

## WAC Rules

- Purchases increase stock quantity and recalculate average cost.
- Sales decrease stock quantity and use current average cost as COGS.
- Returns restore stock at the original or supplied unit cost.
- Transfers create an OUT movement from the source branch and an IN movement to the destination branch.
- Negative stock is blocked unless explicitly allowed by settings.
- Every movement must include product, branch, signed quantity, unit cost, source type, reference id, and actor where available.

## Required Movement Fields

- `product_id`
- `branch_id`
- signed `quantity`
- `unit_cost`
- `reference_id`
- `source_type`
- `created_by`
- `entered_unit_id`, when entered unit differs from base unit
- `entered_quantity`
- `base_quantity`

## Valuation Reports

Inventory valuation must be calculated by date and branch using historical movements. It must reconcile to the inventory control account when all inventory-affecting documents are posted.

Required reports:

- Inventory Valuation by date
- Inventory Movement Card
- Stock by Branch
- Low Stock Alerts
- Product Profitability

## FIFO Future Design

FIFO must not be enabled until these structures exist:

- `inventory_layers`
- layer quantity received
- layer quantity remaining
- layer unit cost
- source document link
- branch and product keys
- deterministic consumption order

FIFO sale/issue logic must consume oldest open layers and record layer consumption details for audit and rebuild.
