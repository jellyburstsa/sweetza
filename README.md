# Sweetza Pro UI v6.30 — Free Delivery Confetti

Added a small celebratory confetti burst when the cart subtotal crosses the R500 free-delivery threshold.

Behavior:
- fires only when the customer goes from below R500 to R500 or more
- does not repeatedly trigger on ordinary cart re-renders
- can trigger again if the cart drops below R500 and later reaches R500 again
- disabled for customers who prefer reduced motion
- no external animation library used

Cart, stock, delivery fees, and WhatsApp ordering remain unchanged.
