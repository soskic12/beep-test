# Stanje projekta

Zapisano **10. oktobra 2026.** Ovaj dokument postoji zato da se, ako se izgubi
radni računar, zna tačno dokle se stiglo, šta je odlučeno i zašto — jer se
odluke ne vide iz koda.

Verzija aplikacije: **v10** · commit `cd131d8` · 29 datoteka · 108 provera u
Node-u, 111 u pregledaču, sve prolaze.

## Gde sve postoji

| Kopija | Adresa | Šta sadrži |
|---|---|---|
| GitHub | `github.com/soskic12/beep-test` (privatan) | ceo izvorni kod i istorija |
| Cloudflare | https://beep-test.baneso12.workers.dev | objavljena aplikacija, sama se obnavlja iz GitHub-a |
| Radni računar | `H:\CLAUDE PROJECTS\beep-test` | isto što i GitHub |

Objavljivanje je samo: svaki `git push` na `main` Cloudflare sam objavi za
dvadesetak sekundi. Nema koraka prevođenja ni zavisnosti — što stoji u
datotekama, to se izvršava.

**Evidencija trenera (igrači i rezultati) nije ovde.** Ona stoji u pregledaču
na telefonu i ne postoji nigde drugde dok se ne napravi izvoz. Zato aplikacija
opominje kad ima testiranja koja nisu ni u jednoj kopiji.

## Šta aplikacija radi

Testiranje cele ekipe na jednom telefonu, offline, uz evidenciju kroz sezone.

**Testovi** (`js/testovi.js` je jedino mesto koje zna šta je koji test):

| Grupa | Test | Meri se | Bolje je | Čime |
|---|---|---|---|---|
| Izdržljivost | Beep test | nivo.deonica | više | signal iz aplikacije |
| Skok | Iz mesta, sa zaletom | cm, 3 pokušaja | više | zid i dohvat *ili* traka |
| Brzina | Sprint 20 m, 3/4 terena | s, 2–3 pokušaja | **manje** | štoperica *ili* foto-ćelije |
| Agilnost | Lane agility, T-test, 505 | s, 2 pokušaja | **manje** | štoperica *ili* foto-ćelije |
| Merenje | Visina, težina, raspon, dohvat | cm i kg | — | pantljika i vaga |

Beep test ima svoj ekran testiranja (sat, signali, pločice po igraču). Ostali
se unose posle merenja, sa štopericom u telefonu za one na vreme.

**Ekrani:** Igrači · Novi test (spisak po grupama) · priprema beep testa ·
testiranje · rezultati pre čuvanja · Testovi · jedno testiranje · izveštaj ·
karton igrača · unos rezultata · Podešavanja.

## Odluke koje se ne vide iz koda

Ovo su mesta gde je biran jedan put a postojao je i drugi. Ako se nešto od
ovoga menja, treba znati šta se gubi.

**Rezultat se upisuje iz trenutka opomene.** Igraču sa neskinutom opomenom na
kraju testa upisuje se deonica iz trenutka opomene, ne trenutna. Greška naniže
se vidi i popravlja dugmadima `−`/`+`; greška naviše se ne primeti nikad, jer
izgleda uverljivo.

**Pločice se ne premeštaju usred testa.** Primamljivo je ispale pomeriti na
kraj, ali bi se meta pomerila ispod prsta i trener bi pritisnuo pogrešnog
igrača.

**Nema percentila.** Percentil znači „bolji od 78% populacije" i traži uzorak
koji nemamo. Poredi se sa evidencijom kluba i tako i piše: mesto u grupi,
odnos prema proseku, napredak u odnosu na sopstvenu istoriju. Ispod tri
rezultata se ne govori ni o proseku.

**Pamti se čime je mereno, i poredi se samo sa istim načinom.** Štoperica daje
sistematski kraće vreme od foto-ćelija. Podrazumevan je uvek način bez opreme,
jer aplikacija mora da radi i na seoskom terenu.

**Skok je razlika dohvata (Sargent).** Upisuje se dohvat u skoku, visinu
računa aplikacija. Dohvat u stojećem stavu se pamti **uz sam rezultat** — da
merenje tela u martu ne bi naknadno promenilo skokove iz septembra.

**Osvežavanje preskače testiranje u toku.** Nova verzija se povlači sama, ali
nikad usred merenja.

**Podešavanja se ne dele među trenerima.** Zvuk, odbrojavanje i opomena su
stvar uređaja.

## Kvarovi nađeni i popravljeni

Redom kojim su se pojavili — korisno jer pokazuje gde ova vrsta aplikacije peca:

1. Uvoz je čitao datoteku samo kao UTF-8, pa je „Šoškić" iz ANSI datoteke
   postajao `?o?ki?`, nepovratno.
2. Nastavak posle pauze vraćao je sat tri sekunde unazad — ekipa je čula
   signal usred odbrojavanja i kretala ranije.
3. Zaustavljen igrač je na kraju testa dobijao rezultat najboljeg.
4. Spisak igrača je bio poređan po ćirilici (`'sr'`), pa je „Ćirić" stajao
   ispred „Cvetković". Ispravno je `'sr-Latn'`.
5. Doterivanje rezultata je pisalo preko broja dresa.
6. Instalirana aplikacija nije mogla da se pokrene jer je hosting
   preusmeravao `/index.html` na `/`, a service worker je keširao preusmeren
   odgovor.
7. Samoosvežavanje se okidalo i pri prvoj instalaciji, bez potrebe.
8. Karta igrača je mešala vrste testova i pisala `zadnje undefined.undefined`.
9. Kod antropometrije je pisalo „najbolji 195 cm" — merenje nema najboljeg.
10. Obrisano testiranje je i dalje davalo rezultate u kartonu.
11. Promena u istoj milisekundi kao sinhronizacija ne bi se poslala nikad.

## Šta je sledeće

**1. Zajednička evidencija (u toku).** Pripremljeno je sve što ne zavisi od
servera: svaki zapis nosi vreme izmene, brisanje ostavlja trag, `DB.promene()`
i `DB.spoji()` rade i provereni su sa 12 provera. Šema baze i uputstvo stoje u
[`server/`](server/).

> **Čeka se:** Supabase projekat (uputstvo: [`server/UPUTSTVO.md`](server/UPUTSTVO.md)),
> pa **Project URL** i **anon public** ključ. Posle toga: prijava, dugme za
> sinhronizaciju i prikaz stanja.

**2. Norme.** Izvori koji stvarno postoje popisani su u [README](README.md).
Za beep test su primenljivi (protokol ne zavisi od opreme); za sprint i skok
nisu, jer su merene foto-ćelijama i trakom. Čeka se čovek sa pristupom
tabelama — tražiti uz svaku normu: na kome je merena, **čime** je merena i
koliki je uzorak.

**3. Šminka.** Izgled izveštaja i sitno doterivanje, namerno ostavljeno za
kraj.

**4. Kasnije.** Animacije protokola (vektorske, ne AI video — modeli greše u
broju koraka i smeru okreta, a to je kod protokola greška a ne sitnica),
procena zrelosti i rasta (PHV) iz podataka koji se već skupljaju, i pakovanje
u Play Store (TWA) i App Store.

## Kako se radi na projektu

```bash
node --test test/*.test.js          # 108 provera, bez ijedne zavisnosti
python -m http.server 8765          # pa http://localhost:8765/
#                                     i http://localhost:8765/test/ekrani.html
```

Provera ekrana **briše podatke u pregledaču** da bi počela od praznog stanja —
pravi kopiju i vraća je na kraju, ali ne puštati je na uređaju sa evidencijom
bez izvoza.

Pri svakoj objavi podiže se verzija na dva mesta: `VERZIJA` u `js/app.js` i
`KES` u `sw.js`. Provera `test/verzija.test.js` pazi da se ne raziđu.
