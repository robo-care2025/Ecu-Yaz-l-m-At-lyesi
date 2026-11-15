-- Scootechnology: temel şema ve satır düzeyi güvenlik (RLS)

create table workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  signature text,
  address_form text not null default 'siz' check (address_form in ('siz','sen')),
  created_at timestamptz not null default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workshop_id uuid not null references workshops(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table brand_groups (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  name text not null,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  unique (workshop_id, name)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  name text not null,
  group_id uuid not null references brand_groups(id) on delete restrict,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  unique (workshop_id, name)
);

create table price_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  item_name text not null,
  group_id uuid not null references brand_groups(id) on delete cascade,
  min_tl int not null check (min_tl >= 0),
  max_tl int not null,
  duration text not null,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workshop_id, item_name, group_id),
  check (min_tl <= max_tl)
);

-- workshop_id null ise kayıt tüm atölyelere açık ortak veridir.
create table error_codes (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references workshops(id) on delete cascade,
  brand text not null,
  model_family text,
  code text not null,
  meaning text not null,
  causes text[] not null default '{}',
  source text not null check (length(source) > 0),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index error_codes_lookup on error_codes (brand, code);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  status text not null default 'yeni' check (status in
    ('yeni','analiz_edildi','analiz_hatasi','musteriye_yazildi','tamirde','bitti')),
  raw_text text not null,
  parsed jsonb,
  brand text,
  model text,
  customer_name text,
  customer_phone text,
  measurements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_workshop_created on jobs (workshop_id, created_at desc);

create table job_analyses (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  diagnosis jsonb not null,
  prices jsonb not null,
  message text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table repair_records (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references workshops(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  brand text,
  model text,
  symptoms text[] not null default '{}',
  actual_fault text not null,
  actions text[] not null default '{}',
  parts_replaced text[] not null default '{}',
  actual_price_tl int,
  actual_duration text,
  created_at timestamptz not null default now()
);
create index repair_records_brand on repair_records (workshop_id, brand, created_at desc);

-- Giriş yapan kullanıcının atölyesi
create or replace function current_workshop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select workshop_id from profiles where user_id = auth.uid()
$$;

-- RLS: her atölye yalnızca kendi satırlarını görür ve değiştirir
do $$
declare t text;
begin
  foreach t in array array['brand_groups','brands','price_items','jobs','job_analyses','repair_records'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated
                    using (workshop_id = current_workshop_id())
                    with check (workshop_id = current_workshop_id())', t || '_own', t);
  end loop;
end $$;

alter table workshops enable row level security;
create policy workshops_own_select on workshops for select to authenticated using (id = current_workshop_id());
create policy workshops_own_update on workshops for update to authenticated
  using (id = current_workshop_id()) with check (id = current_workshop_id());

alter table profiles enable row level security;
create policy profiles_self on profiles for select to authenticated using (user_id = auth.uid());

alter table error_codes enable row level security;
create policy error_codes_read on error_codes for select to authenticated
  using (workshop_id is null or workshop_id = current_workshop_id());
create policy error_codes_write on error_codes for all to authenticated
  using (workshop_id = current_workshop_id()) with check (workshop_id = current_workshop_id());

grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function current_workshop_id() to authenticated;

-- Yeni atölyeye marka grupları, markalar ve örnek fiyatları ekler
create or replace function seed_workshop(p_workshop uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g_ducati uuid; g_xiaomi uuid; g_dualtron uuid; g_diger uuid;
begin
  insert into brand_groups(workshop_id,name,sort) values (p_workshop,'Ducati',1) returning id into g_ducati;
  insert into brand_groups(workshop_id,name,sort) values (p_workshop,'Xiaomi / Segway-Ninebot',2) returning id into g_xiaomi;
  insert into brand_groups(workshop_id,name,sort) values (p_workshop,'Dualtron / Yüksek Voltaj',3) returning id into g_dualtron;
  insert into brand_groups(workshop_id,name,sort) values (p_workshop,'Diğer',4) returning id into g_diger;

  insert into brands(workshop_id,name,group_id,sort) values
    (p_workshop,'Ducati',g_ducati,1),
    (p_workshop,'Segway',g_xiaomi,2),
    (p_workshop,'Ninebot',g_xiaomi,3),
    (p_workshop,'Xiaomi',g_xiaomi,4),
    (p_workshop,'Onvo',g_diger,5),
    (p_workshop,'Dualtron',g_dualtron,6);

  -- ÖRNEK fiyatlar (is_sample = true). Usta kendi fiyatlarıyla değiştirecek.
  insert into price_items(workshop_id,item_name,group_id,min_tl,max_tl,duration) values
    (p_workshop,'Kontrol kartı tamiri',g_diger,1500,2500,'2 gün'),
    (p_workshop,'Kontrol kartı tamiri',g_ducati,1500,2500,'2 gün'),
    (p_workshop,'Kontrol kartı tamiri',g_xiaomi,1500,2500,'2 gün'),
    (p_workshop,'Kontrol kartı tamiri',g_dualtron,3000,5000,'3-4 gün'),
    (p_workshop,'Kontrol kartı değişimi',g_diger,2500,4500,'1-3 gün'),
    (p_workshop,'Batarya hücre değişimi',g_diger,2000,6000,'2-3 gün'),
    (p_workshop,'BMS değişimi',g_diger,1200,2500,'1-2 gün'),
    (p_workshop,'Gaz kolu değişimi',g_diger,400,700,'Aynı gün'),
    (p_workshop,'Fren kolu / sensörü değişimi',g_diger,300,600,'Aynı gün'),
    (p_workshop,'Motor hall sensörü değişimi',g_diger,800,1500,'1 gün'),
    (p_workshop,'Ekran / dashboard kartı değişimi',g_diger,1000,2500,'1-2 gün'),
    (p_workshop,'Şarj soketi değişimi',g_diger,300,600,'Aynı gün'),
    (p_workshop,'Lastik / iç lastik değişimi',g_diger,300,900,'Aynı gün');
end $$;
