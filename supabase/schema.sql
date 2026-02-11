create extension if not exists "pgcrypto";

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  street text not null,
  city text not null,
  state text not null,
  zip text not null,
  seller_name text,
  seller_phone text,
  seller_email text
);

create table if not exists intake_answers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  created_at timestamptz default now(),
  occupancy text not null,
  timeline text not null,
  motivation text not null,
  condition_overall text not null,
  kitchen_baths text not null,
  roof_age int,
  hvac_age int,
  electrical text not null,
  plumbing text not null,
  foundation text not null,
  water_issues text not null,
  notes text
);

create table if not exists valuations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  baseline_market_value numeric not null,
  cash_offer_low numeric not null,
  cash_offer_high numeric not null,
  confidence numeric not null,
  pursue_score int not null,
  listing_net_estimate numeric not null,
  explanation_bullets jsonb not null,
  updated_at timestamptz default now(),
  unique (lead_id)
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size int,
  created_at timestamptz default now()
);

create table if not exists photo_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  created_at timestamptz default now(),
  condition_score int not null,
  update_level text not null,
  rehab_tier text not null,
  confidence numeric not null,
  flags jsonb not null,
  observations jsonb not null
);

alter table leads enable row level security;
alter table intake_answers enable row level security;
alter table valuations enable row level security;
alter table photos enable row level security;
alter table photo_analysis enable row level security;

create policy "Authenticated access" on leads
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated access" on intake_answers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated access" on valuations
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated access" on photos
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated access" on photo_analysis
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Lead photos access" on storage.objects
  for all
  using (
    auth.role() = 'authenticated'
    and bucket_id = 'lead-photos'
  )
  with check (
    auth.role() = 'authenticated'
    and bucket_id = 'lead-photos'
  );
