const SWEETZA_BUILD = "10.5";

function debounce(callback, delay = 250) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

const STORE = {
  whatsapp: "27849072130",
  whatsappDisplay: "+27 84 907 2130",
  email: "hello.sweetza@gmail.com",
  flavourCount: 13,
  wholesaleMessage: "Hi Sweetza, I would like wholesale pricing.",
  currency: "R"
};

const PRODUCT_CONFIG_KEY = "sweetzaProductConfigV1";
const CART_KEY = "sweetzaCartV1";
const FREE_DELIVERY_THRESHOLD = 1500;
const DELIVERY_FEES = {
  courier: 99,
  pudo: 75
};

const CATEGORY_ORDER = ["300g", "Milk Bottles", "900g", "70g"];

const CATEGORY_SECTION_IDS = {
  "300g": "classic-pack",
  "Milk Bottles": "milk-bottles",
  "900g": "bulk-pack",
  "70g": "snack-size"
};

const BEST_SELLER_NAMES = {
  "300g": ["Rainbow Mix"],
  "Milk Bottles": ["Milk Bottles"],
  "900g": ["Jelly Donut", "Sour Hearts", "Sour Ice Pops", "Banana"],
  "70g": []
};

function bestSellerRank(product) {
  const names = BEST_SELLER_NAMES[product.section] || [];
  const index = names.indexOf(product.name);
  if (index < 0) return Number.POSITIVE_INFINITY;

  // Keep the two Milk Bottles pack sizes in their natural 125g -> 600g order.
  if (product.section === "Milk Bottles") {
    return product.packSize === "125g" ? 0 : product.packSize === "600g" ? 1 : 2;
  }

  return index;
}

function isBestSeller(product) {
  return Number.isFinite(bestSellerRank(product));
}


const AUTHORITATIVE_PRICES = {
  gummies70g: 12.00,
  gummies300g: 30.00,
  gummies900g: 70.00,
  milk125g: 22.00,
  milk600g: 79.00
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

function productIdentityKey(product) {
  return [
    String(product?.section || "").trim().toLowerCase(),
    String(product?.packSize || "").trim().toLowerCase(),
    String(product?.name || "").trim().toLowerCase().replace(/\s+/g, " ")
  ].join("|");
}

function dedupeProducts(list, defaults = []) {
  const defaultIds = new Set(defaults.map(product => product.id));
  const byKey = new Map();

  list.forEach(product => {
    const key = productIdentityKey(product);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, product);
      return;
    }

    // Prefer the official/default product ID when an older browser cache contains
    // the same product under a second legacy ID.
    if (defaultIds.has(product.id) && !defaultIds.has(existing.id)) {
      byKey.set(key, product);
    }
  });

  return [...byKey.values()];
}

function loadProducts() {
  const defaults = Array.isArray(window.SWEETZA_DEFAULT_PRODUCTS)
    ? clone(window.SWEETZA_DEFAULT_PRODUCTS)
    : [];

  const normalizedDefaults = normalizeProductPrices(defaults).normalized;

  try {
    const saved = JSON.parse(localStorage.getItem(PRODUCT_CONFIG_KEY) || "null");
    if (!Array.isArray(saved) || !saved.length) return normalizedDefaults;

    const rainbowMix = normalizedDefaults.find(product => product.id === "300g-rainbow-mix");
    if (rainbowMix && !saved.some(product => productIdentityKey(product) === productIdentityKey(rainbowMix))) {
      saved.push(clone(rainbowMix));
    }

    const normalized = normalizeProductPrices(saved).normalized;
    const cleaned = dedupeProducts(normalized, normalizedDefaults);

    // Rewrite the browser cache so legacy duplicate products are removed permanently.
    localStorage.setItem(PRODUCT_CONFIG_KEY, JSON.stringify(cleaned));
    return cleaned;
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

function safeReadCartStorage() {
  try {
    return localStorage.getItem(CART_STORAGE_KEY);
  } catch (error) {
    console.warn("Sweetza cart storage is unavailable:", error);
    return null;
  }
}

function safeWriteCartStorage(value) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, value);
    return true;
  } catch (error) {
    console.warn("Sweetza cart could not be saved:", error);
    return false;
  }
}

let cart = loadCart();
let freeDeliveryWasUnlocked = null;
let activeCategory = "300g";

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
const floatingCartTotal = document.getElementById("floatingCartTotal");
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



function syncStoreDetails() {
  document.querySelectorAll("[data-store-whatsapp-link]").forEach(link => {
    link.href = `https://wa.me/${STORE.whatsapp}`;
  });

  document.querySelectorAll("[data-store-whatsapp-text]").forEach(node => {
    node.textContent = STORE.whatsappDisplay;
  });

  document.querySelectorAll("[data-store-email-link]").forEach(link => {
    link.href = `mailto:${STORE.email}`;
  });

  document.querySelectorAll("[data-store-email-text]").forEach(node => {
    node.textContent = STORE.email;
  });

  const flavourCount = document.getElementById("statFlavours");
  if (flavourCount) flavourCount.textContent = STORE.flavourCount;
}

function openWholesaleWhatsApp() {
  const url = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(STORE.wholesaleMessage)}`;
  window.open(url, "_blank", "noopener");
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


function defaultProductById(id) {
  return Array.isArray(window.SWEETZA_DEFAULT_PRODUCTS)
    ? window.SWEETZA_DEFAULT_PRODUCTS.find(product => product.id === id)
    : null;
}

function handleProductImageError(image) {
  const fallback = image.dataset.fallback || "";
  const current = image.getAttribute("src") || "";

  if (fallback && current !== fallback) {
    image.setAttribute("src", fallback);
    return;
  }

  image.hidden = true;
  const placeholder = image.nextElementSibling;
  if (placeholder) placeholder.hidden = false;
}

function productsByCategory(category) {
  const items = dedupeProducts(
    products.filter(product => product.section === category && isVisible(product)),
    Array.isArray(window.SWEETZA_DEFAULT_PRODUCTS) ? window.SWEETZA_DEFAULT_PRODUCTS : []
  );

  return [...items].sort((a, b) => {
    const rankDifference = bestSellerRank(a) - bestSellerRank(b);
    if (Number.isFinite(rankDifference) && rankDifference !== 0) return rankDifference;
    if (Number.isFinite(bestSellerRank(a)) && !Number.isFinite(bestSellerRank(b))) return -1;
    if (!Number.isFinite(bestSellerRank(a)) && Number.isFinite(bestSellerRank(b))) return 1;
    return 0;
  });
}

function storefrontAssetPath(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^(?:https?:|data:|blob:|\/)/i.test(value)) return value;
  return value.startsWith("./") ? value : `./${value}`;
}

function productCard(product) {
  const available = isAvailable(product);

  return `
    <article class="product-card ${available ? "is-available" : "is-out-of-stock"}" data-product-id="${product.id}">
      <button class="product-image" type="button" onclick="openProductLightbox('${product.id}')" aria-label="View ${product.name} image">
        <img
          src="${storefrontAssetPath(product.image || defaultProductById(product.id)?.image || "")}"
          data-fallback="${storefrontAssetPath(defaultProductById(product.id)?.image || "")}"
          alt="${product.name} ${product.packSize}"
          loading="lazy"
          onerror="handleProductImageError(this)">
        <div class="image-fallback" hidden>
          <span class="image-placeholder-mark" aria-hidden="true">SZ</span>
          <span>Product image unavailable</span>
        </div>
        <span class="pack-badge">${product.packSize}</span>
        ${isBestSeller(product) ? '<span class="best-seller-badge"><span aria-hidden="true">★</span> Best Seller</span>' : ""}
        ${available ? "" : '<span class="stock-badge out">SOLD OUT</span>'}
      </button>

      <div class="product-info">
        <div>
          <h3>${product.name}</h3>
        </div>
        <strong class="price">${money(product.price)}</strong>
      </div>

      <div class="product-actions">
        <div class="qty-stepper">
          <button type="button" onclick="changeProductQty('${product.id}', -1)" ${available ? "" : "disabled"} aria-label="Decrease quantity">−</button>
          <input id="qty-${product.id}" type="number" min="1" value="1" inputmode="numeric" ${available ? "" : "disabled"} aria-label="Quantity">
          <button type="button" onclick="changeProductQty('${product.id}', 1)" ${available ? "" : "disabled"} aria-label="Increase quantity">+</button>
        </div>

        <button class="add-button flowbite-button flowbite-add-button" type="button" onclick="addToCart('${product.id}')" ${available ? "" : "disabled"}>
          Add to Cart
        </button>
      </div>
    </article>
  `;
}

function renderProducts() {
  CATEGORY_ORDER.forEach(category => {
    const grid = grids[category];
    if (!grid) return;

    grid.classList.remove("hidden");
    const items = productsByCategory(category);
    grid.innerHTML = items.length
      ? items.map(productCard).join("")
      : `<div class="empty-state">No products in this range yet.</div>`;
  });
}

function setActiveShopTab(category) {
  document.querySelectorAll("[data-shop-tab]").forEach(tab => {
    const active = tab.dataset.shopTab === category;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "true");
    else tab.removeAttribute("aria-current");
  });
}

function switchCategory(category) {
  if (!CATEGORY_ORDER.includes(category)) return;
  activeCategory = category;
  setActiveShopTab(category);
  document.getElementById(CATEGORY_SECTION_IDS[category])?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupShopCategoryTabs() {
  const tabs = [...document.querySelectorAll("[data-shop-tab]")];
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", event => {
      event.preventDefault();
      switchCategory(tab.dataset.shopTab);
    });
  });

  const sections = CATEGORY_ORDER
    .map(category => document.getElementById(CATEGORY_SECTION_IDS[category]))
    .filter(Boolean);

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    const category = visible?.target?.dataset?.categorySection;
    if (category) setActiveShopTab(category);
  }, {
    rootMargin: "-18% 0px -58% 0px",
    threshold: [0.05, 0.2, 0.45]
  });

  sections.forEach(section => observer.observe(section));
}

function changeProductQty(id, delta) {
  highlightProductCard(id);
  const input = document.getElementById(`qty-${id}`);
  if (!input || input.disabled) return;

  const current = Math.max(1, Number(input.value || 1));
  input.value = Math.max(1, current + delta);
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}


function pulseFloatingCart() {
  /* Position stays fixed; cart count badge handles the add feedback. */
}


function highlightProductCard(productId) {
  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  if (!card) return;

  document.querySelectorAll(".product-card.is-interacting").forEach(el => {
    if (el !== card) el.classList.remove("is-interacting");
  });

  card.classList.add("is-interacting");
  window.clearTimeout(card._sweetzaHighlightTimer);
  card._sweetzaHighlightTimer = window.setTimeout(() => {
    card.classList.remove("is-interacting");
  }, 1800);
}


function flyProductToCart(productId) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  const image = card?.querySelector(".product-image img, .product-image > img, img");
  const cartButton = document.getElementById("floatingCartButton");

  if (!card || !image || !cartButton) return;

  const imageRect = image.getBoundingClientRect();
  const cartRect = cartButton.getBoundingClientRect();

  const flyer = image.cloneNode(true);
  flyer.className = "fly-to-cart-image";
  flyer.setAttribute("aria-hidden", "true");

  flyer.style.left = `${imageRect.left}px`;
  flyer.style.top = `${imageRect.top}px`;
  flyer.style.width = `${Math.max(42, Math.min(imageRect.width, 72))}px`;
  flyer.style.height = `${Math.max(42, Math.min(imageRect.height, 72))}px`;

  document.body.appendChild(flyer);

  const startX = imageRect.left;
  const startY = imageRect.top;
  const endX = cartRect.left + cartRect.width / 2 - parseFloat(flyer.style.width) / 2;
  const endY = cartRect.top + cartRect.height / 2 - parseFloat(flyer.style.height) / 2;

  requestAnimationFrame(() => {
    flyer.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(.22) rotate(8deg)`;
    flyer.style.opacity = "0.15";
  });

  window.setTimeout(() => {
    flyer.remove();
    cartButton.classList.remove("cart-catch");
    void cartButton.offsetWidth;
    cartButton.classList.add("cart-catch");
    window.setTimeout(() => cartButton.classList.remove("cart-catch"), 360);
  }, 560);
}

function addToCart(id) {
  flyProductToCart(id);
  highlightProductCard(id);
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
  pulseFloatingCart();
  bounceFloatingCartBadge();
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


function celebrateFreeDelivery() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const existing = document.querySelector(".free-delivery-confetti");
  existing?.remove();

  const layer = document.createElement("div");
  layer.className = "free-delivery-confetti";
  layer.setAttribute("aria-hidden", "true");

  const pieces = 28;
  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement("i");
    piece.className = "free-delivery-confetti-piece";
    piece.style.setProperty("--x", `${8 + Math.random() * 84}vw`);
    piece.style.setProperty("--drift", `${-55 + Math.random() * 110}px`);
    piece.style.setProperty("--delay", `${Math.random() * 0.16}s`);
    piece.style.setProperty("--duration", `${0.9 + Math.random() * 0.55}s`);
    piece.style.setProperty("--rotate", `${180 + Math.random() * 540}deg`);
    piece.style.setProperty("--hue", `${265 + Math.random() * 70}`);
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1800);
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

  const freeDeliveryUnlocked = subtotal >= FREE_DELIVERY_THRESHOLD;

  if (freeDeliveryUnlocked) {
    if (message) message.textContent = "You've unlocked FREE delivery!";
    card?.classList.add("complete");
  } else {
    if (message) message.textContent = `Add ${money(remaining)} more for FREE delivery!`;
    card?.classList.remove("complete");
  }

  if (freeDeliveryWasUnlocked === false && freeDeliveryUnlocked) {
    celebrateFreeDelivery();
  }
  freeDeliveryWasUnlocked = freeDeliveryUnlocked;

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
  if (floatingCartTotal) floatingCartTotal.textContent = money(cartSubtotal());
  updateFloatingCartVisibility();
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
            <img class="cart-item-thumb" src="${product.image}" alt="" loading="lazy" onerror="this.hidden=true">
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


function updateFloatingCartVisibility() {
  const button = document.getElementById("floatingCartButton");
  if (!button) return;

  const hasItems = cart.reduce((sum, item) => sum + item.qty, 0) > 0;
  button.classList.toggle("visible", hasItems);
  button.setAttribute("aria-hidden", String(!hasItems));
}

function bounceFloatingCartBadge() {
  const badge = document.getElementById("floatingCartCount");
  if (!badge) return;

  badge.classList.remove("badge-bounce");
  void badge.offsetWidth;
  badge.classList.add("badge-bounce");

  window.setTimeout(() => {
    badge.classList.remove("badge-bounce");
  }, 420);
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
        ["courierPhone", "Please enter your 10-digit phone number"],
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

  if (choice === "courier") {
    const phone = fieldValue("courierPhone").replace(/\D/g, "");
    if (phone.length !== 10) {
      showToast("Courier phone number must be exactly 10 digits");
      document.getElementById("courierPhone")?.focus();
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
    lines.push(`*${category}*`);
    lines.push(...grouped[category]);
    lines.push("");
  });

  Object.keys(grouped)
    .filter(category => !CATEGORY_ORDER.includes(category))
    .forEach(category => {
      lines.push(`*${category}*`);
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
      "Deliver to your door",
      `Delivery fee: ${feeText}`,
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
    "Collect from a locker",
    `Delivery fee: ${feeText}`,
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
  const subtotal = cartSubtotal();
  const deliveryFee = deliveryFeeFor(choice);
  const finalTotal = subtotal + deliveryFee;

  const categoryMeta = {
    "70g": "70g Bags",
    "Milk Bottles": "Milk Bottles",
    "300g": "Classic Pack",
    "900g": "Bulk Pack"
  };

  const lines = [
    "*SWEETZA — NEW ORDER*",
    "━━━━━━━━━━━━━━━━━━",
    `*Date:* ${orderDate()}`,
    "",
    "*ITEMS ORDERED*",
    ""
  ];

  CATEGORY_ORDER.forEach(category => {
    const categoryItems = cart
      .map(item => ({ item, product: productById(item.productId) }))
      .filter(entry => entry.product?.section === category);

    if (!categoryItems.length) return;

    lines.push(`*${categoryMeta[category] || category}*`);

    categoryItems.forEach(({ item, product }) => {
      lines.push(
        `• ${product.name} ${product.packSize} × ${item.qty} — ${money(item.price)} ea`
      );
    });

    lines.push("");
  });

  const feeLabel = choice === "pudo" ? "Locker" : "Door";
  const feeText = deliveryFee === 0 ? "FREE" : money(deliveryFee);

  lines.push(
    "──────────────────",
    `*Products Subtotal:* ${money(subtotal)}`,
    `*Delivery Fee (${feeLabel}):* ${feeText}`,
    "━━━━━━━━━━━━━━━━━━",
    `*FINAL TOTAL: ${money(finalTotal)}*`,
    "━━━━━━━━━━━━━━━━━━",
    "",
    "*DELIVERY DETAILS*"
  );

  if (choice === "pudo") {
    lines.push(
      "• *Method:* Collect from a locker",
      `• *Recipient:* ${fieldValue("pudoName")}`,
      `• *Phone:* ${fieldValue("pudoPhone")}`,
      `• *Province:* ${fieldValue("pudoProvince")}`,
      `• *Nearest Locker:* ${fieldValue("pudoLocker")}`
    );
  } else {
    lines.push(
      "• *Method:* Deliver to your door",
      `• *Recipient:* ${fieldValue("courierName")}`,
      `• *Phone:* ${fieldValue("courierPhone")}`,
      `• *Street:* ${fieldValue("courierStreet")}`,
      `• *Suburb:* ${fieldValue("courierSuburb")}`,
      `• *City / Town:* ${fieldValue("courierCity")}`,
      `• *Province:* ${fieldValue("courierProvince")}`,
      `• *Postcode:* ${fieldValue("courierPostcode")}`
    );
  }

  const message = lines.join("\n");

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

  const defaultImage = defaultProductById(product.id)?.image || "";
  image.hidden = false;
  image.src = product.image || defaultImage;
  image.alt = `${product.name} ${product.packSize}`;
  image.onerror = () => {
    if (defaultImage && image.getAttribute("src") !== defaultImage) {
      image.src = defaultImage;
      return;
    }
    image.onerror = null;
    image.hidden = true;
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

document.getElementById("wholesaleButton")?.addEventListener("click", openWholesaleWhatsApp);

syncStoreDetails();

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

["courierPhone", "pudoPhone"].forEach(id => {
  const input = document.getElementById(id);
  input?.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 10);
  });
});


function keepDeliveryFieldVisible(event) {
  if (window.innerWidth > 768) return;

  const field = event.target;
  if (!field.matches("#deliveryOptionsStep input, #deliveryOptionsStep select")) return;

  window.setTimeout(() => {
    field.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });
  }, 220);
}

document.getElementById("deliveryOptionsStep")?.addEventListener("focusin", keepDeliveryFieldVisible);


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
setupShopCategoryTabs();
setActiveShopTab("300g");


document.getElementById("productLightboxClose").addEventListener("click", closeProductLightbox);
document.getElementById("productLightboxBackdrop").addEventListener("click", closeProductLightbox);


window.addEventListener("resize", updateFloatingCartVisibility, { passive: true });

updateFloatingCartVisibility();

// Sweetza v13.5 — stable smart header for touch scrolling.
// Tiny mobile scroll/bounce movements are ignored so the header
// does not rapidly hide/show and make the page feel shaky.
(function setupSmartHeader() {
  const header = document.getElementById("siteHeader");
  if (!header) return;

  let lastY = Math.max(0, window.scrollY);
  let direction = "none";
  let directionStartY = lastY;
  let ticking = false;

  const topRevealZone = 64;
  const ignoreDelta = 2;
  const hideTravel = 44;
  const revealTravel = 12;

  function menuIsOpen() {
    return Boolean(header.querySelector(".header-menu[open]"));
  }

  function cartIsOpen() {
    return document.body.classList.contains("cart-open");
  }

  function showHeader() {
    header.classList.remove("is-hidden");
  }

  function hideHeader() {
    if (menuIsOpen() || cartIsOpen()) return;
    header.classList.add("is-hidden");
  }

  function resetDirection(y = Math.max(0, window.scrollY)) {
    direction = "none";
    directionStartY = y;
    lastY = y;
  }

  function updateHeader() {
    const currentY = Math.max(0, window.scrollY);
    const delta = currentY - lastY;

    if (currentY <= topRevealZone || menuIsOpen() || cartIsOpen()) {
      showHeader();
      resetDirection(currentY);
      ticking = false;
      return;
    }

    // Ignore tiny movements caused by touch inertia / browser chrome.
    if (Math.abs(delta) <= ignoreDelta) {
      lastY = currentY;
      ticking = false;
      return;
    }

    const newDirection = delta > 0 ? "down" : "up";

    if (newDirection !== direction) {
      direction = newDirection;
      directionStartY = currentY;
    }

    const travelled = Math.abs(currentY - directionStartY);

    if (direction === "down" && travelled >= hideTravel) {
      hideHeader();
      directionStartY = currentY;
    } else if (direction === "up" && travelled >= revealTravel) {
      showHeader();
      directionStartY = currentY;
    }

    lastY = currentY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateHeader);
  }, { passive: true });

  header.querySelector(".header-menu")?.addEventListener("toggle", event => {
    if (event.target.open) {
      showHeader();
      resetDirection();
    }
  });

  window.addEventListener("resize", () => {
    resetDirection();
  }, { passive: true });

  window.addEventListener("hashchange", () => {
    showHeader();
    resetDirection();
  });

  window.addEventListener("pageshow", () => {
    showHeader();
    resetDirection();
  });

  showHeader();
})();



// Sweetza v13.0 — header logo always returns to the true page top.
// This intentionally bypasses #home anchor offsets so the promo ticker is fully visible.
function goHomeTop(event) {
  event?.preventDefault?.();

  const header = document.getElementById("siteHeader");
  header?.classList.remove("is-hidden");
  header?.querySelector(".header-menu[open]")?.removeAttribute("open");

  if (history.replaceState) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth"
  });
}
