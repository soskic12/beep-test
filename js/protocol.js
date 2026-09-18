/* Protokol 20m beep testa (multi-stage fitness test, Leger).
   Tabela nivoa: brzina u km/h i broj deonica (shuttle) po nivou. */
(function (global) {
  'use strict';

  var LEVELS = [
    { level: 1, speed: 8.5, shuttles: 7 },
    { level: 2, speed: 9.0, shuttles: 8 },
    { level: 3, speed: 9.5, shuttles: 8 },
    { level: 4, speed: 10.0, shuttles: 9 },
    { level: 5, speed: 10.5, shuttles: 9 },
    { level: 6, speed: 11.0, shuttles: 10 },
    { level: 7, speed: 11.5, shuttles: 10 },
    { level: 8, speed: 12.0, shuttles: 11 },
    { level: 9, speed: 12.5, shuttles: 11 },
    { level: 10, speed: 13.0, shuttles: 11 },
    { level: 11, speed: 13.5, shuttles: 12 },
    { level: 12, speed: 14.0, shuttles: 12 },
    { level: 13, speed: 14.5, shuttles: 13 },
    { level: 14, speed: 15.0, shuttles: 13 },
    { level: 15, speed: 15.5, shuttles: 13 },
    { level: 16, speed: 16.0, shuttles: 14 },
    { level: 17, speed: 16.5, shuttles: 14 },
    { level: 18, speed: 17.0, shuttles: 15 },
    { level: 19, speed: 17.5, shuttles: 15 },
    { level: 20, speed: 18.0, shuttles: 16 },
    { level: 21, speed: 18.5, shuttles: 16 }
  ];

  var DISTANCE_M = 20;

  /* Deonice redom, sa apsolutnim vremenom kraja svake od njih.
     index 0 = prva deonica nivoa 1. */
  function buildShuttles(distance) {
    var d = distance || DISTANCE_M;
    var out = [];
    var t = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      var lv = LEVELS[i];
      var dur = d / (lv.speed / 3.6); // sekundi po deonici
      for (var s = 1; s <= lv.shuttles; s++) {
        t += dur;
        out.push({
          index: out.length + 1, // ukupan redni broj deonice, 1-based
          level: lv.level,
          shuttle: s,
          speed: lv.speed,
          duration: dur,
          startAt: t - dur,
          endAt: t,
          levelStart: s === 1
        });
      }
    }
    return out;
  }

  var SHUTTLES = buildShuttles(DISTANCE_M);
  var TOTAL_SHUTTLES = SHUTTLES.length;
  var TOTAL_TIME = SHUTTLES[TOTAL_SHUTTLES - 1].endAt;

  /* Deonica koja je u toku u trenutku t (sekundi od starta). */
  function shuttleAt(t) {
    if (t < 0) return SHUTTLES[0];
    for (var i = 0; i < SHUTTLES.length; i++) {
      if (t < SHUTTLES[i].endAt) return SHUTTLES[i];
    }
    return SHUTTLES[SHUTTLES.length - 1];
  }

  /* Broj zavrsenih deonica -> {level, shuttle}. 0 zavrsenih = 1.0 */
  function toLevelShuttle(completed) {
    var c = Math.max(0, Math.min(TOTAL_SHUTTLES, Math.round(completed)));
    if (c === 0) return { level: 1, shuttle: 0 };
    var sh = SHUTTLES[c - 1];
    return { level: sh.level, shuttle: sh.shuttle };
  }

  /* {level, shuttle} -> broj zavrsenih deonica */
  function toCompleted(level, shuttle) {
    if (!level || shuttle <= 0) return 0;
    var n = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].level === level) return n + Math.min(shuttle, LEVELS[i].shuttles);
      n += LEVELS[i].shuttles;
    }
    return n;
  }

  function levelInfo(level) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].level === level) return LEVELS[i];
    }
    return null;
  }

  /* VO2max (ml/kg/min) po Ramsbottom-u - ne trazi godine, vazi i za odrasle:
     3.46 * (L + S / (L*0.4325 + 7.0048)) + 12.2 */
  function vo2max(level, shuttle) {
    var completed = toCompleted(level, shuttle);
    if (completed <= 0) return null;
    var ls = toLevelShuttle(completed);
    var v = 3.46 * (ls.level + ls.shuttle / (ls.level * 0.4325 + 7.0048)) + 12.2;
    return Math.round(v * 10) / 10;
  }

  /* VO2max po Leger-u - trazi godine, uobicajen za uzrasne kategorije:
     31.025 + 3.238*S - 3.248*A + 0.1536*S*A
     S = brzina poslednjeg zavrsenog nivoa (km/h), A = godine. */
  function vo2maxLeger(level, shuttle, age) {
    if (!age || age <= 0) return null;
    var completed = toCompleted(level, shuttle);
    if (completed <= 0) return null;
    var ls = toLevelShuttle(completed);
    var info = levelInfo(ls.level);
    if (!info) return null;
    var s = info.speed;
    var v = 31.025 + 3.238 * s - 3.248 * age + 0.1536 * s * age;
    return v > 0 ? Math.round(v * 10) / 10 : null;
  }

  function distanceM(level, shuttle) {
    return toCompleted(level, shuttle) * DISTANCE_M;
  }

  function fmtLevel(level, shuttle) {
    return level + '.' + shuttle;
  }

  /* Vreme trcanja do kraja zadate deonice (sekunde). */
  function timeAt(level, shuttle) {
    var c = toCompleted(level, shuttle);
    if (c <= 0) return 0;
    return SHUTTLES[c - 1].endAt;
  }

  global.Protocol = {
    LEVELS: LEVELS,
    SHUTTLES: SHUTTLES,
    TOTAL_SHUTTLES: TOTAL_SHUTTLES,
    TOTAL_TIME: TOTAL_TIME,
    DISTANCE_M: DISTANCE_M,
    shuttleAt: shuttleAt,
    toLevelShuttle: toLevelShuttle,
    toCompleted: toCompleted,
    levelInfo: levelInfo,
    vo2max: vo2max,
    vo2maxLeger: vo2maxLeger,
    distanceM: distanceM,
    fmtLevel: fmtLevel,
    timeAt: timeAt
  };
})(window);
