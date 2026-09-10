import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CATEGORIES, PRIORITES, JOURS } from '@/lib/coachData';
import { Plus, CheckCircle2, Circle, Trash2, X, Zap, Sparkles, Loader2 } from 'lucide-react';
import HabitudesSection from '@/components/HabitudesSection';

const JOURS_SEMAINE = ['Tous', ...JOURS];

const CHALLENGES_SUGGES = [
  { titre: 'Lire 20 pages', categorie: 'etude', priorite: 'normale' },
  { titre: 'Sport 30 minutes', categorie: 'sport', priorite: 'haute' },
  { titre: 'Révision cours', categorie: 'etude', priorite: 'haute' },
  { titre: 'Prière du matin', categorie: 'priere', priorite: 'haute' },
  { titre: 'Méditation 10 min', categorie: 'autre', priorite: 'normale' },
  { titre: 'Apprendre quelque chose de nouveau', categorie: 'etude', priorite: 'normale' },
  { titre: 'No social media 2h', categorie: 'autre', priorite: 'haute' },
  { titre: 'Planifier la semaine', categorie: 'travail', priorite: 'normale' },
];

export default function Taches() {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayDefault = JOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const [filtre, setFiltre] = useState(todayDefault);
  const [showForm, setShowForm] = useState(false);
  const [modeChallenger, setModeChallenger] = useState(false);
  const [challengesIA, setChallengesIA] = useState([]);
  const [loadingIA, setLoadingIA] = useState(false);
  const [form, setForm] = useState({ titre: '', jour: JOURS[0], heure: '08h00', priorite: 'normale', categorie: 'autre', note: '' });

  useEffect(() => {
    base44.entities.Tache.list('-created_date', 200).then(data => {
      setTaches(data);
      setLoading(false);
    });
  }, []);

  async function ajouterTache() {
    if (!form.titre.trim()) return;
    const nouvelle = await base44.entities.Tache.create({ ...form, faite: false });
    setTaches(prev => [nouvelle, ...prev]);
    setForm({ titre: '', jour: JOURS[0], heure: '08h00', priorite: 'normale', categorie: 'autre', note: '' });
    setShowForm(false);
  }

  async function toggleTache(id, faite) {
    await base44.entities.Tache.update(id, { faite: !faite });
    setTaches(prev => prev.map(t => t.id === id ? { ...t, faite: !faite } : t));
  }

  async function supprimerTache(id) {
    await base44.entities.Tache.delete(id);
    setTaches(prev => prev.filter(t => t.id !== id));
  }

  async function genererChallengesIA() {
    setLoadingIA(true);
    const faitesCount = taches.filter(t => t.faite).length;
    const totalCount = taches.length;
    const categoriesRates = Object.entries(
      taches.filter(t => !t.faite).reduce((acc, t) => {
        acc[t.categorie] = (acc[t.categorie] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un coach élite. Génère 4 challenges personnalisés en français pour un utilisateur.

Contexte :
- Tâches complétées : ${faitesCount}/${totalCount}
- Catégories les moins réussies : ${categoriesRates.join(', ') || 'aucune donnée'}

Génère 4 challenges courts, motivants, réalisables en 1 journée.
Retourne uniquement un JSON valide.`,
      response_json_schema: {
        type: "object",
        properties: {
          challenges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titre: { type: "string" },
                categorie: { type: "string", enum: ["priere","sport","etude","repas","sommeil","loisir","travail","autre"] },
                priorite: { type: "string", enum: ["haute","normale","basse"] }
              }
            }
          }
        }
      }
    });
    setChallengesIA(result.challenges || []);
    setLoadingIA(false);
  }

  async function ajouterChallenge(challenge) {
    const todayName = JOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    const nouvelle = await base44.entities.Tache.create({
      titre: challenge.titre,
      jour: todayName,
      heure: '08h00',
      priorite: challenge.priorite,
      categorie: challenge.categorie,
      faite: false,
    });
    setTaches(prev => [nouvelle, ...prev]);
    setModeChallenger(false);
  }

  const tachesFiltrees = filtre === 'Tous' ? taches : taches.filter(t => t.jour === filtre);
  const parJour = JOURS.reduce((acc, j) => {
    const ts = tachesFiltrees.filter(t => t.jour === j);
    if (ts.length) acc[j] = ts;
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-foreground">Tâches & Challenges</h1>
          <p className="text-sm text-muted-foreground">{taches.filter(t => t.faite).length}/{taches.length} complétées</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModeChallenger(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border border-border hover:border-gold transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--gold)' }}
          >
            <Zap size={14} /> Challenge
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: 'var(--gold)', color: '#080810' }}
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Habitudes du jour */}
      <HabitudesSection />

      {/* Filtre jours */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {JOURS_SEMAINE.map(j => (
          <button key={j} onClick={() => setFiltre(j)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={filtre === j ? { background: 'var(--gold)', color: '#080810' } : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
          >{j === 'Tous' ? 'Tous' : j.slice(0, 3)}</button>
        ))}
      </div>

      {/* Liste tâches */}
      {Object.keys(parJour).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold">Aucune tâche</p>
          <p className="text-sm">Ajoutez vos premières tâches</p>
        </div>
      ) : (
        <div className="space-y-6">
          {JOURS.filter(j => parJour[j]).map(jour => (
            <div key={jour}>
              <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">{jour.toUpperCase()}</p>
              <div className="rounded-2xl border border-border overflow-hidden" style={{ background: 'var(--surface)' }}>
                {parJour[jour].sort((a, b) => a.heure.localeCompare(b.heure)).map((t, i) => {
                  const cat = CATEGORIES[t.categorie] || CATEGORIES.autre;
                  const prio = PRIORITES[t.priorite] || PRIORITES.normale;
                  return (
                    <div key={t.id} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-border' : ''} hover:bg-accent/30 transition-colors group`}>
                      <button onClick={() => toggleTache(t.id, t.faite)} className="shrink-0">
                        {t.faite ? <CheckCircle2 size={20} style={{ color: '#2ECC71' }} /> : <Circle size={20} className="text-muted-foreground" />}
                      </button>
                      <span className="text-lg">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${t.faite ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.titre}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{t.heure}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${cat.color}20`, color: cat.color }}>{cat.label}</span>
                          <span className="text-xs">{prio.emoji}</span>
                        </div>
                        {t.note && <p className="text-xs text-muted-foreground mt-1 truncate">{t.note}</p>}
                      </div>
                      <button onClick={() => supprimerTache(t.id)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20">
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Challenger */}
      {modeChallenger && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Zap size={18} style={{ color: 'var(--gold)' }} />
                <h2 className="text-base font-black text-foreground">Mode Challenger</h2>
              </div>
              <button onClick={() => setModeChallenger(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Choisissez un challenge ou laissez l'IA en générer selon vos habitudes.</p>

            {/* Bouton Défis IA */}
            <button onClick={genererChallengesIA} disabled={loadingIA}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl mb-4 font-bold text-sm disabled:opacity-50 transition-all"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--gold)' }}
            >
              {loadingIA ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loadingIA ? 'Génération en cours…' : '✨ Défis IA personnalisés'}
            </button>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {(challengesIA.length > 0 ? challengesIA : CHALLENGES_SUGGES).map((c, i) => {
                const cat = CATEGORIES[c.categorie] || CATEGORIES.autre;
                const prio = PRIORITES[c.priorite] || PRIORITES.normale;
                return (
                  <button key={i} onClick={() => ajouterChallenge(c)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-gold text-left transition-all"
                    style={{ background: 'var(--accent)' }}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.titre}</p>
                      <p className="text-xs" style={{ color: cat.color }}>{cat.label}</p>
                    </div>
                    <span className="text-sm">{prio.emoji}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">OU CRÉER LE VÔTRE</p>
              <button onClick={() => { setModeChallenger(false); setShowForm(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:border-gold hover:text-foreground transition-all"
              >
                <Plus size={14} /> Personnaliser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-foreground">Nouvelle tâche</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">TITRE</label>
                <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex: Révision mathématiques..."
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">JOUR</label>
                  <select value={form.jour} onChange={e => setForm(f => ({ ...f, jour: e.target.value }))}
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                  >
                    {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">HEURE</label>
                  <input value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))}
                    placeholder="08h00"
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">CATÉGORIE</label>
                  <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">PRIORITÉ</label>
                  <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                  >
                    {Object.entries(PRIORITES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOTE (optionnel)</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Note..."
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none"
                />
              </div>
              <button onClick={ajouterTache}
                className="w-full py-3 rounded-xl font-black text-sm tracking-wide"
                style={{ background: 'var(--gold)', color: '#080810' }}
              >
                CRÉER LA TÂCHE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}