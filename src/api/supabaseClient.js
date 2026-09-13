import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes. Configurez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// ======================================================
// TABLES SUPABASE
// ======================================================

const entityTableNames = {
  Habitude: 'habitude',
  Programme: 'programme',
  NoteCalendrier: 'note_calendrier',
  Rappel: 'rappel',
  Tache: 'tache',
  TacheEnfant: 'tache_enfant',
  Objectif: 'objectif',
  ScoreDiscipline: 'score_discipline',
  StatJour: 'stat_jour',
  SuiviEnfant: 'suivi_enfant',
  User: 'user',
};

// ======================================================
// OUTIL POUR LES ENTITÉS
// ======================================================

function createEntity(entityName) {
  const tableName = entityTableNames[entityName];

  const normalizeOrder = (order = 'created_at') => {
    const descending = order.startsWith('-');

    const requestedColumn = descending
      ? order.slice(1)
      : order;

    const column =
      requestedColumn === 'created_date'
        ? 'created_at'
        : requestedColumn;

    return {
      column,
      descending,
    };
  };

  return {

    // ==================================================
    // LIST
    // ==================================================

    async list(order = 'created_at', limit) {
      let query = supabase
        .from(tableName)
        .select('*');

      const { column, descending } =
        normalizeOrder(order);

      query = query.order(column, {
        ascending: !descending,
      });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          `Erreur ${tableName}.list():`,
          error
        );
        throw error;
      }

      return data || [];
    },

    // ==================================================
    // FILTER
    // ==================================================

    async filter(
      filters = {},
      order = 'created_at',
      limit
    ) {
      let query = supabase
        .from(tableName)
        .select('*');

      Object.entries(filters).forEach(
        ([key, value]) => {
          const column =
            key === 'created_date'
              ? 'created_at'
              : key;

          query = query.eq(column, value);
        }
      );

      const { column, descending } =
        normalizeOrder(order);

      query = query.order(column, {
        ascending: !descending,
      });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          `Erreur ${tableName}.filter():`,
          error
        );
        throw error;
      }

      return data || [];
    },

    // ==================================================
    // CREATE
    // ==================================================

    async create(payload = {}) {

      // On récupère l'utilisateur réellement connecté
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          'Erreur récupération utilisateur:',
          userError
        );

        throw userError;
      }

      const user = userData?.user;

      if (!user) {
        throw new Error(
          'Aucun utilisateur connecté. Connectez-vous avant de créer des données.'
        );
      }

      console.log(
        `Création dans ${tableName} pour l'utilisateur :`,
        user.id
      );

      // On force user_id à être celui de l'utilisateur connecté.
      // Cela évite qu'un autre user_id soit envoyé accidentellement.
      const dataToInsert = {
        ...payload,
        user_id: user.id,
      };

      const {
        data,
        error,
      } = await supabase
        .from(tableName)
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        console.error(
          `Erreur INSERT ${tableName}:`,
          error
        );

        throw error;
      }

      return data;
    },

    // ==================================================
    // UPDATE
    // ==================================================

    async update(id, payload) {

      const {
        data,
        error,
      } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(
          `Erreur UPDATE ${tableName}:`,
          error
        );

        throw error;
      }

      return data;
    },

    // ==================================================
    // DELETE
    // ==================================================

    async delete(id) {

      const { error } =
        await supabase
          .from(tableName)
          .delete()
          .eq('id', id);

      if (error) {
        console.error(
          `Erreur DELETE ${tableName}:`,
          error
        );

        throw error;
      }
    },

    // ==================================================
    // REALTIME
    // ==================================================

    subscribe(callback) {

      const channel =
        supabase
          .channel(`organize-me-${tableName}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: tableName,
            },
            (payload) => {
              callback(payload);
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

// ======================================================
// COMPATIBILITÉ AVEC L'ANCIEN CODE DE L'APPLICATION
// ======================================================

export const base44 = {

  // ====================================================
  // AUTH
  // ====================================================

  auth: {

    async me() {

      const {
        data,
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      return data.user;
    },

    async updateMe(attributes) {

      const {
        data,
        error,
      } = await supabase.auth.updateUser({
        data: attributes,
      });

      if (error) {
        throw error;
      }

      return data.user;
    },
  },

  // ====================================================
  // ENTITÉS
  // ====================================================

  entities: Object.fromEntries(
    Object.keys(entityTableNames).map(
      (name) => [
        name,
        createEntity(name),
      ]
    )
  ),

  // ====================================================
  // INTÉGRATIONS
  // ====================================================

  integrations: {
    Core: {

      async InvokeLLM() {
        throw new Error(
          'InvokeLLM n’est plus utilisé. Le scanner OCR utilise Tesseract.js.'
        );
      },

      async UploadFile() {
        throw new Error(
          'UploadFile n’est plus utilisé par le scanner OCR.'
        );
      },
    },
  },
};

export default base44;