import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Plus, KeyRound, X, Baby, ChevronRight, Bell } from 'lucide-react';
import { genererCode, aujourdISO, parseHeureMin, nowMin } from '@/lib/surveillance';
import CodeAppairage from '@/components/parent/CodeAppairage';
import FormTacheEnfant from '@/components/parent/FormTacheEnfant';
import TimelineEnfant from '@/components/parent/TimelineEnfant';
import ProgressionEnfant from '@/components/parent/ProgressionEnfant';

export default function Parent() {
  const [suivis, setSuivis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [nomEnfant, setNomEnfant] = useState('');
  const [showCode, setShowCode] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTache, setEditTache] = useState(null);
  const tasksRef = useRef([]);
  tasksRef.current = tasks;
  const alertedRef = useRef(new Set());

  useEffect(() => {
    base44.entities.SuiviEnfant.list('-created_date', 50).then(data => {
      setSuivis(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    });
  }, []);

  const selectedSuivi = suivis.find(s => s.id === selectedId);
  const delai = selectedSuivi?.delai_action_min || 15;

  useEffect(() => {
    if (!selectedId) return;
    setTasks([]);
    base44.entities.TacheEnfant.filter({ suivi_id: selectedId, jour: aujourdISO() }, 'heure', 100).then(setTasks);

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

    const unsub = base44.entities.TacheEnfant.subscribe((event) => {
      if (event.type === 'create' && event.data?.suivi_id === selectedId && event.data?.jour === aujourdISO()) {
        setTasks(prev => prev.some(t => t.id === event.data.id) ? prev : [...prev, event.data]);
      } else if (event.type === 'update') {
        setTasks(prev => prev.map(t => t.id === event.data.id ? { ...t, ...event.data } : t));
      } else if (event.type === 'delete') {
        setTasks(prev => prev.filter(t => t.id !== event.data.id));
      }
    });

    const interval = setInterval(async () => {
      const now = nowMin();
      const current = tasksRef.current;
      for (const t of current) {
        const h = parseHeureMin(t.heure);
        if (h === null) continue;
        let newStatut = null;
        if (t.statut === 'a_faire' && now >= h + delai) newStatut = 'en_retard';
        else if (t.statut === 'en_cours' && t.commencee_a) {
          const ecoule = (Date.now() - new Date(t.commencee_a).getTime()) / 60000;
          if (ecoule > delai) newStatut = 'manquee';
        }
        if (!newStatut) continue;
        const key = t.id + newStatut;
        if (alertedRef.current.has(key)) continue;
        alertedRef.current.add(key);
        await base44.entities.TacheEnfant.update(t.id, { statut: newStatut, notifie_parent: true });
        setTasks(prev => prev.map(x => x.id === t.id ? { ...x, statut: newStatut } : x));
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newStatut === 'manquee' ? '❌ Tâche manquée' : '⚠️ Tâche en retard', {
            body: `${t.titre} — ${t.heure}`,
            icon: '/icon-192.png',
          });
        }
      }
    }, 20000);

    return () => { clearInterval(interval); unsub(); };
  }, [selectedId, delai]);

  async function creerEnfant() {
    if (!nomEnfant.trim()) return;
    const s = await base44.entities.SuiviEnfant.create({
      enfant_nom: nomEnfant.trim(),
      code_appairage: genererCode(),
      delai_action_min: 15,
      actif: true,
    });
    setSuivis(prev => [s, ...prev]);
    setSelectedId(s.id);
    setShowAddChild(false);
    setNomEnfant('');
    setShowCode(s);
  }

  async function validerTache(t) {
    await base44.entities.TacheEnfant.update(t.id, { statut: 'validee', finie_a: new Date().toISOString() });
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, statut: 'validee', finie_a: new Date().toISOString() } : x));
  }
  async function rouvrirTache(t) {
    await base44.entities.TacheEnfant.update(t.id, { statut: 'a_faire', commencee_a: null, finie_a: null });
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, statut: 'a_faire', commencee_a: null, finie_a: null } : x));
  }
  async function supprimerTache(t) {
    await base44.entities.TacheEnfant.delete(t.id);
    setTasks(prev => prev.filter(x => x.id !== t.id));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto pb-28 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2"><Baby size={20} style={{ color: 'var(--gold)' }} /> Suivi Famille</h1>
          <p className="text-sm text-muted-foreground">Pilotez la journée de votre enfant en temps réel</p>
        </div>
        <button onClick={() => setShowAddChild(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
          style={{ background: 'var(--gold)', color: '#080810' }}>
          <Plus size={16} /> Enfant
        </button>
      </div>

      {suivis.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">👨‍👩‍👧</p>
          <p className="font-semibold">Aucun enfant suivi</p>
          <p className="text-sm">Ajoutez un enfant et générez son code d'appairage</p>
        </div>
      ) : (
        <>
          {/* Sélecteur d'enfant */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
            {suivis.map(s => (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0"
                style={s.id === selectedId
                  ? { background: 'var(--gold)', color: '#080810' }
                  : { background: 'var(--surface)', color: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)' }}>
                <span>{s.enfant_nom}</span>
                <KeyRound size={12} onClick={(e) => { e.stopPropagation(); setShowCode(s); }} />
              </button>
            ))}
          </div>

          {selectedSuivi && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-foreground">{selectedSuivi.enfant_nom}</p>
                  <p className="text-[11px] text-muted-foreground">Délai d'action: {delai} min · Code: <button onClick={() => setShowCode(selectedSuivi)} className="font-mono font-bold" style={{ color: 'var(--gold)' }}>{selectedSuivi.code_appairage}</button></p>
                </div>
                <button onClick={() => { setEditTache(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs"
                  style={{ background: 'var(--gold)', color: '#080810' }}>
                  <Plus size={14} /> Tâche
                </button>
              </div>

              <ProgressionEnfant suiviId={selectedSuivi.id} delai={delai} />

              <TimelineEnfant
                tasks={tasks}
                onValider={validerTache}
                onRouvrir={rouvrirTache}
                onSupprimer={supprimerTache}
                onEditer={(t) => { setEditTache(t); setShowForm(true); }}
              />

              <div className="mt-5 rounded-2xl border border-border p-3 flex items-center gap-2" style={{ background: 'var(--surface)' }}>
                <Bell size={14} style={{ color: 'var(--gold)' }} />
                <p className="text-[11px] text-muted-foreground">Vous recevrez une notification si une tâche n'est pas commencée dans les {delai} min après l'heure prévue.</p>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal nouvel enfant */}
      {showAddChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl border border-border p-6" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-foreground">Nouvel enfant</h2>
              <button onClick={() => setShowAddChild(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <input value={nomEnfant} onChange={e => setNomEnfant(e.target.value)} placeholder="Prénom de l'enfant"
              className="w-full bg-accent border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-gold mb-4" />
            <button onClick={creerEnfant} disabled={!nomEnfant.trim()}
              className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-50"
              style={{ background: 'var(--gold)', color: '#080810' }}>
              CRÉER & GÉNÉRER LE CODE
            </button>
          </div>
        </div>
      )}

      {showCode && <CodeAppairage suivi={showCode} onClose={() => setShowCode(null)} />}
      {showForm && selectedSuivi && (
        <FormTacheEnfant
          suiviId={selectedSuivi.id}
          tache={editTache}
          onSaved={() => { setShowForm(false); setEditTache(null); }}
          onClose={() => { setShowForm(false); setEditTache(null); }}
        />
      )}
    </div>
  );
}