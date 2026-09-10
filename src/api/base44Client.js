import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes. Configurez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

function createEntity(entityName) {
  const tableName = entityTableNames[entityName];
  const normalizeOrder = (order) => {
    const descending = order.startsWith('-');
    const requestedColumn = descending ? order.slice(1) : order;
    const column = requestedColumn === 'created_date' ? 'created_at' : requestedColumn;
    return { column, descending };
  };

  return {
    async list(order = 'created_at', limit) {
      let query = supabase.from(tableName).select('*');
      const { column, descending } = normalizeOrder(order);
      query = query.order(column, { ascending: !descending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async filter(filters = {}, order = 'created_at', limit) {
      let query = supabase.from(tableName).select('*');
      Object.entries(filters).forEach(([key, value]) => {
        const column = key === 'created_date' ? 'created_at' : key;
        query = query.eq(column, value);
      });
      const { column, descending } = normalizeOrder(order);
      query = query.order(column, { ascending: !descending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async create(payload) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        throw new Error('Vous devez être connecté pour créer des données.');
      }

      const { data, error } = await supabase
        .from(tableName)
        .insert({ ...payload, user_id: payload.user_id || userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
    },
    subscribe(callback) {
      const channel = supabase
        .channel(`organize-me-${tableName}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => callback(payload),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

export const base44 = {
  auth: {
    async me() {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    async updateMe(attributes) {
      const { data, error } = await supabase.auth.updateUser({ data: attributes });
      if (error) throw error;
      return data.user;
    },
  },
  entities: Object.fromEntries(
    Object.keys(entityTableNames).map((name) => [name, createEntity(name)]),
  ),
  integrations: {
    Core: {
      async InvokeLLM() {
        throw new Error('InvokeLLM doit être connecté à votre fournisseur IA.');
      },
      async UploadFile() {
        throw new Error('UploadFile doit être configuré avec un bucket Supabase Storage.');
      },
    },
  },
};

export default base44;
