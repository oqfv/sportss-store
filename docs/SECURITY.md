# Security Review

Five security risks we found in the store and how we handled each one.

---

## 1. Exposing the Supabase service-role key

**What the risk is:** Supabase gives every project two kinds of keys. The
publishable / anon key is meant for the browser. The `service_role` key skips
every Row Level Security rule.

**Why it is dangerous:** Our site runs on GitHub Pages, so anyone can read every
JavaScript file. If the service-role key were in `js/config.js`, any visitor
could read, change or delete all customers, orders and products.

**How we prevent it:**
- `js/config.js` holds only the project URL and the publishable (anon) key.
- The service-role key and the database password are not anywhere in the repository.
- Because the anon key is public anyway, we never rely on keeping it secret. All
  protection is done with RLS in the database (see risks 2–5).

---

## 2. Unauthorized access to customer records

**What the risk is:** The `customers` and `orders` tables hold names, emails,
phone numbers and addresses. Without rules, the public anon key could be used to
call `GET /rest/v1/customers` and download everything.

**Why it is dangerous:** It would leak private customer information, which is a
privacy and legal problem.

**How we prevent it:**
- RLS is enabled on **all five tables**.
- `customers`: a user can only `SELECT` the row where `customer_id = auth.uid()`.
- `orders` and `order_items`: users only see their own orders (checked by
  `orders.customer_id = auth.uid()`).
- The `anon` role has no policies on these tables at all, so logged-out
  visitors get nothing.
- The dashboard uses the `get_store_stats()` function. It returns totals only
  (counts and sums), never names or addresses. It checks `is_admin()` first, and
  we removed the default `PUBLIC` execute permission from it.

```sql
create policy "customers read own" on customers for select to authenticated
    using (customer_id = auth.uid() or is_admin());
```

---

## 3. Users changing another user's orders (or their own prices)

**What the risk is:** Someone could send requests by hand (for example from the
browser console) to change another person's order, mark their own order as
"delivered", or set the price of an item to $0.01.

**Why it is dangerous:** Customers could get goods for free or interfere with
other people's orders.

**How we prevent it:**
- RLS `insert`/`update`/`delete` policies on `orders` require
  `customer_id = auth.uid()`. Items can only be added to **your own pending** order.
- The browser never decides the price. The trigger `order_items_before_insert`
  copies the real price from `product`, checks the stock and reduces it, all inside
  the database.
- `orders.total_amount` is always calculated by the `recalc_order_total` trigger.
  If someone sends a total or status in the insert, the `orders_before_insert`
  trigger overwrites it.
- The `orders_before_update` trigger only lets a customer change the status from
  `pending` to `cancelled`. Only admins can mark orders as paid, shipped or delivered.

We tested this with two accounts: user B can't see, change or delete user A's
orders, and a fake `unit_price` sent from the browser is ignored.

---

## 4. Invalid or incomplete form data

**What the risk is:** Forms could be submitted empty, with wrong values (negative
stock, quantity 0, a bad email), or with HTML/JavaScript code in text fields
(cross-site scripting).

**Why it is dangerous:** Bad data breaks orders and reports. Script code saved
in a product name or address could run in other users' browsers.

**How we prevent it:**
- **Client side:** register, login, checkout, profile and admin forms check the
  values before sending them (email format, password of at least 8 characters with
  letters and numbers, phone format, address length, price ≥ 0, whole-number stock).
- **Database side:** `NOT NULL`, `CHECK (price >= 0)`, `CHECK (stock >= 0)`,
  `CHECK (quantity > 0)`, allowed values for `status` and `payment_method`, plus
  `UNIQUE` and foreign keys. These still apply if someone skips the website and
  calls the API directly.
- **Output:** all text from the database goes through `escapeHtml()` before it is
  put into the page, so `<script>` shows up as plain text.
- Product image links must be a file in `images/` or an `https://` URL.
- The login redirect parameter only accepts our own `.html` pages, which
  stops open redirects.

---

## 5. Unauthorized database updates or deletions

**What the risk is:** Any logged-in user could try to insert, edit or delete
products or categories, or make themselves an admin by updating `customers.is_admin`.

**Why it is dangerous:** An attacker could change prices, delete the catalogue
or take over the admin dashboard.

**How we prevent it:**
- `product` and `category` can be read by everyone, but `INSERT`, `UPDATE` and
  `DELETE` policies all require `is_admin()`.
- `is_admin()` is a `SECURITY DEFINER` function that reads the flag of the
  current user.
- The `customers_before_update` trigger resets `is_admin` and `email` to their
  old values when a normal user tries to change them. Admins can only be created
  by the project owner in the SQL editor.
- Hiding the Dashboard and Manage links is only for looks. The real check is in
  the database, so calling the API directly gets the same "permission denied"
  result.
- Deleting a product that appears in past orders is blocked by the foreign key
  (`on delete restrict`), so order history is never lost.

---

## Other things we did

- No card numbers are collected (payment is cash or card on delivery).
- Supabase Auth hashes the passwords. We never store them ourselves.
- The site is served over HTTPS by GitHub Pages.
