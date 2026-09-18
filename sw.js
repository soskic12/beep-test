/* Offline rad: aplikacija se drzi u kesu pregledaca, pa radi i bez mreze -
   u sali, na terenu, na iskljucenim podacima. */
var KES = 'beep-test-v1';
var DATOTEKE = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/protocol.js',
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

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (odgovor) {
      if (odgovor) {
        // u pozadini povuci svezu verziju za sledece pokretanje
        fetch(e.request).then(function (sveza) {
          if (sveza && sveza.ok) caches.open(KES).then(function (k) { k.put(e.request, sveza.clone()); });
        }).catch(function () { /* nema mreze - nema veze */ });
        return odgovor;
      }
      return fetch(e.request).then(function (sveza) {
        if (sveza && sveza.ok && e.request.url.indexOf('http') === 0) {
          var kopija = sveza.clone();
          caches.open(KES).then(function (k) { k.put(e.request, kopija); });
        }
        return sveza;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
