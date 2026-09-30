// Service Worker: オフラインでもアプリが開けるように、必要なファイルを端末にキャッシュ（保存）する

// ファイルの中身を変更して公開し直すときは、このバージョン名を変えると
// 古いキャッシュが破棄されて新しいファイルに更新される
const CACHE_NAME = 'kinntore-cache-v8';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/db.js',
  './js/utils.js',
  './js/calendar.js',
  './js/monthCalendar.js',
  './js/record.js',
  './js/exercises.js',
  './js/backup.js',
  './icons/app/icon-192.png',
  './icons/app/icon-512.png',
  './icons/app/apple-touch-icon.png',
  './icons/bodyparts/chest.svg',
  './icons/bodyparts/back.svg',
  './icons/bodyparts/shoulder.svg',
  './icons/bodyparts/biceps.svg',
  './icons/bodyparts/triceps.svg',
  './icons/bodyparts/abs.svg',
  './icons/bodyparts/legs.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// キャッシュ優先で返し、キャッシュになければネットワークから取得する
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        }).catch(() => cached)
      );
    })
  );
});
