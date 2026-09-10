import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Play, Pause, Square, Shield, X, ChevronDown, ChevronUp } from 'lucide-react';

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
  { label: '1h', min: 60 },
  { label: '1h30', min: 90 },
  { label: '2h', min: 120 },
  { label: '3h', min: 180 },
];

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function parseCreneau(libelle) {
  if (!libelle) return null;
  const match = libelle.match(/(\d+)h(\d*)-(\d+)h(\d*)/);
  if (!match) return null;
  const debut = parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
  const fin = parseInt(match[3]) * 60 + (parseInt(match[4]) || 0);
  return { debut, fin, duree: fin - debut };
}

// Anneau de score SVG
function ScoreRing({ score, size = 180 }) {
  const r = (size / 2) - 12;
  const circ = 2 * Math.PI * r;
  const pct = score !== null ? score / 100 : 0;
  const dash = pct * circ;
  const color = score === null ? 'rgba(255,255,255,0.1)' : score >= 70 ? '#30D158' : score >= 40 ? '#F97316' : '#FF453A';
  const label = score === null ? '—' : score >= 70 ? 'Excellent' : score >= 40 ? 'Correct' : 'Faible';

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white" style={{ letterSpacing: '-1px' }}>
          {score !== null ? score : '—'}
        </span>
        <span className="text-[9px] tracking-widest font-bold mt-0.5" style={{ color }}>
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// Anneau de progression pendant session
function SessionRing({ progress, size = 280, children }) {
  const r = (size / 2) - 16;
  const circ = 2 * Math.PI * r;
  const dash = progress * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="#F97316" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export default function Concentration() {
  const [etape, setEtape] = useState('accueil');
  const [dureeMin, setDureeMin] = useState(60);
  const [appsBloquees, setAppsBloquees] = useState(['instagram', 'tiktok', 'youtube', 'twitter']);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [objectif, setObjectif] = useState('');
  const [creneauActuel, setCreneauActuel] = useState(null);
  const [secondesRestantes, setSecondesRestantes] = useState(0);
  const [pause, setPause] = useState(false);
  const [sessionTerminee, setSessionTerminee] = useState(null);
  const [sanction, setSanction] = useState(null);
  const [scoreRecord, setScoreRecord] = useState(null);
  const [showApps, setShowApps] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    base44.entities.ScoreDiscipline.list('-created_date', 1).then(data => {
      if (data.length > 0) setScoreRecord(data[0]);
    });
    base44.entities.Programme.list('-created_date', 20).then(programmes => {
      if (!programmes.length) return;
      const prog = programmes.find(p => p.est_favori) || programmes[0];
      const creneaux = prog.creneaux || [];
      if (!creneaux.length) return;
      const todayName = JOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
      const jours = prog.jours || [];
      const jourActif = jours.find(j => j.nom === todayName && j.actif !== false);
      if (jours.length > 0 && !jourActif) return;
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const parsed = creneaux.map(cr => ({ ...cr, parsed: parseCreneau(cr.libelle) })).filter(cr => cr.parsed);
      let cible = parsed.find(cr => nowMin >= cr.parsed.debut && nowMin < cr.parsed.fin);
      if (!cible) cible = parsed.filter(cr => cr.parsed.debut > nowMin).sort((a, b) => a.parsed.debut - b.parsed.debut)[0];
      if (cible) {
        setCreneauActuel(cible);
        setObjectif(cible.contenu || '');
        const proche = DUREES.reduce((prev, cur) => Math.abs(cur.min - cible.parsed.duree) < Math.abs(prev.min - cible.parsed.duree) ? cur : prev);
        setDureeMin(proche.min);
      }
    });
  }, []);

  useEffect(() => {
    if (etape === 'actif' && !pause) {
      intervalRef.current = setInterval(() => {
        setSecondesRestantes(s => {
          if (s <= 1) { clearInterval(intervalRef.current); terminerReussi(); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [etape, pause]);

  async function demarrer() {
    setSecondesRestantes(dureeMin * 60);
    setEtape('actif');
    setPause(false);
    setSanction(null);
  }

  async function terminerReussi() {
    let record = scoreRecord;
    if (record) {
      const updated = await base44.entities.ScoreDiscipline.update(record.id, {
        score: Math.min(100, (record.score || 100) + 5),
        sessions_reussies: (record.sessions_reussies || 0) + 1
      });
      setScoreRecord(updated);
    } else {
      const created = await base44.entities.ScoreDiscipline.create({ score: 100, sessions_reussies: 1, sessions_abandonnees: 0 });
      setScoreRecord(created);
    }
    setEtape('termine');
    setSessionTerminee({ duree: dureeMin, objectif });
  }

  async function arreter() {
    clearInterval(intervalRef.current);
    const tempsEcoule = dureeMin * 60 - secondesRestantes;
    const minutesEcoulees = Math.floor(tempsEcoule / 60);
    const penalite = Math.min(20, Math.max(5, Math.round(10 * (secondesRestantes / (dureeMin * 60)))));
    let nouveauScore = 100, record = scoreRecord;
    if (record) {
      nouveauScore = Math.max(0, (record.score || 100) - penalite);
      const updated = await base44.entities.ScoreDiscipline.update(record.id, { score: nouveauScore, sessions_abandonnees: (record.sessions_abandonnees || 0) + 1 });
      setScoreRecord(updated);
    } else {
      nouveauScore = 100 - penalite;
      const created = await base44.entities.ScoreDiscipline.create({ score: nouveauScore, sessions_reussies: 0, sessions_abandonnees: 1 });
      setScoreRecord(created); record = created;
    }
    setSanction({ perdu: penalite, nouveauScore, minutesEcoulees });
  }

  function toggleApp(id) {
    setAppsBloquees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  const h = Math.floor(secondesRestantes / 3600);
  const m = Math.floor((secondesRestantes % 3600) / 60);
  const s = secondesRestantes % 60;
  const timeStr = h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  const progress = dureeMin > 0 ? 1 - (secondesRestantes / (dureeMin * 60)) : 0;

  // ══ VUE ACTIVE ══════════════════════════════════════════════════════════
  if (etape === 'actif') {
    const heureStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: '#050508' }}>
        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#F97316' }} />
            <span className="text-[10px] font-bold tracking-[0.35em]" style={{ color: 'rgba(255,255,255,0.25)' }}>FOCUS ACTIF</span>
          </div>
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>{heureStr}</span>
        </div>

        {/* Anneau + Timer */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <SessionRing progress={progress} size={280}>
            <div className="flex flex-col items-center">
              {pause && (
                <span className="text-[9px] tracking-[0.4em] mb-2 font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>PAUSE</span>
              )}
              <span className="font-black tabular-nums" style={{
                fontSize: 'clamp(48px, 13vw, 68px)',
                color: pause ? 'rgba(255,255,255,0.18)' : 'white',
                letterSpacing: '-3px', lineHeight: 1,
                transition: 'color 0.3s'
              }}>{timeStr}</span>
              <span className="text-[9px] tracking-[0.5em] mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.18)' }}>
                {pause ? '— EN PAUSE —' : 'RESTANT'}
              </span>
            </div>
          </SessionRing>

          {objectif && (
            <p className="mt-5 text-sm text-center px-10 font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              🎯 {objectif}
            </p>
          )}

          {/* Apps bloquées pills */}
          <div className="flex flex-wrap gap-1.5 justify-center px-8 mt-5">
            {APPS_DISTRACTION.filter(a => appsBloquees.includes(a.id)).map(app => (
              <span key={app.id} className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {app.emoji} {app.nom}
              </span>
            ))}
          </div>
        </div>

        {/* Contrôles */}
        <div className="flex items-center justify-center gap-8 pb-16">
          <button onClick={() => setPause(p => !p)} className="flex flex-col items-center gap-2 active:opacity-50">
            <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pause ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${pause ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
              {pause ? <Play size={22} style={{ color: '#F97316' }} /> : <Pause size={20} style={{ color: 'rgba(255,255,255,0.45)' }} />}
            </div>
            <span className="text-[8px] tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.2)' }}>{pause ? 'REPRENDRE' : 'PAUSE'}</span>
          </button>
          <button onClick={arreter} className="flex flex-col items-center gap-2 active:opacity-50">
            <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.06)' }}>
              <Square size={18} style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>
            <span className="text-[8px] tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.1)' }}>ARRÊTER</span>
          </button>
        </div>

        {/* Modal sanction */}
        {sanction && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.96)' }}>
            <div className="w-full max-w-sm rounded-3xl p-6 text-center animate-fade-in" style={{ background: '#121215', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-5xl mb-4">💔</div>
              <h2 className="text-lg font-black text-white mb-1">Session abandonnée</h2>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>{sanction.minutesEcoulees} min tenues sur {dureeMin} min</p>
              <div className="rounded-2xl p-4 mb-5 flex items-center justify-between" style={{ background: 'rgba(255,68,58,0.08)', border: '1px solid rgba(255,68,58,0.18)' }}>
                <span className="text-sm font-bold text-white">Score discipline</span>
                <span className="text-base font-black" style={{ color: '#FF453A' }}>-{sanction.perdu} pts → {sanction.nouveauScore}/100</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSanction(null); setEtape('accueil'); setSecondesRestantes(0); }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>Quitter</button>
                <button onClick={() => { setSanction(null); demarrer(); }}
                  className="flex-1 py-3 rounded-2xl text-sm font-black"
                  style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#F97316' }}>🔄 Recommencer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══ VUE TERMINÉE ════════════════════════════════════════════════════════
  if (etape === 'termine') {
    const newScore = scoreRecord ? Math.min(100, (scoreRecord.score || 100)) : 100;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-28 md:pb-10 animate-fade-in" style={{ background: '#050508' }}>
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-5">🏆</div>
          <h2 className="text-2xl font-black text-white mb-1">Session accomplie !</h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>{sessionTerminee?.duree} minutes de concentration pure</p>
          <div className="rounded-3xl p-5 mb-4" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] tracking-widest font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>RÉSULTAT</span>
              <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: 'rgba(48,209,88,0.12)', color: '#30D158' }}>+5 pts discipline</span>
            </div>
            <div className="flex items-center gap-3">
              {[{ val: sessionTerminee?.duree, label: 'minutes' }, { val: newScore, label: 'score /100', color: '#30D158' }, { val: appsBloquees.length, label: 'apps bloquées' }].map((item, i) => (
                <div key={i} className="flex-1 rounded-2xl py-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-2xl font-black" style={{ color: item.color || 'white' }}>{item.val}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          {sessionTerminee?.objectif && <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.2)' }}>🎯 « {sessionTerminee.objectif} »</p>}
          <button onClick={() => { setEtape('accueil'); setSessionTerminee(null); }}
            className="w-full py-4 rounded-2xl font-black text-sm"
            style={{ background: '#F97316', color: '#000' }}>NOUVELLE SESSION</button>
        </div>
      </div>
    );
  }

  // ══ VUE SETUP (bottom sheet) ════════════════════════════════════════════
  if (etape === 'setup') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
        onClick={e => { if (e.target === e.currentTarget) setEtape('accueil'); }}>
        <div className="mt-auto w-full max-w-lg mx-auto rounded-t-[2rem] animate-fade-in overflow-hidden"
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>
          <div className="px-6 pb-8 pt-4">
            <h3 className="text-lg font-black text-white mb-5">Configurer la session</h3>

            {creneauActuel && (
              <div className="mb-4 px-4 py-3 rounded-2xl flex items-center gap-3" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)' }}>
                <span>📅</span>
                <div>
                  <p className="text-[10px] font-bold tracking-widest" style={{ color: '#F97316' }}>PROGRAMME DÉTECTÉ</p>
                  <p className="text-xs font-semibold text-white">{creneauActuel.contenu} — {creneauActuel.libelle}</p>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>OBJECTIF</label>
              <input value={objectif} onChange={e => setObjectif(e.target.value)}
                placeholder="Sur quoi vas-tu te concentrer ?"
                className="w-full rounded-2xl px-4 py-3 text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>DURÉE</label>
              <div className="grid grid-cols-3 gap-2">
                {DUREES.map(d => (
                  <button key={d.min} onClick={() => setDureeMin(d.min)}
                    className="py-3 rounded-2xl text-sm font-black transition-all"
                    style={dureeMin === d.min
                      ? { background: '#F97316', color: '#000' }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <button onClick={() => setShowApps(v => !v)} className="w-full flex items-center justify-between py-1.5">
                <span className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>APPS BLOQUÉES ({appsBloquees.length})</span>
                {showApps ? <ChevronUp size={13} style={{ color: 'rgba(255,255,255,0.25)' }} /> : <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />}
              </button>
              {showApps && (
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {APPS_DISTRACTION.map(app => {
                    const on = appsBloquees.includes(app.id);
                    return (
                      <button key={app.id} onClick={() => toggleApp(app.id)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={on
                          ? { background: 'rgba(255,68,58,0.1)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,68,58,0.2)' }
                          : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-base">{app.emoji}</span>
                        <span className="flex-1 text-left">{app.nom}</span>
                        {on && <X size={9} style={{ color: '#FF453A', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={demarrer}
              className="w-full py-4 rounded-2xl font-black text-base"
              style={{ background: '#F97316', color: '#000' }}>
              Démarrer · {dureeMin >= 60 ? `${dureeMin / 60}h${dureeMin % 60 ? dureeMin % 60 : ''}` : `${dureeMin} min`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══ VUE ACCUEIL ═════════════════════════════════════════════════════════
  const score = scoreRecord?.score ?? null;
  const sessionsReussies = scoreRecord?.sessions_reussies ?? 0;
  const sessionsAbandonnees = scoreRecord?.sessions_abandonnees ?? 0;
  const totalSessions = sessionsReussies + sessionsAbandonnees;
  const tauxReussite = totalSessions > 0 ? Math.round((sessionsReussies / totalSessions) * 100) : null;
  const scoreColor = score === null ? 'rgba(255,255,255,0.2)' : score >= 70 ? '#30D158' : score >= 40 ? '#F97316' : '#FF453A';

  return (
    <div className="min-h-screen pb-28 md:pb-10" style={{ background: '#050508' }}>
      <div className="max-w-md mx-auto px-5">

        {/* Header */}
        <div className="pt-8 pb-2">
          <p className="text-[10px] tracking-[0.4em] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>MODE FOCUS</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Concentration</h1>
        </div>

        {/* Score central — style Opal */}
        <div className="flex flex-col items-center pt-6 pb-6">
          <ScoreRing score={score} size={180} />
          <div className="flex items-center gap-6 mt-6">
            {[
              { label: 'Réussies', value: sessionsReussies, color: '#30D158' },
              { label: 'Abandons', value: sessionsAbandonnees, color: 'rgba(255,255,255,0.3)' },
              { label: 'Taux', value: tauxReussite !== null ? `${tauxReussite}%` : '—', color: scoreColor },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[9px] tracking-widest mt-0.5 font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>{s.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Créneau programme détecté */}
        {creneauActuel && (
          <div className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-3"
            style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
            <span>📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold tracking-widest" style={{ color: '#F97316' }}>CRÉNEAU MAINTENANT</p>
              <p className="text-sm font-semibold text-white truncate">{creneauActuel.contenu} — {creneauActuel.libelle}</p>
            </div>
          </div>
        )}

        {/* Protection — aperçu apps */}
        <div className="rounded-2xl px-5 py-4 mb-5"
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>PROTECTION</span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full"
              style={{ background: appsBloquees.length > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.06)', color: appsBloquees.length > 0 ? '#F97316' : 'rgba(255,255,255,0.3)' }}>
              {appsBloquees.length} app{appsBloquees.length !== 1 ? 's' : ''} bloquée{appsBloquees.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {appsBloquees.map(id => {
              const app = APPS_DISTRACTION.find(a => a.id === id);
              if (!app) return null;
              return (
                <button key={id} onClick={() => toggleApp(id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(255,68,58,0.1)', border: '1px solid rgba(255,68,58,0.2)', color: 'rgba(255,255,255,0.6)' }}>
                  <span>{app.emoji}</span>
                  <span>{app.nom}</span>
                  <X size={9} style={{ color: '#FF453A' }} />
                </button>
              );
            })}
            <button onClick={() => setShowAppPicker(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95"
              style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', color: '#F97316' }}>
              <span className="text-base leading-none">+</span>
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* App Picker Modal */}
        {showAppPicker && (
          <div className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowAppPicker(false); }}>
            <div className="w-full max-w-md rounded-t-[2rem] animate-fade-in"
              style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <div className="px-5 pt-2 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black text-white">Choisir les apps à bloquer</h3>
                  <button onClick={() => setShowAppPicker(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {APPS_DISTRACTION.map(app => {
                    const on = appsBloquees.includes(app.id);
                    return (
                      <button key={app.id} onClick={() => toggleApp(app.id)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                        style={on
                          ? { background: 'rgba(255,68,58,0.1)', color: 'white', border: '1.5px solid rgba(255,68,58,0.35)' }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1.5px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xl">{app.emoji}</span>
                        <span className="flex-1 text-left text-xs">{app.nom}</span>
                        {on && <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FF453A' }}>
                          <X size={8} color="white" />
                        </div>}
                        {!on && <div className="w-4 h-4 rounded-full shrink-0" style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setShowAppPicker(false)}
                  className="w-full mt-4 py-4 rounded-2xl font-black text-sm"
                  style={{ background: '#F97316', color: '#000' }}>
                  Confirmer · {appsBloquees.length} app{appsBloquees.length !== 1 ? 's' : ''} bloquée{appsBloquees.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <button onClick={() => setEtape('setup')}
          className="w-full py-5 rounded-3xl font-black text-base flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #FF6B1A, #F97316)', color: '#000', boxShadow: '0 0 40px rgba(249,115,22,0.25)' }}>
          <Shield size={18} strokeWidth={2.5} />
          Démarrer une session
        </button>

        <p className="text-center text-[11px] mt-3 font-medium" style={{ color: 'rgba(255,255,255,0.12)' }}>
          Configure durée, objectif et apps protégées
        </p>

      </div>
    </div>
  );
}