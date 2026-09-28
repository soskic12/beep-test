# Zajednička evidencija kluba — postavljanje

Ovo je uputstvo za otvaranje servera na kom više trenera deli istu evidenciju.
Treba ga proći jednom. Aplikacija i dalje radi bez mreže; server je tu da se
ono što je upisano na jednom telefonu pojavi i na drugom.

## Šta se čime rešava

| | gde stoji | šta se dešava bez mreže |
|---|---|---|
| igrači i testiranja | telefon **i** server | radi normalno, pošalje se kad mreža dođe |
| testiranje u toku | samo telefon | nikad ne zavisi od mreže |
| zvuk, odbrojavanje, tema | samo telefon | svaki trener ima svoja |

Podešavanja se namerno **ne** dele: to je stvar uređaja, ne kluba.

## 1. Nalog i projekat

1. Otvori nalog na [supabase.com](https://supabase.com) (besplatan).
2. *New project*:
   - **Name**: `beep-test`
   - **Database password**: izaberi i **sačuvaj ga** — kasnije se ne vidi.
   - **Region**: `Central EU (Frankfurt)` — podaci maloletnika treba da stoje
     u EU, a i najbliži je.
3. Sačekaj minut-dva dok se projekat ne napravi.

## 2. Šema

*SQL Editor* → *New query* → nalepi ceo sadržaj datoteke
[`shema.sql`](shema.sql) → **Run**.

Treba da piše `Success`. Time su napravljene tabele, pravila pristupa (jedan
klub ne vidi tuđe igrače) i funkcija koja pazi da stariji zapis ne pregazi
noviji.

## 3. Prijava mejlom

*Authentication* → *Providers* → **Email**:

- **Enable email provider**: uključeno
- **Confirm email**: isključeno za početak (dok smo samo mi) — inače svaka
  prijava traži potvrdu iz poštanskog sandučeta
- *Authentication* → *URL Configuration* → **Site URL**:
  `https://beep-test.baneso12.workers.dev`

## 4. Ključevi — ovo mi pošalji

*Project Settings* → *API*:

- **Project URL** — oblika `https://xxxxxxxx.supabase.co`
- **anon public** ključ — dugačak niz koji počinje sa `eyJ...`

Oba smeju u kod aplikacije. **`service_role` ključ ne šalji nikome i ne stavljaj
ga u aplikaciju** — on zaobilazi sva pravila pristupa.

## 5. Klub i treneri

Ovo ide tek pošto se prvi put prijaviš kroz aplikaciju, da nalog postoji:

```sql
insert into klub (naziv) values ('ŠKK Elbraco Technoland') returning id;

insert into trener (id, klub_id, ime, uloga)
select u.id, k.id, 'Ime trenera', 'vlasnik'
from auth.users u, klub k
where u.email = 'tvoja@adresa.com'
  and k.naziv = 'ŠKK Elbraco Technoland';
```

Svaki sledeći trener: neka se prijavi u aplikaciji, pa isti upis sa njegovom
adresom i ulogom `'trener'`.

## Kako radi sinhronizacija

Telefon pamti kad je poslednji put razmenio podatke. Pri sledećem povezivanju:

1. **povuče** sve što je u klubu menjano od tog trenutka,
2. **spoji** sa svojim — pobeđuje zapis sa novijim vremenom izmene,
3. **pošalje** sve što je sam menjao.

Brisanje se ne briše nego obeležava, inače bi obrisan igrač vaskrsnuo sa
drugog telefona pri prvoj sinhronizaciji.

Spaja se **ceo zapis**, ne polje po polje. Ako dva trenera istog dana menjaju
istog igrača — jedan upiše visinu, drugi broj dresa — ostaje ono što je
upisano kasnije, a ranija izmena se gubi. Za evidenciju u kojoj se igrač
menja retko to je pošteno pravilo; da je reč o zapisu koji se menja često,
morali bismo da spajamo polje po polje, što je znatno složenije.

## Cena

Besplatan nivo pokriva klub bez muke: 500 MB baze i 50.000 mesečnih prijava.
Cela evidencija jednog kluba sa desetak testiranja godišnje meri se u
megabajtima. Plaćeni nivo (25 $ mesečno) postaje potreban tek kad se pređe na
više klubova.
