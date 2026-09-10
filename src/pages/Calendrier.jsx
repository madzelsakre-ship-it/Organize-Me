import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CATEGORIES, JOURS } from '@/lib/coachData';
import { ChevronLeft, ChevronRight, Sparkles, X, CheckCircle2, Loader2, StickyNote, Bell, Plus, Trash2 } from 'lucide-react';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h à 23h

function parseMin(heure) {
  if (!heure) return null;
  const match = heure.match(/(\d+)h(\d*)/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
}

function parseCreneauRange(libelle) {
  if (!libelle) return null;
  // Format "HHhMM-HHhMM" ou "HHhMM - HHhMM"
  const match = libelle.replace(/\s/g, '').match(/(\d+)h(\d*)-(\d+)h(\d*)/);
  if (!match) return null;
  const debut = parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
  const fin = parseInt(match[3]) * 60 + (parseInt(match[4]) || 0);
  return { debut, fin };
}

// Retourne la semaine (lundi → dimanche) contenant une date donnée
function getSemaine(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim
  const diff = day === 0 ? -6 : 1 - day; // décalage vers lundi
  const lundi = new Date(d);
  lundi.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const j = new Date(lundi);
    j.setDate(lundi.getDate() + i);
    return j;
  });
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

const CELL_HEIGHT = 64; // px par heure
const TOP_OFFSET = 6 * 60; // l'axe commence à 6h00

function EventBlock({ top, height, color, emoji, label, opacity = 1 }) {
  return (
    <div
      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden"
      style={{
        top,
        height: Math.max(height, 20),
        background: `${color}22`,
        borderLeft: `3px solid ${color}`,
        opacity,
        zIndex: 1,
      }}
    >
      <p className="text-[10px] font-bold leading-tight truncate" style={{ color }}>
        {emoji} {label}
      </p>
    </div>
  );
}

export default function Calendrier() {
  const [semaine, setSemaine] = useState(getSemaine(new Date()));
  const [taches, setTaches] = useState([]);
  const [programme, setProgramme] = useState(null);
  const [habitudes, setHabitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [showGenModal, setShowGenModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [noteModal, setNoteModal] = useState(null); // { date: 'YYYY-MM-DD' } ou null
  const [noteForm, setNoteForm] = useState({ titre: '', contenu: '', heure_rappel: '' });
  const [savingNote, setSavingNote] = useState(false);

  const today = formatDate(new Date());

  useEffect(() => {
    Promise.all([
      base44.entities.Tache.list('-created_date', 300),
      base44.entities.Programme.list('-created_date', 20),
      base44.entities.Habitude.list('-created_date', 100),
      base44.entities.NoteCalendrier.list('-date', 200),
    ]).then(([t, p, h, n]) => {
      setTaches(t);
      const fav = p.find(pr => pr.est_favori) || p[0] || null;
      setProgramme(fav);
      setHabitudes(h.filter(hb => !hb.archivee));
      setNotes(n);
      setLoading(false);
    });
  }, []);

  async function genererSemaine() {
    setGenerating(true);
    setGenResult(null);

    const tachesHaute = taches.filter(t => t.priorite === 'haute' && !t.faite).slice(0, 10);
    const habitudesActives = habitudes.slice(0, 10);

    // Construire la liste des jours avec leurs dates ISO réelles
    const joursAvecDates = semaine.map((d, i) => ({
      nom: JOURS[i],
      date: formatDate(d),
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un coach de productivité expert. Génère un planning hebdomadaire pour cette semaine précise.

Jours disponibles (utilise EXACTEMENT ces dates ISO pour le champ "jour") :
${joursAvecDates.map(j => `- ${j.nom} → "${j.date}"`).join('\n')}

Tâches haute priorité à planifier : ${tachesHaute.map(t => `"${t.titre}" (${t.categorie})`).join(', ') || 'aucune'}
Habitudes à intégrer : ${habitudesActives.map(h => `"${h.nom}" (${h.categorie}, jours cibles: ${(h.jours_cibles || []).map(i => JOURS[i]).join('/')})`).join(', ') || 'aucune'}

Règles :
- Le champ "jour" doit être une date ISO exacte parmi celles listées ci-dessus (ex: "${joursAvecDates[0].date}")
- Répartis les tâches intelligemment sur la semaine
- Horaires réalistes entre 06h00 et 22h00
- Format heure : "HHhMM" (ex: "08h00", "14h30")
- Maximum 3-4 tâches par jour`,
      response_json_schema: {
        type: "object",
        properties: {
          taches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titre: { type: "string" },
                jour: { type: "string" },
                heure: { type: "string" },
                categorie: { type: "string", enum: ["priere","sport","etude","repas","sommeil","loisir","travail","autre"] },
                priorite: { type: "string", enum: ["haute","normale","basse"] }
              },
              required: ["titre","jour","heure","categorie","priorite"]
            }
          }
        },
        required: ["taches"]
      }
    });

    // Valider que les dates générées appartiennent bien à la semaine
    const datesValides = new Set(joursAvecDates.map(j => j.date));
    const tachesFiltrees = (result.taches || []).filter(t => datesValides.has(t.jour));
    setGenResult(tachesFiltrees);
    setGenerating(false);
  }

  async function confirmerGeneration() {
    if (!genResult) return;
    const nouvelles = await Promise.all(
      genResult.map(t => base44.entities.Tache.create({ ...t, faite: false }))
    );
    setTaches(prev => [...nouvelles, ...prev]);
    setGenResult(null);
    setShowGenModal(false);
  }

  function prevSemaine() {
    const d = new Date(semaine[0]);
    d.setDate(d.getDate() - 7);
    setSemaine(getSemaine(d));
  }

  function nextSemaine() {
    const d = new Date(semaine[0]);
    d.setDate(d.getDate() + 7);
    setSemaine(getSemaine(d));
  }

  function goToday() {
    setSemaine(getSemaine(new Date()));
  }

  async function sauvegarderNote() {
    if (!noteForm.titre.trim() || !noteModal) return;
    setSavingNote(true);
    const note = await base44.entities.NoteCalendrier.create({
      titre: noteForm.titre.trim(),
      contenu: noteForm.contenu.trim(),
      date: noteModal.date,
      heure_rappel: noteForm.heure_rappel || null,
      notifie: false,
    });
    setNotes(prev => [note, ...prev]);
    setNoteForm({ titre: '', contenu: '', heure_rappel: '' });
    setNoteModal(null);
    setSavingNote(false);
  }

  async function supprimerNote(id) {
    await base44.entities.NoteCalendrier.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  // Tâches indexées : par date ISO si disponible, sinon par nom de jour
  // On construit un map date ISO → tâches pour la semaine affichée
  const tachesParJour = {};
  JOURS.forEach(j => { tachesParJour[j] = []; });
  const tachesParDate = {};
  semaine.forEach(d => { tachesParDate[formatDate(d)] = []; });

  taches.forEach(t => {
    // Si le champ jour est une date ISO (YYYY-MM-DD), on l'affecte à la bonne colonne
    if (t.jour && /^\d{4}-\d{2}-\d{2}$/.test(t.jour)) {
      if (tachesParDate[t.jour] !== undefined) {
        tachesParDate[t.jour].push(t);
      }
    } else if (tachesParJour[t.jour] !== undefined) {
      tachesParJour[t.jour].push(t);
    }
  });

  // Habitudes complétées par date ISO → affichées dans la grille
  // On attribue un horaire fictif basé sur la catégorie pour les positionner
  const HABITUDE_HEURES = {
    sport: '07h00', sante: '07h30', etude: '09h00',
    spiritual: '06h00', social: '18h00', autre: '08h00',
  };
  const habitudesParDate = {};
  habitudes.forEach(hab => {
    (hab.completions || []).forEach(dateISO => {
      if (!habitudesParDate[dateISO]) habitudesParDate[dateISO] = [];
      habitudesParDate[dateISO].push(hab);
    });
  });

  // Créneaux du programme par jourId (0=Lun … 6=Dim)
  const creneauxParJour = {};
  if (programme) {
    (programme.creneaux || []).forEach(cr => {
      const range = parseCreneauRange(cr.libelle);
      if (!range) return;
      (programme.jours || []).forEach(j => {
        if (j.actif === false) return;
        const jourIdx = parseInt(j.id);
        if (!creneauxParJour[jourIdx]) creneauxParJour[jourIdx] = [];
        const cellule = cr.cellules?.[j.id];
        const contenu = cellule?.contenu || cr.contenu || '';
        const categorie = cellule?.categorie || cr.categorie || 'autre';
        creneauxParJour[jourIdx].push({ ...cr, contenu, categorie, range });
      });
    });
  }

  // Notes indexées par date ISO
  const notesParDate = {};
  notes.forEach(n => {
    if (!notesParDate[n.date]) notesParDate[n.date] = [];
    notesParDate[n.date].push(n);
  });

  const totalHeight = HOURS.length * CELL_HEIGHT;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--noir)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0" style={{ background: '#0D0D18' }}>
        <div className="flex items-center gap-2">
          <button onClick={prevSemaine} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <button onClick={nextSemaine} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <span className="text-sm font-bold text-foreground ml-1">
            {semaine[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} –{' '}
            {semaine[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {programme && (
            <span className="text-xs px-2 py-1 rounded-lg font-semibold hidden sm:inline-flex items-center gap-1"
              style={{ background: `${programme.couleur_theme || '#F97316'}20`, color: programme.couleur_theme || '#F97316', border: `1px solid ${programme.couleur_theme || '#F97316'}40` }}>
              📅 {programme.nom}
            </span>
          )}
          <button onClick={() => { setShowGenModal(true); setGenResult(null); }}
            className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-border hover:border-gold transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--gold)' }}>
            <Sparkles size={12} /> Générer
          </button>
          <button onClick={goToday}
            className="text-xs px-3 py-1.5 rounded-lg font-bold transition-colors"
            style={{ background: 'var(--gold)', color: '#080810' }}>
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Jours header */}
      <div className="flex border-b border-border shrink-0" style={{ background: '#0D0D18' }}>
        <div className="w-12 shrink-0" />
        {semaine.map((date, i) => {
          const isToday = formatDate(date) === today;
          return (
            <div key={i} className="flex-1 min-w-0 text-center py-2 border-l border-border relative">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">
                {JOURS[i].slice(0, 3).toUpperCase()}
              </p>
              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full mt-0.5 text-sm font-black ${isToday ? 'text-black' : 'text-foreground'}`}
                style={isToday ? { background: 'var(--gold)' } : {}}>
                {date.getDate()}
              </div>
              {/* Indicateur notes */}
              {(notesParDate[formatDate(date)] || []).length > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ background: 'rgba(251,191,36,0.9)', color: '#000' }}>
                  {(notesParDate[formatDate(date)] || []).length}
                </div>
              )}
              <button
                onClick={() => { setNoteModal({ date: formatDate(date) }); setNoteForm({ titre: '', contenu: '', heure_rappel: '' }); }}
                className="mt-1 w-5 h-5 rounded-full flex items-center justify-center mx-auto hover:bg-accent transition-colors"
                style={{ color: 'rgba(255,255,255,0.15)' }}
              >
                <Plus size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Grille scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: totalHeight }}>

          {/* Axe horaire */}
          <div className="w-12 shrink-0 relative" style={{ height: totalHeight }}>
            {HOURS.map((h, i) => (
              <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: i * CELL_HEIGHT, height: CELL_HEIGHT }}>
                <span className="text-[10px] text-muted-foreground font-mono -mt-2">{h}h</span>
              </div>
            ))}
          </div>

          {/* Colonnes jours */}
          {semaine.map((date, dayIdx) => {
            const jourNom = JOURS[dayIdx];
            const isToday = formatDate(date) === today;
            const dateISO = formatDate(date);
            // Fusionner tâches par date ISO + tâches par nom de jour
            const tachesJour = [...(tachesParDate[dateISO] || []), ...(tachesParJour[jourNom] || [])];
            const creneauxJour = creneauxParJour[dayIdx] || [];

            const habitudesDuJour = habitudesParDate[dateISO] || [];

            return (
              <div key={dayIdx} className="flex-1 min-w-0 border-l border-border relative" style={{ height: totalHeight }}>
                {/* Fond aujourd'hui */}
                {isToday && (
                  <div className="absolute inset-0" style={{ background: 'rgba(249,115,22,0.03)' }} />
                )}

                {/* Lignes horizontales */}
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: i * CELL_HEIGHT }} />
                ))}

                {/* Créneaux programme */}
                {creneauxJour.map((cr, idx) => {
                  const cat = CATEGORIES[cr.categorie] || CATEGORIES.autre;
                  const topPx = ((cr.range.debut - TOP_OFFSET) / 60) * CELL_HEIGHT;
                  const heightPx = ((cr.range.fin - cr.range.debut) / 60) * CELL_HEIGHT;
                  if (topPx < 0 || topPx > totalHeight) return null;
                  return (
                    <EventBlock
                      key={`cr-${idx}`}
                      top={topPx}
                      height={heightPx}
                      color={cat.color}
                      emoji={cat.emoji}
                      label={cr.contenu}
                      opacity={0.7}
                    />
                  );
                })}

                {/* Habitudes complétées */}
                {habitudesDuJour.map((hab, idx) => {
                  const heure = HABITUDE_HEURES[hab.categorie] || '08h00';
                  const min = parseMin(heure);
                  if (min === null) return null;
                  // Décaler légèrement si plusieurs habitudes à la même heure
                  const offsetY = idx * 28;
                  const topPx = ((min - TOP_OFFSET) / 60) * CELL_HEIGHT + offsetY;
                  if (topPx < 0 || topPx > totalHeight) return null;
                  const color = hab.couleur || '#9B59B6';
                  return (
                    <div key={`hab-${hab.id}`}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5"
                      style={{
                        top: topPx,
                        height: 24,
                        background: `${color}25`,
                        borderLeft: `3px solid ${color}`,
                        zIndex: 3,
                      }}
                    >
                      <p className="text-[10px] font-bold leading-tight truncate" style={{ color }}>
                        ✓ {hab.emoji || '⭐'} {hab.nom}
                      </p>
                    </div>
                  );
                })}

                {/* Notes */}
                {(notesParDate[dateISO] || []).map((note, idx) => {
                  const heure = note.heure_rappel;
                  const min = heure ? parseMin(heure) : 8 * 60 + idx * 30;
                  const topPx = Math.max(0, ((min - TOP_OFFSET) / 60) * CELL_HEIGHT);
                  return (
                    <div key={`note-${note.id}`}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 cursor-pointer"
                      style={{ top: topPx, height: 26, background: 'rgba(251,191,36,0.1)', borderLeft: '3px solid #FBBF24', zIndex: 4 }}
                      onClick={() => setNoteModal({ date: dateISO, note })}
                    >
                      <p className="text-[10px] font-bold leading-tight truncate" style={{ color: '#FBBF24' }}>
                        📌 {note.titre}
                      </p>
                    </div>
                  );
                })}

                {/* Tâches */}
                {tachesJour.map((t, idx) => {
                  const min = parseMin(t.heure);
                  if (min === null) return null;
                  const topPx = ((min - TOP_OFFSET) / 60) * CELL_HEIGHT;
                  if (topPx < 0 || topPx > totalHeight) return null;
                  const cat = CATEGORIES[t.categorie] || CATEGORIES.autre;
                  const prio = t.priorite === 'haute';
                  return (
                    <div key={`t-${t.id}`}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5"
                      style={{
                        top: topPx,
                        height: 26,
                        background: t.faite ? 'rgba(46,204,113,0.15)' : prio ? 'rgba(231,76,60,0.2)' : `${cat.color}28`,
                        borderLeft: `3px solid ${t.faite ? '#2ECC71' : prio ? '#E74C3C' : cat.color}`,
                        zIndex: 2,
                      }}
                    >
                      <p className="text-[10px] font-bold leading-tight truncate"
                        style={{ color: t.faite ? '#2ECC71' : prio ? '#E74C3C' : cat.color }}>
                        {t.faite ? '✓ ' : ''}{t.heure} {t.titre}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Génération IA */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border animate-fade-in overflow-hidden" style={{ background: '#0D0D18', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--gold)' }} />
                <h2 className="text-sm font-black text-foreground">Générer ma semaine</h2>
              </div>
              <button onClick={() => setShowGenModal(false)}><X size={18} className="text-muted-foreground" /></button>
            </div>

            <div className="p-5">
              {!genResult && !generating && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    L'IA va analyser vos <span className="font-bold text-foreground">{taches.filter(t => t.priorite === 'haute' && !t.faite).length} tâches prioritaires</span> et vos <span className="font-bold text-foreground">{habitudes.length} habitudes</span> pour planifier intelligemment votre semaine.
                  </p>
                  <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--accent)', border: '1px solid var(--border)' }}>
                    {taches.filter(t => t.priorite === 'haute' && !t.faite).slice(0, 5).map(t => {
                      const cat = CATEGORIES[t.categorie] || CATEGORIES.autre;
                      return (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <span>{cat.emoji}</span>
                          <span className="text-foreground font-semibold truncate">{t.titre}</span>
                          <span className="text-muted-foreground shrink-0">{t.jour}</span>
                        </div>
                      );
                    })}
                    {habitudes.slice(0, 3).map(h => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <span>{h.emoji || '⭐'}</span>
                        <span className="text-muted-foreground font-semibold truncate">{h.nom}</span>
                        <span className="text-xs px-1.5 rounded" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--gold)' }}>habitude</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={genererSemaine}
                    className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                    style={{ background: 'var(--gold)', color: '#080810' }}>
                    <Sparkles size={14} /> Générer le planning
                  </button>
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--gold)' }} />
                  <p className="text-sm font-bold text-foreground">L'IA planifie votre semaine…</p>
                  <p className="text-xs text-muted-foreground text-center">Analyse des priorités et des habitudes</p>
                </div>
              )}

              {genResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} style={{ color: '#2ECC71' }} />
                    <span className="text-sm font-black text-foreground">{genResult.length} tâches générées</span>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border" style={{ background: 'var(--surface)', maxHeight: 300, overflowY: 'auto' }}>
                    {genResult.map((t, i) => {
                      const cat = CATEGORIES[t.categorie] || CATEGORIES.autre;
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                          <span className="text-base">{cat.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{t.titre}</p>
                            <p className="text-xs text-muted-foreground">
                              {semaine.find(d => formatDate(d) === t.jour)
                                ? JOURS[semaine.findIndex(d => formatDate(d) === t.jour)]
                                : t.jour} · {t.heure}
                            </p>
                          </div>
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0"
                            style={{ background: t.priorite === 'haute' ? 'rgba(231,76,60,0.2)' : 'rgba(255,255,255,0.06)', color: t.priorite === 'haute' ? '#E74C3C' : '#999' }}>
                            {t.priorite}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setGenResult(null); genererSemaine(); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">
                      Regénérer
                    </button>
                    <button onClick={confirmerGeneration}
                      className="flex-1 py-2.5 rounded-xl text-sm font-black"
                      style={{ background: 'var(--gold)', color: '#080810' }}>
                      ✅ Ajouter au calendrier
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Note */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setNoteModal(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-border animate-fade-in overflow-hidden" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <StickyNote size={15} style={{ color: '#FBBF24' }} />
                <h3 className="text-sm font-black text-foreground">
                  {noteModal.note ? noteModal.note.titre : `Note · ${new Date(noteModal.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                </h3>
              </div>
              <button onClick={() => setNoteModal(null)}><X size={16} className="text-muted-foreground" /></button>
            </div>

            {noteModal.note ? (
              /* Vue lecture d'une note existante */
              <div className="p-5 space-y-4">
                {noteModal.note.heure_rappel && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#FBBF24' }}>
                    <Bell size={13} />
                    <span>Rappel à {noteModal.note.heure_rappel}</span>
                  </div>
                )}
                {noteModal.note.contenu && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{noteModal.note.contenu}</p>
                )}
                <button onClick={() => { supprimerNote(noteModal.note.id); setNoteModal(null); }}
                  className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(231,76,60,0.1)', color: '#E74C3C', border: '1px solid rgba(231,76,60,0.2)' }}>
                  <Trash2 size={12} /> Supprimer cette note
                </button>
              </div>
            ) : (
              /* Formulaire création */
              <div className="p-5 space-y-3">
                <input
                  value={noteForm.titre}
                  onChange={e => setNoteForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Titre de la note…"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white font-semibold outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <textarea
                  value={noteForm.contenu}
                  onChange={e => setNoteForm(f => ({ ...f, contenu: e.target.value }))}
                  placeholder="Détails, infos à ne pas oublier…"
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
                />
                <div>
                  <label className="text-[10px] font-bold tracking-widest block mb-1.5 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Bell size={10} /> HEURE DE RAPPEL (optionnel)
                  </label>
                  <input
                    value={noteForm.heure_rappel}
                    onChange={e => setNoteForm(f => ({ ...f, heure_rappel: e.target.value }))}
                    placeholder="ex: 09h00"
                    className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                  <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Une notification s'affichera à cette heure le {new Date(noteModal.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setNoteModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-muted-foreground"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    Annuler
                  </button>
                  <button onClick={sauvegarderNote} disabled={!noteForm.titre.trim() || savingNote}
                    className="flex-1 py-3 rounded-xl text-sm font-black disabled:opacity-40"
                    style={{ background: '#FBBF24', color: '#000' }}>
                    {savingNote ? '…' : '📌 Enregistrer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border shrink-0 overflow-x-auto" style={{ background: '#0D0D18' }}>
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground shrink-0">LÉGENDE</span>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(249,115,22,0.2)', borderLeft: '2px solid #F97316' }} />
          <span className="text-[10px] text-muted-foreground">Programme</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(52,152,219,0.2)', borderLeft: '2px solid #3498DB' }} />
          <span className="text-[10px] text-muted-foreground">Tâche</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(46,204,113,0.15)', borderLeft: '2px solid #2ECC71' }} />
          <span className="text-[10px] text-muted-foreground">Tâche faite</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(231,76,60,0.2)', borderLeft: '2px solid #E74C3C' }} />
          <span className="text-[10px] text-muted-foreground">Priorité haute</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(155,89,182,0.2)', borderLeft: '2px solid #9B59B6' }} />
          <span className="text-[10px] text-muted-foreground">Habitude ✓</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(251,191,36,0.15)', borderLeft: '2px solid #FBBF24' }} />
          <span className="text-[10px] text-muted-foreground">📌 Note</span>
        </div>
      </div>
    </div>
  );
}