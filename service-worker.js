const CACHE_NAME = 'refind-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/js/script.js',
  '/js/api-helper.js',
  '/js/mobile.js',
  '/images/logo.png',
  '/images/background.jpg',
  '/favicon.ico'
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker и удаление старых кэшей
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Перехват запросов и обслуживание из кэша
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если ресурс в кэше, возвращаем его
        if (response) {
          return response;
        }
        
        // Если запрос к API, не кэшируем
        if (event.request.url.includes('/api/')) {
          return fetch(event.request);
        }

        // Клонируем запрос, так как он может быть использован только один раз
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Клонируем ответ, так как он может быть использован только один раз
            const responseToCache = response.clone();
            
            // Добавляем ответ в кэш
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            // Обработка офлайн-режима или ошибок сети
            if (event.request.mode === 'navigate' || 
                (event.request.method === 'GET' && 
                 event.request.headers.get('accept').includes('text/html'))) {
              return caches.match('/offline.html');
            }

            // Возвращаем простую ошибку для других ресурсов
            return new Response('Ресурс недоступен в офлайн-режиме', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Обработка синхронизации фоновых задач
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(
      sendPendingRequests()
    );
  }
});

// Функция для отправки отложенных запросов
function sendPendingRequests() {
  // Здесь будет логика для отправки запросов, сохраненных в IndexedDB
  return Promise.resolve();
}

// Обработка push-уведомлений
self.addEventListener('push', event => {
  const title = 'ReFind.com';
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/images/logo.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
}); 