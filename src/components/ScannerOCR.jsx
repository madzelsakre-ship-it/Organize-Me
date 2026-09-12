import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { base44 } from '@/api/supabaseClient';
import { Camera, Upload, X, CheckCircle2, Loader2, Calendar } from 'lucide-react';
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

// --- Parseur simple (liste, une ligne = un horaire + une activité) ---
function extraire_creneaux_simple(texteBrut) {
  const lignes = texteBrut.split('\n').map(l => l.trim()).filter(Boolean);
  const regexHoraire = /(\d{1,2})\s*[h:]\s*(\d{0,2})\s*[-–à]{1,3}\s*(\d{1,2})\s*[h:]\s*(\d{0,2})/i;
  const creneaux = [];

  lignes.forEach((ligne, i) => {
    const match = ligne.match(regexHoraire);
    if (!match) return;

    const [full, h1, m1, h2, m2] = match;
    const libelle = `${h1.padStart(2, '0')}h${(m1 || '00').padStart(2, '0')}-${h2.padStart(2, '0')}h${(m2 || '00').padStart(2, '0')}`;

    let contenu = ligne.replace(full, '').replace(/[:\-–]/g, '').trim();
    if (!contenu && lignes[i + 1] && !regexHoraire.test(lignes[i + 1])) {
      contenu = lignes[i + 1];
    }
    if (!contenu) contenu = 'Activité';

    creneaux.push({ libelle, contenu, categorie: deviner_categorie(contenu) });
  });

  return creneaux.slice(0, 20);
}

// --- Parseur de tableau (grille avec colonnes = jours) basé sur les positions des mots ---
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
    if (motsJours.length >= 4) {
      headerIndex = i;
      colonnesJours = motsJours
        .map(m => ({ jour: normaliser(m.text), centre: (m.x0 + m.x1) / 2 }))
        .sort((a, b) => a.centre - b.centre);
      break;
    }
  }

  if (headerIndex === -1 || !colonnesJours || colonnesJours.length < 4) {
    return null; // Pas de tableau détecté
  }

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
    const valeurs = Object.values(parJour);
    const frequences = {};
    valeurs.forEach(v => { frequences[v] = (frequences[v] || 0) + 1; });
    const contenuPrincipal = Object.entries(frequences).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Activité';

    const cellules = {};
    NOMS_JOURS.forEach((jour, idx) => {
      if (parJour[jour] && parJour[jour] !== contenuPrincipal) {
        cellules[String(idx)] = parJour[jour];
      }
    });

    return {
      libelle: normaliser_horaire(horaire),
      contenu: contenuPrincipal,
      categorie: deviner_categorie(contenuPrincipal),
      cellules,
    };
  });
}

const PROGRAMME_BOGOU_SAKRE = {
  nom: "Programme Hebdomadaire — Bogou Sakré",
  creneaux: [
    { libelle: "03h25-03h45", contenu: "Prière", categorie: "spiritual", cellules: { "6": "Prière" } },
    { libelle: "06h30-06h30", contenu: "Réveil", categorie: "sante", cellules: {} },
    { libelle: "06h30-06h40", contenu: "Méditation & Sport", categorie: "spiritual", cellules: {} },
    { libelle: "06h40-06h55", contenu: "Préparation", categorie: "autre", cellules: {} },
    { libelle: "07h00-07h15", contenu: "Petit déjeuner", categorie: "sante", cellules: {} },
    { libelle: "07h20-07h30", contenu: "Prière", categorie: "spiritual", cellules: {} },
    { libelle: "07h30-07h50", contenu: "Lecture", categorie: "etude", cellules: {} },
    { libelle: "08h00-08h00", contenu: "Départ", categorie: "autre", cellules: { "6": "" } },
    { libelle: "12h25-12h40", contenu: "Lecture", categorie: "etude", cellules: { "5": "Arrivée", "6": "" } },
    { libelle: "13h00-13h20", contenu: "Déjeuner", categorie: "sante", cellules: {} },
    { libelle: "13h30-13h55", contenu: "Loisir", categorie: "autre", cellules: {} },
    { libelle: "14h00-15h25", contenu: "Repos", categorie: "sante", cellules: {} },
    { libelle: "15h30-15h55", contenu: "", categorie: "autre", cellules: { "5": "Prière", "6": "Prière" } },
    { libelle: "16h00-16h35", contenu: "", categorie: "autre", cellules: { "5": "Lessive" } },
    { libelle: "16h35-16h35", contenu: "Arrivée", categorie: "autre", cellules: { "5": "", "6": "" } },
    { libelle: "16h40-16h50", contenu: "Prière", categorie: "spiritual", cellules: { "5": "" } },
    { libelle: "17h00-18h30", contenu: "Sport", categorie: "sport", cellules: { "0": "Basket 🏀", "3": "Basket 🏀", "4": "Bibliothèque 📚", "5": "Basket 🏀" } },
    { libelle: "18h35-19h00", contenu: "Sport & Bain", categorie: "sport", cellules: {} },
    { libelle: "19h00-19h55", contenu: "Révision", categorie: "etude", cellules: {} },
    { libelle: "20h00-20h20", contenu: "Dîner", categorie: "sante", cellules: {} },
    { libelle: "20h25-20h50", contenu: "Travail", categorie: "travail", cellules: {} },
    { libelle: "21h00-21h00", contenu: "Prière", categorie: "spiritual", cellules: {} },
    { libelle: "21h20-21h50", contenu: "Lecture", categorie: "etude", cellules: {} },
    { libelle: "21h55-22h30", contenu: "Loisir", categorie: "autre", cellules: {} },
    { libelle: "22h30-22h30", contenu: "Dodo", categorie: "sante", cellules: {} },
  ],
};

export default function ScannerOCR({ onProgrammeCreated, onClose }) {
  const [etape, setEtape] = useState('upload');
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [progression, setProgression] = useState(0);
  const fileRef = useRef();
  const lastFileRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    lastFileRef.current = file;
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

      const creneaux = tableau
        ? construire_creneaux_depuis_tableau(tableau)
        : extraire_creneaux_simple(ret.data.text || '');

      setProgramme({
        nom: formattedName && formattedName !== "File" ? formattedName : "Programme importé",
        creneaux: creneaux.length > 0 ? creneaux : [
          { libelle: "08h00-10h00", contenu: "Activité (à compléter)", categorie: "autre" }
        ]
      });
      setEtape('resultat');
    } catch (err) {
      setErrorMsg(`Erreur : ${err?.message || String(err)}. Essayez une photo plus nette, bien droite et bien éclairée.`);
      setEtape('erreur');
    } finally {
      setLoading(false);
      if (worker) await worker.terminate();
      if (fileRef.current) fileRef.current.value = '';
    }
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
          libelle: libelle,
          contenu: cr.contenu || 'Activité',
          categorie: cr.categorie || 'autre',
          cellules: cr.cellules || {}
        };
      });

      const prog = await base44.entities.Programme.create({
        nom: programme.nom || 'Programme importé',
        description: 'Importé depuis un document',
        couleur_theme: '#3498DB',
        jours: JOURS.map((j, i) => ({ id: String(i), nom: j, actif: true })),
        creneaux: creneauxNettoyes
      });

      if (onProgrammeCreated && typeof onProgrammeCreated === 'function') {
        onProgrammeCreated(prog);
      }
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      console.error("Erreur détaillée:", err);
      // Affichage du message d'erreur réel de l'API/Supabase pour diagnostic direct
      setErrorMsg(`Erreur : ${err?.message || JSON.stringify(err)}`);
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
              Importez votre document ou photo d'emploi du temps pour créer votre programme. Pour un tableau (jours en colonnes), prenez la photo bien droite et bien éclairée.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-bold text-foreground">Cliquez pour importer un document</p>
              <p className="text-xs text-muted-foreground mt-1">Photo, capture… (texte net de préférence)</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />

            <button
              onClick={() => { setProgramme(PROGRAMME_BOGOU_SAKRE); setEtape('resultat'); }}
              className="w-full mt-4 py-3 rounded-xl text-sm font-black border border-border text-foreground"
              style={{ background: 'var(--accent)' }}>
              📋 Charger mon programme (déjà transcrit)
            </button>
          </div>
        )}

        {etape === 'analyse' && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gold-dim)' }}>
              <Calendar size={28} style={{ color: 'var(--gold)' }} />
            </div>
            <p className="text-base font-black text-foreground mb-2">Lecture en cours… {progression}%</p>
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
            <p className="text-sm text-muted-foreground mb-6 break-all">{errorMsg}</p>
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
