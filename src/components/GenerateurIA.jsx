import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { JOURS } from '@/lib/coachData';
import { Sparkles, X, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';

const OBJECTIFS_SUGGERES = [
  { label: '🎓 Réussir mes examens', desc: 'Étudiant en période de révision' },
  { label: '💪 Me remettre en forme', desc: 'Sport + alimentation équilibrée' },
  { label: '💼 Lancer mon business', desc: 'Entrepreneur / freelance' },
  { label: '🧘 Équilibre vie-travail', desc: 'Productif + temps pour soi' },
  { label: '📖 Apprendre une compétence', desc: 'Formation + pratique quotidienne' },
  { label: '🙏 Vie spirituelle + discipline', desc: 'Prières + sport + études' },
];

export default function GenerateurIA({ onProgrammeCreated, onClose }) {
  const [etape, setEtape] = useState(0); // 0=objectif, 1=details, 2=generation
  const [objectifTexte, setObjectifTexte] = useState('');
  const [reveil, setReveil] = useState('6h30');
  const [coucher, setCoucher] = useState('22h30');
  const [joursTravail, setJoursTravail] = useState([0,1,2,3,4]);
  const [loading, setLoading] = useState(false);
  const [programmeGenere, setProgrammeGenere] = useState(null);
  const [nomProg, setNomProg] = useState('');

  const JOURS_ABREV = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  function toggleJour(i) {
    setJoursTravail(prev => prev.includes(i) ? prev.filter(j => j !== i) : [...prev, i]);
  }

  async function generer() {
    if (!objectifTexte.trim()) return;
    setLoading(true);
    setEtape(2);

    const joursActifsNoms = joursTravail.map(i => JOURS[i]);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tu es un coach de vie expert. Génère un programme hebdomadaire COMPLET et réaliste en français pour quelqu'un dont l'objectif est : "${objectifTexte}".

Contraintes IMPORTANTES :
- Réveil : ${reveil}
- Coucher : ${coucher}
- Jours actifs : ${joursActifsNoms.join(', ')}
- Génère entre 8 et 12 créneaux horaires pour couvrir toute la journée
- Chaque créneau doit avoir un contenu DIFFÉRENT selon le jour (ex: sport le lundi, révision le mardi, etc.)
- Les créneaux fixes (repas, réveil, sommeil) sont identiques tous les jours
- Les créneaux variables (sport, étude, loisir) varient selon le jour

Structure OBLIGATOIRE :
- "libelle" : format exact "HHhMM-HHhMM" (ex: "06h30-07h00")
- "contenu_par_jour" : objet avec le nom du jour comme clé et l'activité comme valeur
- "categorie" : catégorie dominante du créneau

Exemple de créneau variable :
{
  "libelle": "17h00-19h00",
  "contenu_par_jour": { "Lundi": "Sport - musculation", "Mardi": "Révision cours", "Mercredi": "Sport - cardio", "Jeudi": "Projet personnel", "Vendredi": "Loisir / détente" },
  "categorie": "sport"
}

Exemple de créneau fixe :
{
  "libelle": "12h30-13h30",
  "contenu_par_jour": { "Lundi": "Déjeuner", "Mardi": "Déjeuner", "Mercredi": "Déjeuner", "Jeudi": "Déjeuner", "Vendredi": "Déjeuner" },
  "categorie": "repas"
}`,
      response_json_schema: {
        type: "object",
        properties: {
          nom: { type: "string" },
          description: { type: "string" },
          couleur_theme: { type: "string", description: "Couleur hex ex: #F97316" },
          creneaux: {
            type: "array",
            items: {
              type: "object",
              properties: {
                libelle: { type: "string" },
                contenu_par_jour: { type: "object" },
                categorie: { type: "string", enum: ["priere","sport","etude","repas","sommeil","loisir","travail","autre"] }
              },
              required: ["libelle", "contenu_par_jour", "categorie"]
            }
          }
        },
        required: ["nom", "creneaux"]
      }
    });

    // Convertir le format "contenu_par_jour" vers le format interne "cellules"
    // cellules: { [jourId]: { contenu, categorie } }
    const joursMap = {};
    JOURS.forEach((j, idx) => { joursMap[j] = String(idx); });

    const creneaux = (result.creneaux || []).map((cr, idx) => {
      const cellules = {};
      const contenuParJour = cr.contenu_par_jour || {};

      // Pour chaque jour actif, remplir la cellule
      joursActifsNoms.forEach(nomJour => {
        const jourId = joursMap[nomJour];
        if (jourId !== undefined) {
          cellules[jourId] = {
            contenu: contenuParJour[nomJour] || cr.contenu || '',
            categorie: cr.categorie
          };
        }
      });

      // Fallback : contenu commun si pas de contenu_par_jour
      const contenuCommun = Object.values(contenuParJour)[0] || cr.contenu || '';

      return {
        id: `cr_${idx}`,
        libelle: cr.libelle,
        contenu: contenuCommun,
        categorie: cr.categorie,
        cellules
      };
    });

    const data = {
      nom: result.nom || `Programme – ${objectifTexte.slice(0, 30)}`,
      description: result.description || objectifTexte,
      couleur_theme: result.couleur_theme || '#F97316',
      jours: JOURS.map((j, idx) => ({ id: String(idx), nom: j, actif: joursTravail.includes(idx) })),
      creneaux
    };

    setNomProg(data.nom);
    setProgrammeGenere(data);
    setLoading(false);
  }

  async function sauvegarder() {
    const prog = await base44.entities.Programme.create({ ...programmeGenere, nom: nomProg });
    onProgrammeCreated(prog);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg rounded-2xl border border-border animate-fade-in overflow-hidden" style={{ background: '#0D0D18', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--gold)' }} />
            <h2 className="text-base font-black text-foreground">Générateur IA de programme</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        <div className="p-5">

          {/* Étape 0 — Objectif */}
          {etape === 0 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-muted-foreground">Quel est votre objectif principal cette semaine ?</p>

              <div className="grid grid-cols-1 gap-2">
                {OBJECTIFS_SUGGERES.map((obj, i) => (
                  <button key={i} onClick={() => setObjectifTexte(obj.label)}
                    className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-gold"
                    style={{
                      background: objectifTexte === obj.label ? 'rgba(249,115,22,0.12)' : 'var(--accent)',
                      borderColor: objectifTexte === obj.label ? 'var(--gold)' : 'var(--border)'
                    }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{obj.label}</p>
                      <p className="text-xs text-muted-foreground">{obj.desc}</p>
                    </div>
                    {objectifTexte === obj.label && <CheckCircle2 size={16} style={{ color: 'var(--gold)' }} />}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">OU DÉCRIVEZ VOTRE OBJECTIF</label>
                <textarea
                  value={objectifTexte}
                  onChange={e => setObjectifTexte(e.target.value)}
                  placeholder="Ex: Je veux réviser mon code pour devenir développeur tout en faisant du sport 3x par semaine..."
                  rows={3}
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold resize-none"
                />
              </div>

              <button onClick={() => setEtape(1)} disabled={!objectifTexte.trim()}
                className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--gold)', color: '#080810' }}
              >
                Continuer <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Étape 1 — Détails horaires */}
          {etape === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="px-3 py-2 rounded-xl text-sm font-semibold truncate" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--gold)' }}>
                🎯 {objectifTexte}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">RÉVEIL</label>
                  <input value={reveil} onChange={e => setReveil(e.target.value)}
                    placeholder="6h30"
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">COUCHER</label>
                  <input value={coucher} onChange={e => setCoucher(e.target.value)}
                    placeholder="22h30"
                    className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">JOURS ACTIFS</label>
                <div className="flex gap-2 flex-wrap">
                  {JOURS_ABREV.map((j, i) => (
                    <button key={i} onClick={() => toggleJour(i)}
                      className="w-10 h-10 rounded-xl text-xs font-bold transition-all"
                      style={joursTravail.includes(i)
                        ? { background: 'var(--gold)', color: '#080810' }
                        : { background: 'var(--surface)', color: '#666677', border: '1px solid var(--border)' }}
                    >{j}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setEtape(0)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">Retour</button>
                <button onClick={generer}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-2"
                  style={{ background: 'var(--gold)', color: '#080810' }}
                >
                  <Sparkles size={14} /> Générer
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 — Génération / Résultat */}
          {etape === 2 && (
            <div className="animate-fade-in">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 size={36} className="animate-spin" style={{ color: 'var(--gold)' }} />
                  <p className="text-sm font-bold text-foreground">L'IA construit votre programme…</p>
                  <p className="text-xs text-muted-foreground text-center">Analyse de vos objectifs et génération des créneaux optimaux</p>
                </div>
              ) : programmeGenere && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={18} style={{ color: '#2ECC71' }} />
                    <span className="text-sm font-black text-foreground">Programme généré !</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM DU PROGRAMME</label>
                    <input value={nomProg} onChange={e => setNomProg(e.target.value)}
                      className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                    />
                  </div>

                  {programmeGenere.description && (
                    <p className="text-xs text-muted-foreground px-3 py-2 rounded-xl" style={{ background: 'var(--accent)' }}>
                      {programmeGenere.description}
                    </p>
                  )}

                  {/* Aperçu des créneaux */}
                  <div className="rounded-xl border border-border overflow-hidden" style={{ background: 'var(--surface)' }}>
                    <div className="p-3 border-b border-border">
                      <p className="text-xs font-bold tracking-widest text-muted-foreground">{programmeGenere.creneaux.length} CRÉNEAUX GÉNÉRÉS</p>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-border">
                      {programmeGenere.creneaux.map((cr, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2">
                          <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{cr.libelle}</span>
                          <span className="text-xs text-foreground truncate">{cr.contenu}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setEtape(1); setProgrammeGenere(null); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">
                      Regénérer
                    </button>
                    <button onClick={sauvegarder}
                      className="flex-1 py-2.5 rounded-xl text-sm font-black"
                      style={{ background: 'var(--gold)', color: '#080810' }}
                    >
                      ✅ Sauvegarder
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}