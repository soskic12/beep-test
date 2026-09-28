/* Provera spajanja evidencije: node --test test/sinhronizacija.test.js

   Sinhronizacija koja pogresi ne pokvari ekran nego evidenciju - obrisan
   igrac vaskrsne, ili se preko novijeg zapisa upise stariji. Zato se ovde
   proverava svaki slucaj koji se u klubu stvarno desava: dva trenera rade
   odvojeno, pa se sretnu. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function napraviTelefon() {
  const memorija = {};
  const w = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memorija, k) ? memorija[k] : null),
      setItem(k, v) { memorija[k] = String(v); },
      removeItem(k) { delete memorija[k]; }
    },
    alert() {},
    memorija: memorija
  };
  global.window = w;
  ['protocol.js', 'testovi.js', 'data.js'].forEach((d) => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', d))];
    require(path.join(__dirname, '..', 'js', d));
  });
  w.DB.load();
  return w;
}

/* Prenos sa jednog telefona na drugi: sve sto je menjano posle zadatog casa. */
function prenesi(sa, na, odKad) {
  return na.DB.spoji(sa.DB.promene(odKad));
}

/* ---------- pecat izmene ---------- */

test('svaki zapis pamti kad je poslednji put menjan', () => {
  const w = napraviTelefon();
  const p = w.DB.dodajIgraca({ ime: 'Šoškić Đorđe' });
  assert.ok(p.izmenjen, 'igrač nosi vreme izmene');

  const pre = p.izmenjen;
  w.DB.izmeniIgraca(p.id, { broj: '7' });
  assert.ok(w.DB.igrac(p.id).izmenjen >= pre, 'izmena pomera vreme');

  const t = w.DB.sacuvajTest({ vrsta: 'beep', naziv: 'Test', datum: '2026-09-01T10:00:00.000Z', rezultati: [] });
  assert.ok(t.izmenjen, 'i testiranje nosi vreme izmene');
});

test('zatečena evidencija bez pečata dobija ga pri učitavanju', () => {
  const w = napraviTelefon();
  w.memorija['beeptest.v1'] = JSON.stringify({
    verzija: 1,
    igraci: [{ id: 'stari', ime: 'Pre sinhronizacije', kreiran: '2025-01-01T10:00:00.000Z' }],
    testovi: [{ id: 't', vrsta: 'beep', datum: '2025-02-01T10:00:00.000Z', rezultati: [] }],
    podesavanja: {}
  });
  w.DB.load();
  assert.strictEqual(w.DB.igrac('stari').izmenjen, '2025-01-01T10:00:00.000Z', 'uzima se datum upisa');
  assert.strictEqual(w.DB.test('t').izmenjen, '2025-02-01T10:00:00.000Z');
});

/* ---------- brisanje ostavlja trag ---------- */

test('obrisan igrač ne vaskrsne sa drugog telefona', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();

  const p = trener1.DB.dodajIgraca({ ime: 'Otišao iz kluba', grupa: 'Kadeti' });
  prenesi(trener1, trener2, '');
  assert.strictEqual(trener2.DB.igraci().length, 1, 'stigao je na drugi telefon');

  trener1.DB.obrisiIgraca(p.id);
  assert.strictEqual(trener1.DB.igraci().length, 0);

  prenesi(trener1, trener2, '');
  assert.strictEqual(trener2.DB.igraci().length, 0, 'brisanje je stiglo');

  /* a sad drugi trener salje nazad sve sto ima */
  prenesi(trener2, trener1, '');
  assert.strictEqual(trener1.DB.igraci().length, 0, 'i ne vraća ga natrag');
});

test('obrisano testiranje odnosi i svoje rezultate iz kartona', () => {
  const w = napraviTelefon();
  const p = w.DB.dodajIgraca({ ime: 'A' });
  const t = w.DB.sacuvajTest({
    vrsta: 'beep', naziv: 'Test', datum: '2026-09-01T10:00:00.000Z',
    rezultati: [{ igracId: p.id, ime: 'A', ukupnoDeonica: 40 }]
  });
  assert.strictEqual(w.DB.rezultatiIgraca(p.id).length, 1);
  w.DB.obrisiTest(t.id);
  assert.strictEqual(w.DB.rezultatiIgraca(p.id).length, 0, 'karton ne prikazuje obrisano testiranje');
  assert.strictEqual(w.DB.testovi().length, 0);
  assert.ok(w.DB.promene('').testovi.length, 'ali trag o brisanju postoji za sinhronizaciju');
});

/* ---------- spajanje ---------- */

test('noviji zapis pobeđuje, stariji se odbija', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();

  const p = trener1.DB.dodajIgraca({ ime: 'Marko', grupa: 'Kadeti' });
  prenesi(trener1, trener2, '');

  /* drugi trener ga prebaci u juniore, kasnije */
  const kopija = JSON.parse(JSON.stringify(trener2.DB.igrac(p.id)));
  kopija.grupa = 'Juniori';
  kopija.izmenjen = '2030-01-01T00:00:00.000Z';
  const izvestaj = trener1.DB.spoji({ igraci: [kopija], testovi: [] });

  assert.strictEqual(trener1.DB.igrac(p.id).grupa, 'Juniori', 'novija izmena je preuzeta');
  assert.strictEqual(izvestaj.osvezeno, 1);

  /* pa stigne stara verzija istog zapisa */
  const stara = JSON.parse(JSON.stringify(kopija));
  stara.grupa = 'Kadeti';
  stara.izmenjen = '2020-01-01T00:00:00.000Z';
  const drugi = trener1.DB.spoji({ igraci: [stara], testovi: [] });

  assert.strictEqual(trener1.DB.igrac(p.id).grupa, 'Juniori', 'stariji zapis ne gazi noviji');
  assert.strictEqual(drugi.preskoceno, 1);
});

test('dva trenera rade odvojeno pa se sretnu — sve ostaje', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();

  const a = trener1.DB.dodajIgraca({ ime: 'Kod prvog trenera', grupa: 'Kadeti' });
  trener1.DB.sacuvajTest({
    vrsta: 'beep', naziv: 'Beep u sredu', datum: '2026-09-01T10:00:00.000Z',
    rezultati: [{ igracId: a.id, ime: a.ime, ukupnoDeonica: 60 }]
  });

  const b = trener2.DB.dodajIgraca({ ime: 'Kod drugog trenera', grupa: 'Juniori' });
  trener2.DB.sacuvajTest({
    vrsta: 'sprint-20', naziv: 'Sprint u četvrtak', datum: '2026-09-02T10:00:00.000Z',
    rezultati: [{ igracId: b.id, ime: b.ime, najbolji: 3.1 }]
  });

  prenesi(trener1, trener2, '');
  prenesi(trener2, trener1, '');

  [trener1, trener2].forEach((t, i) => {
    assert.strictEqual(t.DB.igraci().length, 2, 'oba igrača na telefonu ' + (i + 1));
    assert.strictEqual(t.DB.testovi().length, 2, 'oba testiranja na telefonu ' + (i + 1));
    assert.strictEqual(t.DB.rezultatiIgraca(a.id).length, 1);
    assert.strictEqual(t.DB.rezultatiIgraca(b.id).length, 1);
  });
});

test('ponovljena sinhronizacija ne pravi duplikate', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();
  trener1.DB.dodajIgraca({ ime: 'Jedan jedini' });

  prenesi(trener1, trener2, '');
  const drugi = prenesi(trener1, trener2, '');
  const treci = prenesi(trener1, trener2, '');

  assert.strictEqual(trener2.DB.igraci().length, 1);
  assert.strictEqual(drugi.dodato, 0, 'drugi put se ništa ne dodaje');
  assert.strictEqual(treci.dodato, 0);
});

test('šalje se ono što je menjano od poslednje sinhronizacije', () => {
  const w = napraviTelefon();
  w.DB.dodajIgraca({ ime: 'Od prošle godine' });
  /* međa se pomera unapred, kao da je sinhronizacija bila kasnije */
  const medja = new Date(Date.now() + 1000).toISOString();
  assert.strictEqual(w.DB.promene(medja).igraci.length, 0, 'staro se ne šalje ponovo');

  const novi = w.DB.dodajIgraca({ ime: 'Novi' });
  const promene = w.DB.promene(novi.izmenjen);
  assert.ok(promene.igraci.some((p) => p.ime === 'Novi'),
    'promena iz iste milisekunde kao međa mora da se pošalje, inače se gubi zauvek');
  assert.strictEqual(w.DB.promene('').igraci.length, 2, 'od početka se šalje sve');
});

test('zapis poslat dvaput ne kvari ništa', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();
  const p = trener1.DB.dodajIgraca({ ime: 'Na međi' });

  /* isti zapis stigne dvaput, jer granica hvata i svoju milisekundu */
  trener2.DB.spoji(trener1.DB.promene(p.izmenjen));
  const drugi = trener2.DB.spoji(trener1.DB.promene(p.izmenjen));

  assert.strictEqual(trener2.DB.igraci().length, 1, 'nema duplikata');
  assert.strictEqual(drugi.dodato, 0);
  assert.strictEqual(drugi.preskoceno, 1, 'ponovljeni zapis se prosto preskače');
});

test('spajanje ne dira podešavanja uređaja', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();
  trener1.DB.postavi('zvuk', false);
  trener2.DB.postavi('zvuk', true);
  trener1.DB.dodajIgraca({ ime: 'A' });

  prenesi(trener1, trener2, '');
  assert.strictEqual(trener2.DB.podesavanja().zvuk, true,
    'zvuk i odbrojavanje su stvar uređaja, ne kluba');
});

test('rezultati testiranja putuju zajedno sa testiranjem', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();
  const p = trener1.DB.dodajIgraca({ ime: 'Šoškić Đorđe', grupa: 'Kadeti' });
  trener1.DB.sacuvajTest({
    vrsta: 'sprint-20', naziv: 'Sprint', datum: '2026-09-01T10:00:00.000Z',
    rezultati: [{ igracId: p.id, ime: p.ime, grupa: 'Kadeti', pokusaji: [3.2, 3.09], najbolji: 3.09, beleska: 'vetar u leđa' }]
  });

  prenesi(trener1, trener2, '');
  const r = trener2.DB.rezultatiIgraca(p.id, 'sprint-20')[0];
  assert.strictEqual(r.najbolji, 3.09);
  assert.deepStrictEqual(r.pokusaji, [3.2, 3.09]);
  assert.strictEqual(r.beleska, 'vetar u leđa', 'i beleška sa našim slovima');
});

test('izmena istog igrača na dva telefona — ostaje kasnija', () => {
  const trener1 = napraviTelefon();
  const trener2 = napraviTelefon();
  const p = trener1.DB.dodajIgraca({ ime: 'Marko', broj: '5' });
  prenesi(trener1, trener2, '');

  /* prvi trener upise visinu, drugi kasnije broj dresa */
  const kodPrvog = JSON.parse(JSON.stringify(trener1.DB.igrac(p.id)));
  kodPrvog.visina = '195';
  kodPrvog.izmenjen = '2026-09-01T10:00:00.000Z';

  const kodDrugog = JSON.parse(JSON.stringify(trener2.DB.igrac(p.id)));
  kodDrugog.broj = '9';
  kodDrugog.izmenjen = '2026-09-02T10:00:00.000Z';

  const w = napraviTelefon();
  w.DB.spoji({ igraci: [kodPrvog], testovi: [] });
  w.DB.spoji({ igraci: [kodDrugog], testovi: [] });

  const konacno = w.DB.igrac(p.id);
  assert.strictEqual(konacno.broj, '9', 'kasnija izmena je preuzeta cela');
  assert.strictEqual(konacno.visina, '', 'a raniji upis visine je izgubljen — spaja se ceo zapis, ne polje po polje');
});
