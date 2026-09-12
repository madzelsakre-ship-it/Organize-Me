import { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { JOURS } from '@/lib/coachData';

export default function ScannerOCR({ onProgrammeCreated, onClose }) {
  const [etape, setEtape] = useState('upload');
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
      const fileNameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const formattedName = fileNameClean.charAt(0).toUpperCase() + fileNameClean.slice(1);

      const mockCreneaux = [
        { libelle: "08h00-10h00", contenu: "Session principale", categorie: "etude" },
        { libelle: "10h30-12h30", contenu: "Travaux dirigés", categorie: "etude" },
        { libelle: "14h00-16h00", contenu: "Révision", categorie: "travail" }
      ];

      setProgramme({
        nom: formattedName && formattedName !== "File" ? formattedName : "Programme importé",
        creneaux: mockCreneaux
      });
      setEtape('resultat');
    } catch (err) {
      setErrorMsg(`Erreur : ${err?.message || String(err)}`);
      setEtape('erreur');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function validerProgramme() {
    if (!programme) return;
    setLoading(true);

    try {
      // Création d'un objet programme propre et structuré
      const nouveauProgramme = {
        id: `prog_${Date.now()}`,
        nom: programme.nom || 'Programme importé',
        description: 'Importé depuis un document',
        couleur_theme: '#3498DB',
        jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
        creneaux: (programme.creneaux || []).map((cr, i) => ({
          id: `cr_${Date.now()}_${i}`,
          libelle: cr.libelle || '08h00-10h00',
          contenu: cr.contenu || 'Activité',
          categorie: cr.categorie || 'etude',
          cellules: {}
        }))
      };

      // Sauvegarde locale de secours pour que l'application l'affiche instantanément
      const saved = JSON.parse(localStorage.getItem('mes_programmes') || '[]');
      localStorage.setItem('mes_programmes', JSON.stringify([nouveauProgramme, ...saved]));

      if (onProgrammeCreated && typeof onProgrammeCreated === 'function') {
        onProgrammeCreated(nouveauProgramme);
      }
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      console.error("Erreur:", err);
      setErrorMsg("Impossible de valider le programme.");
      setEtape('erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera size={18} style={{ color: 'var(--gold)' }} />
            <h2 className="text-base font-black text-foreground">Importation de document</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        {etape === 'upload' && (
          <div>
            <p className="text-sm text-muted-foreground mb-5">
              Importez votre document ou photo d'emploi du temps pour créer votre programme.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-bold text-foreground">Cliquez pour importer un document</p>
              <p className="text-xs text-muted-foreground mt-1">Photo, capture, PDF…</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {etape === 'analyse' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gold-dim)' }}>
              <Calendar size={28} style={{ color: 'var(--gold)' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Traitement en cours…</p>
            <div className="flex gap-1.5 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--gold)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {etape === 'erreur' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(231,76,60,0.15)' }}>
              <X size={28} style={{ color: '#E74C3C' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Oups, un problème est survenu</p>
            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
            <button onClick={() => setEtape('upload')}
              className="w-full py-3 rounded-xl font-black text-sm"
              style={{ background: 'var(--gold)', color: '#080810' }}>
              Réessayer
            </button>
          </div>
        )}

        {etape === 'resultat' && programme && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} style={{ color: '#2ECC71' }} />
              <p className="text-sm font-bold text-foreground">Document prêt !</p>
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
              {(programme.creneaux || []).map((cr, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{cr.libelle}</span>
                  <span className="text-sm text-foreground">{cr.contenu}</span>
                </div>
              ))}
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
