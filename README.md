# SportZone – Sports Equipment Online Store

INT424 Final Project – **Project 2: Sports Equipment Online Store**

An online store for sports equipment (football, basketball, tennis, fitness and
swimming). Products, customers and orders are stored in a Supabase (PostgreSQL)
database, and users register and log in with Supabase Auth.

- **GitHub repository:** https://github.com/USERNAME/sports-store
- **Live website (GitHub Pages):** https://USERNAME.github.io/sports-store/

## Team

| Name | Student ID |
|------|-----------|
| Student Name | 000000000 |
| Student Name | 000000000 |

## Features

- Product catalogue loaded live from Supabase (no hard-coded products)
- Categories: Football, Basketball, Tennis, Fitness, Swimming
- Search by name, filter by category, sort by price / name / newest
- **Smart search:** several keywords at once (name, brand or description), price
  range, category and availability (in stock / low stock / out of stock), all in one
  database query
- Product details page with description, price, live stock and related products
- Register / login / logout with Supabase Auth
- Shopping cart saved in `localStorage`, checked against the real price and stock before checkout
- Checkout saves the order in `orders` and the products in `order_items`, then shows a confirmation page
- My Account: edit profile, see order history, cancel or delete pending orders
- Admin area: add / edit / delete products and change order status
- Analytics dashboard: total products, orders, sales, customers, most popular
  products, low stock, sales by category, orders by status
- Row Level Security on every table
- Responsive layout for desktop and mobile

## Technologies

| Technology | Used for |
|---|---|
| HTML5 | Pages and forms |
| CSS3 | Styling, responsive layout (grid / flexbox / media queries) |
| JavaScript | All app logic (no framework) |
| Supabase Database | PostgreSQL tables, triggers, functions |
| Supabase Auth | Registration and login |
| Supabase REST API | `supabase-js` calls to PostgREST (`select`, `insert`, `update`, `delete`, `rpc`) |
| Row Level Security | Access rules per user / admin |
| GitHub + GitHub Pages | Source control and hosting |

## Project structure

```
├── index.html               home page
├── products.html            shop + smart search
├── product-detail.html      single product
├── cart.html                shopping cart
├── checkout.html            checkout form
├── order-confirmation.html  order summary after checkout
├── account.html             profile + my orders
├── login.html / register.html
├── about.html
├── dashboard.html           analytics (admin)
├── admin.html               product + order management (admin)
├── css/style.css
├── js/
│   ├── config.js            Supabase URL + publishable key
│   ├── app.js               shared helpers, header, footer
│   ├── auth.js              register / login / logout
│   ├── cart.js              cart (localStorage)
│   ├── checkout.js          creates orders + order_items
│   ├── home.js, products.js, product-detail.js, confirmation.js
│   ├── account.js, dashboard.js, admin.js
├── images/                  category images + logo
├── database/database.sql    tables, triggers, RLS policies, sample data
└── docs/
    ├── ERD.md               entity relationship diagram
    ├── SECURITY.md          security review (5 risks)
    ├── TESTING.md           test checklist
    └── screenshots/
```

## Database structure

| Table | Purpose | Key columns |
|---|---|---|
| `category` | product categories | `category_id` PK |
| `product` | items for sale | `product_id` PK, `category_id` FK → category |
| `customers` | profile for each Auth user | `customer_id` PK/FK → `auth.users.id` |
| `orders` | one row per order | `order_id` PK, `customer_id` FK → customers |
| `order_items` | products in an order | `order_item_id` PK, `order_id` FK → orders, `product_id` FK → product |

Database logic (in `database/database.sql`):

- `handle_new_user` – creates the `customers` row when someone signs up
- `order_items_before_insert` – takes the real price, checks stock, reduces stock
- `recalc_order_total` – keeps `orders.total_amount` correct
- `orders_before_update` / `orders_before_delete` – order status rules, and returning stock when an order is cancelled or deleted
- `get_store_stats()` – dashboard numbers (admins only)

The full diagram is in [docs/ERD.md](docs/ERD.md).

## REST API operations

| Operation | Table | Where |
|---|---|---|
| SELECT | `category`, `product` | home, shop, product details |
| SELECT | `customers`, `orders`, `order_items` | account, confirmation |
| INSERT | `orders`, `order_items` | checkout (`js/checkout.js`) |
| INSERT | `product` | admin |
| UPDATE | `customers` | profile / checkout "save details" |
| UPDATE | `orders.status` | cancel order (customer), change status (admin) |
| UPDATE | `product` | admin edit |
| DELETE | `orders` | delete a pending order (account page) |
| DELETE | `product` | admin |
| RPC | `get_store_stats()`, `is_admin()` | dashboard, menu |

Example from `js/products.js`:

```js
const { data, error } = await supabaseClient
    .from("product")
    .select("*, category(name)")
    .eq("category_id", 1)
    .gte("price", 10)
    .lte("price", 50)
    .gt("stock", 0)
    .order("price", { ascending: true });
```

## How to run the project

### 1. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of `database/database.sql` and click **Run**.
   This creates the tables, triggers, RLS policies and sample products.
3. Optional, to make testing easier: **Authentication → Providers → Email**, turn off
   *Confirm email* so new accounts can log in straight away.
4. **Project Settings → API**: copy the *Project URL* and the *publishable / anon* key.

### 2. Configure the website
Open `js/config.js` and replace the two values:

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_KEY = "your-publishable-or-anon-key";
```

Never use the `service_role` key here.

### 3. Run it locally
Any static server works, for example:

```bash
python -m http.server 8000
# open http://localhost:8000
```

or the **Live Server** extension in VS Code.

### 4. Make an admin account
Register on the site, then run this in the Supabase SQL Editor:

```sql
update customers set is_admin = true where email = 'your@email.com';
```

Log in again and the **Dashboard** and **Manage** links appear.

### 5. Deploy to GitHub Pages
1. Push the code to a **public** GitHub repository.
2. **Settings → Pages → Build and deployment** → Branch `main`, folder `/ (root)` → Save.
3. Open `https://USERNAME.github.io/REPO-NAME/` after a minute or two.
4. In Supabase, **Authentication → URL Configuration**, add the Pages URL as the Site URL so confirmation emails link back correctly.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the five risks we identified and how
RLS policies, triggers and input validation deal with each one.
