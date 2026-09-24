/* Registar testova: jedno mesto gde svaki test kaze sta je, u cemu se meri,
   sta je bolji rezultat i kako se prikazuje. Ekrani ne smeju da znaju ni za
   jedan test posebno - sve sto im treba pitaju odavde.

   Nacini unosa:
     protokol  - test ima svoj ekran testiranja (beep test: sat, signali)
     pokusaji  - po igracu se unosi vise pokusaja, racuna se najbolji
     polja     - merenje sa vise razlicitih vrednosti (antropometrija) */
(function (global) {
  'use strict';

  var P = global.Protocol;

  function zaokruzi(x, decimala) {
    var m = Math.pow(10, decimala);
    return Math.round(x * m) / m;
  }

  /* Broj u nas zapis: 3.12 -> "3,12" */
  function broj(x, decimala) {
    if (x == null || isNaN(x)) return '';
    return zaokruzi(x, decimala).toFixed(decimala).replace('.', ',');
  }

  /* Najbolji od pokusaja - zavisi od toga da li je bolje vise ili manje. */
  function najboljiPokusaj(pokusaji, boljeJe) {
    var brojevi = (pokusaji || []).filter(function (x) { return x != null && x !== '' && !isNaN(x); })
      .map(Number);
    if (!brojevi.length) return null;
    return boljeJe === 'manje' ? Math.min.apply(null, brojevi) : Math.max.apply(null, brojevi);
  }

  /* ---------- zajednicko za testove sa pokusajima ---------- */

  function saPokusajima(def) {
    def.unos = 'pokusaji';
    /* Sto se meri na vreme moze da se izmeri i telefonom. */
    def.stoperica = def.jedinica === 's';
    def.glavna = function (r) {
      return r.najbolji == null ? najboljiPokusaj(r.pokusaji, def.boljeJe) : r.najbolji;
    };
    def.prikaz = function (r) {
      var v = def.glavna(r);
      return v == null ? '—' : broj(v, def.decimala) + (def.jedinica ? ' ' + def.jedinica : '');
    };
    def.izracunaj = function (r) {
      r.najbolji = najboljiPokusaj(r.pokusaji, def.boljeJe);
      return r;
    };
    def.kolone = ['rezultat'].concat(
      Array.apply(null, Array(def.pokusaja)).map(function (x, i) { return 'pokusaj_' + (i + 1); })
    );
    def.kolonePrikaz = ['Rezultat'].concat(
      Array.apply(null, Array(def.pokusaja)).map(function (x, i) { return String(i + 1); })
    );
    def.redPrikaz = function (r) {
      return [{ tekst: def.prikaz(r), jako: true }].concat(
        Array.apply(null, Array(def.pokusaja)).map(function (x, i) {
          var v = (r.pokusaji || [])[i];
          return { tekst: v == null || v === '' ? '—' : broj(Number(v), def.decimala) };
        })
      );
    };
    def.red = function (r) {
      var v = def.glavna(r);
      return [v == null ? '' : zaokruzi(v, def.decimala)].concat(
        Array.apply(null, Array(def.pokusaja)).map(function (x, i) {
          var p = (r.pokusaji || [])[i];
          return p == null || p === '' ? '' : zaokruzi(Number(p), def.decimala);
        })
      );
    };
    return def;
  }

  /* ---------- merenje sa vise vrednosti ---------- */

  function saPoljima(def) {
    def.unos = 'polja';
    def.glavna = function (r) {
      var v = (r.vrednosti || {})[def.polja[0].kljuc];
      return v == null || v === '' ? null : Number(v);
    };
    def.prikaz = function (r) {
      var v = def.glavna(r);
      return v == null ? '—' : broj(v, def.polja[0].decimala) + ' ' + def.polja[0].jedinica;
    };
    def.izracunaj = function (r) { return r; };
    def.kolone = def.polja.map(function (p) { return p.kljuc; });
    def.kolonePrikaz = def.polja.map(function (p) { return p.naziv; });
    def.redPrikaz = function (r) {
      return def.polja.map(function (p) {
        var v = (r.vrednosti || {})[p.kljuc];
        return { tekst: v == null || v === '' ? '—' : broj(Number(v), p.decimala) + ' ' + p.jedinica };
      });
    };
    def.red = function (r) {
      return def.polja.map(function (p) {
        var v = (r.vrednosti || {})[p.kljuc];
        return v == null || v === '' ? '' : zaokruzi(Number(v), p.decimala);
      });
    };
    return def;
  }

  /* ---------- sami testovi ---------- */

  var VRSTE = {};

  function dodaj(def) { VRSTE[def.id] = def; return def; }

  dodaj({
    id: 'beep',
    naziv: 'Beep test',
    kratko: 'Beep',
    grupa: 'Izdržljivost',
    opis: '20 m, 21 nivo, do 21:56 trčanja',
    unos: 'protokol',
    jedinica: 'deonica',
    boljeJe: 'vise',
    decimala: 0,
    glavna: function (r) { return r.ukupnoDeonica == null ? null : r.ukupnoDeonica; },
    prikaz: function (r) {
      if (r.nivo == null) return '—';
      return P.fmtLevel(r.nivo, r.deonica);
    },
    izracunaj: function (r) { return r; },
    kolone: ['nivo', 'deonica', 'ukupno_deonica', 'metara', 'vreme_s', 'vo2max'],
    kolonePrikaz: ['Nivo', 'Deonica', 'm', 'VO2max'],
    redPrikaz: function (r) {
      return [
        { tekst: r.nivo == null ? '—' : P.fmtLevel(r.nivo, r.deonica), jako: true },
        { tekst: r.ukupnoDeonica == null ? '—' : String(r.ukupnoDeonica) },
        { tekst: r.metara == null ? '—' : String(r.metara) },
        { tekst: r.vo2max == null ? '—' : String(r.vo2max) }
      ];
    },
    red: function (r) {
      return [r.nivo, r.deonica, r.ukupnoDeonica, r.metara, Math.round(r.vremeS || 0),
        r.vo2max == null ? '' : r.vo2max];
    }
  });

  dodaj(saPokusajima({
    id: 'skok-mesto',
    naziv: 'Skok iz mesta',
    kratko: 'Skok',
    grupa: 'Skok',
    opis: 'visina skoka bez zaleta, u centimetrima',
    jedinica: 'cm',
    boljeJe: 'vise',
    decimala: 0,
    pokusaja: 3
  }));

  dodaj(saPokusajima({
    id: 'skok-zalet',
    naziv: 'Skok sa zaletom',
    kratko: 'Skok zalet',
    grupa: 'Skok',
    opis: 'visina skoka iz zaleta, u centimetrima',
    jedinica: 'cm',
    boljeJe: 'vise',
    decimala: 0,
    pokusaja: 3
  }));

  dodaj(saPokusajima({
    id: 'sprint-20',
    naziv: 'Sprint 20 m',
    kratko: 'Sprint 20',
    grupa: 'Brzina',
    opis: 'vreme na 20 m iz visokog starta',
    jedinica: 's',
    boljeJe: 'manje',
    decimala: 2,
    pokusaja: 3
  }));

  dodaj(saPokusajima({
    id: 'sprint-34',
    naziv: 'Sprint 3/4 terena',
    kratko: 'Sprint 3/4',
    grupa: 'Brzina',
    opis: 'od osnovne linije do suprotne slobodne bacačke',
    jedinica: 's',
    boljeJe: 'manje',
    decimala: 2,
    pokusaja: 2
  }));

  dodaj(saPokusajima({
    id: 'lane-agility',
    naziv: 'Lane agility',
    kratko: 'Lane',
    grupa: 'Agilnost',
    opis: 'obilazak reketa, NBA combine',
    jedinica: 's',
    boljeJe: 'manje',
    decimala: 2,
    pokusaja: 2
  }));

  dodaj(saPokusajima({
    id: 't-test',
    naziv: 'T-test',
    kratko: 'T-test',
    grupa: 'Agilnost',
    opis: 'trčanje po slovu T, sa bočnim kretanjem',
    jedinica: 's',
    boljeJe: 'manje',
    decimala: 2,
    pokusaja: 2
  }));

  dodaj(saPokusajima({
    id: 'agilnost-505',
    naziv: '505 agilnost',
    kratko: '505',
    grupa: 'Agilnost',
    opis: 'promena pravca za 180°, meri se na 5 m',
    jedinica: 's',
    boljeJe: 'manje',
    decimala: 2,
    pokusaja: 2
  }));

  dodaj(saPoljima({
    id: 'mere',
    naziv: 'Merenje (antropometrija)',
    kratko: 'Mere',
    grupa: 'Merenje',
    opis: 'visina, težina, raspon ruku i dohvat',
    jedinica: 'cm',
    boljeJe: 'vise',
    /* Sta od izmerenog stoji i u kartonu igraca, da se ne unosi dvaput. */
    uIgraca: { visina: 'visina', tezina: 'tezina' },
    polja: [
      { kljuc: 'visina', naziv: 'Visina', jedinica: 'cm', decimala: 1 },
      { kljuc: 'tezina', naziv: 'Težina', jedinica: 'kg', decimala: 1 },
      { kljuc: 'raspon', naziv: 'Raspon ruku', jedinica: 'cm', decimala: 1 },
      { kljuc: 'dohvat', naziv: 'Dohvat u stojećem stavu', jedinica: 'cm', decimala: 1 }
    ]
  }));

  /* ---------- pristup ---------- */

  function vrsta(id) { return VRSTE[id] || VRSTE.beep; }

  function sve() {
    return Object.keys(VRSTE).map(function (k) { return VRSTE[k]; });
  }

  /* Testovi poredjani po grupama, za spisak pri izboru. */
  function poGrupama() {
    var red = {};
    sve().forEach(function (v) {
      if (!red[v.grupa]) red[v.grupa] = [];
      red[v.grupa].push(v);
    });
    return Object.keys(red).map(function (g) { return { grupa: g, vrste: red[g] }; });
  }

  /* Da li je prvi rezultat bolji od drugog - zna se po smeru testa. */
  function bolji(v, a, b) {
    if (a == null) return false;
    if (b == null) return true;
    return v.boljeJe === 'manje' ? a < b : a > b;
  }

  global.Testovi = {
    vrsta: vrsta,
    sve: sve,
    poGrupama: poGrupama,
    bolji: bolji,
    broj: broj,
    najboljiPokusaj: najboljiPokusaj
  };
})(window);
