// =============================================
// cart.js - shopping cart saved in localStorage
// =============================================

const CART_KEY = "sportzone_cart";

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem(CART_KEY));
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateCartCount();
}

function cartItemCount() {
    return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function cartTotal(cart = getCart()) {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function updateCartCount() {
    const el = document.getElementById("cart-count");
    if (el) el.textContent = cartItemCount();
}

// returns false when the stock limit is reached
function addToCart(product, quantity = 1) {
    const cart = getCart();
    const existing = cart.find(item => item.product_id === product.product_id);
    const current = existing ? existing.quantity : 0;

    if (product.stock <= 0 || current + quantity > product.stock) return false;

    if (existing) {
        existing.quantity += quantity;
        existing.stock = product.stock;
    } else {
        cart.push({
            product_id: product.product_id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url,
            stock: product.stock,
            quantity
        });
    }
    saveCart(cart);
    return true;
}

function setCartQuantity(productId, quantity) {
    let cart = getCart();
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;

    quantity = Math.floor(Number(quantity));
    if (!quantity || quantity < 1) {
        cart = cart.filter(i => i.product_id !== productId);
    } else {
        item.quantity = Math.min(quantity, item.stock);
    }
    saveCart(cart);
}

function removeFromCart(productId) {
    saveCart(getCart().filter(i => i.product_id !== productId));
}

// prices and stock in localStorage can be old (or edited by the user),
// so before showing the cart / checking out we load the real values
async function refreshCartFromDatabase() {
    const cart = getCart();
    if (cart.length === 0) return { cart, changed: false };

    const ids = cart.map(i => i.product_id);
    const { data, error } = await supabaseClient
        .from("product")
        .select("product_id, name, price, stock, image_url")
        .in("product_id", ids);

    if (error) {
        console.error(error.message);
        return { cart, changed: false };
    }

    let changed = false;
    const fresh = [];

    cart.forEach(item => {
        const p = data.find(d => d.product_id === item.product_id);
        if (!p || p.stock <= 0) {
            changed = true; // product deleted or sold out
            return;
        }
        const qty = Math.min(item.quantity, p.stock);
        if (qty !== item.quantity || Number(p.price) !== item.price) changed = true;
        fresh.push({
            product_id: p.product_id,
            name: p.name,
            price: Number(p.price),
            image_url: p.image_url,
            stock: p.stock,
            quantity: qty
        });
    });

    saveCart(fresh);
    return { cart: fresh, changed };
}

// ---------- cart page ----------

async function renderCartPage() {
    const tableBody = document.getElementById("cart-body");
    if (!tableBody) return;

    const { cart, changed } = await refreshCartFromDatabase();

    if (changed) {
        showMessage("cart-msg", "Some prices or stock changed since you added them. Your cart was updated.", "info");
    }

    const emptyBox = document.getElementById("cart-empty");
    const cartBox = document.getElementById("cart-content");

    if (cart.length === 0) {
        emptyBox.classList.remove("hidden");
        cartBox.classList.add("hidden");
        return;
    }
    emptyBox.classList.add("hidden");
    cartBox.classList.remove("hidden");

    tableBody.innerHTML = cart.map(item => `
        <tr>
            <td>
                <div class="cart-product">
                    <img src="${productImage(item)}" alt="" onerror="this.src='${FALLBACK_IMAGE}'">
                    <a href="product-detail.html?id=${item.product_id}">${escapeHtml(item.name)}</a>
                </div>
            </td>
            <td>${formatPrice(item.price)}</td>
            <td><input type="number" class="cart-qty" min="1" max="${item.stock}" value="${item.quantity}" data-qty="${item.product_id}"></td>
            <td>${formatPrice(item.price * item.quantity)}</td>
            <td><button class="btn btn-small btn-danger" data-remove="${item.product_id}">Remove</button></td>
        </tr>`).join("");

    const total = cartTotal(cart);
    document.getElementById("cart-items").textContent = cart.reduce((s, i) => s + i.quantity, 0);
    document.getElementById("cart-subtotal").textContent = formatPrice(total);
    document.getElementById("cart-total").textContent = formatPrice(total);

    tableBody.querySelectorAll("[data-qty]").forEach(input => {
        input.addEventListener("change", () => {
            setCartQuantity(Number(input.dataset.qty), input.value);
            renderCartPage();
        });
    });

    tableBody.querySelectorAll("[data-remove]").forEach(btn => {
        btn.addEventListener("click", () => {
            removeFromCart(Number(btn.dataset.remove));
            renderCartPage();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderCartPage();

    const clearBtn = document.getElementById("clear-cart");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("Remove everything from your cart?")) {
                clearCart();
                renderCartPage();
            }
        });
    }
});
