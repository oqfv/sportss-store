// =============================================
// auth.js - register / login / logout with Supabase Auth
// =============================================

async function getCurrentUser() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session ? data.session.user : null;
}

// used on pages that need a logged in user (checkout, account ...)
// sends the user to login and brings them back afterwards
async function requireLogin() {
    const user = await getCurrentUser();
    if (!user) {
        const back = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
        window.location.href = "login.html?redirect=" + back;
        return null;
    }
    return user;
}

// SELECT from customers - RLS only returns the row of the logged in user
async function getMyProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
        .from("customers")
        .select("*")
        .eq("customer_id", user.id)
        .single();

    if (error) {
        console.error("profile error:", error.message);
        return null;
    }
    return data;
}

async function isCurrentUserAdmin() {
    const { data, error } = await supabaseClient.rpc("is_admin");
    if (error) return false;
    return data === true;
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

// only allow redirects to our own pages
function safeRedirect(target) {
    if (target && /^[a-z0-9-]+\.html(\?[a-z0-9=&_-]*)?$/i.test(target)) return target;
    return "index.html";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- register page ----------

function setupRegisterForm() {
    const form = document.getElementById("register-form");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        hideMessage("register-msg");

        const fullName = form.full_name.value.trim();
        const email = form.email.value.trim().toLowerCase();
        const phone = form.phone.value.trim();
        const password = form.password.value;
        const confirm = form.confirm.value;

        // validation before anything goes to the server
        if (fullName.length < 3) return showMessage("register-msg", "Please enter your full name.");
        if (!isValidEmail(email)) return showMessage("register-msg", "Please enter a valid email address.");
        if (phone && !/^[0-9+\s-]{7,20}$/.test(phone)) return showMessage("register-msg", "Phone number looks wrong.");
        if (password.length < 8) return showMessage("register-msg", "Password must be at least 8 characters.");
        if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password))
            return showMessage("register-msg", "Password needs letters and numbers.");
        if (password !== confirm) return showMessage("register-msg", "Passwords do not match.");

        const btn = form.querySelector("button");
        btn.disabled = true;
        btn.textContent = "Creating account...";

        // full_name + phone go into user metadata,
        // the handle_new_user trigger copies them to the customers table
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, phone } }
        });

        btn.disabled = false;
        btn.textContent = "Create account";

        if (error) return showMessage("register-msg", error.message);

        if (data.session) {
            // email confirmation is turned off -> already logged in
            window.location.href = "products.html";
        } else {
            form.reset();
            showMessage("register-msg", "Account created! Check your email to confirm it, then log in.", "success");
        }
    });
}

// ---------- login page ----------

function setupLoginForm() {
    const form = document.getElementById("login-form");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        hideMessage("login-msg");

        const email = form.email.value.trim().toLowerCase();
        const password = form.password.value;

        if (!isValidEmail(email) || !password)
            return showMessage("login-msg", "Enter your email and password.");

        const btn = form.querySelector("button");
        btn.disabled = true;
        btn.textContent = "Logging in...";

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        btn.disabled = false;
        btn.textContent = "Login";

        if (error) return showMessage("login-msg", "Login failed: " + error.message);

        window.location.href = safeRedirect(getParam("redirect"));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupRegisterForm();
    setupLoginForm();
});
