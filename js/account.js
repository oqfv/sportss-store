// =============================================
// account.js - profile + order history
//   SELECT  customers / orders / order_items
//   UPDATE  customers (profile), orders (cancel)
//   DELETE  orders (remove a pending order)
// RLS only lets the user touch their own rows
// =============================================

let accountUser = null;

async function loadProfile() {
    const profile = await getMyProfile();
    if (!profile) return;

    const form = document.getElementById("profile-form");
    form.fullname.value = profile.full_name || "";
    form.email.value = profile.email || "";
    form.phone.value = profile.phone || "";
    form.address.value = profile.address || "";
}

async function saveProfile(e) {
    e.preventDefault();
    hideMessage("profile-msg");
    const form = e.target;

    const fullName = form.fullname.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();

    if (fullName.length < 3) return showMessage("profile-msg", "Name must be at least 3 characters.");
    if (phone && !/^[0-9+\s-]{7,20}$/.test(phone)) return showMessage("profile-msg", "Phone number looks wrong.");

    const { error } = await supabaseClient
        .from("customers")
        .update({ full_name: fullName, phone: phone || null, address: address || null })
        .eq("customer_id", accountUser.id);

    if (error) return showMessage("profile-msg", "Could not save: " + error.message);
    showMessage("profile-msg", "Profile saved.", "success");
}

function orderHtml(o) {
    const items = o.order_items.map(i => `
        <li><span>${i.quantity} × ${escapeHtml(i.product ? i.product.name : "Deleted product")}</span>
            <span>${formatPrice(i.quantity * i.unit_price)}</span></li>`).join("");

    const actions = o.status === "pending" ? `
        <button class="btn btn-small btn-outline" data-cancel="${o.order_id}">Cancel order</button>
        <button class="btn btn-small btn-danger" data-delete="${o.order_id}">Delete</button>` : "";

    return `
        <div class="order-card">
            <div class="order-head">
                <div>
                    <strong>Order #${o.order_id}</strong>
                    <span class="meta"> · ${formatDate(o.order_date)}</span>
                </div>
                <span class="badge ${o.status}">${o.status}</span>
            </div>
            <ul class="order-items">${items}</ul>
            <div class="summary-line total"><span>Total</span><span>${formatPrice(o.total_amount)}</span></div>
            <div style="display:flex;gap:8px;margin-top:8px">${actions}</div>
        </div>`;
}

async function loadOrders() {
    const box = document.getElementById("orders-list");

    const { data, error } = await supabaseClient
        .from("orders")
        .select("order_id, order_date, status, total_amount, order_items(quantity, unit_price, product(name))")
        .eq("customer_id", accountUser.id)
        .order("order_date", { ascending: false });

    if (error) {
        box.innerHTML = "";
        showMessage("orders-msg", "Could not load your orders.");
        return;
    }

    if (data.length === 0) {
        box.innerHTML = `<p class="empty">No orders yet. <a href="products.html">Go shopping</a></p>`;
        return;
    }

    box.innerHTML = data.map(orderHtml).join("");

    box.querySelectorAll("[data-cancel]").forEach(btn =>
        btn.addEventListener("click", () => cancelOrder(Number(btn.dataset.cancel))));
    box.querySelectorAll("[data-delete]").forEach(btn =>
        btn.addEventListener("click", () => deleteOrder(Number(btn.dataset.delete))));
}

// UPDATE - the database trigger puts the stock back
async function cancelOrder(orderId) {
    if (!confirm(`Cancel order #${orderId}?`)) return;

    const { error } = await supabaseClient
        .from("orders")
        .update({ status: "cancelled" })
        .eq("order_id", orderId);

    if (error) return showMessage("orders-msg", "Could not cancel: " + error.message);
    showMessage("orders-msg", `Order #${orderId} was cancelled.`, "success");
    loadOrders();
}

// DELETE - only allowed for pending orders (RLS policy)
async function deleteOrder(orderId) {
    if (!confirm(`Delete order #${orderId} completely? This can't be undone.`)) return;

    const { error } = await supabaseClient
        .from("orders")
        .delete()
        .eq("order_id", orderId);

    if (error) return showMessage("orders-msg", "Could not delete: " + error.message);
    showMessage("orders-msg", `Order #${orderId} was deleted.`, "success");
    loadOrders();
}

document.addEventListener("DOMContentLoaded", async () => {
    accountUser = await requireLogin();
    if (!accountUser) return;

    loadProfile();
    loadOrders();
    document.getElementById("profile-form").addEventListener("submit", saveProfile);
});
