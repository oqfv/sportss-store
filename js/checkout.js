// =============================================
// checkout.js - turns the cart into an order
//   INSERT into orders      (one row)
//   INSERT into order_items (one row per product)
// prices, stock and the order total are checked again
// by triggers in the database, the browser is not trusted
// =============================================

let checkoutUser = null;

function renderCheckoutSummary(cart) {
    document.getElementById("checkout-items").innerHTML = cart.map(i => `
        <li><span>${i.quantity} × ${escapeHtml(i.name)}</span><span>${formatPrice(i.price * i.quantity)}</span></li>
    `).join("");
    document.getElementById("checkout-total").textContent = formatPrice(cartTotal(cart));
}

async function prefillFromProfile() {
    const profile = await getMyProfile();
    if (!profile) return;
    const form = document.getElementById("checkout-form");
    form.fullname.value = profile.full_name || "";
    form.phone.value = profile.phone || "";
    form.address.value = profile.address || "";
}

function validateCheckout(form) {
    const name = form.fullname.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();

    if (name.length < 3) return "Please enter the name for the delivery.";
    if (!/^[0-9+\s-]{7,20}$/.test(phone)) return "Please enter a valid phone number.";
    if (address.length < 10) return "Please enter the full delivery address.";
    return null;
}

async function placeOrder(e) {
    e.preventDefault();
    hideMessage("checkout-msg");
    const form = e.target;

    const problem = validateCheckout(form);
    if (problem) return showMessage("checkout-msg", problem);

    const btn = document.getElementById("place-order");
    btn.disabled = true;
    btn.textContent = "Placing order...";

    try {
        // make sure prices / stock are current before we save anything
        const { cart, changed } = await refreshCartFromDatabase();
        if (cart.length === 0) {
            window.location.href = "cart.html";
            return;
        }
        if (changed) {
            renderCheckoutSummary(cart);
            showMessage("checkout-msg", "Your cart was updated with the latest prices and stock. Please check it and press Place order again.", "info");
            return;
        }

        const shipping = {
            shipping_name: form.fullname.value.trim(),
            shipping_phone: form.phone.value.trim(),
            shipping_address: form.address.value.trim(),
            payment_method: form.payment.value
        };

        // 1) INSERT the order
        const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .insert({ customer_id: checkoutUser.id, ...shipping })
            .select("order_id")
            .single();

        if (orderError) throw orderError;

        // 2) INSERT the items (unit_price is filled in by the database)
        const items = cart.map(i => ({
            order_id: order.order_id,
            product_id: i.product_id,
            quantity: i.quantity
        }));

        const { error: itemsError } = await supabaseClient.from("order_items").insert(items);

        if (itemsError) {
            // something went wrong (e.g. someone bought the last one) -> remove the empty order
            await supabaseClient.from("orders").delete().eq("order_id", order.order_id);
            throw itemsError;
        }

        // 3) optional UPDATE of the customer's profile
        if (form.save.checked) {
            await supabaseClient
                .from("customers")
                .update({ phone: shipping.shipping_phone, address: shipping.shipping_address })
                .eq("customer_id", checkoutUser.id);
        }

        clearCart();
        window.location.href = "order-confirmation.html?id=" + order.order_id;
    } catch (err) {
        console.error(err);
        const text = err.message && err.message.includes("Not enough stock")
            ? "Sorry, one of the products just sold out. Please check your cart."
            : "Could not place your order: " + (err.message || "unknown error");
        showMessage("checkout-msg", text);
    } finally {
        btn.disabled = false;
        btn.textContent = "Place order";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    checkoutUser = await requireLogin();
    if (!checkoutUser) return;

    const { cart } = await refreshCartFromDatabase();
    if (cart.length === 0) {
        window.location.href = "cart.html";
        return;
    }

    renderCheckoutSummary(cart);
    prefillFromProfile();
    document.getElementById("checkout-form").addEventListener("submit", placeOrder);
});
