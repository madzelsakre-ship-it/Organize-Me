import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  Calendar,
  Edit3,
  RotateCcw,
  Eye,
  ChevronDown,
  Trash2,
  Plus
} from 'lucide-react';

import { base44 } from '@/api/supabaseClient';
import { JOURS } from '@/lib/coachData';

/* =========================================================
   CONFIGURATION — FORMAT PRÉPA 1 GÉOLOGIE–MINES
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
    'prière',
    'priere',
    'salat',
    'messe',
    'culte',
    'méditation',
    'meditation'
  ],

  sport: [
    'sport',
    'gym',
    'foot',
    'basket',
    'course',
    'musculation',
    'entraînement',
    'entrainement',
    'natation',
    'douche',
    'bain'
  ],

  sante: [
    'repas',
    'déjeuner',
    'dejeuner',
    'dîner',
    'diner',
    'petit-déjeuner',
    'petit dejeuner',
    'manger',
    'sommeil',
    'dormir',
    'nuit',
    'sieste',
    'coucher',
    'réveil',
    'reveil',
    'repos',
    'pause'
  ],

  etude: [
    'cours',
    'école',
    'ecole',
    'classe',
    'devoir',
    'étude',
    'etude',
    'lecture',
    'révision',
    'revision',
    'bibliothèque',
    'bibliotheque',
    'exercice',
    'exercices',
    'td',
    'cm',
    'prépa',
    'prepa',
    'université',
    'universite',
    'recherche',
    'documentaire',
    'techniques'
  ],

  travail: [
    'travail',
    'boulot',
    'réunion',
    'reunion',
    'bureau',
    'job'
  ],

  social: [
    'ami',
    'amis',
    'famille',
    'visite',
    'anniversaire'
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
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nettoyerTexte(txt = '') {
  return String(txt)
    .replace(/\s+/g, ' ')
    .replace(/[|]+/g, ' ')
    .trim();
}

function deviner_categorie(texte = '') {
  const t = normaliser(texte);

  for (const [categorie, mots] of Object.entries(CATEGORIE_KEYWORDS)) {
    if (mots.some(mot => t.includes(normaliser(mot)))) {
      return categorie;
    }
  }

  return 'autre';
}


/* =========================================================
   FICHIER → DATA URL
   ========================================================= */

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () =>
      reject(
        new Error(
          "Impossible de lire le fichier sélectionné."
        )
      );

    reader.readAsDataURL(file);
  });
}


/* =========================================================
   PRÉTRAITEMENT IMAGE
   =========================================================
   Le tableau étant assez petit sur une photo de téléphone,
   on agrandit l'image avant OCR.
   ========================================================= */

async function preparerImage(file) {
  const dataUrl = await fileToDataURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const largeurMax = 2600;

        let width = img.width;
        let height = img.height;

        if (width < largeurMax) {
          const ratio = largeurMax / width;
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Amélioration légère du contraste
        const imageData = ctx.getImageData(
          0,
          0,
          width,
          height
        );

        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const gris =
            0.299 * r +
            0.587 * g +
            0.114 * b;

          // Contraste doux
          const nouveau = Math.max(
            0,
            Math.min(
              255,
              (gris - 128) * 1.15 + 128
            )
          );

          data[i] = nouveau;
          data[i + 1] = nouveau;
          data[i + 2] = nouveau;
        }

        ctx.putImageData(imageData, 0, 0);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (e) {
        resolve(dataUrl);
      }
    };

    img.onerror = () =>
      reject(
        new Error(
          "Impossible de préparer l'image."
        )
      );

    img.src = dataUrl;
  });
}


/* =========================================================
   EXTRACTION DES MOTS OCR
   ========================================================= */

function extraire_mots(data) {
  /*
   * Selon la version de Tesseract, les mots peuvent être
   * dans data.words ou dans blocks > paragraphs > lines > words.
   */

  if (Array.isArray(data?.words) && data.words.length) {
    return data.words
      .filter(w => w?.bbox && w.text?.trim())
      .map(w => ({
        text: nettoyerTexte(w.text),
        x0: Number(w.bbox.x0),
        x1: Number(w.bbox.x1),
        y0: Number(w.bbox.y0),
        y1: Number(w.bbox.y1),
        confidence: Number(w.confidence || 0)
      }));
  }

  const mots = [];

  const blocks = data?.blocks || [];

  blocks.forEach(block => {
    (block.paragraphs || []).forEach(paragraphe => {
      (paragraphe.lines || []).forEach(ligne => {
        (ligne.words || []).forEach(word => {
          if (word?.bbox && word.text?.trim()) {
            mots.push({
              text: nettoyerTexte(word.text),
              x0: Number(word.bbox.x0),
              x1: Number(word.bbox.x1),
              y0: Number(word.bbox.y0),
              y1: Number(word.bbox.y1),
              confidence: Number(word.confidence || 0)
            });
          }
        });
      });
    });
  });

  return mots;
}


/* =========================================================
   GROUPER LES MOTS EN LIGNES OCR
   ========================================================= */

function grouper_en_lignes(mots) {
  if (!mots?.length) return [];

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

  /*
   * Seuil assez tolérant car les différentes lignes du tableau
   * peuvent être légèrement inclinées sur une photo.
   */
  const seuil = Math.max(
    10,
    hauteurMoyenne * 0.75
  );

  const lignes = [];

  for (const mot of tries) {
    const centreY =
      (mot.y0 + mot.y1) / 2;

    let meilleure = null;
    let distanceMin = Infinity;

    for (const ligne of lignes) {
      const distance = Math.abs(
        ligne.centreY - centreY
      );

      if (
        distance < seuil &&
        distance < distanceMin
      ) {
        meilleure = ligne;
        distanceMin = distance;
      }
    }

    if (!meilleure) {
      meilleure = {
        centreY,
        mots: []
      };

      lignes.push(meilleure);
    }

    meilleure.mots.push(mot);

    meilleure.centreY =
      meilleure.mots.reduce(
        (s, m) =>
          s + (m.y0 + m.y1) / 2,
        0
      ) /
      meilleure.mots.length;
  }

  lignes.forEach(ligne => {
    ligne.mots.sort(
      (a, b) => a.x0 - b.x0
    );

    ligne.texte = nettoyerTexte(
      ligne.mots
        .map(m => m.text)
        .join(' ')
    );
  });

  lignes.sort(
    (a, b) =>
      a.centreY - b.centreY
  );

  return lignes;
}


/* =========================================================
   DÉTECTION DU JOUR
   ========================================================= */

function trouverJourDansTexte(texte) {
  const t = normaliser(texte);

  const variantes = {
    lundi: ['lundi', 'lundi'],
    mardi: ['mardi', 'mardl', 'mard'],
    mercredi: [
      'mercredi',
      'mercred',
      'mercredl'
    ],
    jeudi: ['jeudi', 'jeudl'],
    vendredi: [
      'vendredi',
      'vendred',
      'vendredl'
    ],
    samedi: ['samedi', 'samedl'],
    dimanche: [
      'dimanche',
      'dimanch',
      'dimanch e'
    ]
  };

  for (const jour of NOMS_JOURS) {
    if (
      variantes[jour]?.some(
        v => t.includes(normaliser(v))
      )
    ) {
      return jour;
    }
  }

  return null;
}


/* =========================================================
   DÉTECTION DES COLONNES
   =========================================================
   IMPORTANT :
   Le format Prépa 1 possède TOUJOURS :

   Horaire | Lundi | Mardi | Mercredi | Jeudi |
   Vendredi | Samedi | Dimanche

   Si l'OCR lit mal les noms des jours, on utilise la
   structure physique en 8 colonnes.
   ========================================================= */

function detecterColonnes(lignes, largeurImage) {
  const colonnes = [];

  /*
   * 1. On cherche les jours dans l'ensemble du document,
   *    pas obligatoirement sur une seule ligne.
   */

  for (const ligne of lignes) {
    for (const mot of ligne.mots) {
      const jour = trouverJourDansTexte(
        mot.text
      );

      if (jour) {
        const centre =
          (mot.x0 + mot.x1) / 2;

        if (
          !colonnes.some(
            c =>
              c.jour === jour &&
              Math.abs(c.centre - centre) < 80
          )
        ) {
          colonnes.push({
            jour,
            centre
          });
        }
      }
    }
  }

  /*
   * 2. Si au moins 4 jours sont trouvés,
   *    on complète les colonnes manquantes.
   */

  if (colonnes.length >= 4) {
    colonnes.sort(
      (a, b) => a.centre - b.centre
    );

    /*
     * Le tableau comporte 8 colonnes de largeur
     * approximativement régulière.
     *
     * On récupère les positions connues et on estime
     * les autres.
     */

    const centresConnus =
      colonnes.map(c => c.centre);

    const ecarts = [];

    for (let i = 1; i < centresConnus.length; i++) {
      const diff =
        centresConnus[i] -
        centresConnus[i - 1];

      if (diff > 50) {
        ecarts.push(diff);
      }
    }

    const ecartMoyen =
      ecarts.length
        ? ecarts.reduce((a, b) => a + b, 0) /
          ecarts.length
        : largeurImage / 8;

    /*
     * Si les centres sont suffisamment cohérents,
     * on utilise la grille du tableau.
     */

    if (ecartMoyen > 80) {
      const resultat = {};

      for (const c of colonnes) {
        resultat[c.jour] = c.centre;
      }

      /*
       * Si certains jours manquent, on cherche leur position
       * théorique à partir de la première colonne connue.
       */

      const indices = colonnes.map(
        c => NOMS_JOURS.indexOf(c.jour)
      );

      const positions = colonnes.map(
        c => c.centre
      );

      let pas = ecartMoyen;

      if (positions.length >= 2) {
        const total =
          positions[positions.length - 1] -
          positions[0];

        const diffIndice =
          indices[indices.length - 1] -
          indices[0];

        if (diffIndice > 0) {
          pas = total / diffIndice;
        }
      }

      const premierIndice = Math.min(
        ...indices
      );

      const premierePosition =
        positions[
          indices.indexOf(premierIndice)
        ];

      for (let i = 0; i < 7; i++) {
        if (!resultat[NOMS_JOURS[i]]) {
          resultat[NOMS_JOURS[i]] =
            premierePosition +
            (i - premierIndice) * pas;
        }
      }

      return construireBornesDepuisCentres(
        resultat,
        largeurImage
      );
    }
  }

  /*
   * 3. FALLBACK IMPORTANT :
   *    structure fixe du tableau.
   */

  return construireColonnesGrille(
    largeurImage
  );
}


/* =========================================================
   COLONNES À PARTIR D'UNE GRILLE FIXE
   ========================================================= */

function construireColonnesGrille(
  largeurImage
) {
  /*
   * Colonne Horaire = environ 7,5 %
   * Les 7 jours prennent le reste.
   */

  const largeurHoraire =
    largeurImage * 0.075;

  const largeurJours =
    (largeurImage - largeurHoraire) /
    7;

  const result = [];

  for (let i = 0; i < 7; i++) {
    const gauche =
      largeurHoraire +
      i * largeurJours;

    const droite =
      gauche + largeurJours;

    result.push({
      jour: NOMS_JOURS[i],
      gauche,
      droite,
      centre:
        (gauche + droite) / 2
    });
  }

  return {
    horaire: {
      gauche: 0,
      droite: largeurHoraire
    },
    jours: result
  };
}


/* =========================================================
   BORNES À PARTIR DES CENTRES
   ========================================================= */

function construireBornesDepuisCentres(
  centres,
  largeurImage
) {
  const valeurs = NOMS_JOURS.map(
    jour => ({
      jour,
      centre: centres[jour]
    })
  ).sort(
    (a, b) => a.centre - b.centre
  );

  const jours = valeurs.map(
    (item, index) => {
      const gauche =
        index === 0
          ? 0
          : (
              valeurs[index - 1].centre +
              item.centre
            ) / 2;

      const droite =
        index === valeurs.length - 1
          ? largeurImage
          : (
              item.centre +
              valeurs[index + 1].centre
            ) / 2;

      return {
        jour: item.jour,
        centre: item.centre,
        gauche,
        droite
      };
    }
  );

  return {
    horaire: {
      gauche: 0,
      droite:
        jours[0]?.gauche ||
        largeurImage * 0.075
    },
    jours
  };
}


/* =========================================================
   HORAIRES
   ========================================================= */

function normaliserOCRHoraire(texte) {
  if (!texte) return null;

  let t = normaliser(texte);

  /*
   * Corrections OCR fréquentes
   */

  t = t
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[—–−_]/g, '-')
    .replace(/\s+/g, ' ');

  /*
   * Exemples acceptés :
   * 08h00-12h00
   * 08h00 12h00
   * 08h-12h
   * 08:00-12:00
   * 08 00 12 00
   */

  const nombres = [
    ...t.matchAll(
      /(\d{1,2})\s*(?:h|:)?\s*(\d{0,2})/g
    )
  ];

  const candidats = [];

  for (const m of nombres) {
    const h = Number(m[1]);

    if (h >= 0 && h <= 23) {
      let minute = m[2] || '00';

      if (minute.length === 1) {
        minute = `${minute}0`;
      }

      const min = Number(minute);

      if (min >= 0 && min <= 59) {
        candidats.push({
          h,
          m: min
        });
      }
    }
  }

  if (candidats.length < 2) {
    return null;
  }

  const a = candidats[0];
  const b = candidats[1];

  /*
   * On ignore les faux positifs trop proches.
   */

  const debut =
    a.h * 60 + a.m;

  const fin =
    b.h * 60 + b.m;

  if (fin <= debut) {
    return null;
  }

  return (
    `${String(a.h).padStart(2, '0')}h` +
    `${String(a.m).padStart(2, '0')}-` +
    `${String(b.h).padStart(2, '0')}h` +
    `${String(b.m).padStart(2, '0')}`
  );
}


/* =========================================================
   EXTRAIRE HORAIRE DEPUIS UNE LIGNE
   ========================================================= */

function extraireHoraireLigne(
  ligne,
  borneHoraire
) {
  const motsHoraire =
    ligne.mots.filter(m => {
      const centre =
        (m.x0 + m.x1) / 2;

      return (
        centre >= borneHoraire.gauche &&
        centre <= borneHoraire.droite + 40
      );
    });

  const texte =
    motsHoraire
      .map(m => m.text)
      .join(' ');

  const horaire =
    normaliserOCRHoraire(texte);

  if (horaire) {
    return {
      horaire,
      mots: motsHoraire
    };
  }

  /*
   * Deuxième tentative sur toute la ligne.
   */

  const horaireGlobal =
    normaliserOCRHoraire(
      ligne.texte
    );

  if (horaireGlobal) {
    return {
      horaire: horaireGlobal,
      mots: motsHoraire
    };
  }

  return null;
}


/* =========================================================
   RECONSTRUCTION DU TABLEAU
   ========================================================= */

function extraire_tableau(
  mots,
  largeurImage,
  hauteurImage
) {
  if (!mots?.length) {
    return null;
  }

  const lignes =
    grouper_en_lignes(mots);

  if (!lignes.length) {
    return null;
  }

  const colonnes =
    detecterColonnes(
      lignes,
      largeurImage
    );

  if (
    !colonnes ||
    !colonnes.jours ||
    colonnes.jours.length !== 7
  ) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * Chercher toutes les lignes horaires
   * -------------------------------------------------------
   */

  const lignesHoraires = [];

  for (const ligne of lignes) {
    const info =
      extraireHoraireLigne(
        ligne,
        colonnes.horaire
      );

    if (!info) continue;

    /*
     * Éviter les doublons OCR.
     */

    const existe =
      lignesHoraires.some(
        x =>
          Math.abs(
            x.centreY -
            ligne.centreY
          ) < 20
      );

    if (!existe) {
      lignesHoraires.push({
        centreY: ligne.centreY,
        horaire: info.horaire
      });
    }
  }

  lignesHoraires.sort(
    (a, b) =>
      a.centreY - b.centreY
  );

  if (!lignesHoraires.length) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * Pour chaque ligne horaire, on récupère tout le contenu
   * jusqu'à la prochaine ligne horaire.
   * -------------------------------------------------------
   */

  const resultats = [];

  for (
    let i = 0;
    i < lignesHoraires.length;
    i++
  ) {
    const actuelle =
      lignesHoraires[i];

    const prochaine =
      lignesHoraires[i + 1];

    const haut =
      actuelle.centreY - 35;

    const bas =
      prochaine
        ? (actuelle.centreY +
            prochaine.centreY) / 2
        : Math.min(
            hauteurImage,
            actuelle.centreY + 120
          );

    /*
     * Tous les mots appartenant à cette ligne
     */

    const motsLigne =
      mots.filter(m => {
        const centreY =
          (m.y0 + m.y1) / 2;

        return (
          centreY >= haut &&
          centreY < bas
        );
      });

    const parJour = {};

    /*
     * Chaque mot est affecté à la colonne
     * correspondant à son centre X.
     */

    for (const colonne of colonnes.jours) {
      const motsCellule =
        motsLigne
          .filter(m => {
            const centreX =
              (m.x0 + m.x1) / 2;

            return (
              centreX >= colonne.gauche &&
              centreX < colonne.droite
            );
          })
          .sort(
            (a, b) =>
              a.y0 - b.y0 ||
              a.x0 - b.x0
          );

      const texte =
        nettoyerTexte(
          motsCellule
            .map(m => m.text)
            .join(' ')
        );

      if (texte) {
        parJour[colonne.jour] =
          texte;
      }
    }

    /*
     * Ne pas créer une ligne vide.
     */

    if (
      Object.keys(parJour).length > 0
    ) {
      resultats.push({
        horaire: actuelle.horaire,
        parJour
      });
    }
  }

  /*
   * Supprimer les doublons horaires.
   */

  const uniques = [];

  for (const item of resultats) {
    const existe =
      uniques.find(
        x =>
          x.horaire === item.horaire
      );

    if (!existe) {
      uniques.push(item);
    }
  }

  return uniques.length
    ? uniques
    : null;
}


/* =========================================================
   CONVERSION TABLEAU → CRÉNEAUX
   ========================================================= */

function construire_creneaux_depuis_tableau(
  tableau
) {
  return tableau.map(
    ({ horaire, parJour }, index) => {
      const cellules = {};

      NOMS_JOURS.forEach(
        (jour, jourIndex) => {
          const texte =
            nettoyerTexte(
              parJour?.[jour] || ''
            );

          if (texte) {
            cellules[String(jourIndex)] =
              texte;
          }
        }
      );

      /*
       * Le contenu principal est le premier contenu
       * trouvé. Les cellules individuelles restent
       * indépendantes.
       */

      const premierTexte =
        Object.values(cellules)[0] ||
        'Activité';

      return {
        id:
          `ocr_${Date.now()}_${index}`,
        libelle:
          horaire || '08h00-10h00',
        contenu:
          premierTexte,
        categorie:
          deviner_categorie(
            premierTexte
          ),
        cellules
      };
    }
  );
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

  const [ocrText, setOcrText] =
    useState('');

  const [afficherOCR, setAfficherOCR] =
    useState(false);

  const fileRef =
    useRef(null);


  /* =======================================================
     IMPORTATION
     ======================================================= */

  async function handleFile(file) {
    if (!file) return;

    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');
    setProgression(0);
    setAfficherOCR(false);

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
          : 'Programme Prépa 1 Géologie–Mines';


      /* ---------------------------------------------------
         Préparer l'image
         --------------------------------------------------- */

      const image =
        await preparerImage(file);


      /* ---------------------------------------------------
         Tesseract
         --------------------------------------------------- */

      worker =
        await createWorker(
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
       * PSM 6 :
       * l'image est traitée comme un bloc uniforme
       * ce qui convient mieux à votre tableau.
       */

      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '6',
          preserve_interword_spaces: '1'
        });
      } catch (e) {
        // Certaines versions de Tesseract peuvent
        // ne pas accepter tous les paramètres.
      }


      const ret =
        await worker.recognize(
          image
        );


      const texteOCR =
        ret?.data?.text || '';

      setOcrText(texteOCR);


      /* ---------------------------------------------------
         Dimensions de l'image
         --------------------------------------------------- */

      const dimensions =
        await new Promise(
          resolve => {
            const img =
              new Image();

            img.onload = () =>
              resolve({
                width: img.width,
                height: img.height
              });

            img.onerror = () =>
              resolve({
                width: 2000,
                height: 1200
              });

            img.src = image;
          }
        );


      /* ---------------------------------------------------
         Mots avec coordonnées
         --------------------------------------------------- */

      const mots =
        extraire_mots(
          ret.data
        );


      if (!mots.length) {
        throw new Error(
          "Aucun texte exploitable n'a été détecté dans l'image."
        );
      }


      /* ---------------------------------------------------
         Reconstruction
         --------------------------------------------------- */

      const tableau =
        extraire_tableau(
          mots,
          dimensions.width,
          dimensions.height
        );


      if (
        !tableau ||
        tableau.length === 0
      ) {
        throw new Error(
          "Le tableau n'a pas pu être reconstruit. Le texte a peut-être été reconnu, mais les colonnes Horaire/Lundi/Mardi/etc. n'ont pas été suffisamment détectées."
        );
      }


      /* ---------------------------------------------------
         Créneaux
         --------------------------------------------------- */

      const creneaux =
        construire_creneaux_depuis_tableau(
          tableau
        );


      if (!creneaux.length) {
        throw new Error(
          "Aucun créneau exploitable n'a été trouvé."
        );
      }


      /* ---------------------------------------------------
         Programme
         --------------------------------------------------- */

      setProgramme({
        nom:
          formattedName ||
          'Programme Prépa 1 Géologie–Mines',

        description:
          'Programme importé depuis un tableau',

        creneaux
      });

      setEtape('edition');

    } catch (err) {
      console.error(
        'Erreur OCR détaillée :',
        err
      );

      setErrorMsg(
        err?.message ||
        String(err)
      );

      setEtape('erreur');

    } finally {
      setLoading(false);

      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {}
      }

      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }


  /* =======================================================
     MODIFIER UNE LIGNE / HORAIRE
     ======================================================= */

  function modifierCreneau(
    index,
    champ,
    valeur
  ) {
    setProgramme(prev => {
      if (!prev) return prev;

      const nouveauxCreneaux =
        [...prev.creneaux];

      nouveauxCreneaux[index] = {
        ...nouveauxCreneaux[index],
        [champ]: valeur
      };

      if (
        champ === 'contenu'
      ) {
        nouveauxCreneaux[index]
          .categorie =
          deviner_categorie(
            valeur
          );
      }

      return {
        ...prev,
        creneaux:
          nouveauxCreneaux
      };
    });
  }


  /* =======================================================
     ⭐ MODIFICATION INDÉPENDANTE D'UNE CELLULE
     ======================================================= */

  function modifierCelluleJour(
    indexCreneau,
    indexJour,
    valeur
  ) {
    setProgramme(prev => {
      if (!prev) return prev;

      const nouveauxCreneaux =
        [...prev.creneaux];

      const ancien =
        nouveauxCreneaux[
          indexCreneau
        ];

      const cellules = {
        ...(ancien.cellules || {})
      };

      /*
       * IMPORTANT :
       * On modifie uniquement cette cellule.
       */

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

      nouveauxCreneaux[
        indexCreneau
      ] = {
        ...ancien,
        cellules
      };

      return {
        ...prev,
        creneaux:
          nouveauxCreneaux
      };
    });
  }


  /* =======================================================
     AJOUTER UN CRÉNEAU
     ======================================================= */

  function ajouterCreneau() {
    setProgramme(prev => {
      if (!prev) return prev;

      const nouveau = {
        id:
          `cr_${Date.now()}`,
        libelle:
          '08h00-10h00',
        contenu:
          'Activité',
        categorie:
          'autre',
        cellules: {}
      };

      return {
        ...prev,
        creneaux: [
          ...(prev.creneaux || []),
          nouveau
        ]
      };
    });
  }


  /* =======================================================
     SUPPRIMER UN CRÉNEAU
     ======================================================= */

  function supprimerCreneau(index) {
    setProgramme(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        creneaux:
          prev.creneaux.filter(
            (_, i) => i !== index
          )
      };
    });
  }


  /* =======================================================
     ENREGISTRER DANS SUPABASE
     ======================================================= */

  async function validerProgramme() {
    if (!programme) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const creneauxNettoyes =
        (
          programme.creneaux || []
        ).map((cr, i) => {
          let libelle =
            cr.libelle ||
            '08h00-10h00';

          /*
           * Nettoyage horaire
           */

          const horairePropre =
            normaliserOCRHoraire(
              libelle
            );

          if (horairePropre) {
            libelle =
              horairePropre;
          }

          /*
           * Conservation exacte des cellules
           */

          const cellules = {
            ...(cr.cellules || {})
          };

          return {
            id:
              cr.id ||
              `cr_${Date.now()}_${i}`,

            libelle,

            contenu:
              cr.contenu &&
              cr.contenu.trim()
                ? cr.contenu.trim()
                : 'Activité',

            categorie:
              cr.categorie ||
              'autre',

            cellules
          };
        });


      /* ---------------------------------------------------
         Jours
         --------------------------------------------------- */

      const jours =
        JOURS.map(
          (jour, index) => ({
            id: String(index),
            nom: jour,
            actif: true
          })
        );


      /* ---------------------------------------------------
         Création Supabase
         --------------------------------------------------- */

      const prog =
        await base44.entities.Programme.create(
          {
            nom:
              programme.nom ||
              'Programme Prépa 1 Géologie–Mines',

            description:
              'Programme importé et personnalisé depuis un tableau',

            couleur_theme:
              '#3498DB',

            jours,

            creneaux:
              creneauxNettoyes
          }
        );


      if (onProgrammeCreated) {
        onProgrammeCreated(prog);
      }

      if (onClose) {
        onClose();
      }

    } catch (err) {
      console.error(
        'Erreur détaillée enregistrement :',
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
     RENDER
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
        className="w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl border border-border p-4 sm:p-6 animate-fade-in overflow-hidden"
        style={{
          background: '#0D0D18'
        }}
      >

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">

          <div className="flex items-center gap-3">

            <Camera
              size={22}
              style={{
                color:
                  'var(--gold)'
              }}
            />

            <div>
              <h2 className="text-lg font-black text-foreground">
                Importation & Édition
              </h2>

              <p className="text-xs text-muted-foreground">
                Prépa 1 Géologie–Mines
              </p>
            </div>

          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent"
          >
            <X
              size={22}
              className="text-muted-foreground"
            />
          </button>

        </div>


        {/* =================================================
            UPLOAD
            ================================================= */}

        {etape === 'upload' && (
          <div className="py-6">

            <div className="mb-5">

              <p className="text-base font-bold text-foreground mb-2">
                Importez votre emploi du temps
              </p>

              <p className="text-sm text-muted-foreground">
                L'application reconnaît la structure
                Horaire / Lundi / Mardi / Mercredi /
                Jeudi / Vendredi / Samedi / Dimanche,
                puis vous permet de modifier chaque
                cellule indépendamment.
              </p>

            </div>


            <div
              onClick={() =>
                fileRef.current?.click()
              }
              className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-gold transition-colors"
              style={{
                background:
                  'var(--accent)'
              }}
            >

              <Upload
                size={38}
                className="text-muted-foreground mb-4"
              />

              <p className="text-base font-black text-foreground">
                Cliquez pour importer
              </p>

              <p className="text-xs text-muted-foreground mt-2 text-center">
                Photo claire, droite et suffisamment
                grande recommandée
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
          <div className="flex flex-col items-center justify-center py-16 text-center">

            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background:
                  'var(--gold-dim)'
              }}
            >

              <Calendar
                size={34}
                style={{
                  color:
                    'var(--gold)'
                }}
              />

            </div>

            <p className="text-lg font-black text-foreground mb-2">
              Analyse du tableau…
            </p>

            <p className="text-sm text-muted-foreground mb-5">
              Lecture des horaires et des cellules
            </p>

            <div className="w-full max-w-md h-2 rounded-full bg-accent overflow-hidden">

              <div
                className="h-full transition-all duration-300"
                style={{
                  width:
                    `${progression}%`,
                  background:
                    'var(--gold)'
                }}
              />

            </div>

            <p className="text-xs text-muted-foreground mt-3">
              {progression} %
            </p>

          </div>
        )}


        {/* =================================================
            ERREUR
            ================================================= */}

        {etape === 'erreur' && (
          <div className="flex flex-col items-center py-8 text-center overflow-y-auto">

            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background:
                  'rgba(231,76,60,0.15)'
              }}
            >
              <X
                size={34}
                style={{
                  color:
                    '#E74C3C'
                }}
              />
            </div>


            <p className="text-lg font-black text-foreground mb-2">
              Le tableau n'a pas pu être importé
            </p>


            <p className="text-sm text-muted-foreground max-w-xl mb-5">
              {errorMsg}
            </p>


            {/* OCR brut */}

            {ocrText && (
              <div className="w-full max-w-3xl mb-5">

                <button
                  onClick={() =>
                    setAfficherOCR(
                      !afficherOCR
                    )
                  }
                  className="flex items-center gap-2 text-sm font-bold text-muted-foreground mx-auto"
                >

                  {afficherOCR ? (
                    <ChevronDown size={16} />
                  ) : (
                    <Eye size={16} />
                  )}

                  Voir le texte reconnu par OCR

                </button>


                {afficherOCR && (
                  <pre
                    className="mt-3 p-4 rounded-xl text-left text-xs whitespace-pre-wrap overflow-auto max-h-64 border border-border"
                    style={{
                      background:
                        'var(--accent)'
                    }}
                  >
                    {ocrText}
                  </pre>
                )}

              </div>
            )}


            <button
              onClick={() => {
                setEtape('upload');
                setErrorMsg('');
                setOcrText('');
              }}
              className="w-full max-w-xl py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
              style={{
                background:
                  'var(--gold)',
                color:
                  '#080810'
              }}
            >
              <RotateCcw size={17} />
              Réessayer
            </button>

          </div>
        )}


        {/* =================================================
            ÉDITION
            ================================================= */}

        {etape === 'edition' &&
          programme && (

            <div className="flex flex-col flex-1 min-h-0">

              {/* INFO */}

              <div className="flex items-center gap-2 mb-3">

                <CheckCircle2
                  size={17}
                  style={{
                    color:
                      '#2ECC71'
                  }}
                />

                <p className="text-sm font-bold text-foreground">
                  Tableau reconnu — vous pouvez modifier chaque cellule indépendamment.
                </p>

              </div>


              {/* NOM */}

              <div className="mb-4">

                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1">
                  NOM DU PROGRAMME
                </label>

                <input
                  value={
                    programme.nom ||
                    ''
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
                  className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                />

              </div>


              {/* =================================================
                  VRAI TABLEAU
                  ================================================= */}

              <div
                className="flex-1 overflow-auto border border-border rounded-xl"
                style={{
                  background:
                    'var(--surface)'
                }}
              >

                <table className="w-full min-w-[1050px] border-collapse">

                  {/* HEADER */}

                  <thead>
                    <tr>

                      <th
                        className="sticky top-0 z-10 p-3 text-left text-xs font-black border-b border-r border-border"
                        style={{
                          background:
                            'var(--accent)'
                        }}
                      >
                        Horaire
                      </th>

                      {JOURS.map(
                        (jour, index) => (
                          <th
                            key={index}
                            className="sticky top-0 z-10 p-3 text-center text-xs font-black border-b border-r border-border"
                            style={{
                              background:
                                'var(--accent)'
                            }}
                          >
                            {jour}
                          </th>
                        )
                      )}

                    </tr>
                  </thead>


                  {/* CORPS */}

                  <tbody>

                    {(
                      programme.creneaux ||
                      []
                    ).map(
                      (cr, idx) => (

                        <tr
                          key={
                            cr.id ||
                            idx
                          }
                          className="hover:bg-accent/40"
                        >

                          {/* HORAIRE */}

                          <td className="p-2 border-b border-r border-border align-top">

                            <input
                              value={
                                cr.libelle ||
                                ''
                              }
                              onChange={e =>
                                modifierCreneau(
                                  idx,
                                  'libelle',
                                  e.target.value
                                )
                              }
                              className="w-[125px] bg-accent border border-border rounded-lg px-2 py-2 text-xs font-mono font-bold text-foreground outline-none focus:border-gold"
                            />

                            <button
                              onClick={() =>
                                supprimerCreneau(
                                  idx
                                )
                              }
                              className="mt-1 p-1 text-muted-foreground hover:text-red-400"
                              title="Supprimer le créneau"
                            >
                              <Trash2
                                size={13}
                              />
                            </button>

                          </td>


                          {/* ⭐ CELLULES INDÉPENDANTES */}

                          {JOURS.map(
                            (
                              _jour,
                              jourIndex
                            ) => {

                              const valeur =
                                cr.cellules?.[
                                  String(
                                    jourIndex
                                  )
                                ] || '';

                              return (
                                <td
                                  key={
                                    jourIndex
                                  }
                                  className="p-2 border-b border-r border-border align-top"
                                >

                                  <textarea
                                    value={
                                      valeur
                                    }
                                    onChange={e =>
                                      modifierCelluleJour(
                                        idx,
                                        jourIndex,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Activité"
                                    rows={3}
                                    className="w-full min-w-[125px] bg-accent border border-border rounded-lg px-2 py-2 text-xs text-foreground outline-none resize-y focus:border-gold"
                                  />

                                </td>
                              );
                            }
                          )}

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>


              {/* AJOUT */}

              <button
                onClick={
                  ajouterCreneau
                }
                className="mt-3 self-start px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-2"
              >
                <Plus size={15} />
                Ajouter un créneau
              </button>


              {/* BOUTONS */}

              <div className="flex gap-2 mt-4 pt-3 border-t border-border">

                <button
                  onClick={() =>
                    setEtape(
                      'upload'
                    )
                  }
                  className="flex-1 py-3 rounded-xl text-sm font-bold border border-border text-muted-foreground flex items-center justify-center gap-2"
                >
                  <RotateCcw
                    size={16}
                  />
                  Recommencer
                </button>


                <button
                  onClick={
                    validerProgramme
                  }
                  disabled={
                    loading
                  }
                  className="flex-1 py-3 rounded-xl text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background:
                      'var(--gold)',
                    color:
                      '#080810'
                  }}
                >

                  {loading ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={17}
                      />
                      Enregistrer le programme
                    </>
                  )}

                </button>

              </div>

            </div>
          )}

      </div>
    </div>
  );
}