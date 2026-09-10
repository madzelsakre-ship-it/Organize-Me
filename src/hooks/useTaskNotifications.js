import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Catégories considérées comme "repas" → alerte spéciale dîner/déjeuner
const REPAS_CAT = ['repas'];
const REPAS_KEYWORDS = ['dîner', 'diner', 'déjeuner', 'dejeuner', 'petit-déjeuner', 'souper', 'manger', 'iftar', 'suhoor'];

function isRepas(tache) {
  if (REPAS_CAT.includes(tache.categorie)) return true;
  const titre = (tache.titre || '').toLowerCase();
  return REPAS_KEYWORDS.some(k => titre.includes(k));
}

// ── SYSTÈME À DEUX NIVEAUX ──────────────────────────────────────────
// ALARMES : réveil, sommeil, tâches critiques/priorité haute
//   → son fort et persistant, notification non-fermable, vibration longue
// NOTIFICATIONS : repas, activités quotidiennes, habitudes
//   → son doux, notification auto-fermable, vibration courte
const ALARME_CAT = ['sommeil'];
const ALARME_KEYWORDS = ['réveil', 'reveille', 'wake', 'lever', 'matin', 'fajr', 'prière du matin', 'priere du matin'];

function isAlarme(tache) {
  if (ALARME_CAT.includes(tache.categorie)) return true;
  if (tache.priorite === 'haute') return true;
  const titre = (tache.titre || '').toLowerCase();
  return ALARME_KEYWORDS.some(k => titre.includes(k));
}

// Préférences de notifications (stockées en localStorage)
function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem('notif-prefs') || '{}');
  } catch { return {}; }
}

export function saveNotifPrefs(prefs) {
  localStorage.setItem('notif-prefs', JSON.stringify(prefs));
}

export const DEFAULT_PREFS = {
  rappel_avant: 10,        // minutes avant tâche (rappel configurable)
  rappel_30min: true,      // rappel 30 min avant
  rappel_15min: true,      // rappel 15 min avant
  rappel_5min: true,       // rappel 5 min avant (urgent)
  rappel_exact: true,      // alerte à l'heure exacte
  rappel_programme: true,
  bilan_midi: true,
  bilan_soir: true,
  retard_alerte: true,
  heure_bilan_soir: 18,
};

function parseHeureMin(heure) {
  if (!heure) return null;
  const matchH = heure.match(/(\d+)h(\d*)/);
  if (matchH) return parseInt(matchH[1]) * 60 + (parseInt(matchH[2] || '0'));
  const matchColon = heure.match(/(\d+):(\d+)/);
  if (matchColon) return parseInt(matchColon[1]) * 60 + parseInt(matchColon[2]);
  const matchNum = heure.match(/^(\d+)$/);
  if (matchNum) return parseInt(matchNum[1]) * 60;
  return null;
}

// Sons distincts par contexte
function playAlarm(type = 'normal') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    if (type === 'repas') {
      // Son chaleureux "c'est l'heure de manger" — 3 notes montantes douces
      [[0, 523], [0.2, 659], [0.4, 784]].forEach(([delay, freq]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.22, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
        osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.5);
      });
    } else if (type === 'success') {
      [0, 0.18].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(i === 0 ? 660 : 880, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.3);
      });
    } else if (type === 'urgent') {
      // 4 bips descendants rapides
      [0, 0.12, 0.24, 0.36].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + delay + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
        osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.1);
      });
    } else if (type === 'warning') {
      // 2 bips courts — alerte douce (5min avant)
      [0, 0.25].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(700, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
        osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.18);
      });
    } else if (type === 'alarm') {
      // ALARME FORTE — 3 cycles de bips aigus stridents (réveil, critique)
      for (let rep = 0; rep < 3; rep++) {
        const baseDelay = rep * 0.7;
        [0, 0.15, 0.3].forEach(delay => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(960, ctx.currentTime + baseDelay + delay);
          gain.gain.setValueAtTime(0.35, ctx.currentTime + baseDelay + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + baseDelay + delay + 0.13);
          osc.start(ctx.currentTime + baseDelay + delay);
          osc.stop(ctx.currentTime + baseDelay + delay + 0.13);
        });
      }
    } else {
      // normal
      [0, 0.15, 0.3].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + delay + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
        osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.35);
      });
    }
  } catch (e) {}
}

function sendNotification(titre, body, emoji = '🔔', soundType = 'normal') {
  const isAlarm = soundType === 'alarm' || soundType === 'urgent';

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${isAlarm ? '🚨 ALARME' : emoji} ${titre}`, {
      body: isAlarm ? `⚠️ ${body}` : body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `coach-${titre.slice(0, 20)}-${Date.now()}`,
      requireInteraction: isAlarm,
    });
  }
  playAlarm(soundType);
  if (soundType === 'alarm') {
    navigator.vibrate?.([500, 200, 500, 200, 500, 200, 500]);
  } else if (soundType === 'urgent') {
    navigator.vibrate?.([300, 100, 300, 100, 300]);
  } else if (soundType === 'repas') {
    navigator.vibrate?.([200, 80, 200, 80, 400]);
  } else {
    navigator.vibrate?.([200, 100, 200]);
  }
}

export default function useTaskNotifications() {
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register periodic sync for background notifications (Chrome/Android)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if ('periodicSync' in reg) {
          reg.periodicSync.register('task-check', { minInterval: 12 * 60 * 60 * 1000 }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Check immediately when user returns to the app
    function onVisible() {
      if (document.visibilityState === 'visible') checkAll();
    }
    document.addEventListener('visibilitychange', onVisible);

    async function checkAll() {
      const prefs = { ...DEFAULT_PREFS, ...getPrefs() };
      const now = new Date();
      const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const todayName = JOURS[todayIndex];
      const todayISO = now.toISOString().slice(0, 10);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const minuteKey = now.toISOString().slice(0, 16);

      let taches = [], programmes = [], habitudes = [], notes = [], rappels = [];
      let isOffline = false;
      try {
        [taches, programmes, habitudes, notes, rappels] = await Promise.all([
          base44.entities.Tache.list('-created_date', 200),
          base44.entities.Programme.list('-created_date', 20),
          base44.entities.Habitude.list('-created_date', 100),
          base44.entities.NoteCalendrier.list('-date', 200),
          base44.entities.Rappel.list('-created_date', 100),
        ]);
        // Cache local hors-ligne — écriture uniquement si les données ont changé (évite 4 JSON.stringify + 4 writes toutes les 30s)
        const sig = `${taches.length}:${taches[0]?.updated_date || ''}|${programmes.length}:${programmes[0]?.updated_date || ''}|${habitudes.length}:${habitudes[0]?.updated_date || ''}|${notes.length}:${notes[0]?.updated_date || ''}|${rappels.length}:${rappels[0]?.updated_date || ''}`;
        if (localStorage.getItem('cache-sig') !== sig) {
          localStorage.setItem('cache-taches', JSON.stringify(taches));
          localStorage.setItem('cache-programmes', JSON.stringify(programmes));
          localStorage.setItem('cache-habitudes', JSON.stringify(habitudes));
          localStorage.setItem('cache-notes', JSON.stringify(notes));
          localStorage.setItem('cache-rappels', JSON.stringify(rappels));
          localStorage.setItem('cache-sig', sig);
        }
        localStorage.setItem('cache-last-sync', new Date().toISOString());
      } catch (e) {
        // Mode hors-ligne : utiliser les données en cache
        isOffline = true;
        try {
          taches = JSON.parse(localStorage.getItem('cache-taches') || '[]');
          programmes = JSON.parse(localStorage.getItem('cache-programmes') || '[]');
          habitudes = JSON.parse(localStorage.getItem('cache-habitudes') || '[]');
          notes = JSON.parse(localStorage.getItem('cache-notes') || '[]');
          rappels = JSON.parse(localStorage.getItem('cache-rappels') || '[]');
        } catch {}
      }

      // Sync today's data to Service Worker for background notifications
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_DATA',
          payload: {
            tasks: taches.filter(t => t.jour === todayName || t.jour === todayISO),
            notes: notes.filter(n => n.date === todayISO),
            prefs: { ...DEFAULT_PREFS, ...getPrefs() },
          },
        });
      }

      const tachesAujourd = taches.filter(t => t.jour === todayName || t.jour === todayISO);
      const tachesFaites = tachesAujourd.filter(t => t.faite);
      const tachesNonFaites = tachesAujourd.filter(t => !t.faite);
      const total = tachesAujourd.length;
      const pct = total > 0 ? Math.round((tachesFaites.length / total) * 100) : 0;

      // ── 1. RAPPELS TÂCHES (multi-paliers) ───────────────────────────────

      for (const tache of tachesNonFaites) {
        const heureMin = parseHeureMin(tache.heure);
        if (heureMin === null) continue;
        const diff = heureMin - nowMin;
        const repas = isRepas(tache);
        const haute = tache.priorite === 'haute';

        // ─ 30 min avant (toutes tâches)
        if (prefs.rappel_30min) {
          const key30 = `avant30-${tache.id}-${minuteKey}`;
          if (diff >= 29 && diff <= 31 && !notifiedRef.current.has(key30)) {
            notifiedRef.current.add(key30);
            sendNotification(
              tache.titre,
              repas
                ? `🍽️ Ton repas dans 30 min — prépare la table !`
                : `Dans 30 min${haute ? ' · ⚡ PRIORITÉ HAUTE' : ''} — pense à t'organiser`,
              repas ? '🍽️' : '⏰',
              'normal'
            );
          }
        }

        // ─ 15 min avant (toutes tâches)
        if (prefs.rappel_15min) {
          const key15 = `avant15-${tache.id}-${minuteKey}`;
          if (diff >= 14 && diff <= 16 && !notifiedRef.current.has(key15)) {
            notifiedRef.current.add(key15);
            sendNotification(
              tache.titre,
              repas
                ? `🍽️ Dans 15 min — c'est presque l'heure de manger !`
                : `Dans 15 min${haute ? ' · ⚡ HAUTE PRIORITÉ' : ''} — prépare-toi !`,
              repas ? '🍴' : '⏰',
              repas ? 'repas' : 'normal'
            );
          }
        }

        // ─ 5 min avant → son warning (notifications) ou urgent (alarmes)
        if (prefs.rappel_5min) {
          const key5 = `avant5-${tache.id}-${minuteKey}`;
          if (diff >= 4 && diff <= 6 && !notifiedRef.current.has(key5)) {
            notifiedRef.current.add(key5);
            const alarme = isAlarme(tache);
            sendNotification(
              tache.titre,
              repas
                ? `🍽️ 5 min ! C'est bientôt l'heure de passer à table 🥘`
                : alarme
                  ? `⚡ ALARME dans 5 min — prépare-toi immédiatement !`
                  : `⚡ Dans 5 min — c'est imminent !`,
              repas ? '🥘' : '⚡',
              alarme ? 'urgent' : repas ? 'repas' : 'warning'
            );
          }
        }

        // ─ Rappel configurable (ex: 10 min) si différent des paliers standards
        const avant = prefs.rappel_avant || 10;
        if (![5, 15, 30].includes(avant)) {
          const keyAvant = `avant${avant}-${tache.id}-${minuteKey}`;
          if (diff >= avant - 1 && diff <= avant + 1 && !notifiedRef.current.has(keyAvant)) {
            notifiedRef.current.add(keyAvant);
            sendNotification(
              tache.titre,
              `Dans ${avant} min${haute ? ' · ⚡ PRIORITÉ HAUTE' : ''} — prépare-toi !`,
              '⏰', 'normal'
            );
          }
        }

        // ─ Alerte à l'heure exacte : ALARME (critique/réveil) ou NOTIFICATION (normal)
        if (prefs.rappel_exact) {
          const keyExact = `exact-${tache.id}-${minuteKey}`;
          if (diff >= 0 && diff <= 1 && !notifiedRef.current.has(keyExact)) {
            notifiedRef.current.add(keyExact);
            const alarme = isAlarme(tache);
            sendNotification(
              tache.titre,
              repas
                ? `🍽️ C'est l'heure du repas ! Bon appétit 😋`
                : alarme
                  ? `🚨 C'est l'heure ! ALARME — agis maintenant !`
                  : `🔔 C'est l'heure — à toi de jouer !`,
              repas ? '🍽️' : alarme ? '🚨' : '🔔',
              alarme ? 'alarm' : repas ? 'repas' : 'normal'
            );
          }
        }

        // ─ Tâche en retard 15 min
        if (prefs.retard_alerte) {
          const keyRetard = `retard-15-${tache.id}-${minuteKey}`;
          if (diff <= -14 && diff >= -16 && !notifiedRef.current.has(keyRetard)) {
            notifiedRef.current.add(keyRetard);
            sendNotification(
              `En retard : ${tache.titre}`,
              repas
                ? `Tu n'as toujours pas mangé 😬 Prévu à ${tache.heure} — prends soin de toi !`
                : `Prévu à ${tache.heure}, pas encore fait — rattrape-toi ! 😤`,
              '🚨', 'urgent'
            );
          }

          // 2ème alerte retard 60 min (haute priorité uniquement)
          if (haute) {
            const keyRetard60 = `retard-60-${tache.id}-${minuteKey}`;
            if (diff <= -59 && diff >= -61 && !notifiedRef.current.has(keyRetard60)) {
              notifiedRef.current.add(keyRetard60);
              sendNotification(
                `⚠️ Toujours en retard : ${tache.titre}`,
                `Cette tâche prioritaire n'est toujours pas faite. Agis maintenant !`,
                '🚨', 'urgent'
              );
            }
          }
        }
      }

      // ── 2. BILAN MIDI ────────────────────────────────────────────────

      if (prefs.bilan_midi && total > 0) {
        const keyMidi = `midi-${todayISO}`;
        if (nowMin >= 12 * 60 && nowMin < 12 * 60 + 3 && !notifiedRef.current.has(keyMidi)) {
          notifiedRef.current.add(keyMidi);
          const retardeesMatin = tachesNonFaites.filter(t => {
            const h = parseHeureMin(t.heure);
            return h !== null && h < 12 * 60;
          });
          if (retardeesMatin.length > 0) {
            sendNotification('Bilan du matin',
              `${retardeesMatin.length} tâche(s) manquée(s) ce matin. Rattrape-toi cet après-midi ! 💪`,
              '📊', 'urgent');
          } else if (pct >= 50) {
            sendNotification('Bilan du matin',
              `${pct}% accompli — excellent rythme ! Continue cet après-midi 🔥`,
              '🌟', 'success');
          } else {
            sendNotification('Bilan du matin',
              `${tachesFaites.length}/${total} tâches faites. Accélère l'allure ! ⚡`,
              '📊', 'normal');
          }
        }
      }

      // ── 3. BILAN DU SOIR ─────────────────────────────────────────────

      if (prefs.bilan_soir && total > 0) {
        const heureSoir = (prefs.heure_bilan_soir || 18) * 60;
        const keySoir = `soir-${todayISO}`;
        if (nowMin >= heureSoir && nowMin < heureSoir + 3 && !notifiedRef.current.has(keySoir)) {
          notifiedRef.current.add(keySoir);
          const retardees = tachesNonFaites.filter(t => {
            const h = parseHeureMin(t.heure);
            return h !== null && h < nowMin;
          });
          if (pct === 100) {
            sendNotification('🏆 Journée parfaite !',
              `Toutes tes tâches accomplies ! Tu es un champion 👑`,
              '🏆', 'success');
          } else if (retardees.length > 0) {
            sendNotification(`${retardees.length} tâche(s) en retard`,
              `"${retardees[0].titre}"${retardees.length > 1 ? ` +${retardees.length - 1} autre(s)` : ''} — encore du temps ! 🚀`,
              '🚨', 'urgent');
          } else {
            sendNotification('Bilan du soir',
              `${tachesFaites.length}/${total} tâches (${pct}%) — fais le bilan dans l'app ! ⚡`,
              '🌅', 'normal');
          }
        }
      }

      // ── 4. OBJECTIF 100% AVANT 17H ───────────────────────────────────

      if (total > 0) {
        const keyAllDone = `all-done-${todayISO}`;
        if (pct === 100 && nowMin < 17 * 60 && !notifiedRef.current.has(keyAllDone)) {
          notifiedRef.current.add(keyAllDone);
          sendNotification('Objectif du jour accompli !',
            `Toutes tes tâches avant 17h ! 🎉 Tu mérites du repos.`,
            '🏆', 'success');
        }
      }

      // ── 5. RAPPELS HABITUDES ─────────────────────────────────────────

      const habitudesActives = habitudes.filter(h => !h.archivee);
      const HABITUDE_RAPPEL_HEURE = {
        sport: 7 * 60, sante: 8 * 60, etude: 9 * 60,
        spiritual: 6 * 60, social: 18 * 60, autre: 8 * 60,
      };
      for (const hab of habitudesActives) {
        const completions = hab.completions || [];
        if (completions.includes(todayISO)) continue;
        const heureRappel = HABITUDE_RAPPEL_HEURE[hab.categorie] || 8 * 60;
        const diff = heureRappel - nowMin;
        const keyHab = `hab-${hab.id}-${todayISO}`;
        if (diff >= -1 && diff <= 1 && !notifiedRef.current.has(keyHab)) {
          notifiedRef.current.add(keyHab);
          sendNotification(
            `Habitude : ${hab.nom}`,
            `${hab.emoji || '⭐'} N'oublie pas ton habitude du jour !`,
            '🔔', 'normal'
          );
        }
      }

      // ── 6. RAPPELS PROGRAMME ─────────────────────────────────────────

      if (prefs.rappel_programme && programmes.length > 0) {
        const programme = programmes.find(p => p.est_favori) || programmes[0];
        const creneaux = programme.creneaux || [];
        const jours = programme.jours || [];
        const jourActif = jours.find(j => j.nom === todayName && j.actif !== false);
        if (jours.length === 0 || jourActif) {
          for (const cr of creneaux) {
            const debut = parseHeureMin(cr.libelle);
            if (debut === null) continue;
            const diff = debut - nowMin;

            const key15 = `cr15-${cr.id || cr.libelle}-${minuteKey}`;
            if (diff >= 14 && diff <= 16 && !notifiedRef.current.has(key15)) {
              notifiedRef.current.add(key15);
              sendNotification(cr.contenu || 'Activité',
                `Dans 15 min — prépare-toi ! Début à ${cr.libelle?.split('-')[0] || ''}`,
                '⏰', 'normal');
            }

            const keyExact = `crExact-${cr.id || cr.libelle}-${minuteKey}`;
            if (diff >= 0 && diff <= 1 && !notifiedRef.current.has(keyExact)) {
              notifiedRef.current.add(keyExact);
              sendNotification(cr.contenu || 'Activité',
                `C'est maintenant ! ${cr.libelle} 🚀`,
                '🔥', 'normal');
            }
          }
        }
      }

      // ── 7. RAPPELS NOTES CALENDRIER ───────────────────────────────────

      const notesAujourd = notes.filter(n => n.date === todayISO && !n.notifie && n.heure_rappel);
      for (const note of notesAujourd) {
        const heureMin = parseHeureMin(note.heure_rappel);
        if (heureMin === null) continue;
        const diff = heureMin - nowMin;

        // ─ 15 min avant
        const keyN15 = `note15-${note.id}-${todayISO}`;
        if (diff >= 14 && diff <= 16 && !notifiedRef.current.has(keyN15)) {
          notifiedRef.current.add(keyN15);
          sendNotification(
            `📌 ${note.titre}`,
            note.contenu
              ? `Dans 15 min — « ${note.contenu.slice(0, 80)}${note.contenu.length > 80 ? '…' : ''} »`
              : `Rappel dans 15 minutes ⏰`,
            '📌', 'normal'
          );
        }

        // ─ 5 min avant
        const keyN5 = `note5-${note.id}-${todayISO}`;
        if (diff >= 4 && diff <= 6 && !notifiedRef.current.has(keyN5)) {
          notifiedRef.current.add(keyN5);
          sendNotification(
            `📌 ${note.titre}`,
            note.contenu
              ? `⚡ Dans 5 min — « ${note.contenu.slice(0, 80)}${note.contenu.length > 80 ? '…' : ''} »`
              : `⚡ C'est imminent !`,
            '⏰', 'warning'
          );
        }

        // ─ Heure exacte
        const keyNExact = `noteExact-${note.id}-${todayISO}`;
        if (diff >= 0 && diff <= 1 && !notifiedRef.current.has(keyNExact)) {
          notifiedRef.current.add(keyNExact);
          sendNotification(
            `📌 ${note.titre}`,
            note.contenu || `C'est l'heure — note du calendrier`,
            '🔔', 'normal'
          );
          // Marquer comme notifié
          base44.entities.NoteCalendrier.update(note.id, { notifie: true }).catch(() => {});
        }
      }

      // ── 8. RAPPELS (entité Rappel) ────────────────────────────────────

      for (const rappel of rappels) {
        const heureMin = parseHeureMin(rappel.heure);
        if (heureMin === null) continue;
        const diff = heureMin - nowMin;
        const emoji = rappel.important ? '⭐' : '🔔';
        const soundType = rappel.important ? 'urgent' : 'normal';

        // 15 min avant (rappels importants uniquement)
        if (rappel.important) {
          const keyR15 = `rappel15-${rappel.id}-${minuteKey}`;
          if (diff >= 14 && diff <= 16 && !notifiedRef.current.has(keyR15)) {
            notifiedRef.current.add(keyR15);
            sendNotification(
              `⭐ ${rappel.titre}`,
              `Dans 15 min — prépare-toi !`,
              '⭐', 'normal'
            );
          }
        }

        // 5 min avant
        const keyR5 = `rappel5-${rappel.id}-${minuteKey}`;
        if (diff >= 4 && diff <= 6 && !notifiedRef.current.has(keyR5)) {
          notifiedRef.current.add(keyR5);
          sendNotification(
            `${emoji} ${rappel.titre}`,
            `⚡ Dans 5 min — c'est imminent !`,
            emoji, 'warning'
          );
        }

        // Heure exacte
        const keyRExact = `rappelExact-${rappel.id}-${minuteKey}`;
        if (diff >= 0 && diff <= 1 && !notifiedRef.current.has(keyRExact)) {
          notifiedRef.current.add(keyRExact);
          sendNotification(
            `${emoji} ${rappel.titre}`,
            `C'est l'heure de ton rappel !`,
            emoji, soundType
          );
        }
      }

      // Nettoyage mémoire
      if (notifiedRef.current.size > 500) {
        const arr = [...notifiedRef.current];
        notifiedRef.current = new Set(arr.slice(-250));
      }
    }

    // Vérifie toutes les 30 secondes pour ne rien rater
    const interval = setInterval(checkAll, 30 * 1000);
    checkAll();
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}