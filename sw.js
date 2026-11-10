// keeps a copy of the app so it opens without internet
// change the version when you update files so phones get the new ones
const VERSION = 'pocketdoc-v4';

const FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/main.js',
  'js/util.js',
  'js/tools/images-to-pdf.js',
  'js/tools/text-to-pdf.js',
  'js/tools/merge.js',
  'js/tools/split.js',
  'js/tools/organize.js',
  'js/tools/compress.js',
  'js/tools/page-numbers.js',
  'js/tools/watermark.js',
  'js/tools/sign.js',
  'js/tools/metadata.js',
  'js/tools/pdf-to-images.js',
  'js/tools/pdf-to-text.js',
  'js/tools/ocr.js',
  'js/tools/image-convert.js',
  'vendor/pdf-lib.min.js',
  'vendor/jszip.min.js',
  'vendor/pdf.min.mjs',
  'vendor/pdf.worker.min.mjs'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// try the network first so updates show up, use the cache when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
