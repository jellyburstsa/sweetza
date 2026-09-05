const CONFIG_KEY = "sweetzaProductConfigV1";

const DEFAULT_PRODUCTS = null; // Loaded from store config if available.


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

  if ((section === "Milk Bottles" || name.includes("milk bottle")) && pack === "125g") return AUTHORITATIVE_PRICES.milk125g;
  if ((section === "Milk Bottles" || name.includes("milk bottle")) && pack === "600g") return AUTHORITATIVE_PRICES.milk600g;
  if (pack === "70g") return AUTHORITATIVE_PRICES.gummies70g;
  if (pack === "300g") return AUTHORITATIVE_PRICES.gummies300g;
  if (pack === "900g") return AUTHORITATIVE_PRICES.gummies900g;

  return Number(product?.price || 0);
}

function normalizeProductPrices(list) {
  return list.map(product => ({ ...product, price: authoritativePrice(product) }));
}


function getProducts() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = normalizeProductPrices(parsed);
        localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch (_) {}

  const defaults = Array.isArray(window.SWEETZA_DEFAULT_PRODUCTS)
    ? normalizeProductPrices(JSON.parse(JSON.stringify(window.SWEETZA_DEFAULT_PRODUCTS)))
    : [];

  if (defaults.length) localStorage.setItem(CONFIG_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveProducts(products) {
  products = normalizeProductPrices(products);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(products));
  render();
  showToast("Product changes saved");
}

let products = getProducts();
let editingId = null;

const grid = document.getElementById("productManagerGrid");
const modal = document.getElementById("productModal");
const form = document.getElementById("productForm");
const search = document.getElementById("searchInput");
const sectionFilter = document.getElementById("sectionFilter");

function money(v) {
  const n = Number(v || 0);
  return `R${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;
}

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultPath(section, packSize, name) {
  const folder = section === "Milk Bottles" ? "milk-bottles" : section;
  return `assets/products/${folder}/${slugify(name)}${section === "Milk Bottles" ? "-" + slugify(packSize) : ""}.png`;
}

function statusOf(p) {
  return p.status || (p.active === false ? "hidden" : "available");
}

function renderStats() {
  document.getElementById("totalProducts").textContent = products.length;
  document.getElementById("availableProducts").textContent = products.filter(p => statusOf(p) === "available").length;
  document.getElementById("outProducts").textContent = products.filter(p => statusOf(p) === "out").length;
}

function render() {
  renderStats();
  const q = search.value.trim().toLowerCase();
  const section = sectionFilter.value;

  const filtered = products.filter(p => {
    const matchesSection = section === "all" || p.section === section;
    const matchesSearch = !q || [p.name,p.flavour,p.packSize,p.section].join(" ").toLowerCase().includes(q);
    return matchesSection && matchesSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">No products match this filter. Use <strong>Add Product</strong> to create one.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const status = statusOf(p);
    return `
      <article class="product-manager-card">
        <div class="manager-product-image" onclick="openManagerLightbox('${p.id}')" role="button" tabindex="0" title="Click to enlarge">
          <img src="${p.image || ""}" alt="${p.name}"
               onload="this.style.display='block'; this.nextElementSibling.style.display='none';"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
          <div class="manager-product-fallback" style="display:none">Image unavailable</div>
          <span class="manager-pack-badge">${p.packSize || ""}</span>
          <span class="manager-status ${status}">${status === "available" ? "Available" : status === "out" ? "Out of Stock" : "Hidden"}</span>
        </div>
        <div class="manager-card-body">
          <h3>${p.name}</h3>
          <p>${p.section} • ${p.image || "No image path"}</p>
          <div class="manager-card-price">${money(p.price)}</div>
          <div class="manager-card-actions">
            <button class="ghost-button" onclick="editProduct('${p.id}')">Edit</button>
            <button class="danger-button" onclick="deleteProduct('${p.id}')">Delete</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

function openModal(product = null) {
  editingId = product?.id || null;
  document.getElementById("modalTitle").textContent = product ? "Edit Product" : "Add Product";
  document.getElementById("originalId").value = product?.id || "";
  document.getElementById("productName").value = product?.name || "";
  document.getElementById("productSection").value = product?.section || "70g";
  document.getElementById("productPackSize").value = product?.packSize || "70g";
  document.getElementById("productPrice").value = product?.price ?? "";
  document.getElementById("productStatus").value = product ? statusOf(product) : "available";
  document.getElementById("productImage").value = product?.image || "";
  updatePreview();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  form.reset();
  editingId = null;
}

function updatePreview() {
  const img = document.getElementById("imagePreview");
  const fallback = document.getElementById("previewFallback");
  const path = document.getElementById("productImage").value.trim();
  img.style.display = "none";
  fallback.style.display = "grid";
  if (!path) return;
  img.onload = () => { img.style.display = "block"; fallback.style.display = "none"; };
  img.onerror = () => { img.style.display = "none"; fallback.style.display = "grid"; };
  img.src = path + (path.includes("?") ? "&" : "?") + "v=" + Date.now();
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (p) openModal(p);
}

function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Delete ${p.name} ${p.packSize}?`)) return;
  products = products.filter(x => x.id !== id);
  saveProducts(products);
}

function showToast(text) {
  const t = document.getElementById("managerToast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(window.managerToastTimer);
  window.managerToastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

form.addEventListener("submit", e => {
  e.preventDefault();

  const name = document.getElementById("productName").value.trim();
  const section = document.getElementById("productSection").value;
  const packSize = document.getElementById("productPackSize").value.trim();
  const price = Number(document.getElementById("productPrice").value);
  const status = document.getElementById("productStatus").value;
  let image = document.getElementById("productImage").value.trim();

  if (!image) image = defaultPath(section, packSize, name);

  const id = editingId || `${slugify(section)}-${slugify(packSize)}-${slugify(name)}-${Date.now().toString(36).slice(-4)}`;
  const existing = products.find(p => p.id === editingId);

  const product = {
    ...(existing || {}),
    id,
    section,
    name,
    flavour: name,
    packSize,
    price,
    status,
    active: status !== "hidden",
    image
  };

  if (editingId) {
    products = products.map(p => p.id === editingId ? product : p);
  } else {
    products.push(product);
  }

  saveProducts(products);
  closeModal();
});

document.getElementById("addProductBtn").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
document.getElementById("modalBackdrop").addEventListener("click", closeModal);
document.getElementById("productImage").addEventListener("input", updatePreview);

document.getElementById("productName").addEventListener("blur", () => {
  const image = document.getElementById("productImage");
  if (image.value.trim()) return;
  image.value = defaultPath(
    document.getElementById("productSection").value,
    document.getElementById("productPackSize").value,
    document.getElementById("productName").value
  );
  updatePreview();
});

search.addEventListener("input", render);
sectionFilter.addEventListener("change", render);

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(products, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sweetza-products-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
});

document.getElementById("importInput").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error();
    products = imported;
    saveProducts(products);
    showToast("Product JSON imported");
  } catch {
    alert("That file is not a valid Sweetza product JSON export.");
  }
  e.target.value = "";
});


function openManagerLightbox(id) {
  const p = products.find(x => x.id === id);
  if (!p || !p.image) return;
  const box = document.getElementById("managerImageLightbox");
  const img = document.getElementById("managerLightboxImage");
  const caption = document.getElementById("managerLightboxCaption");
  img.src = p.image;
  img.alt = `${p.name} ${p.packSize}`;
  caption.textContent = `${p.name} • ${p.packSize} • ${money(p.price)}`;
  box.classList.add("open");
  box.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeManagerLightbox() {
  const box = document.getElementById("managerImageLightbox");
  box.classList.remove("open");
  box.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.getElementById("managerLightboxClose")?.addEventListener("click", closeManagerLightbox);
document.getElementById("managerLightboxBackdrop")?.addEventListener("click", closeManagerLightbox);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeManagerLightbox();
});

render();
