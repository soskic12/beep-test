/* Provera cuvanja podataka: node --test test/podaci.test.js
   Ovde stoji sve sto treba da prezivi godinama - spisak igraca, istorija
   testiranja, izvoz i uvoz - pa se proverava sa laznim localStorage-om. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ---------- lazni localStorage ---------- */

function napraviProzor(opcije) {
  const memorija = {};
  const w = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memorija, k) ? memorija[k] : null),
      setItem(k, v) {
        if (opcije && opcije.puna) throw new Error('QuotaExceededError');
        memorija[k] = String(v);
      },
      removeItem(k) { delete memorija[k]; }
    },
    alert(poruka) { w.poruke.push(poruka); },
    poruke: [],
    memorija: memorija
  };
  global.window = w;
  delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'data.js'))];
  require(path.join(__dirname, '..', 'js', 'data.js'));
  w.DB.load();
  return w;
}

/* ---------- igraci ---------- */

test('igrac se upise, nadje i prezivi ponovno ucitavanje', () => {
  const w = napraviProzor();
  const p = w.DB.dodajIgraca({ ime: '  Šoškić Đorđe  ', broj: ' 7 ', grupa: 'Kadeti' });
  assert.strictEqual(p.ime, 'Šoškić Đorđe', 'suvisni razmaci se skidaju');
  assert.strictEqual(p.broj, '7');
  assert.ok(p.id && p.kreiran, 'igrac dobija svoj id i datum upisa');

  w.DB.load();                                  // kao da je aplikacija ponovo otvorena
  const vracen = w.DB.igrac(p.id);
  assert.strictEqual(vracen.ime, 'Šoškić Đorđe');
  assert.strictEqual(w.DB.igraci().length, 1);
});

test('arhiviran igrac nestaje sa spiska, ali ostaje u evidenciji', () => {
  const w = napraviProzor();
  const p = w.DB.dodajIgraca({ ime: 'Mika', grupa: 'Kadeti' });
  w.DB.arhivirajIgraca(p.id, true);
  assert.strictEqual(w.DB.igraci().length, 0, 'ne prikazuje se u redovnom spisku');
  assert.strictEqual(w.DB.igraci(true).length, 1, 'vidi se kad se traze i arhivirani');
  assert.ok(w.DB.igrac(p.id), 'i dalje se nalazi po id-u');
});

test('spisak je poredjan po grupi pa po imenu, po srpskoj latinici', () => {
  const w = napraviProzor();
  ['Čolić', 'Cvetković', 'Ćirić', 'Živković', 'Ašanin', 'Džaja', 'Đorđević'].forEach((ime) => w.DB.dodajIgraca({ ime, grupa: 'A' }));
  w.DB.dodajIgraca({ ime: 'Abramović', grupa: 'B' });
  const imena = w.DB.igraci().map((p) => p.ime);
  assert.deepStrictEqual(imena,
    ['Ašanin', 'Cvetković', 'Čolić', 'Ćirić', 'Džaja', 'Đorđević', 'Živković', 'Abramović'],
    'azbucni red srpske latinice: C, Č, Ć, DŽ, Đ, a Ž na kraju - i grupa je jaca od imena');
});

test('i spisak grupa ide po srpskoj latinici', () => {
  const w = napraviProzor();
  ['Čukarica', 'Cvetkova', 'Ćirilova', 'Železnik'].forEach((g, i) => w.DB.dodajIgraca({ ime: 'I' + i, grupa: g }));
  assert.deepStrictEqual(w.DB.grupe(), ['Cvetkova', 'Čukarica', 'Ćirilova', 'Železnik']);
});

test('grupe se izvlace iz igraca, bez ponavljanja', () => {
  const w = napraviProzor();
  w.DB.dodajIgraca({ ime: 'A', grupa: 'Kadeti' });
  w.DB.dodajIgraca({ ime: 'B', grupa: 'Pioniri' });
  w.DB.dodajIgraca({ ime: 'C', grupa: 'Kadeti' });
  w.DB.dodajIgraca({ ime: 'D', grupa: '' });
  assert.deepStrictEqual(w.DB.grupe(), ['Kadeti', 'Pioniri']);
});

test('godine se racunaju na dan testiranja, ne na danasnji dan', () => {
  const w = napraviProzor();
  const p = w.DB.dodajIgraca({ ime: 'A', datumRodjenja: '2008-06-15' });
  assert.strictEqual(w.DB.godine(p, '2024-06-14'), 15, 'dan pre rodjendana');
  assert.strictEqual(w.DB.godine(p, '2024-06-15'), 16, 'na rodjendan');
  assert.strictEqual(w.DB.godine(p, '2024-12-31'), 16);
  assert.strictEqual(w.DB.godine({ ime: 'B' }), null, 'bez datuma rodjenja nema godina');
  assert.strictEqual(w.DB.godine(p, 'ovo nije datum'), w.DB.godine(p), 'los datum pada na danasnji dan');
});

/* ---------- testovi i istorija ---------- */

function upisiTest(w, datum, rezultati, naziv) {
  return w.DB.sacuvajTest({
    naziv: naziv || 'Beep test',
    datum: datum,
    rezultati: rezultati
  });
}

test('testiranje se upise u istoriju i izmena ne pravi duplikat', () => {
  const w = napraviProzor();
  const t = upisiTest(w, '2025-03-01T10:00:00.000Z', [{ igracId: 'a', ime: 'A', ukupnoDeonica: 30 }]);
  assert.ok(t.id);
  assert.strictEqual(w.DB.testovi().length, 1);

  t.naziv = 'Prolecno merenje';
  w.DB.sacuvajTest(t);
  assert.strictEqual(w.DB.testovi().length, 1, 'isti test se ne upisuje dvaput');
  assert.strictEqual(w.DB.test(t.id).naziv, 'Prolecno merenje');
});

test('istorija ide od najnovijeg ka najstarijem', () => {
  const w = napraviProzor();
  upisiTest(w, '2025-01-10T10:00:00.000Z', [], 'januar');
  upisiTest(w, '2025-09-10T10:00:00.000Z', [], 'septembar');
  upisiTest(w, '2025-05-10T10:00:00.000Z', [], 'maj');
  assert.deepStrictEqual(w.DB.testovi().map((t) => t.naziv), ['septembar', 'maj', 'januar']);
});

test('rezultati jednog igraca se skupljaju kroz sva testiranja, od starijeg ka novijem', () => {
  const w = napraviProzor();
  upisiTest(w, '2025-09-10T10:00:00.000Z', [
    { igracId: 'a', ime: 'A', ukupnoDeonica: 40 },
    { igracId: 'b', ime: 'B', ukupnoDeonica: 20 }
  ], 'jesen');
  upisiTest(w, '2025-03-10T10:00:00.000Z', [
    { igracId: 'a', ime: 'A', ukupnoDeonica: 30 }
  ], 'prolece');

  const njegovi = w.DB.rezultatiIgraca('a');
  assert.strictEqual(njegovi.length, 2);
  assert.deepStrictEqual(njegovi.map((r) => r.ukupnoDeonica), [30, 40], 'napredak se cita hronoloski');
  assert.strictEqual(njegovi[0].naziv, 'prolece', 'uz rezultat stoji iz kog je testiranja');
  assert.ok(njegovi[0].testId, 'i veza ka samom testiranju');
  assert.strictEqual(w.DB.rezultatiIgraca('niko').length, 0);
});

test('brisanje testiranja ne dira igrace', () => {
  const w = napraviProzor();
  const p = w.DB.dodajIgraca({ ime: 'A' });
  const t = upisiTest(w, '2025-03-01T10:00:00.000Z', [{ igracId: p.id, ime: 'A', ukupnoDeonica: 30 }]);
  w.DB.obrisiTest(t.id);
  assert.strictEqual(w.DB.testovi().length, 0);
  assert.ok(w.DB.igrac(p.id), 'igrac ostaje');
  assert.strictEqual(w.DB.rezultatiIgraca(p.id).length, 0);
});

/* ---------- test u toku ---------- */

test('zapoceti test se pamti odvojeno i moze da se odbaci', () => {
  const w = napraviProzor();
  w.DB.sacuvajTok({ id: 'tok-1', status: 'pauza', ucesnici: [{ ime: 'Šoškić' }] });
  const tok = w.DB.ucitajTok();
  assert.strictEqual(tok.id, 'tok-1');
  assert.strictEqual(tok.ucesnici[0].ime, 'Šoškić');
  w.DB.obrisiTok();
  assert.strictEqual(w.DB.ucitajTok(), null);
});

/* ---------- izvoz i uvoz ---------- */

test('izvoz i uvoz vracaju isto stanje', () => {
  const w = napraviProzor();
  w.DB.dodajIgraca({ ime: 'Šoškić Đorđe', grupa: 'Kadeti' });
  upisiTest(w, '2025-03-01T10:00:00.000Z', [{ igracId: 'a', ime: 'Šoškić Đorđe', ukupnoDeonica: 30 }]);
  w.DB.postavi('opomena', false);
  const kopija = w.DB.izvoz();

  const drugi = napraviProzor();                 // drugi telefon
  drugi.DB.uvoz(kopija, false);
  assert.strictEqual(drugi.DB.igraci()[0].ime, 'Šoškić Đorđe');
  assert.strictEqual(drugi.DB.testovi().length, 1);
  assert.strictEqual(drugi.DB.podesavanja().opomena, false, 'i podesavanja se prenose');
});

test('dodavanje uz postojece ne pravi duplikate, zamena brise staro', () => {
  const w = napraviProzor();
  const stari = w.DB.dodajIgraca({ ime: 'Stari' });
  const kopija = JSON.stringify({
    verzija: 1,
    igraci: [{ id: stari.id, ime: 'Stari' }, { id: 'novi-1', ime: 'Novi' }],
    testovi: [{ id: 't1', datum: '2025-03-01T10:00:00.000Z', rezultati: [] }],
    podesavanja: {}
  });

  w.DB.uvoz(kopija, true);
  assert.deepStrictEqual(w.DB.igraci().map((p) => p.ime), ['Novi', 'Stari'], 'isti id se ne dodaje dvaput');
  assert.strictEqual(w.DB.testovi().length, 1);

  w.DB.uvoz(kopija, true);
  assert.strictEqual(w.DB.igraci().length, 2, 'ni iz drugog pokusaja');
  assert.strictEqual(w.DB.testovi().length, 1);

  w.DB.uvoz(JSON.stringify({ verzija: 1, igraci: [], testovi: [], podesavanja: {} }), false);
  assert.strictEqual(w.DB.igraci().length, 0, 'zamena brise sve');
});

test('uvoz tudje datoteke se odbija, a podaci ostaju netaknuti', () => {
  const w = napraviProzor();
  w.DB.dodajIgraca({ ime: 'A' });
  assert.throws(() => w.DB.uvoz('{"nesto":1}', false), /nije izvoz/i);
  assert.throws(() => w.DB.uvoz('ovo nije json', false));
  assert.strictEqual(w.DB.igraci().length, 1, 'postojeci igraci ostaju');
});

test('uvezeni podaci prezivljavaju ponovno ucitavanje', () => {
  const w = napraviProzor();
  w.DB.uvoz(JSON.stringify({
    verzija: 1,
    igraci: [{ id: 'x', ime: 'Šoškić' }],
    testovi: [],
    podesavanja: { opomena: false }
  }), false);
  w.DB.load();
  assert.strictEqual(w.DB.igraci()[0].ime, 'Šoškić', 'uvoz je i upisan, ne samo prikazan');
  assert.strictEqual(w.DB.podesavanja().opomena, false);
});

/* ---------- CSV ---------- */

test('CSV ima zaglavlje, tacka-zarez i sve rezultate', () => {
  const w = napraviProzor();
  upisiTest(w, '2025-03-01T10:00:00.000Z', [
    { igracId: 'a', ime: 'Šoškić Đorđe', broj: '7', grupa: 'Kadeti', nivo: 10, deonica: 5, ukupnoDeonica: 86, metara: 1720, vremeS: 600.4, vo2max: 47.5, status: 'ispao', beleska: '' }
  ]);
  const redovi = w.DB.csv().split('\r\n');
  assert.strictEqual(redovi[0], 'datum;test;igrac;broj;grupa;nivo;deonica;ukupno_deonica;metara;vreme_s;vo2max;status;beleska');
  assert.strictEqual(redovi.length, 2);
  const polja = redovi[1].split(';');
  assert.strictEqual(polja[2], 'Šoškić Đorđe');
  assert.strictEqual(polja[9], '600', 'vreme se zaokruzuje na sekundu');
});

test('CSV stiti polja sa tacka-zarezom, navodnicima i novim redom', () => {
  const w = napraviProzor();
  upisiTest(w, '2025-03-01T10:00:00.000Z', [
    { igracId: 'a', ime: 'Petrović; Pera', beleska: 'rekao "ne mogu"\nposle 5. nivoa', status: 'odustao' }
  ]);
  const red = w.DB.csv().split('\r\n')[1];
  assert.ok(red.indexOf('"Petrović; Pera"') >= 0, 'tacka-zarez u imenu ne sme da razbije kolonu');
  assert.ok(red.indexOf('"rekao ""ne mogu""') >= 0, 'navodnici se udvajaju');
});

test('CSV skuplja sve testove, od starijeg ka novijem', () => {
  const w = napraviProzor();
  upisiTest(w, '2025-09-01T10:00:00.000Z', [{ igracId: 'a', ime: 'A' }], 'jesen');
  upisiTest(w, '2025-03-01T10:00:00.000Z', [{ igracId: 'a', ime: 'A' }], 'prolece');
  const redovi = w.DB.csv().split('\r\n');
  assert.strictEqual(redovi.length, 3);
  assert.ok(redovi[1].indexOf('prolece') >= 0, 'prvo starije testiranje');
  assert.ok(redovi[2].indexOf('jesen') >= 0);
});

/* ---------- pokvaren ili pun localStorage ---------- */

test('pokvaren zapis u pregledacu ne rusi aplikaciju', () => {
  const w = napraviProzor();
  w.memorija['beeptest.v1'] = '{ ovo nije ispravan json';
  const s = w.DB.load();
  assert.deepStrictEqual(s.igraci, []);
  assert.deepStrictEqual(s.testovi, []);
  assert.strictEqual(s.podesavanja.opomena, true, 'vraca se na podrazumevana podesavanja');
});

test('kad je memorija pregledaca puna, trener to sazna', () => {
  const w = napraviProzor({ puna: true });
  const uspeh = w.DB.save();
  assert.strictEqual(uspeh, false);
  assert.strictEqual(w.poruke.length, 1);
  assert.ok(/nisu sačuvani/i.test(w.poruke[0]), 'poruka kaze da podaci nisu sacuvani: ' + w.poruke[0]);
});

test('podesavanja se pamte, a nepoznata se dopunjuju podrazumevanim', () => {
  const w = napraviProzor();
  w.DB.postavi('odbrojavanje', 10);
  w.DB.load();
  assert.strictEqual(w.DB.podesavanja().odbrojavanje, 10);
  assert.strictEqual(w.DB.podesavanja().zvuk, true, 'sto nije upisano ostaje podrazumevano');
});
