// =============================================
// admin.js - product management (full CRUD) + order status
//   INSERT / UPDATE / DELETE on product
//   UPDATE on orders.status
// the RLS policies only allow this for customers.is_admin = true,
// hiding the page is just for the UI - the database does the real check
// =============================================

const productForm = document.getElementById("product-form");
let adminProducts = [];
const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

async function loadAdminCategories() {
    const { data, error } = await supabaseClient.from("category").select("category_id, name").order("name");
    if (error) return console.error(error.message);

    productForm.category_id.innerHTML = data
        .map(c => `<option value="${c.category_id}">${escapeHtml(c.name)}</option>`)
        .join("");
}

async function loadAdminProducts() {
    const { data, error } = await supabaseClient
        .from("product")
        .select("*, category(name)")
        .order("product_id");

    if (error) return showMessage("admin-msg", "Could not load products: " + error.message);
    adminProducts = data;

    const body = document.getElementById("admin-products");
    body.innerHTML = data.map(p => `
        <tr>
            <td>${p.product_id}</td>
            <td><a href="product-detail.html?id=${p.product_id}">${escapeHtml(p.name)}</a></td>
            <td>${escapeHtml(p.category ? p.category.name : "")}</td>
            <td>${formatPrice(p.price)}</td>
            <td>${stockBadge(p.stock)}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-small btn-outline" data-edit="${p.product_id}">Edit</button>
                <button class="btn btn-small btn-danger" data-del="${p.product_id}">Delete</button>
            </td>
        </tr>`).join("");

    body.querySelectorAll("[data-edit]").forEach(b =>
        b.addEventListener("click", () => startEdit(Number(b.dataset.edit))));
    body.querySelectorAll("[data-del]").forEach(b =>
        b.addEventListener("click", () => deleteProduct(Number(b.dataset.del))));
}

function startEdit(id) {
    const p = adminProducts.find(x => x.product_id === id);
    if (!p) return;

    productForm.product_id.value = p.product_id;
    productForm.pname.value = p.name;
    productForm.brand.value = p.brand || "";
    productForm.category_id.value = p.category_id;
    productForm.image_url.value = p.image_url || "";
    productForm.price.value = p.price;
    productForm.stock.value = p.stock;
    productForm.description.value = p.description || "";

    document.getElementById("form-title").textContent = "Edit product #" + p.product_id;
    document.getElementById("save-btn").textContent = "Save changes";
    document.getElementById("cancel-edit").classList.remove("hidden");
    productForm.scrollIntoView({ behavior: "smooth" });
}

function resetProductForm() {
    productForm.reset();
    productForm.product_id.value = "";
    document.getElementById("form-title").textContent = "Add a product";
    document.getElementById("save-btn").textContent = "Add product";
    document.getElementById("cancel-edit").classList.add("hidden");
}

// only local images or https links, nothing like javascript:
function isSafeImageUrl(url) {
    return url === "" || /^images\/[a-z0-9_.-]+$/i.test(url) || /^https:\/\/[^\s"'<>]+$/i.test(url);
}

async function saveProduct(e) {
    e.preventDefault();
    hideMessage("admin-msg");

    const record = {
        name: productForm.pname.value.trim(),
        brand: productForm.brand.value.trim() || null,
        category_id: Number(productForm.category_id.value),
        image_url: productForm.image_url.value.trim() || null,
        price: Number(productForm.price.value),
        stock: Number(productForm.stock.value),
        description: productForm.description.value.trim() || null
    };

    if (record.name.length < 2) return showMessage("admin-msg", "Product name is required.");
    if (!record.category_id) return showMessage("admin-msg", "Choose a category.");
    if (productForm.price.value === "" || isNaN(record.price) || record.price < 0)
        return showMessage("admin-msg", "Price must be 0 or more.");
    if (productForm.stock.value === "" || !Number.isInteger(record.stock) || record.stock < 0)
        return showMessage("admin-msg", "Stock must be a whole number, 0 or more.");
    if (!isSafeImageUrl(record.image_url || ""))
        return showMessage("admin-msg", "Image must be a file in images/ or an https:// link.");

    const id = Number(productForm.product_id.value);
    let result;

    if (id) {
        // UPDATE
        result = await supabaseClient.from("product").update(record).eq("product_id", id).select();
    } else {
        // INSERT
        result = await supabaseClient.from("product").insert(record).select();
    }

    if (result.error) return showMessage("admin-msg", "Save failed: " + result.error.message);
    if (!result.data || result.data.length === 0)
        return showMessage("admin-msg", "Nothing was saved - you might not have admin rights.");

    showMessage("admin-msg", id ? "Product updated." : "Product added.", "success");
    resetProductForm();
    loadAdminProducts();
}

// DELETE
async function deleteProduct(id) {
    const p = adminProducts.find(x => x.product_id === id);
    if (!confirm(`Delete "${p ? p.name : id}"?`)) return;

    const { data, error } = await supabaseClient.from("product").delete().eq("product_id", id).select();

    if (error) {
        // foreign key: product is part of an order
        const msg = error.code === "23503"
            ? "This product is in existing orders, so it can't be deleted. Set the stock to 0 instead."
            : error.message;
        return showMessage("admin-msg", msg);
    }
    if (!data || data.length === 0) return showMessage("admin-msg", "Nothing was deleted.");

    showMessage("admin-msg", "Product deleted.", "success");
    loadAdminProducts();
}

async function loadAdminOrders() {
    const { data, error } = await supabaseClient
        .from("orders")
        .select("order_id, order_date, status, total_amount, shipping_name")
        .order("order_date", { ascending: false })
        .limit(50);

    const body = document.getElementById("admin-orders");
    if (error) {
        body.innerHTML = `<tr><td colspan="5">Could not load orders.</td></tr>`;
        return;
    }
    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="empty">No orders yet.</td></tr>`;
        return;
    }

    body.innerHTML = data.map(o => `
        <tr>
            <td>${o.order_id}</td>
            <td>${formatDate(o.order_date)}</td>
            <td>${escapeHtml(o.shipping_name)}</td>
            <td>${formatPrice(o.total_amount)}</td>
            <td>
                <select data-status="${o.order_id}" ${o.status === "cancelled" ? "disabled" : ""}>
                    ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
                </select>
            </td>
        </tr>`).join("");

    body.querySelectorAll("[data-status]").forEach(sel => {
        sel.addEventListener("change", async () => {
            const orderId = Number(sel.dataset.status);
            if (sel.value === "cancelled" && !confirm(`Cancel order #${orderId}? Stock will be returned.`)) {
                loadAdminOrders();
                return;
            }
            const { error } = await supabaseClient
                .from("orders")
                .update({ status: sel.value })
                .eq("order_id", orderId);

            if (error) showMessage("admin-msg", "Status not changed: " + error.message);
            else showMessage("admin-msg", `Order #${orderId} is now ${sel.value}.`, "success");
            loadAdminOrders();
            loadAdminProducts(); // stock may have changed
        });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireLogin();
    if (!user) return;

    if (!(await isCurrentUserAdmin())) {
        showMessage("admin-msg", "Only store admins can manage products.");
        return;
    }

    document.getElementById("admin-area").classList.remove("hidden");
    await loadAdminCategories();
    loadAdminProducts();
    loadAdminOrders();

    productForm.addEventListener("submit", saveProduct);
    document.getElementById("cancel-edit").addEventListener("click", resetProductForm);
});
