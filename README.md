# Beep test — grupno testiranje

Mobilna aplikacija za **20 m beep test (multi-stage fitness test)** za celu ekipu odjednom —
20 i više učesnika na jednom telefonu ili tabletu. Telefon pušta signal, trener samo dodiruje
pločicu igrača koji je ispao, a rezultat svakog igrača ostaje zapisan i poredi se sa ranijim
merenjima.

> Samostalna aplikacija: obične datoteke, bez koraka prevođenja, bez servera i bez zavisnosti.

## Šta radi

- **Igrači** — spisak sa brojem dresa, grupom/ekipom, datumom rođenja, visinom i težinom.
  Igrač se arhivira kad prestane da trenira, a istorija mu ostaje.
- **Testiranje** — biraju se učesnici (cela grupa jednim dugmetom), aplikacija odbrojava,
  pušta signale i vodi nivo i deonicu. Svaki igrač ima svoju pločicu; dodir je promašaj,
  drugi dodir ispadanje.
- **Istorija** — svako testiranje se pamti sa svim rezultatima; kod igrača se vidi napredak
  kroz vreme, najbolji i poslednji rezultat i grafikon.
- **Izvoz** — CSV po testiranju ili za sve rezultate, plus JSON rezervna kopija svega.

Sve radi **offline** i bez servera. Podaci stoje u pregledaču uređaja na kom se radi test.

## Kako se pokreće

Aplikacija su obične datoteke — treba joj samo statički server (zbog offline režima i
"instalacije" na telefon; preko `file://` radi, ali bez toga).

```powershell
# iz korena projekta (Windows)
python -m http.server 8765
# pa na telefonu u istoj mrezi: http://<ip-racunara>:8765/
```

```bash
# ili, ako je tu Node umesto Pythona
npx http-server -p 8765 .
```

Za stalnu upotrebu: prekopirati sadržaj projekta u bilo koji veb direktorijum
(IIS, nginx, Apache, GitHub Pages…). Poželjno je **HTTPS** — bez njega pregledač ne dozvoljava
instalaciju na početni ekran ni držanje ekrana uključenim.

**Instalacija na telefon:** otvoriti adresu u pregledaču → meni → *Dodaj na početni ekran*.
Posle toga se otvara kao aplikacija, preko celog ekrana i bez interneta.

## Kako se radi test

Dve linije na 20 m. Trči se od signala do signala; ko dva puta uzastopno ne stigne na liniju,
ispada. Test ima 21 nivo i 247 deonica, ukupno 21:56 trčanja. Brzina počinje na 8,5 km/h i
raste za 0,5 km/h na svakom nivou.

Na ekranu testiranja:

| Potez | Značenje |
|---|---|
| dodir na pločicu | promašaj — pločica požuti (opomena) |
| drugi dodir | igrač je ispao, upisuje se rezultat sa trenutka opomene |
| dugme **✓ stigao** | igrač je ipak stigao na liniju, opomena se briše |
| dugme **↺** | dodir je bio greška, igrač se vraća u trku |
| dug pritisak | *odustao* ili *povreda* (prekid koji nije ispadanje) |
| **Pauza** | sat i signali staju; nastavak ide uz odbrojavanje 3-2-1 |

Ako je opomena isključena u podešavanjima, prvi dodir odmah znači ispadanje.

Posle testa dolazi ekran rezultata gde se svaki rezultat može pomeriti za deonicu gore ili
dole (`−` / `+`) ako je oznaka data prerano ili prekasno, promeniti status i dopisati beleška.
Tek dugme **Sačuvaj test** upisuje testiranje u istoriju.

Ako se stranica osveži ili telefon zaključa usred testa, test se pamti i nudi se **Nastavi**
na ekranu *Novi test*.

## Rezultat i procene

Rezultat je **poslednja završena deonica**, u obliku `nivo.deonica` (npr. `10.5`), uz ukupan
broj deonica, pretrčane metre i vreme.

- **VO2max (ml/kg/min)** se računa po Ramsbottomu:
  `3,46 × (L + S / (L × 0,4325 + 7,0048)) + 12,2` — ne traži godine, pa stoji uz svaki rezultat.
- Kad je upisan datum rođenja, uz rezultat se čuva i **Légerova** procena:
  `31,025 + 3,238×S − 3,248×A + 0,1536×S×A` (S = brzina poslednjeg nivoa, A = godine),
  uobičajena za uzrasne kategorije.

Obe su procene, ne laboratorijsko merenje — vrede za praćenje istog igrača kroz vreme.

## Podaci

Sve stoji u `localStorage` pregledača na uređaju (ključ `beeptest.v1`), ništa ne odlazi na mrežu.
To znači:

- podaci su vezani za taj pregledač na tom uređaju — nema deljenja između trenera,
- brisanje podataka pregledača briše i evidenciju,
- pre promene telefona treba napraviti izvoz (*Podešavanja → Izvoz (JSON)*) i uvesti ga na novom.

Uvoz nudi *dodaj uz postojeće* (po `id`-u, bez duplikata) ili *zameni sve*.

## Datoteke

```
index.html                ekran i redosled ucitavanja
app.css                   izgled (svetla i tamna tema)
manifest.webmanifest      podaci za instalaciju na telefon
sw.js                     offline kes
icons/                    ikone aplikacije
js/protocol.js            tabela nivoa, deonice, VO2max, pretvaranja
js/data.js                cuvanje igraca, testova i podesavanja
js/audio.js               signali (Web Audio) i govorna najava nivoa
js/run.js                 motor testiranja: sat, opomene, ispadanja
js/app.js                 ekrani i ruter
test/protokol.test.js     provera racuna
test/motor.test.js        provera motora testiranja
test/podaci.test.js       provera cuvanja, izvoza i uvoza
test/ekrani.html          provera ekrana, u pregledacu
```

Nema koraka prevođenja ni zavisnosti — što stoji u datotekama, to se izvršava.

## Provera

```bash
node --test test/*.test.js
```

Pokriva tabelu nivoa, trajanje deonica, pretvaranje `nivo.deonica` ↔ broj deonica i obe
procene VO2max (poređene sa objavljenim tabelama).

Motor testiranja se proverava sa lažnim satom, pa ne traje 22 minuta: odbrojavanje,
brojanje deonica, opomena i ispadanje (rezultat se upisuje iz trenutka opomene),
vraćanje igrača u trku, odustanak i povreda, samostalni kraj kad svi ispadnu, pauza i
nastavak, oporavak posle osvežavanja i zakazivanje signala.

Čuvanje podataka se proverava sa lažnim `localStorage`-om: upis i arhiviranje igrača,
redosled po srpskoj latinici, godine na dan testiranja, istorija i rezultati igrača,
izvoz i uvoz (uz dodavanje bez duplikata), CSV sa zaštićenim poljima, pokvaren zapis
u pregledaču i puna memorija.

Ekrani se proveravaju u pregledaču, jer im treba pravi DOM. Uz pokrenut server otvoriti:

```
http://localhost:8765/test/ekrani.html
```

Stranica vodi pravu aplikaciju kroz ceo tok — dodavanje igrača, izbor učesnika, trčanje sa
lažnim satom, opomena i ispadanje, doterivanje rezultata, čuvanje, istorija, karton igrača
sa grafikonom i oporavak prekinutog testa — pa ispiše šta je prošlo a šta palo.
