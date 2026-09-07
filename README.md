# Sweetza Pro UI v6.32 — WhatsApp Button Fix

Fixed the Send Order on WhatsApp button regression introduced in v6.31.

Cause:
- v6.31 referenced helper functions that do not exist in Sweetza
- it also used cart/product field names that do not match the real store data model

Fix:
- restored the proven `validateDelivery()` flow
- restored `deliveryFeeFor(choice)`
- restored `productById(item.productId)` and `product.section`
- kept the new branded WhatsApp message style and Milk Bottles 🥛 emoji

Cart, stock, delivery, free-delivery confetti, and WhatsApp number remain unchanged.
