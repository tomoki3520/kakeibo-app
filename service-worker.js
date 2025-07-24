const CACHE_NAME = 'kakeibo-app-cache-v1';
const urlsToCache = [
  './', // index.html のルート
  './index.html',
  './style.css', // あなたのCSSファイル
  './icon-192x192.png', // あなたのアイコンファイル
  './icon-512x512.png', // あなたのアイコンファイル
  './icon-maskable-512x512.png', // マスカブルアイコンがある場合 (なければ削除してもOK)
  'https://cdn.jsdelivr.net/npm/chart.js', // Chart.js もキャッシュ
  'https://fonts.googleapis.com/icon?family=Material+Icons' // Material Icons もキャッシュ
];

// Service Worker のインストール時: 静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Cache addAll failed:', error);
      })
  );
});

// リソースのフェッチ時: キャッシュ優先で、なければネットワークから取得
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにリソースがあればそれを利用
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        // キャッシュになければネットワークから取得
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request);
      })
      .catch(error => {
        console.error('Service Worker: Fetch failed:', error);
        // オフライン時にエラーページなどを返すことも可能
        // return caches.match('/offline.html'); // 例: オフラインページ
      })
  );
});

// Service Worker のアクティベート時: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // 現在のキャッシュ名リストにない古いキャッシュを削除
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});