/* Motor testiranja: jedan sat, vise igraca.
   Ne zna nista o ekranu - javlja promene preko onPromena. */
(function (global) {
  'use strict';

  var P = global.Protocol;
  var LOOKAHEAD = 2.0;   // koliko sekundi unapred zakazujemo bipove

  function Run(cfg) {
    this.id = cfg.id || global.DB.uid();
    this.naziv = cfg.naziv || '';
    this.datum = cfg.datum || new Date().toISOString();
    this.lokacija = cfg.lokacija || '';
    this.beleska = cfg.beleska || '';
    this.opomena = cfg.opomena !== false;
    this.odbrojavanje = cfg.odbrojavanje == null ? 5 : cfg.odbrojavanje;
    this.najava = cfg.najava !== false;

    this.ucesnici = (cfg.ucesnici || []).map(function (u) {
      return {
        igracId: u.igracId,
        ime: u.ime,
        broj: u.broj || '',
        grupa: u.grupa || '',
        godine: u.godine == null ? null : u.godine,
        status: u.status || 'aktivan',   // aktivan | opomena | ispao | odustao | povreda | zavrsio
        opomenaNa: u.opomenaNa == null ? null : u.opomenaNa,  // zavrsenih deonica u trenutku opomene
        zavrseno: u.zavrseno == null ? null : u.zavrseno,
        beleska: u.beleska || ''
      };
    });

    this.status = 'priprema';   // priprema | odbrojavanje | trci | pauza | gotovo
    this.startCtx = null;       // trenutak (audio sat) kad pocinje deonica 1
    this.pauzaElapsed = 0;
    this.zakazanoDo = 0;
    this.najavljeno = {};
    this.tajmer = null;
    this.onPromena = cfg.onPromena || function () {};
    this.onKraj = cfg.onKraj || function () {};
    this.wallStart = cfg.wallStart || null;
    this.nastavakOd = null;    // sat stoji dok traje odbrojavanje pred nastavak
    this.poslednjiUpis = 0;
  }

  Run.prototype.proteklo = function () {
    if (this.status === 'priprema') return -this.odbrojavanje;
    if (this.status === 'pauza' || this.status === 'gotovo') return this.pauzaElapsed;
    if (this.startCtx == null) return 0;
    // pred nastavak sat stoji na mestu gde je stao, da se deonice ne vrte unazad
    if (this.nastavakOd != null && global.Zvuk.now() < this.nastavakOd) return this.pauzaElapsed;
    return global.Zvuk.now() - this.startCtx;
  };

  Run.prototype.zavrsenoDeonica = function () {
    var t = this.proteklo();
    if (t <= 0) return 0;
    if (t >= P.TOTAL_TIME) return P.TOTAL_SHUTTLES;
    return P.shuttleAt(t).index - 1;
  };

  Run.prototype.trenutna = function () {
    var t = Math.max(0, Math.min(this.proteklo(), P.TOTAL_TIME - 0.001));
    return P.shuttleAt(t);
  };

  Run.prototype.aktivni = function () {
    return this.ucesnici.filter(function (u) {
      return u.status === 'aktivan' || u.status === 'opomena';
    });
  };

  Run.prototype.start = function () {
    global.Zvuk.otkljucaj();
    var n = global.Zvuk.now();
    this.startCtx = n + this.odbrojavanje;
    this.wallStart = Date.now() + this.odbrojavanje * 1000;
    this.status = this.odbrojavanje > 0 ? 'odbrojavanje' : 'trci';
    this.nastavakOd = null;
    this.zakazanoDo = 0;
    this._zakaziOdbrojavanje();
    this._pokreniTajmer();
    this.onPromena(this);
  };

  Run.prototype._zakaziOdbrojavanje = function () {
    var n = global.Zvuk.now();
    for (var k = this.odbrojavanje; k >= 1; k--) {
      var kada = this.startCtx - k;
      if (kada > n) global.Zvuk.bip(kada, 'odbrojavanje');
    }
    global.Zvuk.bip(this.startCtx, 'start');
    if (this.najava) {
      var ms = Math.max(0, (this.startCtx - n) * 1000);
      global.setTimeout(function () { global.Zvuk.izgovori('Nivo jedan'); }, ms + 100);
    }
  };

  Run.prototype._pokreniTajmer = function () {
    var self = this;
    if (this.tajmer) global.clearInterval(this.tajmer);
    this.tajmer = global.setInterval(function () { self.tik(); }, 200);
  };

  Run.prototype.tik = function () {
    if (this.status !== 'trci' && this.status !== 'odbrojavanje') return;
    if (this.nastavakOd != null && global.Zvuk.now() >= this.nastavakOd) this.nastavakOd = null;
    var t = this.proteklo();

    if (this.status === 'odbrojavanje' && t >= 0) this.status = 'trci';

    // zakazivanje bipova unapred - da kasnjenje pregledaca ne pomeri signal
    while (this.zakazanoDo < P.TOTAL_SHUTTLES &&
           P.SHUTTLES[this.zakazanoDo].endAt <= t + LOOKAHEAD) {
      var sh = P.SHUTTLES[this.zakazanoDo];
      var kada = this.startCtx + sh.endAt;
      var sledeci = P.SHUTTLES[this.zakazanoDo + 1];
      if (sledeci && sledeci.levelStart) {
        global.Zvuk.bip(kada, 'nivo');
        this._najaviNivo(sledeci.level, kada);
      } else if (!sledeci) {
        global.Zvuk.bip(kada, 'kraj');
      } else {
        global.Zvuk.bip(kada, 'deonica');
      }
      this.zakazanoDo++;
    }

    if (Date.now() - this.poslednjiUpis > 3000) {
      this.poslednjiUpis = Date.now();
      this._sacuvajTok();
    }

    if (t >= P.TOTAL_TIME) {
      this.zavrsi('kraj-testa');
      return;
    }
    if (this.aktivni().length === 0) {
      this.zavrsi('svi-ispali');
      return;
    }
    this.onPromena(this);
  };

  Run.prototype._najaviNivo = function (nivo, kada) {
    if (!this.najava || this.najavljeno[nivo]) return;
    this.najavljeno[nivo] = true;
    var ms = Math.max(0, (kada - global.Zvuk.now()) * 1000) + 700;
    global.setTimeout(function () { global.Zvuk.izgovori('Nivo ' + nivo); }, ms);
  };

  Run.prototype.pauza = function () {
    if (this.status !== 'trci' && this.status !== 'odbrojavanje') return;
    this.pauzaElapsed = this.proteklo();
    this.status = 'pauza';
    global.Zvuk.otkazi();
    if (this.tajmer) { global.clearInterval(this.tajmer); this.tajmer = null; }
    this.onPromena(this);
  };

  Run.prototype.nastavi = function () {
    if (this.status !== 'pauza') return;
    global.Zvuk.otkljucaj();
    var n = global.Zvuk.now();
    var odbroj = 3;
    this.nastavakOd = n + odbroj;
    this.startCtx = this.nastavakOd - this.pauzaElapsed;
    this.wallStart = Date.now() + odbroj * 1000;
    this.status = this.pauzaElapsed < 0 ? 'odbrojavanje' : 'trci';
    for (var k = odbroj; k >= 1; k--) global.Zvuk.bip(n + (odbroj - k), 'odbrojavanje');
    global.Zvuk.bip(n + odbroj, 'start');
    // sve sto je zakazano pre pauze je otkazano - zakazujemo od tekuce deonice
    this.zakazanoDo = Math.max(0, this.zavrsenoDeonica());
    this._pokreniTajmer();
    this.onPromena(this);
  };

  /* Dodir na plocicu igraca: prvi promasaj = opomena, drugi = ispao.
     Ako su opomene iskljucene, prvi dodir odmah znaci ispao. */
  Run.prototype.oznaci = function (igracId) {
    var u = this._nadji(igracId);
    if (!u) return;
    var zavrseno = this.zavrsenoDeonica();
    if (u.status === 'aktivan' && this.opomena) {
      u.status = 'opomena';
      u.opomenaNa = zavrseno;
    } else if (u.status === 'aktivan' || u.status === 'opomena') {
      u.zavrseno = u.status === 'opomena' && u.opomenaNa != null ? u.opomenaNa : zavrseno;
      u.status = 'ispao';
      u.vremeS = P.timeAt(P.toLevelShuttle(u.zavrseno).level, P.toLevelShuttle(u.zavrseno).shuttle);
    }
    this._sacuvajTok();
    this.onPromena(this);
    if (this.aktivni().length === 0 && this.status !== 'gotovo') this.zavrsi('svi-ispali');
  };

  /* Igrac je stigao na liniju - opomena se brise. */
  Run.prototype.skiniOpomenu = function (igracId) {
    var u = this._nadji(igracId);
    if (!u || u.status !== 'opomena') return;
    u.status = 'aktivan';
    u.opomenaNa = null;
    this._sacuvajTok();
    this.onPromena(this);
  };

  /* Vracanje igraca u trku (pogresan dodir ili nastavlja posle opomene). */
  Run.prototype.vrati = function (igracId) {
    var u = this._nadji(igracId);
    if (!u) return;
    u.status = 'aktivan';
    u.opomenaNa = null;
    u.zavrseno = null;
    u.vremeS = null;
    if (this.status === 'gotovo' && this.proteklo() < P.TOTAL_TIME) {
      // ako je test stao zato sto su svi ispali, moze da se nastavi
      this.status = 'pauza';
    }
    this._sacuvajTok();
    this.onPromena(this);
  };

  /* Odustao / povreda - igrac prekida, ali nije "ispao" po protokolu. */
  Run.prototype.prekini = function (igracId, status) {
    var u = this._nadji(igracId);
    if (!u) return;
    var zavrseno = this.zavrsenoDeonica();
    u.zavrseno = zavrseno;
    u.status = status || 'odustao';
    var ls = P.toLevelShuttle(u.zavrseno);
    u.vremeS = P.timeAt(ls.level, ls.shuttle);
    this._sacuvajTok();
    this.onPromena(this);
    if (this.aktivni().length === 0 && this.status !== 'gotovo') this.zavrsi('svi-ispali');
  };

  Run.prototype.zavrsi = function (razlog) {
    if (this.status === 'gotovo') return;
    this.pauzaElapsed = Math.min(this.proteklo(), P.TOTAL_TIME);
    this.status = 'gotovo';
    this.razlog = razlog || 'rucno';
    if (this.tajmer) { global.clearInterval(this.tajmer); this.tajmer = null; }
    global.Zvuk.otkazi();
    var zavrseno = this.zavrsenoDeonica();
    this.ucesnici.forEach(function (u) {
      if (u.status === 'aktivan' || u.status === 'opomena') {
        u.status = 'zavrsio';
        u.zavrseno = zavrseno;
        var ls = P.toLevelShuttle(u.zavrseno);
        u.vremeS = P.timeAt(ls.level, ls.shuttle);
      }
    });
    this._sacuvajTok();
    this.onPromena(this);
    this.onKraj(this);
  };

  Run.prototype._nadji = function (id) {
    for (var i = 0; i < this.ucesnici.length; i++) {
      if (this.ucesnici[i].igracId === id) return this.ucesnici[i];
    }
    return null;
  };

  /* Rezultati u obliku koji ide u bazu. */
  Run.prototype.rezultati = function () {
    return this.ucesnici.map(function (u) {
      var zavrseno = u.zavrseno == null ? 0 : u.zavrseno;
      var ls = P.toLevelShuttle(zavrseno);
      return {
        igracId: u.igracId,
        ime: u.ime,
        broj: u.broj,
        grupa: u.grupa,
        godine: u.godine,
        nivo: ls.level,
        deonica: ls.shuttle,
        ukupnoDeonica: zavrseno,
        metara: zavrseno * P.DISTANCE_M,
        vremeS: P.timeAt(ls.level, ls.shuttle),
        vo2max: P.vo2max(ls.level, ls.shuttle),
        vo2maxLeger: P.vo2maxLeger(ls.level, ls.shuttle, u.godine),
        status: u.status === 'aktivan' || u.status === 'opomena' ? 'zavrsio' : u.status,
        beleska: u.beleska || ''
      };
    });
  };

  Run.prototype._sacuvajTok = function () {
    global.DB.sacuvajTok({
      id: this.id,
      naziv: this.naziv,
      datum: this.datum,
      lokacija: this.lokacija,
      beleska: this.beleska,
      opomena: this.opomena,
      najava: this.najava,
      odbrojavanje: this.odbrojavanje,
      status: this.status === 'trci' || this.status === 'odbrojavanje' ? 'pauza' : this.status,
      pauzaElapsed: this.proteklo(),
      ucesnici: this.ucesnici,
      sacuvano: Date.now()
    });
  };

  /* Oporavak posle osvezavanja stranice - test se vraca u pauzi. */
  Run.izToka = function (tok, cb) {
    var r = new Run({
      id: tok.id,
      naziv: tok.naziv,
      datum: tok.datum,
      lokacija: tok.lokacija,
      beleska: tok.beleska,
      opomena: tok.opomena,
      najava: tok.najava,
      odbrojavanje: tok.odbrojavanje,
      ucesnici: tok.ucesnici,
      onPromena: cb && cb.onPromena,
      onKraj: cb && cb.onKraj
    });
    r.status = tok.status === 'gotovo' ? 'gotovo' : 'pauza';
    r.pauzaElapsed = tok.pauzaElapsed || 0;
    r.zakazanoDo = Math.max(0, r.zavrsenoDeonica());
    return r;
  };

  global.Run = Run;
})(window);
