/* Cuvanje podataka - localStorage, bez servera.
   Sve sto aplikacija zna stoji pod jednim kljucem, pa je izvoz = jedan JSON. */
(function (global) {
  'use strict';

  var KEY = 'beeptest.v1';
  var RUN_KEY = 'beeptest.run.v1';

  var DEFAULT_SETTINGS = {
    opomena: true,        // prvi promasaj je opomena, drugi ispadanje
    zvuk: true,
    najava: true,         // govorna najava nivoa
    odbrojavanje: 5,      // sekundi pre starta
    ekranBudan: true
  };

  var state = null;

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function empty() {
    return { verzija: 1, igraci: [], testovi: [], podesavanja: clone(DEFAULT_SETTINGS) };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Testiranja upisana pre nego sto je bilo vise vrsta testa su beep test. */
  function nadopuni(t) {
    if (t && !t.vrsta) t.vrsta = 'beep';
    return t;
  }

  function load() {
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) { state = empty(); return state; }
    try {
      var s = JSON.parse(raw);
      state = {
        verzija: 1,
        igraci: Array.isArray(s.igraci) ? s.igraci : [],
        testovi: (Array.isArray(s.testovi) ? s.testovi : []).map(nadopuni),
        podesavanja: Object.assign(clone(DEFAULT_SETTINGS), s.podesavanja || {})
      };
    } catch (e) {
      state = empty();
    }
    return state;
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      global.alert('Podaci nisu sačuvani (memorija pregledača je puna ili je privatni režim).');
      return false;
    }
  }

  function get() { return state || load(); }

  /* ---------- igraci ---------- */

  /* Redosled po srpskoj latinici: C, C-kvacica, C-crtica, ..., D, DZ, Dj.
     Oznaka 'sr' je cirilicka, pa na latinicu daje pogresan red. */
  function igraci(saArhiviranim) {
    var list = get().igraci.filter(function (p) { return saArhiviranim || !p.arhiviran; });
    return list.sort(function (a, b) {
      var g = (a.grupa || '').localeCompare(b.grupa || '', 'sr-Latn');
      if (g !== 0) return g;
      return (a.ime || '').localeCompare(b.ime || '', 'sr-Latn');
    });
  }

  function igrac(id) {
    var list = get().igraci;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function dodajIgraca(p) {
    var novi = {
      id: uid(),
      ime: (p.ime || '').trim(),
      broj: (p.broj || '').trim(),
      grupa: (p.grupa || '').trim(),
      datumRodjenja: p.datumRodjenja || '',
      pol: p.pol || '',
      visina: p.visina || '',
      tezina: p.tezina || '',
      beleska: p.beleska || '',
      arhiviran: false,
      kreiran: new Date().toISOString()
    };
    get().igraci.push(novi);
    save();
    return novi;
  }

  function izmeniIgraca(id, patch) {
    var p = igrac(id);
    if (!p) return null;
    Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
    save();
    return p;
  }

  function arhivirajIgraca(id, arhiviran) {
    return izmeniIgraca(id, { arhiviran: !!arhiviran });
  }

  function obrisiIgraca(id) {
    var s = get();
    s.igraci = s.igraci.filter(function (p) { return p.id !== id; });
    save();
  }

  function godine(p, naDan) {
    if (!p || !p.datumRodjenja) return null;
    var d = new Date(p.datumRodjenja);
    if (isNaN(d.getTime())) return null;
    var ref = naDan ? new Date(naDan) : new Date();
    if (isNaN(ref.getTime())) ref = new Date();
    var g = ref.getFullYear() - d.getFullYear();
    var m = ref.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) g--;
    return g >= 0 && g < 120 ? g : null;
  }

  function grupe() {
    var set = {};
    get().igraci.forEach(function (p) { if (p.grupa) set[p.grupa] = true; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'sr-Latn'); });
  }

  /* ---------- testovi ---------- */

  function testovi() {
    return get().testovi.slice().sort(function (a, b) {
      return (b.datum || '').localeCompare(a.datum || '');
    });
  }

  function test(id) {
    var list = get().testovi;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function sacuvajTest(t) {
    var s = get();
    nadopuni(t);
    upisiUKarton(t);
    if (t.id) {
      for (var i = 0; i < s.testovi.length; i++) {
        if (s.testovi[i].id === t.id) { s.testovi[i] = t; save(); return t; }
      }
    }
    t.id = t.id || uid();
    s.testovi.push(t);
    save();
    return t;
  }

  /* Ako vrsta testa kaze da neko merenje stoji i u kartonu igraca (visina,
     tezina), prepisuje se tamo - ali samo ako je ovo najskorije merenje, da
     naknadni unos starog merenja ne pregazi novije. */
  function upisiUKarton(t) {
    var v = global.Testovi.vrsta(t.vrsta);
    if (!v.uIgraca) return;
    (t.rezultati || []).forEach(function (r) {
      var p = igrac(r.igracId);
      if (!p || !r.vrednosti) return;
      if (imaNovijeMerenje(r.igracId, t)) return;
      Object.keys(v.uIgraca).forEach(function (kljuc) {
        var vrednost = r.vrednosti[kljuc];
        if (vrednost == null || vrednost === '') return;
        p[v.uIgraca[kljuc]] = String(vrednost);
      });
    });
  }

  function imaNovijeMerenje(igracId, ovaj) {
    return get().testovi.some(function (t) {
      if (t.id === ovaj.id || t.vrsta !== ovaj.vrsta) return false;
      if ((t.datum || '') <= (ovaj.datum || '')) return false;
      return (t.rezultati || []).some(function (r) { return r.igracId === igracId; });
    });
  }

  /* Poslednje merenje tela jednog igraca - za karton i za unos. */
  function poslednjeMerenje(igracId) {
    var svi = rezultatiIgraca(igracId, 'mere');
    return svi.length ? svi[svi.length - 1] : null;
  }

  function obrisiTest(id) {
    var s = get();
    s.testovi = s.testovi.filter(function (t) { return t.id !== id; });
    save();
  }

  /* Svi rezultati jednog igraca, od najstarijeg ka najnovijem. */
  function rezultatiIgraca(igracId, vrsta) {
    var out = [];
    get().testovi.forEach(function (t) {
      if (vrsta && (t.vrsta || 'beep') !== vrsta) return;
      (t.rezultati || []).forEach(function (r) {
        if (r.igracId === igracId) {
          out.push(Object.assign({}, r, {
            testId: t.id, datum: t.datum, naziv: t.naziv, vrsta: t.vrsta || 'beep'
          }));
        }
      });
    });
    return out.sort(function (a, b) { return (a.datum || '').localeCompare(b.datum || ''); });
  }

  /* Vrste testova koje su vec radjene, od najskorije. */
  function vrsteUIstoriji() {
    var vidjene = {}, red = [];
    testovi().forEach(function (t) {
      var v = t.vrsta || 'beep';
      if (!vidjene[v]) { vidjene[v] = true; red.push(v); }
    });
    return red;
  }

  /* ---------- podesavanja ---------- */

  function podesavanja() { return get().podesavanja; }

  function postavi(k, v) {
    get().podesavanja[k] = v;
    save();
  }

  /* ---------- test u toku (oporavak posle osvezavanja) ---------- */

  function sacuvajTok(run) {
    try { global.localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) { /* nema veze */ }
  }

  function ucitajTok() {
    try {
      var raw = global.localStorage.getItem(RUN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function obrisiTok() {
    try { global.localStorage.removeItem(RUN_KEY); } catch (e) { /* nema veze */ }
  }

  /* ---------- izvoz / uvoz ---------- */

  function izvoz() {
    return JSON.stringify(get(), null, 2);
  }

  function uvoz(tekst, spoji) {
    var s = JSON.parse(tekst);
    if (!s || !Array.isArray(s.igraci) || !Array.isArray(s.testovi)) {
      throw new Error('Datoteka nije izvoz beep test aplikacije.');
    }
    if (!spoji) {
      state = {
        verzija: 1,
        igraci: s.igraci,
        testovi: s.testovi,
        podesavanja: Object.assign(clone(DEFAULT_SETTINGS), s.podesavanja || {})
      };
    } else {
      var cur = get();
      var imaIgraca = {}; cur.igraci.forEach(function (p) { imaIgraca[p.id] = true; });
      s.igraci.forEach(function (p) { if (!imaIgraca[p.id]) cur.igraci.push(p); });
      var imaTesta = {}; cur.testovi.forEach(function (t) { imaTesta[t.id] = true; });
      s.testovi.forEach(function (t) { if (!imaTesta[t.id]) cur.testovi.push(t); });
    }
    save();
    return state;
  }

  /* CSV jednog testiranja - kolone su one koje ta vrsta testa trazi. */
  function csvTesta(t) {
    var v = global.Testovi.vrsta(t.vrsta);
    var zaglavlje = ['datum', 'test', 'igrac', 'broj', 'grupa']
      .concat(v.kolone).concat(['status', 'beleska']);
    var redovi = [zaglavlje];
    (t.rezultati || []).forEach(function (r) {
      redovi.push([t.datum || '', t.naziv || '', r.ime || '', r.broj || '', r.grupa || '']
        .concat(v.red(r)).concat([r.status || '', r.beleska || '']));
    });
    return uCsv(redovi);
  }

  /* CSV svih rezultata - vrste se mesaju, pa stoji samo glavni rezultat. */
  function csv() {
    var redovi = [['datum', 'test', 'vrsta', 'igrac', 'broj', 'grupa', 'rezultat', 'jedinica', 'status', 'beleska']];
    testovi().slice().reverse().forEach(function (t) {
      var v = global.Testovi.vrsta(t.vrsta);
      (t.rezultati || []).forEach(function (r) {
        var g = v.glavna(r);
        redovi.push([
          t.datum || '', t.naziv || '', v.naziv, r.ime || '', r.broj || '', r.grupa || '',
          g == null ? '' : g, v.jedinica || '', r.status || '', r.beleska || ''
        ]);
      });
    });
    return uCsv(redovi);
  }

  function uCsv(redovi) {
    return redovi.map(function (r) {
      return r.map(function (c) {
        var v = c == null ? '' : String(c);
        return /[",;\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\r\n');
  }

  global.DB = {
    uid: uid,
    load: load,
    save: save,
    state: get,
    igraci: igraci,
    igrac: igrac,
    dodajIgraca: dodajIgraca,
    izmeniIgraca: izmeniIgraca,
    arhivirajIgraca: arhivirajIgraca,
    obrisiIgraca: obrisiIgraca,
    godine: godine,
    grupe: grupe,
    testovi: testovi,
    test: test,
    sacuvajTest: sacuvajTest,
    obrisiTest: obrisiTest,
    rezultatiIgraca: rezultatiIgraca,
    podesavanja: podesavanja,
    postavi: postavi,
    sacuvajTok: sacuvajTok,
    ucitajTok: ucitajTok,
    obrisiTok: obrisiTok,
    izvoz: izvoz,
    uvoz: uvoz,
    csv: csv,
    csvTesta: csvTesta,
    vrsteUIstoriji: vrsteUIstoriji,
    poslednjeMerenje: poslednjeMerenje
  };
})(window);
