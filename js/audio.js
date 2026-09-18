/* Zvuk: bipovi se prave u pregledacu (Web Audio), nema zvucnih datoteka.
   Sat testa je sat audio konteksta - on ne kasni kad se telefon zamuti. */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var ukljucen = true;
  var zakazani = [];   // zakazani tonovi koji jos nisu odsvirani

  function podrzan() {
    return !!(global.AudioContext || global.webkitAudioContext);
  }

  /* Mora da se pozove iz dodira/klika - inace mobilni pregledaci cute. */
  function otkljucaj() {
    if (!podrzan()) return null;
    if (!ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Sat testa je monotoni sat pregledaca, ne sat audio konteksta:
     ako pregledac ne pusti zvuk, test i dalje tacno tece. */
  function now() {
    return global.performance.now() / 1000;
  }

  function ton(kada, hz, trajanje, jacina) {
    if (!ctx || !ukljucen) return;
    // "kada" je u vremenu testa; prevodimo ga u vreme audio konteksta
    var t = Math.max(ctx.currentTime + 0.001, ctx.currentTime + (kada - now()));
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(jacina || 0.6, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + trajanje);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + trajanje + 0.05);
    zakazani.push({ osc: osc, kraj: t + trajanje + 0.05 });
    if (zakazani.length > 64) ocisti();
  }

  function ocisti() {
    var t = ctx ? ctx.currentTime : 0;
    zakazani = zakazani.filter(function (z) { return z.kraj > t; });
  }

  /* Pauza / zaustavljanje: sve sto je zakazano a nije pocelo - otkazi. */
  function otkazi() {
    if (!ctx) return;
    zakazani.forEach(function (z) {
      try { z.osc.stop(ctx.currentTime); } catch (e) { /* vec zavrsen */ }
    });
    zakazani = [];
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) { /* nema veze */ }
  }

  /* vrste: 'deonica' (kraj deonice), 'nivo' (novi nivo), 'odbrojavanje', 'start', 'kraj' */
  function bip(kada, vrsta) {
    switch (vrsta) {
      case 'nivo':
        ton(kada, 1200, 0.18);
        ton(kada + 0.22, 1200, 0.18);
        ton(kada + 0.44, 1600, 0.35);
        break;
      case 'odbrojavanje':
        ton(kada, 700, 0.12, 0.4);
        break;
      case 'start':
        ton(kada, 1600, 0.5);
        break;
      case 'kraj':
        ton(kada, 900, 0.3);
        ton(kada + 0.35, 700, 0.3);
        ton(kada + 0.7, 500, 0.6);
        break;
      default:
        ton(kada, 1000, 0.22);
    }
  }

  /* Govorna najava nivoa - ako pregledac nema glas, jednostavno cuti. */
  function izgovori(tekst) {
    try {
      if (!global.speechSynthesis || !global.SpeechSynthesisUtterance) return;
      var u = new global.SpeechSynthesisUtterance(tekst);
      u.lang = 'sr-RS';
      u.rate = 1;
      global.speechSynthesis.speak(u);
    } catch (e) { /* nema veze */ }
  }

  function utisaj(da) { ukljucen = !da; }

  function proba() {
    otkljucaj();
    bip(now() + 0.05, 'deonica');
  }

  global.Zvuk = {
    podrzan: podrzan,
    otkljucaj: otkljucaj,
    now: now,
    bip: bip,
    otkazi: otkazi,
    izgovori: izgovori,
    utisaj: utisaj,
    proba: proba,
    kontekst: function () { return ctx; }
  };
})(window);
