# Users, Roles, Permissions, Audit

- RBAC with granular permissions:
  POS.Sale, POS.Void, POS.Discount, POS.CloseSession
  INV.Adjust, INV.Transfer
  ACC.Post, ACC.Reverse, ACC.ViewStatements
  SET.ManageAccounting, SET.ManagePrinters, SET.ManageUsers
- Every sensitive action logs:
  who, when, branch, device, before/after snapshot, reason.
- Session/Branch binding: user selects branch at session open.
