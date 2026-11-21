// home page: categories + newest products

async function loadCategories() {
    const box = document.getElementById("category-list");

    const { data, error } = await supabaseClient
        .from("category")
        .select("category_id, name, icon")
        .order("category_id");

    if (error) {
        box.innerHTML = `<p class="empty">Could not load categories.</p>`;
        console.error(error.message);
        return;
    }

    box.innerHTML = data.map(c => `
        <a class="category-card" href="products.html?category=${c.category_id}">
            <img src="${escapeHtml(c.icon || FALLBACK_IMAGE)}" alt="">
            <div>${escapeHtml(c.name)}</div>
        </a>`).join("");
}

async function loadFeatured() {
    const box = document.getElementById("featured-list");

    const { data, error } = await supabaseClient
        .from("product")
        .select("*, category(name)")
        .gt("stock", 0)
        .order("created_at", { ascending: false })
        .limit(8);

    if (error) {
        box.innerHTML = `<p class="empty">Could not load products.</p>`;
        console.error(error.message);
        return;
    }

    box.innerHTML = data.map(productCardHtml).join("");
    bindAddButtons(box, data);
}

document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
    loadFeatured();
});
