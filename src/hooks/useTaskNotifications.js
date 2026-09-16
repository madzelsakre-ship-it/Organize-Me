import { useEffect, useRef } from 'react';
import { base44 } from '@/api/supabaseClient';

export const JOURS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche'
];

export const DEFAULT_PREFS = {
  rappel_avant: 10,
  rappel_30min: true,
  rappel_15min: true,
  rappel_5min: true,
  rappel_exact: true,
  rappel_programme: true,
  bilan_midi: true,
  bilan_soir: true,
  retard_alerte: true,
  heure_bilan_soir: 18,
};

const REPAS_CAT = [
  'repas',
  'alimentation',
  'déjeuner',
  'dîner',
  'petit-déjeuner',
];

const REPAS_KEYWORDS = [
  'manger',
  'repas',
  'déjeuner',
  'diner',
  'dîner',
  'petit déjeuner',
  'petit-déjeuner',
  'déjeuner',
];

const ALARME_CAT = [
  'alarme',
  'urgent',
  'urgence',
  'important',
];

const ALARME_KEYWORDS = [
  'alarme',
  'urgent',
  'urgence',
  'réveil',
  'reveil',
];

function getPrefs() {
  try {
    const saved = localStorage.getItem('notif-prefs');

    if (!saved) {
      return { ...DEFAULT_PREFS };
    }

    return {
      ...DEFAULT_PREFS,
      ...JSON.parse(saved),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotifPrefs(prefs) {
  try {
    localStorage.setItem(
      'notif-prefs',
      JSON.stringify({
        ...DEFAULT_PREFS,
        ...prefs,
      })
    );
  } catch {
    // Rien à faire si localStorage n'est pas disponible
  }
}

function parseHeureMin(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return h * 60 + m;
    }

    return null;
  }

  const str = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s/g, '');

  let match = str.match(/^(\d{1,2})h(\d{1,2})?$/);

  if (match) {
    const h = Number(match[1]);
    const m = Number(match[2] || 0);

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return h * 60 + m;
    }

    return null;
  }

  match = str.match(/^(\d{1,2}):(\d{1,2})$/);

  if (match) {
    const h = Number(match[1]);
    const m = Number(match[2]);

    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return h * 60 + m;
    }

    return null;
  }

  if (/^\d{1,2}$/.test(str)) {
    const h = Number(str);

    if (h >= 0 && h <= 23) {
      return h * 60;
    }
  }

  return null;
}

function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

function getDayName(date = new Date()) {
  const index = date.getDay();

  // JavaScript : dimanche = 0
  if (index === 0) return 'Dimanche';

  return JOURS[index - 1];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isRepas(item) {
  const category = normalizeText(
    item?.categorie || item?.category || item?.type || ''
  );

  const title = normalizeText(
    item?.titre ||
    item?.title ||
    item?.nom ||
    item?.texte ||
    item?.description ||
    ''
  );

  return (
    REPAS_CAT.some((x) => category.includes(normalizeText(x))) ||
    REPAS_KEYWORDS.some((x) => title.includes(normalizeText(x)))
  );
}

function isAlarme(item) {
  const category = normalizeText(
    item?.categorie || item?.category || item?.type || ''
  );

  const title = normalizeText(
    item?.titre ||
    item?.title ||
    item?.nom ||
    item?.texte ||
    item?.description ||
    ''
  );

  return (
    ALARME_CAT.some((x) => category.includes(normalizeText(x))) ||
    ALARME_KEYWORDS.some((x) => title.includes(normalizeText(x)))
  );
}

function getItemTitle(item) {
  return (
    item?.titre ||
    item?.title ||
    item?.nom ||
    item?.texte ||
    item?.description ||
    'Tâche'
  );
}

function getItemTime(item) {
  return (
    item?.heure ||
    item?.time ||
    item?.heure_debut ||
    item?.start_time ||
    item?.debut ||
    null
  );
}

function getItemDay(item) {
  return (
    item?.jour ||
    item?.day ||
    item?.date_jour ||
    null
  );
}

function getItemId(item, fallback = 'item') {
  return (
    item?.id ||
    item?._id ||
    item?.uuid ||
    `${fallback}-${getItemTitle(item)}-${getItemTime(item)}`
  );
}

function playAlarm(type = 'normal') {
  try {
    if (navigator.vibrate) {
      if (type === 'urgent' || type === 'alarm') {
        navigator.vibrate([400, 150, 400, 150, 600]);
      } else if (type === 'warning') {
        navigator.vibrate([300, 150, 300]);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    }
  } catch {
    // Vibration non disponible
  }

  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const ctx = new AudioContext();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    let frequency = 700;

    if (type === 'urgent' || type === 'alarm') {
      frequency = 950;
    } else if (type === 'warning') {
      frequency = 800;
    } else if (type === 'repas') {
      frequency = 600;
    } else if (type === 'success') {
      frequency = 1000;
    }

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.25,
      ctx.currentTime + 0.02
    );

    oscillator.start();

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.45
    );

    oscillator.stop(ctx.currentTime + 0.5);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // Rien
      }
    }, 700);
  } catch {
    // Audio non disponible ou bloqué
  }
}

async function sendNotification(
  title,
  body,
  options = {}
) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const {
    alarmType = 'normal',
    requireInteraction = false,
    tag,
    icon = '/favicon.ico',
  } = options;

  const notificationOptions = {
    body,
    icon,
    badge: icon,
    requireInteraction,
    tag,
    renotify: true,
  };

  try {
    /*
     * Sur mobile, le Service Worker est souvent plus fiable
     * que new Notification().
     */
    if ('serviceWorker' in navigator) {
      try {
        const registration =
          await navigator.serviceWorker.ready;

        if (registration?.showNotification) {
          await registration.showNotification(
            title,
            notificationOptions
          );

          playAlarm(alarmType);
          return;
        }
      } catch {
        // On passe au fallback
      }
    }

    const notification = new Notification(
      title,
      notificationOptions
    );

    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
      } catch {
        // Rien
      }
    };

    playAlarm(alarmType);
  } catch {
    // Notification bloquée
  }
}

function saveOfflineData(data) {
  try {
    localStorage.setItem(
      'coach-offline-data',
      JSON.stringify({
        ...data,
        savedAt: Date.now(),
      })
    );
  } catch {
    // localStorage indisponible
  }
}

function getOfflineData() {
  try {
    const raw = localStorage.getItem(
      'coach-offline-data'
    );

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function syncServiceWorker(payload) {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const worker =
      navigator.serviceWorker.controller ||
      registration.active;

    if (!worker) return;

    worker.postMessage({
      type: 'SYNC_DATA',
      payload,
    });
  } catch (error) {
    console.warn(
      'Synchronisation Service Worker impossible :',
      error
    );
  }
}

export default function useTaskNotifications() {
  const notifiedRef = useRef(new Set());
  const intervalRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAll() {
      if (cancelled || runningRef.current) {
        return;
      }

      runningRef.current = true;

      try {
        const now = new Date();

        const todayName = getDayName(now);
        const todayISO = localISODate(now);

        const currentMinutes =
          now.getHours() * 60 + now.getMinutes();

        let taches = [];
        let programmes = [];
        let habitudes = [];
        let notes = [];
        let rappels = [];

        try {
          const results = await Promise.all([
            base44.entities.Tache.list(
              '-created_date',
              200
            ),
            base44.entities.Programme.list(
              '-created_date',
              20
            ),
            base44.entities.Habitude.list(
              '-created_date',
              100
            ),
            base44.entities.NoteCalendrier.list(
              '-date',
              200
            ),
            base44.entities.Rappel.list(
              '-created_date',
              100
            ),
          ]);

          taches = results[0] || [];
          programmes = results[1] || [];
          habitudes = results[2] || [];
          notes = results[3] || [];
          rappels = results[4] || [];

          saveOfflineData({
            taches,
            programmes,
            habitudes,
            notes,
            rappels,
          });
        } catch (error) {
          console.warn(
            'Chargement en ligne impossible, utilisation du cache.',
            error
          );

          const offline = getOfflineData();

          if (offline) {
            taches = offline.taches || [];
            programmes = offline.programmes || [];
            habitudes = offline.habitudes || [];
            notes = offline.notes || [];
            rappels = offline.rappels || [];
          }
        }

        if (cancelled) return;

        const prefs = {
          ...DEFAULT_PREFS,
          ...getPrefs(),
        };

        /*
         * Seules les tâches du jour sont envoyées au Service Worker.
         */
        const tasksToday = taches.filter((task) => {
          if (task.faite === true) return false;

          const day = getItemDay(task);

          if (!day) return true;

          return (
            day === todayName ||
            day === todayISO
          );
        });

        const notesToday = notes.filter((note) => {
          return (
            note.date === todayISO &&
            note.faite !== true
          );
        });

        await syncServiceWorker({
          tasks: tasksToday,
          notes: notesToday,
          prefs,
        });

        /*
         * ------------------------------------------
         * TÂCHES
         * ------------------------------------------
         */
        for (const task of tasksToday) {
          const time = getItemTime(task);
          const taskMin = parseHeureMin(time);

          if (taskMin === null) continue;

          const diff = taskMin - currentMinutes;

          const id = getItemId(task, 'task');
          const title = getItemTitle(task);

          const baseKey = `${todayISO}-${id}-${taskMin}`;

          /*
           * Rappel personnalisé.
           *
           * Si la valeur est 5, 15 ou 30,
           * ces rappels sont déjà gérés par les options
           * correspondantes.
           */
          if (
            prefs.rappel_avant > 0 &&
            ![5, 15, 30].includes(
              Number(prefs.rappel_avant)
            ) &&
            diff === Number(prefs.rappel_avant)
          ) {
            const key = `custom-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '⏰ Rappel',
                `${title} commence dans ${prefs.rappel_avant} min.`,
                {
                  alarmType: 'warning',
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
            const key = `30-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '⏳ Dans 30 minutes',
                title,
                {
                  alarmType: 'warning',
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
            const key = `15-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '⏳ Dans 15 minutes',
                title,
                {
                  alarmType: 'warning',
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
            const key = `5-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '🚨 Dans 5 minutes',
                title,
                {
                  alarmType: 'urgent',
                  requireInteraction: true,
                  tag: key,
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
            const key = `exact-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              const alarm =
                isAlarme(task)
                  ? 'alarm'
                  : isRepas(task)
                    ? 'repas'
                    : 'normal';

              await sendNotification(
                isRepas(task)
                  ? '🍽️ C’est l’heure du repas'
                  : isAlarme(task)
                    ? '🚨 ALARME'
                    : '🔔 C’est l’heure',
                title,
                {
                  alarmType: alarm,
                  requireInteraction:
                    isAlarme(task),
                  tag: key,
                }
              );
            }
          }

          /*
           * Retard de 15 minutes
           */
          if (
            prefs.retard_alerte &&
            diff === -15
          ) {
            const key = `late15-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '⚠️ Tâche en retard',
                `${title} devait commencer il y a 15 minutes.`,
                {
                  alarmType: 'warning',
                  tag: key,
                }
              );
            }
          }

          /*
           * Retard important : 60 minutes
           */
          if (
            prefs.retard_alerte &&
            diff === -60 &&
            (task.priorite === 'haute' ||
              task.priorite === 'urgent' ||
              isAlarme(task))
          ) {
            const key = `late60-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '🚨 Retard important',
                `${title} est en retard depuis 1 heure.`,
                {
                  alarmType: 'urgent',
                  requireInteraction: true,
                  tag: key,
                }
              );
            }
          }
        }

        /*
         * ------------------------------------------
         * NOTES CALENDRIER
         * ------------------------------------------
         */
        for (const note of notesToday) {
          const time = getItemTime(note);
          const noteMin = parseHeureMin(time);

          if (noteMin === null) continue;

          const diff = noteMin - currentMinutes;

          const id = getItemId(note, 'note');
          const title = getItemTitle(note);

          const baseKey = `${todayISO}-${id}-${noteMin}`;

          if (
            diff === 15 &&
            note.notifie !== true
          ) {
            const key = `note15-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '📝 Dans 15 minutes',
                title,
                {
                  alarmType: 'warning',
                  tag: key,
                }
              );
            }
          }

          if (
            diff === 5 &&
            note.notifie !== true
          ) {
            const key = `note5-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '📝 Dans 5 minutes',
                title,
                {
                  alarmType: 'urgent',
                  tag: key,
                }
              );
            }
          }

          if (
            diff === 0 &&
            note.notifie !== true
          ) {
            const key = `noteExact-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '📝 Note calendrier',
                title,
                {
                  alarmType: 'normal',
                  tag: key,
                }
              );
            }
          }
        }

        /*
         * ------------------------------------------
         * RAPPELS
         * ------------------------------------------
         */
        for (const rappel of rappels) {
          if (
            rappel.actif === false ||
            rappel.enabled === false
          ) {
            continue;
          }

          const date = rappel.date;

          if (
            date &&
            date !== todayISO
          ) {
            continue;
          }

          const time = getItemTime(rappel);
          const rappelMin = parseHeureMin(time);

          if (rappelMin === null) continue;

          const diff = rappelMin - currentMinutes;

          const id = getItemId(
            rappel,
            'rappel'
          );

          const title =
            getItemTitle(rappel);

          const baseKey =
            `${todayISO}-${id}-${rappelMin}`;

          if (diff === 0) {
            const key = `rappelExact-${baseKey}`;

            if (!notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);

              await sendNotification(
                '🔔 Rappel',
                title,
                {
                  alarmType: isAlarme(rappel)
                    ? 'alarm'
                    : 'normal',
                  requireInteraction:
                    isAlarme(rappel),
                  tag: key,
                }
              );
            }
          }
        }

        /*
         * ------------------------------------------
         * BILAN MIDI
         * ------------------------------------------
         */
        if (
          prefs.bilan_midi &&
          now.getHours() === 12 &&
          now.getMinutes() === 0
        ) {
          const key = `bilan-midi-${todayISO}`;

          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);

            const total = tasksToday.length;
            const faites = tasksToday.filter(
              (t) => t.faite === true
            ).length;

            await sendNotification(
              '☀️ Bilan de midi',
              `${faites}/${total} tâche(s) terminée(s).`,
              {
                alarmType: 'normal',
                tag: key,
              }
            );
          }
        }

        /*
         * ------------------------------------------
         * BILAN SOIR
         * ------------------------------------------
         */
        if (
          prefs.bilan_soir &&
          now.getHours() ===
            Number(prefs.heure_bilan_soir) &&
          now.getMinutes() === 0
        ) {
          const key = `bilan-soir-${todayISO}`;

          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);

            await sendNotification(
              '🌙 Bilan du jour',
              'Regarde tes tâches et prépare demain.',
              {
                alarmType: 'normal',
                tag: key,
              }
            );
          }
        }

        /*
         * ------------------------------------------
         * NETTOYAGE DU CACHE ANTI-DOUBLONS
         * ------------------------------------------
         */
        if (notifiedRef.current.size > 1000) {
          const values = Array.from(
            notifiedRef.current
          );

          notifiedRef.current = new Set(
            values.slice(-500)
          );
        }
      } catch (error) {
        console.error(
          'Erreur notifications :',
          error
        );
      } finally {
        runningRef.current = false;
      }
    }

    /*
     * Vérification immédiate
     */
    checkAll();

    /*
     * Vérification toutes les 30 secondes
     */
    intervalRef.current = setInterval(
      checkAll,
      30 * 1000
    );

    /*
     * Quand l'utilisateur revient sur l'application
     */
    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible'
      ) {
        checkAll();
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );

    /*
     * Quand le Service Worker devient contrôleur
     */
    const handleControllerChange = () => {
      checkAll();
    };

    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      handleControllerChange
    );

    return () => {
      cancelled = true;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );

      navigator.serviceWorker?.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
    };
  }, []);
}