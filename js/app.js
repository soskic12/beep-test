/* Ekrani aplikacije. Bez okvira i bez prevodjenja koda - obican JS. */
(function (global) {
  'use strict';

  var P = global.Protocol;
  var app = document.getElementById('app');
  var trakaEl = document.getElementById('traka');

  var run = null;            // test koji je u toku
  var nacrt = null;          // rezultati na ekranu sazetka, pre cuvanja
  var ekranLock = null;

  /* ---------- sitnice ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDatum(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + '.';
  }

  function fmtDatumVreme(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return fmtDatum(iso) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function danas() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fmtVreme(sek) {
    var s = Math.max(0, Math.round(sek || 0));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function poruka(tekst) {
    var stara = document.querySelector('.poruka');
    if (stara) stara.remove();
    var d = document.createElement('div');
    d.className = 'poruka';
    d.textContent = tekst;
    document.body.appendChild(d);
    global.setTimeout(function () { d.remove(); }, 2600);
  }

  function idi(hash) { global.location.hash = hash; }

  function vrednost(sel) {
    var e = app.querySelector(sel);
    return e ? e.value.trim() : '';
  }

  var STATUSI = { aktivan: 'u trci', opomena: 'opomena', ispao: 'ispao', odustao: 'odustao', povreda: 'povreda', zavrsio: 'završio' };

  function statusTekst(status) { return STATUSI[status] || status || ''; }

  function statusZnak(status) {
    var boja = { ispao: 'crveno', odustao: 'zuto', povreda: 'crveno', zavrsio: 'zeleno' }[status] || '';
    return '<span class="znak ' + boja + '">' + esc(statusTekst(status)) + '</span>';
  }

  /* Srpska mnozina: 1 test, 2-4 testa, 5+ testova. */
  function mnozina(n, jedan, dva, pet) {
    var d = n % 10, st = n % 100;
    if (d === 1 && st !== 11) return jedan;
    if (d >= 2 && d <= 4 && (st < 12 || st > 14)) return dva;
    return pet;
  }

  /* Na plocici nema mesta za puno ime: "Marko Markovic" -> "Marko M." */
  function kratkoIme(ime) {
    var delovi = String(ime || '').trim().split(/\s+/);
    if (delovi.length < 2) return delovi[0] || '';
    return delovi[0] + ' ' + delovi[delovi.length - 1].charAt(0) + '.';
  }

  /* Pitanje sa ponudjenim odgovorima; vraca obecanje sa izabranom vrednoscu. */
  function pitaj(naslov, opcije) {
    return new Promise(function (resolve) {
      var omot = document.createElement('div');
      omot.className = 'odbrojavanje';
      omot.innerHTML =
        '<div class="kartica" style="min-width:260px;max-width:90vw">' +
        '<h2>' + esc(naslov) + '</h2>' +
        opcije.map(function (o, i) {
          return '<button class="' + (o.klasa || '') + '" data-i="' + i + '" style="width:100%;margin-top:8px">' + esc(o.tekst) + '</button>';
        }).join('') +
        '<button class="tiho" data-i="-1" style="width:100%;margin-top:8px">Odustani</button>' +
        '</div>';
      omot.addEventListener('click', function (ev) {
        var b = ev.target.closest('button');
        if (!b) return;
        omot.remove();
        var i = parseInt(b.getAttribute('data-i'), 10);
        resolve(i >= 0 ? opcije[i].vrednost : null);
      });
      document.body.appendChild(omot);
    });
  }

  /* Datoteka za uvoz ume da bude snimljena kao ANSI (Notepad, Excel na nasim
     podesavanjima). Citanje takve datoteke kao UTF-8 pretvara s, c, dj i z u
     zamenske znake i ime igraca je zauvek pokvareno, pa se tu vraca na
     windows-1250 - kodnu stranu srpske latinice na Windowsu. */
  function dekodiraj(sadrzaj) {
    if (typeof sadrzaj === 'string') return { tekst: skiniBOM(sadrzaj), kodna: 'utf-8' };
    var bajtovi = new Uint8Array(sadrzaj);
    try {
      var tekst = new global.TextDecoder('utf-8', { fatal: true }).decode(bajtovi);
      return { tekst: skiniBOM(tekst), kodna: 'utf-8' };
    } catch (e) {
      return { tekst: skiniBOM(new global.TextDecoder('windows-1250').decode(bajtovi)), kodna: 'windows-1250' };
    }
  }

  function skiniBOM(t) { return t.charAt(0) === '﻿' ? t.slice(1) : t; }

  function preuzmi(imeDatoteke, sadrzaj, tip) {
    try {
      var blob = new Blob([sadrzaj], { type: (tip || 'application/json') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = imeDatoteke;
      document.body.appendChild(a);
      a.click();
      global.setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- ekran ostaje budan ---------- */

  function drziEkran() {
    try {
      if (!navigator.wakeLock || !global.DB.podesavanja().ekranBudan) return;
      navigator.wakeLock.request('screen').then(function (l) { ekranLock = l; }, function () {});
    } catch (e) { /* nema veze */ }
  }

  function pustiEkran() {
    try { if (ekranLock) ekranLock.release(); } catch (e) { /* nema veze */ }
    ekranLock = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && run && (run.status === 'trci' || run.status === 'odbrojavanje')) drziEkran();
  });

  /* ---------- ruter ---------- */

  var RUTE = [
    { re: /^#\/igraci$/, f: ekranIgraci },
    { re: /^#\/igrac\/([^/]+)$/, f: ekranIgrac },
    { re: /^#\/igrac\/([^/]+)\/izmena$/, f: ekranFormaIgraca },
    { re: /^#\/novi-igrac$/, f: function () { ekranFormaIgraca(null); } },
    { re: /^#\/testovi$/, f: ekranTestovi },
    { re: /^#\/test\/([^/]+)$/, f: ekranTest },
    { re: /^#\/novi$/, f: ekranPriprema },
    { re: /^#\/tok$/, f: ekranTok },
    { re: /^#\/sazetak$/, f: ekranSazetak },
    { re: /^#\/podesavanja$/, f: ekranPodesavanja }
  ];

  function nacrtajTraku(hash) {
    var stavke = [
      { h: '#/igraci', i: '👥', t: 'Igrači' },
      { h: '#/novi', i: '▶', t: 'Novi test' },
      { h: '#/testovi', i: '📋', t: 'Testovi' },
      { h: '#/podesavanja', i: '⚙', t: 'Podešavanja' }
    ];
    trakaEl.innerHTML = stavke.map(function (s) {
      var akt = hash.indexOf(s.h) === 0 ? ' aktivna' : '';
      return '<a class="' + akt.trim() + '" href="' + s.h + '"><span class="ikona">' + s.i + '</span>' + s.t + '</a>';
    }).join('');
  }

  function crtaj() {
    var hash = global.location.hash || '#/igraci';
    // ekran testiranja zauzima ceo prozor i ima svoju traku
    var uToku = hash === '#/tok';
    document.body.classList.toggle('trci', uToku);
    trakaEl.style.display = uToku ? 'none' : '';
    nacrtajTraku(hash);
    for (var i = 0; i < RUTE.length; i++) {
      var m = hash.match(RUTE[i].re);
      if (m) { RUTE[i].f(m[1]); return; }
    }
    idi('#/igraci');
  }

  global.addEventListener('hashchange', crtaj);

  /* ---------- igraci ---------- */

  var filterGrupa = '';
  var pretraga = '';
  var prikaziArhivirane = false;

  function ekranIgraci() {
    var svi = global.DB.igraci(prikaziArhivirane);
    var grupe = global.DB.grupe();
    var lista = svi.filter(function (p) {
      if (filterGrupa && p.grupa !== filterGrupa) return false;
      if (pretraga && (p.ime + ' ' + p.broj).toLowerCase().indexOf(pretraga.toLowerCase()) < 0) return false;
      return true;
    });

    app.innerHTML =
      '<div class="zaglavlje"><h1>Igrači</h1>' +
      '<a class="dugme glavno" href="#/novi-igrac">+ Novi</a></div>' +
      '<input id="pretraga" placeholder="Pretraga po imenu ili broju" value="' + esc(pretraga) + '">' +
      (grupe.length ? '<label>Grupa</label><select id="grupa">' +
        '<option value="">— sve grupe —</option>' +
        grupe.map(function (g) {
          return '<option value="' + esc(g) + '"' + (g === filterGrupa ? ' selected' : '') + '>' + esc(g) + '</option>';
        }).join('') + '</select>' : '') +
      '<div class="razmak">' +
      (lista.length ? lista.map(kartaIgraca).join('') :
        '<div class="prazno">Nema igrača. Dodaj prvog dugmetom <b>+ Novi</b>.</div>') +
      '</div>' +
      '<div class="sredina razmak"><button class="tiho malo" id="arh">' +
      (prikaziArhivirane ? 'Sakrij arhivirane' : 'Prikaži i arhivirane') + '</button></div>';

    app.querySelector('#pretraga').addEventListener('input', function (e) {
      pretraga = e.target.value;
      var poz = e.target.selectionStart;
      ekranIgraci();
      var novo = app.querySelector('#pretraga');
      novo.focus();
      novo.setSelectionRange(poz, poz);
    });
    var g = app.querySelector('#grupa');
    if (g) g.addEventListener('change', function (e) { filterGrupa = e.target.value; ekranIgraci(); });
    app.querySelector('#arh').addEventListener('click', function () {
      prikaziArhivirane = !prikaziArhivirane;
      ekranIgraci();
    });
  }

  function kartaIgraca(p) {
    var rez = global.DB.rezultatiIgraca(p.id);
    var zadnji = rez.length ? rez[rez.length - 1] : null;
    var najbolji = rez.reduce(function (a, r) {
      return !a || r.ukupnoDeonica > a.ukupnoDeonica ? r : a;
    }, null);
    var god = global.DB.godine(p);
    return '<a class="kartica klik red" href="#/igrac/' + esc(p.id) + '" style="color:inherit;text-decoration:none">' +
      '<div class="rast">' +
      '<div class="skraceno"><b>' + esc(p.ime || '(bez imena)') + '</b>' +
      (p.broj ? ' <span class="slab">#' + esc(p.broj) + '</span>' : '') +
      (p.arhiviran ? ' <span class="znak">arhiviran</span>' : '') + '</div>' +
      '<div class="slab skraceno">' +
      [p.grupa, god != null ? god + ' god.' : '', rez.length + ' ' + mnozina(rez.length, 'test', 'testa', 'testova')]
        .filter(Boolean).join(' · ') + '</div>' +
      '</div>' +
      '<div class="sredina">' +
      (najbolji ? '<div class="krupno">' + P.fmtLevel(najbolji.nivo, najbolji.deonica) + '</div>' +
        '<div class="slab">najbolje' + (zadnji && zadnji !== najbolji ? ' · zadnje ' + P.fmtLevel(zadnji.nivo, zadnji.deonica) : '') + '</div>'
        : '<div class="slab">nema rezultata</div>') +
      '</div></a>';
  }

  function ekranFormaIgraca(id) {
    var p = id ? global.DB.igrac(id) : null;
    if (id && !p) { idi('#/igraci'); return; }
    var v = p || { ime: '', broj: '', grupa: '', datumRodjenja: '', pol: '', visina: '', tezina: '', beleska: '' };
    app.innerHTML =
      '<div class="zaglavlje"><button class="tiho" id="nazad">‹ Nazad</button><h1>' + (p ? 'Izmena igrača' : 'Novi igrač') + '</h1></div>' +
      '<div class="kartica">' +
      '<label for="ime">Ime i prezime *</label><input id="ime" value="' + esc(v.ime) + '" autocomplete="off">' +
      '<label for="broj">Broj (dres)</label><input id="broj" value="' + esc(v.broj) + '" inputmode="numeric">' +
      '<label for="grupa">Grupa / ekipa</label><input id="grupa" value="' + esc(v.grupa) + '" list="grupe" autocomplete="off">' +
      '<datalist id="grupe">' + global.DB.grupe().map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist>' +
      '<label for="rodjen">Datum rođenja <span class="slab">(za VO2max po uzrastu)</span></label>' +
      '<input id="rodjen" type="date" value="' + esc(v.datumRodjenja) + '">' +
      '<label for="pol">Pol</label><select id="pol">' +
      ['', 'M', 'Z'].map(function (x) {
        return '<option value="' + x + '"' + (x === v.pol ? ' selected' : '') + '>' + (x === '' ? '—' : (x === 'M' ? 'Muški' : 'Ženski')) + '</option>';
      }).join('') + '</select>' +
      '<div class="red" style="gap:12px">' +
      '<div class="rast"><label for="visina">Visina (cm)</label><input id="visina" inputmode="numeric" value="' + esc(v.visina) + '"></div>' +
      '<div class="rast"><label for="tezina">Tezina (kg)</label><input id="tezina" inputmode="numeric" value="' + esc(v.tezina) + '"></div>' +
      '</div>' +
      '<label for="beleska">Beleška</label><textarea id="beleska">' + esc(v.beleska) + '</textarea>' +
      '</div>' +
      '<div class="dugmad puno"><button class="glavno" id="sacuvaj">Sačuvaj</button></div>';

    app.querySelector('#nazad').addEventListener('click', function () { history.back(); });
    app.querySelector('#sacuvaj').addEventListener('click', function () {
      var podaci = {
        ime: vrednost('#ime'), broj: vrednost('#broj'), grupa: vrednost('#grupa'),
        datumRodjenja: vrednost('#rodjen'), pol: vrednost('#pol'),
        visina: vrednost('#visina'), tezina: vrednost('#tezina'), beleska: vrednost('#beleska')
      };
      if (!podaci.ime) { poruka('Ime je obavezno.'); return; }
      if (p) {
        global.DB.izmeniIgraca(p.id, podaci);
        poruka('Sačuvano.');
        idi('#/igrac/' + p.id);
      } else {
        var novi = global.DB.dodajIgraca(podaci);
        poruka('Igrač dodat.');
        idi('#/igrac/' + novi.id);
      }
    });
  }

  function ekranIgrac(id) {
    var p = global.DB.igrac(id);
    if (!p) { idi('#/igraci'); return; }
    var rez = global.DB.rezultatiIgraca(id);
    var god = global.DB.godine(p);
    var najbolji = rez.reduce(function (a, r) { return !a || r.ukupnoDeonica > a.ukupnoDeonica ? r : a; }, null);
    var zadnji = rez.length ? rez[rez.length - 1] : null;
    var pomak = rez.length > 1 ? rez[rez.length - 1].ukupnoDeonica - rez[rez.length - 2].ukupnoDeonica : null;

    app.innerHTML =
      '<div class="zaglavlje"><button class="tiho" id="nazad">‹ Nazad</button>' +
      '<h1 class="skraceno">' + esc(p.ime) + '</h1>' +
      '<a class="dugme malo" href="#/igrac/' + esc(p.id) + '/izmena">Izmeni</a></div>' +
      '<div class="kartica slab">' +
      [p.broj ? 'broj ' + esc(p.broj) : '', esc(p.grupa), god != null ? god + ' god.' : '',
        p.visina ? esc(p.visina) + ' cm' : '', p.tezina ? esc(p.tezina) + ' kg' : '']
        .filter(Boolean).join(' · ') +
      (p.beleska ? '<div style="margin-top:6px">' + esc(p.beleska) + '</div>' : '') +
      '</div>' +
      (rez.length ?
        '<div class="kartica"><div class="red" style="text-align:center">' +
        '<div class="rast"><div class="krupno">' + P.fmtLevel(najbolji.nivo, najbolji.deonica) + '</div><div class="slab">najbolje</div></div>' +
        '<div class="rast"><div class="krupno">' + P.fmtLevel(zadnji.nivo, zadnji.deonica) + '</div><div class="slab">poslednje</div></div>' +
        '<div class="rast"><div class="krupno">' + (zadnji.vo2max != null ? zadnji.vo2max : '—') + '</div><div class="slab">VO2max</div></div>' +
        '</div>' +
        (pomak != null ? '<div class="sredina slab" style="margin-top:8px">u odnosu na prethodni test: <b>' +
          (pomak > 0 ? '+' : '') + pomak + '</b> deonica</div>' : '') +
        '</div>' +
        '<div class="kartica"><h2>Napredak</h2>' + grafikon(rez) + '</div>' +
        '<div class="kartica"><h2>Rezultati</h2><div class="uvijeno"><table class="tabela">' +
        '<tr><th>Datum</th><th>Test</th><th class="broj">Nivo</th><th class="broj">m</th><th class="broj">VO2max</th><th></th></tr>' +
        rez.slice().reverse().map(function (r) {
          return '<tr><td>' + fmtDatum(r.datum) + '</td>' +
            '<td class="skraceno"><a href="#/test/' + esc(r.testId) + '">' + esc(r.naziv || 'test') + '</a></td>' +
            '<td class="broj"><b>' + P.fmtLevel(r.nivo, r.deonica) + '</b></td>' +
            '<td class="broj">' + r.metara + '</td>' +
            '<td class="broj">' + (r.vo2max != null ? r.vo2max : '—') + '</td>' +
            '<td>' + statusZnak(r.status) + '</td></tr>';
        }).join('') +
        '</table></div></div>'
        : '<div class="prazno">Još nema odrađenih testova za ovog igrača.</div>') +
      '<div class="dugmad razmak"><button id="arhiviraj">' + (p.arhiviran ? 'Vrati iz arhive' : 'Arhiviraj') + '</button>' +
      '<button class="opasno" id="obrisi">Obriši igrača</button></div>';

    app.querySelector('#nazad').addEventListener('click', function () { idi('#/igraci'); });
    app.querySelector('#arhiviraj').addEventListener('click', function () {
      global.DB.arhivirajIgraca(p.id, !p.arhiviran);
      poruka(p.arhiviran ? 'Vraćen iz arhive.' : 'Arhiviran — ne pojavljuje se pri izboru učesnika.');
      ekranIgrac(id);
    });
    app.querySelector('#obrisi').addEventListener('click', function () {
      var upozorenje = rez.length
        ? 'Igrač ima ' + rez.length + ' rezultat(a). Brisanjem se gubi veza sa istorijom (rezultati u testovima ostaju upisani pod imenom). Obrisati?'
        : 'Obrisati igrača?';
      if (!global.confirm(upozorenje)) return;
      global.DB.obrisiIgraca(p.id);
      poruka('Obrisano.');
      idi('#/igraci');
    });
  }

  /* Jednostavan SVG grafikon napretka - ukupno deonica kroz vreme. */
  function grafikon(rez) {
    if (rez.length < 2) return '<div class="slab">Grafikon se crta od drugog testa.</div>';
    var w = 600, h = 220, l = 46, r = 12, t = 16, b = 34;
    var y = rez.map(function (x) { return x.ukupnoDeonica; });
    var min = Math.min.apply(null, y), max = Math.max.apply(null, y);
    if (max === min) { max = min + 1; }
    var raspon = max - min;
    min = Math.max(0, min - raspon * 0.15);
    max = max + raspon * 0.15;
    var tacke = rez.map(function (x, i) {
      var px = l + (rez.length === 1 ? (w - l - r) / 2 : i * (w - l - r) / (rez.length - 1));
      var py = t + (h - t - b) * (1 - (x.ukupnoDeonica - min) / (max - min));
      return { x: px, y: py, r: x };
    });
    return '<svg class="grafikon" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Napredak">' +
      '<line class="osa" x1="' + l + '" y1="' + t + '" x2="' + l + '" y2="' + (h - b) + '"/>' +
      '<line class="osa" x1="' + l + '" y1="' + (h - b) + '" x2="' + (w - r) + '" y2="' + (h - b) + '"/>' +
      '<text x="2" y="' + (t + 8) + '">' + Math.round(max) + '</text>' +
      '<text x="2" y="' + (h - b) + '">' + Math.round(min) + '</text>' +
      '<polyline class="linija" points="' + tacke.map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>' +
      tacke.map(function (p) { return '<circle class="tacka" cx="' + p.x + '" cy="' + p.y + '" r="5"/>'; }).join('') +
      '<text x="' + l + '" y="' + (h - 8) + '">' + fmtDatum(rez[0].datum) + '</text>' +
      '<text x="' + (w - r) + '" y="' + (h - 8) + '" text-anchor="end">' + fmtDatum(rez[rez.length - 1].datum) + '</text>' +
      '</svg>' +
      '<div class="slab sredina">ukupno deonica po testu</div>';
  }

  /* ---------- priprema testa ---------- */

  var izabrani = {};      // igracId -> true
  var pripremaGrupa = '';

  function ekranPriprema() {
    var pod = global.DB.podesavanja();
    var svi = global.DB.igraci(false);
    var grupe = global.DB.grupe();
    var lista = svi.filter(function (p) { return !pripremaGrupa || p.grupa === pripremaGrupa; });
    var brojIzabranih = Object.keys(izabrani).filter(function (k) { return izabrani[k]; }).length;
    var tok = global.DB.ucitajTok();

    app.innerHTML =
      '<div class="zaglavlje"><h1>Novi test</h1></div>' +
      (tok && tok.status !== 'gotovo' ?
        '<div class="kartica"><b>Započet test koji nije završen</b>' +
        '<div class="slab">' + esc(tok.naziv || 'bez naziva') + ' · ' + fmtDatumVreme(tok.datum) +
        ' · ' + (tok.ucesnici || []).length + ' učesnika</div>' +
        '<div class="dugmad puno razmak"><button class="glavno" id="nastaviTok">Nastavi</button>' +
        '<button id="odbaciTok">Odbaci</button></div></div>' : '') +
      '<div class="kartica">' +
      '<label for="naziv">Naziv testiranja</label>' +
      '<input id="naziv" value="Beep test ' + fmtDatum(new Date().toISOString()) + '">' +
      '<label for="datum">Datum</label><input id="datum" type="date" value="' + danas() + '">' +
      '<label for="lokacija">Mesto</label><input id="lokacija" placeholder="npr. sala, teren">' +
      '<label for="beleska">Beleška</label><textarea id="beleska" placeholder="uslovi, podloga, sastav ekipe…"></textarea>' +
      '</div>' +
      '<div class="kartica">' +
      '<div class="red"><div class="rast"><h2 style="margin:0">Učesnici</h2>' +
      '<div class="slab" id="brojac">izabrano: ' + brojIzabranih + '</div></div>' +
      '<button class="malo" id="sve">Svi</button><button class="malo" id="nijedan">Nijedan</button></div>' +
      (grupe.length ? '<label for="pgrupa">Grupa</label><select id="pgrupa">' +
        '<option value="">— sve grupe —</option>' +
        grupe.map(function (g) {
          return '<option value="' + esc(g) + '"' + (g === pripremaGrupa ? ' selected' : '') + '>' + esc(g) + '</option>';
        }).join('') + '</select>' : '') +
      '<div class="izbor razmak">' +
      (lista.length ? lista.map(function (p) {
        return '<div class="stavka' + (izabrani[p.id] ? ' cekirana' : '') + '" data-id="' + esc(p.id) + '">' +
          '<input type="checkbox" ' + (izabrani[p.id] ? 'checked' : '') + ' tabindex="-1">' +
          '<div class="rast skraceno"><b>' + esc(p.ime) + '</b>' +
          (p.broj ? ' <span class="slab">#' + esc(p.broj) + '</span>' : '') + '</div></div>';
      }).join('') : '<div class="prazno">Nema igrača. Prvo ih dodaj u delu <b>Igrači</b>.</div>') +
      '</div></div>' +
      '<div class="kartica"><h2>Protokol</h2>' +
      '<div class="slab">20 m, ' + P.TOTAL_SHUTTLES + ' deonica, najviše ' + fmtVreme(P.TOTAL_TIME) + ' min trčanja.</div>' +
      '<label class="red" style="margin-top:10px;gap:8px"><input type="checkbox" id="opomena"' + (pod.opomena ? ' checked' : '') + '>' +
      '<span>Prvi promašaj je opomena, drugi je ispadanje</span></label>' +
      '<label class="red" style="gap:8px"><input type="checkbox" id="najava"' + (pod.najava ? ' checked' : '') + '>' +
      '<span>Govorna najava nivoa</span></label>' +
      '<label for="odbroj">Odbrojavanje pre starta</label>' +
      '<select id="odbroj">' + [0, 3, 5, 10].map(function (n) {
        return '<option value="' + n + '"' + (n === pod.odbrojavanje ? ' selected' : '') + '>' + (n === 0 ? 'bez odbrojavanja' : n + ' s') + '</option>';
      }).join('') + '</select>' +
      '<div class="dugmad razmak"><button class="malo" id="proba">Proba zvuka</button></div>' +
      '</div>' +
      '<div class="dugmad puno razmak"><button class="glavno" id="start"' + (brojIzabranih ? '' : ' disabled') + '>' +
      'Pokreni test (' + brojIzabranih + ')</button></div>';

    var pg = app.querySelector('#pgrupa');
    if (pg) pg.addEventListener('change', function (e) { pripremaGrupa = e.target.value; ekranPriprema(); });

    app.querySelector('.izbor').addEventListener('click', function (e) {
      var s = e.target.closest('.stavka');
      if (!s) return;
      var id = s.getAttribute('data-id');
      izabrani[id] = !izabrani[id];
      s.classList.toggle('cekirana', !!izabrani[id]);
      s.querySelector('input').checked = !!izabrani[id];
      osveziBrojac();
    });

    function osveziBrojac() {
      var n = Object.keys(izabrani).filter(function (k) { return izabrani[k]; }).length;
      app.querySelector('#brojac').textContent = 'izabrano: ' + n;
      var s = app.querySelector('#start');
      s.disabled = n === 0;
      s.textContent = 'Pokreni test (' + n + ')';
    }

    app.querySelector('#sve').addEventListener('click', function () {
      lista.forEach(function (p) { izabrani[p.id] = true; });
      ekranPriprema();
    });
    app.querySelector('#nijedan').addEventListener('click', function () {
      izabrani = {};
      ekranPriprema();
    });
    app.querySelector('#proba').addEventListener('click', function () { global.Zvuk.proba(); });

    ['opomena', 'najava'].forEach(function (k) {
      app.querySelector('#' + k).addEventListener('change', function (e) { global.DB.postavi(k, e.target.checked); });
    });
    app.querySelector('#odbroj').addEventListener('change', function (e) {
      global.DB.postavi('odbrojavanje', parseInt(e.target.value, 10));
    });

    if (tok && tok.status !== 'gotovo') {
      app.querySelector('#nastaviTok').addEventListener('click', function () {
        global.Zvuk.otkljucaj();
        run = global.Run.izToka(tok, { onPromena: osveziTok, onKraj: krajTesta });
        idi('#/tok');
      });
      app.querySelector('#odbaciTok').addEventListener('click', function () {
        if (!global.confirm('Odbaciti započeti test i njegove oznake?')) return;
        global.DB.obrisiTok();
        ekranPriprema();
      });
    }

    app.querySelector('#start').addEventListener('click', function () {
      var ids = Object.keys(izabrani).filter(function (k) { return izabrani[k]; });
      if (!ids.length) return;
      var datum = vrednost('#datum') || danas();
      var ucesnici = ids.map(function (id) {
        var p = global.DB.igrac(id);
        return {
          igracId: id,
          ime: p ? p.ime : '(nepoznat)',
          broj: p ? p.broj : '',
          grupa: p ? p.grupa : '',
          godine: global.DB.godine(p, datum)
        };
      });
      global.Zvuk.otkljucaj();
      run = new global.Run({
        naziv: vrednost('#naziv'),
        datum: new Date(datum + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(),
        lokacija: vrednost('#lokacija'),
        beleska: vrednost('#beleska'),
        opomena: app.querySelector('#opomena').checked,
        najava: app.querySelector('#najava').checked,
        odbrojavanje: parseInt(app.querySelector('#odbroj').value, 10),
        ucesnici: ucesnici,
        onPromena: osveziTok,
        onKraj: krajTesta
      });
      idi('#/tok');
      run.start();
      drziEkran();
    });
  }

  /* ---------- ekran testiranja ---------- */

  var plocice = {};   // igracId -> element

  function ekranTok() {
    if (!run) { idi('#/novi'); return; }
    plocice = {};
    app.innerHTML =
      '<div class="tok">' +
      '<div class="vrh">' +
      '<div class="brojevi">' +
      '<div class="nivo" id="tNivo">1.1</div>' +
      '<div class="rast"><div class="sat" id="tSat">00:00</div><div class="slab" id="tInfo"></div></div>' +
      '</div>' +
      '<div class="napredak" id="tNapredak"><i></i></div>' +
      '</div>' +
      '<div class="plocice" id="tPlocice"></div>' +
      '<div class="dno">' +
      '<button id="tPauza">Pauza</button>' +
      '<button class="opasno" id="tZavrsi">Završi test</button>' +
      '</div></div>' +
      '<div class="odbrojavanje" id="tOdbroj" style="display:none"><div class="broj">5</div><div>Pripremi se</div></div>';

    var grid = app.querySelector('#tPlocice');
    if (run.ucesnici.length > 12) grid.classList.add('gusto');
    run.ucesnici.forEach(function (u) {
      var d = document.createElement('div');
      d.className = 'plocica';
      d.setAttribute('data-id', u.igracId);
      grid.appendChild(d);
      plocice[u.igracId] = d;
    });

    postaviDodire(grid);

    app.querySelector('#tPauza').addEventListener('click', function () {
      if (run.status === 'pauza') { run.nastavi(); drziEkran(); }
      else { run.pauza(); pustiEkran(); }
      osveziTok();
    });
    app.querySelector('#tZavrsi').addEventListener('click', function () {
      if (run.status !== 'gotovo' && !global.confirm('Završiti test? Igrači koji još trče dobijaju trenutni rezultat.')) return;
      run.zavrsi('rucno');
    });

    osveziTok();
  }

  function postaviDodire(grid) {
    var drzanje = null;
    var dugoDrzano = false;

    grid.addEventListener('pointerdown', function (e) {
      var pl = e.target.closest('.plocica');
      if (!pl || e.target.closest('button')) return;
      dugoDrzano = false;
      var id = pl.getAttribute('data-id');
      drzanje = global.setTimeout(function () {
        dugoDrzano = true;
        meni(id);
      }, 550);
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      grid.addEventListener(ev, function () {
        if (drzanje) { global.clearTimeout(drzanje); drzanje = null; }
      });
    });

    grid.addEventListener('click', function (e) {
      var pl = e.target.closest('.plocica');
      if (!pl) return;
      var id = pl.getAttribute('data-id');
      var dugme = e.target.closest('button');
      if (dugme) {
        var akcija = dugme.getAttribute('data-akcija');
        if (akcija === 'vrati') run.vrati(id);
        else if (akcija === 'stigao') run.skiniOpomenu(id);
        return;
      }
      if (dugoDrzano) { dugoDrzano = false; return; }
      run.oznaci(id);
    });
  }

  function meni(igracId) {
    var u = null;
    run.ucesnici.forEach(function (x) { if (x.igracId === igracId) u = x; });
    if (!u) return;
    pitaj(u.ime, [
      { tekst: 'Odustao', vrednost: 'odustao' },
      { tekst: 'Povreda', vrednost: 'povreda' },
      { tekst: 'Vrati u trku', vrednost: 'vrati', klasa: 'glavno' }
    ]).then(function (izbor) {
      if (!izbor) return;
      if (izbor === 'vrati') run.vrati(igracId);
      else run.prekini(igracId, izbor);
    });
  }

  function osveziTok() {
    if ((global.location.hash || '') !== '#/tok' || !run) return;
    var t = run.proteklo();
    var sh = run.trenutna();
    var zavrseno = run.zavrsenoDeonica();

    var nivoEl = app.querySelector('#tNivo');
    if (!nivoEl) return;
    nivoEl.textContent = P.fmtLevel(sh.level, sh.shuttle);
    app.querySelector('#tSat').textContent = fmtVreme(Math.max(0, t)) + ' / ' + fmtVreme(P.TOTAL_TIME);
    var aktivnih = run.aktivni().length;
    app.querySelector('#tInfo').textContent =
      sh.speed.toFixed(1) + ' km/h · u trci ' + aktivnih + '/' + run.ucesnici.length +
      ' · ' + zavrseno + ' deonica';

    var napredak = app.querySelector('#tNapredak');
    var udeo = t < 0 ? 0 : Math.min(1, Math.max(0, (t - sh.startAt) / sh.duration));
    napredak.firstElementChild.style.width = (udeo * 100).toFixed(1) + '%';
    napredak.classList.toggle('uskoro', t > 0 && (sh.endAt - t) < 1.5);

    var odbroj = app.querySelector('#tOdbroj');
    if (run.status === 'odbrojavanje' && t < 0) {
      odbroj.style.display = '';
      odbroj.firstElementChild.textContent = Math.max(1, Math.ceil(-t));
    } else {
      odbroj.style.display = 'none';
    }

    var pauzaDugme = app.querySelector('#tPauza');
    pauzaDugme.textContent = run.status === 'pauza' ? 'Nastavi' : 'Pauza';
    pauzaDugme.classList.toggle('glavno', run.status === 'pauza');

    run.ucesnici.forEach(function (u) {
      var el = plocice[u.igracId];
      if (!el) return;
      var klasa = 'plocica ' + u.status;
      if (el.className !== klasa) el.className = klasa;
      var prikaz;
      if (u.status === 'aktivan') {
        prikaz = '<div class="rez">' + P.fmtLevel(sh.level, sh.shuttle) + '</div>';
      } else if (u.status === 'opomena') {
        var ls = P.toLevelShuttle(u.opomenaNa == null ? zavrseno : u.opomenaNa);
        prikaz = '<div class="rez">' + P.fmtLevel(ls.level, ls.shuttle) + '</div>' +
          '<div class="podnozje"><button class="malo" data-akcija="stigao">✓ stigao</button></div>';
      } else {
        var lz = P.toLevelShuttle(u.zavrseno == null ? 0 : u.zavrseno);
        prikaz = '<div class="rez">' + P.fmtLevel(lz.level, lz.shuttle) + '</div>' +
          '<div class="podnozje"><span class="dres">' + esc(statusTekst(u.status)) + '</span>' +
          '<button class="malo" data-akcija="vrati" title="vrati u trku">↺</button></div>';
      }
      var html = (u.broj ? '<div class="dres">#' + esc(u.broj) + '</div>' : '') +
        '<div class="ime">' + esc(kratkoIme(u.ime)) + '</div>' + prikaz;
      if (el.getAttribute('data-html') !== html) {
        el.innerHTML = html;
        el.setAttribute('data-html', html);
      }
    });
  }

  function krajTesta() {
    pustiEkran();
    nacrt = {
      id: run.id,
      naziv: run.naziv,
      datum: run.datum,
      lokacija: run.lokacija,
      beleska: run.beleska,
      protokol: '20m MSFT',
      rezultati: run.rezultati()
    };
    idi('#/sazetak');
  }

  /* ---------- sazetak pre cuvanja ---------- */

  function ekranSazetak() {
    if (!nacrt) { idi('#/testovi'); return; }
    var poredak = nacrt.rezultati.slice().sort(function (a, b) { return b.ukupnoDeonica - a.ukupnoDeonica; });

    app.innerHTML =
      '<div class="zaglavlje"><h1>Rezultati</h1></div>' +
      '<div class="kartica slab">Ispravi rezultat dugmadima <b>−</b> i <b>+</b> ako je oznaka data sekundu prerano ili prekasno.</div>' +
      '<div class="kartica">' +
      '<label for="snaziv">Naziv</label><input id="snaziv" value="' + esc(nacrt.naziv) + '">' +
      '<label for="sbeleska">Beleška</label><textarea id="sbeleska">' + esc(nacrt.beleska) + '</textarea>' +
      '</div>' +
      poredak.map(function (r, i) {
        return '<div class="kartica" data-id="' + esc(r.igracId) + '">' +
          '<div class="red"><div class="rast"><b>' + (i + 1) + '. ' + esc(r.ime) + '</b>' +
          (r.broj ? ' <span class="slab">#' + esc(r.broj) + '</span>' : '') +
          '<div class="slab">' + r.metara + ' m · ' + fmtVreme(r.vremeS) +
          (r.vo2max != null ? ' · VO2max ' + r.vo2max : '') + '</div></div>' +
          '<button class="malo" data-akcija="minus">−</button>' +
          '<div class="krupno" style="min-width:64px;text-align:center">' + P.fmtLevel(r.nivo, r.deonica) + '</div>' +
          '<button class="malo" data-akcija="plus">+</button></div>' +
          '<div class="red" style="margin-top:8px;gap:8px">' +
          '<select data-akcija="status" class="rast">' +
          ['ispao', 'odustao', 'povreda', 'zavrsio'].map(function (s) {
            return '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + statusTekst(s) + '</option>';
          }).join('') + '</select>' +
          '<input class="rast" data-akcija="beleska" placeholder="beleška" value="' + esc(r.beleska || '') + '">' +
          '</div></div>';
      }).join('') +
      '<div class="dugmad puno razmak"><button class="glavno" id="sacuvajTest">Sačuvaj test</button></div>' +
      '<div class="dugmad puno">' +
      (run && run.proteklo() < P.TOTAL_TIME ? '<button id="nazadNaTest">‹ Nazad na test</button>' : '') +
      '<button class="tiho" id="odbaciTest">Odbaci rezultate</button></div>';

    var nazadDugme = app.querySelector('#nazadNaTest');
    if (nazadDugme) nazadDugme.addEventListener('click', function () {
      // test se vraca u pauzi; dugmetom ↺ vraca se igrac koji je greskom oznacen
      if (run.status === 'gotovo') run.status = 'pauza';
      nacrt = null;
      idi('#/tok');
    });

    app.querySelector('#sacuvajTest').addEventListener('click', function () {
      nacrt.naziv = vrednost('#snaziv');
      nacrt.beleska = vrednost('#sbeleska');
      global.DB.sacuvajTest(nacrt);
      global.DB.obrisiTok();
      var id = nacrt.id;
      nacrt = null;
      run = null;
      izabrani = {};
      poruka('Test sačuvan.');
      idi('#/test/' + id);
    });
    app.querySelector('#odbaciTest').addEventListener('click', function () {
      if (!global.confirm('Odbaciti rezultate ovog testiranja?')) return;
      global.DB.obrisiTok();
      nacrt = null;
      run = null;
      idi('#/testovi');
    });
  }

  app.addEventListener('click', function (e) {
    if ((global.location.hash || '') !== '#/sazetak') return;
    sazetakKlik(e);
  });

  function sazetakKlik(e) {
    var dugme = e.target.closest('button[data-akcija]');
    if (!dugme || !nacrt) return;
    var kart = dugme.closest('.kartica[data-id]');
    if (!kart) return;
    var id = kart.getAttribute('data-id');
    var r = null;
    nacrt.rezultati.forEach(function (x) { if (x.igracId === id) r = x; });
    if (!r) return;
    var pomak = dugme.getAttribute('data-akcija') === 'plus' ? 1 : -1;
    postaviRezultat(r, Math.max(0, Math.min(P.TOTAL_SHUTTLES, r.ukupnoDeonica + pomak)));
    var ls = P.toLevelShuttle(r.ukupnoDeonica);
    kart.querySelector('.krupno').textContent = P.fmtLevel(ls.level, ls.shuttle);
    kart.querySelector('.slab').textContent = r.metara + ' m · ' + fmtVreme(r.vremeS) +
      (r.vo2max != null ? ' · VO2max ' + r.vo2max : '');
  }

  function postaviRezultat(r, zavrseno) {
    var ls = P.toLevelShuttle(zavrseno);
    r.nivo = ls.level;
    r.deonica = ls.shuttle;
    r.ukupnoDeonica = zavrseno;
    r.metara = zavrseno * P.DISTANCE_M;
    r.vremeS = P.timeAt(ls.level, ls.shuttle);
    r.vo2max = P.vo2max(ls.level, ls.shuttle);
    r.vo2maxLeger = P.vo2maxLeger(ls.level, ls.shuttle, r.godine);
  }

  /* promene u poljima sazetka (status, beleska) */
  app.addEventListener('change', function (e) {
    if (!nacrt || (global.location.hash || '') !== '#/sazetak') return;
    var polje = e.target.closest('[data-akcija]');
    if (!polje) return;
    var kart = polje.closest('.kartica[data-id]');
    if (!kart) return;
    var id = kart.getAttribute('data-id');
    nacrt.rezultati.forEach(function (r) {
      if (r.igracId !== id) return;
      if (polje.getAttribute('data-akcija') === 'status') r.status = polje.value;
      if (polje.getAttribute('data-akcija') === 'beleska') r.beleska = polje.value;
    });
  });

  /* ---------- istorija testova ---------- */

  function ekranTestovi() {
    var lista = global.DB.testovi();
    app.innerHTML =
      '<div class="zaglavlje"><h1>Testovi</h1><a class="dugme glavno" href="#/novi">+ Novi</a></div>' +
      (lista.length ? lista.map(function (t) {
        var rez = t.rezultati || [];
        var najbolji = rez.reduce(function (a, r) { return !a || r.ukupnoDeonica > a.ukupnoDeonica ? r : a; }, null);
        var prosek = rez.length ? rez.reduce(function (s, r) { return s + r.ukupnoDeonica; }, 0) / rez.length : 0;
        return '<a class="kartica klik red" href="#/test/' + esc(t.id) + '" style="color:inherit;text-decoration:none">' +
          '<div class="rast"><div class="skraceno"><b>' + esc(t.naziv || 'Beep test') + '</b></div>' +
          '<div class="slab skraceno">' + fmtDatum(t.datum) + ' · ' + rez.length + ' učesnika' +
          (t.lokacija ? ' · ' + esc(t.lokacija) : '') + '</div></div>' +
          '<div class="sredina"><div class="krupno">' + (najbolji ? P.fmtLevel(najbolji.nivo, najbolji.deonica) : '—') + '</div>' +
          '<div class="slab">prosek ' + prosek.toFixed(0) + ' deonica</div></div></a>';
      }).join('') : '<div class="prazno">Još nema odrađenih testiranja.</div>');
  }

  function ekranTest(id) {
    var t = global.DB.test(id);
    if (!t) { idi('#/testovi'); return; }
    var rez = (t.rezultati || []).slice().sort(function (a, b) { return b.ukupnoDeonica - a.ukupnoDeonica; });
    app.innerHTML =
      '<div class="zaglavlje"><button class="tiho" id="nazad">‹ Nazad</button><h1 class="skraceno">' + esc(t.naziv || 'Beep test') + '</h1></div>' +
      '<div class="kartica slab">' +
      [fmtDatumVreme(t.datum), t.lokacija ? esc(t.lokacija) : '', rez.length + ' učesnika', esc(t.protokol || '20m MSFT')]
        .filter(Boolean).join(' · ') +
      (t.beleska ? '<div style="margin-top:6px">' + esc(t.beleska) + '</div>' : '') + '</div>' +
      '<div class="kartica"><div class="uvijeno"><table class="tabela">' +
      '<tr><th>#</th><th>Igrač</th><th class="broj">Nivo</th><th class="broj">Deonica</th><th class="broj">m</th><th class="broj">VO2max</th><th></th></tr>' +
      rez.map(function (r, i) {
        return '<tr><td>' + (i + 1) + '</td>' +
          '<td class="skraceno"><a href="#/igrac/' + esc(r.igracId) + '">' + esc(r.ime) + '</a>' +
          (r.grupa ? '<div class="slab">' + esc(r.grupa) + '</div>' : '') + '</td>' +
          '<td class="broj"><b>' + P.fmtLevel(r.nivo, r.deonica) + '</b></td>' +
          '<td class="broj">' + r.ukupnoDeonica + '</td>' +
          '<td class="broj">' + r.metara + '</td>' +
          '<td class="broj">' + (r.vo2max != null ? r.vo2max : '—') + '</td>' +
          '<td>' + statusZnak(r.status) + '</td></tr>';
      }).join('') +
      '</table></div></div>' +
      '<div class="dugmad razmak"><button id="csv">Izvezi CSV</button>' +
      '<button class="opasno" id="obrisi">Obriši test</button></div>';

    app.querySelector('#nazad').addEventListener('click', function () { idi('#/testovi'); });
    app.querySelector('#csv').addEventListener('click', function () {
      var red = [['igrac', 'broj', 'grupa', 'nivo', 'deonica', 'ukupno_deonica', 'metara', 'vreme_s', 'vo2max', 'status', 'beleska']];
      rez.forEach(function (r) {
        red.push([r.ime, r.broj, r.grupa, r.nivo, r.deonica, r.ukupnoDeonica, r.metara,
          Math.round(r.vremeS || 0), r.vo2max == null ? '' : r.vo2max, r.status, r.beleska || '']);
      });
      var csv = red.map(function (r) {
        return r.map(function (c) {
          var v = c == null ? '' : String(c);
          return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        }).join(';');
      }).join('\r\n');
      if (preuzmi('beep-test-' + (t.datum || '').slice(0, 10) + '.csv', '﻿' + csv, 'text/csv')) poruka('CSV preuzet.');
    });
    app.querySelector('#obrisi').addEventListener('click', function () {
      if (!global.confirm('Obrisati ovo testiranje i sve njegove rezultate?')) return;
      global.DB.obrisiTest(t.id);
      poruka('Test obrisan.');
      idi('#/testovi');
    });
  }

  /* ---------- podesavanja ---------- */

  function ekranPodesavanja() {
    var pod = global.DB.podesavanja();
    var s = global.DB.state();
    app.innerHTML =
      '<div class="zaglavlje"><h1>Podešavanja</h1></div>' +
      '<div class="kartica">' +
      prekidac('opomena', 'Opomena pre ispadanja', pod.opomena) +
      prekidac('zvuk', 'Zvučni signal', pod.zvuk) +
      prekidac('najava', 'Govorna najava nivoa', pod.najava) +
      prekidac('ekranBudan', 'Drži ekran uključen tokom testa', pod.ekranBudan) +
      '<label for="odbroj">Odbrojavanje pre starta</label>' +
      '<select id="odbroj">' + [0, 3, 5, 10].map(function (n) {
        return '<option value="' + n + '"' + (n === pod.odbrojavanje ? ' selected' : '') + '>' + (n === 0 ? 'bez odbrojavanja' : n + ' s') + '</option>';
      }).join('') + '</select>' +
      '<div class="dugmad razmak"><button class="malo" id="proba">Proba zvuka</button></div>' +
      '</div>' +
      '<div class="kartica"><h2>Podaci</h2>' +
      '<div class="slab">' + s.igraci.length + ' igrača · ' + s.testovi.length + ' testiranja. ' +
      'Sve stoji u ovom pregledaču — napravi rezervnu kopiju pre brisanja podataka pregledača ili promene telefona.</div>' +
      '<div class="dugmad razmak"><button id="izvoz">Izvoz (JSON)</button>' +
      '<button id="csv">Svi rezultati (CSV)</button></div>' +
      '<div class="dugmad razmak"><button id="uvoz">Uvoz iz datoteke</button></div>' +
      '<input type="file" id="datoteka" accept="application/json,.json" style="display:none">' +
      '<div class="dugmad razmak"><button class="opasno" id="brisi">Obriši sve podatke</button></div>' +
      '</div>' +
      '<div class="kartica"><h2>Kako se radi test</h2>' +
      '<p class="slab">Dve linije na ' + P.DISTANCE_M + ' m. Trči se od signala do signala; ko dva puta uzastopno ne stigne na liniju, ispada. ' +
      'Test ima ' + P.LEVELS.length + ' nivoa i ' + P.TOTAL_SHUTTLES + ' deonica, ukupno ' + fmtVreme(P.TOTAL_TIME) + ' trčanja.</p>' +
      '<p class="slab">Dodir na pločicu igrača označava promašaj, drugi dodir ispadanje. Dugi pritisak nudi <b>odustao</b> i <b>povreda</b>. ' +
      'Dugme ↺ vraća igrača u trku ako je dodir bio greška.</p>' +
      '<p class="slab">VO2max se računa po Ramsbottomu (ne traži godine); kad je upisan datum rođenja, uz rezultat stoji i Légerova procena.</p>' +
      '</div>';

    app.querySelectorAll('input[type="checkbox"][data-k]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        global.DB.postavi(cb.getAttribute('data-k'), cb.checked);
        if (cb.getAttribute('data-k') === 'zvuk') global.Zvuk.utisaj(!cb.checked);
      });
    });
    app.querySelector('#odbroj').addEventListener('change', function (e) {
      global.DB.postavi('odbrojavanje', parseInt(e.target.value, 10));
    });
    app.querySelector('#proba').addEventListener('click', function () { global.Zvuk.proba(); });

    app.querySelector('#izvoz').addEventListener('click', function () {
      if (preuzmi('beep-test-' + danas() + '.json', global.DB.izvoz(), 'application/json')) poruka('Kopija preuzeta.');
    });
    app.querySelector('#csv').addEventListener('click', function () {
      if (preuzmi('beep-test-svi-rezultati-' + danas() + '.csv', '﻿' + global.DB.csv(), 'text/csv')) poruka('CSV preuzet.');
    });
    app.querySelector('#uvoz').addEventListener('click', function () { app.querySelector('#datoteka').click(); });
    app.querySelector('#datoteka').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var citac = new FileReader();
      citac.onload = function () {
        var nalaz = dekodiraj(citac.result);
        if (nalaz.kodna !== 'utf-8') {
          poruka('Datoteka nije UTF-8; pročitana je kao ' + nalaz.kodna + '.');
        }
        pitaj('Uvoz podataka', [
          { tekst: 'Dodaj uz postojeće', vrednost: 'spoji', klasa: 'glavno' },
          { tekst: 'Zameni sve', vrednost: 'zameni', klasa: 'opasno' }
        ]).then(function (izbor) {
          if (!izbor) return;
          try {
            global.DB.uvoz(nalaz.tekst, izbor === 'spoji');
            poruka('Uvezeno.');
            ekranPodesavanja();
          } catch (err) {
            global.alert('Uvoz nije uspeo: ' + err.message);
          }
        });
      };
      if (global.TextDecoder) {
        citac.onerror = function () { global.alert('Datoteka nije pročitana.'); };
        citac.readAsArrayBuffer(f);
      } else {
        citac.readAsText(f);
      }
    });
    app.querySelector('#brisi').addEventListener('click', function () {
      if (!global.confirm('Brišu se SVI igrači i sva testiranja iz ovog pregledača. Nastaviti?')) return;
      if (!global.confirm('Sigurno? Ovo se ne može vratiti bez rezervne kopije.')) return;
      global.DB.uvoz(JSON.stringify({ igraci: [], testovi: [], podesavanja: {} }), false);
      global.DB.obrisiTok();
      poruka('Sve obrisano.');
      ekranPodesavanja();
    });
  }

  function prekidac(k, tekst, vrednost) {
    return '<label class="red" style="gap:10px;margin:12px 0">' +
      '<input type="checkbox" data-k="' + k + '"' + (vrednost ? ' checked' : '') + '>' +
      '<span style="color:var(--tekst)">' + esc(tekst) + '</span></label>';
  }

  /* ---------- start ---------- */

  global.DB.load();
  global.Zvuk.utisaj(!global.DB.podesavanja().zvuk);
  if (!global.location.hash || global.location.hash === '#/tok' || global.location.hash === '#/sazetak') {
    global.location.hash = '#/igraci';
  }
  crtaj();
})(window);
