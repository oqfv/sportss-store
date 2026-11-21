// =============================================
// app.js - shared code used on every page
// (header, footer, helpers)
// =============================================

const STORE_NAME = "SportZone";
const LOW_STOCK_LIMIT = 5;
const FALLBACK_IMAGE = "images/logo.svg";

// ---------- small helpers ----------

function formatPrice(value) {
    return "$" + Number(value).toFixed(2);
}

// avoid putting raw database text straight into innerHTML
function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(value) {
    return new Date(value).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function showMessage(elementId, text, type = "error") {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = "message show " + type;
}

function hideMessage(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.className = "message";
}

function stockBadge(stock) {
    if (stock <= 0) return '<span class="stock out">Out of stock</span>';
    if (stock <= LOW_STOCK_LIMIT) return `<span class="stock low">Only ${stock} left</span>`;
    return `<span class="stock in">In stock (${stock})</span>`;
}

function productImage(product) {
    return product.image_url ? escapeHtml(product.image_url) : FALLBACK_IMAGE;
}

// html for one product card, used on home + products pages
function productCardHtml(p) {
    const categoryName = p.category ? p.category.name : "";
    const disabled = p.stock <= 0 ? "disabled" : "";
    return `
        <article class="product-card">
            <a href="product-detail.html?id=${p.product_id}">
                <img src="${productImage(p)}" alt="${escapeHtml(p.name)}" onerror="this.src='${FALLBACK_IMAGE}'">
            </a>
            <div class="body">
                <span class="meta">${escapeHtml(categoryName)} · ${escapeHtml(p.brand || "")}</span>
                <h3><a href="product-detail.html?id=${p.product_id}">${escapeHtml(p.name)}</a></h3>
                ${stockBadge(p.stock)}
                <div class="bottom">
                    <span class="price">${formatPrice(p.price)}</span>
                    <button class="btn btn-small" data-add="${p.product_id}" ${disabled}>Add to cart</button>
                </div>
            </div>
        </article>`;
}

// "Add to cart" buttons inside a product list
// products is the array that was used to render the list
function bindAddButtons(container, products) {
    container.querySelectorAll("[data-add]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = Number(btn.dataset.add);
            const product = products.find(p => p.product_id === id);
            if (!product) return;
            const ok = addToCart(product, 1);
            btn.textContent = ok ? "Added ✓" : "Max reached";
            setTimeout(() => (btn.textContent = "Add to cart"), 1200);
        });
    });
}

// ---------- header & footer ----------

function renderHeader() {
    const header = document.getElementById("site-header");
    if (!header) return;

    const page = window.location.pathname.split("/").pop() || "index.html";
    const anchor = (href, text) =>
        `<a href="${href}" class="${page === href ? "active" : ""}">${text}</a>`;
    const link = (href, text) => `<li>${anchor(href, text)}</li>`;

    header.className = "site-header";
    header.innerHTML = `
        <div class="container nav">
            <a href="index.html" class="logo">
                <img src="images/logo.svg" alt="">
                <span>${STORE_NAME}</span>
            </a>
            <button class="menu-toggle" id="menu-toggle" aria-label="Open menu">☰</button>
            <ul class="nav-links" id="nav-links">
                ${link("index.html", "Home")}
                ${link("products.html", "Shop")}
                ${link("about.html", "About")}
                <li id="nav-admin" class="hidden">${anchor("dashboard.html", "Dashboard")}</li>
                <li id="nav-admin2" class="hidden">${anchor("admin.html", "Manage")}</li>
                <li id="nav-guest-login">${anchor("login.html", "Login")}</li>
                <li id="nav-guest-register">${anchor("register.html", "Register")}</li>
                <li id="nav-user" class="hidden">${anchor("account.html", "My Account")}</li>
                <li id="nav-logout" class="hidden"><a href="#" id="logout-link">Logout</a></li>
                <li><a href="cart.html" class="cart-link ${page === "cart.html" ? "active" : ""}">Cart<span class="cart-count" id="cart-count">0</span></a></li>
            </ul>
        </div>`;

    document.getElementById("menu-toggle").addEventListener("click", () => {
        document.getElementById("nav-links").classList.toggle("open");
    });

    updateCartCount();
    updateAuthNav();
}

function renderFooter() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    footer.className = "site-footer";
    footer.innerHTML = `
        <div class="container">
            <span>© ${new Date().getFullYear()} ${STORE_NAME} · INT424 Final Project</span>
            <span><a href="products.html">Shop</a> · <a href="about.html">About</a> · <a href="cart.html">Cart</a></span>
        </div>`;
}

// show the right links depending on login state
async function updateAuthNav() {
    const { data } = await supabaseClient.auth.getSession();
    const loggedIn = !!data.session;

    document.getElementById("nav-guest-login").classList.toggle("hidden", loggedIn);
    document.getElementById("nav-guest-register").classList.toggle("hidden", loggedIn);
    document.getElementById("nav-user").classList.toggle("hidden", !loggedIn);
    document.getElementById("nav-logout").classList.toggle("hidden", !loggedIn);

    if (loggedIn) {
        document.getElementById("logout-link").addEventListener("click", async e => {
            e.preventDefault();
            await logoutUser();
        });

        const admin = await isCurrentUserAdmin();
        document.getElementById("nav-admin").classList.toggle("hidden", !admin);
        document.getElementById("nav-admin2").classList.toggle("hidden", !admin);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
});
