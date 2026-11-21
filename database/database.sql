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
    price         numeric(10,2) not null check (price >= 0),
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
