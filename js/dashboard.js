// =============================================
// dashboard.js - analytics for admins
// calls the get_store_stats() function in Supabase (rpc)
// =============================================

// simple horizontal bar chart made with divs
function barsHtml(rows, labelKey, valueKey, format = v => v) {
    if (!rows || rows.length === 0) return `<p class="empty">No data yet.</p>`;

    const max = Math.max(...rows.map(r => Number(r[valueKey])), 1);
    return rows.map(r => {
        const value = Number(r[valueKey]);
        const width = Math.round((value / max) * 100);
        return `
            <div class="bar-row">
                <span>${escapeHtml(r[labelKey])}</span>
                <div class="bar"><span style="width:${width}%"></span></div>
                <span class="num">${format(value)}</span>
            </div>`;
    }).join("");
}

async function loadDashboard() {
    const user = await requireLogin();
    if (!user) return;

    if (!(await isCurrentUserAdmin())) {
        showMessage("dash-msg", "The dashboard is only available to store admins.");
        return;
    }

    const { data: s, error } = await supabaseClient.rpc("get_store_stats");

    if (error) {
        showMessage("dash-msg", "Could not load statistics: " + error.message);
        return;
    }

    document.getElementById("s-products").textContent = s.total_products;
    document.getElementById("s-orders").textContent = s.total_orders;
    document.getElementById("s-sales").textContent = formatPrice(s.total_sales);
    document.getElementById("s-customers").textContent = s.total_customers;
    document.getElementById("s-stock-value").textContent = formatPrice(s.stock_value);

    document.getElementById("top-products").innerHTML =
        barsHtml(s.top_products, "name", "sold", v => v + " sold");

    document.getElementById("by-category").innerHTML =
        barsHtml(s.sales_by_category, "name", "revenue", formatPrice);

    const statusRows = Object.entries(s.orders_by_status || {}).map(([status, n]) => ({ status, n }));
    document.getElementById("by-status").innerHTML = barsHtml(statusRows, "status", "n");

    const low = document.getElementById("low-stock");
    low.innerHTML = s.low_stock.length === 0
        ? `<tr><td colspan="2" class="empty">Everything is well stocked.</td></tr>`
        : s.low_stock.map(p => `
            <tr>
                <td><a href="product-detail.html?id=${p.product_id}">${escapeHtml(p.name)}</a></td>
                <td>${stockBadge(p.stock)}</td>
            </tr>`).join("");

    document.getElementById("dashboard").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", loadDashboard);
