import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { base44 } from '@/api/supabaseClient';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  Calendar,
  Edit3
} from 'lucide-react';
import { JOURS } from '@/lib/coachData';

/* =========================================================
   CONFIGURATION
========================================================= */

const NOMS_JOURS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche'
];

const CATEGORIE_KEYWORDS = {
  spiritual: [
    'prière', 'priere', 'salat', 'messe', 'culte',
    'méditation', 'meditation'
  ],

  sport: [
    'sport', 'gym', 'foot', 'basket', 'course',
    'musculation', 'entraînement', 'entrainement',
    'natation', 'bain'
  ],

  sante: [
    'repas', 'déjeuner', 'dejeuner',
    'diner', 'dîner',
    'petit-déjeuner', 'petit dejeuner',
    'manger', 'dodo', 'sommeil',
    'dormir', 'nuit', 'sieste',
    'coucher', 'réveil', 'reveil',
    'repos'
  ],

  etude: [
    'cours', 'école', 'ecole', 'classe',
    'devoir', 'étude', 'etude',
    'lecture', 'révision', 'revision',
    'bibliothèque', 'bibliotheque',
    'math', 'maths', 'algèbre', 'algebre',
    'analyse', 'physique', 'chimie',
    'informatique', 'anglais',
    'français', 'francais'
  ],

  travail: [
    'travail', 'boulot', 'réunion',
    'reunion', 'bureau', 'job'
  ],

  social: [
    'ami', 'amis', 'famille',
    'visite', 'anniversaire'
  ]
};

/* =========================================================
   OUTILS TEXTE
========================================================= */

function normaliser(txt = '') {
  return String(txt)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|]/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

function nettoyerTexte(txt = '') {
  return String(txt)
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
}

function deviner_categorie(texte) {
  const t = normaliser(texte);

  for (const [cat, mots] of Object.entries(CATEGORIE_KEYWORDS)) {
    if (mots.some(m => t.includes(normaliser(m)))) {
      return cat;
    }
  }

  return 'autre';
}

/* =========================================================
   RECONNAISSANCE DES JOURS
========================================================= */

function distanceLevenshtein(a, b) {
  const aa = normaliser(a);
  const bb = normaliser(b);

  const matrix = Array.from(
    { length: aa.length + 1 },
    () => Array(bb.length + 1).fill(0)
  );

  for (let i = 0; i <= aa.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= bb.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cout = aa[i - 1] === bb[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cout
      );
    }
  }

  return matrix[aa.length][bb.length];
}

function reconnaitreJour(texte) {
  const t = normaliser(texte);

  // Correspondance exacte
  if (NOMS_JOURS.includes(t)) {
    return t;
  }

  // Quelques erreurs OCR fréquentes
  const corrections = {
    lundl: 'lundi',
    lund: 'lundi',
    lunai: 'lundi',
    lundl: 'lundi',

    mardl: 'mardi',
    marai: 'mardi',

    mercredl: 'mercredi',
    mercedi: 'mercredi',
    mercrdi: 'mercredi',

    jeudl: 'jeudi',
    jeud: 'jeudi',

    vendredl: 'vendredi',
    vendrei: 'vendredi',
    vendrdi: 'vendredi',

    samedl: 'samedi',
    samdi: 'samedi',

    dimanch: 'dimanche',
    dimancne: 'dimanche'
  };

  if (corrections[t]) {
    return corrections[t];
  }

  // Distance tolérée
  let meilleur = null;
  let meilleureDistance = Infinity;

  for (const jour of NOMS_JOURS) {
    const distance = distanceLevenshtein(t, jour);

    if (distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleur = jour;
    }
  }

  // Petit mot : on ne prend pas trop de risques
  if (t.length <= 4 && meilleureDistance > 1) {
    return null;
  }

  // Pour les mots plus longs, une petite erreur OCR est acceptable
  if (meilleureDistance <= 2) {
    return meilleur;
  }

  return null;
}

/* =========================================================
   HORAIRES
========================================================= */

function estHoraire(texte) {
  if (!texte) return false;

  const t = normaliser(texte)
    .replace(/O/gi, '0')
    .replace(/I/gi, '1');

  const regex = /(\d{1,2})\s*(?:h|:)\s*(\d{0,2})\s*[-–—àa]\s*(\d{1,2})\s*(?:h|:)\s*(\d{0,2})/i;

  return regex.test(t);
}

function normaliser_horaire(texteHoraire) {
  if (!texteHoraire) {
    return '08h00-10h00';
  }

  let t = String(texteHoraire)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/–|—|−/g, '-')
    .replace(/\s+/g, '');

  // Exemples :
  // 08h00-10h00
  // 08:00-10:00
  // 8h-10h
  // 08h00à10h00
  // 08h00a10h00

  const match = t.match(
    /(\d{1,2})(?:h|:)(\d{0,2})(?:-|à|a)(\d{1,2})(?:h|:)(\d{0,2})/i
  );

  if (!match) {
    return nettoyerTexte(texteHoraire);
  }

  let [, h1, m1, h2, m2] = match;

  m1 = m1 || '00';
  m2 = m2 || '00';

  return (
    `${h1.padStart(2, '0')}h${m1.padStart(2, '0')}` +
    `-${h2.padStart(2, '0')}h${m2.padStart(2, '0')}`
  );
}

/* =========================================================
   EXTRACTION DES MOTS OCR
========================================================= */

function extraire_mots(dataTesseract) {
  const mots = [];

  // Tesseract renvoie généralement data.words.
  if (Array.isArray(dataTesseract?.words)) {
    dataTesseract.words.forEach(word => {
      if (!word?.bbox || !word?.text?.trim()) return;

      mots.push({
        text: nettoyerTexte(word.text),
        x0: word.bbox.x0,
        x1: word.bbox.x1,
        y0: word.bbox.y0,
        y1: word.bbox.y1,
        confidence: Number(word.confidence ?? 100)
      });
    });
  }

  // Compatibilité avec certaines versions de Tesseract
  if (mots.length === 0) {
    const blocks = dataTesseract?.blocks || [];

    blocks.forEach(block => {
      (block.paragraphs || []).forEach(para => {
        (para.lines || []).forEach(line => {
          (line.words || []).forEach(word => {
            if (!word?.bbox || !word?.text?.trim()) return;

            mots.push({
              text: nettoyerTexte(word.text),
              x0: word.bbox.x0,
              x1: word.bbox.x1,
              y0: word.bbox.y0,
              y1: word.bbox.y1,
              confidence: Number(word.confidence ?? 100)
            });
          });
        });
      });
    });
  }

  return mots.filter(m => m.text.length > 0);
}

/* =========================================================
   GROUPER LES MOTS EN LIGNES
========================================================= */

function grouper_en_lignes(mots) {
  if (!mots.length) return [];

  const tries = [...mots].sort(
    (a, b) =>
      ((a.y0 + a.y1) / 2) -
      ((b.y0 + b.y1) / 2)
  );

  const hauteurs = tries.map(
    m => Math.max(1, m.y1 - m.y0)
  );

  const hauteurMoyenne =
    hauteurs.reduce((a, b) => a + b, 0) /
    hauteurs.length;

  const seuil = Math.max(hauteurMoyenne * 0.75, 10);

  const lignes = [];

  for (const mot of tries) {
    const centreY = (mot.y0 + mot.y1) / 2;

    let meilleureLigne = null;
    let meilleureDistance = Infinity;

    for (const ligne of lignes) {
      const distance = Math.abs(
        ligne.centreY - centreY
      );

      if (
        distance < seuil &&
        distance < meilleureDistance
      ) {
        meilleureLigne = ligne;
        meilleureDistance = distance;
      }
    }

    if (!meilleureLigne) {
      lignes.push({
        centreY,
        mots: [mot]
      });
    } else {
      meilleureLigne.mots.push(mot);

      meilleureLigne.centreY =
        meilleureLigne.mots.reduce(
          (s, m) => s + ((m.y0 + m.y1) / 2),
          0
        ) / meilleureLigne.mots.length;
    }
  }

  lignes.forEach(ligne => {
    ligne.mots.sort((a, b) => a.x0 - b.x0);
  });

  lignes.sort((a, b) => a.centreY - b.centreY);

  return lignes;
}

/* =========================================================
   DÉTECTER LES JOURS
========================================================= */

function detecter_colonnes_jours(lignes) {
  const candidats = [];

  lignes.forEach((ligne, ligneIndex) => {
    ligne.mots.forEach(mot => {
      const jour = reconnaitreJour(mot.text);

      if (jour) {
        candidats.push({
          jour,
          centre: (mot.x0 + mot.x1) / 2,
          y: ligne.centreY,
          ligneIndex,
          mot
        });
      }
    });
  });

  if (candidats.length === 0) {
    return null;
  }

  /*
   * On privilégie une ligne contenant plusieurs jours.
   */
  const groupes = {};

  candidats.forEach(c => {
    if (!groupes[c.ligneIndex]) {
      groupes[c.ligneIndex] = [];
    }

    groupes[c.ligneIndex].push(c);
  });

  let meilleurGroupe = null;

  Object.values(groupes).forEach(groupe => {
    const uniques = [];

    groupe.forEach(item => {
      if (!uniques.some(x => x.jour === item.jour)) {
        uniques.push(item);
      }
    });

    if (
      !meilleurGroupe ||
      uniques.length > meilleurGroupe.length
    ) {
      meilleurGroupe = uniques;
    }
  });

  if (!meilleurGroupe || meilleurGroupe.length < 2) {
    return null;
  }

  meilleurGroupe.sort((a, b) => a.centre - b.centre);

  return meilleurGroupe.map(item => ({
    jour: item.jour,
    centre: item.centre
  }));
}

/* =========================================================
   EXTRAIRE LE TABLEAU
========================================================= */

function extraire_tableau(mots) {
  if (!mots.length) return null;

  const lignes = grouper_en_lignes(mots);

  if (!lignes.length) return null;

  const colonnesJours =
    detecter_colonnes_jours(lignes);

  if (!colonnesJours) {
    console.warn(
      'OCR : aucun en-tête de jours détecté.',
      lignes
    );

    return null;
  }

  /*
   * Limites horizontales des colonnes.
   */
  const bornes = colonnesJours.map(
    (col, index) => ({
      jour: col.jour,

      gauche:
        index === 0
          ? -Infinity
          : (
              colonnesJours[index - 1].centre +
              col.centre
            ) / 2,

      droite:
        index === colonnesJours.length - 1
          ? Infinity
          : (
              col.centre +
              colonnesJours[index + 1].centre
            ) / 2
    })
  );

  /*
   * Recherche des lignes contenant un horaire.
   */
  const resultats = [];

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    const texteLigne = ligne.mots
      .map(m => m.text)
      .join(' ');

    /*
     * On cherche l'horaire dans toute la ligne,
     * pas uniquement dans la première colonne.
     */
    if (!estHoraire(texteLigne)) {
      continue;
    }

    const motsHoraire = [];

    ligne.mots.forEach(mot => {
      const centre =
        (mot.x0 + mot.x1) / 2;

      // Les horaires sont généralement avant les jours.
      if (
        centre < bornes[0].droite &&
        estHoraire(mot.text)
      ) {
        motsHoraire.push(mot);
      }
    });

    /*
     * Si l'horaire est séparé en plusieurs mots,
     * on prend les premiers mots à gauche.
     */
    let texteHoraire = '';

    if (motsHoraire.length) {
      texteHoraire = motsHoraire
        .map(m => m.text)
        .join('');
    }

    if (!estHoraire(texteHoraire)) {
      /*
       * Tentative avec toute la partie gauche.
       */
      const gauche = ligne.mots
        .filter(m => {
          const centre =
            (m.x0 + m.x1) / 2;

          return centre < bornes[0].centre;
        })
        .map(m => m.text)
        .join('');

      if (estHoraire(gauche)) {
        texteHoraire = gauche;
      }
    }

    if (!estHoraire(texteHoraire)) {
      /*
       * Dernière tentative avec toute la ligne.
       */
      texteHoraire = texteLigne;
    }

    const parJour = {};

    /*
     * Pour chaque colonne, récupérer tous les mots
     * qui se trouvent physiquement dans cette colonne.
     */
    bornes.forEach(borne => {
      const motsColonne = ligne.mots.filter(mot => {
        const centre =
          (mot.x0 + mot.x1) / 2;

        const appartient =
          centre >= borne.gauche &&
          centre < borne.droite;

        const estHoraireMot =
          motsHoraire.includes(mot);

        return appartient && !estHoraireMot;
      });

      const texte = motsColonne
        .map(m => m.text)
        .join(' ')
        .trim();

      if (
        texte &&
        !estHoraire(texte)
      ) {
        parJour[borne.jour] =
          nettoyerTexte(texte);
      }
    });

    if (Object.keys(parJour).length > 0) {
      resultats.push({
        horaire: normaliser_horaire(
          texteHoraire
        ),
        parJour
      });
    }
  }

  if (!resultats.length) {
    return null;
  }

  /*
   * Évite les doublons d'horaires.
   */
  const uniques = [];
  const dejaVu = new Set();

  resultats.forEach(resultat => {
    const cle =
      resultat.horaire +
      '|' +
      JSON.stringify(resultat.parJour);

    if (!dejaVu.has(cle)) {
      dejaVu.add(cle);
      uniques.push(resultat);
    }
  });

  return uniques;
}

/* =========================================================
   CONSTRUIRE LES CRÉNEAUX DE L'APPLICATION
========================================================= */

function construire_creneaux_depuis_tableau(tableau) {
  return tableau.map(({ horaire, parJour }) => {
    const cellules = {};

    NOMS_JOURS.forEach(
      (jourNom, index) => {
        if (parJour[jourNom]) {
          cellules[String(index)] =
            parJour[jourNom];
        }
      }
    );

    /*
     * Contenu principal = première matière trouvée.
     */
    const valeurs =
      Object.values(parJour);

    const premierTexte =
      valeurs.length > 0
        ? valeurs[0]
        : 'Activité';

    return {
      libelle:
        normaliser_horaire(horaire),

      contenu:
        premierTexte,

      categorie:
        deviner_categorie(premierTexte),

      cellules
    };
  });
}

/* =========================================================
   COMPOSANT
========================================================= */

export default function ScannerOCR({
  onProgrammeCreated,
  onClose
}) {
  const [etape, setEtape] =
    useState('upload');

  const [programme, setProgramme] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [progression, setProgression] =
    useState(0);

  const [debugOCR, setDebugOCR] =
    useState('');

  const fileRef = useRef(null);

  /* =======================================================
     TRAITEMENT DU FICHIER
  ======================================================= */

  async function handleFile(file) {
    if (!file) return;

    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');
    setDebugOCR('');
    setProgression(0);

    let worker = null;

    try {
      const fileNameClean =
        file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .trim();

      const formattedName =
        fileNameClean
          ? fileNameClean
              .charAt(0)
              .toUpperCase() +
            fileNameClean.slice(1)
          : 'Programme importé';

      /*
       * Création du worker OCR.
       */
      worker = await createWorker(
        'fra',
        1,
        {
          logger: message => {
            if (
              message.status ===
              'recognizing text'
            ) {
              setProgression(
                Math.round(
                  message.progress * 100
                )
              );
            }
          }
        }
      );

      /*
       * Paramètres adaptés aux documents.
       */
      try {
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: '6'
        });
      } catch (e) {
        console.warn(
          'Paramètres OCR non appliqués :',
          e
        );
      }

      /*
       * OCR directement sur le fichier.
       */
      const ret =
        await worker.recognize(
          file,
          {},
          {
            blocks: true,
            text: true
          }
        );

      console.log(
        '===== TEXTE OCR ====='
      );

      console.log(
        ret?.data?.text || ''
      );

      console.log(
        '===== DONNÉES OCR ====='
      );

      console.log(ret?.data);

      const mots =
        extraire_mots(ret?.data);

      console.log(
        'MOTS OCR :',
        mots
      );

      setDebugOCR(
        ret?.data?.text || ''
      );

      if (!mots.length) {
        throw new Error(
          'Aucun texte n’a été reconnu dans l’image.'
        );
      }

      /*
       * Reconstruction du tableau.
       */
      const tableau =
        extraire_tableau(mots);

      console.log(
        'TABLEAU DÉTECTÉ :',
        tableau
      );

      if (!tableau) {
        throw new Error(
          'Le texte a été reconnu, mais le tableau n’a pas pu être reconstruit. Vérifiez que les noms des jours et les horaires sont visibles.'
        );
      }

      const creneaux =
        construire_creneaux_depuis_tableau(
          tableau
        );

      if (!creneaux.length) {
        throw new Error(
          'Aucun créneau n’a pu être extrait du tableau.'
        );
      }

      console.log(
        'CRÉNEAUX FINAUX :',
        creneaux
      );

      setProgramme({
        nom:
          formattedName ||
          'Programme importé',

        creneaux
      });

      setEtape('edition');

    } catch (err) {
      console.error(
        '===== ERREUR OCR =====',
        err
      );

      setErrorMsg(
        err?.message ||
        'Impossible de lire le tableau.'
      );

      setEtape('erreur');

    } finally {
      setLoading(false);

      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.warn(
            'Erreur fermeture OCR :',
            e
          );
        }
      }

      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  /* =======================================================
     MODIFIER CRÉNEAU
  ======================================================= */

  function modifierCreneau(
    index,
    champ,
    valeur
  ) {
    setProgramme(prev => {
      const nouveauxCreneaux =
        [...prev.creneaux];

      nouveauxCreneaux[index] = {
        ...nouveauxCreneaux[index],
        [champ]: valeur
      };

      if (champ === 'contenu') {
        nouveauxCreneaux[index]
          .categorie =
          deviner_categorie(valeur);
      }

      return {
        ...prev,
        creneaux:
          nouveauxCreneaux
      };
    });
  }

  /* =======================================================
     MODIFIER CELLULE D'UN JOUR
  ======================================================= */

  function modifierCelluleJour(
    indexCreneau,
    indexJour,
    valeur
  ) {
    setProgramme(prev => {
      const nouveauxCreneaux =
        [...prev.creneaux];

      const cr = {
        ...nouveauxCreneaux[
          indexCreneau
        ]
      };

      const cellules = {
        ...(cr.cellules || {})
      };

      if (
        valeur.trim() === ''
      ) {
        delete cellules[
          String(indexJour)
        ];
      } else {
        cellules[
          String(indexJour)
        ] = valeur;
      }

      cr.cellules = cellules;

      nouveauxCreneaux[
        indexCreneau
      ] = cr;

      return {
        ...prev,
        creneaux:
          nouveauxCreneaux
      };
    });
  }

  /* =======================================================
     ENREGISTRER
  ======================================================= */

  async function validerProgramme() {
    if (!programme) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const creneauxNettoyes =
        (programme.creneaux || [])
          .map((cr, i) => {
            return {
              id:
                `cr_${Date.now()}_${i}`,

              libelle:
                cr.libelle ||
                '08h00-10h00',

              contenu:
                cr.contenu &&
                cr.contenu.trim() !== ''
                  ? cr.contenu.trim()
                  : 'Activité',

              categorie:
                cr.categorie ||
                'autre',

              cellules:
                cr.cellules || {}
            };
          });

      const prog =
        await base44.entities.Programme.create({
          nom:
            programme.nom ||
            'Programme importé',

          description:
            'Importé et personnalisé depuis un document',

          couleur_theme:
            '#3498DB',

          jours:
            JOURS.map(
              (j, i) => ({
                id: String(i),
                nom: j,
                actif: true
              })
            ),

          creneaux:
            creneauxNettoyes
        });

      if (onProgrammeCreated) {
        onProgrammeCreated(prog);
      }

      if (onClose) {
        onClose();
      }

    } catch (err) {
      console.error(
        'Erreur détaillée :',
        err
      );

      setErrorMsg(
        err?.message ||
        JSON.stringify(err)
      );

      setEtape('erreur');

    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     AFFICHAGE
  ======================================================= */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{
        background:
          'rgba(0,0,0,0.85)'
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border p-4 sm:p-6 animate-fade-in overflow-hidden"
        style={{
          background: '#0D0D18'
        }}
      >

        {/* HEADER */}

        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">

          <div className="flex items-center gap-2">

            <Camera
              size={18}
              style={{
                color: 'var(--gold)'
              }}
            />

            <h2 className="text-base font-black text-foreground">
              Importation & Édition sur-mesure
            </h2>

          </div>

          <button
            onClick={onClose}
          >
            <X
              size={20}
              className="text-muted-foreground"
            />
          </button>

        </div>

        {/* =================================================
            UPLOAD
        ================================================= */}

        {etape === 'upload' && (

          <div className="py-4">

            <p className="text-sm text-muted-foreground mb-5">
              Importez votre emploi du temps.
              L'application analyse les horaires,
              les jours et les matières du tableau.
            </p>

            <div
              onClick={() =>
                fileRef.current?.click()
              }
              className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{
                background:
                  'var(--accent)'
              }}
            >

              <Upload
                size={32}
                className="text-muted-foreground mb-3"
              />

              <p className="text-sm font-bold text-foreground">
                Cliquez pour importer l'emploi du temps
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Photo claire, droite et bien éclairée recommandée
              </p>

            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e =>
                handleFile(
                  e.target.files?.[0]
                )
              }
            />

          </div>
        )}

        {/* =================================================
            ANALYSE
        ================================================= */}

        {etape === 'analyse' && (

          <div className="flex flex-col items-center py-12 text-center">

            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background:
                  'var(--gold-dim)'
              }}
            >

              <Calendar
                size={28}
                style={{
                  color:
                    'var(--gold)'
                }}
              />

            </div>

            <p className="text-base font-black text-foreground mb-2">
              Lecture du tableau…
            </p>

            <p className="text-sm text-muted-foreground mb-4">
              Reconnaissance OCR : {progression}%
            </p>

            <div className="w-full max-w-xs h-2 rounded-full bg-accent overflow-hidden">

              <div
                className="h-full transition-all"
                style={{
                  width:
                    `${progression}%`,
                  background:
                    'var(--gold)'
                }}
              />

            </div>

            <div className="flex gap-1.5 mt-5">

              {[0, 1, 2].map(i => (

                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    background:
                      'var(--gold)',
                    animationDelay:
                      `${i * 0.15}s`
                  }}
                />

              ))}

            </div>

          </div>
        )}

        {/* =================================================
            ERREUR
        ================================================= */}

        {etape === 'erreur' && (

          <div className="flex flex-col items-center py-8 text-center">

            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background:
                  'rgba(231,76,60,0.15)'
              }}
            >

              <X
                size={28}
                style={{
                  color:
                    '#E74C3C'
                }}
              />

            </div>

            <p className="text-base font-black text-foreground mb-2">
              Le tableau n'a pas pu être importé
            </p>

            <p className="text-sm text-muted-foreground mb-6 break-all">
              {errorMsg}
            </p>

            {debugOCR && (
              <details className="w-full text-left mb-5">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Voir le texte reconnu par OCR
                </summary>

                <pre className="mt-2 p-3 rounded-lg bg-accent text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                  {debugOCR}
                </pre>
              </details>
            )}

            <button
              onClick={() =>
                setEtape('upload')
              }
              className="w-full py-3 rounded-xl font-black text-sm"
              style={{
                background:
                  'var(--gold)',
                color:
                  '#080810'
              }}
            >
              Réessayer
            </button>

          </div>
        )}

        {/* =================================================
            EDITION
        ================================================= */}

        {etape === 'edition' &&
          programme && (

            <div className="flex flex-col flex-1 overflow-hidden">

              <div className="flex items-center gap-2 mb-3">

                <CheckCircle2
                  size={16}
                  style={{
                    color:
                      '#2ECC71'
                  }}
                />

                <p className="text-sm font-bold text-foreground">
                  Tableau détecté. Vérifiez et modifiez les cellules si nécessaire :
                </p>

              </div>

              {/* NOM */}

              <div className="mb-3">

                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1">
                  NOM DU PROGRAMME
                </label>

                <input
                  value={
                    programme.nom || ''
                  }
                  onChange={e =>
                    setProgramme(
                      p => ({
                        ...p,
                        nom:
                          e.target.value
                      })
                    )
                  }
                  className="w-full bg-accent border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                />

              </div>

              {/* CRÉNEAUX */}

              <div
                className="flex-1 overflow-y-auto border border-border rounded-xl p-2 space-y-3"
                style={{
                  background:
                    'var(--surface)'
                }}
              >

                {(programme.creneaux || [])
                  .map((cr, idx) => (

                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-border"
                      style={{
                        background:
                          'var(--accent)'
                      }}
                    >

                      {/* HORAIRE */}

                      <div className="flex items-center gap-2 mb-2">

                        <Edit3
                          size={14}
                          className="text-muted-foreground"
                        />

                        <input
                          value={
                            cr.libelle || ''
                          }
                          onChange={e =>
                            modifierCreneau(
                              idx,
                              'libelle',
                              e.target.value
                            )
                          }
                          placeholder="08h00-10h00"
                          className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground w-32 outline-none focus:border-gold"
                        />

                        <input
                          value={
                            cr.contenu || ''
                          }
                          onChange={e =>
                            modifierCreneau(
                              idx,
                              'contenu',
                              e.target.value
                            )
                          }
                          placeholder="Activité principale"
                          className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-gold"
                        />

                      </div>

                      {/* JOURS */}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-border/50">

                        {JOURS.map(
                          (nomJour, jIdx) => (

                            <div
                              key={jIdx}
                              className="flex flex-col"
                            >

                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {nomJour}
                              </span>

                              <input
                                value={
                                  cr.cellules?.[
                                    String(jIdx)
                                  ] || ''
                                }
                                onChange={e =>
                                  modifierCelluleJour(
                                    idx,
                                    jIdx,
                                    e.target.value
                                  )
                                }
                                placeholder="—"
                                className="bg-surface border border-border rounded px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-gold"
                              />

                            </div>

                          )
                        )}

                      </div>

                    </div>

                  ))}

              </div>

              {/* BOUTONS */}

              <div className="flex gap-2 mt-4 pt-2 border-t border-border">

                <button
                  onClick={() =>
                    setEtape('upload')
                  }
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground"
                >
                  Recommencer
                </button>

                <button
                  onClick={
                    validerProgramme
                  }
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-50"
                  style={{
                    background:
                      'var(--gold)',
                    color:
                      '#080810'
                  }}
                >

                  {loading ? (
                    <Loader2
                      size={16}
                      className="animate-spin mx-auto"
                    />
                  ) : (
                    '✅ Enregistrer le programme'
                  )}

                </button>

              </div>

            </div>

          )}

      </div>
    </div>
  );
}