import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/supabaseClient';
import {
  Play,
  Pause,
  Square,
  Shield,
  ShieldCheck,
  BellOff,
  Bell,
  Smartphone,
  Target,
  Clock3,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Zap,
  RotateCcw,
  Settings2
} from 'lucide-react';

/* ============================================================
   APPLICATIONS DISTRACTIVES
============================================================ */

const APPS_DISTRACTION = [
  { id: 'instagram', nom: 'Instagram', emoji: '📸' },
  { id: 'tiktok', nom: 'TikTok', emoji: '🎵' },
  { id: 'youtube', nom: 'YouTube', emoji: '▶️' },
  { id: 'twitter', nom: 'Twitter / X', emoji: '🐦' },
  { id: 'snapchat', nom: 'Snapchat', emoji: '👻' },
  { id: 'netflix', nom: 'Netflix', emoji: '🎬' },
  { id: 'facebook', nom: 'Facebook', emoji: '👥' },
  { id: 'twitch', nom: 'Twitch', emoji: '🎮' },
  { id: 'reddit', nom: 'Reddit', emoji: '🤖' },
  { id: 'discord', nom: 'Discord', emoji: '💬' },
  { id: 'whatsapp', nom: 'WhatsApp', emoji: '💚' },
  { id: 'telegram', nom: 'Telegram', emoji: '✈️' },
  { id: 'pinterest', nom: 'Pinterest', emoji: '📌' },
  { id: 'spotify', nom: 'Spotify', emoji: '🎧' },
  { id: 'linkedin', nom: 'LinkedIn', emoji: '💼' },
  { id: 'games', nom: 'Jeux', emoji: '🕹️' },
];

const DUREES = [
  { label: '25 min', min: 25 },
  { label: '45 min', min: 45 },
  { label: '1 h', min: 60 },
  { label: '1 h 30', min: 90 },
  { label: '2 h', min: 120 },
  { label: '3 h', min: 180 },
];

const JOURS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche'
];

/* ============================================================
   LOCAL STORAGE
============================================================ */

const STORAGE_KEY = 'coach-elite-focus-session-v2';
const SETTINGS_KEY = 'coach-elite-focus-settings-v2';

const DEFAULT_SETTINGS = {
  notificationsBloquees: true,
  protectionDistractions: true,
  alerteFin: true,
  pauseAutorisee: true,
};

/* ============================================================
   UTILITAIRES
============================================================ */

function parseCreneau(libelle) {
  if (!libelle) return null;

  const match = libelle.match(
    /(\d{1,2})h(\d{0,2})\s*-\s*(\d{1,2})h(\d{0,2})/
  );

  if (!match) return null;

  const debut =
    parseInt(match[1], 10) * 60 +
    (parseInt(match[2], 10) || 0);

  const fin =
    parseInt(match[3], 10) * 60 +
    (parseInt(match[4], 10) || 0);

  return {
    debut,
    fin,
    duree: Math.max(1, fin - debut),
  };
}

function getTodayName() {
  const day = new Date().getDay();
  return JOURS[day === 0 ? 6 : day - 1];
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));

  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  }

  return `${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);

    if (!saved) return DEFAULT_SETTINGS;

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(saved),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch {
    // localStorage indisponible : on continue normalement
  }
}

function loadSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return null;

    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à faire
  }
}

function playFocusSound() {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.12,
      context.currentTime + 0.03
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.8
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.8);
  } catch {
    // Son non disponible
  }
}

async function notifyFocus(title, body) {
  try {
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator) {
      const registration =
        await navigator.serviceWorker.ready;

      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `focus-${Date.now()}`,
          requireInteraction: true,
          data: {
            url: '/concentration',
          },
        });

        return;
      }
    }

    new Notification(title, {
      body,
      icon: '/favicon.ico',
    });
  } catch {
    // Notification non disponible
  }
}

/* ============================================================
   COMPOSANTS VISUELS
============================================================ */

function Toggle({ active, onClick, color = '#F97316' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0"
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        background: active
          ? color
          : 'rgba(255,255,255,0.10)',
        border: active
          ? `1px solid ${color}`
          : '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.2s ease',
      }}
      aria-pressed={active}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: active ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: active ? '#000' : 'rgba(255,255,255,0.45)',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  );
}

function ScoreRing({ score, size = 180 }) {
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;

  const pct = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const dash = pct * circ;

  const color =
    score === null
      ? 'rgba(255,255,255,0.10)'
      : score >= 70
      ? '#30D158'
      : score >= 40
      ? '#F97316'
      : '#FF453A';

  const label =
    score === null
      ? 'Pas encore'
      : score >= 70
      ? 'Excellent'
      : score >= 40
      ? 'Correct'
      : 'À améliorer';

  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: 'rotate(-90deg)',
          position: 'absolute',
          inset: 0,
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{
            transition:
              'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)',
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-black text-white"
          style={{ letterSpacing: '-1px' }}
        >
          {score !== null ? score : '—'}
        </span>

        <span
          className="text-[9px] tracking-widest font-bold mt-1 text-center px-3"
          style={{ color }}
        >
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function SessionRing({ progress, size = 280, children }) {
  const r = size / 2 - 16;
  const circ = 2 * Math.PI * r;
  const safeProgress = Math.max(
    0,
    Math.min(1, progress)
  );

  const dash = safeProgress * circ;

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: 'rotate(-90deg)',
          position: 'absolute',
          inset: 0,
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="10"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#F97316"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{
            transition: 'stroke-dasharray 1s linear',
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   COMPOSANT PRINCIPAL
============================================================ */

export default function Concentration() {
  const [etape, setEtape] = useState('accueil');

  const [dureeMin, setDureeMin] = useState(60);

  const [appsBloquees, setAppsBloquees] = useState([
    'instagram',
    'tiktok',
    'youtube',
    'twitter',
  ]);

  const [showAppPicker, setShowAppPicker] = useState(false);
  const [showApps, setShowApps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [objectif, setObjectif] = useState('');
  const [creneauActuel, setCreneauActuel] = useState(null);

  const [secondesRestantes, setSecondesRestantes] =
    useState(0);

  const [secondesPause, setSecondesPause] = useState(0);

  const [pause, setPause] = useState(false);

  const [sessionTerminee, setSessionTerminee] =
    useState(null);

  const [sessionAbandonnee, setSessionAbandonnee] =
    useState(false);

  const [scoreRecord, setScoreRecord] = useState(null);

  const [settings, setSettings] =
    useState(loadSettings);

  const [session, setSession] = useState(null);

  const intervalRef = useRef(null);

  const completionHandledRef = useRef(false);

  /* ==========================================================
     SAUVEGARDE DES RÉGLAGES
  ========================================================== */

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
      );
    } catch {
      // Rien
    }
  }, [settings]);

  /* ==========================================================
     CHARGEMENT SCORE + PROGRAMME
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function chargerDonnees() {
      try {
        const data =
          await base44.entities.ScoreDiscipline.list(
            '-created_date',
            1
          );

        if (mounted && data?.length > 0) {
          setScoreRecord(data[0]);
        }
      } catch (error) {
        console.error(
          'Erreur chargement score :',
          error
        );
      }

      try {
        const programmes =
          await base44.entities.Programme.list(
            '-created_date',
            20
          );

        if (!mounted || !programmes?.length) return;

        const prog =
          programmes.find(p => p.est_favori) ||
          programmes[0];

        const creneaux = prog.creneaux || [];

        if (!creneaux.length) return;

        const todayName = getTodayName();
        const jours = prog.jours || [];

        const jourActif = jours.find(
          j =>
            j.nom === todayName &&
            j.actif !== false
        );

        if (jours.length > 0 && !jourActif) return;

        const now = new Date();

        const nowMin =
          now.getHours() * 60 +
          now.getMinutes();

        const parsed = creneaux
          .map(cr => ({
            ...cr,
            parsed: parseCreneau(cr.libelle),
          }))
          .filter(cr => cr.parsed);

        let cible = parsed.find(
          cr =>
            nowMin >= cr.parsed.debut &&
            nowMin < cr.parsed.fin
        );

        if (!cible) {
          cible = parsed
            .filter(
              cr => cr.parsed.debut > nowMin
            )
            .sort(
              (a, b) =>
                a.parsed.debut -
                b.parsed.debut
            )[0];
        }

        if (cible && mounted) {
          setCreneauActuel(cible);

          if (cible.contenu) {
            setObjectif(cible.contenu);
          }

          const proche = DUREES.reduce(
            (prev, cur) =>
              Math.abs(
                cur.min -
                  cible.parsed.duree
              ) <
              Math.abs(
                prev.min -
                  cible.parsed.duree
              )
                ? cur
                : prev
          );

          setDureeMin(proche.min);
        }
      } catch (error) {
        console.error(
          'Erreur chargement programme :',
          error
        );
      }
    }

    chargerDonnees();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     RESTAURATION D'UNE SESSION
  ========================================================== */

  useEffect(() => {
    const saved = loadSession();

    if (!saved || saved.status !== 'active') {
      return;
    }

    setSession(saved);
    setDureeMin(saved.dureeMin || 60);
    setObjectif(saved.objectif || '');
    setAppsBloquees(
      saved.appsBloquees || []
    );
    setPause(Boolean(saved.pause));
    setSecondesPause(
      saved.secondesPause || 0
    );

    /*
      Si la session n'était pas en pause,
      on recalcule le temps à partir de
      l'heure de fin prévue.
    */
    if (!saved.pause && saved.endAt) {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(saved.endAt).getTime() -
            Date.now()) /
            1000
        )
      );

      if (remaining > 0) {
        setSecondesRestantes(remaining);
        setEtape('actif');
      } else {
        clearSession();
        setEtape('accueil');
      }
    } else {
      setSecondesRestantes(
        saved.secondesRestantes || 0
      );
      setEtape('actif');
    }
  }, []);

  /* ==========================================================
     MISE À JOUR DU TIMER
  ========================================================== */

  const terminerReussi = useCallback(
    async () => {
      if (completionHandledRef.current) return;

      completionHandledRef.current = true;

      clearInterval(intervalRef.current);

      clearSession();

      if (settings.alerteFin) {
        playFocusSound();

        await notifyFocus(
          '🏆 Focus terminé',
          objectif
            ? `${formatDuration(
                dureeMin
              )} de concentration accomplie — ${objectif}`
            : `${formatDuration(
                dureeMin
              )} de concentration accomplie.`
        );
      }

      try {
        let record = scoreRecord;

        if (record) {
          const updated =
            await base44.entities.ScoreDiscipline.update(
              record.id,
              {
                score: Math.min(
                  100,
                  (record.score || 0) + 5
                ),
                sessions_reussies:
                  (record.sessions_reussies || 0) +
                  1,
              }
            );

          setScoreRecord(updated);
        } else {
          const created =
            await base44.entities.ScoreDiscipline.create(
              {
                score: 100,
                sessions_reussies: 1,
                sessions_abandonnees: 0,
              }
            );

          setScoreRecord(created);
        }
      } catch (error) {
        console.error(
          'Erreur mise à jour score :',
          error
        );
      }

      setSessionTerminee({
        duree: dureeMin,
        objectif,
        apps: appsBloquees.length,
      });

      setPause(false);
      setSession(null);
      setEtape('termine');
    },
    [
      settings.alerteFin,
      objectif,
      dureeMin,
      scoreRecord,
      appsBloquees.length,
    ]
  );

  useEffect(() => {
    if (etape !== 'actif') {
      clearInterval(intervalRef.current);
      return;
    }

    if (pause) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondesRestantes(current => {
        if (current <= 1) {
          clearInterval(
            intervalRef.current
          );

          /*
            On passe à 0 puis la fin de session
            est déclenchée.
          */
          setTimeout(() => {
            terminerReussi();
          }, 0);

          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () =>
      clearInterval(intervalRef.current);
  }, [
    etape,
    pause,
    terminerReussi,
  ]);

  /* ==========================================================
     SAUVEGARDE AUTOMATIQUE DE LA SESSION
  ========================================================== */

  useEffect(() => {
    if (!session || etape !== 'actif') return;

    const updated = {
      ...session,
      secondesRestantes,
      pause,
      secondesPause,
      objectif,
      dureeMin,
      appsBloquees,
    };

    setSession(prev =>
      prev ? updated : prev
    );

    saveSession(updated);
  }, [
    secondesRestantes,
    pause,
    secondesPause,
    objectif,
    dureeMin,
    appsBloquees,
  ]);

  /* ==========================================================
     COMPTEUR DE PAUSE
  ========================================================== */

  useEffect(() => {
    if (
      etape !== 'actif' ||
      !pause
    ) {
      return;
    }

    const interval = setInterval(() => {
      setSecondesPause(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [etape, pause]);

  /* ==========================================================
     DÉMARRER LE MODE FOCUS
  ========================================================== */

  async function demarrer() {
    completionHandledRef.current = false;

    const totalSeconds =
      dureeMin * 60;

    const startAt = new Date();

    const endAt = new Date(
      startAt.getTime() +
        totalSeconds * 1000
    );

    const nouvelleSession = {
      status: 'active',
      startAt:
        startAt.toISOString(),
      endAt:
        endAt.toISOString(),
      dureeMin,
      secondesRestantes:
        totalSeconds,
      secondesPause: 0,
      pause: false,
      objectif,
      appsBloquees,
      settings,
    };

    setSession(
      nouvelleSession
    );

    setSecondesRestantes(
      totalSeconds
    );

    setSecondesPause(0);
    setPause(false);
    setSessionAbandonnee(false);

    saveSession(
      nouvelleSession
    );

    setEtape('actif');

    /*
      Demande de permission uniquement après
      une action utilisateur.
    */
    if (
      settings.alerteFin &&
      'Notification' in window &&
      Notification.permission ===
        'default'
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // Rien
      }
    }
  }

  /* ==========================================================
     PAUSE / REPRISE
  ========================================================== */

  function togglePause() {
    if (!settings.pauseAutorisee) return;

    setPause(current => {
      const newValue = !current;

      const saved =
        loadSession();

      if (saved) {
        const updated = {
          ...saved,
          pause: newValue,
          secondesRestantes,
          secondesPause,
        };

        /*
          Lorsqu'on met en pause, on supprime
          l'ancien endAt pour éviter que le temps
          continue à s'écouler pendant la pause.
        */
        if (newValue) {
          updated.pausedAt =
            new Date().toISOString();
          updated.endAt = null;
        } else {
          const newEnd = new Date(
            Date.now() +
              secondesRestantes * 1000
          );

          updated.endAt =
            newEnd.toISOString();

          updated.pausedAt = null;
        }

        saveSession(updated);
        setSession(updated);
      }

      return newValue;
    });
  }

  /* ==========================================================
     ARRÊTER LA SESSION
  ========================================================== */

  function arreter() {
    clearInterval(
      intervalRef.current
    );

    setSessionAbandonnee(true);
    setPause(false);
  }

  /* ==========================================================
     CONFIRMER L'ARRÊT
  ========================================================== */

  async function confirmerArret() {
    clearInterval(
      intervalRef.current
    );

    const total =
      dureeMin * 60;

    const tempsEcoule = Math.max(
      0,
      total - secondesRestantes
    );

    const minutesEcoulees =
      Math.floor(
        tempsEcoule / 60
      );

    clearSession();

    try {
      let record = scoreRecord;

      if (record) {
        const updated =
          await base44.entities.ScoreDiscipline.update(
            record.id,
            {
              sessions_abandonnees:
                (record.sessions_abandonnees ||
                  0) + 1,
            }
          );

        setScoreRecord(updated);
      } else {
        const created =
          await base44.entities.ScoreDiscipline.create(
            {
              score: 100,
              sessions_reussies: 0,
              sessions_abandonnees: 1,
            }
          );

        setScoreRecord(created);
      }
    } catch (error) {
      console.error(
        'Erreur enregistrement abandon :',
        error
      );
    }

    setSession(null);

    setSessionTerminee({
      duree: minutesEcoulees,
      objectif,
      interrompue: true,
    });

    setSessionAbandonnee(false);
    setEtape('abandon');
  }

  /* ==========================================================
     APPS
  ========================================================== */

  function toggleApp(id) {
    setAppsBloquees(prev =>
      prev.includes(id)
        ? prev.filter(
            app => app !== id
          )
        : [...prev, id]
    );
  }

  /* ==========================================================
     DÉSACTIVER LE MODE FOCUS
  ========================================================== */

  function quitterSession() {
    clearSession();
    clearInterval(
      intervalRef.current
    );

    setSession(null);
    setPause(false);
    setSecondesRestantes(0);
    setEtape('accueil');
  }

  /* ==========================================================
     CALCULS
  ========================================================== */

  const totalSecondes =
    dureeMin * 60;

  const progress =
    totalSecondes > 0
      ? 1 -
        secondesRestantes /
          totalSecondes
      : 0;

  const score =
    scoreRecord?.score ?? null;

  const sessionsReussies =
    scoreRecord?.sessions_reussies ??
    0;

  const sessionsAbandonnees =
    scoreRecord?.sessions_abandonnees ??
    0;

  const totalSessions =
    sessionsReussies +
    sessionsAbandonnees;

  const tauxReussite =
    totalSessions > 0
      ? Math.round(
          (sessionsReussies /
            totalSessions) *
            100
        )
      : null;

  /* ==========================================================
     VUE SESSION ACTIVE
  ========================================================== */

  if (etape === 'actif') {
    const heureStr =
      new Date().toLocaleTimeString(
        'fr-FR',
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      );

    return (
      <div
        className="fixed inset-0 z-40 flex flex-col"
        style={{
          background: '#050508',
        }}
      >
        {/* HEADER */}

        <div className="flex items-center justify-between px-7 pt-10">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{
                background: '#F97316',
                boxShadow:
                  '0 0 12px rgba(249,115,22,0.8)',
              }}
            />

            <span
              className="text-[10px] font-bold tracking-[0.35em]"
              style={{
                color:
                  'rgba(255,255,255,0.35)',
              }}
            >
              FOCUS ACTIVÉ
            </span>
          </div>

          <span
            className="text-xs font-semibold tabular-nums"
            style={{
              color:
                'rgba(255,255,255,0.2)',
            }}
          >
            {heureStr}
          </span>
        </div>

        {/* CONTENU CENTRAL */}

        <div className="flex-1 flex flex-col items-center justify-center">
          <div
            className="mb-5 flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background:
                'rgba(249,115,22,0.08)',
              border:
                '1px solid rgba(249,115,22,0.18)',
            }}
          >
            <ShieldCheck
              size={14}
              style={{
                color: '#F97316',
              }}
            />

            <span
              className="text-[10px] font-bold tracking-widest"
              style={{
                color: '#F97316',
              }}
            >
              PROTECTION ACTIVE
            </span>
          </div>

          <SessionRing
            progress={progress}
            size={280}
          >
            <div className="flex flex-col items-center">
              {pause && (
                <span
                  className="text-[9px] tracking-[0.4em] mb-2 font-bold"
                  style={{
                    color:
                      'rgba(255,255,255,0.25)',
                  }}
                >
                  EN PAUSE
                </span>
              )}

              <span
                className="font-black tabular-nums"
                style={{
                  fontSize:
                    'clamp(48px, 13vw, 68px)',
                  color: pause
                    ? 'rgba(255,255,255,0.18)'
                    : 'white',
                  letterSpacing: '-3px',
                  lineHeight: 1,
                }}
              >
                {formatTime(
                  secondesRestantes
                )}
              </span>

              <span
                className="text-[9px] tracking-[0.5em] mt-3 font-medium"
                style={{
                  color:
                    'rgba(255,255,255,0.18)',
                }}
              >
                {pause
                  ? 'PAUSE'
                  : 'RESTANT'}
              </span>
            </div>
          </SessionRing>

          {/* OBJECTIF */}

          {objectif && (
            <div className="mt-5 flex items-center gap-2 px-5">
              <Target
                size={15}
                style={{
                  color:
                    'rgba(249,115,22,0.7)',
                }}
              />

              <p
                className="text-sm text-center font-medium"
                style={{
                  color:
                    'rgba(255,255,255,0.35)',
                }}
              >
                {objectif}
              </p>
            </div>
          )}

          {/* PROTECTIONS */}

          <div className="flex flex-wrap justify-center gap-2 px-8 mt-5">
            {settings.notificationsBloquees && (
              <span
                className="px-3 py-1.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5"
                style={{
                  background:
                    'rgba(255,255,255,0.04)',
                  color:
                    'rgba(255,255,255,0.25)',
                  border:
                    '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <BellOff size={11} />
                Notifications
              </span>
            )}

            {settings.protectionDistractions &&
              appsBloquees.length > 0 && (
                <span
                  className="px-3 py-1.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5"
                  style={{
                    background:
                      'rgba(255,255,255,0.04)',
                    color:
                      'rgba(255,255,255,0.25)',
                    border:
                      '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Smartphone size={11} />
                  {appsBloquees.length}{' '}
                  distractions
                </span>
              )}
          </div>
        </div>

        {/* CONTROLES */}

        <div className="flex items-center justify-center gap-8 pb-14">
          {settings.pauseAutorisee && (
            <button
              type="button"
              onClick={togglePause}
              className="flex flex-col items-center gap-2 active:opacity-50"
            >
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: pause
                    ? 'rgba(249,115,22,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${
                    pause
                      ? 'rgba(249,115,22,0.4)'
                      : 'rgba(255,255,255,0.1)'
                  }`,
                }}
              >
                {pause ? (
                  <Play
                    size={22}
                    style={{
                      color: '#F97316',
                    }}
                  />
                ) : (
                  <Pause
                    size={20}
                    style={{
                      color:
                        'rgba(255,255,255,0.45)',
                    }}
                  />
                )}
              </div>

              <span
                className="text-[8px] tracking-[0.3em]"
                style={{
                  color:
                    'rgba(255,255,255,0.2)',
                }}
              >
                {pause
                  ? 'REPRENDRE'
                  : 'PAUSE'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={arreter}
            className="flex flex-col items-center gap-2 active:opacity-50"
          >
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'rgba(255,255,255,0.03)',
                border:
                  '1.5px solid rgba(255,255,255,0.07)',
              }}
            >
              <Square
                size={18}
                style={{
                  color:
                    'rgba(255,255,255,0.2)',
                }}
              />
            </div>

            <span
              className="text-[8px] tracking-[0.3em]"
              style={{
                color:
                  'rgba(255,255,255,0.15)',
              }}
            >
              ARRÊTER
            </span>
          </button>
        </div>

        {/* MODAL CONFIRMATION */}

        {sessionAbandonnee && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
            style={{
              background:
                'rgba(0,0,0,0.88)',
              backdropFilter:
                'blur(10px)',
            }}
          >
            <div
              className="w-full max-w-sm rounded-3xl p-6"
              style={{
                background: '#121215',
                border:
                  '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest"
                    style={{
                      color:
                        'rgba(255,255,255,0.25)',
                    }}
                  >
                    MODE FOCUS
                  </p>

                  <h2 className="text-lg font-black text-white mt-1">
                    Quitter le Focus ?
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSessionAbandonnee(false)
                  }
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      'rgba(255,255,255,0.06)',
                  }}
                >
                  <X
                    size={14}
                    style={{
                      color:
                        'rgba(255,255,255,0.5)',
                    }}
                  />
                </button>
              </div>

              <div
                className="rounded-2xl p-4 mb-5"
                style={{
                  background:
                    'rgba(249,115,22,0.06)',
                  border:
                    '1px solid rgba(249,115,22,0.12)',
                }}
              >
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color:
                      'rgba(255,255,255,0.4)',
                  }}
                >
                  Ta session n'est pas
                  terminée. Tu peux reprendre
                  le Focus ou arrêter
                  maintenant.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSessionAbandonnee(false)
                  }
                  className="flex-1 py-3 rounded-2xl text-sm font-bold"
                  style={{
                    background:
                      'rgba(255,255,255,0.06)',
                    color: 'white',
                  }}
                >
                  Continuer
                </button>

                <button
                  type="button"
                  onClick={
                    confirmerArret
                  }
                  className="flex-1 py-3 rounded-2xl text-sm font-black"
                  style={{
                    background:
                      'rgba(255,69,58,0.12)',
                    border:
                      '1px solid rgba(255,69,58,0.2)',
                    color: '#FF453A',
                  }}
                >
                  Arrêter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ==========================================================
     VUE SESSION TERMINÉE
  ========================================================== */

  if (etape === 'termine') {
    const newScore =
      scoreRecord?.score ?? 100;

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 pb-28 md:pb-10"
        style={{
          background: '#050508',
        }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-5">
            🏆
          </div>

          <h2 className="text-2xl font-black text-white mb-1">
            Focus terminé
          </h2>

          <p
            className="text-sm mb-8"
            style={{
              color:
                'rgba(255,255,255,0.35)',
            }}
          >
            {formatDuration(
              sessionTerminee?.duree ||
                dureeMin
            )}{' '}
            de concentration accomplie
          </p>

          <div
            className="rounded-3xl p-5 mb-4"
            style={{
              background: '#111114',
              border:
                '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className="text-[10px] tracking-widest font-bold"
                style={{
                  color:
                    'rgba(255,255,255,0.2)',
                }}
              >
                SESSION
              </span>

              <span
                className="text-xs font-black px-3 py-1 rounded-full"
                style={{
                  background:
                    'rgba(48,209,88,0.12)',
                  color: '#30D158',
                }}
              >
                +5 pts discipline
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="flex-1 rounded-2xl py-3 text-center"
                style={{
                  background:
                    'rgba(255,255,255,0.04)',
                }}
              >
                <p className="text-2xl font-black text-white">
                  {sessionTerminee?.duree ||
                    dureeMin}
                </p>

                <p
                  className="text-[9px] mt-0.5"
                  style={{
                    color:
                      'rgba(255,255,255,0.2)',
                  }}
                >
                  minutes
                </p>
              </div>

              <div
                className="flex-1 rounded-2xl py-3 text-center"
                style={{
                  background:
                    'rgba(255,255,255,0.04)',
                }}
              >
                <p
                  className="text-2xl font-black"
                  style={{
                    color: '#30D158',
                  }}
                >
                  {newScore}
                </p>

                <p
                  className="text-[9px] mt-0.5"
                  style={{
                    color:
                      'rgba(255,255,255,0.2)',
                  }}
                >
                  score /100
                </p>
              </div>

              <div
                className="flex-1 rounded-2xl py-3 text-center"
                style={{
                  background:
                    'rgba(255,255,255,0.04)',
                }}
              >
                <p className="text-2xl font-black text-white">
                  {sessionTerminee?.apps ??
                    appsBloquees.length}
                </p>

                <p
                  className="text-[9px] mt-0.5"
                  style={{
                    color:
                      'rgba(255,255,255,0.2)',
                  }}
                >
                  protégées
                </p>
              </div>
            </div>
          </div>

          {sessionTerminee?.objectif && (
            <div
              className="rounded-2xl px-4 py-3 mb-6 text-left"
              style={{
                background:
                  'rgba(249,115,22,0.05)',
                border:
                  '1px solid rgba(249,115,22,0.12)',
              }}
            >
              <p
                className="text-[9px] font-bold tracking-widest mb-1"
                style={{
                  color: '#F97316',
                }}
              >
                OBJECTIF
              </p>

              <p
                className="text-xs"
                style={{
                  color:
                    'rgba(255,255,255,0.4)',
                }}
              >
                🎯 {sessionTerminee.objectif}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setEtape('accueil');
              setSessionTerminee(null);
            }}
            className="w-full py-4 rounded-2xl font-black text-sm"
            style={{
              background: '#F97316',
              color: '#000',
            }}
          >
            NOUVEAU FOCUS
          </button>
        </div>
      </div>
    );
  }

  /* ==========================================================
     VUE ABANDON
  ========================================================== */

  if (etape === 'abandon') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 pb-28 md:pb-10"
        style={{
          background: '#050508',
        }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-5">
            ⏸️
          </div>

          <h2 className="text-2xl font-black text-white mb-2">
            Focus interrompu
          </h2>

          <p
            className="text-sm mb-8"
            style={{
              color:
                'rgba(255,255,255,0.35)',
            }}
          >
            Tu peux toujours relancer
            une session.
          </p>

          <div
            className="rounded-3xl p-5 mb-5"
            style={{
              background: '#111114',
              border:
                '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs"
                style={{
                  color:
                    'rgba(255,255,255,0.3)',
                }}
              >
                Temps réalisé
              </span>

              <span className="font-black text-white">
                {formatDuration(
                  sessionTerminee?.duree ||
                    0
                )}
              </span>
            </div>

            {sessionTerminee?.objectif && (
              <div
                className="mt-4 pt-4"
                style={{
                  borderTop:
                    '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <p
                  className="text-xs text-left"
                  style={{
                    color:
                      'rgba(255,255,255,0.3)',
                  }}
                >
                  🎯{' '}
                  {
                    sessionTerminee.objectif
                  }
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEtape('accueil');
                setSessionTerminee(null);
              }}
              className="flex-1 py-4 rounded-2xl font-bold text-sm"
              style={{
                background:
                  'rgba(255,255,255,0.06)',
                color:
                  'rgba(255,255,255,0.5)',
              }}
            >
              Retour
            </button>

            <button
              type="button"
              onClick={() => {
                setEtape('setup');
                setSessionTerminee(null);
              }}
              className="flex-1 py-4 rounded-2xl font-black text-sm"
              style={{
                background: '#F97316',
                color: '#000',
              }}
            >
              Recommencer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     VUE CONFIGURATION
  ========================================================== */

  if (etape === 'setup') {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col"
        style={{
          background:
            'rgba(0,0,0,0.82)',
          backdropFilter:
            'blur(10px)',
        }}
        onClick={e => {
          if (
            e.target ===
            e.currentTarget
          ) {
            setEtape('accueil');
          }
        }}
      >
        <div
          className="mt-auto w-full max-w-lg mx-auto rounded-t-[2rem] overflow-hidden"
          style={{
            background: '#111114',
            border:
              '1px solid rgba(255,255,255,0.07)',
            borderBottom: 'none',
            maxHeight: '92vh',
            overflowY: 'auto',
          }}
        >
          <div className="flex justify-center pt-3">
            <div
              className="w-9 h-1 rounded-full"
              style={{
                background:
                  'rgba(255,255,255,0.12)',
              }}
            />
          </div>

          <div className="px-6 pb-8 pt-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p
                  className="text-[9px] font-bold tracking-widest"
                  style={{
                    color:
                      'rgba(255,255,255,0.2)',
                  }}
                >
                  MODE FOCUS
                </p>

                <h3 className="text-xl font-black text-white">
                  Configuration
                </h3>
              </div>

              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    'rgba(249,115,22,0.1)',
                  border:
                    '1px solid rgba(249,115,22,0.2)',
                }}
              >
                <Zap
                  size={20}
                  style={{
                    color: '#F97316',
                  }}
                />
              </div>
            </div>

            {/* PROGRAMME */}

            {creneauActuel && (
              <div
                className="mb-5 px-4 py-3 rounded-2xl flex items-center gap-3"
                style={{
                  background:
                    'rgba(249,115,22,0.07)',
                  border:
                    '1px solid rgba(249,115,22,0.18)',
                }}
              >
                <span>📅</span>

                <div className="min-w-0">
                  <p
                    className="text-[9px] font-bold tracking-widest"
                    style={{
                      color: '#F97316',
                    }}
                  >
                    PROGRAMME DÉTECTÉ
                  </p>

                  <p className="text-xs font-semibold text-white truncate">
                    {creneauActuel.contenu ||
                      'Travail'}{' '}
                    —{' '}
                    {
                      creneauActuel.libelle
                    }
                  </p>
                </div>
              </div>
            )}

            {/* OBJECTIF */}

            <div className="mb-5">
              <label
                className="text-[10px] font-bold tracking-widest block mb-2"
                style={{
                  color:
                    'rgba(255,255,255,0.25)',
                }}
              >
                OBJECTIF
              </label>

              <div className="relative">
                <Target
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{
                    color:
                      'rgba(249,115,22,0.5)',
                  }}
                />

                <input
                  value={objectif}
                  onChange={e =>
                    setObjectif(
                      e.target.value
                    )
                  }
                  placeholder="Sur quoi vas-tu te concentrer ?"
                  className="w-full rounded-2xl pl-11 pr-4 py-3 text-sm text-white outline-none"
                  style={{
                    background:
                      'rgba(255,255,255,0.05)',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>
            </div>

            {/* DURÉE */}

            <div className="mb-5">
              <label
                className="text-[10px] font-bold tracking-widest block mb-2"
                style={{
                  color:
                    'rgba(255,255,255,0.25)',
                }}
              >
                DURÉE DU FOCUS
              </label>

              <div className="grid grid-cols-3 gap-2">
                {DUREES.map(d => (
                  <button
                    type="button"
                    key={d.min}
                    onClick={() =>
                      setDureeMin(
                        d.min
                      )
                    }
                    className="py-3 rounded-2xl text-sm font-black transition-all"
                    style={
                      dureeMin ===
                      d.min
                        ? {
                            background:
                              '#F97316',
                            color: '#000',
                          }
                        : {
                            background:
                              'rgba(255,255,255,0.05)',
                            color:
                              'rgba(255,255,255,0.35)',
                            border:
                              '1px solid rgba(255,255,255,0.07)',
                          }
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PROTECTIONS */}

            <div className="mb-5">
              <p
                className="text-[10px] font-bold tracking-widest mb-2"
                style={{
                  color:
                    'rgba(255,255,255,0.25)',
                }}
              >
                PROTECTIONS
              </p>

              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background:
                    'rgba(255,255,255,0.035)',
                  border:
                    '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* NOTIFICATIONS */}

                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        'rgba(255,255,255,0.05)',
                    }}
                  >
                    <BellOff
                      size={16}
                      style={{
                        color:
                          'rgba(255,255,255,0.45)',
                      }}
                    />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">
                      Notifications
                    </p>

                    <p
                      className="text-[10px] mt-0.5"
                      style={{
                        color:
                          'rgba(255,255,255,0.22)',
                      }}
                    >
                      Réduire les distractions
                    </p>
                  </div>

                  <Toggle
                    active={
                      settings.notificationsBloquees
                    }
                    onClick={() =>
                      setSettings(
                        prev => ({
                          ...prev,
                          notificationsBloquees:
                            !prev.notificationsBloquees,
                        })
                      )
                    }
                  />
                </div>

                {/* DISTRACTIONS */}

                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Smartphone
                      size={16}
                      style={{
                        color:
                          'rgba(255,255,255,0.45)',
                      }}
                    />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">
                      Distractions
                    </p>

                    <p
                      className="text-[10px] mt-0.5"
                      style={{
                        color:
                          'rgba(255,255,255,0.22)',
                      }}
                    >
                      {appsBloquees.length}{' '}
                      applications sélectionnées
                    </p>
                  </div>

                  <Toggle
                    active={
                      settings.protectionDistractions
                    }
                    onClick={() =>
                      setSettings(
                        prev => ({
                          ...prev,
                          protectionDistractions:
                            !prev.protectionDistractions,
                        })
                      )
                    }
                  />
                </div>

                {/* ALERTE FIN */}

                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Bell
                      size={16}
                      style={{
                        color:
                          'rgba(255,255,255,0.45)',
                      }}
                    />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">
                      Alerte de fin
                    </p>

                    <p
                      className="text-[10px] mt-0.5"
                      style={{
                        color:
                          'rgba(255,255,255,0.22)',
                      }}
                    >
                      Notification lorsque le Focus
                      est terminé
                    </p>
                  </div>

                  <Toggle
                    active={
                      settings.alerteFin
                    }
                    onClick={() =>
                      setSettings(
                        prev => ({
                          ...prev,
                          alerteFin:
                            !prev.alerteFin,
                        })
                      )
                    }
                  />
                </div>

                {/* PAUSE */}

                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background:
                        'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Pause
                      size={16}
                      style={{
                        color:
                          'rgba(255,255,255,0.45)',
                      }}
                    />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">
                      Autoriser les pauses
                    </p>

                    <p
                      className="text-[10px] mt-0.5"
                      style={{
                        color:
                          'rgba(255,255,255,0.22)',
                      }}
                    >
                      Mettre temporairement le Focus
                      en pause
                    </p>
                  </div>

                  <Toggle
                    active={
                      settings.pauseAutorisee
                    }
                    onClick={() =>
                      setSettings(
                        prev => ({
                          ...prev,
                          pauseAutorisee:
                            !prev.pauseAutorisee,
                        })
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {/* APPLICATIONS */}

            <div className="mb-5">
              <button
                type="button"
                onClick={() =>
                  setShowApps(v => !v)
                }
                className="w-full flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2">
                  <Shield
                    size={14}
                    style={{
                      color: '#F97316',
                    }}
                  />

                  <span
                    className="text-[10px] font-bold tracking-widest"
                    style={{
                      color:
                        'rgba(255,255,255,0.3)',
                    }}
                  >
                    APPLICATIONS PROTÉGÉES (
                    {appsBloquees.length})
                  </span>
                </div>

                {showApps ? (
                  <ChevronUp
                    size={14}
                    style={{
                      color:
                        'rgba(255,255,255,0.25)',
                    }}
                  />
                ) : (
                  <ChevronDown
                    size={14}
                    style={{
                      color:
                        'rgba(255,255,255,0.25)',
                    }}
                  />
                )}
              </button>

              {showApps && (
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {APPS_DISTRACTION.map(
                    app => {
                      const on =
                        appsBloquees.includes(
                          app.id
                        );

                      return (
                        <button
                          type="button"
                          key={app.id}
                          onClick={() =>
                            toggleApp(
                              app.id
                            )
                          }
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                          style={
                            on
                              ? {
                                  background:
                                    'rgba(255,68,58,0.1)',
                                  color:
                                    'rgba(255,255,255,0.7)',
                                  border:
                                    '1px solid rgba(255,68,58,0.2)',
                                }
                              : {
                                  background:
                                    'rgba(255,255,255,0.03)',
                                  color:
                                    'rgba(255,255,255,0.2)',
                                  border:
                                    '1px solid rgba(255,255,255,0.06)',
                                }
                          }
                        >
                          <span>
                            {app.emoji}
                          </span>

                          <span className="flex-1 text-left">
                            {app.nom}
                          </span>

                          {on && (
                            <Check
                              size={12}
                              style={{
                                color:
                                  '#FF453A',
                              }}
                            />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            {/* BOUTON */}

            <button
              type="button"
              onClick={demarrer}
              className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
              style={{
                background:
                  'linear-gradient(135deg,#FF6B1A,#F97316)',
                color: '#000',
                boxShadow:
                  '0 0 30px rgba(249,115,22,0.2)',
              }}
            >
              <Zap
                size={18}
                fill="currentColor"
              />

              Activer le Mode Focus
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     VUE ACCUEIL
  ========================================================== */

  return (
    <div
      className="min-h-screen pb-28 md:pb-10"
      style={{
        background: '#050508',
      }}
    >
      <div className="max-w-md mx-auto px-5">
        {/* HEADER */}

        <div className="pt-8 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[10px] tracking-[0.4em] font-bold mb-1"
                style={{
                  color:
                    'rgba(255,255,255,0.2)',
                }}
              >
                MODE FOCUS
              </p>

              <h1 className="text-3xl font-black text-white tracking-tight">
                Concentration
              </h1>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowSettings(
                  v => !v
                )
              }
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background:
                  'rgba(255,255,255,0.05)',
                border:
                  '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Settings2
                size={17}
                style={{
                  color:
                    'rgba(255,255,255,0.35)',
                }}
              />
            </button>
          </div>
        </div>

        {/* PANNEAU RÉGLAGES RAPIDES */}

        {showSettings && (
          <div
            className="rounded-3xl p-4 mt-4 mb-4"
            style={{
              background: '#111114',
              border:
                '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Settings2
                size={15}
                style={{
                  color: '#F97316',
                }}
              />

              <span className="text-xs font-black text-white">
                Réglages du Mode Focus
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{
                    color:
                      'rgba(255,255,255,0.45)',
                  }}
                >
                  Notifications
                </span>

                <Toggle
                  active={
                    settings.notificationsBloquees
                  }
                  onClick={() =>
                    setSettings(
                      prev => ({
                        ...prev,
                        notificationsBloquees:
                          !prev.notificationsBloquees,
                      })
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{
                    color:
                      'rgba(255,255,255,0.45)',
                  }}
                >
                  Protection distractions
                </span>

                <Toggle
                  active={
                    settings.protectionDistractions
                  }
                  onClick={() =>
                    setSettings(
                      prev => ({
                        ...prev,
                        protectionDistractions:
                          !prev.protectionDistractions,
                      })
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{
                    color:
                      'rgba(255,255,255,0.45)',
                  }}
                >
                  Alerte de fin
                </span>

                <Toggle
                  active={
                    settings.alerteFin
                  }
                  onClick={() =>
                    setSettings(
                      prev => ({
                        ...prev,
                        alerteFin:
                          !prev.alerteFin,
                      })
                    )
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* ÉTAT DU MODE */}

        <div
          className="rounded-[2rem] p-5 mt-5 mb-4"
          style={{
            background:
              settings.notificationsBloquees ||
              settings.protectionDistractions
                ? 'linear-gradient(145deg,#17120d,#111114)'
                : '#111114',
            border:
              '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background:
                  'rgba(249,115,22,0.1)',
                border:
                  '1px solid rgba(249,115,22,0.2)',
              }}
            >
              <ShieldCheck
                size={26}
                style={{
                  color: '#F97316',
                }}
              />
            </div>

            <div className="flex-1">
              <p
                className="text-[9px] font-bold tracking-widest"
                style={{
                  color: '#F97316',
                }}
              >
                PROTECTION
              </p>

              <h2 className="text-lg font-black text-white">
                Mode Focus prêt
              </h2>

              <p
                className="text-[10px] mt-1"
                style={{
                  color:
                    'rgba(255,255,255,0.25)',
                }}
              >
                Configure puis active ton
                mode de concentration.
              </p>
            </div>
          </div>

          {/* INDICATEURS */}

          <div className="grid grid-cols-3 gap-2 mt-5">
            <div
              className="rounded-2xl p-3"
              style={{
                background:
                  'rgba(255,255,255,0.035)',
              }}
            >
              <BellOff
                size={14}
                style={{
                  color:
                    settings.notificationsBloquees
                      ? '#F97316'
                      : 'rgba(255,255,255,0.2)',
                }}
              />

              <p
                className="text-[9px] mt-2 font-bold"
                style={{
                  color:
                    'rgba(255,255,255,0.3)',
                }}
              >
                NOTIFS
              </p>

              <p className="text-xs font-black text-white mt-0.5">
                {settings.notificationsBloquees
                  ? 'ON'
                  : 'OFF'}
              </p>
            </div>

            <div
              className="rounded-2xl p-3"
              style={{
                background:
                  'rgba(255,255,255,0.035)',
              }}
            >
              <Smartphone
                size={14}
                style={{
                  color:
                    settings.protectionDistractions
                      ? '#F97316'
                      : 'rgba(255,255,255,0.2)',
                }}
              />

              <p
                className="text-[9px] mt-2 font-bold"
                style={{
                  color:
                    'rgba(255,255,255,0.3)',
                }}
              >
                APPS
              </p>

              <p className="text-xs font-black text-white mt-0.5">
                {appsBloquees.length}
              </p>
            </div>

            <div
              className="rounded-2xl p-3"
              style={{
                background:
                  'rgba(255,255,255,0.035)',
              }}
            >
              <Clock3
                size={14}
                style={{
                  color: '#F97316',
                }}
              />

              <p
                className="text-[9px] mt-2 font-bold"
                style={{
                  color:
                    'rgba(255,255,255,0.3)',
                }}
              >
                DURÉE
              </p>

              <p className="text-xs font-black text-white mt-0.5">
                {formatDuration(
                  dureeMin
                )}
              </p>
            </div>
          </div>
        </div>

        {/* SCORE */}

        <div className="flex flex-col items-center pt-5 pb-6">
          <ScoreRing
            score={score}
            size={180}
          />

          <div className="flex items-center gap-6 mt-6">
            {[
              {
                label: 'Réussies',
                value:
                  sessionsReussies,
                color:
                  '#30D158',
              },
              {
                label: 'Arrêts',
                value:
                  sessionsAbandonnees,
                color:
                  'rgba(255,255,255,0.3)',
              },
              {
                label: 'Taux',
                value:
                  tauxReussite !== null
                    ? `${tauxReussite}%`
                    : '—',
                color:
                  '#F97316',
              },
            ].map((s, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
              >
                <span
                  className="text-xl font-black"
                  style={{
                    color: s.color,
                  }}
                >
                  {s.value}
                </span>

                <span
                  className="text-[9px] tracking-widest mt-0.5 font-bold"
                  style={{
                    color:
                      'rgba(255,255,255,0.2)',
                  }}
                >
                  {s.label.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CRÉNEAU */}

        {creneauActuel && (
          <div
            className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{
              background:
                'rgba(249,115,22,0.06)',
              border:
                '1px solid rgba(249,115,22,0.15)',
            }}
          >
            <span>📅</span>

            <div className="flex-1 min-w-0">
              <p
                className="text-[9px] font-bold tracking-widest"
                style={{
                  color: '#F97316',
                }}
              >
                CRÉNEAU DU PROGRAMME
              </p>

              <p className="text-sm font-semibold text-white truncate">
                {creneauActuel.contenu ||
                  'Travail'}{' '}
                —{' '}
                {creneauActuel.libelle}
              </p>
            </div>
          </div>
        )}

        {/* APPS */}

        <div
          className="rounded-2xl px-5 py-4 mb-5"
          style={{
            background: '#111114',
            border:
              '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone
                size={14}
                style={{
                  color: '#F97316',
                }}
              />

              <span
                className="text-[10px] font-bold tracking-widest"
                style={{
                  color:
                    'rgba(255,255,255,0.2)',
                }}
              >
                PROTECTION
              </span>
            </div>

            <span
              className="text-xs font-black px-2.5 py-0.5 rounded-full"
              style={{
                background:
                  appsBloquees.length > 0
                    ? 'rgba(249,115,22,0.12)'
                    : 'rgba(255,255,255,0.06)',
                color:
                  appsBloquees.length > 0
                    ? '#F97316'
                    : 'rgba(255,255,255,0.3)',
              }}
            >
              {appsBloquees.length}{' '}
              sélectionnée
              {appsBloquees.length !== 1
                ? 's'
                : ''}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {appsBloquees
              .slice(0, 5)
              .map(id => {
                const app =
                  APPS_DISTRACTION.find(
                    a => a.id === id
                  );

                if (!app) return null;

                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                    style={{
                      background:
                        'rgba(255,68,58,0.08)',
                      border:
                        '1px solid rgba(255,68,58,0.15)',
                      color:
                        'rgba(255,255,255,0.5)',
                    }}
                  >
                    {app.emoji}
                    {app.nom}
                  </span>
                );
              })}

            {appsBloquees.length > 5 && (
              <span
                className="text-[10px]"
                style={{
                  color:
                    'rgba(255,255,255,0.2)',
                }}
              >
                +{appsBloquees.length - 5}
              </span>
            )}

            <button
              type="button"
              onClick={() =>
                setShowAppPicker(true)
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black active:scale-95"
              style={{
                background:
                  'rgba(249,115,22,0.1)',
                border:
                  '1px solid rgba(249,115,22,0.25)',
                color: '#F97316',
              }}
            >
              +
              <span>
                Modifier
              </span>
            </button>
          </div>
        </div>

        {/* APP PICKER */}

        {showAppPicker && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{
              background:
                'rgba(0,0,0,0.85)',
              backdropFilter:
                'blur(6px)',
            }}
            onClick={e => {
              if (
                e.target ===
                e.currentTarget
              ) {
                setShowAppPicker(false);
              }
            }}
          >
            <div
              className="w-full max-w-md rounded-t-[2rem]"
              style={{
                background: '#111114',
                border:
                  '1px solid rgba(255,255,255,0.07)',
                borderBottom:
                  'none',
              }}
            >
              <div className="flex justify-center pt-3">
                <div
                  className="w-9 h-1 rounded-full"
                  style={{
                    background:
                      'rgba(255,255,255,0.12)',
                  }}
                />
              </div>

              <div className="px-5 pt-4 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p
                      className="text-[9px] font-bold tracking-widest"
                      style={{
                        color:
                          'rgba(255,255,255,0.2)',
                      }}
                    >
                      PROTECTION
                    </p>

                    <h3 className="text-base font-black text-white">
                      Applications
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowAppPicker(
                        false
                      )
                    }
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        'rgba(255,255,255,0.07)',
                    }}
                  >
                    <X
                      size={13}
                      style={{
                        color:
                          'rgba(255,255,255,0.5)',
                      }}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {APPS_DISTRACTION.map(
                    app => {
                      const on =
                        appsBloquees.includes(
                          app.id
                        );

                      return (
                        <button
                          type="button"
                          key={app.id}
                          onClick={() =>
                            toggleApp(
                              app.id
                            )
                          }
                          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold active:scale-95"
                          style={
                            on
                              ? {
                                  background:
                                    'rgba(255,68,58,0.1)',
                                  color:
                                    'white',
                                  border:
                                    '1.5px solid rgba(255,68,58,0.35)',
                                }
                              : {
                                  background:
                                    'rgba(255,255,255,0.04)',
                                  color:
                                    'rgba(255,255,255,0.3)',
                                  border:
                                    '1.5px solid rgba(255,255,255,0.06)',
                                }
                          }
                        >
                          <span className="text-xl">
                            {app.emoji}
                          </span>

                          <span className="flex-1 text-left text-xs">
                            {app.nom}
                          </span>

                          {on ? (
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center"
                              style={{
                                background:
                                  '#FF453A',
                              }}
                            >
                              <Check
                                size={9}
                                color="white"
                              />
                            </div>
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{
                                border:
                                  '1.5px solid rgba(255,255,255,0.1)',
                              }}
                            />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAppPicker(
                      false
                    )
                  }
                  className="w-full mt-4 py-4 rounded-2xl font-black text-sm"
                  style={{
                    background:
                      '#F97316',
                    color: '#000',
                  }}
                >
                  Confirmer ·{' '}
                  {appsBloquees.length}{' '}
                  application
                  {appsBloquees.length !==
                  1
                    ? 's'
                    : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CTA PRINCIPAL */}

        <button
          type="button"
          onClick={() =>
            setEtape('setup')
          }
          className="w-full py-5 rounded-3xl font-black text-base flex items-center justify-center gap-2.5 active:scale-[0.98]"
          style={{
            background:
              'linear-gradient(135deg,#FF6B1A,#F97316)',
            color: '#000',
            boxShadow:
              '0 0 40px rgba(249,115,22,0.25)',
          }}
        >
          <Shield
            size={19}
            strokeWidth={2.5}
          />

          Activer le Mode Focus
        </button>

        <p
          className="text-center text-[11px] mt-3 font-medium"
          style={{
            color:
              'rgba(255,255,255,0.12)',
          }}
        >
          Comme un mode économie d'énergie :
          active tes protections et concentre-toi.
        </p>
      </div>
    </div>
  );
}