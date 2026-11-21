# Entity Relationship Diagram

GitHub renders the diagram below automatically. To get an image for the report,
paste the code into https://mermaid.live and export it as PNG.

```mermaid
erDiagram
    AUTH_USERS ||--|| CUSTOMERS : "has profile"
    CATEGORY   ||--o{ PRODUCT   : contains
    CUSTOMERS  ||--o{ ORDERS    : places
    ORDERS     ||--|{ ORDER_ITEMS : includes
    PRODUCT    ||--o{ ORDER_ITEMS : "appears in"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb raw_user_meta_data
    }
    CATEGORY {
        serial category_id PK
        varchar name "NOT NULL, UNIQUE"
        text description
        varchar icon
    }
    PRODUCT {
        serial product_id PK
        int category_id FK "NOT NULL"
        varchar name "NOT NULL"
        varchar brand
        text description
        numeric price "NOT NULL, >= 0"
        int stock "NOT NULL, >= 0"
        text image_url
        timestamptz created_at
    }
    CUSTOMERS {
        uuid customer_id PK, FK "-> auth.users.id"
        varchar full_name "NOT NULL"
        varchar email "NOT NULL, UNIQUE"
        varchar phone
        text address
        boolean is_admin "default false"
        timestamptz created_at
    }
    ORDERS {
        serial order_id PK
        uuid customer_id FK "NOT NULL"
        timestamptz order_date
        varchar status "pending/paid/shipped/delivered/cancelled"
        numeric total_amount "calculated by trigger"
        varchar shipping_name "NOT NULL"
        text shipping_address "NOT NULL"
        varchar shipping_phone "NOT NULL"
        varchar payment_method "cash/card"
    }
    ORDER_ITEMS {
        serial order_item_id PK
        int order_id FK "NOT NULL"
        int product_id FK "NOT NULL"
        int quantity "NOT NULL, > 0"
        numeric unit_price "copied from product by trigger"
    }
```

## Relationships

| Relationship | Type | Foreign key | On delete |
|---|---|---|---|
| category → product | one-to-many | `product.category_id` | restrict (can't delete a category that still has products) |
| auth.users → customers | one-to-one | `customers.customer_id` | cascade |
| customers → orders | one-to-many | `orders.customer_id` | cascade |
| orders → order_items | one-to-many | `order_items.order_id` | cascade |
| product → order_items | one-to-many | `order_items.product_id` | restrict (keeps order history correct) |

`order_items` is the junction table that resolves the many-to-many relationship
between `orders` and `product`. The pair `(order_id, product_id)` is unique.
