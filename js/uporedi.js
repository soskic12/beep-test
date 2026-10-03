/* Poredjenje rezultata - odgovor na pitanje "da li je ovo dobro".

   Ovde nema percentila. Percentil znaci "bolji od 78% populacije", a to trazi
   uzorak koji nemamo. Ono sto imamo je trenerova evidencija, pa se poredi u
   odnosu na nju i to se tako i pise: mesto u grupi, prosek grupe i napredak u
   odnosu na sopstvenu istoriju.

   Kad se dobiju prave norme (sa izvorom, uzorkom i godinom), ulaze u isti
   mehanizam kao jos jedan izvor poredjenja. */
(function (global) {
  'use strict';

  var GODINA_MS = 365 * 24 * 60 * 60 * 1000;

  /* Rezultati jedne vrste testa, po jedan (najbolji) po igracu, iz zadatog
     razdoblja. Podrazumevano poslednjih godinu dana - stariji rezultat vise
     ne govori o tome kakav je igrac danas. */
  function skup(vrstaId, opcije) {
    var o = opcije || {};
    var v = global.Testovi.vrsta(vrstaId);
    var granica = o.odKad || new Date(Date.now() - (o.meseci ? o.meseci / 12 : 1) * GODINA_MS).toISOString();
    var poIgracu = {};

    global.DB.testovi().forEach(function (t) {
      if ((t.vrsta || 'beep') !== vrstaId) return;
      if ((t.datum || '') < granica) return;
      /* Stoperica i foto-celije ne daju isti broj za isto trcanje, pa se
         rezultati merenja razlicitom opremom ne mesaju u istom poredjenju. */
      if (o.nacin && (t.merenje || v.nacini[0]) !== o.nacin) return;
      (t.rezultati || []).forEach(function (r) {
        var vrednost = v.glavna(r);
        if (vrednost == null) return;
        if (o.grupa && (r.grupa || '') !== o.grupa) return;
        var dosad = poIgracu[r.igracId];
        if (!dosad || global.Testovi.bolji(v, vrednost, dosad.vrednost)) {
          poIgracu[r.igracId] = {
            igracId: r.igracId,
            ime: r.ime,
            grupa: r.grupa || '',
            vrednost: vrednost,
            datum: t.datum,
            rezultat: r
          };
        }
      });
    });

    var lista = Object.keys(poIgracu).map(function (k) { return poIgracu[k]; });
    lista.sort(function (a, b) {
      return v.boljeJe === 'manje' ? a.vrednost - b.vrednost : b.vrednost - a.vrednost;
    });
    return lista;
  }

  function prosek(lista) {
    if (!lista.length) return null;
    var zbir = lista.reduce(function (z, x) { return z + x.vrednost; }, 0);
    return zbir / lista.length;
  }

  /* Cime je poslednji put meren ovaj igrac u ovom testu. */
  function nacinIgraca(igracId, vrstaId) {
    var v = global.Testovi.vrsta(vrstaId);
    var svi = global.DB.rezultatiIgraca(igracId, vrstaId);
    if (!svi.length) return v.nacini[0];
    var t = global.DB.test(svi[svi.length - 1].testId);
    return (t && t.merenje) || v.nacini[0];
  }

  /* Gde stoji jedan igrac u svojoj grupi, po jednoj vrsti testa. */
  function zaIgraca(igracId, vrstaId, opcije) {
    var o = opcije || {};
    var igrac = global.DB.igrac(igracId);
    var grupa = o.grupa != null ? o.grupa : (igrac ? igrac.grupa : '');
    /* poredi se sa onima koji su mereni na isti nacin kao i on */
    var mojNacin = o.nacin || nacinIgraca(igracId, vrstaId);
    var lista = skup(vrstaId, { grupa: grupa || null, meseci: o.meseci, nacin: mojNacin });

    var mesto = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].igracId === igracId) { mesto = i; break; }
    }
    if (mesto < 0) return null;

    var v = global.Testovi.vrsta(vrstaId);
    var sredina = prosek(lista);
    var moj = lista[mesto].vrednost;

    return {
      vrsta: v,
      grupa: grupa,
      rang: mesto + 1,
      od: lista.length,
      vrednost: moj,
      rezultat: lista[mesto].rezultat,
      prosek: sredina,
      /* koliko je iznad ili ispod proseka, u jedinici testa i u odnosu na smer */
      odstupanje: sredina == null ? null : moj - sredina,
      boljiOdProseka: sredina == null ? null : global.Testovi.bolji(v, moj, sredina),
      najbolji: lista.length ? lista[0] : null,
      nacin: global.Testovi.nacin(mojNacin)
    };
  }

  /* Samo odnos prema proseku - za mesta gde mesto u grupi vec stoji iznad. */
  function opisProseka(p) {
    if (!p || p.od < 3 || p.odstupanje == null) return '';
    var v = p.vrsta;
    var razlika = Math.abs(p.odstupanje);
    if (razlika < (v.decimala ? Math.pow(10, -v.decimala) : 0.5)) return 'na proseku grupe';
    return (p.boljiOdProseka ? 'bolje' : 'slabije') + ' od proseka za ' +
      global.Testovi.broj(razlika, v.decimala || 0) + (v.jedinica ? ' ' + v.jedinica : '');
  }

  /* Recenica koju trener cita, bez lazne preciznosti. */
  function opis(p) {
    if (!p || !p.od) return '';
    if (p.od < 3) return 'premalo rezultata za poređenje';
    var gde = p.rang + '. od ' + p.od + (p.grupa ? ' · ' + p.grupa : '');
    if (p.odstupanje == null) return gde;
    var razlika = Math.abs(p.odstupanje);
    var v = p.vrsta;
    var kako = p.boljiOdProseka ? 'bolje' : 'slabije';
    if (razlika < (v.decimala ? Math.pow(10, -v.decimala) : 0.5)) {
      return gde + ' · na proseku grupe';
    }
    return gde + ' · ' + kako + ' od proseka za ' +
      global.Testovi.broj(razlika, v.decimala || 0) + (v.jedinica ? ' ' + v.jedinica : '');
  }

  /* Napredak igraca u odnosu na sopstveni prethodni rezultat iste vrste. */
  function napredak(igracId, vrstaId) {
    var svi = global.DB.rezultatiIgraca(igracId, vrstaId);
    if (svi.length < 2) return null;
    var v = global.Testovi.vrsta(vrstaId);
    var sad = v.glavna(svi[svi.length - 1]);
    var pre = v.glavna(svi[svi.length - 2]);
    if (sad == null || pre == null) return null;
    return {
      vrsta: v,
      sad: sad,
      pre: pre,
      razlika: sad - pre,
      bolje: global.Testovi.bolji(v, sad, pre)
    };
  }

  /* Pregled celog testiranja: poredak, prosek i ko je koliko napredovao. */
  function zaTestiranje(testId) {
    var t = global.DB.test(testId);
    if (!t) return null;
    var v = global.Testovi.vrsta(t.vrsta);
    var rezultati = (t.rezultati || []).filter(function (r) { return v.glavna(r) != null; });

    rezultati = rezultati.slice().sort(function (a, b) {
      var x = v.glavna(a), y = v.glavna(b);
      return v.boljeJe === 'manje' ? x - y : y - x;
    });

    var sredina = rezultati.length
      ? rezultati.reduce(function (z, r) { return z + v.glavna(r); }, 0) / rezultati.length
      : null;

    var redovi = rezultati.map(function (r, i) {
      var raniji = global.DB.rezultatiIgraca(r.igracId, t.vrsta)
        .filter(function (x) { return (x.datum || '') < (t.datum || ''); });
      var pomak = null;
      if (raniji.length) {
        var pre = v.glavna(raniji[raniji.length - 1]);
        var sad = v.glavna(r);
        if (pre != null && sad != null) {
          pomak = { razlika: sad - pre, bolje: global.Testovi.bolji(v, sad, pre), pre: pre };
        }
      }
      return { mesto: i + 1, rezultat: r, vrednost: v.glavna(r), pomak: pomak };
    });

    return {
      test: t,
      vrsta: v,
      redovi: redovi,
      prosek: sredina,
      ucesnika: rezultati.length,
      napredovalo: redovi.filter(function (x) { return x.pomak && x.pomak.bolje; }).length,
      nazadovalo: redovi.filter(function (x) { return x.pomak && !x.pomak.bolje && x.pomak.razlika !== 0; }).length
    };
  }

  global.Uporedi = {
    skup: skup,
    prosek: prosek,
    zaIgraca: zaIgraca,
    nacinIgraca: nacinIgraca,
    opis: opis,
    opisProseka: opisProseka,
    napredak: napredak,
    zaTestiranje: zaTestiranje
  };
})(window);
