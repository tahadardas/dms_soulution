# Production Readiness Checklist

## Verification Commands

- `npm run typecheck`
- `npm run build`
- `npm run test --workspace=@dms/api`

All commands must pass before release.

## Security

- `JWT_SECRET` is set and not the development default.
- `REFRESH_SECRET` is set and not the development default.
- `DMS_CORS_ORIGINS` is explicit in production and does not contain `*`.
- No production database contains `admin/admin123`.
- Default admin must change password on first login.
- Login rate limiting and account lockout are enabled.
- Users are assigned least-privilege roles.

## Accounting

- No double posting for `source_type + source_id`.
- Posted journals and posted documents are immutable.
- Reversal requires reason and actor.
- Trial balance total debit equals total credit.
- Ledger opening balance is accurate before the report start date.
- Customer and supplier statements reconcile to ledger.
- Payment allocations reconcile to invoices and advances.

## Inventory

- FIFO is disabled unless true layer costing is implemented.
- Every inventory movement has a reference id and source type.
- Negative stock policy is explicit.
- Rebuild stock snapshot passes integrity checks.
- Inventory valuation reconciles to inventory control.

## Documents

- Every financial document has a `documents` row.
- Every document type has a configured family.
- Posting rules are documented and active.
- Reverse documents are linked to originals.
- Source document links are present for payments, returns, and generated documents.

## Multi-Branch

- Branch id is present on operational documents.
- Reports support branch filters.
- POS sessions are branch-scoped.
- Inventory stock is branch-scoped.

## Multi-Currency

- Base currency is configured.
- SYP and USD exist in `currencies`.
- Exchange rates are maintained.
- Base amounts are stored for journals and documents.
- Realized FX gain/loss is tested before enabling foreign currency payments in production.

## Backup And Restore

- Backup scheduler is enabled.
- Restore tool is tested on a non-production copy.
- DB integrity checker is run before release and after restore.
- Backup retention policy is documented.

## Desktop Packaging

- Windows package is smoke-tested.
- API, web assets, and database path configuration are verified.
- Version screen displays app version and build date.
- Changelog is updated for the release.

## UI

- Arabic and English language switching works.
- RTL and LTR layouts are tested.
- Dark and light themes are tested.
- POS screen remains fast under realistic item counts.
- Print templates hide UI controls and support Arabic RTL.
