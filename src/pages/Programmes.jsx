import { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { CATEGORIES, JOURS, TEMPLATES, genererProgramme } from '@/lib/coachData';
import { Plus, Star, Trash2, X, ChevronRight, Clock, Sparkles, Pencil, Camera, Upload } from 'lucide-react';
import ScannerOCR from '@/components/ScannerOCR';
import GenerateurIA from '@/components/GenerateurIA';

const JOURS_ABREV = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function Programmes() {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('liste'); // liste | detail | nouveau
  const [showScanner, setShowScanner] = useState(false);
  const [showGenerateurIA, setShowGenerateurIA] = useState(false);
  const [progSelectionne, setProgSelectionne] = useState(null);
  const [etape, setEtape] = useState(0);
  const [voie, setVoie] = useState(null);
  const [showAddCreneau, setShowAddCreneau] = useState(false);
  const [formCreneau, setFormCreneau] = useState({ libelle: '', contenu: '', categorie: 'travail' });
  const [editCreneau, setEditCreneau] = useState(null);
  // Formulaire génération
  const [formGen, setFormGen] = useState({
    nom: '', reveil: '6h30', coucher: '22h30',
    categories: ['travail', 'etude'],
    joursTravail: [0,1,2,3,4],
    pauseRepas: true
  });
  // Template
  const [templateChoisi, setTemplateChoisi] = useState(null);
  // Manuel
  const [nomManuel, setNomManuel] = useState('');

  useEffect(() => {
    base44.entities.Programme.list('-created_date', 50).then(data => {
      setProgrammes(data);
      setLoading(false);
    });
  }, []);

  async function creerDepuisGeneration() {
    const data = genererProgramme(formGen);
    const prog = await base44.entities.Programme.create(data);
    setProgrammes(prev => [prog, ...prev]);
    setProgSelectionne(prog);
    setVue('detail');
    setEtape(0);
  }

  async function creerDepuisTemplate() {
    if (!templateChoisi) return;
    const prog = await base44.entities.Programme.create({
      nom: templateChoisi.nom,
      description: templateChoisi.description,
      couleur_theme: templateChoisi.couleur,
      jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
      creneaux: templateChoisi.creneaux.map((cr, i) => ({ id: `cr_${i}`, ...cr, cellules: {} }))
    });
    setProgrammes(prev => [prog, ...prev]);
    setProgSelectionne(prog);
    setVue('detail');
    setEtape(0);
  }

  async function creerVide() {
    if (!nomManuel.trim()) return;
    const prog = await base44.entities.Programme.create({
      nom: nomManuel,
      jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
      creneaux: [],
      couleur_theme: '#6366F1',
    });
    setProgrammes(prev => [prog, ...prev]);
    setProgSelectionne(prog);
    setVue('detail');
    setEtape(0);
  }

  async function toggleJourActif(jourId) {
    const jours = (progSelectionne.jours || []).map(j =>
      j.id === jourId ? { ...j, actif: !j.actif } : j
    );
    await base44.entities.Programme.update(progSelectionne.id, { jours });
    const progMaj = { ...progSelectionne, jours };
    setProgSelectionne(progMaj);
    setProgrammes(prev => prev.map(p => p.id === progSelectionne.id ? progMaj : p));
  }

  async function ajouterCreneau() {
    if (!formCreneau.libelle.trim() || !formCreneau.contenu.trim()) return;
    const nouveauCreneau = { id: `cr_${Date.now()}`, ...formCreneau };
    const creneauxMaj = [...(progSelectionne.creneaux || []), nouveauCreneau];
    await base44.entities.Programme.update(progSelectionne.id, { creneaux: creneauxMaj });
    const progMaj = { ...progSelectionne, creneaux: creneauxMaj };
    setProgSelectionne(progMaj);
    setProgrammes(prev => prev.map(p => p.id === progSelectionne.id ? progMaj : p));
    setFormCreneau({ libelle: '', contenu: '', categorie: 'travail' });
    setShowAddCreneau(false);
  }

  async function supprimerCreneau(crId) {
    const creneauxMaj = (progSelectionne.creneaux || []).filter(c => c.id !== crId);
    await base44.entities.Programme.update(progSelectionne.id, { creneaux: creneauxMaj });
    const progMaj = { ...progSelectionne, creneaux: creneauxMaj };
    setProgSelectionne(progMaj);
    setProgrammes(prev => prev.map(p => p.id === progSelectionne.id ? progMaj : p));
  }

  async function modifierCreneau() {
    if (!editCreneau || !formCreneau.libelle.trim()) return;
    const creneauxMaj = (progSelectionne.creneaux || []).map(c =>
      c.id === editCreneau.id ? { ...c, libelle: formCreneau.libelle, contenu: formCreneau.contenu, categorie: formCreneau.categorie } : c
    );
    await base44.entities.Programme.update(progSelectionne.id, { creneaux: creneauxMaj });
    const progMaj = { ...progSelectionne, creneaux: creneauxMaj };
    setProgSelectionne(progMaj);
    setProgrammes(prev => prev.map(p => p.id === progSelectionne.id ? progMaj : p));
    setEditCreneau(null);
    setFormCreneau({ libelle: '', contenu: '', categorie: 'travail' });
  }

  async function toggleFavori(prog) {
    await base44.entities.Programme.update(prog.id, { est_favori: !prog.est_favori });
    setProgrammes(prev => prev.map(p => p.id === prog.id ? { ...p, est_favori: !p.est_favori } : p));
    if (progSelectionne?.id === prog.id) setProgSelectionne(p => ({ ...p, est_favori: !p.est_favori }));
  }

  async function supprimerProg(id) {
    await base44.entities.Programme.delete(id);
    setProgrammes(prev => prev.filter(p => p.id !== id));
    if (progSelectionne?.id === id) { setProgSelectionne(null); setVue('liste'); }
  }

  function toggleCategorie(cat) {
    setFormGen(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat]
    }));
  }

  function toggleJourTravail(idx) {
    setFormGen(f => ({
      ...f,
      joursTravail: f.joursTravail.includes(idx)
        ? f.joursTravail.filter(j => j !== idx)
        : [...f.joursTravail, idx]
    }));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>;

  // Vue détail programme
  if (vue === 'detail' && progSelectionne) {
    const prog = progSelectionne;
    const jours = prog.jours || [];
    const joursActifs = jours.filter(j => j.actif);
    const creneaux = prog.creneaux || [];
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setVue('liste')} className="text-muted-foreground hover:text-foreground transition-colors text-sm font-semibold">← Retour</button>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground truncate">{prog.nom}</span>
        </div>
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-black text-foreground">{prog.nom}</h1>
            {prog.description && <p className="text-sm text-muted-foreground mt-1">{prog.description}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => toggleFavori(prog)} className="p-2 rounded-xl border border-border hover:border-gold transition-colors" style={{ background: 'var(--surface)' }}>
              <Star size={16} style={{ color: prog.est_favori ? 'var(--gold)' : '#666677', fill: prog.est_favori ? 'var(--gold)' : 'none' }} />
            </button>
            <button onClick={() => supprimerProg(prog.id)} className="p-2 rounded-xl border border-destructive/40 hover:bg-destructive/10 transition-colors" style={{ background: 'var(--surface)' }}>
              <Trash2 size={16} className="text-destructive" />
            </button>
          </div>
        </div>

        {/* Jours actifs toggles */}
        {jours.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">JOURS ACTIFS</p>
            <div className="flex gap-2 flex-wrap">
              {jours.map(j => (
                <button key={j.id} onClick={() => toggleJourActif(j.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={j.actif
                    ? { background: prog.couleur_theme || 'var(--gold)', color: '#080810' }
                    : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
                >{j.nom.slice(0, 3)}</button>
              ))}
            </div>
          </div>
        )}

        {/* Bouton ajouter créneau */}
        <div className="mb-4">
          <button onClick={() => setShowAddCreneau(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: 'var(--gold)', color: '#080810' }}
          >
            <Plus size={16} /> Ajouter un créneau
          </button>
        </div>

        {/* Tableau hebdo */}
        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-bold w-24">HORAIRE</th>
                  {joursActifs.map(j => (
                    <th key={j.id} className="p-3 text-muted-foreground font-bold text-center min-w-[80px]">{j.nom.slice(0,3).toUpperCase()}</th>
                  ))}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {creneaux.length === 0 ? (
                  <tr><td colSpan={joursActifs.length + 2} className="p-8 text-center text-muted-foreground">Aucun créneau — cliquez sur "Ajouter un créneau"</td></tr>
                ) : (
                  creneaux.map((cr, i) => {
                    const catDefaut = CATEGORIES[cr.categorie] || CATEGORIES.autre;
                    return (
                      <tr key={cr.id} className={i % 2 === 0 ? '' : 'bg-accent/30'}>
                        <td className="p-3 text-muted-foreground font-mono whitespace-nowrap">{cr.libelle}</td>
                        {joursActifs.map(j => {
                          const cellule = cr.cellules?.[j.id];
                          const contenu = cellule?.contenu || cr.contenu || '';
                          const cat = CATEGORIES[cellule?.categorie || cr.categorie] || CATEGORIES.autre;
                          return (
                            <td key={j.id} className="p-2 text-center">
                              {contenu ? (
                                <div className="rounded-lg px-2 py-1.5 text-xs font-semibold" style={{ background: `${cat.color}20`, color: cat.color }}>
                                  <div>{cat.emoji}</div>
                                  <div className="mt-0.5 text-[10px] leading-tight">{contenu}</div>
                                </div>
                              ) : (
                                <div className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground" style={{ background: 'rgba(255,255,255,0.03)' }}>—</div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setFormCreneau({ libelle: cr.libelle || '', contenu: cr.contenu || '', categorie: cr.categorie || 'autre' }); setEditCreneau(cr); }}
                              className="p-1 rounded hover:bg-accent opacity-50 hover:opacity-100 transition-opacity"
                              title="Modifier le créneau"
                            >
                              <Pencil size={12} className="text-muted-foreground" />
                            </button>
                            <button onClick={() => supprimerCreneau(cr.id)} className="p-1 rounded hover:bg-destructive/20 opacity-50 hover:opacity-100 transition-opacity">
                              <Trash2 size={12} className="text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal ajout créneau */}
        {showAddCreneau && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-md rounded-2xl border border-border p-6" style={{ background: '#0D0D18' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-black text-foreground">Nouveau créneau</h2>
                <button onClick={() => setShowAddCreneau(false)}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">HORAIRE (ex: 8h00 - 9h00)</label>
                  <input value={formCreneau.libelle} onChange={e => setFormCreneau(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="8h00 - 9h00"
                    className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">CONTENU</label>
                  <input value={formCreneau.contenu} onChange={e => setFormCreneau(f => ({ ...f, contenu: e.target.value }))}
                    placeholder="Ex: Révision, Sport, Prière..."
                    className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">CATÉGORIE</label>
                  <select value={formCreneau.categorie} onChange={e => setFormCreneau(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={ajouterCreneau}
                  className="w-full py-3 rounded-xl font-black text-sm tracking-wide"
                  style={{ background: 'var(--gold)', color: '#080810' }}
                >
                  AJOUTER LE CRÉNEAU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal modification créneau */}
        {editCreneau && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-md rounded-2xl border border-border p-6" style={{ background: '#0D0D18' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-black text-foreground">Modifier le créneau</h2>
                <button onClick={() => { setEditCreneau(null); setFormCreneau({ libelle: '', contenu: '', categorie: 'travail' }); }}><X size={20} className="text-muted-foreground" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">HORAIRE (ex: 8h00 - 9h00)</label>
                  <input value={formCreneau.libelle} onChange={e => setFormCreneau(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="8h00 - 9h00"
                    className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">CONTENU</label>
                  <input value={formCreneau.contenu} onChange={e => setFormCreneau(f => ({ ...f, contenu: e.target.value }))}
                    placeholder="Ex: Révision, Sport, Prière..."
                    className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">CATÉGORIE</label>
                  <select value={formCreneau.categorie} onChange={e => setFormCreneau(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={modifierCreneau}
                  className="w-full py-3 rounded-xl font-black text-sm tracking-wide"
                  style={{ background: 'var(--gold)', color: '#080810' }}
                >
                  ENREGISTRER LES MODIFICATIONS
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vue nouveau programme (avec l'import/scanner intégré ici)
  if (vue === 'nouveau') {
    return (
      <div className="p-4 lg:p-8 max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { setVue('liste'); setEtape(0); setVoie(null); }} className="text-sm font-semibold text-muted-foreground hover:text-foreground">← Retour</button>
          {voie !== 'scanner' && (
            <>
              <div className="h-1 flex-1 mx-4 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${((etape + 1) / 3) * 100}%`, background: 'var(--gold)' }} />
              </div>
              <span className="text-xs font-bold text-muted-foreground">{etape + 1}/3</span>
            </>
          )}
        </div>

        {/* Étape 1 — Choisir la voie (incluant l'import / scanner) */}
        {etape === 0 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-black text-foreground mb-2">Nouveau programme</h2>
            <p className="text-sm text-muted-foreground mb-6">Choisissez comment créer votre programme.</p>
            <div className="space-y-3">
              {[
                { id: 'generer', emoji: '✨', titre: 'Génération guidée', desc: 'Quelques questions → programme automatique', color: 'var(--gold)' },
                { id: 'template', emoji: '📋', titre: 'Utiliser un template', desc: 'Modèle prêt à l\'emploi (étudiant, sportif…)', color: '#9B59B6' },
                { id: 'scanner', emoji: '📷', titre: 'Importer un fichier / Scanner', desc: 'Importer une image ou un document (OCR)', color: '#2ECC71' },
                { id: 'manuel', emoji: '🛠️', titre: 'Créer manuellement', desc: 'Partir d\'un tableau vide', color: '#3498DB' },
              ].map(v => (
                <button key={v.id} onClick={() => { 
                  if (v.id === 'scanner') {
                    setShowScanner(true);
                  } else {
                    setVoie(v.id); 
                    setEtape(1); 
                  }
                }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left hover:border-gold"
                  style={{ background: 'var(--surface)', borderColor: voie === v.id ? 'var(--gold)' : 'var(--border)' }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${v.color}20`, border: `1px solid ${v.color}40` }}>{v.emoji}</div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{v.titre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal du Scanner déclenché depuis "+ Nouveau" */}
        {showScanner && (
          <ScannerOCR
            onProgrammeCreated={prog => {
              setProgrammes(prev => [prog, ...prev]);
              setProgSelectionne(prog);
              setVue('detail');
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Étape 2 — Détails */}
        {etape === 1 && voie === 'generer' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-xl font-black text-foreground mb-2">Personnalisez</h2>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM DU PROGRAMME</label>
              <input value={formGen.nom} onChange={e => setFormGen(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ma semaine type..."
                className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">RÉVEIL</label>
                <input value={formGen.reveil} onChange={e => setFormGen(f => ({ ...f, reveil: e.target.value }))}
                  placeholder="6h30" className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">COUCHER</label>
                <input value={formGen.coucher} onChange={e => setFormGen(f => ({ ...f, coucher: e.target.value }))}
                  placeholder="22h30" className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">JOURS ACTIFS</label>
              <div className="flex gap-2 flex-wrap">
                {JOURS_ABREV.map((j, i) => (
                  <button key={i} onClick={() => toggleJourTravail(i)}
                    className="w-10 h-10 rounded-xl text-xs font-bold transition-all"
                    style={formGen.joursTravail.includes(i) ? { background: 'var(--gold)', color: '#080810' } : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
                  >{j}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">ACTIVITÉS</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORIES).filter(([k]) => k !== 'autre').map(([k, v]) => {
                  const sel = formGen.categories.includes(k);
                  return (
                    <button key={k} onClick={() => toggleCategorie(k)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={sel ? { background: `${v.color}30`, color: v.color, border: `1px solid ${v.color}` } : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
                    >{v.emoji} {v.label}</button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEtape(0)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">Retour</button>
              <button onClick={() => setEtape(2)} className="flex-2 py-2.5 px-6 rounded-xl text-sm font-black" style={{ background: 'var(--gold)', color: '#080810' }}>Continuer →</button>
            </div>
          </div>
        )}

        {etape === 1 && voie === 'template' && (
          <div className="animate-fade-in space-y-3">
            <h2 className="text-xl font-black text-foreground mb-4">Choisir un template</h2>
            {TEMPLATES.map(tpl => (
              <button key={tpl.id} onClick={() => setTemplateChoisi(tpl)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left"
                style={{ background: 'var(--surface)', borderColor: templateChoisi?.id === tpl.id ? tpl.couleur : 'var(--border)', borderWidth: templateChoisi?.id === tpl.id ? 2 : 1 }}
              >
                <span className="text-3xl">{tpl.emoji}</span>
                <div>
                  <p className="font-bold text-sm text-foreground">{tpl.nom}</p>
                  <p className="text-xs text-muted-foreground">{tpl.creneaux.length} créneaux</p>
                </div>
              </button>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEtape(0)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">Retour</button>
              <button onClick={() => setEtape(2)} disabled={!templateChoisi} className="flex-2 py-2.5 px-6 rounded-xl text-sm font-black disabled:opacity-50" style={{ background: 'var(--gold)', color: '#080810' }}>Continuer →</button>
            </div>
          </div>
        )}

        {etape === 1 && voie === 'manuel' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-xl font-black text-foreground mb-2">Tableau vide</h2>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM DU PROGRAMME</label>
              <input value={nomManuel} onChange={e => setNomManuel(e.target.value)}
                placeholder="Mon programme..."
                className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEtape(0)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">Retour</button>
              <button onClick={() => setEtape(2)} disabled={!nomManuel.trim()} className="flex-2 py-2.5 px-6 rounded-xl text-sm font-black disabled:opacity-50" style={{ background: 'var(--gold)', color: '#080810' }}>Continuer →</button>
            </div>
          </div>
        )}

        {/* Étape 3 — Confirmation */}
        {etape === 2 && (
          <div className="animate-fade-in text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-black text-foreground mb-2">Programme prêt !</h2>
            <p className="text-sm text-muted-foreground mb-8">Votre programme va être créé.</p>
            <button onClick={voie === 'generer' ? creerDepuisGeneration : voie === 'template' ? creerDepuisTemplate : creerVide}
              className="w-full py-3 rounded-xl font-black text-sm tracking-wide mb-3"
              style={{ background: 'var(--gold)', color: '#080810' }}
            >
              📅 CRÉER LE PROGRAMME
            </button>
            <button onClick={() => setEtape(1)} className="w-full py-3 rounded-xl font-bold text-sm border border-border text-muted-foreground">
              Modifier
            </button>
          </div>
        )}
      </div>
    );
  }

  // Vue liste principale (le bouton Scanner a été retiré d'ici pour être mis sous "+ Nouveau")
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-black text-foreground">Mes Programmes</h1>
          <p className="text-sm text-muted-foreground">{programmes.length} programme{programmes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowGenerateurIA(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm border border-border hover:border-gold transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--gold)' }}
          >
            <Sparkles size={14} /> IA
          </button>
          <button onClick={() => { setVue('nouveau'); setEtape(0); setVoie(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm"
            style={{ background: 'var(--gold)', color: '#080810' }}
          >
            <Plus size={16} /> Nouveau
          </button>
        </div>
      </div>

      {showGenerateurIA && (
        <GenerateurIA
          onProgrammeCreated={prog => setProgrammes(prev => [prog, ...prev])}
          onClose={() => setShowGenerateurIA(false)}
        />
      )}

      {programmes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-semibold">Aucun programme</p>
          <p className="text-sm">Créez votre premier programme hebdomadaire</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programmes.map(prog => (
            <button key={prog.id} onClick={() => { setProgSelectionne(prog); setVue('detail'); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border hover:border-gold text-left transition-all"
              style={{ background: 'var(--surface)' }}
            >
              <div className="w-2 h-12 rounded-full shrink-0" style={{ background: prog.couleur_theme || 'var(--gold)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground truncate">{prog.nom}</p>
                  {prog.est_favori && <Star size={12} style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{(prog.creneaux || []).length} créneaux · {(prog.jours || []).filter(j => j.actif).length} jours actifs</p>
                {prog.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{prog.description}</p>}
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
