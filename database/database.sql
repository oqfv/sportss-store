-- =========================================================
--  Sports Store - database schema (Supabase / PostgreSQL)
--  Run this whole file in the Supabase SQL Editor.
-- =========================================================

-- clean re-run (careful: deletes data)
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists product cascade;
drop table if exists category cascade;
drop table if exists customers cascade;

-- ---------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------

create table category (
    category_id   serial primary key,
    name          varchar(60)  not null unique,
    description   text,
    icon          varchar(100)
);

create table product (
    product_id    serial primary key,
    category_id   int not null references category(category_id) on delete restrict,
    name          varchar(120) not null,
    brand         varchar(60),
    description   text,
    price         numeric(10,2) not null check (price >= 0),   -- in AED
    stock         int not null default 0 check (stock >= 0),
    image_url     text,
    created_at    timestamptz not null default now()
);

-- one row per registered user, linked to Supabase Auth
create table customers (
    customer_id   uuid primary key references auth.users(id) on delete cascade,
    full_name     varchar(100) not null,
    email         varchar(150) not null unique,
    phone         varchar(30),
    address       text,
    is_admin      boolean not null default false,
    created_at    timestamptz not null default now()
);

create table orders (
    order_id          serial primary key,
    customer_id       uuid not null references customers(customer_id) on delete cascade,
    order_date        timestamptz not null default now(),
    status            varchar(20) not null default 'pending'
                      check (status in ('pending','paid','shipped','delivered','cancelled')),
    total_amount      numeric(10,2) not null default 0 check (total_amount >= 0),
    shipping_name     varchar(100) not null,
    shipping_address  text not null,
    shipping_phone    varchar(30) not null,
    payment_method    varchar(20) not null default 'cash'
                      check (payment_method in ('cash','card'))
);

create table order_items (
    order_item_id serial primary key,
    order_id      int not null references orders(order_id) on delete cascade,
    product_id    int not null references product(product_id) on delete restrict,
    quantity      int not null check (quantity > 0),
    unit_price    numeric(10,2) not null default 0 check (unit_price >= 0),
    unique (order_id, product_id)
);

create index idx_product_category on product(category_id);
create index idx_orders_customer  on orders(customer_id);
create index idx_items_order      on order_items(order_id);
create index idx_items_product    on order_items(product_id);

-- ---------------------------------------------------------
-- FUNCTIONS & TRIGGERS
-- ---------------------------------------------------------

-- helper used by the RLS policies: is the logged in user an admin?
-- security definer so it can read customers without hitting RLS recursion
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select is_admin from customers where customer_id = auth.uid()),
        false
    );
$$;

-- when someone signs up through Supabase Auth, create their customers row
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into customers (customer_id, full_name, email, phone)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email,
        new.raw_user_meta_data->>'phone'
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- new orders always start as pending with total 0
-- (the total is calculated from order_items, never trusted from the browser)
create or replace function orders_before_insert()
returns trigger
language plpgsql
as $$
begin
    new.status       := 'pending';
    new.total_amount := 0;
    new.order_date   := now();
    return new;
end;
$$;

create trigger trg_orders_before_insert
    before insert on orders
    for each row execute function orders_before_insert();

-- before an item is added: take the real price from product,
-- check that there is enough stock and reduce it
create or replace function order_items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    p_price numeric(10,2);
    p_stock int;
begin
    select price, stock into p_price, p_stock
    from product
    where product_id = new.product_id
    for update;

    if not found then
        raise exception 'Product % does not exist', new.product_id;
    end if;

    if p_stock < new.quantity then
        raise exception 'Not enough stock for product % (only % left)', new.product_id, p_stock;
    end if;

    new.unit_price := p_price;

    update product set stock = stock - new.quantity
    where product_id = new.product_id;

    return new;
end;
$$;

create trigger trg_items_before_insert
    before insert on order_items
    for each row execute function order_items_before_insert();

-- keep orders.total_amount in sync with its items
create or replace function recalc_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    oid int;
begin
    oid := coalesce(new.order_id, old.order_id);
    update orders
    set total_amount = coalesce(
        (select sum(quantity * unit_price) from order_items where order_id = oid), 0)
    where order_id = oid;
    return null;
end;
$$;

create trigger trg_items_total
    after insert or delete on order_items
    for each row execute function recalc_order_total();

-- if a single item is removed from an open order, give the stock back.
-- (when the whole order is deleted the parent row is already gone here,
--  so the stock is handled by orders_before_delete instead -> no double counting)
create or replace function order_items_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if exists (select 1 from orders
               where order_id = old.order_id
                 and status in ('pending','paid')) then
        update product set stock = stock + old.quantity
        where product_id = old.product_id;
    end if;
    return old;
end;
$$;

create trigger trg_items_after_delete
    after delete on order_items
    for each row execute function order_items_after_delete();

-- deleting an order that was never shipped/cancelled returns its stock
create or replace function orders_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if old.status in ('pending','paid') then
        update product p
        set stock = p.stock + oi.quantity
        from order_items oi
        where oi.order_id = old.order_id and oi.product_id = p.product_id;
    end if;
    return old;
end;
$$;

create trigger trg_orders_before_delete
    before delete on orders
    for each row execute function orders_before_delete();

-- rules for updating an order:
--  * customers may only cancel their own pending orders
--  * admins can change the status freely
--  * nobody can change the owner or the total by hand
--  * cancelling returns the stock
create or replace function orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.customer_id  := old.customer_id;
    new.order_date   := old.order_date;

    -- total is only changed by recalc_order_total (runs as definer, no auth.uid check needed)
    if new.total_amount <> old.total_amount and pg_trigger_depth() <= 1 then
        new.total_amount := old.total_amount;
    end if;

    if new.status <> old.status and auth.uid() is not null and not is_admin() then
        if not (old.status = 'pending' and new.status = 'cancelled') then
            raise exception 'You can only cancel a pending order';
        end if;
    end if;

    if new.status = 'cancelled' and old.status <> 'cancelled' then
        update product p
        set stock = p.stock + oi.quantity
        from order_items oi
        where oi.order_id = old.order_id and oi.product_id = p.product_id;
    end if;

    return new;
end;
$$;

create trigger trg_orders_before_update
    before update on orders
    for each row execute function orders_before_update();

-- customers can edit their own profile but must not be able to
-- make themselves admin or change their id / email
create or replace function customers_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.customer_id := old.customer_id;
    new.created_at  := old.created_at;
    -- auth.uid() is null when run from the SQL editor (database owner)
    if auth.uid() is not null and not is_admin() then
        new.is_admin := old.is_admin;
        new.email    := old.email;
    end if;
    return new;
end;
$$;

create trigger trg_customers_before_update
    before update on customers
    for each row execute function customers_before_update();

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------

alter table category    enable row level security;
alter table product     enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- category: everyone can read, only admins can change
create policy "category read for everyone"
    on category for select
    to anon, authenticated
    using (true);

create policy "category admin insert"
    on category for insert to authenticated
    with check (is_admin());

create policy "category admin update"
    on category for update to authenticated
    using (is_admin()) with check (is_admin());

create policy "category admin delete"
    on category for delete to authenticated
    using (is_admin());

-- product: everyone can read, only admins can change
create policy "product read for everyone"
    on product for select
    to anon, authenticated
    using (true);

create policy "product admin insert"
    on product for insert to authenticated
    with check (is_admin());

create policy "product admin update"
    on product for update to authenticated
    using (is_admin()) with check (is_admin());

create policy "product admin delete"
    on product for delete to authenticated
    using (is_admin());

-- customers: you only see / edit your own row (admins see all)
-- rows are created by the handle_new_user trigger, so there is no insert policy
create policy "customers read own"
    on customers for select to authenticated
    using (customer_id = auth.uid() or is_admin());

create policy "customers update own"
    on customers for update to authenticated
    using (customer_id = auth.uid())
    with check (customer_id = auth.uid());

-- orders: a customer can only work with their own orders
create policy "orders read own"
    on orders for select to authenticated
    using (customer_id = auth.uid() or is_admin());

create policy "orders insert own"
    on orders for insert to authenticated
    with check (customer_id = auth.uid());

create policy "orders update own"
    on orders for update to authenticated
    using (customer_id = auth.uid() or is_admin())
    with check (customer_id = auth.uid() or is_admin());

create policy "orders delete own pending"
    on orders for delete to authenticated
    using ((customer_id = auth.uid() and status = 'pending') or is_admin());

-- order_items: allowed only through an order you own
create policy "items read own"
    on order_items for select to authenticated
    using (
        is_admin() or exists (
            select 1 from orders o
            where o.order_id = order_items.order_id
              and o.customer_id = auth.uid()
        )
    );

create policy "items insert into own pending order"
    on order_items for insert to authenticated
    with check (
        exists (
            select 1 from orders o
            where o.order_id = order_items.order_id
              and o.customer_id = auth.uid()
              and o.status = 'pending'
        )
    );

create policy "items delete from own pending order"
    on order_items for delete to authenticated
    using (
        is_admin() or exists (
            select 1 from orders o
            where o.order_id = order_items.order_id
              and o.customer_id = auth.uid()
              and o.status = 'pending'
        )
    );

-- ---------------------------------------------------------
-- ANALYTICS (used by dashboard.html, admins only)
-- returns only totals, no personal customer data
-- ---------------------------------------------------------
create or replace function get_store_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    result json;
begin
    if not is_admin() then
        raise exception 'Only admins can view the dashboard';
    end if;

    select json_build_object(
        'total_products',  (select count(*) from product),
        'total_customers', (select count(*) from customers),
        'total_orders',    (select count(*) from orders where status <> 'cancelled'),
        'total_sales',     (select coalesce(sum(total_amount), 0) from orders where status <> 'cancelled'),
        'stock_value',     (select coalesce(sum(price * stock), 0) from product),

        'top_products', (
            select coalesce(json_agg(t), '[]'::json) from (
                select p.product_id, p.name, sum(oi.quantity) as sold,
                       sum(oi.quantity * oi.unit_price) as revenue
                from order_items oi
                join orders o  on o.order_id = oi.order_id and o.status <> 'cancelled'
                join product p on p.product_id = oi.product_id
                group by p.product_id, p.name
                order by sold desc
                limit 5
            ) t
        ),

        'low_stock', (
            select coalesce(json_agg(t), '[]'::json) from (
                select product_id, name, stock
                from product
                where stock <= 5
                order by stock asc, name
            ) t
        ),

        'sales_by_category', (
            select coalesce(json_agg(t), '[]'::json) from (
                select c.name,
                       coalesce(sum(case when o.order_id is not null
                                         then oi.quantity * oi.unit_price end), 0) as revenue,
                       coalesce(sum(case when o.order_id is not null
                                         then oi.quantity end), 0) as items
                from category c
                left join product p      on p.category_id = c.category_id
                left join order_items oi on oi.product_id = p.product_id
                left join orders o       on o.order_id = oi.order_id and o.status <> 'cancelled'
                group by c.name
                order by revenue desc
            ) t
        ),

        'orders_by_status', (
            select coalesce(json_object_agg(status, n), '{}'::json) from (
                select status, count(*) as n from orders group by status
            ) t
        )
    ) into result;

    return result;
end;
$$;

-- functions are executable by PUBLIC by default, so take that away first
revoke execute on function get_store_stats() from public, anon;
grant execute on function get_store_stats() to authenticated;
grant execute on function is_admin() to anon, authenticated;

-- ---------------------------------------------------------
-- SAMPLE DATA
-- ---------------------------------------------------------

insert into category (name, description, icon) values
('Football',   'Balls, boots, shin guards and goalkeeper gear',  'images/categories/football.jpg'),
('Basketball', 'Basketballs, hoops, shoes and training equipment', 'images/categories/basketball.jpg'),
('Tennis',     'Rackets, balls, strings and bags',                'images/categories/tennis.jpg'),
('Fitness',    'Dumbbells, mats, resistance bands and more',      'images/categories/fitness.jpg'),
('Swimming',   'Goggles, caps, swimsuits and training aids',      'images/categories/swimming.jpg');

insert into product (category_id, name, brand, description, price, stock, image_url) values
-- Football (1)
(1, 'Pro Match Football Size 5',    'Adidas',  'FIFA quality match ball with thermally bonded panels for a true flight and good touch.', 129.00, 40, 'images/products/1.jpg'),
(1, 'Training Football Size 4',     'Nike',    'Durable machine-stitched ball for daily training, ideal for juniors.',                 69.00, 60, 'images/products/2.jpg'),
(1, 'Firm Ground Football Boots',   'Puma',    'Lightweight synthetic upper with conical studs for firm natural grass.',             294.00, 15, 'images/products/3.jpg'),
(1, 'Shin Guards with Ankle Sock',  'Nike',    'Low-profile shin guards with a compression sleeve that keeps them in place.',         54.00, 3,  'images/products/4.jpg'),
(1, 'Goalkeeper Gloves',            'Reusch',  'Latex palm with finger protection for confident catching in all weather.',           154.00, 12, 'images/products/5.jpg'),
(1, 'Portable Training Goal Set',   'Kipsta',  'Two pop-up goals, 1.5m wide, fold flat into a carry bag.',                          199.00, 0,  'images/products/6.jpg'),
-- Basketball (2)
(2, 'Official Size 7 Basketball',   'Spalding','Composite leather indoor/outdoor ball with deep channels for grip.',                 109.00, 35, 'images/products/7.jpg'),
(2, 'Outdoor Rubber Basketball',    'Wilson',  'Tough rubber cover made for street courts and asphalt.',                             74.00, 50, 'images/products/8.jpg'),
(2, 'Adjustable Basketball Hoop',   'Lifetime','Portable hoop with height adjustment from 2.3m to 3.05m and a fillable base.',       914.00, 4,  'images/products/9.jpg'),
(2, 'High-Top Basketball Shoes',    'Nike',    'Ankle support, cushioned midsole and herringbone traction.',                         434.00, 10, 'images/products/10.jpg'),
(2, 'Ball Pump with Needles',       'Wilson',  'Dual-action hand pump, works for basketballs, footballs and volleyballs.',           34.00,  80, 'images/products/11.jpg'),
-- Tennis (3)
(3, 'Graphite Tennis Racket',       'Babolat', 'Pre-strung 300g racket for intermediate players, good mix of power and control.',    474.00, 8,  'images/products/12.jpg'),
(3, 'Beginner Aluminium Racket',    'Head',    'Light and forgiving racket, perfect for first lessons.',                             144.00, 25, 'images/products/13.jpg'),
(3, 'Tennis Balls (Can of 4)',      'Wilson',  'Pressurised all-court balls with consistent bounce.',                                29.00,  120,'images/products/14.jpg'),
(3, 'Polyester Racket String',      'Luxilon', '12m set of 1.25mm polyester string for spin and durability.',                        59.00, 2,  'images/products/15.jpg'),
(3, 'Tennis Racket Bag (6 rackets)','Babolat', 'Thermo compartment, shoe pocket and backpack straps.',                               239.00, 7,  'images/products/16.jpg'),
-- Fitness (4)
(4, 'Adjustable Dumbbell 2-24kg',   'Bowflex', 'Dial system replaces 15 pairs of dumbbells, saves space at home.',                   1094.00, 5,  'images/products/17.jpg'),
(4, 'Yoga Mat 6mm',                 'Domyos',  'Non-slip textured mat with carry strap.',                                            79.00, 45, 'images/products/18.jpg'),
(4, 'Resistance Bands Set (5)',     'Fit Simplify','Five latex bands from extra light to extra heavy with a pouch.',                49.00, 70, 'images/products/19.jpg'),
(4, 'Kettlebell 16kg',              'Domyos',  'Cast iron kettlebell with a wide handle for two-hand swings.',                       164.00, 0,  'images/products/20.jpg'),
(4, 'Speed Jump Rope',              'Rogue',   'Steel cable rope with ball bearings, adjustable length.',                            54.00, 30, 'images/products/21.jpg'),
(4, 'Foam Roller 45cm',             'TriggerPoint','Firm foam roller for recovery and muscle release.',                             99.00, 18, 'images/products/22.jpg'),
-- Swimming (5)
(5, 'Anti-Fog Swimming Goggles',    'Speedo',  'UV protection, anti-fog coating and adjustable nose bridge.',                        69.00, 55, 'images/products/23.jpg'),
(5, 'Silicone Swim Cap',            'Arena',   'Comfortable silicone cap that protects hair from chlorine.',                         34.00,  90, 'images/products/24.jpg'),
(5, 'Kickboard',                    'Speedo',  'EVA foam kickboard for leg training.',                                               49.00, 22, 'images/products/25.jpg'),
(5, 'Men''s Swim Jammer',           'Arena',   'Chlorine resistant fabric, knee-length for training.',                               124.00, 14, 'images/products/26.jpg'),
(5, 'Swim Fins (Short Blade)',      'Finis',   'Short blade fins for kick strength and ankle flexibility.',                          114.00, 1,  'images/products/28.jpg');

-- ---------------------------------------------------------
-- MAKING AN ADMIN
-- 1. register normally on the website
-- 2. run this (with your email) in the SQL editor:
--
--    update customers set is_admin = true where email = 'you@example.com';
-- ---------------------------------------------------------
