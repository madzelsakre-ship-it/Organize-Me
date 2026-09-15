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
  RotateCcw
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
    'physique',
    'chimie',
    'géologie',
    'geologie',
    'mine',
    'mines',
    'technique',
    'recherche',
    'exercice',
    'td',
    'tp',
    'prépa',
    'prepa'
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
   OCR : EXTRACTION DES MOTS
   ========================================================= */

function extraire_mots(dataTesseract) {
  const mots = [];

  const blocks = dataTesseract?.blocks || [];

  blocks.forEach(block => {
    (block.paragraphs || []).forEach(paragraphe => {
      (paragraphe.lines || []).forEach(ligne => {
        (ligne.words || []).forEach(word => {
          if (
            word?.bbox &&
            word.text &&
            word.text.trim()
          ) {
            mots.push({
              text: word.text.trim(),

              x0: word.bbox.x0,
              x1: word.bbox.x1,

              y0: word.bbox.y0,
              y1: word.bbox.y1
            });
          }
        });
      });
    });
  });

  return mots;
}

/* =========================================================
   REGROUPEMENT DES MOTS PAR LIGNE
   ========================================================= */

function grouper_en_lignes(mots) {
  const tries = [...mots].sort(
    (a, b) =>
      (a.y0 + a.y1) / 2 -
      (b.y0 + b.y1) / 2
  );

  if (!tries.length) {
    return [];
  }

  const hauteurMoyenne =
    tries.reduce(
      (s, m) => s + (m.y1 - m.y0),
      0
    ) / tries.length;

  const seuil = Math.max(
    hauteurMoyenne * 0.75,
    10
  );

  const lignes = [];

  tries.forEach(mot => {
    const centreY =
      (mot.y0 + mot.y1) / 2;

    let ligne = lignes.find(
      l => Math.abs(l.centreY - centreY) < seuil
    );

    if (!ligne) {
      ligne = {
        centreY,
        mots: []
      };

      lignes.push(ligne);
    }

    ligne.mots.push(mot);

    ligne.centreY =
      ligne.mots.reduce(
        (s, m) =>
          s + (m.y0 + m.y1) / 2,
        0
      ) / ligne.mots.length;
  });

  lignes.forEach(ligne => {
    ligne.mots.sort(
      (a, b) => a.x0 - b.x0
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

function trouverJour(text) {
  const t = normaliser(text);

  const correspondances = {
    lun: 'lundi',
    lundi: 'lundi',

    mar: 'mardi',
    mardi: 'mardi',

    mer: 'mercredi',
    mercredi: 'mercredi',

    jeu: 'jeudi',
    jeudi: 'jeudi',

    ven: 'vendredi',
    vendredi: 'vendredi',

    sam: 'samedi',
    samedi: 'samedi',

    dim: 'dimanche',
    dimanche: 'dimanche'
  };

  return correspondances[t] || null;
}

/* =========================================================
   DÉTECTION DES COLONNES DU TABLEAU
   ========================================================= */

function detecterColonnes(lignes) {
  let meilleureLigne = null;
  let meilleursJours = [];

  lignes.forEach(ligne => {
    const jours = [];

    ligne.mots.forEach(mot => {
      const jour = trouverJour(mot.text);

      if (jour) {
        jours.push({
          jour,
          centre:
            (mot.x0 + mot.x1) / 2
        });
      }
    });

    if (jours.length > meilleursJours.length) {
      meilleursJours = jours;
      meilleureLigne = ligne;
    }
  });

  if (
    !meilleureLigne ||
    meilleursJours.length < 3
  ) {
    return null;
  }

  meilleursJours.sort(
    (a, b) => a.centre - b.centre
  );

  /*
   * On élimine les doublons éventuels.
   */
  const joursUniques = [];

  meilleursJours.forEach(j => {
    if (
      !joursUniques.some(
        x => x.jour === j.jour
      )
    ) {
      joursUniques.push(j);
    }
  });

  return {
    headerY: meilleureLigne.centreY,
    jours: joursUniques
  };
}

/* =========================================================
   DÉTECTION DES HORAIRES
   ========================================================= */

function extraireHoraire(texte) {
  const t = normaliser(texte)
    .replace(/o/g, '0')
    .replace(/i/g, '1')
    .replace(/l/g, '1');

  /*
   * Exemples reconnus :
   *
   * 06h45-07h25
   * 06h45–07h25
   * 08h00-12h00
   * 08:00-12:00
   * 08h00 12h00
   */

  const regex =
    /(\d{1,2})\s*[h:]\s*(\d{0,2})\s*[-–—àa]\s*(\d{1,2})\s*[h:]\s*(\d{0,2})/i;

  const match = t.match(regex);

  if (!match) {
    return null;
  }

  const h1 = match[1];
  const m1 = match[2] || '00';
  const h2 = match[3];
  const m2 = match[4] || '00';

  return (
    `${h1.padStart(2, '0')}h` +
    `${m1.padStart(2, '0')}-` +
    `${h2.padStart(2, '0')}h` +
    `${m2.padStart(2, '0')}`
  );
}

/* =========================================================
   EXTRACTION DU TABLEAU PRÉPA 1 GM
   ========================================================= */

function extraire_tableau(mots) {
  const lignes = grouper_en_lignes(mots);

  const colonnes = detecterColonnes(lignes);

  if (!colonnes) {
    return null;
  }

  /*
   * On utilise les centres des jours détectés.
   * Le tableau possède normalement :
   *
   * Horaire | Lundi | Mardi | Mercredi | Jeudi |
   * Vendredi | Samedi | Dimanche
   */

  const centres = colonnes.jours;

  /*
   * Estimation des limites de chaque colonne.
   */

  const bornes = centres.map((col, index) => {
    const gauche =
      index === 0
        ? -Infinity
        : (centres[index - 1].centre +
            col.centre) /
          2;

    const droite =
      index === centres.length - 1
        ? Infinity
        : (col.centre +
            centres[index + 1].centre) /
          2;

    return {
      jour: col.jour,
      gauche,
      droite
    };
  });

  const resultats = [];

  /*
   * On analyse toutes les lignes situées
   * sous l'en-tête.
   */

  for (
    let i = 0;
    i < lignes.length;
    i++
  ) {
    const ligne = lignes[i];

    if (
      ligne.centreY <=
      colonnes.headerY
    ) {
      continue;
    }

    if (!ligne.mots.length) {
      continue;
    }

    const texteLigne =
      ligne.mots
        .map(m => m.text)
        .join(' ');

    const horaire =
      extraireHoraire(texteLigne);

    /*
     * Une ligne du tableau doit avoir
     * un horaire.
     */

    if (!horaire) {
      continue;
    }

    /*
     * On récupère les textes situés
     * dans chaque colonne.
     */

    const parJour = {};

    bornes.forEach(borne => {
      const motsColonne =
        ligne.mots.filter(mot => {
          const centre =
            (mot.x0 + mot.x1) / 2;

          return (
            centre >= borne.gauche &&
            centre < borne.droite
          );
        });

      const texte =
        motsColonne
          .map(m => m.text)
          .join(' ')
          .trim();

      if (texte) {
        parJour[borne.jour] = texte;
      }
    });

    /*
     * On ajoute même les lignes où
     * seulement une partie des jours
     * a été reconnue.
     */

    if (
      Object.keys(parJour).length > 0
    ) {
      resultats.push({
        horaire,
        parJour
      });
    }
  }

  return resultats.length
    ? resultats
    : null;
}

/* =========================================================
   CRÉATION DES CRÉNEAUX
   ========================================================= */

function construire_creneaux_depuis_tableau(
  tableau
) {
  return tableau.map(
    ({ horaire, parJour }) => {
      const cellules = {};

      NOMS_JOURS.forEach(
        (jourNom, index) => {
          cellules[String(index)] =
            parJour[jourNom] || '';
        }
      );

      /*
       * On prend le premier contenu disponible
       * comme contenu principal pour compatibilité
       * avec la structure existante de l'application.
       */

      const contenuPrincipal =
        NOMS_JOURS
          .map(jour => parJour[jour])
          .find(
            texte =>
              texte &&
              texte.trim()
          ) || 'Activité';

      return {
        libelle:
          horaire || '08h00-10h00',

        contenu: contenuPrincipal,

        categorie:
          deviner_categorie(
            contenuPrincipal
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

  const fileRef = useRef(null);

  /* =======================================================
     IMPORT IMAGE
     ======================================================= */

  async function handleFile(file) {
    if (!file) return;

    setLoading(true);
    setEtape('analyse');
    setErrorMsg('');
    setProgression(0);

    let worker;

    try {
      const fileNameClean =
        file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ');

      const formattedName =
        fileNameClean
          ? fileNameClean.charAt(0).toUpperCase() +
            fileNameClean.slice(1)
          : 'Programme Prépa 1 GM';

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

      const dataUrl =
        await fileToDataURL(file);

      const ret =
        await worker.recognize(
          dataUrl,
          {},
          {
            blocks: true,
            text: true
          }
        );

      const mots =
        extraire_mots(ret.data);

      const tableau =
        extraire_tableau(mots);

      /*
       * IMPORTANT :
       * On ne crée plus une fausse ligne
       * si l'OCR échoue complètement.
       */

      if (!tableau) {
        throw new Error(
          "Le tableau n'a pas pu être reconstruit. Le texte a peut-être été reconnu, mais les colonnes Horaire/Lundi/Mardi/etc. n'ont pas été suffisamment détectées."
        );
      }

      const creneaux =
        construire_creneaux_depuis_tableau(
          tableau
        );

      setProgramme({
        nom:
          formattedName ||
          'Programme Prépa 1 Géologie-Mines',

        creneaux
      });

      setEtape('edition');
    } catch (err) {
      console.error(
        'Erreur OCR :',
        err
      );

      setErrorMsg(
        `Erreur : ${
          err?.message ||
          String(err)
        }`
      );

      setEtape('erreur');
    } finally {
      setLoading(false);

      if (worker) {
        await worker.terminate();
      }

      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  /* =======================================================
     MODIFICATION DIRECTE D'UNE CELLULE
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

      const ancienCreneau =
        nouveauxCreneaux[indexCreneau];

      const nouveauCreneau = {
        ...ancienCreneau,

        cellules: {
          ...(ancienCreneau.cellules || {}),
          [String(indexJour)]:
            valeur
        }
      };

      /*
       * Pour garder la compatibilité avec
       * le reste de l'application, on met
       * aussi "contenu" à jour avec la
       * cellule actuellement modifiée.
       */

      if (
        valeur &&
        valeur.trim() !== ''
      ) {
        nouveauCreneau.contenu =
          valeur;

        nouveauCreneau.categorie =
          deviner_categorie(
            valeur
          );
      }

      nouveauxCreneaux[
        indexCreneau
      ] = nouveauCreneau;

      return {
        ...prev,
        creneaux:
          nouveauxCreneaux
      };
    });
  }

  /* =======================================================
     MODIFICATION HORAIRE
     ======================================================= */

  function modifierHoraire(
    index,
    valeur
  ) {
    setProgramme(prev => {
      if (!prev) return prev;

      const nouveauxCreneaux =
        [...prev.creneaux];

      nouveauxCreneaux[index] = {
        ...nouveauxCreneaux[index],
        libelle: valeur
      };

      return {
        ...prev,
        creneaux:
          nouveauxCreneaux
      };
    });
  }

  /* =======================================================
     AJOUT D'UNE LIGNE
     ======================================================= */

  function ajouterCreneau() {
    setProgramme(prev => {
      if (!prev) return prev;

      const cellules = {};

      NOMS_JOURS.forEach(
        (_, index) => {
          cellules[String(index)] =
            '';
        }
      );

      return {
        ...prev,

        creneaux: [
          ...prev.creneaux,

          {
            libelle:
              '08h00-10h00',

            contenu:
              'Activité',

            categorie:
              'autre',

            cellules
          }
        ]
      };
    });
  }

  /* =======================================================
     SUPPRESSION D'UNE LIGNE
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
     ENREGISTREMENT SUPABASE
     ======================================================= */

  async function validerProgramme() {
    if (!programme) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const creneauxNettoyes =
        (programme.creneaux || []).map(
          (cr, i) => {
            const cellules = {};

            NOMS_JOURS.forEach(
              (_, index) => {
                cellules[String(index)] =
                  cr.cellules?.[
                    String(index)
                  ] || '';
              }
            );

            return {
              id:
                `cr_${Date.now()}_${i}`,

              libelle:
                cr.libelle ||
                '08h00-10h00',

              /*
               * On conserve la première
               * cellule non vide comme
               * contenu principal.
               */

              contenu:
                NOMS_JOURS
                  .map(
                    (_, index) =>
                      cellules[
                        String(index)
                      ]
                  )
                  .find(
                    texte =>
                      texte &&
                      texte.trim()
                  ) ||
                'Activité',

              categorie:
                deviner_categorie(
                  NOMS_JOURS
                    .map(
                      (_, index) =>
                        cellules[
                          String(index)
                        ]
                    )
                    .find(
                      texte =>
                        texte &&
                        texte.trim()
                    ) ||
                    ''
                ),

              cellules
            };
          }
        );

      const prog =
        await base44.entities.Programme.create(
          {
            nom:
              programme.nom ||
              'Programme Prépa 1 Géologie-Mines',

            description:
              'Emploi du temps Prépa 1 Géologie-Mines importé et personnalisé cellule par cellule',

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
        'Erreur détaillée :',
        err
      );

      setErrorMsg(
        `Erreur : ${
          err?.message ||
          JSON.stringify(err)
        }`
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
        className="w-full max-w-7xl max-h-[94vh] flex flex-col rounded-2xl border border-border p-4 sm:p-6 animate-fade-in overflow-hidden"
        style={{
          background: '#0D0D18'
        }}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">

          <div className="flex items-center gap-2">

            <Camera
              size={20}
              style={{
                color:
                  'var(--gold)'
              }}
            />

            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                Importation & Édition
              </h2>

              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Prépa 1 Géologie–Mines
              </p>
            </div>

          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent"
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
          <div className="py-6">

            <p className="text-sm text-muted-foreground mb-5">
              Importez votre tableau hebdomadaire.
              L'application va essayer de reconnaître
              les horaires et les sept jours.
            </p>

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

              <p className="text-sm font-bold text-foreground">
                Cliquez pour importer
                votre emploi du temps
              </p>

              <p className="text-xs text-muted-foreground mt-2">
                JPG, PNG ou photo claire
                du tableau
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
          <div className="flex flex-col items-center py-16 text-center">

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

            <p className="text-base font-black text-foreground mb-2">
              Lecture du tableau…
            </p>

            <p className="text-sm text-muted-foreground">
              Reconnaissance des horaires
              et des colonnes
            </p>

            <div className="w-full max-w-md mt-6">

              <div className="h-2 rounded-full bg-accent overflow-hidden">

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

              <p className="text-xs text-muted-foreground mt-2">
                {progression} %
              </p>

            </div>

          </div>
        )}

        {/* =================================================
            ERREUR
        ================================================= */}

        {etape === 'erreur' && (
          <div className="flex flex-col items-center py-12 text-center">

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
                  color: '#E74C3C'
                }}
              />
            </div>

            <p className="text-lg font-black text-foreground mb-2">
              Le tableau n'a pas pu être importé
            </p>

            <p className="text-sm text-muted-foreground mb-6 max-w-xl">
              {errorMsg}
            </p>

            <button
              onClick={() =>
                setEtape('upload')
              }
              className="w-full max-w-md py-3 rounded-xl font-black text-sm"
              style={{
                background:
                  'var(--gold)',
                color: '#080810'
              }}
            >
              Réessayer
            </button>

          </div>
        )}

        {/* =================================================
            ÉDITION DU TABLEAU
        ================================================= */}

        {etape === 'edition' &&
          programme && (
            <div className="flex flex-col flex-1 overflow-hidden">

              {/* MESSAGE */}

              <div className="flex items-center gap-2 mb-3">

                <CheckCircle2
                  size={17}
                  style={{
                    color:
                      '#2ECC71'
                  }}
                />

                <p className="text-sm font-bold text-foreground">
                  Modifiez directement chaque cellule du tableau.
                </p>

              </div>

              {/* NOM */}

              <div className="mb-4">

                <label className="text-[11px] font-bold tracking-widest text-muted-foreground block mb-1">
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
                        nom: e.target.value
                      })
                    )
                  }
                  className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                />

              </div>

              {/* =================================================
                  TABLEAU
              ================================================= */}

              <div className="flex-1 overflow-auto border border-border rounded-xl">

                <table
                  className="w-full border-collapse"
                  style={{
                    minWidth:
                      '1050px'
                  }}
                >

                  {/* HEADER */}

                  <thead>

                    <tr>

                      <th
                        className="sticky top-0 left-0 z-30 border border-border p-2 text-xs font-black"
                        style={{
                          background:
                            '#164C73',
                          color:
                            'white',
                          width:
                            '115px'
                        }}
                      >
                        Horaire
                      </th>

                      {NOMS_JOURS.map(
                        (jour, index) => (
                          <th
                            key={jour}
                            className="sticky top-0 z-20 border border-border p-2 text-xs font-black"
                            style={{
                              background:
                                '#164C73',
                              color:
                                'white',
                              minWidth:
                                '135px'
                            }}
                          >
                            {jour
                              .charAt(0)
                              .toUpperCase() +
                              jour.slice(1)}
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
                          key={idx}
                        >

                          {/* HORAIRE */}

                          <td
                            className="sticky left-0 z-10 border border-border p-1"
                            style={{
                              background:
                                '#171725'
                            }}
                          >

                            <input
                              value={
                                cr.libelle ||
                                ''
                              }
                              onChange={e =>
                                modifierHoraire(
                                  idx,
                                  e.target
                                    .value
                                )
                              }
                              className="w-full h-full min-h-[58px] bg-transparent px-2 py-2 text-[11px] sm:text-xs font-mono font-bold text-foreground outline-none focus:ring-2 focus:ring-[var(--gold)] rounded"
                              placeholder="08h00-12h00"
                            />

                          </td>

                          {/* 7 CELLULES */}

                          {NOMS_JOURS.map(
                            (_, jourIndex) => {

                              const valeur =
                                cr
                                  .cellules?.[
                                  String(
                                    jourIndex
                                  )
                                ] || '';

                              return (
                                <td
                                  key={
                                    jourIndex
                                  }
                                  className="border border-border p-1 align-top"
                                  style={{
                                    background:
                                      idx %
                                        2 ===
                                      0
                                        ? '#11111D'
                                        : '#151521'
                                  }}
                                >

                                  <textarea
                                    value={
                                      valeur
                                    }
                                    onChange={e =>
                                      modifierCelluleJour(
                                        idx,
                                        jourIndex,
                                        e.target
                                          .value
                                      )
                                    }
                                    placeholder="Activité…"
                                    rows={3}
                                    className="w-full min-h-[70px] resize-y bg-transparent px-2 py-2 text-[11px] sm:text-xs text-foreground outline-none rounded focus:ring-2 focus:ring-[var(--gold)] placeholder:text-muted-foreground"
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

                {/* AUCUNE LIGNE */}

                {programme.creneaux
                  ?.length === 0 && (
                  <div className="p-8 text-center">

                    <p className="text-sm text-muted-foreground">
                      Aucun créneau détecté.
                    </p>

                  </div>
                )}

              </div>

              {/* =================================================
                  ACTIONS DU TABLEAU
              ================================================= */}

              <div className="flex flex-wrap gap-2 mt-3">

                <button
                  onClick={
                    ajouterCreneau
                  }
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-accent"
                >
                  ＋ Ajouter une ligne
                </button>

                {programme.creneaux
                  ?.length > 0 && (
                  <button
                    onClick={() =>
                      supprimerCreneau(
                        programme
                          .creneaux
                          .length - 1
                      )
                    }
                    className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-accent"
                  >
                    − Supprimer la dernière ligne
                  </button>
                )}

              </div>

              {/* =================================================
                  BOUTONS FINAUX
              ================================================= */}

              <div className="flex gap-2 mt-4 pt-3 border-t border-border">

                <button
                  onClick={() =>
                    setEtape('upload')
                  }
                  className="flex-1 py-3 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:bg-accent flex items-center justify-center gap-2"
                >
                  <RotateCcw
                    size={15}
                  />

                  Recommencer
                </button>

                <button
                  onClick={
                    validerProgramme
                  }
                  disabled={loading}
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