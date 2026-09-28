-- Šema za zajedničku evidenciju kluba (Supabase / PostgreSQL).
--
-- Zamisao: aplikacija i dalje radi bez mreže i drži svoje zapise onakve kakvi
-- jesu. Server je ostava i poštar, ne gospodar oblika podataka — zato ceo
-- zapis stoji kao JSON, isti onaj koji aplikacija već ima. Tako dodavanje
-- novog testa ne traži izmenu baze.
--
-- Ono što jeste u kolonama je ono po čemu se traži i po čemu se odlučuje:
-- kom klubu zapis pripada, kad je poslednji put menjan i da li je obrisan.
--
-- Pokreće se jednom, u Supabase → SQL Editor → New query → Run.

-- ---------------------------------------------------------------- klub

create table if not exists klub (
  id          uuid primary key default gen_random_uuid(),
  naziv       text not null,
  napravljen  timestamptz not null default now()
);

-- Trener je nalog. Vezuje se za Supabase prijavu i za tačno jedan klub.
create table if not exists trener (
  id          uuid primary key references auth.users on delete cascade,
  klub_id     uuid references klub on delete cascade,
  ime         text,
  uloga       text not null default 'trener'
                check (uloga in ('vlasnik', 'trener')),
  napravljen  timestamptz not null default now()
);

-- Kom klubu pripada onaj ko je upravo prijavljen.
-- security definer: funkcija sme da pročita tabelu trener i kad pravila
-- pristupa to korisniku ne bi dozvolila — inače bi pravila zavisila sama od
-- sebe i ništa se ne bi videlo.
create or replace function moj_klub()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select klub_id from trener where id = auth.uid()
$$;

-- ------------------------------------------------------------ evidencija

-- id je text, ne uuid: aplikacija radi i u pregledačima bez crypto.randomUUID,
-- gde sama pravi oznake oblika "id-mfx2...".
create table if not exists igrac (
  id         text primary key,
  klub_id    uuid not null references klub on delete cascade,
  podaci     jsonb not null,
  izmenjen   timestamptz not null,
  obrisan    boolean not null default false
);

create table if not exists testiranje (
  id         text primary key,
  klub_id    uuid not null references klub on delete cascade,
  podaci     jsonb not null,
  izmenjen   timestamptz not null,
  obrisan    boolean not null default false,
  -- izvučeno iz JSON-a da se po njemu može tražiti i izveštavati,
  -- bez razbijanja zapisa na kolone
  vrsta      text generated always as (podaci ->> 'vrsta') stored,
  datum      timestamptz generated always as ((podaci ->> 'datum')::timestamptz) stored
);

-- Povlačenje ide po klubu i vremenu izmene — po tome i indeks.
create index if not exists igrac_klub_izmenjen on igrac (klub_id, izmenjen);
create index if not exists testiranje_klub_izmenjen on testiranje (klub_id, izmenjen);
create index if not exists testiranje_klub_vrsta on testiranje (klub_id, vrsta);

-- --------------------------------------------------------- ko šta sme

alter table klub       enable row level security;
alter table trener     enable row level security;
alter table igrac      enable row level security;
alter table testiranje enable row level security;

-- Trener vidi samo svoj klub i samo evidenciju svog kluba. Ovo nije udobnost
-- nego granica: bez ovoga bi jedan nalog mogao da pročita tuđe igrače.
create policy "svoj klub" on klub
  for select using (id = moj_klub());

create policy "svoj nalog" on trener
  for select using (id = auth.uid() or klub_id = moj_klub());
create policy "svoj nalog upis" on trener
  for insert with check (id = auth.uid());
create policy "svoj nalog izmena" on trener
  for update using (id = auth.uid());

create policy "igraci svog kluba" on igrac
  for all using (klub_id = moj_klub()) with check (klub_id = moj_klub());

create policy "testiranja svog kluba" on testiranje
  for all using (klub_id = moj_klub()) with check (klub_id = moj_klub());

-- ------------------------------------------------------ slanje izmena

-- Upis sa servera kao sudijom: stariji zapis ne sme da pregazi noviji, čak ni
-- kad telefon danima nije bio na mreži pa šalje zastarelo stanje.
create or replace function sinh_upisi(zapisi jsonb, tabela text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  upisano integer := 0;
  klub uuid := moj_klub();
begin
  if klub is null then
    raise exception 'nalog nije vezan ni za jedan klub';
  end if;

  if tabela = 'igrac' then
    insert into igrac (id, klub_id, podaci, izmenjen, obrisan)
    select z ->> 'id', klub, z -> 'podaci', (z ->> 'izmenjen')::timestamptz,
           coalesce((z ->> 'obrisan')::boolean, false)
    from jsonb_array_elements(zapisi) as z
    on conflict (id) do update
      set podaci = excluded.podaci,
          izmenjen = excluded.izmenjen,
          obrisan = excluded.obrisan
      where excluded.izmenjen > igrac.izmenjen;
    get diagnostics upisano = row_count;

  elsif tabela = 'testiranje' then
    insert into testiranje (id, klub_id, podaci, izmenjen, obrisan)
    select z ->> 'id', klub, z -> 'podaci', (z ->> 'izmenjen')::timestamptz,
           coalesce((z ->> 'obrisan')::boolean, false)
    from jsonb_array_elements(zapisi) as z
    on conflict (id) do update
      set podaci = excluded.podaci,
          izmenjen = excluded.izmenjen,
          obrisan = excluded.obrisan
      where excluded.izmenjen > testiranje.izmenjen;
    get diagnostics upisano = row_count;

  else
    raise exception 'nepoznata tabela: %', tabela;
  end if;

  return upisano;
end;
$$;

-- ------------------------------------------------- prvi klub i prvi trener
--
-- Pokrenuti tek POSLE prve prijave u aplikaciju (da nalog postoji), i
-- zameniti adresu svojom:
--
--   insert into klub (naziv) values ('ŠKK Elbraco Technoland')
--   returning id;
--
--   insert into trener (id, klub_id, ime, uloga)
--   select u.id, k.id, 'Ime trenera', 'vlasnik'
--   from auth.users u, klub k
--   where u.email = 'adresa@primer.com' and k.naziv = 'ŠKK Elbraco Technoland';
--
-- Svaki sledeći trener se dodaje istim upisom, sa ulogom 'trener'.
