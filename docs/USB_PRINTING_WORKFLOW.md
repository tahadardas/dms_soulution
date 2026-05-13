# USB Printing Workflow in DMS SOLUTION

## Overview

This document describes the workflow for printing to USB/WINDOWS printers in the DMS SOLUTION system. The system uses a hybrid approach where:

1. Network printers are handled directly by the backend
2. USB/WINDOWS printers are handled by the Electron desktop client

## Workflow Steps

### 1. Print Request Initiation
- User clicks the "Print" button in the POS interface
- Frontend sends a POST request to `/pos/orders/:orderId/print` with:
  ```json
  {
    "types": ["RECEIPT", "KOT"],
    "processNow": false,
    "isReprint": false,
    "reason": "Customer copy"
  }
  ```

### 2. Backend Processing
- The POS service validates the request and checks permissions
- It builds the print payload using `buildOrderPrintPayload()`
- For each print type (RECEIPT, KOT), it:
  - Determines the appropriate printer route
  - Applies the corresponding print template
  - Creates a print job record in the `print_jobs` table with status `PENDING`
  - Does NOT attempt to print directly (this is key for USB/WINDOWS support)

### 3. Job Distribution
- Network printer jobs: Remain in the queue for backend processing
- USB/WINDOWS printer jobs: Remain in the `PENDING` state for Electron client to process

### 4. Electron Client Processing
- The Electron desktop client periodically polls for pending local jobs
- It requests jobs from `/printing/jobs/pending-local?deviceKey=[DEVICE_KEY]`
- For each job returned:
  - Locks the job via POST `/printing/jobs/:id/lock`
  - Prints the content using the Windows printer API
  - Updates the job status to `SUCCESS` or `FAILED` via:
    - POST `/printing/jobs/:id/complete`
    - POST `/printing/jobs/:id/fail`

### 5. Status Updates
- Job status flows: PENDING → (LOCKED) → PRINTING → SUCCESS/FAILED
- The POS interface can poll job status to show real-time updates
- Failed jobs show clear error messages to the user

## Key Components

### Backend
- `PrintingService.processQueue()`: Only processes NETWORK printers, leaves USB/WINDOWS jobs alone
- Print job creation: Applies templates and stores final content
- API endpoints: For managing printers, routes, templates, and jobs

### Electron Client
- Printer discovery: Uses `webContents.getPrintersAsync()` to list Windows printers
- Print execution: Creates hidden BrowserWindow to print HTML content
- Job polling: Regularly checks for new jobs assigned to this workstation
- Status reporting: Updates job success/failure with detailed error messages

### Database Schema
- `printers` table: Extended with `display_name`, `windows_printer_name`, `device_id`, `paper_width`
- `print_jobs` table: Contains `content` field with the final printable data
- `print_templates` table: Stores the template designs for different job types

## Benefits
- Clear separation of concerns: Backend handles logic and data, Electron handles device interaction
- Reliable printing: Jobs are persisted and can be retried
- Transparency: Full audit trail of print jobs
- Flexibility: Supports mixed environments with both network and USB printers