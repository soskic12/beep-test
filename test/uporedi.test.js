/* Provera poredjenja: node --test test/uporedi.test.js
   Ovde se odgovara na trenerovo pitanje "da li je ovo dobro", pa greska ovde
   ne daje pogresan broj nego pogresan zakljucak o igracu. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function napraviProzor() {
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
  ['protocol.js', 'testovi.js', 'data.js', 'uporedi.js'].forEach((d) => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', d))];
    require(path.join(__dirname, '..', 'js', d));
  });
  w.DB.load();
  return w;
}

/* Cetiri kadeta i dva juniora, beep test od pre mesec dana. */
function ekipa(w, vrsta, vrednosti, datum) {
  const igraci = vrednosti.map((x, i) =>
    w.DB.dodajIgraca({ ime: 'Igrač ' + (i + 1), broj: String(i + 1), grupa: x.grupa }));
  w.DB.sacuvajTest({
    vrsta: vrsta,
    naziv: 'Testiranje',
    datum: datum || new Date(Date.now() - 30 * 86400000).toISOString(),
    rezultati: igraci.map((p, i) => Object.assign(
      { igracId: p.id, ime: p.ime, grupa: vrednosti[i].grupa, status: 'zavrsio' },
      vrednosti[i].r
    ))
  });
  return igraci;
}

/* ---------- mesto u grupi ---------- */

test('igrač zna svoje mesto u svojoj grupi, ne među svima', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [
    { grupa: 'Kadeti', r: { ukupnoDeonica: 60 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 50 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 40 } },
    { grupa: 'Juniori', r: { ukupnoDeonica: 90 } },
    { grupa: 'Juniori', r: { ukupnoDeonica: 80 } }
  ]);

  const p = w.Uporedi.zaIgraca(igraci[1].id, 'beep');
  assert.strictEqual(p.rang, 2, 'drugi je od kadeta');
  assert.strictEqual(p.od, 3, 'poredi se samo sa kadetima');
  assert.strictEqual(p.grupa, 'Kadeti');
  assert.strictEqual(p.prosek, 50, '(60 + 50 + 40) / 3');
  assert.strictEqual(p.odstupanje, 0);
  assert.strictEqual(p.najbolji.vrednost, 60);
});

test('kod sprinta je prvi onaj sa najkraćim vremenom', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'sprint-20', [
    { grupa: 'Kadeti', r: { pokusaji: [3.40], najbolji: 3.40 } },
    { grupa: 'Kadeti', r: { pokusaji: [3.05], najbolji: 3.05 } },
    { grupa: 'Kadeti', r: { pokusaji: [3.20], najbolji: 3.20 } }
  ]);

  const brzi = w.Uporedi.zaIgraca(igraci[1].id, 'sprint-20');
  assert.strictEqual(brzi.rang, 1, 'najkraće vreme je prvo mesto');
  assert.ok(brzi.boljiOdProseka, 'brži je od proseka iako je broj manji');

  const spori = w.Uporedi.zaIgraca(igraci[0].id, 'sprint-20');
  assert.strictEqual(spori.rang, 3);
  assert.ok(!spori.boljiOdProseka);
});

test('u poređenje ulazi najbolji rezultat igrača, ne poslednji', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [
    { grupa: 'Kadeti', r: { ukupnoDeonica: 40 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 50 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 60 } }
  ]);
  /* isti igrač kasnije trči slabije */
  w.DB.sacuvajTest({
    vrsta: 'beep', naziv: 'Kasnije', datum: new Date(Date.now() - 86400000).toISOString(),
    rezultati: [{ igracId: igraci[2].id, ime: igraci[2].ime, grupa: 'Kadeti', ukupnoDeonica: 20, status: 'ispao' }]
  });
  const p = w.Uporedi.zaIgraca(igraci[2].id, 'beep');
  assert.strictEqual(p.vrednost, 60, 'ostaje najbolji rezultat iz razdoblja');
  assert.strictEqual(p.rang, 1);
});

test('rezultati stariji od godinu dana ne ulaze u poređenje', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [
    { grupa: 'Kadeti', r: { ukupnoDeonica: 40 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 50 } }
  ], new Date(Date.now() - 400 * 86400000).toISOString());
  assert.strictEqual(w.Uporedi.zaIgraca(igraci[0].id, 'beep'), null,
    'staro merenje ne govori kakav je igrač danas');
  assert.strictEqual(w.Uporedi.skup('beep').length, 0);
});

test('igrač bez rezultata u toj vrsti testa nema poređenje', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [{ grupa: 'Kadeti', r: { ukupnoDeonica: 40 } }]);
  assert.strictEqual(w.Uporedi.zaIgraca(igraci[0].id, 'sprint-20'), null);
});

/* ---------- recenica za trenera ---------- */

test('opis ne izmišlja preciznost kad je grupa premala', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [
    { grupa: 'Kadeti', r: { ukupnoDeonica: 40 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 50 } }
  ]);
  const p = w.Uporedi.zaIgraca(igraci[0].id, 'beep');
  assert.strictEqual(w.Uporedi.opis(p), 'premalo rezultata za poređenje',
    'sa dva igrača se ne govori o proseku grupe');
});

test('opis kaže mesto i odnos prema proseku', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'sprint-20', [
    { grupa: 'Kadeti', r: { najbolji: 3.00 } },
    { grupa: 'Kadeti', r: { najbolji: 3.30 } },
    { grupa: 'Kadeti', r: { najbolji: 3.60 } }
  ]);
  const prvi = w.Uporedi.opis(w.Uporedi.zaIgraca(igraci[0].id, 'sprint-20'));
  assert.ok(/^1\. od 3 · Kadeti/.test(prvi), prvi);
  assert.ok(/bolje od proseka za 0,30 s/.test(prvi), prvi);

  const srednji = w.Uporedi.opis(w.Uporedi.zaIgraca(igraci[1].id, 'sprint-20'));
  assert.ok(/na proseku grupe/.test(srednji), srednji);
});

/* ---------- napredak ---------- */

test('napredak se meri prema sopstvenom prethodnom rezultatu', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [{ grupa: 'Kadeti', r: { ukupnoDeonica: 40 } }],
    '2026-03-01T10:00:00.000Z');
  w.DB.sacuvajTest({
    vrsta: 'beep', naziv: 'Jesen', datum: '2026-09-01T10:00:00.000Z',
    rezultati: [{ igracId: igraci[0].id, ime: igraci[0].ime, grupa: 'Kadeti', ukupnoDeonica: 52 }]
  });
  const n = w.Uporedi.napredak(igraci[0].id, 'beep');
  assert.strictEqual(n.pre, 40);
  assert.strictEqual(n.sad, 52);
  assert.strictEqual(n.razlika, 12);
  assert.strictEqual(n.bolje, true);
});

test('kod sprinta je napredak kad se vreme smanji', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'sprint-20', [{ grupa: 'Kadeti', r: { najbolji: 3.40 } }],
    '2026-03-01T10:00:00.000Z');
  w.DB.sacuvajTest({
    vrsta: 'sprint-20', naziv: 'Jesen', datum: '2026-09-01T10:00:00.000Z',
    rezultati: [{ igracId: igraci[0].id, ime: igraci[0].ime, grupa: 'Kadeti', najbolji: 3.19 }]
  });
  const n = w.Uporedi.napredak(igraci[0].id, 'sprint-20');
  assert.ok(Math.abs(n.razlika + 0.21) < 1e-9, 'razlika je -0,21 s');
  assert.strictEqual(n.bolje, true, 'kraće vreme je napredak, iako je broj manji');
});

test('bez prethodnog merenja nema napretka', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [{ grupa: 'Kadeti', r: { ukupnoDeonica: 40 } }]);
  assert.strictEqual(w.Uporedi.napredak(igraci[0].id, 'beep'), null);
});

/* ---------- pregled celog testiranja ---------- */

test('pregled testiranja daje poredak, prosek i ko je napredovao', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [
    { grupa: 'Kadeti', r: { ukupnoDeonica: 40 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 60 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 50 } }
  ], '2026-03-01T10:00:00.000Z');

  const novi = w.DB.sacuvajTest({
    vrsta: 'beep', naziv: 'Jesenje merenje', datum: '2026-09-01T10:00:00.000Z',
    rezultati: [
      { igracId: igraci[0].id, ime: igraci[0].ime, grupa: 'Kadeti', ukupnoDeonica: 48 },   // +8
      { igracId: igraci[1].id, ime: igraci[1].ime, grupa: 'Kadeti', ukupnoDeonica: 56 },   // -4
      { igracId: igraci[2].id, ime: igraci[2].ime, grupa: 'Kadeti', ukupnoDeonica: 50 }    // isto
    ]
  });

  const pregled = w.Uporedi.zaTestiranje(novi.id);
  assert.strictEqual(pregled.ucesnika, 3);
  assert.deepStrictEqual(pregled.redovi.map((x) => x.vrednost), [56, 50, 48], 'poredak od boljeg');
  assert.strictEqual(pregled.redovi[0].mesto, 1);
  assert.ok(Math.abs(pregled.prosek - 51.333333) < 0.001);
  assert.strictEqual(pregled.napredovalo, 1);
  assert.strictEqual(pregled.nazadovalo, 1);

  const prvi = pregled.redovi[0];
  assert.strictEqual(prvi.pomak.pre, 60);
  assert.strictEqual(prvi.pomak.razlika, -4);
  assert.strictEqual(prvi.pomak.bolje, false);
});

test('pregled preskače igrače bez rezultata', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [{ grupa: 'Kadeti', r: { ukupnoDeonica: 40 } }]);
  const t = w.DB.sacuvajTest({
    vrsta: 'beep', naziv: 'Sa praznim', datum: '2026-09-02T10:00:00.000Z',
    rezultati: [
      { igracId: igraci[0].id, ime: igraci[0].ime, ukupnoDeonica: 44 },
      { igracId: 'nepostojeci', ime: 'Bez rezultata' }
    ]
  });
  assert.strictEqual(w.Uporedi.zaTestiranje(t.id).ucesnika, 1);
});

test('odnos prema proseku se može ispisati i bez ponavljanja mesta', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'sprint-20', [
    { grupa: 'Kadeti', r: { najbolji: 3.00 } },
    { grupa: 'Kadeti', r: { najbolji: 3.30 } },
    { grupa: 'Kadeti', r: { najbolji: 3.60 } }
  ]);
  const p = w.Uporedi.zaIgraca(igraci[0].id, 'sprint-20');
  assert.strictEqual(w.Uporedi.opisProseka(p), 'bolje od proseka za 0,30 s');
  assert.ok(w.Uporedi.opisProseka(p).indexOf('od 3') < 0, 'mesto se ne ponavlja');
  assert.strictEqual(w.Uporedi.opisProseka(w.Uporedi.zaIgraca(igraci[1].id, 'sprint-20')), 'na proseku grupe');
});

test('premala grupa nema ni odnos prema proseku', () => {
  const w = napraviProzor();
  const igraci = ekipa(w, 'beep', [
    { grupa: 'Kadeti', r: { ukupnoDeonica: 40 } },
    { grupa: 'Kadeti', r: { ukupnoDeonica: 50 } }
  ]);
  assert.strictEqual(w.Uporedi.opisProseka(w.Uporedi.zaIgraca(igraci[0].id, 'beep')), '');
});
