# Accounting Posting Rules

This file defines the expected posting behavior for production documents. Posted documents are immutable. Corrections must use reversal documents or reverse journals.

## Global Rules

- Every posted financial document must create exactly one posted journal entry or a clearly linked reverse journal.
- `source_type + source_id` must not be posted twice.
- Draft documents may be edited; posted documents may not.
- Reversal requires a reason and actor.
- Base currency reporting uses base debit/credit amounts.
- Foreign currency documents preserve original currency and exchange rate.

## POS Order

Cash/card/transfer sale:

- Dr Cash or Bank
- Dr Sales Discounts, if any
- Cr Sales Revenue
- Cr Service Charge Revenue, if any
- Cr Tips Payable, if any
- Dr COGS
- Cr Inventory

Credit sale:

- Dr Customer Receivable
- Dr Sales Discounts, if any
- Cr Sales Revenue
- Dr COGS
- Cr Inventory

Pending delivery:

- Do not recognize cash before collection.
- Inventory/COGS may be posted when stock leaves the branch if policy is immediate.
- Collection posts cash/bank against receivable or pending delivery clearing.

## Sales Invoice

On posting:

- Dr Customer Receivable
- Cr Sales Revenue
- Cr VAT Output, if tax exists
- Dr COGS
- Cr Inventory

On payment:

- Dr Cash or Bank
- Cr Customer Receivable

If payment currency/rate differs from invoice currency/rate:

- Dr/Cr Realized FX Gain/Loss for the difference in base currency.

## Sales Return / Credit Note

On posting:

- Dr Sales Returns or Sales Revenue contra account
- Dr VAT Output, if tax is reversed
- Cr Customer Receivable or Refund Payable
- Dr Inventory
- Cr COGS

The original sales invoice remains posted and linked to the return/credit note.

## Purchase Invoice

On posting:

- Dr Inventory
- Dr Landed Cost / Inventory, when landed cost is capitalized
- Dr VAT Input, if tax exists
- Cr Supplier Payable

## Purchase Return / Debit Note

On posting:

- Dr Supplier Payable
- Cr Inventory
- Cr VAT Input, if tax is reversed

The original purchase invoice remains posted and linked to the return/debit note.

## Customer Receipt

Applied receipt:

- Dr Cash or Bank
- Cr Customer Receivable

Advance receipt:

- Dr Cash or Bank
- Cr Customer Advances

Allocation later:

- Dr Customer Advances
- Cr Customer Receivable

## Supplier Payment

Applied payment:

- Dr Supplier Payable
- Cr Cash or Bank

Advance payment:

- Dr Supplier Advances
- Cr Cash or Bank

Allocation later:

- Dr Supplier Payable
- Cr Supplier Advances

## Cash In

Cash funding or drawer adjustment:

- Dr Cash
- Cr Cash In Offset or Owner/Branch Funding

Cash In must be configured before production use because the credit side is business-specific.

## Cash Out

Expense or drawer withdrawal:

- Dr Expense / Cash Out Offset
- Cr Cash

Cash Out must be configured before production use because the debit side is business-specific.

## Inventory Adjustment

Positive adjustment:

- Dr Inventory
- Cr Inventory Gain / Adjustment Offset

Negative adjustment:

- Dr Inventory Loss / Adjustment Offset
- Cr Inventory

## Inventory Transfer

Same legal entity, branch-level inventory accounts:

- Dr Inventory - Destination Branch
- Cr Inventory - Source Branch

If branches share one inventory control account, the accounting impact may be zero while stock movements remain mandatory.

## Delivery Commission

When commission is earned:

- Dr Delivery Commission Expense
- Cr Courier Payable

When paid:

- Dr Courier Payable
- Cr Cash or Bank
