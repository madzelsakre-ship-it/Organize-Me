import { useState, useEffect } from 'react';
import { Bell, X, Clock, CheckCircle2, SkipForward } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function parseMin(heure) {
  if (!heure) return null;
  const m = heure.match(/(\d+)h(\d*)/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + (parseInt(m[2]) || 0);
}

function minToHeure(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`;
}

export default function NotificationBanner({ tachesAujourd = [], onTacheUpdate }) {
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('notif-banner-dismissed') === 'true'
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [marking, setMarking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'done' | 'reported'

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  async function demanderPermission() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification('🔔 Notifications activées !', {
        body: 'Tu recevras des rappels pour tes tâches et habitudes.',
        icon: '/favicon.ico',
      });
    }
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('notif-banner-dismissed', 'true');
  }

  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();

  const prochaine = tachesAujourd
    .filter(t => !t.faite && t.heure)
    .map(t => ({ ...t, min: parseMin(t.heure) }))
    .filter(t => t.min !== null && t.min > nowMin)
    .sort((a, b) => a.min - b.min)[0] || null;

  const enCours = tachesAujourd
    .filter(t => !t.faite && t.heure)
    .map(t => ({ ...t, min: parseMin(t.heure) }))
    .filter(t => t.min !== null && t.min <= nowMin && t.min >= nowMin - 60)
    .sort((a, b) => b.min - a.min)[0] || null;

  const tacheAffichee = enCours || prochaine;

  // ── Action : Marquer comme faite ─────────────────────────────────────
  async function marquerFaite() {
    if (!tacheAffichee || marking) return;
    setMarking(true);
    await base44.entities.Tache.update(tacheAffichee.id, {
      faite: true,
      date_faite: new Date().toISOString(),
    });
    onTacheUpdate?.();
    setFeedback('done');
    setTimeout(() => setFeedback(null), 2500);
    setMarking(false);
  }

  // ── Action : Reporter de 30 min ───────────────────────────────────────
  async function reporter() {
    if (!tacheAffichee || reporting) return;
    setReporting(true);
    const newMin = (tacheAffichee.min || nowMin) + 30;
    const newHeure = minToHeure(newMin);
    await base44.entities.Tache.update(tacheAffichee.id, { heure: newHeure });
    onTacheUpdate?.();
    setFeedback('reported');
    setTimeout(() => setFeedback(null), 2500);
    setReporting(false);
  }

  // ── Banner permission ─────────────────────────────────────────────────
  if (permission === 'default' && !dismissed) {
    return (
      <div className="rounded-2xl border p-4 mb-4 flex items-center gap-3 animate-fade-in"
        style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.3)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(249,115,22,0.15)' }}>
          <Bell size={18} style={{ color: '#F97316' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Activer les rappels</p>
          <p className="text-xs text-muted-foreground">Reçois des alertes avant chaque tâche et créneau</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={demanderPermission}
            className="px-3 py-1.5 rounded-lg text-xs font-black"
            style={{ background: '#F97316', color: '#080810' }}>
            Activer
          </button>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-accent/50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  // ── Feedback temporaire ───────────────────────────────────────────────
  if (feedback) {
    return (
      <div className="rounded-2xl border p-3 mb-4 flex items-center gap-3 animate-fade-in"
        style={{
          background: feedback === 'done' ? 'rgba(46,204,113,0.1)' : 'rgba(52,152,219,0.1)',
          borderColor: feedback === 'done' ? 'rgba(46,204,113,0.4)' : 'rgba(52,152,219,0.4)',
        }}>
        <span className="text-xl">{feedback === 'done' ? '✅' : '⏩'}</span>
        <p className="text-sm font-bold" style={{ color: feedback === 'done' ? '#2ECC71' : '#3498DB' }}>
          {feedback === 'done' ? 'Tâche marquée comme faite !' : 'Tâche reportée de 30 min'}
        </p>
      </div>
    );
  }

  // ── Banner tâche en cours / prochaine avec actions ────────────────────
  if ((permission === 'granted' || permission === 'denied') && tacheAffichee) {
    const isEnCours = !!enCours;
    const diffMin = tacheAffichee.min - nowMin;

    let tempsLabel = '';
    if (isEnCours) tempsLabel = 'En cours';
    else if (diffMin < 60) tempsLabel = `${diffMin}min`;
    else tempsLabel = `${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? diffMin % 60 : ''}`;

    const isUrgent = !isEnCours && diffMin <= 15;
    const accentColor = isEnCours ? '#2ECC71' : isUrgent ? '#E74C3C' : '#F97316';

    return (
      <div className="rounded-2xl border mb-4 animate-fade-in overflow-hidden"
        style={{
          background: isEnCours ? 'rgba(46,204,113,0.07)' : isUrgent ? 'rgba(231,76,60,0.07)' : 'rgba(249,115,22,0.06)',
          borderColor: isEnCours ? 'rgba(46,204,113,0.3)' : isUrgent ? 'rgba(231,76,60,0.3)' : 'rgba(249,115,22,0.2)',
        }}>

        {/* Ligne principale */}
        <div className="flex items-center gap-3 px-3 pt-3 pb-2">
          {/* Temps */}
          <div className="flex flex-col items-center justify-center w-12 shrink-0">
            <Clock size={11} style={{ color: accentColor }} />
            <p className="text-[10px] font-black mt-0.5 text-center leading-tight" style={{ color: accentColor }}>
              {tempsLabel}
            </p>
          </div>

          <div className="w-px h-8 shrink-0" style={{ background: `${accentColor}30` }} />

          {/* Info tâche */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest mb-0.5" style={{ color: accentColor }}>
              {isEnCours ? '▶ EN COURS' : '⏭ PROCHAINE'}
            </p>
            <p className="text-sm font-bold text-foreground truncate">{tacheAffichee.titre}</p>
          </div>

          {/* Heure */}
          <p className="text-sm font-black shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {tacheAffichee.heure}
          </p>
        </div>

        {/* Boutons d'action rapide */}
        <div className="flex border-t px-3 pb-3 pt-2 gap-2"
          style={{ borderColor: `${accentColor}20` }}>
          <button
            onClick={marquerFaite}
            disabled={marking}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(46,204,113,0.15)', color: '#2ECC71', border: '1px solid rgba(46,204,113,0.3)' }}>
            <CheckCircle2 size={13} />
            {marking ? '…' : 'Marquer faite'}
          </button>
          <button
            onClick={reporter}
            disabled={reporting}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(52,152,219,0.12)', color: '#3498DB', border: '1px solid rgba(52,152,219,0.25)' }}>
            <SkipForward size={13} />
            {reporting ? '…' : '+30 min'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}