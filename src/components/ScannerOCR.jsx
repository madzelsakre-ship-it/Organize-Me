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
  Edit3,
  AlertTriangle
} from 'lucide-react';
import { JOURS } from '@/lib/coachData';

/*
|--------------------------------------------------------------------------
| CONFIGURATION DU TABLEAU
|--------------------------------------------------------------------------
|
| Format exact :
|
| Horaire | Lundi | Mardi | Mercredi | Jeudi | Vendredi | Samedi | Dimanche
|
| 10 lignes :
| 06h45-07h25
| 08h00-12h00
| 12h00-13h00
| 13h00-17h00
| 17h00-18h00
| 18h00-19h00
| 19h00-19h50
| 19h50-20h50
| 20h50-21h30
| 21h30-22h00
|
|--------------------------------------------------------------------------
*/

const JOURS_OCR = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche'
];

const HORAIRES_REFERENCE = [
  '06h45-07h25',
  '08h00-12h00',
  '12h00-13h00',
  '13h00-17h00',
  '17h00-18h00',
  '18h00-19h00',
  '19h00-19h50',
  '19h50-20h50',
  '20h50-21h30',
  '21h30-22h00'
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
    'douche'
  ],

  sante: [
    'repas',
    'déjeuner',
    'dejeuner',
    'diner',
    'dîner',
    'petit-déjeuner',
    'petit dejeuner',
    'manger',
    'dodo',
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
    'math',
    'maths',
    'algèbre',
    'algebre',
    'analyse',
    'physique',
    'chimie',
    'informatique',
    'anglais',
    'français',
    'francais',
    'techniques',
    'recherche',
    'exercices',
    'fiches',
    'td',
    'cm'
  ],

  travail: [
    'travail',
    'boulot',
    'réunion',
    'reunion',
    'bureau',
    'job',
    'profond'
  ],

  social: [
    'ami',
    'amis',
    'famille',
    'visite',
    'anniversaire'
  ]
};

/*
|--------------------------------------------------------------------------
| TEXTE
|--------------------------------------------------------------------------
*/

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

function deviner_categorie(texte = '') {
  const t = normaliser(texte);

  for (const [categorie, mots] of Object.entries(
    CATEGORIE_KEYWORDS
  )) {
    if (
      mots.some(mot =>
        t.includes(normaliser(mot))
      )
    ) {
      return categorie;
    }
  }

  return 'autre';
}

/*
|--------------------------------------------------------------------------
| CHARGEMENT IMAGE
|--------------------------------------------------------------------------
*/

function chargerImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(
        new Error(
          "Impossible de charger l'image."
        )
      );
    };

    image.src = URL.createObjectURL(file);
  });
}

/*
|--------------------------------------------------------------------------
| PRÉTRAITEMENT
|--------------------------------------------------------------------------
|
| On agrandit l'image avant OCR.
|
| Les textes de votre tableau sont relativement petits.
| L'agrandissement améliore beaucoup la reconnaissance.
|--------------------------------------------------------------------------
*/

async function preparerImage(file) {
  const image = await chargerImage(file);

  const largeurOriginale = image.naturalWidth;
  const hauteurOriginale = image.naturalHeight;

  /*
   * On limite l'agrandissement pour éviter de faire exploser
   * la mémoire sur téléphone.
   */
  const facteur = 2;

  const largeur = Math.min(
    largeurOriginale * facteur,
    5000
  );

  const hauteur =
    hauteurOriginale *
    (largeur / largeurOriginale);

  const canvas =
    document.createElement('canvas');

  canvas.width = Math.round(largeur);
  canvas.height = Math.round(hauteur);

  const ctx =
    canvas.getContext('2d', {
      willReadFrequently: true
    });

  /*
   * Fond blanc.
   */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  URL.revokeObjectURL(image.src);

  return canvas;
}

/*
|--------------------------------------------------------------------------
| OCR
|--------------------------------------------------------------------------
*/

function extraire_mots(data) {
  const mots = [];

  /*
   * Tesseract fournit normalement data.words.
   */
  if (Array.isArray(data?.words)) {
    data.words.forEach(word => {
      if (
        !word?.bbox ||
        !word?.text?.trim()
      ) {
        return;
      }

      const confidence =
        Number(word.confidence ?? 100);

      /*
       * On élimine uniquement les reconnaissances
       * extrêmement mauvaises.
       */
      if (
        Number.isFinite(confidence) &&
        confidence < 15
      ) {
        return;
      }

      mots.push({
        text: nettoyerTexte(word.text),

        x0: Number(word.bbox.x0),
        x1: Number(word.bbox.x1),
        y0: Number(word.bbox.y0),
        y1: Number(word.bbox.y1),

        confidence
      });
    });
  }

  /*
   * Compatibilité anciennes versions Tesseract.
   */
  if (mots.length === 0) {
    const blocks =
      data?.blocks || [];

    blocks.forEach(block => {
      (block.paragraphs || [])
        .forEach(paragraph => {

          (paragraph.lines || [])
            .forEach(line => {

              (line.words || [])
                .forEach(word => {

                  if (
                    !word?.bbox ||
                    !word?.text?.trim()
                  ) {
                    return;
                  }

                  mots.push({
                    text:
                      nettoyerTexte(
                        word.text
                      ),

                    x0:
                      Number(
                        word.bbox.x0
                      ),

                    x1:
                      Number(
                        word.bbox.x1
                      ),

                    y0:
                      Number(
                        word.bbox.y0
                      ),

                    y1:
                      Number(
                        word.bbox.y1
                      ),

                    confidence:
                      Number(
                        word.confidence ??
                        100
                      )
                  });
                });
            });
        });
    });
  }

  return mots;
}

/*
|--------------------------------------------------------------------------
| HORAIRE
|--------------------------------------------------------------------------
*/

function convertirHoraire(texte) {
  if (!texte) return null;

  let t = normaliser(texte);

  /*
   * Corrections OCR fréquentes.
   */
  t = t
    .replace(/[oO]/g, '0')
    .replace(/[iIlL|]/g, '1')
    .replace(/[–—−]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');

  /*
   * Exemples reconnus :
   *
   * 06h45-07h25
   * 06h45–07h25
   * 06:45-07:25
   * 6h45-7h25
   */

  const match = t.match(
    /(\d{1,2})[:h](\d{2})[-](\d{1,2})[:h](\d{2})/
  );

  if (!match) {
    return null;
  }

  let [
    ,
    h1,
    m1,
    h2,
    m2
  ] = match;

  h1 = h1.padStart(2, '0');
  h2 = h2.padStart(2, '0');

  return `${h1}h${m1}-${h2}h${m2}`;
}

/*
|--------------------------------------------------------------------------
| EXTRACTION DES HORAIRES PAR POSITION
|--------------------------------------------------------------------------
|
| On connaît les horaires du modèle.
|
| L'OCR peut lire :
|
| 06h45-07r25
|
| au lieu de :
|
| 06h45-07h25
|
| On utilise donc aussi la position verticale.
|--------------------------------------------------------------------------
*/

function trouverLignesHoraires(
  mots,
  hauteurImage
) {
  /*
   * Le tableau principal occupe environ :
   *
   * y = 10% → 56% de l'image
   *
   * On cherche les mots horaires dans cette zone.
   */
  const candidats = [];

  for (const mot of mots) {
    const texte =
      normaliser(mot.text);

    const y =
      (mot.y0 + mot.y1) / 2;

    if (
      y < hauteurImage * 0.08 ||
      y > hauteurImage * 0.60
    ) {
      continue;
    }

    /*
     * Un horaire OCR peut être dans un seul mot.
     */
    if (
      convertirHoraire(texte)
    ) {
      candidats.push({
        y,
        texte: convertirHoraire(texte)
      });

      continue;
    }

    /*
     * Quelques variantes OCR.
     */
    const compact =
      texte
        .replace(/[oO]/g, '0')
        .replace(/[iIlL|]/g, '1')
        .replace(/[–—−]/g, '-')
        .replace(/\s+/g, '');

    const chiffres =
      compact.match(
        /(\d{1,2})\D?(\d{2})\D+(\d{1,2})\D?(\d{2})/
      );

    if (chiffres) {
      const h1 =
        chiffres[1]
          .padStart(2, '0');

      const m1 =
        chiffres[2];

      const h2 =
        chiffres[3]
          .padStart(2, '0');

      const m2 =
        chiffres[4];

      candidats.push({
        y,
        texte:
          `${h1}h${m1}-${h2}h${m2}`
      });
    }
  }

  /*
   * Regrouper les horaires proches verticalement.
   */
  candidats.sort(
    (a, b) => a.y - b.y
  );

  const groupes = [];

  for (const candidat of candidats) {
    let groupe =
      groupes.find(
        g =>
          Math.abs(
            g.y - candidat.y
          ) < hauteurImage * 0.012
      );

    if (!groupe) {
      groupe = {
        y: candidat.y,
        candidats: []
      };

      groupes.push(groupe);
    }

    groupe.candidats.push(
      candidat
    );
  }

  const resultats =
    groupes.map(groupe => {

      /*
       * Si plusieurs détections,
       * prendre celle qui ressemble le plus
       * à un horaire valide.
       */
      let meilleur =
        groupe.candidats[0];

      return {
        y: groupe.y,
        horaire:
          meilleur?.texte
      };
    });

  /*
   * On tente de compléter avec les horaires
   * de référence si l'OCR en a raté certains.
   */
  const propres = [];

  resultats.forEach(item => {
    if (
      item.horaire &&
      !propres.some(
        x =>
          Math.abs(
            x.y - item.y
          ) <
          hauteurImage * 0.015
      )
    ) {
      propres.push(item);
    }
  });

  return propres.slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| ESTIMATION GÉOMÉTRIQUE DU TABLEAU
|--------------------------------------------------------------------------
|
| Format exact du document :
|
| ┌─────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
| │ Horaire │ Lundi  │ Mardi  │ Mercr. │ Jeudi  │ Vend.  │ Samedi │ Dim.   │
| └─────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
|
|--------------------------------------------------------------------------
*/

function definirGrille(
  largeur,
  hauteur
) {
  /*
   * Ces proportions correspondent au document fourni.
   *
   * Elles sont volontairement légèrement élargies
   * afin de fonctionner avec une photo/capture du même
   * tableau.
   */

  const gauche =
    largeur * 0.012;

  const droite =
    largeur * 0.988;

  const haut =
    hauteur * 0.103;

  const bas =
    hauteur * 0.568;

  const largeurTableau =
    droite - gauche;

  /*
   * 8 colonnes :
   * 1 horaire + 7 jours.
   *
   * La colonne horaire est plus petite.
   */
  const largeurHoraire =
    largeurTableau * 0.075;

  const debutJours =
    gauche + largeurHoraire;

  const largeurJour =
    (droite - debutJours) / 7;

  const colonnes = [];

  /*
   * Colonne Horaire.
   */
  colonnes.push({
    type: 'horaire',
    index: -1,
    gauche,
    droite: debutJours
  });

  /*
   * 7 jours.
   */
  for (let i = 0; i < 7; i++) {
    colonnes.push({
      type: 'jour',
      index: i,
      jour:
        JOURS_OCR[i],
      gauche:
        debutJours +
        i * largeurJour,
      droite:
        debutJours +
        (i + 1) *
          largeurJour
    });
  }

  /*
   * Le header bleu représente environ 6%
   * de la hauteur du tableau.
   */
  const hauteurHeader =
    (bas - haut) * 0.065;

  const debutLignes =
    haut + hauteurHeader;

  /*
   * 10 lignes.
   *
   * On utilise les proportions réelles du tableau.
   */
  const hauteurDonnees =
    bas - debutLignes;

  const lignes = [];

  for (let i = 0; i < 10; i++) {
    lignes.push({
      index: i,

      haut:
        debutLignes +
        (i / 10) *
          hauteurDonnees,

      bas:
        debutLignes +
        ((i + 1) / 10) *
          hauteurDonnees,

      horaire:
        HORAIRES_REFERENCE[i]
    });
  }

  return {
    gauche,
    droite,
    haut,
    bas,
    colonnes,
    lignes
  };
}

/*
|--------------------------------------------------------------------------
| ASSIGNATION DES MOTS AUX CELLULES
|--------------------------------------------------------------------------
*/

function reconstruireTableau(
  mots,
  largeur,
  hauteur
) {
  const grille =
    definirGrille(
      largeur,
      hauteur
    );

  /*
   * Structure :
   *
   * [
   *   {
   *     horaire: "08h00-12h00",
   *     parJour: {
   *       lundi: "...",
   *       mardi: "...",
   *       ...
   *     }
   *   }
   * ]
   */

  const resultats =
    grille.lignes.map(
      ligne => ({
        horaire:
          ligne.horaire,
        parJour: {}
      })
    );

  /*
   * On ignore les mots :
   *
   * - au-dessus du tableau
   * - dans le header
   * - sous le tableau
   */
  const motsUtiles =
    mots.filter(mot => {
      const x =
        (mot.x0 + mot.x1) / 2;

      const y =
        (mot.y0 + mot.y1) / 2;

      return (
        x >= grille.gauche &&
        x <= grille.droite &&
        y >= grille.haut &&
        y <= grille.bas
      );
    });

  /*
   * Chaque mot est affecté à :
   *
   * 1 ligne
   * 1 colonne
   */
  motsUtiles.forEach(mot => {
    const x =
      (mot.x0 + mot.x1) / 2;

    const y =
      (mot.y0 + mot.y1) / 2;

    const ligne =
      grille.lignes.find(
        l =>
          y >= l.haut &&
          y < l.bas
      );

    if (!ligne) return;

    const colonne =
      grille.colonnes.find(
        c =>
          x >= c.gauche &&
          x < c.droite
      );

    if (!colonne) return;

    /*
     * On ne met pas la colonne horaire dans
     * les activités.
     */
    if (
      colonne.type !== 'jour'
    ) {
      return;
    }

    const jour =
      colonne.jour;

    if (!resultats[ligne.index].parJour[jour]) {
      resultats[
        ligne.index
      ].parJour[jour] = [];
    }

    resultats[
      ligne.index
    ].parJour[jour].push({
      text: mot.text,
      x,
      y
    });
  });

  /*
   * Recomposer chaque cellule.
   *
   * Les mots sont triés :
   *
   * d'abord verticalement,
   * puis horizontalement.
   */
  resultats.forEach(ligne => {
    Object.keys(
      ligne.parJour
    ).forEach(jour => {

      const motsCellule =
        ligne.parJour[jour];

      motsCellule.sort(
        (a, b) => {

          const differenceY =
            a.y - b.y;

          /*
           * Si les mots sont sur des lignes
           * différentes, garder l'ordre vertical.
           */
          if (
            Math.abs(differenceY) >
            10
          ) {
            return differenceY;
          }

          return a.x - b.x;
        }
      );

      /*
       * On reconstruit le texte.
       *
       * Exemple :
       *
       * Travail profond : Techniques de
       * recherche / cours du jour
       * Exercices + fiches
       *
       * devient :
       *
       * Travail profond : Techniques de recherche / cours du jour Exercices + fiches
       */
      ligne.parJour[jour] =
        motsCellule
          .map(m => m.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
    });
  });

  /*
   * Détection intelligente des horaires.
   *
   * Si OCR trouve un horaire qui correspond
   * à une ligne, on le remplace.
   */
  const lignesOCR =
    trouverLignesHoraires(
      mots,
      hauteur
    );

  lignesOCR.forEach(
    item => {

      const ligne =
        grille.lignes.find(
          l =>
            Math.abs(
              (
                (l.haut + l.bas) /
                2
              ) - item.y
            ) <
            hauteur * 0.025
        );

      if (
        ligne &&
        item.horaire
      ) {
        resultats[
          ligne.index
        ].horaire =
          item.horaire;
      }
    }
  );

  /*
   * Nettoyage.
   */
  resultats.forEach(
    ligne => {
      Object.keys(
        ligne.parJour
      ).forEach(jour => {

        const texte =
          ligne.parJour[jour];

        /*
         * Ne pas conserver des cellules
         * contenant uniquement des fragments
         * d'horaire.
         */
        if (
          !texte ||
          texte.length < 2 ||
          convertirHoraire(texte)
        ) {
          delete ligne.parJour[
            jour
          ];
        }
      });
    }
  );

  /*
   * Vérification :
   * combien de cellules avons-nous trouvées ?
   */
  let nombreCellules = 0;

  resultats.forEach(
    ligne => {
      nombreCellules +=
        Object.keys(
          ligne.parJour
        ).length;
    }
  );

  console.log(
    'OCR : cellules détectées =',
    nombreCellules
  );

  console.log(
    'OCR : tableau reconstruit =',
    resultats
  );

  /*
   * Au minimum, il faut plusieurs cellules.
   */
  if (
    nombreCellules < 3
  ) {
    return null;
  }

  return resultats;
}

/*
|--------------------------------------------------------------------------
| CONSTRUCTION DES CRÉNEAUX
|--------------------------------------------------------------------------
*/

function construireCreneaux(
  tableau
) {
  return tableau.map(
    (ligne, index) => {

      const cellules = {};

      JOURS_OCR.forEach(
        (jour, jourIndex) => {

          const valeur =
            ligne.parJour[
              jour
            ];

          if (
            valeur &&
            valeur.trim()
          ) {
            cellules[
              String(jourIndex)
            ] =
              valeur.trim();
          }
        }
      );

      /*
       * Le contenu principal du créneau
       * est la première activité trouvée.
       */
      const valeurs =
        Object.values(
          ligne.parJour
        ).filter(Boolean);

      const contenu =
        valeurs.length > 0
          ? valeurs[0]
          : 'Activité';

      return {
        id:
          `ocr_${Date.now()}_${index}`,

        libelle:
          ligne.horaire ||
          HORAIRES_REFERENCE[index],

        contenu,

        categorie:
          deviner_categorie(
            contenu
          ),

        cellules
      };
    }
  );
}

/*
|--------------------------------------------------------------------------
| COMPOSANT
|--------------------------------------------------------------------------
*/

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

  const fileRef =
    useRef(null);

  /*
  |--------------------------------------------------------------------------
  | IMPORT
  |--------------------------------------------------------------------------
  */

  async function handleFile(file) {
    if (!file) return;

    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');
    setDebugOCR('');
    setProgression(0);

    let worker = null;

    try {

      /*
       * Nom du programme.
       */
      const nomSansExtension =
        file.name
          .replace(
            /\.[^/.]+$/,
            ''
          )
          .replace(
            /[-_]/g,
            ' '
          )
          .trim();

      const nomProgramme =
        nomSansExtension
          ? nomSansExtension
              .charAt(0)
              .toUpperCase() +
            nomSansExtension.slice(1)
          : 'Programme Prépa 1 Géologie-Mines';

      /*
       * Préparation image.
       */
      const canvas =
        await preparerImage(file);

      /*
       * OCR.
       */
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
                    message.progress *
                    100
                  )
                );
              }
            }
          }
        );

      /*
       * Paramètres adaptés au tableau.
       */
      try {
        await worker.setParameters({
          /*
           * 6 = bloc uniforme de texte.
           *
           * Le tableau entier est mieux traité
           * ainsi que comme une page libre.
           */
          tessedit_pageseg_mode:
            '6',

          preserve_interword_spaces:
            '1'
        });
      } catch (e) {
        console.warn(
          'Paramètres Tesseract non appliqués :',
          e
        );
      }

      /*
       * Reconnaissance.
       */
      const resultat =
        await worker.recognize(
          canvas,
          {},
          {
            blocks: true,
            text: true
          }
        );

      const texteOCR =
        resultat?.data?.text ||
        '';

      setDebugOCR(
        texteOCR
      );

      console.log(
        '=========================='
      );

      console.log(
        'TEXTE OCR COMPLET'
      );

      console.log(
        texteOCR
      );

      console.log(
        '=========================='
      );

      /*
       * Extraction des mots + coordonnées.
       */
      const mots =
        extraire_mots(
          resultat?.data
        );

      if (!mots.length) {
        throw new Error(
          "L'OCR n'a reconnu aucun texte. Essayez une image plus nette."
        );
      }

      console.log(
        'NOMBRE DE MOTS OCR :',
        mots.length
      );

      /*
       * Reconstruction du tableau.
       */
      const tableau =
        reconstruireTableau(
          mots,
          canvas.width,
          canvas.height
        );

      if (!tableau) {
        throw new Error(
          "Le texte a été reconnu, mais aucune grille exploitable n'a été reconstruite."
        );
      }

      /*
       * Construction application.
       */
      const creneaux =
        construireCreneaux(
          tableau
        );

      if (
        !creneaux.length
      ) {
        throw new Error(
          "Aucun créneau n'a été extrait."
        );
      }

      /*
       * Affichage debug.
       */
      console.log(
        '=========================='
      );

      console.log(
        'CRÉNEAUX FINAUX'
      );

      console.log(
        creneaux
      );

      console.log(
        '=========================='
      );

      setProgramme({
        nom:
          nomProgramme,

        creneaux
      });

      setEtape(
        'edition'
      );

    } catch (error) {

      console.error(
        'ERREUR IMPORT OCR :',
        error
      );

      setErrorMsg(
        error?.message ||
        "Une erreur inconnue s'est produite."
      );

      setEtape(
        'erreur'
      );

    } finally {

      setLoading(false);

      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.warn(
            'Erreur fermeture worker :',
            e
          );
        }
      }

      if (fileRef.current) {
        fileRef.current.value =
          '';
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MODIFICATION CRÉNEAU
  |--------------------------------------------------------------------------
  */

  function modifierCreneau(
    index,
    champ,
    valeur
  ) {
    setProgramme(
      previous => {

        const nouveaux =
          [
            ...previous.creneaux
          ];

        nouveaux[index] = {
          ...nouveaux[index],
          [champ]:
            valeur
        };

        if (
          champ === 'contenu'
        ) {
          nouveaux[index]
            .categorie =
            deviner_categorie(
              valeur
            );
        }

        return {
          ...previous,
          creneaux:
            nouveaux
        };
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MODIFICATION CELLULE
  |--------------------------------------------------------------------------
  */

  function modifierCelluleJour(
    indexCreneau,
    indexJour,
    valeur
  ) {
    setProgramme(
      previous => {

        const nouveaux =
          [
            ...previous.creneaux
          ];

        const creneau = {
          ...nouveaux[
            indexCreneau
          ]
        };

        const cellules = {
          ...(creneau.cellules ||
            {})
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
          ] =
            valeur;
        }

        creneau.cellules =
          cellules;

        /*
         * Si on modifie une cellule,
         * elle peut devenir le contenu principal
         * uniquement si celui-ci est vide.
         */
        if (
          (
            !creneau.contenu ||
            creneau.contenu ===
              'Activité'
          ) &&
          valeur.trim()
        ) {
          creneau.contenu =
            valeur.trim();

          creneau.categorie =
            deviner_categorie(
              valeur
            );
        }

        nouveaux[
          indexCreneau
        ] = creneau;

        return {
          ...previous,
          creneaux:
            nouveaux
        };
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ENREGISTREMENT SUPABASE
  |--------------------------------------------------------------------------
  */

  async function validerProgramme() {
    if (!programme) {
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {

      const creneauxNettoyes =
        (
          programme.creneaux ||
          []
        ).map(
          (creneau, index) => {

            return {
              id:
                creneau.id ||
                `cr_${Date.now()}_${index}`,

              libelle:
                creneau.libelle ||
                HORAIRES_REFERENCE[
                  index
                ] ||
                '08h00-10h00',

              contenu:
                creneau.contenu &&
                creneau.contenu.trim()
                  ? creneau.contenu.trim()
                  : 'Activité',

              categorie:
                creneau.categorie ||
                'autre',

              cellules:
                creneau.cellules ||
                {}
            };
          }
        );

      const programmeCree =
        await base44.entities.Programme.create(
          {
            nom:
              programme.nom ||
              'Programme Prépa 1 Géologie-Mines',

            description:
              'Emploi du temps importé par OCR et personnalisé',

            couleur_theme:
              '#3498DB',

            jours:
              JOURS.map(
                (jour, index) => ({
                  id:
                    String(index),

                  nom:
                    jour,

                  actif:
                    true
                })
              ),

            creneaux:
              creneauxNettoyes
          }
        );

      if (
        onProgrammeCreated
      ) {
        onProgrammeCreated(
          programmeCree
        );
      }

      if (onClose) {
        onClose();
      }

    } catch (error) {

      console.error(
        'ERREUR ENREGISTREMENT :',
        error
      );

      setErrorMsg(
        error?.message ||
        JSON.stringify(
          error
        )
      );

      setEtape(
        'erreur'
      );

    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | AFFICHAGE
  |--------------------------------------------------------------------------
  */

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
          background:
            '#0D0D18'
        }}
      >

        {/* HEADER */}

        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">

          <div className="flex items-center gap-2">

            <Camera
              size={18}
              style={{
                color:
                  'var(--gold)'
              }}
            />

            <h2 className="text-base font-black text-foreground">
              Importation & Édition sur-mesure
            </h2>

          </div>

          <button
            onClick={onClose}
            type="button"
          >
            <X
              size={20}
              className="text-muted-foreground"
            />
          </button>

        </div>

        {/* =====================================================
            UPLOAD
        ===================================================== */}

        {etape === 'upload' && (

          <div className="py-4">

            <div className="flex items-start gap-3 mb-5">

              <Calendar
                size={20}
                style={{
                  color:
                    'var(--gold)'
                }}
              />

              <div>

                <p className="text-sm font-bold text-foreground">
                  Importer votre emploi du temps
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  Compatible avec votre tableau Prépa 1 Géologie–Mines : horaires + 7 jours + activités.
                </p>

              </div>

            </div>

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

              <p className="text-sm font-bold text-foreground text-center">
                Cliquez pour importer le tableau
              </p>

              <p className="text-xs text-muted-foreground mt-1 text-center">
                Image nette et droite recommandée
              </p>

            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={event =>
                handleFile(
                  event.target.files?.[0]
                )
              }
            />

          </div>
        )}

        {/* =====================================================
            ANALYSE
        ===================================================== */}

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
              Lecture de votre tableau…
            </p>

            <p className="text-sm text-muted-foreground mb-4">
              OCR : {progression}%
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

            <p className="text-xs text-muted-foreground mt-4">
              Détection des horaires, jours et activités…
            </p>

          </div>
        )}

        {/* =====================================================
            ERREUR
        ===================================================== */}

        {etape === 'erreur' && (

          <div className="flex flex-col items-center py-8 text-center">

            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background:
                  'rgba(231,76,60,0.15)'
              }}
            >

              <AlertTriangle
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

            <p className="text-sm text-muted-foreground mb-5 break-all">
              {errorMsg}
            </p>

            {debugOCR && (

              <details
                className="w-full text-left mb-5"
              >

                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Voir le texte reconnu par OCR
                </summary>

                <pre className="mt-2 p-3 rounded-lg bg-accent text-[10px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto">
                  {debugOCR}
                </pre>

              </details>

            )}

            <button
              type="button"
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

        {/* =====================================================
            EDITION
        ===================================================== */}

        {etape === 'edition' &&
          programme && (

            <div className="flex flex-col flex-1 overflow-hidden">

              <div className="flex items-center gap-2 mb-3">

                <CheckCircle2
                  size={17}
                  style={{
                    color:
                      '#2ECC71'
                  }}
                />

                <p className="text-sm font-bold text-foreground">
                  Tableau détecté — vérifiez les données avant d'enregistrer.
                </p>

              </div>

              {/* NOM */}

              <div className="mb-3">

                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1">
                  NOM DU PROGRAMME
                </label>

                <input
                  value={
                    programme.nom ||
                    ''
                  }
                  onChange={event =>
                    setProgramme(
                      previous => ({
                        ...previous,
                        nom:
                          event.target.value
                      })
                    )
                  }
                  className="w-full bg-accent border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                />

              </div>

              {/* =================================================
                  LISTE DES CRÉNEAUX
              ================================================= */}

              <div
                className="flex-1 overflow-y-auto border border-border rounded-xl p-2 space-y-3"
                style={{
                  background:
                    'var(--surface)'
                }}
              >

                {(
                  programme.creneaux ||
                  []
                ).map(
                  (
                    creneau,
                    indexCreneau
                  ) => (

                    <div
                      key={
                        creneau.id ||
                        indexCreneau
                      }
                      className="p-3 rounded-xl border border-border"
                      style={{
                        background:
                          'var(--accent)'
                      }}
                    >

                      {/* HORAIRE + CONTENU */}

                      <div className="flex items-center gap-2 mb-2">

                        <Edit3
                          size={14}
                          className="text-muted-foreground shrink-0"
                        />

                        <input
                          value={
                            creneau.libelle ||
                            ''
                          }
                          onChange={event =>
                            modifierCreneau(
                              indexCreneau,
                              'libelle',
                              event.target.value
                            )
                          }
                          placeholder="08h00-12h00"
                          className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground w-32 outline-none focus:border-gold"
                        />

                        <input
                          value={
                            creneau.contenu ||
                            ''
                          }
                          onChange={event =>
                            modifierCreneau(
                              indexCreneau,
                              'contenu',
                              event.target.value
                            )
                          }
                          placeholder="Activité principale"
                          className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-gold"
                        />

                      </div>

                      {/* JOURS */}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-border/50">

                        {JOURS.map(
                          (
                            nomJour,
                            indexJour
                          ) => (

                            <div
                              key={
                                indexJour
                              }
                              className="flex flex-col"
                            >

                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {nomJour}
                              </span>

                              <input
                                value={
                                  creneau
                                    .cellules?.[
                                    String(
                                      indexJour
                                    )
                                  ] ||
                                  ''
                                }
                                onChange={event =>
                                  modifierCelluleJour(
                                    indexCreneau,
                                    indexJour,
                                    event.target.value
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

                  )
                )}

              </div>

              {/* BOUTONS */}

              <div className="flex gap-2 mt-4 pt-2 border-t border-border">

                <button
                  type="button"
                  onClick={() =>
                    setEtape(
                      'upload'
                    )
                  }
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground"
                >
                  Recommencer
                </button>

                <button
                  type="button"
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