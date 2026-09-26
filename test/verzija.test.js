/* Provera verzije: node --test test/verzija.test.js
   Broj verzije stoji na dva mesta - u app.js (pise u Podesavanjima) i u sw.js
   (ime kesa, po kom pregledac zna da je stigla nova verzija). Ako se razidju,
   trener u aplikaciji vidi jedan broj a offline kes je drugi, pa se ne zna sta
   zapravo radi na telefonu. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function procitaj(ime) {
  return fs.readFileSync(path.join(__dirname, '..', ime), 'utf8');
}

test('app.js i sw.js govore istu verziju', () => {
  const uApp = procitaj(path.join('js', 'app.js')).match(/var VERZIJA = '([^']+)'/);
  const uSw = procitaj('sw.js').match(/var KES = 'beep-test-(v\d+)'/);

  assert.ok(uApp, 'app.js nema VERZIJA');
  assert.ok(uSw, 'sw.js nema ime kesa oblika beep-test-vN');
  assert.strictEqual(uApp[1], uSw[1],
    'app.js kaze ' + uApp[1] + ', a kes je ' + uSw[1] + ' - podigni oba');
});

test('service worker kesira sve datoteke koje stranica ucitava', () => {
  const index = procitaj('index.html');
  const sw = procitaj('sw.js');

  const skripte = [];
  index.replace(/<script src="([^"]+)"/g, (ceo, put) => { skripte.push(put); return ceo; });
  assert.ok(skripte.length >= 5, 'nadjeno skripti: ' + skripte.length);

  skripte.forEach((put) => {
    assert.ok(sw.indexOf("'./" + put + "'") >= 0,
      put + ' se ucitava u index.html, a nije u spisku za offline kes');
  });

  const css = index.match(/<link rel="stylesheet" href="([^"]+)"/);
  assert.ok(sw.indexOf("'./" + css[1] + "'") >= 0, css[1] + ' nije u kesu');
});

test('stranica se sama osvezava kad nova verzija preuzme', () => {
  const index = procitaj('index.html');
  assert.ok(index.indexOf('controllerchange') >= 0,
    'bez toga trener gleda staru verziju dok ne otvori aplikaciju jos jednom');
  assert.ok(index.indexOf("=== '#/tok'") >= 0,
    'osvezavanje mora da preskoci testiranje u toku, da ne prekine merenje');
});
