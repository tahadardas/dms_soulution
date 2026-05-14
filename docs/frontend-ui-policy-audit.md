# Frontend UI & Policy Audit Report - DMS SOULUTION

## 1. Routes Issues
- **Duplication**: `App.tsx` contains a manual list of `<Route />` elements that repeats information already present (partially) in `routes.ts`.
- **Inconsistency**: Title keys and permissions are defined in `routes.ts` but sometimes applied differently or manually in `App.tsx`.
- **Lazy Loading**: Not currently implemented. All pages are imported eagerly in `App.tsx`, leading to larger initial bundle size.
- **Priority**: High.

## 2. Permissions Issues
- **Mismatch**: `DELIVERY_COURIER_VIEW` in `apps/web` is `'DLV.CourierView'`, but in `apps/api` it's `'DELIVERY_COURIER_VIEW'`.
- **Fragmentation**: Permissions are defined in two separate files (`apps/web/src/lib/permissions.ts` and `apps/api/src/config/permissions.ts`).
- **Priority**: Critical.

## 3. Forms Issues
- **Utility Classes**: Use of non-existent Tailwind classes like `grid-cols-4`, `gap-4` in `PurchaseInvoiceFormPage` and `SalesInvoiceFormPage`.
- **Validation**: Weak client-side validation. Allows `product_id = 0` or empty lines in current state.
- **Tightly Coupled**: Invoice logic is repeated across two pages.
- **Priority**: High.

## 4. POS UX Issues
- **God Component**: `POSPage.tsx` is >1000 lines and handles products, categories, stats, sessions, returns, and cash movements in one file.
- **State Management**: Branch handling is inconsistent (`user.branch_id || 1`).
- **Idempotency**: Lack of `idempotencyKey` for order submissions.
- **Error Feedback**: Hardcoded Arabic/English strings in some places.
- **Priority**: High.

## 5. RTL/i18n Issues
- **Hardcoding**: `QUICK_NOTES` and some error messages are hardcoded.
- **Directionality**: `html lang` and `dir` management is basic.
- **Priority**: Medium.

## 6. Design System Issues
- **Missing Components**: No `SearchableSelect`, `MoneyInput`, `LoadingState`, or `EmptyState` in `packages/ui`.
- **Utility Gap**: No standard way to handle layouts (grid/flex) since Tailwind is missing.
- **Priority**: Medium.

## 7. Error Handling Issues
- **Production Alerts**: Use of `alert()` for errors.
- **Silent Failures**: `catch { // Silent fallback }` in some places.
- **No Global Boundary**: Missing a global ErrorBoundary to catch rendering crashes.
- **Priority**: High.

## 8. Accessibility Issues
- **Semantic HTML**: Some buttons are just `div` or missing `type="button"`.
- **Focus Management**: Missing focus traps in Modals.
- **Priority**: Low.

## 9. Maintainability Issues
- **Repetitive Logic**: Invoice forms are nearly identical.
- **Permission Sync**: Manual sync required between web and api.
- **Priority**: High.

---

## Action Plan & Priorities

| Priority | Task | Acceptance Criteria |
| :--- | :--- | :--- |
| **Critical** | Unify Permissions | `packages/shared` contains single source of truth. |
| **High** | Route Centralization | `App.tsx` generates routes from `routes.ts`. Lazy loading active. |
| **High** | Invoice Refactor | `InvoiceEditor` shared component. Full validation. |
| **High** | POS Modularization | Logic moved to hooks. Improved session/branch safety. |
| **High** | Error Handling | `ErrorBoundary` + Toast replaces all `alert()`. |
| **Medium** | Form System | New components in `packages/ui`. Utility CSS fixed. |
| **Medium** | RTL/i18n Polish | Zero hardcoded strings. Dynamic `dir`. |
| **Low** | Accessibility | Keyboard navigation in POS. ARIA labels. |
