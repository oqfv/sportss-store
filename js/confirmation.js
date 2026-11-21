// confirmation.js - shows the order that was just placed
// RLS makes sure you can only open your own order here

async function loadConfirmation() {
    const box = document.getElementById("confirm-box");
    const user = await requireLogin();
    if (!user) return;

    const id = Number(getParam("id"));
    if (!Number.isInteger(id) || id <= 0) {
        box.innerHTML = `<p class="empty">Order not found. <a href="account.html">See my orders</a></p>`;
        return;
    }

    const { data: order, error } = await supabaseClient
        .from("orders")
        .select("order_id, order_date, status, total_amount, shipping_name, shipping_address, payment_method, order_items(quantity, unit_price, product(name))")
        .eq("order_id", id)
        .maybeSingle();

    if (error || !order) {
        box.innerHTML = `<p class="empty">Order not found. <a href="account.html">See my orders</a></p>`;
        return;
    }

    const items = order.order_items.map(i => `
        <li><span>${i.quantity} × ${escapeHtml(i.product.name)}</span><span>${formatPrice(i.quantity * i.unit_price)}</span></li>
    `).join("");

    box.innerHTML = `
        <div class="tick">✓</div>
        <h1>Thank you for your order!</h1>
        <p class="meta">Order #${order.order_id} · ${formatDate(order.order_date)}</p>
        <div style="text-align:left;margin:24px 0">
            <ul class="order-items">${items}</ul>
            <div class="summary-line total"><span>Total</span><span>${formatPrice(order.total_amount)}</span></div>
            <p style="margin-top:14px"><strong>Delivery to:</strong> ${escapeHtml(order.shipping_name)}<br>${escapeHtml(order.shipping_address)}</p>
            <p><strong>Payment:</strong> ${order.payment_method === "card" ? "Card on delivery" : "Cash on delivery"}</p>
            <p><strong>Status:</strong> <span class="badge ${order.status}">${order.status}</span></p>
        </div>
        <a href="account.html" class="btn">View my orders</a>
        <a href="products.html" class="btn btn-outline">Continue shopping</a>`;
}

document.addEventListener("DOMContentLoaded", loadConfirmation);
