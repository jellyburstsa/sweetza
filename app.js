const STORE = {
  whatsapp: "27849072130",
  currency: "R"
};

const PRODUCT_CONFIG_KEY = "sweetzaProductConfigV1";
const CART_KEY = "sweetzaCartV1";
const FREE_DELIVERY_THRESHOLD = 500;
const DELIVERY_FEES = {
  courier: 99,
  pudo: 75
};

const CATEGORY_ORDER = ["70g", "Milk Bottles", "300g", "900g"];


const AUTHORITATIVE_PRICES = {
  gummies70g: 11.99,
  gummies300g: 29.99,
  gummies900g: 69.99,
  milk125g: 21.99,
  milk600g: 79.99
};

function authoritativePrice(product) {
  const pack = String(product?.packSize || "").trim();
  const section = String(product?.section || "").trim();
  const name = String(product?.name || "").toLowerCase();

  if ((section === "Milk Bottles" || name.includes("milk bottle")) && pack === "125g") {
    return AUTHORITATIVE_PRICES.milk125g;
  }
  if ((section === "Milk Bottles" || name.includes("milk bottle")) && pack === "600g") {
    return AUTHORITATIVE_PRICES.milk600g;
  }
  if (pack === "70g") return AUTHORITATIVE_PRICES.gummies70g;
  if (pack === "300g") return AUTHORITATIVE_PRICES.gummies300g;
  if (pack === "900g") return AUTHORITATIVE_PRICES.gummies900g;

  return Number(product?.price || 0);
}

function normalizeProductPrices(list) {
  let changed = false;

  const normalized = list.map(product => {
    const correctPrice = authoritativePrice(product);
    if (Number(product.price) !== correctPrice) {
      changed = true;
      return { ...product, price: correctPrice };
    }
    return product;
  });

  return { normalized, changed };
}


const CATEGORY_META = {
  "70g": {
    eyebrow: "Sweetza Snack Size",
    title: "Snack Size Range",
    copy: "Pick your favourites and choose the quantity you want."
  },
  "Milk Bottles": {
    eyebrow: "Sweetza Milk Bottles",
    title: "Milk Bottles",
    copy: "Choose between the 125g and 600g packs."
  },
  "300g": {
    eyebrow: "Sweetza Classic Pack",
    title: "Classic Pack Range",
    copy: "Browse the main Sweetza range."
  },
  "900g": {
    eyebrow: "Sweetza Bulk Pack",
    title: "Bulk Pack Range",
    copy: "Bigger packs for sharing or stocking up."
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadProducts() {
  const defaults = Array.isArray(window.SWEETZA_DEFAULT_PRODUCTS)
    ? clone(window.SWEETZA_DEFAULT_PRODUCTS)
    : [];

  const normalizedDefaults = normalizeProductPrices(defaults).normalized;

  try {
    const saved = JSON.parse(localStorage.getItem(PRODUCT_CONFIG_KEY) || "null");
    if (!Array.isArray(saved) || !saved.length) return normalizedDefaults;

    // Preserve manager edits/deletions, restore Rainbow Mix if an older saved list missed it,
    // and always enforce the current official prices.
    const rainbowMix = normalizedDefaults.find(product => product.id === "300g-rainbow-mix");
    if (rainbowMix && !saved.some(product => product.id === rainbowMix.id)) {
      saved.push(clone(rainbowMix));
    }

    const { normalized, changed } = normalizeProductPrices(saved);
    if (changed || (rainbowMix && !saved.some(product => product.id === rainbowMix.id))) {
      localStorage.setItem(PRODUCT_CONFIG_KEY, JSON.stringify(normalized));
    } else {
      // Save as well so older caches are guaranteed to be rewritten with current schema/prices.
      localStorage.setItem(PRODUCT_CONFIG_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return normalizedDefaults;
  }
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

let products = loadProducts();
let cart = loadCart();
let activeCategory = "70g";

const grids = {
  "70g": document.getElementById("productGrid70g"),
  "Milk Bottles": document.getElementById("productGridMilkBottles"),
  "300g": document.getElementById("productGrid300g"),
  "900g": document.getElementById("productGrid900g")
};

const cartDrawer = document.getElementById("cartDrawer");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const floatingCartCount = document.getElementById("floatingCartCount");
const clearCartButton = document.getElementById("clearCart");

let lastFocusedElement = null;

function focusFirstCartControl() {
  const target = cartDrawer.querySelector(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  target?.focus({ preventScroll: true });
}

function trapCartFocus(event) {
  if (event.key !== "Tab" || !cartDrawer.classList.contains("open")) return;

  const focusable = [...cartDrawer.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null);

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}


function money(value) {
  const number = Number(value || 0);
  return `${STORE.currency}${Number.isInteger(number) ? number.toFixed(0) : number.toFixed(2)}`;
}

function productStatus(product) {
  return product.status || (product.active === false ? "hidden" : "available");
}

function isVisible(product) {
  return productStatus(product) !== "hidden";
}

function isAvailable(product) {
  return productStatus(product) === "available" && Number(product.price) > 0;
}

function productById(id) {
  return products.find(product => product.id === id);
}

function productsByCategory(category) {
  return products.filter(product => product.section === category && isVisible(product));
}

function productCard(product) {
  const available = isAvailable(product);

  return `
    <article class="product-card ${available ? "is-available" : "is-out-of-stock"}">
      <button class="product-image" type="button" onclick="openProductLightbox('${product.id}')" aria-label="View ${product.name} image">
        <img
          src="${product.image || ""}"
          alt="${product.name} ${product.packSize}"
          loading="lazy"
          onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
        <div class="image-fallback" hidden>
          <img src="assets/brand/sweetza-logo.png" alt="">
          <span>${product.name}</span>
        </div>
        <span class="pack-badge">${product.packSize}</span>
        <span class="stock-badge ${available ? "available" : "out"}">${available ? "✓ Available" : "Out of Stock"}</span>
      </button>

      <div class="product-info">
        <div>
          <h3>${product.name}</h3>
          <span>${product.packSize}</span>
        </div>
        <strong class="price">${available ? money(product.price) : "Unavailable"}</strong>
      </div>

      <div class="product-actions">
        <div class="qty-stepper">
          <button type="button" onclick="changeProductQty('${product.id}', -1)" ${available ? "" : "disabled"} aria-label="Decrease quantity">−</button>
          <input id="qty-${product.id}" type="number" min="1" value="1" inputmode="numeric" ${available ? "" : "disabled"} aria-label="Quantity">
          <button type="button" onclick="changeProductQty('${product.id}', 1)" ${available ? "" : "disabled"} aria-label="Increase quantity">+</button>
        </div>

        <button class="add-button flowbite-button flowbite-add-button" type="button" onclick="addToCart('${product.id}')" ${available ? "" : "disabled"}>
          ${available ? "Add to Cart" : "Out of Stock"}
        </button>
      </div>
    </article>
  `;
}

function renderProducts() {
  CATEGORY_ORDER.forEach(category => {
    const grid = grids[category];
    if (!grid) return;

    const items = productsByCategory(category);
    grid.innerHTML = items.length
      ? items.map(productCard).join("")
      : `<div class="empty-state">No products in this range yet.</div>`;
  });
}

function switchCategory(category) {
  if (!CATEGORY_ORDER.includes(category)) return;
  activeCategory = category;

  CATEGORY_ORDER.forEach(name => {
    grids[name]?.classList.toggle("hidden", name !== category);
  });

  document.querySelectorAll("[data-category]").forEach(button => {
    const active = button.dataset.category === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const meta = CATEGORY_META[category];
  document.getElementById("rangeEyebrow").textContent = meta.eyebrow;
  document.getElementById("rangeTitle").textContent = meta.title;
  document.getElementById("rangeCopy").textContent = meta.copy;
}

function changeProductQty(id, delta) {
  const input = document.getElementById(`qty-${id}`);
  if (!input || input.disabled) return;

  const current = Math.max(1, Number(input.value || 1));
  input.value = Math.max(1, current + delta);
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(id) {
  const product = productById(id);
  if (!product) return;

  if (!isAvailable(product)) {
    showToast("This product is out of stock");
    return;
  }

  const quantityInput = document.getElementById(`qty-${id}`);
  const quantity = Math.max(1, Number(quantityInput?.value || 1));

  const existing = cart.find(item => item.productId === id);
  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({
      productId: id,
      qty: quantity,
      price: Number(product.price)
    });
  }

  saveCart();
  renderCart();
  showToast(`${product.name} added to cart`);
}

function updateCartQty(id, delta) {
  const item = cart.find(entry => entry.productId === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(entry => entry.productId !== id);
  }

  saveCart();
  renderCart();
}

function removeCartItem(id) {
  cart = cart.filter(item => item.productId !== id);
  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function cartSubtotal() {
  return cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
}


function deliveryFeeFor(choice) {
  if (!choice) return 0;
  if (cartSubtotal() >= FREE_DELIVERY_THRESHOLD) return 0;
  return Number(DELIVERY_FEES[choice] || 0);
}

function updateDeliveryProgress() {
  const subtotal = cartSubtotal();
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const percent = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

  const message = document.getElementById("deliveryProgressMessage");
  const amount = document.getElementById("deliveryProgressAmount");
  const fill = document.getElementById("deliveryProgressFill");
  const card = document.getElementById("deliveryProgressCard");

  if (fill) fill.style.width = `${percent}%`;
  if (amount) amount.textContent = `${money(subtotal)} / ${money(FREE_DELIVERY_THRESHOLD)}`;

  if (subtotal >= FREE_DELIVERY_THRESHOLD) {
    if (message) message.textContent = "🎉 You've unlocked FREE delivery!";
    card?.classList.add("complete");
  } else {
    if (message) message.textContent = `Add ${money(remaining)} more for FREE delivery!`;
    card?.classList.remove("complete");
  }

  updateDeliveryPriceLabels();
}

function updateDeliveryPriceLabels() {
  const free = cartSubtotal() >= FREE_DELIVERY_THRESHOLD;
  const courierLabel = document.getElementById("courierDeliveryPrice");
  const pudoLabel = document.getElementById("pudoDeliveryPrice");

  if (courierLabel) courierLabel.textContent = free ? "FREE delivery" : `${money(DELIVERY_FEES.courier)} delivery`;
  if (pudoLabel) pudoLabel.textContent = free ? "FREE delivery" : `${money(DELIVERY_FEES.pudo)} delivery`;
}


function syncCartPrices() {
  let changed = false;

  cart.forEach(item => {
    const product = productById(item.productId);
    if (!product) return;

    const correctPrice = authoritativePrice(product);
    if (Number(item.price) !== correctPrice) {
      item.price = correctPrice;
      changed = true;
    }
  });

  if (changed) saveCart();
}

function renderCart() {
  syncCartPrices();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  floatingCartCount.textContent = count;
  document.getElementById("floatingCartButton")?.setAttribute(
    "aria-label",
    `View cart, ${count} ${count === 1 ? "item" : "items"}`
  );
  cartTotal.textContent = money(cartSubtotal());
  clearCartButton.style.visibility = cart.length ? "visible" : "hidden";

  const cartItemSummary = document.getElementById("cartItemSummary");
  if (cartItemSummary) {
    cartItemSummary.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  }

  updateDeliveryProgress();

  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <strong>Your cart is empty</strong>
        <p>Add your favourite Sweetza products to get started.</p>
      </div>
    `;
    return;
  }

  const grouped = {};
  cart.forEach(item => {
    const product = productById(item.productId);
    if (!product) return;

    const category = product.section || "Other";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({ item, product });
  });

  cartItems.innerHTML = CATEGORY_ORDER
    .filter(category => grouped[category]?.length)
    .map(category => `
      <section class="cart-category-group">
        <div class="cart-category-heading">
          <strong>${category}</strong>
          <span>${grouped[category].reduce((sum, entry) => sum + entry.item.qty, 0)} pcs</span>
        </div>

        ${grouped[category].map(({ item, product }) => `
          <div class="cart-item">
            <div class="cart-item-copy">
              <strong>${product.name}</strong>
              <span>${product.packSize} · ${money(item.price)} each</span>
              <small>Line total: ${money(item.price * item.qty)}</small>
              <button type="button" onclick="removeCartItem('${item.productId}')">Remove</button>
            </div>

            <div class="cart-item-side">
              <div class="mini-stepper">
                <button type="button" onclick="updateCartQty('${item.productId}', -1)" aria-label="Decrease quantity">−</button>
                <strong>${item.qty}</strong>
                <button type="button" onclick="updateCartQty('${item.productId}', 1)" aria-label="Increase quantity">+</button>
              </div>
            </div>
          </div>
        `).join("")}
      </section>
    `).join("");
}

function openCart() {
  lastFocusedElement = document.activeElement;
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
  setOrderStep("review");
  requestAnimationFrame(focusFirstCartControl);
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
  lastFocusedElement?.focus?.({ preventScroll: true });
}

function setOrderStep(step) {
  const review = document.getElementById("orderReviewStep");
  const delivery = document.getElementById("deliveryOptionsStep");
  const isReview = step === "review";

  review.classList.toggle("active", isReview);
  delivery.classList.toggle("active", !isReview);

  document.getElementById("cartStepEyebrow").textContent = isReview ? "Step 1 of 2" : "Step 2 of 2";
  document.getElementById("cartStepTitle").textContent = isReview ? "Order Review" : "Delivery Options";
  clearCartButton.style.visibility = isReview && cart.length ? "visible" : "hidden";

  document.querySelector(".cart-panel")?.scrollTo({ top: 0, behavior: "smooth" });
}

function selectedDelivery() {
  return document.querySelector('input[name="deliveryChoice"]:checked')?.value || "";
}

function updateDeliveryFields() {
  const choice = selectedDelivery();
  document.getElementById("courierFields").hidden = choice !== "courier";
  document.getElementById("pudoFields").hidden = choice !== "pudo";
  updateDeliveryPriceLabels();
}

function fieldValue(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function validateDelivery() {
  const choice = selectedDelivery();

  if (!choice) {
    showToast("Please choose a delivery option");
    return false;
  }

  const required = choice === "courier"
    ? [
        ["courierName", "Please enter your full name"],
        ["courierPhone", "Please enter your phone number"],
        ["courierStreet", "Please enter your street address"],
        ["courierSuburb", "Please enter your suburb"],
        ["courierCity", "Please enter your city or town"],
        ["courierProvince", "Please select your province"],
        ["courierPostcode", "Please enter your postcode"]
      ]
    : [
        ["pudoName", "Please enter your name"],
        ["pudoPhone", "Please enter your 10-digit phone number"],
        ["pudoProvince", "Please select your province"],
        ["pudoLocker", "Please enter your nearest Pudo locker"]
      ];

  for (const [id, message] of required) {
    const field = document.getElementById(id);
    if (!field || !field.value.trim()) {
      showToast(message);
      field?.focus();
      return false;
    }
  }

  if (choice === "pudo") {
    const phone = fieldValue("pudoPhone").replace(/\D/g, "");
    if (phone.length !== 10) {
      showToast("Pudo phone number must be exactly 10 digits");
      document.getElementById("pudoPhone")?.focus();
      return false;
    }
  }

  return true;
}

function orderDate() {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function groupedOrderLines() {
  const grouped = {};

  cart.forEach(item => {
    const product = productById(item.productId);
    if (!product) return;

    const category = product.section || "Other";
    if (!grouped[category]) grouped[category] = [];

    grouped[category].push(
      `• ${product.name} ${product.packSize} — Qty ${item.qty} — ${money(item.price)} each`
    );
  });

  const lines = [];

  CATEGORY_ORDER.forEach(category => {
    if (!grouped[category]?.length) return;
    lines.push(`🍬 *${category}*`);
    lines.push(...grouped[category]);
    lines.push("");
  });

  Object.keys(grouped)
    .filter(category => !CATEGORY_ORDER.includes(category))
    .forEach(category => {
      lines.push(`🍬 *${category}*`);
      lines.push(...grouped[category]);
      lines.push("");
    });

  return lines;
}

function deliveryLines() {
  const choice = selectedDelivery();
  const fee = deliveryFeeFor(choice);
  const feeText = fee === 0 ? "FREE" : money(fee);

  if (choice === "courier") {
    return [
      "🚚 Courier to your door",
      `💳 Delivery fee: ${feeText}`,
      `Name: ${fieldValue("courierName")}`,
      `Phone: ${fieldValue("courierPhone")}`,
      `Address: ${[
        fieldValue("courierStreet"),
        fieldValue("courierSuburb"),
        fieldValue("courierCity"),
        fieldValue("courierProvince"),
        fieldValue("courierPostcode")
      ].filter(Boolean).join(", ")}`
    ];
  }

  return [
    "📦 Send to Pudo locker",
    `💳 Delivery fee: ${feeText}`,
    `Name: ${fieldValue("pudoName")}`,
    `Phone: ${fieldValue("pudoPhone")}`,
    `Province: ${fieldValue("pudoProvince")}`,
    `Nearest Pudo locker: ${fieldValue("pudoLocker")}`
  ];
}

function sendWhatsAppOrder() {
  if (!cart.length) {
    showToast("Add something to your cart first");
    return;
  }

  if (!validateDelivery()) return;

  const choice = selectedDelivery();
  const deliveryFee = deliveryFeeFor(choice);
  const finalTotal = cartSubtotal() + deliveryFee;

  const message = [
    "🍬 *SWEETZA ORDER*",
    `📅 Date: ${orderDate()}`,
    "",
    "🛒 *Products*",
    ...groupedOrderLines(),
    `💰 *Products Total:* ${money(cartSubtotal())}`,
    "",
    "📦 *Delivery*",
    ...deliveryLines(),
    "",
    `✨ *FINAL TOTAL:* ${money(finalTotal)}`
  ].join("\n");

  window.open(
    `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
}


function openProductLightbox(id) {
  const product = productById(id);
  if (!product) return;

  const lightbox = document.getElementById("productLightbox");
  const image = document.getElementById("productLightboxImage");
  const title = document.getElementById("productLightboxTitle");

  image.src = product.image || "assets/brand/sweetza-logo.png";
  image.alt = `${product.name} ${product.packSize}`;
  image.onerror = () => {
    image.onerror = null;
    image.src = "assets/brand/sweetza-logo.png";
  };
  title.textContent = `${product.name} · ${product.packSize}`;

  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
}

function closeProductLightbox() {
  const lightbox = document.getElementById("productLightbox");
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
}


let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => switchCategory(button.dataset.category));
});

document.getElementById("floatingCartButton").addEventListener("click", openCart);
document.getElementById("closeCart").addEventListener("click", closeCart);
document.getElementById("cartBackdrop").addEventListener("click", closeCart);
document.getElementById("clearCart").addEventListener("click", clearCart);

document.getElementById("looksGoodButton").addEventListener("click", () => {
  if (!cart.length) {
    showToast("Add something to your cart first");
    return;
  }
  setOrderStep("delivery");
});

document.getElementById("backToReviewButton").addEventListener("click", () => {
  setOrderStep("review");
});

document.querySelectorAll('input[name="deliveryChoice"]').forEach(input => {
  input.addEventListener("change", updateDeliveryFields);
});

document.getElementById("whatsappOrderButton").addEventListener("click", sendWhatsAppOrder);

document.addEventListener("keydown", trapCartFocus);

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  if (document.getElementById("productLightbox").classList.contains("open")) {
    closeProductLightbox();
    return;
  }

  if (cartDrawer.classList.contains("open")) {
    closeCart();
  }
});

window.addEventListener("storage", event => {
  if (event.key === PRODUCT_CONFIG_KEY) {
    products = loadProducts();
    renderProducts();
  }
});

window.addEventListener("focus", () => {
  products = loadProducts();
  renderProducts();
});

renderProducts();
renderCart();
switchCategory(activeCategory);


document.getElementById("productLightboxClose").addEventListener("click", closeProductLightbox);
document.getElementById("productLightboxBackdrop").addEventListener("click", closeProductLightbox);
