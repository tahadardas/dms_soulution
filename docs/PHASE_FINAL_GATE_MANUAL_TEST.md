# DMS SOLUTION — Field Test Manual Verification Plan

Use this document to verify the stabilization fixes in a live environment or during final staging.

---

## Test 1: Manager Approval Security
- **Goal:** Ensure strict permission enforcement and self-approval block.
- **Steps:**
    1. Log in as a `CASHIER` with `POS_ORDER_VOID` permission but NO manager approval permissions.
    2. Try to void a printed order. It should ask for manager approval.
    3. Enter the `CASHIER`'s own credentials. **EXPECTED: FAIL** (Error: "لا يمكن للمستخدم الموافقة على إجراء خاص به").
    4. Enter credentials for a user with `SUPERVISOR` role. **EXPECTED: SUCCESS**.
    5. Verify `audit_logs` table contains the approval entry with `action = 'POS.ORDER_VOID'`.

## Test 2: USB Printer Configuration
- **Goal:** Verify UI fields and workstation mapping.
- **Steps:**
    1. Open the Desktop Application.
    2. Navigate to **Settings > Printers**.
    3. Click **Add Printer**.
    4. Change Type to **USB**.
    5. Verify `Windows Printer Name` dropdown appears with local printers.
    6. Verify `Device ID` field appears. Click "Auto-fill Device ID".
    7. Save the printer.
    8. Verify the printer appears in the list with the correct metadata.

## Test 3: Print Failure & Retry
- **Goal:** Verify retry attempt incrementing.
- **Steps:**
    1. Configure a USB printer with a name that doesn't exist.
    2. Create a POS order and print.
    3. Let the desktop agent attempt to print (it will fail).
    4. Check the `print_jobs` table in the database.
    5. **EXPECTED:** `status = 'FAILED'`, `attempts` should be `1`.
    6. Trigger another attempt (if auto-polling is on). Verify `attempts` increments to `2`.

## Test 4: Inventory Movement Report
- **Goal:** Verify SQL parameter alignment.
- **Steps:**
    1. Ensure there are inventory transactions in at least two different branches.
    2. Go to **Reports > Inventory Movement**.
    3. Select a specific branch.
    4. **EXPECTED:** Report loads successfully without SQL errors and shows only data for that branch.
    5. Select "All Branches".
    6. **EXPECTED:** Report loads successfully showing all data.

---

## Field Acceptance Checklist
- [ ] Manager Approval blocks self-approval?
- [ ] Manager Approval checks for specific permission?
- [ ] USB Printer form shows Windows Printer Name?
- [ ] Device ID auto-fills correctly?
- [ ] Print jobs increment attempts on failure?
- [ ] Inventory Movement report works with branch filter?
- [ ] System builds successfully?
