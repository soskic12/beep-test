/* Provera registra testova: node --test test/registar.test.js
   Registar je jedino mesto koje zna sta je koji test - ekrani ga samo pitaju,
   pa greska ovde tiho iskrivi svaki prikaz i svaki izvoz. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

global.window = {};
['protocol.js', 'testovi.js'].forEach((d) => {
  require(path.join(__dirname, '..', 'js', d));
});
const T = global.window.Testovi;

test('svaki test ume da kaze sve sto ekranima treba', () => {
  const vrste = T.sve();
  assert.ok(vrste.length >= 9, 'ima ih ' + vrste.length);
  vrste.forEach((v) => {
    assert.ok(v.id && v.naziv && v.kratko && v.grupa, 'osnovni podaci: ' + v.id);
    assert.ok(['protokol', 'pokusaji', 'polja'].indexOf(v.unos) >= 0, 'nacin unosa: ' + v.id);
    assert.ok(['vise', 'manje'].indexOf(v.boljeJe) >= 0, 'smer: ' + v.id);
    assert.strictEqual(typeof v.glavna, 'function', 'glavna vrednost: ' + v.id);
    assert.strictEqual(typeof v.prikaz, 'function', 'prikaz: ' + v.id);
    assert.ok(Array.isArray(v.kolone) && v.kolone.length, 'CSV kolone: ' + v.id);
    assert.strictEqual(typeof v.red, 'function', 'CSV red: ' + v.id);
    assert.strictEqual(v.red({}).length, v.kolone.length, 'kolona i vrednosti mora biti jednako: ' + v.id);
  });
});

test('nepoznata vrsta pada na beep test, da se evidencija ne izgubi', () => {
  assert.strictEqual(T.vrsta('nepostojeci').id, 'beep');
  assert.strictEqual(T.vrsta(undefined).id, 'beep');
  assert.strictEqual(T.vrsta('sprint-20').id, 'sprint-20');
});

test('kod skoka je bolji veci rezultat, kod sprinta manji', () => {
  const skok = T.vrsta('skok-mesto');
  const sprint = T.vrsta('sprint-20');
  assert.strictEqual(T.najboljiPokusaj([58, 61, 60], skok.boljeJe), 61);
  assert.strictEqual(T.najboljiPokusaj([3.21, 3.09, 3.15], sprint.boljeJe), 3.09);
  assert.ok(T.bolji(skok, 61, 58), 'veci skok je bolji');
  assert.ok(!T.bolji(skok, 58, 61));
  assert.ok(T.bolji(sprint, 3.09, 3.21), 'krace vreme je bolje');
  assert.ok(!T.bolji(sprint, 3.21, 3.09));
  assert.ok(T.bolji(sprint, 3.21, null), 'bilo koji rezultat je bolji od nijednog');
  assert.ok(!T.bolji(sprint, null, 3.21));
});

test('prazni i nevalidni pokusaji se preskacu', () => {
  assert.strictEqual(T.najboljiPokusaj([null, '', 58, undefined], 'vise'), 58);
  assert.strictEqual(T.najboljiPokusaj([], 'vise'), null);
  assert.strictEqual(T.najboljiPokusaj(null, 'vise'), null);
  assert.strictEqual(T.najboljiPokusaj(['ne valja'], 'vise'), null);
});

test('rezultat se prikazuje u nasem zapisu, sa jedinicom', () => {
  const sprint = T.vrsta('sprint-20');
  assert.strictEqual(sprint.prikaz({ pokusaji: [3.214, 3.09] }), '3,09 s', 'zarez i dve decimale');
  const skok = T.vrsta('skok-mesto');
  assert.strictEqual(skok.prikaz({ pokusaji: [58, 61] }), '61 cm');
  assert.strictEqual(skok.prikaz({ pokusaji: [] }), '—', 'bez rezultata stoji crta');
});

test('najbolji pokusaj se upisuje u rezultat', () => {
  const sprint = T.vrsta('sprint-20');
  const r = sprint.izracunaj({ pokusaji: [3.21, 3.09, 3.15] });
  assert.strictEqual(r.najbolji, 3.09);
  assert.strictEqual(sprint.glavna(r), 3.09);
});

test('beep test se prikazuje kao nivo.deonica', () => {
  const beep = T.vrsta('beep');
  const P = global.window.Protocol;
  const ls = P.toLevelShuttle(86);
  assert.strictEqual(beep.prikaz({ nivo: ls.level, deonica: ls.shuttle }), P.fmtLevel(ls.level, ls.shuttle));
  assert.strictEqual(beep.glavna({ ukupnoDeonica: 86 }), 86);
  assert.strictEqual(beep.prikaz({}), '—');
});

test('merenje tela ima vise vrednosti, a glavna je visina', () => {
  const mere = T.vrsta('mere');
  assert.strictEqual(mere.unos, 'polja');
  assert.deepStrictEqual(mere.polja.map((p) => p.kljuc), ['visina', 'tezina', 'raspon', 'dohvat']);
  const r = { vrednosti: { visina: 192.5, tezina: 84, raspon: 201, dohvat: 252 } };
  assert.strictEqual(mere.glavna(r), 192.5);
  assert.strictEqual(mere.prikaz(r), '192,5 cm');
  assert.deepStrictEqual(mere.red(r), [192.5, 84, 201, 252]);
  assert.strictEqual(mere.prikaz({ vrednosti: {} }), '—');
});

test('testovi su razvrstani po grupama, za izbor pri novom testiranju', () => {
  const grupe = T.poGrupama();
  const imena = grupe.map((g) => g.grupa);
  ['Izdržljivost', 'Skok', 'Brzina', 'Agilnost', 'Merenje'].forEach((g) => {
    assert.ok(imena.indexOf(g) >= 0, 'nedostaje grupa ' + g);
  });
  const ukupno = grupe.reduce((z, g) => z + g.vrste.length, 0);
  assert.strictEqual(ukupno, T.sve().length, 'svaki test pripada tacno jednoj grupi');
});

test('vreme sprinta ne gubi decimale u CSV-u', () => {
  const sprint = T.vrsta('sprint-20');
  assert.deepStrictEqual(sprint.red({ pokusaji: [3.214, 3.09, ''], najbolji: 3.09 }),
    [3.09, 3.21, 3.09, '']);
});
