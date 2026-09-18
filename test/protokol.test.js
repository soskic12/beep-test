/* Provera racuna protokola: node --test beep-test/test
   (motor testa i ekrani se proveravaju u pregledacu - ovde je samo matematika,
   jer se po njoj upisuju rezultati koji ostaju godinama.) */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

global.window = {};
require(path.join(__dirname, '..', 'js', 'protocol.js'));
const P = global.window.Protocol;

test('tabela nivoa odgovara standardnom 20 m testu', () => {
  assert.strictEqual(P.LEVELS.length, 21);
  assert.strictEqual(P.LEVELS[0].speed, 8.5);
  assert.strictEqual(P.LEVELS[0].shuttles, 7);
  assert.strictEqual(P.LEVELS[20].speed, 18.5);
  assert.strictEqual(P.TOTAL_SHUTTLES, 247);
  // ukupno trajanje ~21:56
  assert.ok(Math.abs(P.TOTAL_TIME - 1316) < 2, 'ukupno vreme ' + P.TOTAL_TIME);
});

test('trajanje deonice je 20 m podeljeno brzinom nivoa', () => {
  assert.ok(Math.abs(P.SHUTTLES[0].duration - 20 / (8.5 / 3.6)) < 1e-9);
  const zadnja = P.SHUTTLES[P.TOTAL_SHUTTLES - 1];
  assert.ok(Math.abs(zadnja.duration - 20 / (18.5 / 3.6)) < 1e-9);
  assert.strictEqual(zadnja.level, 21);
  assert.strictEqual(zadnja.shuttle, 16);
});

test('broj zavrsenih deonica i oznaka nivo.deonica su uzajamni', () => {
  for (let n = 0; n <= P.TOTAL_SHUTTLES; n++) {
    const ls = P.toLevelShuttle(n);
    assert.strictEqual(P.toCompleted(ls.level, ls.shuttle), n, 'n=' + n);
  }
  assert.deepStrictEqual(P.toLevelShuttle(0), { level: 1, shuttle: 0 });
  assert.deepStrictEqual(P.toLevelShuttle(7), { level: 1, shuttle: 7 });
  assert.deepStrictEqual(P.toLevelShuttle(8), { level: 2, shuttle: 1 });
});

test('deonica u toku se odredjuje po proteklom vremenu', () => {
  assert.strictEqual(P.shuttleAt(0).index, 1);
  assert.strictEqual(P.shuttleAt(8.4).index, 1);
  assert.strictEqual(P.shuttleAt(8.6).index, 2);
  assert.strictEqual(P.shuttleAt(P.TOTAL_TIME + 100).index, P.TOTAL_SHUTTLES);
});

test('VO2max po Ramsbottomu prati objavljenu tabelu', () => {
  // objavljene vrednosti: 8.9 -> 43.0, 12.4 -> 54.8, 15.2 -> 64.6
  assert.ok(Math.abs(P.vo2max(8, 9) - 43.0) <= 0.2, String(P.vo2max(8, 9)));
  assert.ok(Math.abs(P.vo2max(12, 4) - 54.8) <= 0.2, String(P.vo2max(12, 4)));
  assert.ok(Math.abs(P.vo2max(15, 2) - 64.6) <= 0.2, String(P.vo2max(15, 2)));
  assert.strictEqual(P.vo2max(1, 0), null, 'bez zavrsene deonice nema procene');
});

test('VO2max po Legeru trazi godine i raste sa nivoom', () => {
  assert.strictEqual(P.vo2maxLeger(10, 5, null), null);
  const a = P.vo2maxLeger(8, 9, 16);
  const b = P.vo2maxLeger(12, 4, 16);
  assert.ok(b > a, a + ' -> ' + b);
  // negativna procena (nizak nivo, odrasla osoba) se ne prikazuje
  assert.strictEqual(P.vo2maxLeger(1, 2, 45), null);
});

test('metri i vreme odgovaraju zavrsenim deonicama', () => {
  assert.strictEqual(P.distanceM(2, 7), 14 * 20);
  assert.ok(Math.abs(P.timeAt(1, 7) - P.SHUTTLES[6].endAt) < 1e-9);
  assert.strictEqual(P.timeAt(1, 0), 0);
});
