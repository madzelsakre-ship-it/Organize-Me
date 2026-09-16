const CACHE_NAME = 'coach-elite-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];


/*
 * -----------------------------------------
 * INSTALLATION
 * -----------------------------------------
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(() => {})
  );

  self.skipWaiting();
});


/*
 * -----------------------------------------
 * ACTIVATION
 * -----------------------------------------
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter(
              (key) => key !== CACHE_NAME
            )
            .map((key) =>
              caches.delete(key)
            )
        );
      })
      .then(() => self.clients.claim())
  );
});


/*
 * -----------------------------------------
 * FETCH
 * -----------------------------------------
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(
              event.request,
              clone
            );
          })
          .catch(() => {});

        return response;
      })
      .catch(() => {
        return caches.match(
          event.request
        );
      })
  );
});


/*
 * -----------------------------------------
 * NOTIFICATION PUSH
 * -----------------------------------------
 */
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch {
    data = {
      title: '🔔 Notification',
      body: event.data
        ? event.data.text()
        : 'Nouvelle notification',
    };
  }

  const title =
    data.title ||
    '🔔 Coach Elite';

  const options = {
    body:
      data.body ||
      'Tu as une notification.',
    icon:
      data.icon ||
      '/favicon.ico',
    badge:
      data.badge ||
      '/favicon.ico',
    tag:
      data.tag ||
      `push-${Date.now()}`,
    requireInteraction:
      Boolean(data.requireInteraction),
    data: {
      url:
        data.url ||
        '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});


/*
 * -----------------------------------------
 * CLIC SUR NOTIFICATION
 * -----------------------------------------
 */
self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close();

    const url =
      event.notification?.data?.url ||
      '/';

    event.waitUntil(
      self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {

        /*
         * Si l'application est déjà ouverte,
         * on la remet au premier plan.
         */
        for (const client of clientList) {
          if (
            'focus' in client
          ) {
            return client.focus();
          }
        }

        /*
         * Sinon on ouvre l'application.
         */
        if (
          self.clients.openWindow
        ) {
          return self.clients.openWindow(
            url
          );
        }

        return undefined;
      })
    );
  }
);


/*
 * =========================================
 * INDEXED DB
 * =========================================
 */

const DB_NAME = 'coach-elite-sw';
const DB_VERSION = 1;
const STORE_NAME = 'kv';


function openDB() {
  return new Promise(
    (resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onupgradeneeded = () => {
        const db =
          request.result;

        if (
          !db.objectStoreNames.contains(
            STORE_NAME
          )
        ) {
          db.createObjectStore(
            STORE_NAME
          );
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    }
  );
}


async function idbGet(key) {
  try {
    const db = await openDB();

    return await new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            STORE_NAME,
            'readonly'
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        const request =
          store.get(key);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      }
    );
  } catch {
    return null;
  }
}


async function idbSet(
  key,
  value
) {
  try {
    const db = await openDB();

    return await new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            STORE_NAME,
            'readwrite'
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        const request =
          store.put(
            value,
            key
          );

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(request.error);
        };
      }
    );
  } catch {
    return false;
  }
}


/*
 * =========================================
 * OUTILS
 * =========================================
 */

function localISODate(
  date = new Date()
) {
  const y =
    date.getFullYear();

  const m =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const d =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${y}-${m}-${d}`;
}


function getDayName(
  date = new Date()
) {
  const days = [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ];

  return days[
    date.getDay()
  ];
}


function parseHeureMin(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === 'number'
  ) {
    const h =
      Math.floor(value);

    const m =
      Math.round(
        (value - h) * 60
      );

    if (
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {
      return h * 60 + m;
    }

    return null;
  }

  const str =
    String(value)
      .trim()
      .toLowerCase()
      .replace(/\s/g, '');

  let match =
    str.match(
      /^(\d{1,2})h(\d{1,2})?$/
    );

  if (match) {
    const h =
      Number(match[1]);

    const m =
      Number(match[2] || 0);

    if (
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {
      return h * 60 + m;
    }

    return null;
  }

  match =
    str.match(
      /^(\d{1,2}):(\d{1,2})$/
    );

  if (match) {
    const h =
      Number(match[1]);

    const m =
      Number(match[2]);

    if (
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {
      return h * 60 + m;
    }

    return null;
  }

  if (
    /^\d{1,2}$/.test(str)
  ) {
    const h =
      Number(str);

    if (
      h >= 0 &&
      h <= 23
    ) {
      return h * 60;
    }
  }

  return null;
}


function getTitle(item) {
  return (
    item?.titre ||
    item?.title ||
    item?.nom ||
    item?.texte ||
    item?.description ||
    'Tâche'
  );
}


function getTime(item) {
  return (
    item?.heure ||
    item?.time ||
    item?.heure_debut ||
    item?.start_time ||
    item?.debut ||
    null
  );
}


function getDay(item) {
  return (
    item?.jour ||
    item?.day ||
    item?.date_jour ||
    null
  );
}


function getId(
  item,
  fallback = 'item'
) {
  return (
    item?.id ||
    item?._id ||
    item?.uuid ||
    `${fallback}-${getTitle(item)}-${getTime(item)}`
  );
}


/*
 * =========================================
 * NOTIFICATION
 * =========================================
 */

async function showNotif(
  title,
  body,
  options = {}
) {
  try {
    await self.registration.showNotification(
      title,
      {
        body,
        icon:
          options.icon ||
          '/favicon.ico',
        badge:
          options.badge ||
          '/favicon.ico',
        tag:
          options.tag ||
          `coach-${Date.now()}`,
        requireInteraction:
          Boolean(
            options.requireInteraction
          ),
        renotify: true,
        data: {
          url:
            options.url ||
            '/',
        },
      }
    );
  } catch (error) {
    console.error(
      'Erreur notification SW :',
      error
    );
  }
}


/*
 * =========================================
 * PRÉFÉRENCES PAR DÉFAUT
 * =========================================
 */

const DEFAULT_PREFS = {
  rappel_avant: 10,
  rappel_30min: true,
  rappel_15min: true,
  rappel_5min: true,
  rappel_exact: true,
  retard_alerte: true,
};


/*
 * =========================================
 * VÉRIFICATION DES TÂCHES
 * =========================================
 */

async function checkDueTasks() {

  /*
   * Si l'application est ouverte
   * dans une fenêtre visible, React
   * s'occupe des notifications.
   *
   * Cela évite les doublons.
   */
  try {
    const clients =
      await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

    const visibleClient =
      clients.some(
        (client) =>
          client.visibilityState ===
          'visible'
      );

    if (visibleClient) {
      return;
    }
  } catch {
    // On continue
  }


  const store =
    await idbGet('task-store');

  if (!store) {
    return;
  }


  const now =
    new Date();

  const todayISO =
    localISODate(now);

  const todayName =
    getDayName(now);

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();


  const prefs = {
    ...DEFAULT_PREFS,
    ...(store.prefs || {}),
  };


  const tasks =
    Array.isArray(store.tasks)
      ? store.tasks
      : [];


  const notes =
    Array.isArray(store.notes)
      ? store.notes
      : [];


  /*
   * Les tâches reçues par React sont normalement
   * déjà celles du jour.
   *
   * On filtre quand même par jour pour
   * plus de sécurité.
   */
  const tasksToday =
    tasks.filter((task) => {

      if (task.faite === true) {
        return false;
      }

      const day =
        getDay(task);

      if (!day) {
        return true;
      }

      return (
        day === todayName ||
        day === todayISO
      );
    });


  const sentKeys =
    Array.isArray(
      store.sentKeys
    )
      ? store.sentKeys
      : [];


  /*
   * On limite la taille du tableau.
   */
  let sent =
    sentKeys.slice(-1000);


  function hasSent(key) {
    return sent.includes(key);
  }


  function markSent(key) {
    if (!sent.includes(key)) {
      sent.push(key);
    }
  }


  /*
   * -----------------------------------------
   * TÂCHES
   * -----------------------------------------
   */
  for (const task of tasksToday) {

    const time =
      getTime(task);

    const taskMin =
      parseHeureMin(time);

    if (
      taskMin === null
    ) {
      continue;
    }


    const diff =
      taskMin -
      currentMinutes;


    const id =
      getId(task, 'task');

    const title =
      getTitle(task);


    /*
     * IMPORTANT :
     *
     * La clé est basée sur l'heure
     * de la tâche et non sur l'heure
     * actuelle.
     *
     * Cela empêche les doublons.
     */
    const baseKey =
      `${todayISO}-${id}-${taskMin}`;


    /*
     * Rappel personnalisé
     */
    if (
      prefs.rappel_avant > 0 &&
      ![5, 15, 30].includes(
        Number(
          prefs.rappel_avant
        )
      ) &&
      diff === Number(
        prefs.rappel_avant
      )
    ) {

      const key =
        `custom-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '⏰ Rappel',
          `${title} commence dans ${prefs.rappel_avant} min.`,
          {
            tag: key,
          }
        );
      }
    }


    /*
     * 30 minutes
     */
    if (
      prefs.rappel_30min &&
      diff === 30
    ) {

      const key =
        `30-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '⏳ Dans 30 minutes',
          title,
          {
            tag: key,
          }
        );
      }
    }


    /*
     * 15 minutes
     */
    if (
      prefs.rappel_15min &&
      diff === 15
    ) {

      const key =
        `15-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '⏳ Dans 15 minutes',
          title,
          {
            tag: key,
          }
        );
      }
    }


    /*
     * 5 minutes
     */
    if (
      prefs.rappel_5min &&
      diff === 5
    ) {

      const key =
        `5-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '🚨 Dans 5 minutes',
          title,
          {
            tag: key,
            requireInteraction: true,
          }
        );
      }
    }


    /*
     * Heure exacte
     */
    if (
      prefs.rappel_exact &&
      diff === 0
    ) {

      const key =
        `exact-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '🔔 C’est l’heure',
          title,
          {
            tag: key,
            requireInteraction: true,
          }
        );
      }
    }


    /*
     * Retard 15 minutes
     */
    if (
      prefs.retard_alerte &&
      diff === -15
    ) {

      const key =
        `late15-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '⚠️ Tâche en retard',
          `${title} devait commencer il y a 15 minutes.`,
          {
            tag: key,
          }
        );
      }
    }


    /*
     * Retard 60 minutes
     */
    if (
      prefs.retard_alerte &&
      diff === -60 &&
      (
        task.priorite === 'haute' ||
        task.priorite === 'urgent'
      )
    ) {

      const key =
        `late60-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '🚨 Retard important',
          `${title} est en retard depuis 1 heure.`,
          {
            tag: key,
            requireInteraction: true,
          }
        );
      }
    }
  }


  /*
   * -----------------------------------------
   * NOTES CALENDRIER
   * -----------------------------------------
   */
  for (const note of notes) {

    if (
      note.date !== todayISO ||
      note.notifie === true
    ) {
      continue;
    }


    const time =
      getTime(note);

    const noteMin =
      parseHeureMin(time);

    if (
      noteMin === null
    ) {
      continue;
    }


    const diff =
      noteMin -
      currentMinutes;


    const id =
      getId(note, 'note');

    const title =
      getTitle(note);


    const baseKey =
      `${todayISO}-${id}-${noteMin}`;


    if (diff === 15) {

      const key =
        `note15-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '📝 Dans 15 minutes',
          title,
          {
            tag: key,
          }
        );
      }
    }


    if (diff === 5) {

      const key =
        `note5-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '📝 Dans 5 minutes',
          title,
          {
            tag: key,
            requireInteraction: true,
          }
        );
      }
    }


    if (diff === 0) {

      const key =
        `noteExact-${baseKey}`;

      if (!hasSent(key)) {

        markSent(key);

        await showNotif(
          '📝 Note calendrier',
          title,
          {
            tag: key,
          }
        );
      }
    }
  }


  /*
   * Sauvegarde anti-doublons
   */
  await idbSet(
    'task-store',
    {
      ...store,
      sentKeys: sent.slice(-1000),
    }
  );
}


/*
 * =========================================
 * PERIODIC BACKGROUND SYNC
 * =========================================
 */

self.addEventListener(
  'periodicsync',
  (event) => {

    if (
      event.tag === 'task-check'
    ) {
      event.waitUntil(
        checkDueTasks()
      );
    }
  }
);


/*
 * =========================================
 * MESSAGES DE L'APPLICATION
 * =========================================
 */

self.addEventListener(
  'message',
  (event) => {

    const data =
      event.data || {};


    /*
     * React envoie les tâches
     * et les préférences.
     */
    if (
      data.type === 'SYNC_DATA'
    ) {

      const payload =
        data.payload || {};


      event.waitUntil(
        idbGet('task-store')
          .then((oldStore) => {

            return idbSet(
              'task-store',
              {
                tasks:
                  payload.tasks ||
                  [],
                notes:
                  payload.notes ||
                  [],
                prefs:
                  {
                    ...DEFAULT_PREFS,
                    ...(payload.prefs ||
                      {}),
                  },

                /*
                 * On conserve les clés
                 * déjà envoyées.
                 */
                sentKeys:
                  oldStore?.sentKeys ||
                  [],
              }
            );
          })
          .catch(() => {})
      );

      return;
    }


    /*
     * Vérification immédiate.
     */
    if (
      data.type === 'CHECK_NOW'
    ) {

      event.waitUntil(
        checkDueTasks()
      );

      return;
    }


    /*
     * Forcer activation immédiate.
     */
    if (
      data.type === 'SKIP_WAITING'
    ) {

      self.skipWaiting();

      return;
    }
  }
);


/*
 * =========================================
 * TIMER DE SECOURS
 * =========================================
 *
 * Attention :
 * Un navigateur peut arrêter complètement
 * un Service Worker lorsqu'il n'en a plus besoin.
 *
 * Ce timer est donc un FALLBACK,
 * pas une garantie d'alarme native.
 */

setInterval(
  () => {
    checkDueTasks()
      .catch(() => {});
  },
  30 * 1000
);