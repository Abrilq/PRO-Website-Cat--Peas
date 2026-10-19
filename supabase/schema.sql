create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  brand text not null,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  image text not null,
  legacy_name text not null,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'fulfilled', 'cancelled')),
  total numeric(10, 2) not null check (total >= 0),
  shipping_address jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null references public.products (id),
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 10)
);

create table if not exists public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  subject text not null check (length(trim(subject)) between 1 and 160),
  message text not null check (length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

grant select on public.products to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant insert on public.newsletter_signups, public.contact_messages to anon, authenticated;

alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_signups enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Products are publicly readable" on public.products;
create policy "Products are publicly readable"
  on public.products for select to anon, authenticated using (active = true);

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated using (id = (select auth.uid()));

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users read their own orders" on public.orders;
create policy "Users read their own orders"
  on public.orders for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users read their own order items" on public.order_items;
create policy "Users read their own order items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = (select auth.uid())
    )
  );

drop policy if exists "Anyone can subscribe with a valid email" on public.newsletter_signups;
create policy "Anyone can subscribe with a valid email"
  on public.newsletter_signups for insert to anon, authenticated with check (true);

drop policy if exists "Anyone can send a contact message" on public.contact_messages;
create policy "Anyone can send a contact message"
  on public.contact_messages for insert to anon, authenticated with check (true);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.create_order(order_address jsonb, order_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_id uuid;
  order_total numeric(10, 2) := 0;
  item jsonb;
  item_product_id text;
  item_quantity integer;
  item_name text;
  item_price numeric(10, 2);
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before placing an order.' using errcode = '42501';
  end if;
  if jsonb_typeof(order_items) <> 'array' or jsonb_array_length(order_items) = 0 then
    raise exception 'Add at least one item before placing an order.';
  end if;
  if jsonb_typeof(order_address) <> 'object'
    or coalesce(order_address->>'name', '') = ''
    or coalesce(order_address->>'street', '') = ''
    or coalesce(order_address->>'city', '') = ''
    or coalesce(order_address->>'phone', '') = '' then
    raise exception 'Complete the delivery details before placing an order.';
  end if;

  for item in select value from jsonb_array_elements(order_items)
  loop
    if jsonb_typeof(item) <> 'object' or coalesce(item->>'product_id', '') = ''
      or coalesce(item->>'quantity', '') !~ '^[0-9]+$' then
      raise exception 'Each order item needs a product and a whole-number quantity.';
    end if;
    item_product_id := item->>'product_id';
    item_quantity := (item->>'quantity')::integer;
    if item_quantity < 1 or item_quantity > 10 then
      raise exception 'Each item quantity must be between 1 and 10.';
    end if;

    select p.name, p.price into item_name, item_price
    from public.products as p
    where p.id = item_product_id and p.active = true;
    if not found then
      raise exception 'A selected product is no longer available.';
    end if;
    order_total := order_total + item_price * item_quantity;
  end loop;

  insert into public.orders (user_id, total, shipping_address)
  values ((select auth.uid()), order_total, order_address)
  returning id into order_id;

  for item in select value from jsonb_array_elements(order_items)
  loop
    item_product_id := item->>'product_id';
    item_quantity := (item->>'quantity')::integer;
    select p.name, p.price into item_name, item_price
    from public.products as p
    where p.id = item_product_id and p.active = true;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (order_id, item_product_id, item_name, item_price, item_quantity);
  end loop;

  return order_id;
end;
$$;

revoke all on function public.create_order(jsonb, jsonb) from public, anon;
grant execute on function public.create_order(jsonb, jsonb) to authenticated;

insert into public.products (id, brand, name, price, image, legacy_name, featured) values
  ('burberry-be3161', 'Burberry', 'BE3161 — Light Gold', 633, 'img/products/Burberry/Burberry BE3161/Burberry BE3161 - Light Gold [Brown].png', 'Burberry BE3161', true),
  ('oakley-oo9280-bxtr', 'Oakley', 'OO9280 BXTR — Clear', 242, 'img/products/Oakley/Oakley OO9280 BXTR/Oakley OO9280 BXTR - Clear [Blue].png', 'Oakley OO9280 BXTR', true),
  ('persol-po3327s', 'Persol', 'PO3327S — Black', 398, 'img/products/Persol/Persol PO3327S - Black [Green].png', 'Persol PO3327S', true),
  ('rayban-rb3016-clubmaster', 'Ray-Ban', 'RB3016 Clubmaster Classic', 230, 'img/products/Ray-Ban/Ray-Ban RB3016 Clubmaster Classic/Ray-Ban RB3016 Clubmaster Classic - Black On Gold [Green].png', 'Ray-Ban RB3016 Clubmaster Classic', true),
  ('rayban-rb3741-emy', 'Ray-Ban', 'RB3741 Emy Bio-Based — Gold', 176, 'img/products/Ray-Ban/Ray-Ban RB3741 Emy Bio-Based/Ray-Ban RB3741 Emy Bio-Based - Gold [Grey].png', 'Ray-Ban RB3741 Emy Bio-Based', true),
  ('rayban-rb3025-aviator', 'Ray-Ban', 'RB3025 Aviator Total Black', 230, 'img/products/Ray-Ban/Ray-Ban RB3025 Aviator/Ray-Ban RB3025 Aviator Total Black - Black [Black-Polarized].png', 'Ray-Ban RB3025 Aviator Total Black', true),
  ('giorgio-armani-ar6135', 'Giorgio Armani', 'AR6135 — Pale Gold', 585, 'img/products/Giorgio Armani/Giorgio Armani AR6135/Giorgio Armani AR6135 - Pale Gold [Grey].png', 'Giorgio Armani AR6135', true),
  ('burberry-be4291', 'Burberry', 'BE4291 — Beige', 296, 'img/products/Burberry/Burberry BE4291/Burberry BE4291 - Beige [Grey].png', 'Burberry BE4291', false),
  ('burberry-be4431u', 'Burberry', 'BE4431U — Vintage Check', 331, 'img/products/Burberry/Burberry BE4431U/Burberry BE4431U - Top Black On Vintage Check [Grey-Polarized].png', 'Burberry BE4431U', false),
  ('oakley-oo9406-sutro', 'Oakley', 'OO9406 Sutro — Black Ink', 192, 'img/products/Oakley/Oakley OO9406 Sutro/Oakley OO9406 Sutro - Black Ink [Green].png', 'Oakley OO9406 Sutro', false),
  ('oakley-oo9404-latch-panel', 'Oakley', 'OO9404 Latch Panel — Grey Smoke', 220, 'img/products/Oakley/Oakley OO9404 Latch™ Panel/Oakley OO9404 Latch™ Panel - Grey Smoke [Gold].png', 'Oakley OO9404 Latch™ Panel', false),
  ('rayban-rb3569', 'Ray-Ban', 'RB3569 — Black on Silver', 216, 'img/products/Ray-Ban/Ray-Ban RB3569/Ray-Ban RB3569 - Black On Silver [Grey] 1.png', 'Ray-Ban RB3569', false),
  ('rayban-rb3686-chromance', 'Ray-Ban', 'RB3686 Chromance — Black', 268, 'img/products/Ray-Ban/Ray-Ban RB3686 Chromance/Ray-Ban RB3686 Chromance - Black [Grey-Polarized].png', 'Ray-Ban RB3686 Chromance', false),
  ('versace-ve2258', 'Versace', 'VE2258 — Dark Grey', 392, 'img/products/Versace/Versace VE2258/Versace VE2258 - Dark Grey [Grey].png', 'Versace VE2258', false),
  ('versace-ve43921', 'Versace', 'VE43921 — Black', 363, 'img/products/Versace/Versace VE43921/Versace VE43921 - Black [Grey].png', 'Versace VE43921', false),
  ('versace-ve4461', 'Versace', 'VE4461 — Black', 434, 'img/products/Versace/Versace VE4461/Versace VE4461 - Black [Grey].png', 'Versace VE4461', false)
on conflict (id) do update set
  brand = excluded.brand,
  name = excluded.name,
  price = excluded.price,
  image = excluded.image,
  legacy_name = excluded.legacy_name,
  featured = excluded.featured,
  active = true;
