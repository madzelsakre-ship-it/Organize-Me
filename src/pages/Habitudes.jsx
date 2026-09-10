import { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Plus, X, Flame, CheckCircle2, Circle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOURS_ABREV = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const CATEGORIES = {
  sport:     { label: 'Sport',      emoji: '💪', color: '#E74C3C' },
  sante:     { label: 'Santé',      emoji: '🥗', color: '#2ECC71' },
  etude:     { label: 'Études',     emoji: '📚', color: '#3498DB' },
  spiritual: { label: 'Spirituel',  emoji: '🙏', color: '#9B59B6' },
  social:    { label: 'Social',     emoji: '👥', color: '#F39C12' },
  autre:     { label: 'Autre',      emoji: '⭐', color: '#607D8B' },
};

const EMOJIS = ['⭐','💪','📚','🙏','🥗','🏃','🧘','💧','📖','✍️','🎯','🎵','🛌','🧠','💼'];
const COULEURS = ['#F97316','#E74C3C','#3498DB','#2ECC71','#9B59B6','#F39C12','#00BCD4','#E91E63'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function computeStreak(completions = []) {
  if (!completions.length) return 0;
  const sorted = [...completions].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const dateStr of sorted) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor - d) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = d;
    } else break;
  }
  return streak;
}

function WeekView({ completions = [] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  return (
    <div className="flex gap-1 mt-2">
      {days.map((date, i) => {
        const done = completions.includes(date);
        const isToday = date === todayISO();
        return (
          <div key={date} className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {JOURS_ABREV[new Date(date + 'T12:00:00').getDay() === 0 ? 6 : new Date(date + 'T12:00:00').getDay() - 1]?.[0]}
            </span>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: done ? 'var(--gold)' : isToday ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                border: isToday ? '1.5px solid rgba(249,115,22,0.5)' : '1.5px solid transparent',
              }}
            >
              {done && <span style={{ fontSize: 10 }}>✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Habitudes() {
  const [habitudes, setHabitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({
    nom: '', emoji: '⭐', categorie: 'autre', couleur: '#F97316',
    frequence: 'quotidien', jours_cibles: [0,1,2,3,4,5,6], objectif_minutes: 0,
  });

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
    const updated = already
      ? completions.filter(d => d !== today)
      : [...completions, today];
    await base44.entities.Habitude.update(hab.id, { completions: updated });
    setHabitudes(prev => prev.map(h => h.id === hab.id ? { ...h, completions: updated } : h));
  }

  async function creer() {
    if (!form.nom.trim()) return;
    const nouvelle = await base44.entities.Habitude.create({ ...form, completions: [], archivee: false });
    setHabitudes(prev => [nouvelle, ...prev]);
    setForm({ nom: '', emoji: '⭐', categorie: 'autre', couleur: '#F97316', frequence: 'quotidien', jours_cibles: [0,1,2,3,4,5,6], objectif_minutes: 0 });
    setShowForm(false);
  }

  async function supprimer(id) {
    await base44.entities.Habitude.delete(id);
    setHabitudes(prev => prev.filter(h => h.id !== id));
  }

  function toggleJourCible(i) {
    setForm(f => ({
      ...f,
      jours_cibles: f.jours_cibles.includes(i)
        ? f.jours_cibles.filter(j => j !== i)
        : [...f.jours_cibles, i],
    }));
  }

  // Habitudes du jour
  const habitudesDuJour = habitudes.filter(h =>
    !h.jours_cibles?.length || h.jours_cibles.includes(todayIndex)
  );
  const faitesDuJour = habitudesDuJour.filter(h => (h.completions || []).includes(today));
  const pct = habitudesDuJour.length > 0 ? Math.round((faitesDuJour.length / habitudesDuJour.length) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-foreground">Habitudes</h1>
          <p className="text-sm text-muted-foreground">{faitesDuJour.length}/{habitudesDuJour.length} aujourd'hui · {pct}%</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
          style={{ background: 'var(--gold)', color: '#080810' }}
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Barre progression */}
      {habitudesDuJour.length > 0 && (
        <div className="mb-6 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-widest text-muted-foreground">PROGRESSION DU JOUR</span>
            <span className="text-sm font-black" style={{ color: pct === 100 ? '#2ECC71' : 'var(--gold)' }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct === 100 ? '#2ECC71' : 'var(--gold)' }} />
          </div>
          {pct === 100 && (
            <p className="text-xs font-bold mt-2" style={{ color: '#2ECC71' }}>🏆 Toutes tes habitudes du jour sont complètes !</p>
          )}
        </div>
      )}

      {/* Liste habitudes */}
      {habitudes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-5xl mb-3">🌱</p>
          <p className="font-semibold">Aucune habitude</p>
          <p className="text-sm mt-1">Construis tes routines une par une</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habitudes.map(hab => {
            const completions = hab.completions || [];
            const doneToday = completions.includes(today);
            const streak = computeStreak(completions);
            const cat = CATEGORIES[hab.categorie] || CATEGORIES.autre;
            const isExpanded = expanded === hab.id;
            const estDuJour = !hab.jours_cibles?.length || hab.jours_cibles.includes(todayIndex);

            return (
              <div key={hab.id}
                className="rounded-2xl border transition-all"
                style={{
                  background: 'var(--surface)',
                  borderColor: doneToday ? `${hab.couleur || 'var(--gold)'}40` : 'var(--border)',
                }}
              >
                {/* Ligne principale */}
                <div className="flex items-center gap-3 p-4">
                  {/* Toggle */}
                  {estDuJour ? (
                    <button onClick={() => toggleToday(hab)} className="shrink-0 transition-transform active:scale-90">
                      {doneToday
                        ? <CheckCircle2 size={26} style={{ color: hab.couleur || 'var(--gold)' }} />
                        : <Circle size={26} className="text-muted-foreground" />
                      }
                    </button>
                  ) : (
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">—</span>
                    </div>
                  )}

                  {/* Emoji + infos */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${hab.couleur || '#F97316'}18` }}>
                    {hab.emoji || cat.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${doneToday ? 'line-through' : 'text-foreground'}`}
                      style={doneToday ? { color: 'rgba(255,255,255,0.35)' } : {}}>
                      {hab.nom}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: cat.color }}>{cat.emoji} {cat.label}</span>
                      {streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: '#F97316' }}>
                          <Flame size={10} /> {streak}j
                        </span>
                      )}
                      {!estDuJour && (
                        <span className="text-xs text-muted-foreground">Pas aujourd'hui</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setExpanded(isExpanded ? null : hab.id)}
                      className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                      {isExpanded
                        ? <ChevronUp size={14} className="text-muted-foreground" />
                        : <ChevronDown size={14} className="text-muted-foreground" />
                      }
                    </button>
                    <button onClick={() => supprimer(hab.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors opacity-50 hover:opacity-100">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Vue étendue — semaine + stats */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">7 DERNIERS JOURS</p>
                    <WeekView completions={completions} />
                    <div className="flex gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Streak</p>
                        <p className="text-base font-black" style={{ color: 'var(--gold)' }}>{streak} j 🔥</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-base font-black text-foreground">{completions.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fréquence</p>
                        <p className="text-base font-black text-foreground capitalize">{hab.frequence || 'quotidien'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in overflow-y-auto" style={{ background: '#0D0D18', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-foreground">Nouvelle habitude</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>

            <div className="space-y-4">
              {/* Emoji */}
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">EMOJI</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className="w-9 h-9 rounded-xl text-lg transition-all"
                      style={{ background: form.emoji === e ? 'rgba(249,115,22,0.2)' : 'var(--accent)', border: form.emoji === e ? '1.5px solid var(--gold)' : '1.5px solid transparent' }}
                    >{e}</button>
                  ))}
                </div>
              </div>

              {/* Nom */}
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Boire 2L d'eau, Lire 20 pages…"
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>

              {/* Catégorie */}
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">CATÉGORIE</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, categorie: k }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={form.categorie === k
                        ? { background: `${v.color}25`, color: v.color, border: `1px solid ${v.color}` }
                        : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
                    >{v.emoji} {v.label}</button>
                  ))}
                </div>
              </div>

              {/* Couleur */}
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">COULEUR</label>
                <div className="flex gap-2 flex-wrap">
                  {COULEURS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, couleur: c }))}
                      className="w-8 h-8 rounded-full transition-all"
                      style={{ background: c, outline: form.couleur === c ? `2px solid white` : 'none', outlineOffset: 2 }}
                    />
                  ))}
                </div>
              </div>

              {/* Jours cibles */}
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">JOURS CIBLES</label>
                <div className="flex gap-2 flex-wrap">
                  {JOURS_ABREV.map((j, i) => (
                    <button key={i} onClick={() => toggleJourCible(i)}
                      className="w-10 h-10 rounded-xl text-xs font-bold transition-all"
                      style={form.jours_cibles.includes(i)
                        ? { background: form.couleur || 'var(--gold)', color: '#080810' }
                        : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
                    >{j}</button>
                  ))}
                </div>
              </div>

              <button onClick={creer} disabled={!form.nom.trim()}
                className="w-full py-3 rounded-xl font-black text-sm tracking-wide disabled:opacity-40"
                style={{ background: 'var(--gold)', color: '#080810' }}
              >
                CRÉER L'HABITUDE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}