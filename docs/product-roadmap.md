# DMS SOULUTION Production Roadmap

This roadmap moves DMS SOULUTION toward a production-grade multi-branch restaurant and retail platform. The implementation must remain phased: each phase should ship with migrations, tests, accounting rules, inventory integrity checks, and UI coverage before the next phase starts.

## Current Baseline

- Monorepo: Fastify API, React web app, Electron desktop shell, shared Zod schemas, shared UI package.
- Database: SQLite through `better-sqlite3`.
- Accounting: double-entry journal, posting guards, reversal flow, trial balance and ledger reports.
- Inventory: Weighted Average Cost only. FIFO is explicitly rejected until real layers exist.
- Security: production blocks default JWT secrets, open CORS, and default admin credentials.
- Phase 1 foundation is started with `document_families`, `document_types`, `document_sequences`, `document_posting_rules`, `documents`, and `source_document_links`.

## Phase 1: Unified Document Model

Status: foundation implemented.

Delivered:

- Central document metadata tables.
- Source links between documents.
- Document type registry for POS orders, invoices, returns, payments, cash movements, inventory adjustments, and transfers.
- Posting rule registry.
- Shared document schemas.
- API read routes for document types, document lookup, and sequence preview.
- Initial synchronization for purchase invoices, sales invoices, customer receipts, supplier payments, POS orders, and cash movements.

Acceptance criteria:

- Every new financial document has a unified `documents` row.
- Posted documents cannot be double-posted.
- Reversal must create a linked reverse document or linked reverse journal.
- Existing source endpoints remain stable.

## Phase 2: Real Multi-Currency

Next implementation target.

Scope:

- Maintain `currencies` and `exchange_rates`.
- Capture document currency, base currency, exchange rate, foreign amounts, and base amounts.
- Extend journal lines to store foreign and base debit/credit amounts.
- Add realized FX gain/loss when payments are allocated against invoices at different rates.
- Keep reports in base currency while preserving original currency amounts.

Acceptance criteria:

- SYP and USD work from a fresh database.
- Every posted journal line has base amounts.
- Payment allocation against a foreign invoice calculates realized FX gain/loss.
- Trial balance and ledger remain balanced in base currency.

## Phase 3: Payment Allocation

Scope:

- Implement allocation workflows for customer receipts and supplier payments.
- Support partial payment, advance payment, unapplied amount, and multi-invoice settlement.
- Add customer and supplier aging reports.
- Treat unapplied receipts/payments as advances until allocated.

Acceptance criteria:

- One receipt/payment can settle multiple invoices.
- Invoice payment status is derived from allocations, not a manually maintained number.
- Statements show opening balance, invoices, payments, returns, advances, unapplied amount, and closing balance.
- Aging reports reconcile to receivable/payable ledgers.

## Phase 4: Returns, Credit Notes, Debit Notes

Scope:

- Add first-class sales return, purchase return, credit note, and debit note entities.
- Prohibit direct deletion or mutation of posted invoice impact.
- Use reverse documents and reverse journal entries.

Acceptance criteria:

- Posted invoices are immutable.
- Return/credit/debit documents carry their own status, number, branch, currency, journal entry, and links to the original document.
- Inventory and accounting effects are reversed through explicit documents only.

## Phase 5: Inventory Valuation

Scope:

- Continue WAC as the production costing policy unless FIFO layers are built.
- Expand inventory valuation by date, movement card, stock by branch, low stock alerts, and product profitability.
- If FIFO is selected later, add `inventory_layers` and consume layers in issue order.

Acceptance criteria:

- Valuation reconciles to inventory control account under WAC.
- Every movement has product, branch, signed quantity, unit cost, source type, reference id, and actor.
- Rebuild snapshot detects movement/stock inconsistencies.

## Phase 6: Delivery Couriers Dashboard

Scope:

- Courier CRUD and autocomplete.
- Save courier from delivery order.
- One-time courier support.
- Daily courier dashboard: order count, order totals, collected amount, commission, paid, remaining.
- Commission posting: Dr Delivery Commission Expense, Cr Courier Payable.

Acceptance criteria:

- Delivery orders can reference saved or one-time couriers.
- Commission payable reconciles to courier dashboard.
- Commission payment clears courier payable through a posted document.

## Phase 7: Professional Web UI

Scope:

- True RTL/LTR switching.
- Arabic and English i18n coverage.
- Dark/light mode.
- Fast POS screen.
- Accounting reports, customer/supplier statements, chart of accounts tree, posting settings, printer settings, and Z Report screens.
- Shared UI components from `packages/ui`.

Acceptance criteria:

- No duplicated screen-level primitives where shared components are available.
- Arabic layout works without broken RTL.
- Main operational flows remain keyboard/touch friendly.

## Phase 8: Printing Templates

Scope:

- Receipt, KOT, sales invoice, purchase invoice, customer statement, supplier statement, and Z Report templates.
- Arabic RTL, company logo, branch info, QR support where needed, print-only CSS, and printer route mapping.

Acceptance criteria:

- Templates render without UI buttons in print output.
- Printer routing is branch-aware and document-type aware.
- Arabic text and numbers remain readable.

## Phase 9: Management Dashboard

Scope:

- Sales today, gross profit, COGS, cash expected/actual, top products, low stock, unpaid invoices, supplier dues, and delivery performance.

Acceptance criteria:

- Dashboard numbers reconcile to source reports and ledger.
- No raw hidden recalculation that disagrees with accounting reports.

## Phase 10: Production Packaging

Scope:

- Production config, backup scheduler, restore tool, DB integrity checker, Windows package verification, version screen, and changelog.

Acceptance criteria:

- Production startup validates secrets and CORS.
- Backup and restore are tested.
- DB integrity check is runnable before and after packaging.
- Release version and changelog are visible from the app.
