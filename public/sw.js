const CACHE_NAME = 'Organize_Me-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Lifecycle ───────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (network-first) ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('/')))
  );
});

// ── Push notifications ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Coach Elite', body: 'Vous avez un rappel', urgent: false };
  try { data = { ...data, ...event.data.json() }; } catch {
    try { data.body = event.data.text(); } catch {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 Coach Elite', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `push-${Date.now()}`,
      requireInteraction: data.urgent || false,
      vibrate: data.urgent ? [500, 200, 500, 200, 500] : [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

// ── IndexedDB helper ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('coach-elite-sw', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ── Task checking engine ────────────────────────────────────────────
const SW_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function parseHeureMin(heure) {
  if (!heure) return null;
  const m = heure.match(/(\d+)h(\d*)/);
  if (m) return parseInt(m[1]) * 60 + (parseInt(m[2] || '0') || 0);
  const m2 = heure.match(/(\d+):(\d+)/);
  if (m2) return parseInt(m2[1]) * 60 + parseInt(m2[2]);
  const m3 = heure.match(/^(\d+)$/);
  if (m3) return parseInt(m3[1]) * 60;
  return null;
}

function showNotif(title, body, urgent) {
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `coach-${title.slice(0, 15)}-${Date.now()}`,
    requireInteraction: urgent,
    vibrate: urgent ? [500, 200, 500, 200, 500] : [200, 100, 200],
  });
}

async function checkDueTasks() {
  // Don't fire if a tab is visible — the React app handles it
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.some(c => c.visibilityState === 'visible')) return;

  const store = await idbGet('task-store');
  if (!store || !store.tasks) return;

  const now = new Date();
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const todayName = SW_JOURS[todayIndex];
  const todayISO = now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const minuteKey = now.toISOString().slice(0, 16);

  let sentKeys = (await idbGet('sent-keys')) || [];
  const hasKey = (k) => sentKeys.includes(k);
  const addKey = (k) => { sentKeys.push(k); if (sentKeys.length > 300) sentKeys.splice(0, sentKeys.length - 150); };

  const prefs = store.prefs || {};
  const tasksToday = store.tasks.filter(t => !t.faite);

  for (const task of tasksToday) {
    const taskMin = parseHeureMin(task.heure);
    if (taskMin === null) continue;
    const diff = taskMin - nowMin;
    const isHigh = task.priorite === 'haute' || task.categorie === 'sommeil';

    // 30 min before
    if (prefs.rappel_30min !== false) {
      const k = `sw-30-${task.id}-${minuteKey}`;
      if (diff >= 29 && diff <= 31 && !hasKey(k)) {
        addKey(k);
        showNotif(task.titre, `Dans 30 min — prépare-toi ! ⏰`, false);
      }
    }

    // 15 min before
    if (prefs.rappel_15min !== false) {
      const k = `sw-15-${task.id}-${minuteKey}`;
      if (diff >= 14 && diff <= 16 && !hasKey(k)) {
        addKey(k);
        showNotif(task.titre, `Dans 15 min — prépare-toi ! ⏰`, false);
      }
    }

    // 5 min before
    if (prefs.rappel_5min !== false) {
      const k = `sw-5-${task.id}-${minuteKey}`;
      if (diff >= 4 && diff <= 6 && !hasKey(k)) {
        addKey(k);
        showNotif(task.titre, isHigh ? `⚡ Dans 5 min — PRIORITÉ HAUTE !` : `⚡ Dans 5 min — c'est imminent !`, isHigh);
      }
    }

    // Exact time
    if (prefs.rappel_exact !== false) {
      const k = `sw-exact-${task.id}-${minuteKey}`;
      if (diff >= 0 && diff <= 1 && !hasKey(k)) {
        addKey(k);
        showNotif(task.titre, isHigh ? `🚨 C'est l'heure ! ALARME — agis maintenant !` : `🔔 C'est l'heure — à toi de jouer !`, isHigh);
      }
    }

    // 15 min late
    if (prefs.retard_alerte !== false) {
      const k = `sw-late-${task.id}-${minuteKey}`;
      if (diff <= -14 && diff >= -16 && !hasKey(k)) {
        addKey(k);
        showNotif(`En retard : ${task.titre}`, `Prévu à ${task.heure} — rattrape-toi ! 😤`, true);
      }
    }
  }

  // Calendar notes
  if (store.notes && store.notes.length) {
    const notesToday = store.notes.filter(n => !n.notifie && n.heure_rappel);
    for (const note of notesToday) {
      const noteMin = parseHeureMin(note.heure_rappel);
      if (noteMin === null) continue;
      const diff = noteMin - nowMin;

      const k15 = `sw-note15-${note.id}-${minuteKey}`;
      if (diff >= 14 && diff <= 16 && !hasKey(k15)) {
        addKey(k15);
        showNotif(`📌 ${note.titre}`, `Dans 15 min ⏰`, false);
      }

      const k5 = `sw-note5-${note.id}-${minuteKey}`;
      if (diff >= 4 && diff <= 6 && !hasKey(k5)) {
        addKey(k5);
        showNotif(`📌 ${note.titre}`, `⚡ Dans 5 min !`, false);
      }

      const kExact = `sw-note-${note.id}-${minuteKey}`;
      if (diff >= 0 && diff <= 1 && !hasKey(kExact)) {
        addKey(kExact);
        showNotif(`📌 ${note.titre}`, note.contenu || `C'est l'heure — note du calendrier`, false);
      }
    }
  }

  await idbSet('sent-keys', sentKeys);
}

// ── Periodic Background Sync ────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'task-check') {
    event.waitUntil(checkDueTasks());
  }
});

// ── Message handler (data sync from page) ───────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_DATA') {
    event.waitUntil(idbSet('task-store', event.data.payload));
  }
  if (event.data && event.data.type === 'CHECK_NOW') {
    event.waitUntil(checkDueTasks());
  }
});

// ── Background timer (runs while SW is alive) ──────────────────────
// Fallback pour les navigateurs sans Periodic Sync : vérifie toutes
// les 30s tant que le Service Worker reste actif.
let swCheckTimer = null;
function startBackgroundTimer() {
  if (swCheckTimer) clearInterval(swCheckTimer);
  swCheckTimer = setInterval(() => {
    checkDueTasks().catch(() => {});
  }, 30 * 1000);
}
startBackgroundTimer();
