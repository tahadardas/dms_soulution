# Phase Final Gate — Pre-Implementation Audit

**Date**: 2026-05-09  
**Status**: Audit Complete — Ready for Implementation

---

## 1. USB Printing — Current State

| Component | Status | Details |
|---|---|---|
| `printers` table columns | ✅ Exist | `windows_printer_name`, `device_id`, `paper_width`, `display_name`, `last_seen_at` — added by migration `0015` |
| `workstations` table | ✅ Exists | Created by migration `0015` with `id`, `name`, `device_key` (UNIQUE), `branch_id`, `is_active`, `last_seen_at`, `created_at` |
| `print_jobs` columns | ✅ Exist | `attempts`, `device_id`, `locked_by`, `locked_at`, `processed_at`, `error_message`, `retry_count` — all added by `0015` |
| Printer types | ✅ Supported | `NETWORK`, `USB`, `WINDOWS`, `PDF` — used in UI and service |
| Status constants | ✅ Defined | `PENDING`, `LOCKED`, `PRINTING`, `SUCCESS`, `FAILED`, `CANCELLED` — defined in `PrintingService` |
| API: register workstation | ✅ `POST /printing/workstations/register` | Implemented in service and routes |
| API: heartbeat | ✅ `POST /printing/workstations/:deviceKey/heartbeat` | Implemented |
| API: pending-local jobs | ✅ `GET /printing/jobs/pending-local?deviceKey=X` | Filters by `PENDING`, `USB`/`WINDOWS`, `device_id` match |
| API: lock job | ✅ `POST /printing/jobs/:id/lock` | Validates PENDING, validates device_id match |
| API: complete job | ✅ `POST /printing/jobs/:id/complete` | Validates locked_by match |
| API: fail job | ✅ `POST /printing/jobs/:id/fail` | Validates locked_by match, stores error_message |
| API: test print | ✅ `POST /printing/printers/:id/test` | Creates print_job; only auto-processes NETWORK |
| Desktop Agent: workstation register | ✅ Implemented | `registerAndHeartbeat()` in `main.ts` |
| Desktop Agent: poll jobs | ✅ Implemented | `pollPrintJobs()` locks, prints, completes/fails |
| Desktop Agent: Windows printing | ✅ Implemented | `printJobOnWindowsPrinter()` uses `webContents.print()` |
| Desktop Agent: IPC handlers | ✅ All present | `printers:list`, `printers:printHtml`, `printers:printText`, `device:getInfo`, `device:setKey`, `printJobs:startPolling`, `printJobs:stopPolling` |
| Preload bridge | ✅ Complete | All IPC channels exposed via `contextBridge` |
| PrintersPage UI | ⚠️ Partial | Shows system printers, but printer form **does not expose** `windows_printer_name`, `device_id`, or `paper_width` fields. The "Add Printer" form only shows network fields. |

### USB Printing Gaps

1. **Printers page form** — Missing fields for `windows_printer_name`, `device_id`, `paper_width` when type is USB/WINDOWS. User cannot link a system printer to the DB.
2. **Auto-register USB printer** — No "Quick Setup" button to copy a system printer directly into the `printers` table with the correct `device_id` set from the current workstation's device key.
3. **Test Print via print_job** — `testPrinter` creates a job but does not poll for status feedback in the UI. Needs status polling or a message about waiting.
4. **`failLocalJob`** does not increment `attempts` — it only sets `error_message`. Should also increment `attempts`.

---

## 2. Desktop Agent — Does it Read `print_jobs`?

**Yes.** The Electron Desktop Agent (`apps/desktop/src/main.ts`):
- Registers workstation on polling start
- Polls `GET /printing/jobs/pending-local?deviceKey=X`
- Locks → Prints → Completes/Fails for each job
- Polling is started via `printJobs:startPolling` IPC

**Gap**: Polling must be started explicitly from the frontend. It is not auto-started on app launch.

---

## 3. Does the Printers Page Link `windows_printer_name` and `device_id`?

**No.** The create/edit modal only shows: name, branch, type, target, ip_address, port, enabled toggle.  
There are no input fields for `windows_printer_name`, `device_id`, or `paper_width`.

---

## 4. Manager Approval — Current Implementation

**File**: `apps/api/src/services/policy.service.ts`, method `requireManagerApproval()`

### Current behavior:
1. ✅ Validates username + password with bcrypt
2. ⚠️ Checks permissions but **does NOT enforce** — the code queries `role_permissions` and checks for `POS.Void`, `POS.Discount`, or `ALL_ACCESS`, but the result `hasManagerPerm` is **never used to reject the request**. It is a comment: "If not checking strictly yet, at least log it."
3. ✅ Inserts into `manager_approvals`
4. ❌ **Does not accept a `requiredPermission` parameter** — all calls pass generic action strings but no specific permission is validated
5. ❌ **Does not check if the manager is active** (no `is_active` column checked)
6. ❌ **Does not prevent self-approval** — the `requestedBy` user can authenticate as manager and approve their own action

### Manager Approval Callers:
- `validateCloseSession()` — action `CLOSE_SESSION_CASH_DIFF` / `CLOSE_SESSION_PENDING_DELIVERY`
- `validateReturn()` — action `RETURN_ORDER`
- `validateVoid()` — action `VOID_ORDER`
- `validateDiscount()` — action `APPLY_DISCOUNT`
- `validateReprint()` — action `REPRINT_RECEIPT`

---

## 5. Is Manager Permission Actually Enforced?

**No.** Any user with a valid username/password can approve. The `hasManagerPerm` variable is computed but never used for rejection.

---

## 6. Inventory Movement Report Parameter Bug Location

**File**: `apps/api/src/services/reportingService.ts`

### Method: `getInventoryMovementTransactions()` (line 514-536)

**SQL**:
```sql
WHERE m.date BETWEEN ? AND ?
  ${filterClause}    -- AND m.product_id = ? OR AND m.type = ?
  ${branchClause}    -- AND m.branch_id = ?
```

**Params built**:
```js
const params: any[] = [startDate, endDate];
if (filters.branchId) params.push(filters.branchId);  // position 3
// ...
.all(...params, filters.key);  // key appended at end
```

**Actual order passed**: `[startDate, endDate, branchId?, key]`  
**SQL expects**: `[startDate, endDate, key, branchId?]`

**The `filterClause` comes before `branchClause` in SQL, but `branchId` is pushed into `params` before `key`.** This is a **parameter mismatch bug** — when `branchId` is set, the `filterClause` placeholder receives `branchId` instead of `key`, and `branchClause` placeholder receives `key` instead of `branchId`.

---

## 7. Build/Test Commands Available

| Command | Exists |
|---|---|
| `npm run build --workspace=@dms/shared` | ✅ (packages/shared) |
| `npm run build --workspace=@dms/ui` | ✅ (packages/ui) |
| `npm run build --workspace=@dms/api` | ✅ (`tsc`) |
| `npm run build --workspace=@dms/web` | ✅ (`tsc && vite build`) |
| `npm run build --workspace=@dms/desktop` | ✅ (`tsc`) |
| `npm run build` (root) | ✅ (sequential all) |
| `npm run test --workspace=@dms/api` | ✅ (`node --test`) |
| `npm run db:verify --workspace=@dms/api` | ✅ |
| `npm run test --workspace=@dms/web` | ❌ Not defined |
| `npm run test --workspace=@dms/desktop` | ❌ Not defined |

---

## 8. Remaining Risks

1. **PrintersPage form gap** — Critical for USB flow. Must add USB/Windows fields.
2. **Manager Approval not enforced** — Any authenticated user can approve. Critical security gap.
3. **Inventory report param mismatch** — Will return wrong data or SQL error when `branchId` is used with groupBy.
4. **Print job polling auto-start** — Not triggered on Electron app start; requires explicit call from UI.
5. **`failLocalJob` doesn't increment `attempts`** — May prevent retry logic from working correctly.
