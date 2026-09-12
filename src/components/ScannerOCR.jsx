import { useState, useRef } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Camera, Upload, X, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { JOURS } from '@/lib/coachData';

export default function ScannerOCR({ onProgrammeCreated, onClose }) {
  const [etape, setEtape] = useState('upload');
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');

    try {
      // 1. Upload du fichier dans Supabase Storage (bucket 'uploads')
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult?.file_url;

      // 2. Nettoyage du nom pour le titre du programme
      const fileNameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const formattedName = fileNameClean.charAt(0).toUpperCase() + fileNameClean.slice(1);

      setProgramme({
        nom: formattedName && formattedName !== "Fichier" ? formattedName : "Mon Emploi du Temps",
        fileUrl: fileUrl,
        creneaux: [
          { libelle: "08h00-10h00", contenu: "Cours principal" },
          { libelle: "10h30-12h30", contenu: "Travaux Dirigés (TD)" },
          { libelle: "14h00-16h00", contenu: "Travaux Pratiques (TP)" }
        ]
      });
      setEtape('resultat');
    } catch (err) {
      console.error("Erreur d'upload:", err);
      setErrorMsg(`Erreur : ${err?.message || String(err)}`);
      setEtape('erreur');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function validerProgramme() {
    if (!programme) return;
    setLoading(true);

    try {
      // Enregistrement dans la table Supabase via l'entité Programme
      const nouveauProgramme = await base44.entities.Programme.create({
        nom: programme.nom || 'Emploi du temps scanné',
        description: `Image source: ${programme.fileUrl || 'Importée'}`,
        couleur_theme: '#3498DB',
        jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
        creneaux: (programme.creneaux || []).map((cr, i) => ({
          id: `cr_${Date.now()}_${i}`,
          libelle: cr.libelle || '08h00-10h00',
          contenu: cr.contenu || 'Activité',
          categorie: 'etude',
          cellules: {}
        }))
      });

      if (onProgrammeCreated && typeof onProgrammeCreated === 'function') {
        onProgrammeCreated(nouveauProgramme);
      }
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      console.error("Erreur de sauvegarde:", err);
      setErrorMsg("Impossible d'enregistrer le programme dans la base de données.");
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
            <h2 className="text-base font-black text-foreground">Scanner l'emploi du temps</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        {etape === 'upload' && (
          <div>
            <p className="text-sm text-muted-foreground mb-5">
              Importez la capture de votre emploi du temps. Le fichier sera stocké en toute sécurité.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-bold text-foreground">Choisir une image</p>
              <p className="text-xs text-muted-foreground mt-1">Capture d'écran, photo…</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {etape === 'analyse' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gold-dim)' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--gold)' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Importation du fichier...</p>
            <p className="text-xs text-muted-foreground">Envoi vers Supabase Storage...</p>
          </div>
        )}

        {etape === 'erreur' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(231,76,60,0.15)' }}>
              <X size={28} style={{ color: '#E74C3C' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Erreur</p>
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
              <p className="text-sm font-bold text-foreground">Image importée avec succès !</p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOM DU PROGRAMME</label>
              <input
                value={programme.nom || ''}
                onChange={e => setProgramme(p => ({ ...p, nom: e.target.value }))}
                className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
              />
            </div>

            <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">CRÉNEAUX DE RÉFÉRENCE</p>
            <div className="rounded-xl border border-border overflow-hidden mb-5 max-h-40 overflow-y-auto" style={{ background: 'var(--surface)' }}>
              {(programme.creneaux || []).map((cr, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{cr.libelle}</span>
                  <span className="text-sm text-foreground">{cr.contenu}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEtape('upload')} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">
                Changer
              </button>
              <button onClick={validerProgramme} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#080810' }}>
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : '✅ Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
