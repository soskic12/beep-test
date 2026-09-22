/* Provera motora testiranja: node --test test/motor.test.js
   Motor ne zna nista o ekranu, pa se cela logika moze proveriti ovde - sa
   laznim satom umesto Web Audio sata, da test ne ceka 22 minuta trcanja. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ---------- lazni pregledac ---------- */

const sat = { t: 0 };
const zapis = { bipovi: [], izgovoreno: [], otkazano: 0, tokovi: [] };

function napraviProzor() {
  sat.t = 0;
  zapis.bipovi = [];
  zapis.izgovoreno = [];
  zapis.otkazano = 0;
  zapis.tokovi = [];
  const w = {
    Zvuk: {
      otkljucaj() {},
      now() { return sat.t; },
      bip(kada, vrsta) { zapis.bipovi.push({ kada, vrsta }); },
      otkazi() { zapis.otkazano++; },
      izgovori(tekst) { zapis.izgovoreno.push(tekst); }
    },
    DB: {
      uid: () => 'run-proba',
      sacuvajTok(tok) { zapis.tokovi.push(tok); },
      ucitajTok: () => zapis.tokovi[zapis.tokovi.length - 1] || null
    },
    /* tajmer se ne pusta - tik() se zove rucno, kad sat pomerimo */
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 2,
    clearTimeout: () => {}
  };
  global.window = w;
  delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'protocol.js'))];
  delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'run.js'))];
  require(path.join(__dirname, '..', 'js', 'protocol.js'));
  require(path.join(__dirname, '..', 'js', 'run.js'));
  return w;
}

/* Pravi zapocet test sa zadatim igracima, vec u trku, sat na nuli. */
function pokreni(imena, cfg) {
  const w = napraviProzor();
  const r = new w.Run(Object.assign({
    odbrojavanje: 0,
    najava: false,
    ucesnici: imena.map((ime, i) => ({ igracId: 'i' + i, ime: ime, godine: 16 }))
  }, cfg || {}));
  r.start();
  return { w: w, r: r, P: w.Protocol };
}

/* Pomera lazni sat na zadatu sekundu i pusta jedan tik motora. */
function naSekundu(r, s) {
  sat.t = s;
  r.tik();
}

/* ---------- sat i deonice ---------- */

test('odbrojavanje drzi test pre starta, prvi tik posle nule pusta trku', () => {
  const w = napraviProzor();
  const r = new w.Run({ odbrojavanje: 5, najava: false, ucesnici: [{ igracId: 'a', ime: 'A' }] });
  r.start();
  assert.strictEqual(r.status, 'odbrojavanje');
  assert.strictEqual(r.proteklo(), -5);
  assert.strictEqual(r.zavrsenoDeonica(), 0);

  naSekundu(r, 3);          // jos dve sekunde do starta
  assert.strictEqual(r.status, 'odbrojavanje');
  naSekundu(r, 5);          // start
  assert.strictEqual(r.status, 'trci');
  assert.strictEqual(r.zavrsenoDeonica(), 0);
});

test('broj zavrsenih deonica prati sat', () => {
  const { r, P } = pokreni(['A']);
  const prva = P.SHUTTLES[0].endAt;

  naSekundu(r, prva - 0.01);
  assert.strictEqual(r.zavrsenoDeonica(), 0, 'pre prvog signala nema zavrsene deonice');
  naSekundu(r, prva + 0.01);
  assert.strictEqual(r.zavrsenoDeonica(), 1);

  const deseta = P.SHUTTLES[9].endAt;
  naSekundu(r, deseta + 0.01);
  assert.strictEqual(r.zavrsenoDeonica(), 10);
  assert.strictEqual(r.trenutna().index, 11, 'u toku je jedanaesta deonica');
});

/* ---------- opomena i ispadanje ---------- */

test('prvi dodir je opomena, drugi ispadanje sa rezultatom iz trenutka opomene', () => {
  const { r, P } = pokreni(['Sasa']);
  const u = r.ucesnici[0];

  naSekundu(r, P.SHUTTLES[19].endAt + 0.1);   // 20 zavrsenih deonica
  r.oznaci('i0');
  assert.strictEqual(u.status, 'opomena');
  assert.strictEqual(u.opomenaNa, 20);

  naSekundu(r, P.SHUTTLES[22].endAt + 0.1);   // tri deonice kasnije
  r.oznaci('i0');
  assert.strictEqual(u.status, 'ispao');
  assert.strictEqual(u.zavrseno, 20, 'upisuje se trenutak opomene, ne trenutak ispadanja');
});

test('kad su opomene iskljucene, prvi dodir odmah znaci ispadanje', () => {
  const { r, P } = pokreni(['Sasa'], { opomena: false });
  naSekundu(r, P.SHUTTLES[19].endAt + 0.1);
  r.oznaci('i0');
  assert.strictEqual(r.ucesnici[0].status, 'ispao');
  assert.strictEqual(r.ucesnici[0].zavrseno, 20);
});

test('stigao na liniju brise opomenu, igrac ostaje u trci', () => {
  const { r, P } = pokreni(['Sasa']);
  naSekundu(r, P.SHUTTLES[9].endAt + 0.1);
  r.oznaci('i0');
  assert.strictEqual(r.ucesnici[0].status, 'opomena');
  r.skiniOpomenu('i0');
  assert.strictEqual(r.ucesnici[0].status, 'aktivan');
  assert.strictEqual(r.ucesnici[0].opomenaNa, null);
  assert.strictEqual(r.aktivni().length, 1);
});

test('vracanje u trku brise i upisan rezultat pogresno ispalog igraca', () => {
  const { r, P } = pokreni(['Sasa'], { opomena: false });
  naSekundu(r, P.SHUTTLES[9].endAt + 0.1);
  r.oznaci('i0');
  assert.strictEqual(r.ucesnici[0].zavrseno, 10);
  r.vrati('i0');
  assert.strictEqual(r.ucesnici[0].status, 'aktivan');
  assert.strictEqual(r.ucesnici[0].zavrseno, null);
  assert.strictEqual(r.ucesnici[0].vremeS, null);
});

test('odustanak i povreda nisu ispadanje, ali upisuju dostignutu deonicu', () => {
  const { r, P } = pokreni(['Sasa', 'Mika']);
  naSekundu(r, P.SHUTTLES[14].endAt + 0.1);
  r.prekini('i0', 'povreda');
  assert.strictEqual(r.ucesnici[0].status, 'povreda');
  assert.strictEqual(r.ucesnici[0].zavrseno, 15);
  assert.strictEqual(r.aktivni().length, 1, 'povredjen igrac izlazi iz trke');
});

test('kad ispadne i poslednji igrac, test se sam zavrsava', () => {
  const { r, P } = pokreni(['A', 'B'], { opomena: false });
  let krajeva = 0;
  r.onKraj = () => { krajeva++; };
  naSekundu(r, P.SHUTTLES[9].endAt + 0.1);
  r.oznaci('i0');
  assert.strictEqual(r.status, 'trci');
  r.oznaci('i1');
  assert.strictEqual(r.status, 'gotovo');
  assert.strictEqual(r.razlog, 'svi-ispali');
  assert.strictEqual(krajeva, 1);
});

test('rucni kraj upisuje svim preostalima dostignutu deonicu', () => {
  const { r, P } = pokreni(['A', 'B']);
  naSekundu(r, P.SHUTTLES[29].endAt + 0.1);
  r.oznaci('i1');                       // B dobija opomenu pa ga zatekne kraj
  r.zavrsi('rucno');
  assert.strictEqual(r.status, 'gotovo');
  r.ucesnici.forEach((u) => {
    assert.strictEqual(u.status, 'zavrsio');
    assert.strictEqual(u.zavrseno, 30);
  });
});

/* ---------- pauza i nastavak ---------- */

test('pauza zaustavlja sat i otkazuje zakazane signale', () => {
  const { r, P } = pokreni(['A']);
  const kod = P.SHUTTLES[9].endAt + 0.1;
  naSekundu(r, kod);
  r.pauza();
  assert.strictEqual(r.status, 'pauza');
  assert.ok(zapis.otkazano > 0, 'zakazani bipovi se otkazuju');

  sat.t = kod + 60;                     // sat sveta ide dalje
  assert.ok(Math.abs(r.proteklo() - kod) < 1e-9, 'sat testa stoji u pauzi');
  assert.strictEqual(r.zavrsenoDeonica(), 10);
  r.tik();
  assert.strictEqual(r.zavrsenoDeonica(), 10, 'tik u pauzi ne pomera deonice');
});

test('nastavak vraca trku na isto mesto, uz odbrojavanje od tri', () => {
  const { r, P } = pokreni(['A']);
  const kod = P.SHUTTLES[9].endAt + 0.1;
  naSekundu(r, kod);
  r.pauza();

  sat.t = kod + 120;                    // trener je nastavio dva minuta kasnije
  r.nastavi();
  assert.strictEqual(r.status, 'trci');
  sat.t += 3;                           // 3-2-1 prodje
  assert.ok(Math.abs(r.proteklo() - kod) < 1e-9, 'trka se nastavlja tacno odakle je stala');
  assert.strictEqual(r.zavrsenoDeonica(), 10);
});

/* ---------- oporavak posle osvezavanja ---------- */

test('test se pamti u toku i vraca se u pauzi posle osvezavanja', () => {
  const { w, r, P } = pokreni(['Sasa', 'Mika'], { naziv: 'Sreda' });
  naSekundu(r, P.SHUTTLES[19].endAt + 0.1);
  r.oznaci('i0');                       // opomena ostaje zapisana
  const tok = w.DB.ucitajTok();
  assert.ok(tok, 'tok je sacuvan');
  assert.strictEqual(tok.status, 'pauza', 'zapisuje se kao pauza, da se ne nastavi sam');

  const vracen = w.Run.izToka(tok, {});
  assert.strictEqual(vracen.status, 'pauza');
  assert.strictEqual(vracen.naziv, 'Sreda');
  assert.strictEqual(vracen.zavrsenoDeonica(), 20, 'vreme testa je zapamceno');
  assert.strictEqual(vracen.ucesnici.length, 2);
  assert.strictEqual(vracen.ucesnici[0].status, 'opomena');
  assert.strictEqual(vracen.ucesnici[0].opomenaNa, 20);
});

/* ---------- rezultati ---------- */

test('rezultati imaju sve sto ide u istoriju', () => {
  const { r, P } = pokreni(['Sasa', 'Mika'], { opomena: false });
  naSekundu(r, P.SHUTTLES[54].endAt + 0.1);   // 55 zavrsenih deonica
  r.oznaci('i0');
  r.zavrsi('rucno');

  const rez = r.rezultati();
  const a = rez[0];
  const b = rez[1];
  assert.strictEqual(a.ukupnoDeonica, 55);
  assert.strictEqual(a.metara, 55 * P.DISTANCE_M);
  assert.strictEqual(a.status, 'ispao');
  assert.deepStrictEqual({ level: a.nivo, shuttle: a.deonica }, P.toLevelShuttle(55));
  assert.ok(Math.abs(a.vremeS - P.timeAt(a.nivo, a.deonica)) < 1e-9);
  assert.ok(a.vo2max > 30 && a.vo2max < 70, 'VO2max je u ljudskom opsegu: ' + a.vo2max);
  assert.ok(a.vo2maxLeger > 0, 'Legerova procena trazi godine, koje ovaj igrac ima');
  assert.strictEqual(b.status, 'zavrsio', 'ko je dotrcao do kraja nije ispao');
});

test('igrac bez datuma rodjenja nema Legerovu procenu, ali ima Ramsbottomovu', () => {
  const w = napraviProzor();
  const r = new w.Run({ odbrojavanje: 0, najava: false, ucesnici: [{ igracId: 'a', ime: 'A', godine: null }] });
  r.start();
  naSekundu(r, w.Protocol.SHUTTLES[29].endAt + 0.1);
  r.zavrsi('rucno');
  const rez = r.rezultati()[0];
  assert.strictEqual(rez.vo2maxLeger, null);
  assert.ok(rez.vo2max > 0);
});

/* ---------- signali ---------- */

test('signali se zakazuju unapred, sa posebnim zvukom na promeni nivoa', () => {
  const { r, P } = pokreni(['A']);
  const prviNivo = P.LEVELS[0].shuttles;          // posle 7 deonica pocinje nivo 2
  naSekundu(r, P.SHUTTLES[prviNivo - 1].endAt);
  const vrste = zapis.bipovi.map((b) => b.vrsta);
  assert.ok(vrste.indexOf('deonica') >= 0, 'obicni signali se zakazuju');
  assert.ok(vrste.indexOf('nivo') >= 0, 'promena nivoa ima svoj signal');
  const nivoBip = zapis.bipovi.filter((b) => b.vrsta === 'nivo')[0];
  assert.ok(Math.abs(nivoBip.kada - P.SHUTTLES[prviNivo - 1].endAt) < 1e-9,
    'signal za nivo pada tacno na kraj poslednje deonice prethodnog nivoa');
});

test('nastavak ne vraca sat unazad niti pusta signal usred odbrojavanja', () => {
  const { r, P } = pokreni(['A']);
  const pauzaNa = P.SHUTTLES[29].endAt + 2;      // usred 31. deonice
  naSekundu(r, pauzaNa);
  assert.strictEqual(r.zavrsenoDeonica(), 30);
  r.pauza();

  const kada = pauzaNa + 45;                     // trener nastavlja posle 45 s
  sat.t = kada;
  zapis.bipovi = [];
  r.nastavi();
  assert.ok(Math.abs(r.proteklo() - pauzaNa) < 1e-9, 'sat ne sme da skoci unazad');
  assert.strictEqual(r.zavrsenoDeonica(), 30, 'broj deonica ne sme da se smanji');

  for (let k = 0; k <= 30; k++) { sat.t = kada + k * 0.1; r.tik(); }
  const uOdbrojavanju = zapis.bipovi.filter((b) => b.kada < kada + 3 && b.vrsta !== 'odbrojavanje');
  assert.deepStrictEqual(uOdbrojavanju, [], 'tokom 3-2-1 sme da se cuje samo odbrojavanje');
  assert.ok(zapis.bipovi.some((b) => b.vrsta === 'start' && Math.abs(b.kada - (kada + 3)) < 1e-9),
    'start pada tacno na kraj odbrojavanja');
});

test('posle nastavka prekinuta deonica ima onoliko vremena koliko joj je ostalo', () => {
  const { r, P } = pokreni(['A']);
  const pauzaNa = P.SHUTTLES[29].endAt + 2;
  const ostalo = P.SHUTTLES[30].endAt - pauzaNa;
  naSekundu(r, pauzaNa);
  r.pauza();

  const kada = pauzaNa + 45;
  sat.t = kada;
  zapis.bipovi = [];
  r.nastavi();
  for (let k = 0; k <= 120; k++) { sat.t = kada + k * 0.1; r.tik(); }

  const prvi = zapis.bipovi.filter((b) => b.vrsta === 'deonica' || b.vrsta === 'nivo')[0];
  assert.ok(prvi, 'posle nastavka se opet zakazuju signali');
  assert.ok(Math.abs(prvi.kada - (kada + 3 + ostalo)) < 1e-9,
    'prvi signal posle nastavka: ocekivano +' + (3 + ostalo).toFixed(2) + ' s, dobijeno +' + (prvi.kada - kada).toFixed(2));
});

test('pred nastavak se zna koliko jos ima do polaska', () => {
  const { r, P } = pokreni(['A']);
  const kod = P.SHUTTLES[9].endAt;
  naSekundu(r, kod);
  assert.strictEqual(r.doNastavka(), null, 'dok trka traje nema odbrojavanja za nastavak');
  r.pauza();
  assert.strictEqual(r.doNastavka(), null, 'ni u pauzi, dok trener ne pritisne Nastavi');

  sat.t = kod + 30;
  r.nastavi();
  assert.ok(Math.abs(r.doNastavka() - 3) < 1e-9, 'odmah po pritisku: tri sekunde');
  sat.t += 1.5;
  assert.ok(Math.abs(r.doNastavka() - 1.5) < 1e-9, 'na pola odbrojavanja: sekunda i po');
  sat.t += 1.6;
  assert.strictEqual(r.doNastavka(), null, 'kad odbrojavanje prodje, brojaca nema');
});
