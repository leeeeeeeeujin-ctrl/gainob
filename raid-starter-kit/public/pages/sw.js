// sw.js - safe PWA service worker for deployment
const CACHE_VERSION = 'rsk-static-v1';
const STATIC_ASSETS = [
  '/styles/base.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
  // 필요하면 core/component 경로 추가: '/core/store.js', '/components/chat-ai.js', ...
].filter(Boolean);

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS).catch(()=>{}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // 네비게이션(페이지 요청)은 네트워크 우선 -> 최신 HTML 보장
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => res).catch(() =>
        caches.match('/offline.html').then(r => r || new Response('<!doctype html><meta charset="utf-8"><title>오프라인</title><p>오프라인입니다.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
      )
    );
    return;
  }

  // 정적 리소스는 캐시 우선
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        try { const copy = networkRes.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(()=>{}); } catch(_) {}
        return networkRes;
      }).catch(()=>cached);
    })
  );
});
