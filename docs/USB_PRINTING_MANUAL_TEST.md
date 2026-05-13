# USB Printing Manual Test Guide

This guide provides step-by-step instructions for manually testing USB/WINDOWS printer functionality in the DMS SOLUTION system.

## Prerequisites
1. DMS SOLUTION desktop application installed and running
2. At least one USB/WINDOWS printer connected to the workstation
3. Valid user credentials with POS and printing permissions
4. Backend server running and accessible

## Test Environment Setup
- Ensure the desktop application is logged in to a valid session
- Verify that the backend API is accessible from the desktop client
- Confirm that at least one USB/WINDOWS printer is detected by the system

## Test Scenarios

### Scenario 1: Discovery of USB/WINDOWS Printers

**Objective**: Verify that the system can detect locally installed USB/WINDOWS printers.

**Steps**:
1. Launch the DMS SOLUTION desktop application
2. Navigate to the Printers setup page (usually under Settings > Printing > Printers)
3. Look for a section that displays "System Printers" or "Detected System Printers"
4. Verify that your USB/WINDOWS printer appears in the list

**Expected Result**: 
- The USB/WINDOWS printer name should be visible in the list of system printers
- Example printer names: "EPSON TM-T20III Receipt", "XP-80C", "POS-80", "Microsoft Print to PDF"

**Pass/Fail Criteria**:
- PASS: USB/WINDOWS printer appears in the detected printers list
- FAIL: No printers are detected or the expected USB printer is missing

### Scenario 2: Configuring a USB/WINDOWS Printer

**Objective**: Verify that a USB/WINDOWS printer can be configured and saved to the system.

**Steps**:
1. From the Printers setup page, click "Add Printer" or similar button
2. Fill in the printer details:
   - Name: "Test USB Printer"
   - Type: Select "USB" or "WINDOWS" (depending on available options)
   - Target: Select "CASHIER" (for receipt printing)
   - Windows Printer Name: Select your USB printer from the dropdown or enter the exact name as shown in Windows
   - Device ID: Enter a unique identifier for this workstation (e.g., "CASHIER-PC-01")
   - Paper Width: 80 (for standard 80mm receipt printers)
3. Save the printer configuration
4. Verify the printer appears in the printers list with the correct details

**Expected Result**:
- The printer is saved successfully and appears in the printers list
- The printer type shows as USB or WINDOWS
- The Windows Printer Name and Device ID are correctly stored

**Pass/Fail Criteria**:
- PASS: Printer saves correctly and displays all configured properties
- FAIL: Error occurs during save or printer properties are incorrect

### Scenario 3: Test Print to USB/WINDOWS Printer

**Objective**: Verify that a test print job can be sent to and printed by the USB/WINDOWS printer.

**Steps**:
1. From the printer configuration or printers list, locate the test print button for your USB printer
2. Click "Test Print" or similar action
3. Observe the printer for output
5. Check the application for any success/error messages

**Expected Result**:
- The printer produces a test page with content similar to:
  ```
  Test Print
  DMS SOLUTION
  Printer: [Your Printer Name]
  Time: [Current Timestamp]
  ```
- The application shows a success message indicating the test print was sent

**Pass/Fail Criteria**:
- PASS: Printer outputs the test page and application shows success
- FAIL: No output from printer or application shows error

### Scenario 4: Printing a Receipt from POS via USB Printer

**Objective**: Verify that a receipt can be printed from the POS interface to a USB/WINDOWS printer.

**Steps**:
1. Log in to the POS interface using a user with cashier permissions
2. Create a new test order with at least one item
3. Complete the order (payment can be simulated or skipped depending on setup)
4. Click the "Print Receipt" button (separate from the save/pay button)
5. Observe the USB printer for output
6. Verify the receipt contains expected information

**Expected Result**:
- The USB printer prints a receipt containing:
  - Restaurant/branch name
  - Order number and timestamp
  - Itemized list of products with quantities and prices
  - Subtotal, taxes, total amounts
  - Payment information
  - Footer message
- The POS interface shows a success indication for the print job

**Pass/Fail Criteria**:
- PASS: Receipt prints correctly with all expected elements
- FAIL: Receipt does not print, is missing information, or prints incorrect data

### Scenario 5: Printing a Kitchen Order Ticket (KOT) via USB Printer

**Objective**: Verify that a kitchen order ticket can be printed to a USB/WINDOWS printer configured as a kitchen printer.

**Steps**:
1. Configure a USB/WINDOWS printer with target set to "KITCHEN"
2. Create a new order in POS with kitchen items (items that should go to the kitchen)
3. Complete the order
4. Click the "Print Kitchen Ticket" or similar button
5. Observe the USB printer configured as kitchen printer for output

**Expected Result**:
- The printer outputs a kitchen ticket containing:
  - Kitchen order header
  - Order number and timestamp
  - Itemized list of kitchen items (usually without prices)
  - Any special notes or instructions
  - Table number or order type information

**Pass/Fail Criteria**:
- PASS: Kitchen ticket prints correctly with expected kitchen-specific format
- FAIL: Ticket does not print, missing items, or incorrect format

### Scenario 6: Print Job Status Tracking

**Objective**: Verify that print job statuses are correctly tracked and displayed.

**Steps**:
1. Initiate a print job to a USB/WINDOWS printer (using either test print or actual order print)
2. Navigate to the Print Jobs page in the application
3. Locate the recent print job and check its status
4. If the print was successful, the status should show as "SUCCESS" or "COMPLETED"
5. If there was an error, the status should show as "FAILED" with an error message

**Expected Result**:
- Print job appears in the list with appropriate status
- For successful prints: Status = SUCCESS, no error message
- For failed prints: Status = FAILED, with descriptive error message

**Pass/Fail Criteria**:
- PASS: Job status accurately reflects the print outcome
- FAIL: Status does not match the actual print result or is missing

### Scenario 7: Reprint Functionality

**Objective**: Verify that receipts can be reprinted and the reprint is properly tracked.

**Steps**:
1. Print a receipt from an order (Scenario 4)
2. Navigate to the order details in the POS interface
3. Click the "Reprint Receipt" button
4. Verify the USB printer produces another copy of the receipt
5. Check that the receipt indicates it is a reprint (e.g., "Copy" or "Reprint" visible)
6. Verify the system tracks the reprint count

**Expected Result**:
- A second receipt prints successfully
- The receipt includes a clear indication it is a reprint (e.g., "Copy Receipt", "Reprint", or similar)
- The order's reprint count increments by 1

**Pass/Fail Criteria**:
- PASS: Reprint succeeds, is marked as a reprint, and reprint count increases
- FAIL: Reprint fails, is not marked as a reprint, or reprint count does not update

### Scenario 8: Printer Error Handling

**Objective**: Verify that printer errors are properly caught and displayed.

**Steps**:
1. Configure a USB/WINDOWS printer that is intentionally unavailable (e.g., turn off the printer or disconnect it)
2. Attempt to print a receipt or test page to this printer
3. Observe the application for error messages
4. Check the print job status for failure details

**Expected Result**:
- The application shows a clear error message indicating the print failed
- The print job status shows as "FAILED" with an error description
- Common errors might include: "Printer not found", "Access denied", "Printer busy", etc.

**Pass/Fail Criteria**:
- PASS: Error is properly caught, displayed to user, and logged in the print job
- FAIL: Error is not shown, shows as successful incorrectly, or lacks detail

## Evaluation Criteria

For the USB printing feature to be considered working correctly:
- All core scenarios (1-4) must pass
- Error handling (scenario 8) must function correctly
- Status tracking (scenario 6) must be accurate
- Reprint functionality (scenario 7) must work as expected

## Troubleshooting

If tests fail:
1. Verify the desktop application has permission to access printers
2. Check that the printer is properly installed in Windows and set as default if needed
3. Ensure the backend API is running and accessible from the desktop client
4. Check application logs for any errors related to printing
5. Confirm that the user has the required permissions for printing operations

## Notes
- These tests assume a standard 80mm thermal receipt printer setup
- Adjust expectations based on your specific printer model and capabilities
- Some printers may require specific drivers or configurations to work properly with the system