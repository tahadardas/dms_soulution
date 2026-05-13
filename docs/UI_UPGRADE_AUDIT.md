# UI Upgrade Audit — DMS SOLUTION

**Date:** 2026-05-09
**Status:** Audit Completed

---

## 1. Current Interface Pages
- **POS**: `POSPage.tsx` (Main operational hub)
- **Sessions**: `POSSessionsPage.tsx` (Active sessions list & remote closing)
- **Printers**: `PrintersPage.tsx` (Printer hardware config)
- **Reports**: 
    - `ReportsPage.tsx` (Main reports dashboard)
    - `ReportsSalesPage.tsx` (Sales analytics)
    - `ReportsSessionsZPage.tsx` (Z Report)
    - `ReportsInventoryPage.tsx` (Inventory movements)
- **Inventory**: `InventoryPage.tsx`, `ProductsPage.tsx`, `ProductFormPage.tsx`
- **Accounting**: `AccountsPage.tsx`, `JournalsPage.tsx`, `LedgerPage.tsx`
- **Audit**: (Page currently missing or integrated into other views)

---

## 2. POS Components & Issues
### Components:
- `POSToolbar.tsx`: Quick actions (Save, Print, Kitchen, etc.)
- `CartPanel.tsx`: Order summary and payment.
- `OrderPad`: Product grid and categories (Internal to `POSPage.tsx`).
- `ProductCategoryTabs.tsx`: Category navigation.
- `SalesDrawer.tsx`, `ReturnsDrawer.tsx`, `PendingDeliveryDrawer.tsx`.

### Identified Issues:
- **Header/Footer**: No dedicated Status Bar for device connectivity or printer job status.
- **Save vs Print**: Logical separation exists, but UI doesn't clearly show "Saving..." vs "Printing...".
- **Product Tiles**: Missing stock indicators and type badges (Combo/Recipe).
- **Categories**: Currently a horizontal list but UI behavior is basic.
- **Arabic/RTL**: Some technical terms like `Print Job` and `device_key` are exposed or poorly translated.
- **Loading/Error**: Generic "pos-empty" or "pos-inline-error" used; lack of high-quality empty states.

---

## 3. Printing & Hardware UI
- **Setup**: `PrintersPage.tsx` mixed between Network and USB.
- **Local Monitoring**: No clear way to view failed jobs or workstation status from the main dashboard.
- **Job History**: `PrinterJobsPage.tsx` exists but is disconnected from the POS operational flow.
- **Auto-discovery**: "System Printers" section only works if Electron is detected; needs better "Browser fallback" notice.

---

## 4. Sessions & Reports
- **Closing**: `POSSessionsPage.tsx` has basic expected/actual fields but lacks a visual "Difference" indicator with color coding (Success/Danger).
- **Z Report**: `ReportsSessionsZPage.tsx` exists but might need more granular breakdown of Cash In/Out and Manager Approvals.
- **Manager Approval**: Currently separate fields in various modals; needs a unified `ManagerApprovalDialog`.

---

## 5. Buttons & Placeholders
- **Reprint**: Button exists but doesn't show progress/status of the job.
- **KOT**: "Send to Kitchen" button doesn't provide visual feedback on which items were sent.
- **Returns**: Drawer exists but the workflow for selecting items for return is clunky.

---

## 6. Priorities (P0 - P2)

### **P0: Mission Critical**
- [ ] Implement Unified `ManagerApprovalDialog` (Phase 12).
- [ ] Upgrade POS Header/Status Bar for Workstation/Printer status (Phase 1).
- [ ] Fix POS Close Session Dialog (Expected vs Actual vs Diff) (Phase 8).
- [ ] Add RTL/Arabic polish across POS (Phase 17).

### **P1: Operational Efficiency**
- [ ] Upgrade `OrderPad` with stock status and category UX (Phase 2).
- [ ] Implement `PendingDeliveryDrawer` with explicit "Collect" workflow (Phase 4).
- [ ] Add `Cash In / Cash Out` dialog to POS Toolbar (Phase 7).
- [ ] Implement `Audit Log` viewer for Managers (Phase 13).

### **P2: UI Polish & Reporting**
- [ ] High-quality Loading/Error/Empty states (Phase 15).
- [ ] Upgrade `PrintersPage` with dedicated Workstation config (Phase 10/11).
- [ ] Refine `Z Report` layout (Phase 9).
- [ ] Improve Cart Panel with explicit "Delivery/Dine-In" labels (Phase 3).

---

## 7. Non-Operational Rules Check
- [x] Logic must not change.
- [x] API Contracts must be respected.
- [x] No fake buttons.
- [x] Arabic/RTL is mandatory.
