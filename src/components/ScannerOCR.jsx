import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { base44 } from '@/api/supabaseClient';
import { Camera, Upload, X, CheckCircle2, Loader2, Calendar, Edit3 } from 'lucide-react';
import { JOURS } from '@/lib/coachData';

const CATEGORIE_KEYWORDS = {
  spiritual: ['prière', 'priere', 'salat', 'messe', 'culte', 'méditation', 'meditation'],
  sport: ['sport', 'gym', 'foot', 'basket', 'course', 'musculation', 'entraînement', 'entrainement', 'natation', 'bain'],
  sante: ['repas', 'déjeuner', 'dejeuner', 'diner', 'dîner', 'petit-déjeuner', 'petit dejeuner', 'manger', 'dodo', 'sommeil', 'dormir', 'nuit', 'sieste', 'coucher', 'réveil', 'reveil', 'repos'],
  etude: ['cours', 'école', 'ecole', 'classe', 'devoir', 'étude', 'etude', 'lecture', 'révision', 'revision', 'bibliothèque', 'bibliotheque'],
  travail: ['travail', 'boulot', 'réunion', 'reunion', 'bureau', 'job'],
  social: ['ami', 'amis', 'famille', 'visite', 'anniversaire'],
};

const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function normaliser(txt) {
  return txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function deviner_categorie(texte) {
  const t = normaliser(texte);
  for (const [cat, mots] of Object.entries(CATEGORIE_KEYWORDS)) {
    if (mots.some(m => t.includes(m))) return cat;
  }
  return 'autre';
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Impossible de lire le fichier sélectionné."));
    reader.readAsDataURL(file);
  });
}

function extraire_mots(dataTesseract) {
  const mots = [];
  const blocks = dataTesseract?.blocks || [];
  blocks.forEach(block => {
    (block.paragraphs || []).forEach(para => {
      (para.lines || []).forEach(line => {
        (line.words || []).forEach(word => {
          if (word?.bbox && word.text?.trim()) {
            mots.push({
              text: word.text.trim(),
              x0: word.bbox.x0, x1: word.bbox.x1,
              y0: word.bbox.y0, y1: word.bbox.y1,
            });
          }
        });
      });
    });
  });
  return mots;
}

function grouper_en_lignes(mots) {
  const tries = [...mots].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  if (tries.length === 0) return [];
  const hauteurMoyenne = tries.reduce((s, m) => s + (m.y1 - m.y0), 0) / tries.length;
  const seuil = Math.max(hauteurMoyenne * 0.6, 8);
  const lignes = [];

  tries.forEach(mot => {
    const centreY = (mot.y0 + mot.y1) / 2;
    let ligne = lignes.find(l => Math.abs(l.centreY - centreY) < seuil);
    if (!ligne) {
      ligne = { centreY, mots: [] };
      lignes.push(ligne);
    }
    ligne.mots.push(mot);
    ligne.centreY = ligne.mots.reduce((s, m) => s + (m.y0 + m.y1) / 2, 0) / ligne.mots.length;
  });

  lignes.forEach(l => l.mots.sort((a, b) => a.x0 - b.x0));
  lignes.sort((a, b) => a.centreY - b.centreY);
  return lignes;
}

function extraire_tableau(mots) {
  const lignes = grouper_en_lignes(mots);
  let headerIndex = -1;
  let colonnesJours = null;

  for (let i = 0; i < lignes.length; i++) {
    const motsJours = lignes[i].mots.filter(m => NOMS_JOURS.includes(normaliser(m.text)));
    if (motsJours.length >= 3) {
      headerIndex = i;
      colonnesJours = motsJours
        .map(m => ({ jour: normaliser(m.text), centre: (m.x0 + m.x1) / 2 }))
        .sort((a, b) => a.centre - b.centre);
      break;
    }
  }

  if (headerIndex === -1 || !colonnesJours || colonnesJours.length < 3) return null;

  const bornes = colonnesJours.map((col, i) => ({
    jour: col.jour,
    gauche: i === 0 ? -Infinity : (colonnesJours[i - 1].centre + col.centre) / 2,
    droite: i === colonnesJours.length - 1 ? Infinity : (col.centre + colonnesJours[i + 1].centre) / 2,
  }));

  const regexHoraireBrut = /\d{1,2}\s*[h:]\s*\d{0,2}/;
  const resultats = [];

  for (let i = headerIndex + 1; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (!ligne.mots.length) continue;

    const motsHoraire = ligne.mots.filter(m => (m.x0 + m.x1) / 2 < bornes[0].droite - 15);
    const texteHoraire = motsHoraire.map(m => m.text).join('');
    if (!regexHoraireBrut.test(texteHoraire)) continue;

    const parJour = {};
    bornes.forEach(b => {
      const motsColonne = ligne.mots.filter(m => {
        const centre = (m.x0 + m.x1) / 2;
        return centre >= b.gauche && centre < b.droite && !motsHoraire.includes(m);
      });
      const texte = motsColonne.map(m => m.text).join(' ').trim();
      if (texte) parJour[b.jour] = texte;
    });

    if (Object.keys(parJour).length > 0) {
      resultats.push({ horaire: texteHoraire.trim(), parJour });
    }
  }

  return resultats.length > 0 ? resultats : null;
}

function normaliser_horaire(texteHoraire) {
  const match = texteHoraire.match(/(\d{1,2})\s*[h:]?\s*(\d{0,2})\D+(\d{1,2})\s*[h:]?\s*(\d{0,2})/);
  if (!match) return texteHoraire;
  const [, h1, m1, h2, m2] = match;
  return `${h1.padStart(2, '0')}h${(m1 || '00').padStart(2, '0')}-${h2.padStart(2, '0')}h${(m2 || '00').padStart(2, '0')}`;
}

function construire_creneaux_depuis_tableau(tableau) {
  return tableau.map(({ horaire, parJour }) => {
    // ParJour contient directement les valeurs par jour (ex: { 'lundi': 'Maths', 'mardi': 'Sport' })
    const cellules = {};
    NOMS_JOURS.forEach((jourNom, idx) => {
      if (parJour[jourNom]) {
        cellules[String(idx)] = parJour[jourNom];
      }
    });

    // Valeur par défaut pour le contenu principal
    const premierTexte = Object.values(parJour)[0] || 'Activité';

    return {
      libelle: normaliser_horaire(horaire),
      contenu: premierTexte,
      categorie: deviner_categorie(premierTexte),
      cellules,
    };
  });
}

export default function ScannerOCR({ onProgrammeCreated, onClose }) {
  const [etape, setEtape] = useState('upload');
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [progression, setProgression] = useState(0);
  const fileRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');
    setProgression(0);

    let worker;
    try {
      const fileNameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const formattedName = fileNameClean.charAt(0).toUpperCase() + fileNameClean.slice(1);

      worker = await createWorker('fra', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgression(Math.round(m.progress * 100));
          }
        },
      });

      const dataUrl = await fileToDataURL(file);
      const ret = await worker.recognize(dataUrl, {}, { blocks: true, text: true });

      const mots = extraire_mots(ret.data);
      const tableau = extraire_tableau(mots);

      const creneaux = tableau ? construire_creneaux_depuis_tableau(tableau) : [
        { libelle: "08h00-10h00", contenu: "Activité", categorie: "autre", cellules: {} }
      ];

      setProgramme({
        nom: formattedName && formattedName !== "File" ? formattedName : "Programme importé",
        creneaux: creneaux
      });
      setEtape('edition'); // Passage direct à l'étape d'édition indépendante
    } catch (err) {
      setErrorMsg(`Erreur : ${err?.message || String(err)}. Essayez une photo plus nette et bien éclairée.`);
      setEtape('erreur');
    } finally {
      setLoading(false);
      if (worker) await worker.terminate();
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function modifierCreneau(index, champ, valeur) {
    setProgramme(prev => {
      const nouveauxCreneaux = [...prev.creneaux];
      nouveauxCreneaux[index] = { ...nouveauxCreneaux[index], [champ]: valeur };
      if (champ === 'contenu') {
        nouveauxCreneaux[index].categorie = deviner_categorie(valeur);
      }
      return { ...prev, creneaux: nouveauxCreneaux };
    });
  }

  function modifierCelluleJour(indexCreneau, indexJour, valeur) {
    setProgramme(prev => {
      const nouveauxCreneaux = [...prev.creneaux];
      const cr = { ...nouveauxCreneaux[indexCreneau] };
      const cellules = { ...(cr.cellules || {}) };
      
      if (valeur.trim() === '') {
        delete cellules[String(indexJour)];
      } else {
        cellules[String(indexJour)] = valeur;
      }
      
      cr.cellules = cellules;
      nouveauxCreneaux[indexCreneau] = cr;
      return { ...prev, creneaux: nouveauxCreneaux };
    });
  }

  async function validerProgramme() {
    if (!programme) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const creneauxNettoyes = (programme.creneaux || []).map((cr, i) => {
        let libelle = cr.libelle || '08h00-10h00';
        if (libelle.length === 11 && libelle.slice(0, 5) === libelle.slice(6)) {
          const [h, m] = libelle.slice(0, 5).split('h');
          let totalMinutes = parseInt(h) * 60 + parseInt(m) + 15;
          const newH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
          const newM = String(totalMinutes % 60).padStart(2, '0');
          libelle = `${libelle.slice(0, 5)}-${newH}h${newM}`;
        }

        return {
          id: `cr_${Date.now()}_${i}`,
          libelle,
          contenu: cr.contenu && cr.contenu.trim() !== '' ? cr.contenu : 'Activité',
          categorie: cr.categorie || 'autre',
          cellules: cr.cellules || {}
        };
      });

      const prog = await base44.entities.Programme.create({
        nom: programme.nom || 'Programme importé',
        description: 'Importé et personnalisé depuis un document',
        couleur_theme: '#3498DB',
        jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
        creneaux: creneauxNettoyes
      });

      if (onProgrammeCreated) onProgrammeCreated(prog);
      if (onClose) onClose();
    } catch (err) {
      console.error("Erreur détaillée:", err);
      setErrorMsg(`Erreur : ${err?.message || JSON.stringify(err)}`);
      setEtape('erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border p-4 sm:p-6 animate-fade-in overflow-hidden" style={{ background: '#0D0D18' }}>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera size={18} style={{ color: 'var(--gold)' }} />
            <h2 className="text-base font-black text-foreground">Importation & Édition sur-mesure</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        {etape === 'upload' && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-5">
              Importez l'emploi du temps. L'application va extraire le tableau pour vous permettre de modifier chaque case de chaque jour en toute indépendance.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-bold text-foreground">Cliquez pour importer l'image de l'emploi du temps</p>
              <p className="text-xs text-muted-foreground mt-1">Photo claire et bien orientée recommandée</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {etape === 'analyse' && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gold-dim)' }}>
              <Calendar size={28} style={{ color: 'var(--gold)' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Analyse du tableau en cours… {progression}%</p>
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
            <p className="text-base font-black text-foreground mb-2">Un problème est survenu</p>
            <p className="text-sm text-muted-foreground mb-6 break-all">{errorMsg}</p>
            <button onClick={() => setEtape('upload')}
              className="w-full py-3 rounded-xl font-black text-sm"
              style={{ background: 'var(--gold)', color: '#080810' }}>
              Réessayer
            </button>
          </div>
        )}

        {etape === 'edition' && programme && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} style={{ color: '#2ECC71' }} />
              <p className="text-sm font-bold text-foreground">Modifiez vos créneaux et jours en toute liberté :</p>
            </div>

            <div className="mb-3">
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1">NOM DU PROGRAMME</label>
              <input
                value={programme.nom || ''}
                onChange={e => setProgramme(p => ({ ...p, nom: e.target.value }))}
                className="w-full bg-accent border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-border rounded-xl p-2 space-y-3" style={{ background: 'var(--surface)' }}>
              {(programme.creneaux || []).map((cr, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border" style={{ background: 'var(--accent)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Edit3 size={14} className="text-muted-foreground" />
                    <input
                      value={cr.libelle}
                      onChange={e => modifierCreneau(idx, 'libelle', e.target.value)}
                      placeholder="Ex: 08h00-10h00"
                      className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground w-32 outline-none focus:border-gold"
                    />
                    <input
                      value={cr.contenu}
                      onChange={e => modifierCreneau(idx, 'contenu', e.target.value)}
                      placeholder="Activité principale"
                      className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-gold"
                    />
                  </div>

                  {/* Personnalisation par jour indépendante */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-border/50">
                    {JOURS.map((nomJour, jIdx) => (
                      <div key={jIdx} className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-semibold">{nomJour}</span>
                        <input
                          value={cr.cellules?.[String(jIdx)] || ''}
                          onChange={e => modifierCelluleJour(idx, jIdx, e.target.value)}
                          placeholder="Idem"
                          className="bg-surface border border-border rounded px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-gold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 pt-2 border-t border-border">
              <button onClick={() => setEtape('upload')} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground">
                Recommencer
              </button>
              <button onClick={validerProgramme} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#080810' }}>
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : '✅ Enregistrer le programme'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
