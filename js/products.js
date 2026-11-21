// =============================================
// products.js - product list + smart search
// all filtering happens in the database query, not in JS arrays
// =============================================

const filterForm = document.getElementById("filter-form");
const sortSelect = document.getElementById("sort");
let latestRequest = 0;

async function loadCategoryOptions() {
    const { data, error } = await supabaseClient
        .from("category")
        .select("category_id, name")
        .order("name");

    if (error) return console.error(error.message);

    const select = document.getElementById("category");
    data.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.category_id;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
}

// remove characters that mean something in the PostgREST filter syntax
function cleanWord(word) {
    return word.replace(/[%,()*\\.:"']/g, "").trim();
}

function readFilters() {
    return {
        search: filterForm.search.value.trim(),
        category: filterForm.category.value,
        min: filterForm.min.value,
        max: filterForm.max.value,
        availability: filterForm.availability.value,
        sort: sortSelect.value
    };
}

// keep the filters in the url so the page can be shared / refreshed
function writeFiltersToUrl(f) {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([key, value]) => {
        if (value && !(key === "sort" && value === "newest")) params.set(key, value);
    });
    const query = params.toString();
    history.replaceState(null, "", "products.html" + (query ? "?" + query : ""));
}

function readFiltersFromUrl() {
    filterForm.search.value = getParam("search") || "";
    filterForm.min.value = getParam("min") || "";
    filterForm.max.value = getParam("max") || "";
    filterForm.availability.value = getParam("availability") || "";
    filterForm.category.value = getParam("category") || "";
    sortSelect.value = getParam("sort") || "newest";
}

async function loadProducts() {
    const f = readFilters();
    const list = document.getElementById("product-list");
    hideMessage("msg");

    const min = f.min === "" ? null : Number(f.min);
    const max = f.max === "" ? null : Number(f.max);
    if (min !== null && max !== null && min > max) {
        showMessage("msg", "Minimum price can't be higher than maximum price.");
        return;
    }

    writeFiltersToUrl(f);
    list.innerHTML = `<p class="loading">Loading products...</p>`;

    let query = supabaseClient
        .from("product")
        .select("*, category(name)", { count: "exact" });

    // multiple keywords: every word has to appear in the name, brand or description
    const words = f.search.split(/\s+/).map(cleanWord).filter(Boolean);
    words.forEach(w => {
        query = query.or(`name.ilike.%${w}%,brand.ilike.%${w}%,description.ilike.%${w}%`);
    });

    if (f.category) query = query.eq("category_id", Number(f.category));
    if (min !== null) query = query.gte("price", min);
    if (max !== null) query = query.lte("price", max);

    if (f.availability === "in") query = query.gt("stock", 0);
    if (f.availability === "low") query = query.gt("stock", 0).lte("stock", LOW_STOCK_LIMIT);
    if (f.availability === "out") query = query.eq("stock", 0);

    if (f.sort === "price-asc") query = query.order("price", { ascending: true });
    else if (f.sort === "price-desc") query = query.order("price", { ascending: false });
    else if (f.sort === "name-asc") query = query.order("name", { ascending: true });
    else query = query.order("created_at", { ascending: false }).order("product_id", { ascending: false });

    // if the filters changed while we were waiting, a newer request is
    // already running - ignore this (older) answer so it can't overwrite it
    const requestId = ++latestRequest;
    const { data, error, count } = await query;
    if (requestId !== latestRequest) return;

    if (error) {
        console.error(error.message);
        list.innerHTML = "";
        showMessage("msg", "Could not load products. Please try again.");
        return;
    }

    document.getElementById("result-count").textContent =
        `${count} product${count === 1 ? "" : "s"} found`;

    if (data.length === 0) {
        list.innerHTML = `<p class="empty">No products match your search.</p>`;
        return;
    }

    list.innerHTML = data.map(productCardHtml).join("");
    bindAddButtons(list, data);
}

filterForm.addEventListener("submit", e => {
    e.preventDefault();
    loadProducts();
});

// these apply straight away
filterForm.category.addEventListener("change", loadProducts);
filterForm.availability.addEventListener("change", loadProducts);
sortSelect.addEventListener("change", loadProducts);

// search while typing, with a small delay so we don't spam the API
let typingTimer;
filterForm.search.addEventListener("input", () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(loadProducts, 400);
});

document.getElementById("reset-filters").addEventListener("click", () => {
    filterForm.reset();
    sortSelect.value = "newest";
    loadProducts();
});

document.addEventListener("DOMContentLoaded", async () => {
    await loadCategoryOptions();
    readFiltersFromUrl();
    loadProducts();
});
