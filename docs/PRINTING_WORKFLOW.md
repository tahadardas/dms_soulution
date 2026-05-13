# Printing Workflow in DMS SOLUTION

## Overview

This document describes the unified printing workflow in the DMS SOLUTION system that supports both network printers and USB/WINDOWS printers through a coordinated backend and Electron desktop client architecture.

## Unified Printing Architecture

```
POS Button
→ POST /pos/orders/:orderId/print
→ Backend builds print payload
→ Backend applies print_template
→ Backend selects printer route
→ Backend creates print_job
→ If printer.type = NETWORK:
      Backend sends to printer directly or processes queue
  If printer.type = USB or WINDOWS:
      Electron Desktop Agent captures job and prints to local Windows printer
→ job.status updates
→ POS displays result
```

## Detailed Workflow

### 1. Print Request from POS
When a user initiates printing from the POS interface:

1. User clicks "Print Receipt" or "Print Kitchen Ticket" button
2. Frontend sends HTTP POST to `/pos/orders/:orderId/print`
3. Request body includes:
   ```json
   {
     "types": ["RECEIPT"], // or ["KOT"] or both
     "processNow": false,  // For network printers - process immediately
     "isReprint": false,
     "reason": "Customer copy"
   }
   ```

### 2. Backend Processing (POS Service)
The POS service handles the request:

1. Validates the order exists and user has `POS_ORDER_PRINT` permission
2. Builds print payload using `buildOrderPrintPayload(orderId)` which includes:
   - Restaurant/branch information
   - Order details (number, timestamp, cashier)
   - Order type and payment status
   - Itemized lists (with prices for receipts, without for KOT)
   - Subtotal, discounts, taxes, totals
   - Payment notices (for delivery orders, reprints)
   - Footer messages
3. Calls `queueOrderPrintJobs()` to create print jobs
4. For each print type:
   - Resolves the appropriate printer route based on type (RECEIPT→CASHIER, KOT→KITCHEN)
   - Applies the corresponding print template
   - Creates a print job with:
     - Unique job ID
     - Printer ID from route
     - Status: `PENDING`
     - Type: RECEIPT or KOT
     - Content: Template-applied payload
     - Payload: Raw data for flexibility
     - Template ID reference

### 3. Print Job Creation (Printing Service)
The Printing service creates the actual job records:

1. Determines target printer using `resolveRoute()`:
   - Matches by job type (RECEIPT/KOT) and branch
   - Falls back to target-based routing (CASHIER→receipt printers, KITCHEN→kitchen printers)
2. Gets template:
   - Uses route-specified template
   - Falls back to default template for type
   - Uses raw payload formatting if no template found
3. Renders template with payload data
4. Inserts record into `print_jobs` table with:
   - Status: `PENDING`
   - Content: Final printable text/HTML
   - Payload: Original data JSON
   - Template ID: Reference to template used
   - Created timestamp

### 4. Job Processing - Network Printers
For printers with `type = NETWORK`:

1. Background process (`processQueue`) runs every 5 seconds
2. Selects jobs with status `PENDING` or `FAILED` and retries < maxRetries
3. For each job:
   - Sets status to `PROCESSING`
   - Retrieves printer details
   - Verifies printer is NETWORK type (skips USB/WINDOWS here)
   - Sends content to printer via TCP socket (port 9100 by default)
   - On success: Sets status to `COMPLETED`
   - On failure: Increments retry count, sets to `PENDING` (for retry) or `FAILED` (after max retries)
4. Updates `last_attempt_at` and `updated_at` timestamps

### 5. Job Processing - USB/WINDOWS Printers
For printers with `type = USB` or `WINDOWS`:

1. Backend `processQueue()` skips these printers (no direct processing)
2. Jobs remain in `PENDING` state indefinitely
3. Electron desktop client periodically polls for jobs:
   - Requests `GET /printing/jobs/pending-local?deviceKey=[WORKSTATION_KEY]`
   - Returns only jobs for USB/WINDOWS printers matching the device key
4. For each job returned:
   - Electron locks the job via `POST /printing/jobs/:id/lock`
   - Changes status implicitly to `LOCKED` (handled by backend)
   - Prints content using Windows printing API:
     - For HTML: Creates hidden BrowserWindow, loads content, prints silently
     - For text: Converts to simple HTML or uses ESC/POS if available
   - On success: Posts to `POST /printing/jobs/:id/complete`
   - On failure: Posts to `POST /printing/jobs/:id/fail` with error message
5. Backend updates job to `SUCCESS` or `FAILED` with `processed_at` timestamp

### 6. Status Reporting to POS
The POS interface can display print job status:

1. Polls `/printing/jobs` endpoint with filters for the order
2. Shows statuses: PENDING, PROCESSING, PRINTING, SUCCESS, FAILED, CANCELLED
3. For FAILED jobs, displays error_message to user
4. Prevents false success indications - only shows success when job is actually COMPLETED

### 7. Reprint Handling
For reprint requests:

1. Validates user has `POS_ORDER_REPRINT` permission or manager approval
2. Increments order's `reprint_count`
3. Creates new print job(s) with:
   - Same content as original
   - Special reprint notices in payload
   - Updated timestamps
4. Processes through same workflow as original print

## Data Flow Summary

1. **Printer Configuration**: Administrator sets up printers in system with:
   - Type (NETWORK/USB/WINDOWS)
   - Target (CASHIER/KITCHEN/etc.)
   - For USB/WINDOWS: Windows printer name, device ID, paper width

2. **Routing Configuration**: Administrator sets up printer routes:
   - Maps job types (RECEIPT/KOT) to printers
   - Can specify by category, station, or default

3. **Print Request**: User triggers print from POS

4. **Job Creation**: Backend creates print job with template-applied content

5. **Job Distribution**:
   - NETWORK jobs → Backend print queue
   - USB/WINDOWS jobs → Waiting for Electron client

6. **Job Execution**:
   - NETWORK: Backend sends directly to printer via TCP
   - USB/WINDOWS: Electron client prints via Windows API

7. **Status Tracking**: All jobs tracked in `print_jobs` with full audit trail

8. **Completion**: POS notified of success/failure through job status queries

## Key Guarantees

- No automatic printing on order save (printing is explicit)
- Every print action creates a traceable print job
- Templates control the exact print format
- USB/WINDOWS printing relies on Electron client for device access
- Clear success/failure reporting with no false positives
- Reprint functionality tracks count and reasons
- Separation of concerns: Backend handles logic/data, Electron handles devices