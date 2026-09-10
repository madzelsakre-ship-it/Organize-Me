import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Upload, X, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { JOURS } from '@/lib/coachData';

export default function ScannerOCR({ onProgrammeCreated, onClose }) {
  const [etape, setEtape] = useState('upload'); // upload | analyse | resultat | erreur
  const [imageUrl, setImageUrl] = useState(null);
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef();
  const lastFileRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    lastFileRef.current = file;
    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Tu es un assistant qui extrait des emplois du temps. Analyse cette image d'un emploi du temps (scolaire, sportif ou autre) et extrais tous les créneaux horaires visibles.

Retourne un JSON avec cette structure exacte :
{
  "nom": "Nom du programme détecté",
  "creneaux": [
    { "libelle": "08h00-10h00", "contenu": "Description de l'activité", "categorie": "etude|sport|travail|repas|sommeil|priere|loisir|autre" }
  ]
}

Règles :
- libelle = format "HHhMM-HHhMM"
- contenu = nom court de l'activité
- categorie = une des valeurs listées
- Si l'image n'est pas un emploi du temps, retourne { "nom": "Programme importé", "creneaux": [] }
- Maximum 20 créneaux`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            nom: { type: "string" },
            creneaux: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  libelle: { type: "string" },
                  contenu: { type: "string" },
                  categorie: { type: "string" }
                }
              }
            }
          }
        }
      });

      setProgramme(result);
      setEtape('resultat');
    } catch (err) {
      const detail = err?.message || String(err);
      setErrorMsg(
        detail.includes('size') || detail.includes('large')
          ? 'Le fichier est trop volumineux. Essayez une image plus légère.'
          : `Échec du scan : ${detail}. Vérifiez votre connexion et réessayez.`
      );
      setEtape('erreur');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function validerProgramme() {
    if (!programme) return;
    setLoading(true);
    const prog = await base44.entities.Programme.create({
      nom: programme.nom || 'Programme scanné',
      description: 'Importé par scanner IA',
      couleur_theme: '#3498DB',
      jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
      creneaux: (programme.creneaux || []).map((cr, i) => ({
        id: `cr_${i}`,
        ...cr,
        cellules: {}
      }))
    });
    setLoading(false);
    onProgrammeCreated(prog);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera size={18} style={{ color: 'var(--gold)' }} />
            <h2 className="text-base font-black text-foreground">Scanner OCR</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        {/* Étape : Upload */}
        {etape === 'upload' && (
          <div>
            <p className="text-sm text-muted-foreground mb-5">
              Prenez en photo votre emploi du temps (papier, tableau, pdf…). L'IA va extraire tous les créneaux automatiquement.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-bold text-foreground">Cliquez pour sélectionner</p>
              <p className="text-xs text-muted-foreground mt-1">Photo, capture d'écran, scan PDF…</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {/* Étape : Analyse */}
        {etape === 'analyse' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gold-dim)' }}>
              <Sparkles size={28} style={{ color: 'var(--gold)' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Analyse en cours…</p>
            <p className="text-sm text-muted-foreground mb-6">L'IA lit votre emploi du temps</p>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--gold)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Étape : Erreur */}
        {etape === 'erreur' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(231,76,60,0.15)' }}>
              <X size={28} style={{ color: '#E74C3C' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Scan impossible</p>
            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
            <button onClick={() => lastFileRef.current ? handleFile(lastFileRef.current) : setEtape('upload')}
              className="w-full py-3 rounded-xl font-black text-sm"
              style={{ background: 'var(--gold)', color: '#080810' }}>
              Réessayer
            </button>
          </div>
        )}

        {/* Étape : Résultat */}
        {etape === 'resultat' && programme && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} style={{ color: '#2ECC71' }} />
              <p className="text-sm font-bold text-foreground">{programme.creneaux?.length || 0} créneaux détectés</p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM DU PROGRAMME</label>
              <input
                value={programme.nom || ''}
                onChange={e => setProgramme(p => ({ ...p, nom: e.target.value }))}
                className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
              />
            </div>

            <div className="rounded-xl border border-border overflow-hidden mb-5 max-h-48 overflow-y-auto" style={{ background: 'var(--surface)' }}>
              {(programme.creneaux || []).length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Aucun créneau détecté. Essayez une meilleure photo.</p>
              ) : (
                programme.creneaux.map((cr, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{cr.libelle}</span>
                    <span className="text-sm text-foreground">{cr.contenu}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEtape('upload')} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">
                Recommencer
              </button>
              <button onClick={validerProgramme} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#080810' }}>
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : '✅ Créer le programme'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}