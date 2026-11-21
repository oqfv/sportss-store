// product-detail.js - one product, loaded by ?id=

async function loadProductDetail() {
    const box = document.getElementById("product-detail");
    const id = Number(getParam("id"));

    if (!Number.isInteger(id) || id <= 0) {
        box.innerHTML = `<p class="empty">Product not found. <a href="products.html">Back to shop</a></p>`;
        return;
    }

    const { data: p, error } = await supabaseClient
        .from("product")
        .select("*, category(category_id, name)")
        .eq("product_id", id)
        .maybeSingle();

    if (error || !p) {
        box.innerHTML = `<p class="empty">Product not found. <a href="products.html">Back to shop</a></p>`;
        if (error) console.error(error.message);
        return;
    }

    document.title = p.name + " - SportZone";
    document.getElementById("breadcrumb").innerHTML = `
        <a href="products.html">Shop</a> /
        <a href="products.html?category=${p.category.category_id}">${escapeHtml(p.category.name)}</a> /
        ${escapeHtml(p.name)}`;

    const soldOut = p.stock <= 0;

    box.innerHTML = `
        <div class="detail">
            <img src="${productImage(p)}" alt="${escapeHtml(p.name)}" onerror="this.src='${FALLBACK_IMAGE}'">
            <div>
                <span class="meta">${escapeHtml(p.brand || "")}</span>
                <h1>${escapeHtml(p.name)}</h1>
                ${stockBadge(p.stock)}
                <p class="price">${formatPrice(p.price)}</p>
                <p class="description">${escapeHtml(p.description || "No description yet.")}</p>

                <div class="qty-row">
                    <label for="qty">Quantity</label>
                    <input type="number" id="qty" min="1" max="${p.stock}" value="1" ${soldOut ? "disabled" : ""}>
                </div>
                <button class="btn" id="add-btn" ${soldOut ? "disabled" : ""}>
                    ${soldOut ? "Out of stock" : "Add to cart"}
                </button>
                <a href="cart.html" class="btn btn-outline">Go to cart</a>
            </div>
        </div>`;

    document.getElementById("add-btn").addEventListener("click", () => {
        const qty = Math.floor(Number(document.getElementById("qty").value));
        if (!qty || qty < 1) {
            showMessage("detail-msg", "Please choose a quantity of at least 1.");
            return;
        }
        if (addToCart(p, qty)) {
            showMessage("detail-msg", `${qty} × ${p.name} added to your cart.`, "success");
        } else {
            showMessage("detail-msg", `Sorry, only ${p.stock} in stock (including what is already in your cart).`);
        }
    });

    loadRelated(p);
}

async function loadRelated(product) {
    const { data, error } = await supabaseClient
        .from("product")
        .select("*, category(name)")
        .eq("category_id", product.category_id)
        .neq("product_id", product.product_id)
        .gt("stock", 0)
        .limit(4);

    if (error || data.length === 0) return;

    const list = document.getElementById("related-list");
    list.innerHTML = data.map(productCardHtml).join("");
    bindAddButtons(list, data);
    document.getElementById("related-section").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", loadProductDetail);
