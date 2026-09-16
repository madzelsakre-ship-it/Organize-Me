import { useEffect, useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import {
  Bell,
  BellRing,
  Check,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  Settings,
  X,
  RefreshCw,
} from 'lucide-react';

import {
  DEFAULT_PREFS,
  saveNotifPrefs,
} from '@/hooks/useTaskNotifications';


/*
 * ==========================================
 * COMPOSANT PRINCIPAL
 * ==========================================
 */

export default function Rappels() {

  const [rappels, setRappels] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined'
      ? Notification.permission
      : 'default'
  );

  const [prefs, setPrefs] = useState(() => {
    try {
      const saved =
        localStorage.getItem('notif-prefs');

      if (!saved) {
        return {
          ...DEFAULT_PREFS,
        };
      }

      return {
        ...DEFAULT_PREFS,
        ...JSON.parse(saved),
      };
    } catch {
      return {
        ...DEFAULT_PREFS,
      };
    }
  });

  const [form, setForm] = useState({
    titre: '',
    description: '',
    date: '',
    heure: '',
    priorite: 'normale',
    actif: true,
  });


  /*
   * ==========================================
   * CHARGEMENT
   * ==========================================
   */

  useEffect(() => {
    chargerRappels();
  }, []);


  async function chargerRappels() {
    setLoading(true);

    try {
      const data =
        await base44.entities.Rappel.list(
          '-created_date',
          100
        );

      setRappels(data || []);

    } catch (error) {
      console.error(
        'Erreur chargement rappels :',
        error
      );

      setRappels([]);

    } finally {
      setLoading(false);
    }
  }


  /*
   * ==========================================
   * PERMISSION NOTIFICATIONS
   * ==========================================
   */

  async function demanderPermission() {

    if (
      typeof Notification ===
      'undefined'
    ) {
      alert(
        "Votre navigateur ne prend pas en charge les notifications."
      );

      return;
    }


    /*
     * Déjà autorisées
     */
    if (
      Notification.permission ===
      'granted'
    ) {

      setPermission('granted');

      await afficherNotificationTest();

      return;
    }


    /*
     * Bloquées
     */
    if (
      Notification.permission ===
      'denied'
    ) {

      setPermission('denied');

      alert(
        "Les notifications sont bloquées pour ce site. Autorisez-les dans les paramètres du navigateur."
      );

      return;
    }


    /*
     * Demande au navigateur
     */
    try {

      const result =
        await Notification.requestPermission();

      setPermission(result);


      if (result === 'granted') {
        await afficherNotificationTest();
      }

    } catch (error) {

      console.error(
        'Erreur permission notification :',
        error
      );
    }
  }


  /*
   * Notification de test
   */
  async function afficherNotificationTest() {

    try {

      if (
        'serviceWorker' in navigator
      ) {

        const registration =
          await navigator.serviceWorker.ready;

        if (
          registration?.showNotification
        ) {

          await registration.showNotification(
            '🔔 Notifications activées',
            {
              body:
                'Les rappels de votre programme sont maintenant activés.',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: 'notifications-test',
              renotify: true,
            }
          );

          return;
        }
      }


      /*
       * Fallback
       */
      new Notification(
        '🔔 Notifications activées',
        {
          body:
            'Les rappels de votre programme sont maintenant activés.',
          icon: '/favicon.ico',
        }
      );

    } catch (error) {

      console.error(
        'Impossible d'afficher la notification :',
        error
      );
    }
  }


  /*
   * ==========================================
   * PRÉFÉRENCES
   * ==========================================
   */

  function modifierPref(
    nom,
    valeur
  ) {

    const updated = {
      ...prefs,
      [nom]: valeur,
    };

    setPrefs(updated);

    saveNotifPrefs(updated);
  }


  /*
   * ==========================================
   * CRÉATION RAPPEL
   * ==========================================
   */

  async function creerRappel(e) {

    e.preventDefault();

    if (!form.titre.trim()) {
      alert(
        'Veuillez donner un titre au rappel.'
      );

      return;
    }


    try {

      await base44.entities.Rappel.create({
        titre: form.titre.trim(),
        description:
          form.description.trim(),
        date: form.date || null,
        heure: form.heure || null,
        priorite: form.priorite,
        actif: form.actif,
      });


      setForm({
        titre: '',
        description: '',
        date: '',
        heure: '',
        priorite: 'normale',
        actif: true,
      });

      setShowForm(false);

      await chargerRappels();

    } catch (error) {

      console.error(
        'Erreur création rappel :',
        error
      );

      alert(
        'Impossible de créer le rappel.'
      );
    }
  }


  /*
   * ==========================================
   * ACTIVATION / DÉSACTIVATION
   * ==========================================
   */

  async function toggleRappel(rappel) {

    try {

      await base44.entities.Rappel.update(
        rappel.id,
        {
          actif:
            rappel.actif === false,
        }
      );

      await chargerRappels();

    } catch (error) {

      console.error(
        'Erreur modification rappel :',
        error
      );
    }
  }


  /*
   * ==========================================
   * SUPPRESSION
   * ==========================================
   */

  async function supprimerRappel(
    rappel
  ) {

    const confirmer =
      window.confirm(
        `Supprimer le rappel "${rappel.titre || rappel.title || 'ce rappel'}" ?`
      );

    if (!confirmer) {
      return;
    }


    try {

      await base44.entities.Rappel.delete(
        rappel.id
      );

      await chargerRappels();

    } catch (error) {

      console.error(
        'Erreur suppression rappel :',
        error
      );
    }
  }


  /*
   * ==========================================
   * FORMATAGE
   * ==========================================
   */

  function getTitre(rappel) {
    return (
      rappel.titre ||
      rappel.title ||
      rappel.nom ||
      'Rappel'
    );
  }


  function getDescription(rappel) {
    return (
      rappel.description ||
      rappel.texte ||
      ''
    );
  }


  function getPriorite(rappel) {
    return (
      rappel.priorite ||
      'normale'
    );
  }


  function getHeure(rappel) {
    return (
      rappel.heure ||
      rappel.time ||
      ''
    );
  }


  function getDate(rappel) {
    return (
      rappel.date ||
      ''
    );
  }


  /*
   * ==========================================
   * RENDU
   * ==========================================
   */

  return (
    <div className="min-h-screen p-4 md:p-6">

      <div className="max-w-6xl mx-auto space-y-6">


        {/* ==================================
            EN-TÊTE
        ================================== */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <div className="flex items-center gap-3">

              <div className="p-3 rounded-2xl bg-primary/10">

                <BellRing
                  className="w-7 h-7 text-primary"
                />

              </div>

              <div>

                <h1 className="text-2xl md:text-3xl font-bold">
                  Rappels
                </h1>

                <p className="text-muted-foreground">
                  Gère tes rappels et tes notifications.
                </p>

              </div>

            </div>

          </div>


          <div className="flex gap-2">

            <button
              onClick={chargerRappels}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-muted transition"
            >

              <RefreshCw
                className="w-4 h-4"
              />

              Actualiser

            </button>


            <button
              onClick={() =>
                setShowForm(true)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition"
            >

              <Plus
                className="w-4 h-4"
              />

              Nouveau rappel

            </button>

          </div>

        </div>


        {/* ==================================
            BANNIÈRE NOTIFICATIONS
        ================================== */}

        <div
          className={`rounded-2xl border p-4 ${
            permission === 'granted'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-primary/5'
          }`}
        >

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex gap-3">

              {permission === 'granted' ? (
                <Check className="w-6 h-6 text-green-600 mt-0.5" />
              ) : (
                <Bell className="w-6 h-6 text-primary mt-0.5" />
              )}

              <div>

                <h2 className="font-semibold">

                  {permission === 'granted'
                    ? 'Notifications activées'
                    : 'Active les notifications'}

                </h2>

                <p className="text-sm text-muted-foreground">

                  {permission === 'granted'
                    ? 'Ton application peut maintenant t’envoyer des rappels.'
                    : 'Autorise les notifications pour recevoir les rappels de tes tâches.'}

                </p>

              </div>

            </div>


            {permission !== 'granted' && (

              <button
                onClick={
                  demanderPermission
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 font-medium hover:opacity-90 transition"
              >

                <Bell
                  className="w-4 h-4"
                />

                Activer les notifications

              </button>

            )}

          </div>

        </div>


        {/* ==================================
            PARAMÈTRES
        ================================== */}

        <div className="rounded-2xl border bg-card p-5 space-y-5">

          <div className="flex items-center gap-3">

            <div className="p-2 rounded-xl bg-primary/10">

              <Settings
                className="w-5 h-5 text-primary"
              />

            </div>

            <div>

              <h2 className="font-semibold text-lg">
                Paramètres des notifications
              </h2>

              <p className="text-sm text-muted-foreground">
                Choisis quand l’application doit te prévenir.
              </p>

            </div>

          </div>


          <div className="space-y-4">


            {/* Rappel personnalisé */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-muted/40">

              <div>

                <p className="font-medium">
                  Rappel personnalisé
                </p>

                <p className="text-sm text-muted-foreground">
                  Premier rappel avant une tâche
                </p>

              </div>


              <select
                value={
                  prefs.rappel_avant
                }
                onChange={(e) =>
                  modifierPref(
                    'rappel_avant',
                    Number(
                      e.target.value
                    )
                  )
                }
                className="rounded-lg border bg-background px-3 py-2"
              >

                <option value={5}>
                  5 minutes
                </option>

                <option value={10}>
                  10 minutes
                </option>

                <option value={15}>
                  15 minutes
                </option>

                <option value={20}>
                  20 minutes
                </option>

                <option value={30}>
                  30 minutes
                </option>

              </select>

            </div>


            {/* 30 MIN */}
            <SettingToggle
              title="Rappel 30 minutes"
              description="Préviens 30 minutes avant la tâche."
              checked={
                prefs.rappel_30min !== false
              }
              onChange={(value) =>
                modifierPref(
                  'rappel_30min',
                  value
                )
              }
            />


            {/* 15 MIN */}
            <SettingToggle
              title="Rappel 15 minutes"
              description="Préviens 15 minutes avant la tâche."
              checked={
                prefs.rappel_15min !== false
              }
              onChange={(value) =>
                modifierPref(
                  'rappel_15min',
                  value
                )
              }
            />


            {/* 5 MIN */}
            <SettingToggle
              title="Rappel 5 minutes"
              description="Alerte juste avant le début."
              checked={
                prefs.rappel_5min !== false
              }
              onChange={(value) =>
                modifierPref(
                  'rappel_5min',
                  value
                )
              }
            />


            {/* EXACT */}
            <SettingToggle
              title="Alerte à l'heure exacte"
              description="Notification au moment où la tâche commence."
              checked={
                prefs.rappel_exact !== false
              }
              onChange={(value) =>
                modifierPref(
                  'rappel_exact',
                  value
                )
              }
            />


            {/* RETARD */}
            <SettingToggle
              title="Alerte de retard"
              description="Signale les tâches qui n'ont pas été commencées."
              checked={
                prefs.retard_alerte !== false
              }
              onChange={(value) =>
                modifierPref(
                  'retard_alerte',
                  value
                )
              }
            />


            {/* BILAN MIDI */}
            <SettingToggle
              title="Bilan de midi"
              description="Reçois un bilan de ta journée à midi."
              checked={
                prefs.bilan_midi !== false
              }
              onChange={(value) =>
                modifierPref(
                  'bilan_midi',
                  value
                )
              }
            />


            {/* BILAN SOIR */}
            <SettingToggle
              title="Bilan du soir"
              description="Reçois un rappel pour faire le bilan de ta journée."
              checked={
                prefs.bilan_soir !== false
              }
              onChange={(value) =>
                modifierPref(
                  'bilan_soir',
                  value
                )
              }
            />


            {/* HEURE BILAN SOIR */}
            {prefs.bilan_soir !== false && (

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-muted/30 ml-0 sm:ml-4">

                <div>

                  <p className="font-medium">
                    Heure du bilan du soir
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Heure à laquelle recevoir le bilan.
                  </p>

                </div>


                <input
                  type="number"
                  min="0"
                  max="23"
                  value={
                    prefs.heure_bilan_soir
                  }
                  onChange={(e) => {

                    let value =
                      Number(
                        e.target.value
                      );

                    if (
                      Number.isNaN(value)
                    ) {
                      value = 18;
                    }

                    value =
                      Math.max(
                        0,
                        Math.min(
                          23,
                          value
                        )
                      );

                    modifierPref(
                      'heure_bilan_soir',
                      value
                    );
                  }}
                  className="w-24 rounded-lg border bg-background px-3 py-2"
                />

              </div>

            )}

          </div>

        </div>


        {/* ==================================
            LISTE DES RAPPELS
        ================================== */}

        <div className="space-y-4">

          <div className="flex items-center justify-between">

            <h2 className="text-xl font-semibold">
              Mes rappels
            </h2>

            <span className="text-sm text-muted-foreground">
              {rappels.length}{' '}
              rappel
              {rappels.length !== 1
                ? 's'
                : ''}
            </span>

          </div>


          {loading ? (

            <div className="rounded-2xl border p-8 text-center">

              <RefreshCw
                className="w-6 h-6 animate-spin mx-auto mb-3"
              />

              <p className="text-muted-foreground">
                Chargement...
              </p>

            </div>

          ) : rappels.length === 0 ? (

            <div className="rounded-2xl border p-8 text-center">

              <Bell
                className="w-10 h-10 mx-auto mb-3 opacity-40"
              />

              <h3 className="font-semibold">
                Aucun rappel
              </h3>

              <p className="text-sm text-muted-foreground mt-1">
                Crée ton premier rappel pour commencer.
              </p>


              <button
                onClick={() =>
                  setShowForm(true)
                }
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2"
              >

                <Plus
                  className="w-4 h-4"
                />

                Créer un rappel

              </button>

            </div>

          ) : (

            <div className="grid gap-3">

              {rappels.map((rappel) => {

                const priorite =
                  getPriorite(rappel);

                const actif =
                  rappel.actif !== false;

                return (

                  <div
                    key={rappel.id}
                    className={`rounded-2xl border p-4 transition ${
                      actif
                        ? 'bg-card'
                        : 'bg-muted/30 opacity-60'
                    }`}
                  >

                    <div className="flex gap-4">

                      <div
                        className={`p-3 rounded-xl h-fit ${
                          priorite ===
                          'importante'
                            ? 'bg-red-500/10 text-red-600'
                            : priorite ===
                                'haute'
                              ? 'bg-orange-500/10 text-orange-600'
                              : 'bg-primary/10 text-primary'
                        }`}
                      >

                        {priorite ===
                        'importante' ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <Bell className="w-5 h-5" />
                        )}

                      </div>


                      <div className="flex-1 min-w-0">

                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                          <div>

                            <h3 className="font-semibold">
                              {getTitre(
                                rappel
                              )}
                            </h3>

                            {getDescription(
                              rappel
                            ) && (

                              <p className="text-sm text-muted-foreground mt-1">
                                {getDescription(
                                  rappel
                                )}
                              </p>

                            )}

                          </div>


                          <div className="flex items-center gap-2">

                            <button
                              onClick={() =>
                                toggleRappel(
                                  rappel
                                )
                              }
                              className={`rounded-lg px-3 py-1.5 text-sm border ${
                                actif
                                  ? 'bg-green-500/10 text-green-700'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >

                              {actif
                                ? 'Actif'
                                : 'Désactivé'}

                            </button>


                            <button
                              onClick={() =>
                                supprimerRappel(
                                  rappel
                                )
                              }
                              className="p-2 rounded-lg hover:bg-red-500/10 text-red-600"
                              title="Supprimer"
                            >

                              <Trash2
                                className="w-4 h-4"
                              />

                            </button>

                          </div>

                        </div>


                        <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">

                          {getDate(
                            rappel
                          ) && (

                            <span className="inline-flex items-center gap-1.5">

                              📅

                              {getDate(
                                rappel
                              )}

                            </span>

                          )}


                          {getHeure(
                            rappel
                          ) && (

                            <span className="inline-flex items-center gap-1.5">

                              <Clock
                                className="w-4 h-4"
                              />

                              {getHeure(
                                rappel
                              )}

                            </span>

                          )}


                          <span className="capitalize">

                            Priorité :{' '}
                            {priorite}

                          </span>

                        </div>

                      </div>

                    </div>

                  </div>

                );
              })}

            </div>

          )}

        </div>

      </div>


      {/* ==================================
          MODALE CRÉATION
      ================================== */}

      {showForm && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">

          <div className="w-full max-w-lg rounded-2xl bg-background border shadow-xl">

            <div className="flex items-center justify-between p-5 border-b">

              <div>

                <h2 className="text-xl font-bold">
                  Nouveau rappel
                </h2>

                <p className="text-sm text-muted-foreground">
                  Ajoute un rappel à ton programme.
                </p>

              </div>


              <button
                onClick={() =>
                  setShowForm(false)
                }
                className="p-2 rounded-lg hover:bg-muted"
              >

                <X
                  className="w-5 h-5"
                />

              </button>

            </div>


            <form
              onSubmit={creerRappel}
              className="p-5 space-y-4"
            >

              {/* TITRE */}
              <div>

                <label className="text-sm font-medium">
                  Titre
                </label>

                <input
                  type="text"
                  value={form.titre}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      titre:
                        e.target.value,
                    })
                  }
                  placeholder="Ex : Réviser l'algèbre"
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />

              </div>


              {/* DESCRIPTION */}
              <div>

                <label className="text-sm font-medium">
                  Description
                </label>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description:
                        e.target.value,
                    })
                  }
                  placeholder="Facultatif"
                  rows={3}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />

              </div>


              {/* DATE + HEURE */}
              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="text-sm font-medium">
                    Date
                  </label>

                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        date:
                          e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5"
                  />

                </div>


                <div>

                  <label className="text-sm font-medium">
                    Heure
                  </label>

                  <input
                    type="time"
                    value={form.heure}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        heure:
                          e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5"
                  />

                </div>

              </div>


              {/* PRIORITÉ */}
              <div>

                <label className="text-sm font-medium">
                  Priorité
                </label>

                <select
                  value={
                    form.priorite
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priorite:
                        e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5"
                >

                  <option value="normale">
                    Normale
                  </option>

                  <option value="haute">
                    Haute
                  </option>

                  <option value="importante">
                    Importante
                  </option>

                </select>

              </div>


              {/* ACTIF */}
              <label className="flex items-center gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={
                    form.actif
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      actif:
                        e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />

                <span className="text-sm">
                  Activer immédiatement ce rappel
                </span>

              </label>


              {/* BOUTONS */}
              <div className="flex justify-end gap-3 pt-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="rounded-xl border px-4 py-2"
                >
                  Annuler
                </button>


                <button
                  type="submit"
                  className="rounded-xl bg-primary text-primary-foreground px-4 py-2"
                >
                  Créer le rappel
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}


/*
 * ==========================================
 * COMPOSANT TOGGLE
 * ==========================================
 */

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}) {

  return (

    <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40 cursor-pointer hover:bg-muted/60 transition">

      <div>

        <p className="font-medium">
          {title}
        </p>

        <p className="text-sm text-muted-foreground">
          {description}
        </p>

      </div>


      <button
        type="button"
        onClick={() =>
          onChange(!checked)
        }
        className={`relative shrink-0 w-12 h-7 rounded-full transition ${
          checked
            ? 'bg-primary'
            : 'bg-muted-foreground/30'
        }`}
        aria-pressed={checked}
      >

        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked
              ? 'translate-x-6'
              : 'translate-x-1'
          }`}
        />

      </button>

    </label>

  );
}