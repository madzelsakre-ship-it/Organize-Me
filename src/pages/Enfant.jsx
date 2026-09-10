import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/supabaseClient';
import { KeyRound, LogOut, Bell } from 'lucide-react';
import { aujourdISO, parseHeureMin, nowMin } from '@/lib/surveillance';
import TacheEnfantCarte from '@/components/enfant/TacheEnfantCarte';

export default function Enfant() {
  const [code, setCode] = useState(() => localStorage.getItem('enfant-code') || '');
  const [saisie, setSaisie] = useState('');
  const [suivi, setSuivi] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const tasksRef = useRef([]);
  tasksRef.current = tasks;
  const notifRef = useRef(new Set());

  useEffect(() => {
    if (!code) { setLoading(false); return; }
    base44.entities.SuiviEnfant.filter({ code_appairage: code, actif: true }, '-created_date', 1).then(data => {
      if (data.length === 0) {
        localStorage.removeItem('enfant-code');
        setCode('');
        setErreur('Code invalide ou désactivé');
        setLoading(false);
        return;
      }
      setSuivi(data[0]);
    }).catch(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!suivi) return;
    let active = true;
    base44.entities.TacheEnfant.filter({ suivi_id: suivi.id, jour: aujourdISO() }, 'heure', 100).then(t => {
      if (active) { setTasks(t); setLoading(false); }
    });

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

    const unsub = base44.entities.TacheEnfant.subscribe((event) => {
      if (event.type === 'create' && event.data?.suivi_id === suivi.id && event.data?.jour === aujourdISO()) {
        setTasks(prev => prev.some(t => t.id === event.data.id) ? prev : [...prev, event.data]);
      } else if (event.type === 'update') {
        setTasks(prev => prev.map(t => t.id === event.data.id ? { ...t, ...event.data } : t));
      } else if (event.type === 'delete') {
        setTasks(prev => prev.filter(t => t.id !== event.data.id));
      }
    });

    const interval = setInterval(() => {
      const now = nowMin();
      for (const t of tasksRef.current) {
        if (t.statut !== 'a_faire') continue;
        const h = parseHeureMin(t.heure);
        if (h === null) continue;
        const key = `rappel-${t.id}-${aujourdISO()}`;
        if (now >= h && now <= h + 2 && !notifRef.current.has(key)) {
          notifRef.current.add(key);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`🔔 ${t.titre}`, { body: `C'est l'heure ! À toi de jouer 👉 ${t.heure}`, icon: '/icon-192.png' });
          }
        }
      }
    }, 20000);

    return () => { active = false; clearInterval(interval); unsub(); };
  }, [suivi]);

  async function lier() {
    if (!saisie.trim()) return;
    setErreur('');
    const c = saisie.trim().toUpperCase();
    const data = await base44.entities.SuiviEnfant.filter({ code_appairage: c, actif: true }, '-created_date', 1);
    if (data.length === 0) { setErreur('Code introuvable'); return; }
    localStorage.setItem('enfant-code', c);
    setCode(c);
    setSaisie('');
  }

  async function commencer(t) {
    await base44.entities.TacheEnfant.update(t.id, { statut: 'en_cours', commencee_a: new Date().toISOString() });
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, statut: 'en_cours', commencee_a: new Date().toISOString() } : x));
  }
  async function terminer(t) {
    await base44.entities.TacheEnfant.update(t.id, { statut: 'validee', finie_a: new Date().toISOString() });
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, statut: 'validee', finie_a: new Date().toISOString() } : x));
  }
  function deconnexion() {
    localStorage.removeItem('enfant-code');
    setCode('');
    setSuivi(null);
    setTasks([]);
    setLoading(true);
  }

  // ── Écran d'appairage ──────────────────────────────────────────────
  if (!code || (!suivi && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#080810' }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--gold-dim)' }}>
            <KeyRound size={36} style={{ color: 'var(--gold)' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Mode Enfant</h1>
          <p className="text-sm text-muted-foreground mb-6">Saisis le code donné par tes parents pour voir tes tâches du jour.</p>
          <input
            value={saisie}
            onChange={e => setSaisie(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && lier()}
            placeholder="CODE D'APPAIRAGE"
            className="w-full text-center text-2xl font-black tracking-[0.3em] bg-accent border-2 border-border rounded-2xl px-4 py-4 text-foreground outline-none focus:border-gold mb-3"
            maxLength={8}
          />
          {erreur && <p className="text-xs text-destructive mb-3">{erreur}</p>}
          <button onClick={lier} disabled={!saisie.trim()}
            className="w-full py-3.5 rounded-2xl font-black text-base disabled:opacity-50 active:scale-95 transition-transform"
            style={{ background: 'var(--gold)', color: '#080810' }}>
            SE CONNECTER
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>;

  const sorted = [...tasks].sort((a, b) => (parseHeureMin(a.heure) || 0) - (parseHeureMin(b.heure) || 0));
  const faites = sorted.filter(t => t.statut === 'validee').length;

  return (
    <div className="min-h-screen p-4 pb-10" style={{ background: '#080810' }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs tracking-widest text-muted-foreground">SALUT</p>
            <h1 className="text-xl font-black text-white">{suivi.enfant_nom} 👋</h1>
            <p className="text-[11px] text-muted-foreground">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={deconnexion} className="p-2 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
            <LogOut size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4 rounded-2xl border border-border p-3" style={{ background: 'var(--surface)' }}>
          <Bell size={14} style={{ color: 'var(--gold)' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{faites}/{sorted.length} tâches terminées</p>
          <div className="flex-1 h-1.5 rounded-full ml-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${sorted.length > 0 ? (faites / sorted.length) * 100 : 0}%`, background: 'var(--gold)' }} />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">🎮</p>
            <p className="font-bold text-white">Pas de tâche aujourd'hui</p>
            <p className="text-sm">Profite-en ou demande à tes parents !</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(t => (
              <TacheEnfantCarte key={t.id} tache={t} onCommencer={commencer} onTerminer={terminer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}