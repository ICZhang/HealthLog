// Minimal Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    console.log('Service Worker active!');
  });
  
  self.addEventListener('fetch', (event) => {
    // Pass network requests through normally
    event.respondWith(fetch(event.request));
  });