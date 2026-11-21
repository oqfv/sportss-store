# Testing checklist

Run these on the **deployed GitHub Pages site**, with the browser console open (F12).
Save a screenshot for each one in `docs/screenshots/`.

| # | Test | Steps | Expected result | Screenshot |
|---|------|-------|-----------------|-----------|
| 1 | Pages load | Open every page from the menu | No broken pages, no red errors in the console | `01-home.png` |
| 2 | Products from Supabase | Open Shop | 27 products load; change a price in Supabase and refresh, the new price shows | `02-products.png` |
| 3 | Category filter | Click a category on Home or pick one in Shop | Only that category is shown | `03-category.png` |
| 4 | Search by name | Type `ball` | Only matching products | `04-search.png` |
| 5 | Smart search | `nike`, category Football, price 40–200 AED, In stock only | Combined filters work, URL keeps the filters | `05-smart-search.png` |
| 6 | Sort | Price low to high / high to low | Order changes correctly | `06-sort.png` |
| 7 | Product details | Click a product | Description, price, stock and related products | `07-detail.png` |
| 8 | Register | Create a new account | Success; a row appears in `customers` | `08-register.png` |
| 9 | Login / logout | Log in, then log out | Menu changes (My Account / Login) | `09-login.png` |
| 10 | Protected page | Log out and open `checkout.html` | Sent to the login page | `10-redirect.png` |
| 11 | Cart | Add items, change quantity, remove, refresh the page | Cart stays (localStorage), totals are correct, can't go over stock | `11-cart.png` |
| 12 | Checkout | Place an order | Confirmation page; new rows in `orders` + `order_items`; stock goes down | `12-confirm.png` |
| 13 | UPDATE | Edit profile / cancel a pending order | Saved; stock goes back up after cancelling | `13-update.png` |
| 14 | DELETE | Delete a pending order | Order removed from the table | `14-delete.png` |
| 15 | RLS: other user's data | Log in as user B | B can't see A's orders | `15-rls.png` |
| 16 | RLS: not an admin | As a normal user, run in the console:<br>`await supabaseClient.from("product").update({price:1}).eq("product_id",1).select()` | Returns `[]`, nothing changes | `16-rls-console.png` |
| 17 | Admin CRUD | As admin: add, edit and delete a product | Works, and the changes show in Shop | `17-admin.png` |
| 18 | Dashboard | As admin: open Dashboard | Totals, top products, low stock, sales by category | `18-dashboard.png` |
| 19 | Mobile | DevTools device mode (iPhone) | Menu button, single column layout | `19-mobile.png` |
| 20 | Invalid input | Register with a short password / checkout with no address | Clear error message, nothing is saved | `20-validation.png` |

## Database logic

We tested the SQL file (all triggers and RLS policies) with two fake users and
an admin. All 30 checks passed. Examples:

- user B can't read, change, delete or add items to user A's order
- a fake `unit_price` / `total_amount` / `status` sent by the client is ignored
- ordering more than the stock fails
- cancelling or deleting a pending order returns the stock exactly once
- normal users can't change products, run `get_store_stats()` or make themselves admin
