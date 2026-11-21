// Supabase connection
// Put your own Project URL and publishable (anon) key here.
// Project Settings -> API in the Supabase dashboard.
// NEVER put the service_role key in this file - it is visible to everyone.

const SUPABASE_URL = "YOUR_PROJECT_URL";
const SUPABASE_KEY = "YOUR_PUBLISHABLE_OR_ANON_KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
