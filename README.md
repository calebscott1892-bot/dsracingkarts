# DS Racing Karts — E-commerce Rebuild

Next.js 14+ (App Router) + Supabase + Tailwind CSS + Square Web Payments

## Quick Start

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Copy the **service_role key** too (for import scripts)
4. Open the SQL Editor and run these migrations in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_functions.sql`
5. Create a storage bucket:
   - Go to Storage → New bucket → Name: `product-images`, set to **Public**

### 2. Create First Admin User

1. Go to Authentication → Users → Add User
2. Enter your email and password
3. Copy the user UUID
4. Run this SQL to make them admin:
   ```sql
   INSERT INTO admin_profiles (id, role, name)
   VALUES ('your-user-uuid-here', 'super_admin', 'Your Name');
   ```

### 3. Square Setup

1. Go to [developer.squareup.com](https://developer.squareup.com)
2. Create an application (or use your existing one)
3. Note your **Application ID** and **Access Token**
4. Find your **Location ID**: Dashboard → Locations
5. Start with **Sandbox** credentials for testing

### 4. Environment Variables

```bash
cp .env.example .env.local
```

Fill in all the values in `.env.local`.

### 5. Install & Run

```bash
npm install
npm run dev
```

### 6. Import Your Catalogue

```bash
node scripts/import-square-csv.js path/to/catalog-export.csv
```

### 7. Migrate Images

```bash
# Via Square API (recommended)
node scripts/migrate-images.js

# Or via scraping current site (fallback)
node scripts/migrate-images.js scrape
```

### 8. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set all `.env.local` variables in Vercel → Project Settings → Environment Variables.
Switch `SQUARE_ENVIRONMENT` to `production` and swap to production Square keys.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (header, footer, cart provider)
│   ├── page.tsx                # Homepage (hero, categories, featured)
│   ├── shop/page.tsx           # Product listing with filters
│   ├── product/[slug]/page.tsx # Product detail page
│   ├── cart/                   # Cart page (TODO)
│   ├── checkout/page.tsx       # Checkout with Square payments
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout (sidebar, auth gate)
│   │   ├── page.tsx            # Dashboard (stats, recent orders)
│   │   ├── login/page.tsx      # Admin login
│   │   ├── products/page.tsx   # Product list & management
│   │   ├── products/[id]/      # Product edit form
│   │   ├── categories/         # Category management (TODO)
│   │   ├── orders/             # Order management (TODO)
│   │   └── customers/          # Customer list (TODO)
│   └── api/
│       ├── checkout/route.ts   # Square payment processing
│       ├── newsletter/route.ts # Mailchimp signup
│       └── admin/products/     # Admin product CRUD
├── components/
│   ├── layout/                 # Header, Footer, HeroVideo, etc.
│   ├── shop/                   # ProductCard, ShopFilters, AddToCart
│   └── admin/                  # AdminSidebar, ProductEditForm
├── hooks/
│   └── useCart.tsx             # Cart context + session storage
├── lib/
│   ├── supabase/              # Server, client, middleware clients
│   ├── square.ts              # Square SDK config
│   └── utils.ts               # formatPrice, cn, slugify, etc.
└── types/
    └── database.ts            # TypeScript types for all tables
```

## Key Architecture Decisions

**Categories**: Self-referencing table with `parent_id` for nesting
(e.g., "Engines & Accessories > Honda GX200"). The import script
automatically detects the `>` separator in Square's category strings.

**Variations**: Separate `product_variations` table. Products like
"Alpinestars Glove" have 5 size variations, each with their own SKU,
price, and stock level. The `variation_options` table stores the
option type (e.g., "Size") and value (e.g., "Medium").

**Inventory**: Linked to variations, not products. This means each
size/type of a product has its own stock count. The `stock_status`
column is auto-calculated via a generated column.

**RLS**: Row-level security is on for all tables. Public users can
read active/visible products. Admins (checked via `admin_profiles`)
get full CRUD. Customers can read their own orders.

**Cart**: Client-side only (session storage), no server-side cart.
Validated against DB at checkout time.

**Square**: Web Payments SDK handles card tokenisation on the frontend.
The token is sent to our `/api/checkout` route which processes the
payment via Square's Payments API server-side.

## TODO / Next Steps

- [ ] Cart page (`/cart`) with quantity editing
- [ ] Order confirmation page
- [ ] Admin: order detail + status management
- [ ] Admin: category CRUD
- [ ] Admin: customer list + detail
- [ ] Admin: image upload via drag-and-drop
- [ ] Product search page with full-text search
- [ ] Related products on product pages
- [ ] Shipping calculator integration
- [ ] Email notifications (order confirmation, shipping)
