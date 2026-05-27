-- BestSeller Supabase Schema
-- Run this in a clean Supabase project from SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- =========================
-- ENUMS
-- =========================
do $$ begin create type public.app_role as enum ('admin','author','affiliate','customer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.application_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.book_status as enum ('draft','under_review','published','archived','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.book_format as enum ('print','ebook','audiobook','kindle_external'); exception when duplicate_object then null; end $$;
do $$ begin create type public.asset_type as enum ('cover','manuscript','epub','pdf','sample','marketing','contract','audio'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('pending','paid','processing','fulfilled','cancelled','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('unpaid','authorized','paid','failed','refunded','partially_refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.discount_type as enum ('percentage','fixed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.commission_type as enum ('percentage','fixed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.commission_status as enum ('pending','approved','payable','paid','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payout_target as enum ('author','affiliate'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payout_status as enum ('pending','processing','paid','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.affiliate_campaign_status as enum ('draft','active','paused','ended'); exception when duplicate_object then null; end $$;
do $$ begin create type public.library_access_type as enum ('purchase','gift','bonus','review_copy','subscription'); exception when duplicate_object then null; end $$;

-- =========================
-- GENERIC FUNCTIONS
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_referral_code(_prefix text default 'AFF')
returns text
language plpgsql
as $$
begin
  return upper(coalesce(_prefix, 'AFF')) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
begin
  return 'BS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 100000))::int::text, 5, '0');
end;
$$;

-- =========================
-- CORE USERS
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique,
  full_name text,
  avatar_url text,
  phone text,
  country_code text default 'DO',
  locale text default 'es-DO',
  headline text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.author_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  pen_name text not null,
  slug text not null unique,
  website_url text,
  instagram_url text,
  facebook_url text,
  x_url text,
  youtube_url text,
  payout_details jsonb not null default '{}'::jsonb,
  royalty_rate numeric(5,2) not null default 50.00,
  status public.application_status not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  handle text unique,
  referral_code text not null unique default public.generate_referral_code('AFF'),
  payout_details jsonb not null default '{}'::jsonb,
  commission_rate numeric(5,2) not null default 10.00,
  status public.application_status not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.author_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  legal_name text,
  pen_name text,
  email citext,
  phone text,
  manuscript_title text,
  genre text,
  about text,
  website_url text,
  sample_link text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  email citext,
  phone text,
  channels jsonb not null default '{}'::jsonb,
  audience_description text,
  promo_experience text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- =========================
-- CATALOG
-- =========================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.author_profiles(id) on delete set null,
  title text not null,
  subtitle text,
  slug text not null unique,
  description_short text,
  description_long text,
  isbn_13 text unique,
  language_code text not null default 'es',
  page_count integer,
  publication_date date,
  status public.book_status not null default 'draft',
  featured boolean not null default false,
  age_rating text,
  cover_url text,
  sample_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_categories (
  book_id uuid not null references public.books(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, category_id)
);

create table if not exists public.book_editions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  format public.book_format not null,
  sku text unique,
  edition_name text,
  price numeric(12,2) not null default 0,
  compare_at_price numeric(12,2),
  currency text not null default 'DOP',
  stock_quantity integer,
  unlimited_stock boolean not null default false,
  is_preorder boolean not null default false,
  release_date timestamptz,
  file_url text,
  external_url text,
  weight_grams integer,
  dimensions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists book_editions_unique_variant_idx
on public.book_editions (book_id, format, coalesce(edition_name, 'default'));

create table if not exists public.book_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  edition_id uuid references public.book_editions(id) on delete cascade,
  asset_type public.asset_type not null,
  storage_bucket text,
  storage_path text,
  file_url text,
  mime_type text,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  is_verified_purchase boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, user_id)
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Favoritos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.wishlist_items (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, book_id)
);

-- =========================
-- CART / CHECKOUT / ORDERS
-- =========================
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  session_id text,
  currency text not null default 'DOP',
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_identity_check check (user_id is not null or session_id is not null)
);

create unique index if not exists carts_one_open_per_user_idx on public.carts(user_id) where user_id is not null;
create unique index if not exists carts_one_open_per_session_idx on public.carts(session_id) where session_id is not null;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  edition_id uuid not null references public.book_editions(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, edition_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value numeric(12,2) not null check (discount_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  minimum_order_amount numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_books (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coupon_id, book_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  order_number text not null unique default public.generate_order_number(),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  currency text not null default 'DOP',
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  coupon_code text,
  notes text,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  edition_id uuid references public.book_editions(id) on delete set null,
  title_snapshot text not null,
  format_snapshot public.book_format,
  sku_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'DOP',
  status public.payment_status not null default 'unpaid',
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text,
  country text not null default 'República Dominicana',
  province text,
  city text,
  address_line_1 text not null,
  address_line_2 text,
  postal_code text,
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- DIGITAL LIBRARY / READER
-- =========================
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  edition_id uuid references public.book_editions(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  access_type public.library_access_type not null default 'purchase',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists library_items_dedupe_idx
on public.library_items (user_id, book_id, coalesce(edition_id, '00000000-0000-0000-0000-000000000000'::uuid), access_type);

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  current_location text,
  highlights jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_item_id, user_id)
);

-- =========================
-- AFFILIATES / CAMPAIGNS
-- =========================
create table if not exists public.affiliate_campaigns (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  author_id uuid references public.author_profiles(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_public boolean not null default true,
  cookie_days integer not null default 30,
  commission_type public.commission_type not null default 'percentage',
  commission_value numeric(12,2) not null default 10.00,
  status public.affiliate_campaign_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.affiliate_campaigns(id) on delete cascade,
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  code text not null unique default public.generate_referral_code('LNK'),
  destination_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, affiliate_id)
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links(id) on delete cascade,
  session_id text,
  ip_hash text,
  user_agent text,
  referrer text,
  landing_path text,
  clicked_at timestamptz not null default now()
);

create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  currency text not null default 'DOP',
  created_at timestamptz not null default now()
);

create unique index if not exists affiliate_conversions_dedupe_idx
on public.affiliate_conversions (affiliate_link_id, order_id, coalesce(order_item_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  campaign_id uuid references public.affiliate_campaigns(id) on delete set null,
  conversion_id uuid references public.affiliate_conversions(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  commission_amount numeric(12,2) not null default 0,
  currency text not null default 'DOP',
  status public.commission_status not null default 'pending',
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PAYOUTS
-- =========================
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target public.payout_target not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'DOP',
  status public.payout_status not null default 'pending',
  payment_reference text,
  notes text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- =========================
-- MARKETING / CRM
-- =========================
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  full_name text,
  source text,
  tags jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  subscribed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

-- =========================
-- INDEXES
-- =========================
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists author_profiles_slug_idx on public.author_profiles(slug);
create index if not exists affiliate_profiles_code_idx on public.affiliate_profiles(referral_code);
create index if not exists books_author_id_idx on public.books(author_id);
create index if not exists books_status_idx on public.books(status);
create index if not exists books_featured_idx on public.books(featured);
create index if not exists book_editions_book_id_idx on public.book_editions(book_id);
create index if not exists book_editions_format_idx on public.book_editions(format);
create index if not exists book_assets_book_id_idx on public.book_assets(book_id);
create index if not exists reviews_book_id_idx on public.book_reviews(book_id);
create index if not exists carts_user_id_idx on public.carts(user_id);
create index if not exists cart_items_cart_id_idx on public.cart_items(cart_id);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists library_items_user_id_idx on public.library_items(user_id);
create index if not exists affiliate_campaigns_book_id_idx on public.affiliate_campaigns(book_id);
create index if not exists affiliate_links_affiliate_id_idx on public.affiliate_links(affiliate_id);
create index if not exists affiliate_clicks_link_id_idx on public.affiliate_clicks(affiliate_link_id);
create index if not exists affiliate_commissions_affiliate_id_idx on public.affiliate_commissions(affiliate_id);
create index if not exists payouts_user_id_idx on public.payouts(user_id);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_author_profiles_updated_at on public.author_profiles;
create trigger trg_author_profiles_updated_at before update on public.author_profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_affiliate_profiles_updated_at on public.affiliate_profiles;
create trigger trg_affiliate_profiles_updated_at before update on public.affiliate_profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_author_applications_updated_at on public.author_applications;
create trigger trg_author_applications_updated_at before update on public.author_applications for each row execute function public.set_updated_at();
drop trigger if exists trg_affiliate_applications_updated_at on public.affiliate_applications;
create trigger trg_affiliate_applications_updated_at before update on public.affiliate_applications for each row execute function public.set_updated_at();
drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists trg_books_updated_at on public.books;
create trigger trg_books_updated_at before update on public.books for each row execute function public.set_updated_at();
drop trigger if exists trg_book_editions_updated_at on public.book_editions;
create trigger trg_book_editions_updated_at before update on public.book_editions for each row execute function public.set_updated_at();
drop trigger if exists trg_book_assets_updated_at on public.book_assets;
create trigger trg_book_assets_updated_at before update on public.book_assets for each row execute function public.set_updated_at();
drop trigger if exists trg_book_reviews_updated_at on public.book_reviews;
create trigger trg_book_reviews_updated_at before update on public.book_reviews for each row execute function public.set_updated_at();
drop trigger if exists trg_wishlists_updated_at on public.wishlists;
create trigger trg_wishlists_updated_at before update on public.wishlists for each row execute function public.set_updated_at();
drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at before update on public.carts for each row execute function public.set_updated_at();
drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
drop trigger if exists trg_addresses_updated_at on public.addresses;
create trigger trg_addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
drop trigger if exists trg_reading_progress_updated_at on public.reading_progress;
create trigger trg_reading_progress_updated_at before update on public.reading_progress for each row execute function public.set_updated_at();
drop trigger if exists trg_affiliate_campaigns_updated_at on public.affiliate_campaigns;
create trigger trg_affiliate_campaigns_updated_at before update on public.affiliate_campaigns for each row execute function public.set_updated_at();
drop trigger if exists trg_affiliate_links_updated_at on public.affiliate_links;
create trigger trg_affiliate_links_updated_at before update on public.affiliate_links for each row execute function public.set_updated_at();
drop trigger if exists trg_affiliate_commissions_updated_at on public.affiliate_commissions;
create trigger trg_affiliate_commissions_updated_at before update on public.affiliate_commissions for each row execute function public.set_updated_at();
drop trigger if exists trg_payouts_updated_at on public.payouts;
create trigger trg_payouts_updated_at before update on public.payouts for each row execute function public.set_updated_at();
drop trigger if exists trg_newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger trg_newsletter_subscribers_updated_at before update on public.newsletter_subscribers for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================
-- RLS ENABLE
-- =========================
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.author_profiles enable row level security;
alter table public.affiliate_profiles enable row level security;
alter table public.author_applications enable row level security;
alter table public.affiliate_applications enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.book_categories enable row level security;
alter table public.book_editions enable row level security;
alter table public.book_assets enable row level security;
alter table public.book_reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_books enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.addresses enable row level security;
alter table public.library_items enable row level security;
alter table public.reading_progress enable row level security;
alter table public.affiliate_campaigns enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.site_settings enable row level security;

-- =========================
-- RLS POLICIES
-- =========================
-- Note: run on a clean database. If you re-run, drop existing policies first.

create policy "profiles_select_own_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles_update_own_or_admin" on public.profiles
for update using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy "user_roles_select_own_or_admin" on public.user_roles
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "author_profiles_public_approved" on public.author_profiles
for select using (status = 'approved' or auth.uid() = id or public.is_admin(auth.uid()));
create policy "author_profiles_insert_own" on public.author_profiles
for insert with check (auth.uid() = id or public.is_admin(auth.uid()));
create policy "author_profiles_update_own_or_admin" on public.author_profiles
for update using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy "affiliate_profiles_select_own_or_admin" on public.affiliate_profiles
for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "affiliate_profiles_insert_own" on public.affiliate_profiles
for insert with check (auth.uid() = id or public.is_admin(auth.uid()));
create policy "affiliate_profiles_update_own_or_admin" on public.affiliate_profiles
for update using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy "author_applications_insert_own" on public.author_applications
for insert with check (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "author_applications_select_own_or_admin" on public.author_applications
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "author_applications_update_admin" on public.author_applications
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "affiliate_applications_insert_own" on public.affiliate_applications
for insert with check (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "affiliate_applications_select_own_or_admin" on public.affiliate_applications
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "affiliate_applications_update_admin" on public.affiliate_applications
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "categories_public_read" on public.categories
for select using (is_active = true or public.is_admin(auth.uid()));

create policy "books_public_read_published" on public.books
for select using (status = 'published' or author_id = auth.uid() or public.is_admin(auth.uid()));
create policy "books_insert_author_or_admin" on public.books
for insert with check (author_id = auth.uid() or public.is_admin(auth.uid()));
create policy "books_update_author_or_admin" on public.books
for update using (author_id = auth.uid() or public.is_admin(auth.uid()))
with check (author_id = auth.uid() or public.is_admin(auth.uid()));

create policy "book_categories_public_read" on public.book_categories
for select using (
  exists (
    select 1 from public.books b
    where b.id = book_id
      and (b.status = 'published' or b.author_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "book_editions_public_read_active" on public.book_editions
for select using (
  ((is_active = true) and exists (
    select 1 from public.books b
    where b.id = book_id
      and (b.status = 'published' or b.author_id = auth.uid() or public.is_admin(auth.uid()))
  ))
  or public.is_admin(auth.uid())
);

create policy "book_assets_read_public_or_owner" on public.book_assets
for select using (
  is_public = true
  or exists (
    select 1 from public.books b
    where b.id = book_id and (b.author_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "book_reviews_public_read" on public.book_reviews
for select using (is_published = true or auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "book_reviews_insert_own" on public.book_reviews
for insert with check (auth.uid() = user_id);
create policy "book_reviews_update_own_or_admin" on public.book_reviews
for update using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "wishlists_owner_only" on public.wishlists
for all using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "wishlist_items_owner_only" on public.wishlist_items
for all using (
  exists (
    select 1 from public.wishlists w where w.id = wishlist_id and (w.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.wishlists w where w.id = wishlist_id and (w.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "carts_owner_only" on public.carts
for all using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "cart_items_owner_only" on public.cart_items
for all using (
  exists (
    select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "coupons_admin_only" on public.coupons
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
create policy "coupon_books_admin_only" on public.coupon_books
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "orders_owner_or_admin" on public.orders
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "orders_insert_owner_or_admin" on public.orders
for insert with check (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "orders_update_admin_only" on public.orders
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "order_items_owner_or_admin" on public.order_items
for select using (
  exists (
    select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);
create policy "order_items_insert_owner_or_admin" on public.order_items
for insert with check (
  exists (
    select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "payments_owner_or_admin" on public.payments
for select using (
  exists (
    select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);
create policy "payments_insert_admin_only" on public.payments
for insert with check (public.is_admin(auth.uid()));
create policy "payments_update_admin_only" on public.payments
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "addresses_owner_only" on public.addresses
for all using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "library_items_owner_or_admin" on public.library_items
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "library_items_insert_admin_only" on public.library_items
for insert with check (public.is_admin(auth.uid()));

create policy "reading_progress_owner_only" on public.reading_progress
for all using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "affiliate_campaigns_public_active" on public.affiliate_campaigns
for select using ((is_public = true and status = 'active') or author_id = auth.uid() or public.is_admin(auth.uid()));
create policy "affiliate_campaigns_insert_author_or_admin" on public.affiliate_campaigns
for insert with check (author_id = auth.uid() or public.is_admin(auth.uid()));
create policy "affiliate_campaigns_update_author_or_admin" on public.affiliate_campaigns
for update using (author_id = auth.uid() or public.is_admin(auth.uid()))
with check (author_id = auth.uid() or public.is_admin(auth.uid()));

create policy "affiliate_links_owner_or_admin" on public.affiliate_links
for all using (affiliate_id = auth.uid() or public.is_admin(auth.uid()))
with check (affiliate_id = auth.uid() or public.is_admin(auth.uid()));

create policy "affiliate_clicks_insert_open" on public.affiliate_clicks
for insert with check (true);
create policy "affiliate_clicks_owner_or_admin_read" on public.affiliate_clicks
for select using (
  exists (
    select 1 from public.affiliate_links l
    where l.id = affiliate_link_id
      and (l.affiliate_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "affiliate_conversions_owner_or_admin_read" on public.affiliate_conversions
for select using (
  exists (
    select 1 from public.affiliate_links l
    where l.id = affiliate_link_id
      and (l.affiliate_id = auth.uid() or public.is_admin(auth.uid()))
  )
);
create policy "affiliate_conversions_admin_insert" on public.affiliate_conversions
for insert with check (public.is_admin(auth.uid()));

create policy "affiliate_commissions_owner_or_admin" on public.affiliate_commissions
for select using (affiliate_id = auth.uid() or public.is_admin(auth.uid()));
create policy "affiliate_commissions_admin_insert" on public.affiliate_commissions
for insert with check (public.is_admin(auth.uid()));
create policy "affiliate_commissions_admin_update" on public.affiliate_commissions
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "payouts_owner_or_admin" on public.payouts
for select using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "payouts_admin_insert" on public.payouts
for insert with check (public.is_admin(auth.uid()));
create policy "payouts_admin_update" on public.payouts
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "payout_items_owner_or_admin_read" on public.payout_items
for select using (
  exists (
    select 1 from public.payouts p where p.id = payout_id and (p.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);
create policy "payout_items_admin_insert" on public.payout_items
for insert with check (public.is_admin(auth.uid()));

create policy "newsletter_public_insert" on public.newsletter_subscribers
for insert with check (true);
create policy "newsletter_admin_read" on public.newsletter_subscribers
for select using (public.is_admin(auth.uid()));
create policy "newsletter_admin_update" on public.newsletter_subscribers
for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "site_settings_admin_only" on public.site_settings
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- =========================
-- OPTIONAL STORAGE BUCKETS
-- =========================
-- Uncomment if you want buckets created from SQL too.
-- insert into storage.buckets (id, name, public)
-- values
--   ('book-covers', 'book-covers', true),
--   ('book-files', 'book-files', false),
--   ('marketing-assets', 'marketing-assets', true)
-- on conflict (id) do nothing;

