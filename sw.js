/* Offline rad: aplikacija se drzi u kesu pregledaca, pa radi i bez mreze -
   u sali, na terenu, na iskljucenim podacima. */
var KES = 'beep-test-v5';
var DATOTEKE = [
  './',
  './app.css',
  './manifest.webmanifest',
  './js/protocol.js',
  './js/testovi.js',
  './js/data.js',
  './js/audio.js',
  './js/run.js',
  './js/app.js',
  './icons/ikona.svg',
  './icons/ikona-192.png',
  './icons/ikona-512.png',
  './icons/ikona-maskable-512.png',
  './icons/ikona-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(KES).then(function (k) {
      return Promise.all(DATOTEKE.map(function (d) {
        return k.add(d).catch(function () { /* nedostupna datoteka ne rusi instalaciju */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (imena) {
      return Promise.all(imena.map(function (i) {
        return i === KES ? null : caches.delete(i);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Preusmeren odgovor (kad server /index.html salje na /) navigacija odbija i
   prikazuje "stranica nije dostupna", pa takav odgovor ne ulazi u kes. */
function vredanCuvanja(odgovor) {
  return odgovor && odgovor.ok && !odgovor.redirected;
}

function upisi(zahtev, odgovor) {
  var kopija = odgovor.clone();
  caches.open(KES).then(function (k) { k.put(zahtev, kopija); });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('http') !== 0) return;
  var navigacija = e.request.mode === 'navigate';

  e.respondWith(
    caches.match(e.request).then(function (odgovor) {
      if (odgovor && !(navigacija && odgovor.redirected)) {
        // u pozadini povuci svezu verziju za sledece pokretanje
        fetch(e.request).then(function (sveza) {
          if (vredanCuvanja(sveza)) upisi(e.request, sveza);
        }).catch(function () { /* nema mreze - nema veze */ });
        return odgovor;
      }
      return fetch(e.request).then(function (sveza) {
        if (vredanCuvanja(sveza)) upisi(e.request, sveza);
        return sveza;
      }).catch(function () {
        // bez mreze svaka navigacija dobija pocetnu stranu iz kesa
        return caches.match('./');
      });
    })
  );
});
