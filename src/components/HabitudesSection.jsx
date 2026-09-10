import { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Plus, CheckCircle2, Circle, X } from 'lucide-react';

const CATEGORIES_HAB = {
  sport:     { label: 'Sport',      emoji: '💪', color: '#E74C3C' },
  sante:     { label: 'Santé',      emoji: '🥗', color: '#2ECC71' },
  etude:     { label: 'Études',     emoji: '📚', color: '#3498DB' },
  spiritual: { label: 'Spirituel',  emoji: '🙏', color: '#9B59B6' },
  social:    { label: 'Social',     emoji: '👥', color: '#F39C12' },
  autre:     { label: 'Autre',      emoji: '⭐', color: '#607D8B' },
};

const EMOJIS = ['⭐','💪','📚','🙏','🥗','🏃','🧘','💧','📖','✍️','🎯','🎵','🛌','🧠','💼'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function HabitudesSection() {
  const [habitudes, setHabitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', emoji: '⭐', categorie: 'autre', couleur: '#F97316' });

  const today = todayISO();
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  useEffect(() => {
    base44.entities.Habitude.list('-created_date', 100).then(data => {
      setHabitudes(data.filter(h => !h.archivee));
      setLoading(false);
    });
  }, []);

  async function toggleToday(hab) {
    const completions = hab.completions || [];
    const already = completions.includes(today);
    const updated = already ? completions.filter(d => d !== today) : [...completions, today];
    await base44.entities.Habitude.update(hab.id, { completions: updated });
    setHabitudes(prev => prev.map(h => h.id === hab.id ? { ...h, completions: updated } : h));
  }

  async function creer() {
    if (!form.nom.trim()) return;
    const nouvelle = await base44.entities.Habitude.create({
      ...form, frequence: 'quotidien', jours_cibles: [0,1,2,3,4,5,6], completions: [], archivee: false,
    });
    setHabitudes(prev => [nouvelle, ...prev]);
    setForm({ nom: '', emoji: '⭐', categorie: 'autre', couleur: '#F97316' });
    setShowForm(false);
  }

  const habitudesDuJour = habitudes.filter(h => !h.jours_cibles?.length || h.jours_cibles.includes(todayIndex));
  const faites = habitudesDuJour.filter(h => (h.completions || []).includes(today)).length;

  if (loading) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-muted-foreground">HABITUDES DU JOUR</p>
          <p className="text-sm text-muted-foreground">{faites}/{habitudesDuJour.length} complétées</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'var(--surface)', color: 'var(--gold)', border: '1px solid var(--border)' }}>
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {habitudesDuJour.length === 0 ? (
        <div className="rounded-2xl border border-border p-4 text-center" style={{ background: 'var(--surface)' }}>
          <p className="text-sm text-muted-foreground">Aucune habitude. Ajoutez votre première ! 🌱</p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {habitudesDuJour.map(hab => {
            const done = (hab.completions || []).includes(today);
            const cat = CATEGORIES_HAB[hab.categorie] || CATEGORIES_HAB.autre;
            return (
              <button key={hab.id} onClick={() => toggleToday(hab)}
                className="shrink-0 flex flex-col items-center gap-1 p-3 rounded-2xl border min-w-[76px] transition-all active:scale-95"
                style={{
                  background: done ? `${hab.couleur || '#F97316'}15` : 'var(--surface)',
                  borderColor: done ? `${hab.couleur || '#F97316'}50` : 'var(--border)',
                }}>
                {done
                  ? <CheckCircle2 size={20} style={{ color: hab.couleur || 'var(--gold)' }} />
                  : <Circle size={20} className="text-muted-foreground" />}
                <span className="text-xl">{hab.emoji || cat.emoji}</span>
                <span className={`text-[10px] font-semibold text-center ${done ? 'line-through' : ''}`}
                  style={{ color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)' }}>
                  {hab.nom.length > 12 ? hab.nom.slice(0, 12) + '…' : hab.nom}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-foreground">Nouvelle habitude</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">EMOJI</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className="w-9 h-9 rounded-xl text-lg transition-all"
                      style={{ background: form.emoji === e ? 'rgba(249,115,22,0.2)' : 'var(--accent)', border: form.emoji === e ? '1.5px solid var(--gold)' : '1.5px solid transparent' }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Boire 2L d'eau, Lire 20 pages…"
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold" />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">CATÉGORIE</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORIES_HAB).map(([k, v]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, categorie: k }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={form.categorie === k
                        ? { background: `${v.color}25`, color: v.color, border: `1px solid ${v.color}` }
                        : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={creer} disabled={!form.nom.trim()}
                className="w-full py-3 rounded-xl font-black text-sm tracking-wide disabled:opacity-40"
                style={{ background: 'var(--gold)', color: '#080810' }}>
                CRÉER L'HABITUDE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}