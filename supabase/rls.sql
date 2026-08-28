-- ============================================================
--  Row Level Security voor het Luma-project
--  Plak dit in Supabase › SQL Editor en voer het uit.
--
--  Waarom dit het echte slot is:
--  de anon key staat in de broncode van elke webshop en hoort
--  daar ook. Die sleutel zegt alleen "ik ben een bezoeker".
--  Wat een bezoeker mag, bepaal je hier. Zonder deze policies
--  mag de anon-rol alles, en verandert een inlogscherm daar
--  niets aan.
-- ============================================================


-- ------------------------------------------------------------
-- STAP 0 — eerst kijken, dan pas wijzigen
-- Voer dit blok apart uit en lees het resultaat.
-- Staat rowsecurity al op true, dan is die tabel al beveiligd.
-- ------------------------------------------------------------

-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--  order by tablename;


-- ------------------------------------------------------------
-- STAP 1 — luma_data  (producten, promotekst, hero-afbeelding)
--
-- De winkel zelf leest deze tabel anoniem:
--   index.html:789   db.from('luma_data').select('*')
-- Lezen moet dus open blijven, anders is de webshop leeg.
--
-- Schrijven gebeurt alleen vanuit het adminpaneel:
--   admin.html:505   upsert products
--   admin.html:859   upsert promo
--   admin.html:926   upsert hero_image
-- Dat zetten we vast op ingelogde gebruikers.
-- ------------------------------------------------------------

alter table public.luma_data enable row level security;

drop policy if exists "luma_data: iedereen mag lezen" on public.luma_data;
create policy "luma_data: iedereen mag lezen"
  on public.luma_data
  for select
  to anon, authenticated
  using (true);

drop policy if exists "luma_data: alleen beheer mag schrijven" on public.luma_data;
create policy "luma_data: alleen beheer mag schrijven"
  on public.luma_data
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);


-- ------------------------------------------------------------
-- STAP 2 — orders  (namen, adressen, bestellingen van klanten)
--
-- Hier hoort geen enkele anonieme toegang bij. Niets in de
-- winkel leest of schrijft deze tabel vanuit de browser.
--
--   admin.html:546   select  → beheerder bekijkt bestellingen
--   admin.html:615   update  → beheerder zet de status
--   api/webhook.js   insert  → server, met de service key
--
-- De service key gaat sowieso langs RLS heen, dus de webhook
-- heeft hier geen policy nodig en blijft gewoon werken.
-- ------------------------------------------------------------

alter table public.orders enable row level security;

drop policy if exists "orders: alleen beheer mag lezen" on public.orders;
create policy "orders: alleen beheer mag lezen"
  on public.orders
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "orders: alleen beheer mag wijzigen" on public.orders;
create policy "orders: alleen beheer mag wijzigen"
  on public.orders
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Let op: er komt bewust géén insert-policy voor anon of
-- authenticated. Bestellingen mogen alleen ontstaan via de
-- webhook, en die heeft de service key. Kan een bezoeker zelf
-- rijen in orders zetten, dan kan hij bestellingen verzinnen.


-- ------------------------------------------------------------
-- STAP 3 — controleren dat het gepakt heeft
-- ------------------------------------------------------------

-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public' and tablename in ('luma_data','orders');
--
-- select tablename, policyname, roles, cmd
--   from pg_policies
--  where schemaname = 'public'
--  order by tablename, policyname;


-- ------------------------------------------------------------
-- STAP 4 — daarna zelf even testen
--
--   1. luma-lights.be openen in een privévenster.
--      De producten, promotekst en hero moeten er nog staan.
--      Zijn ze weg, dan pakte de leespolicy van stap 1 niet.
--
--   2. Inloggen op het adminpaneel, een prijs wijzigen,
--      opslaan, en de winkel herladen.
--
--   3. In het adminpaneel de bestellingen openen.
--      Uitloggen en de pagina herladen: nu hoort er niets
--      meer te laden.
-- ------------------------------------------------------------


-- ============================================================
--  Nog niet hier ingevuld: de tabel `leads`
--
--  Die stond wel in de audit, maar komt in deze repo nergens
--  voor. Geen enkele regel in index.html, admin.html of api/
--  raakt hem aan. Waarschijnlijk hoort hij bij een ander
--  project (velostock heeft eigen functies create-order en
--  list-orders).
--
--  Ik schrijf er bewust geen policy voor: zet je RLS aan op
--  een tabel waarvan je niet weet wie hem gebruikt, dan breek
--  je dat project stil. Zoek eerst uit welke site `leads`
--  vult, dan volgt de policy vanzelf.
-- ============================================================
