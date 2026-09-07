# Sweetza Pro UI v6.33 — WhatsApp Emoji Encoding Fix

Fixed WhatsApp emoji appearing as the replacement character (�).

Cause:
- literal emoji characters in app.js can be corrupted by a hosting/text-encoding layer before the WhatsApp URL is created.

Fix:
- WhatsApp-message emoji are now represented as JavaScript Unicode escape sequences.
- At runtime they become the normal emoji characters before `encodeURIComponent()` builds the WhatsApp URL.
- Message appearance stays the same.
- Milk Bottles continues to use 🥛.

All cart, stock, delivery, R500 free-delivery, confetti, validation, and WhatsApp logic remains unchanged.
