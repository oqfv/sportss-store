// Supabase connection
// Put your own Project URL and publishable (anon) key here.
// Project Settings -> API in the Supabase dashboard.
// NEVER put the service_role key in this file - it is visible to everyone.

const SUPABASE_URL = "https://edxhfaijfowwjzaqidse.supabase.co";
const SUPABASE_KEY = "sb_publishable_cZeIyCPKK9wlXycir6hmdA_6KuA_azo";

let supabaseClient;

try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) {
    // happens when the values above were not replaced yet
    console.error("Supabase is not configured:", err.message);
    document.addEventListener("DOMContentLoaded", () => {
        const note = document.createElement("div");
        note.className = "message show error";
        note.style.margin = "0";
        note.style.borderRadius = "0";
        note.textContent = "Supabase is not set up yet. Add your project URL and key in js/config.js.";
        document.body.prepend(note);
    });
}
