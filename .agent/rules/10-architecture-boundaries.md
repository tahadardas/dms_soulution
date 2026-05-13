# Architecture Boundaries

- Frontend (React) = Presentation ÙÙ‚Ø·. Ù…Ù…Ù†ÙˆØ¹ Business Rules Ù…Ø§Ù„ÙŠØ© Ø¯Ø§Ø®Ù„ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø©.
- Backend API = Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„ÙˆØ­ÙŠØ¯ Ù„Ù„ÙƒØªØ§Ø¨Ø© Ø¹Ù„Ù‰ SQLite.
- SQLite file Ù„Ø§ ÙŠØªÙ… ÙØªØ­Ù‡ Ù…Ù† Ø£ÙƒØ«Ø± Ù…Ù† Ø¹Ù…Ù„ÙŠØ© ØºÙŠØ± Ø§Ù„Ù€API.
- Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„Ù…Ø§Ù„ÙŠØ© ØªÙ…Ø± Ø¹Ø¨Ø± Services:
  AccountingService, InventoryService, CostService, POSService.
- Ø£ÙŠ ØªØºÙŠÙŠØ± Ù…Ø§Ù„ÙŠ ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙ†ØªØ¬ Audit Trail + immutable journal lines (Ù„Ø§ ØªØ¹Ø¯ÙŠÙ„ Ù…Ø¨Ø§Ø´Ø± Ø¨Ø¹Ø¯ Ø§Ù„ØªØ±Ø­ÙŠÙ„).
