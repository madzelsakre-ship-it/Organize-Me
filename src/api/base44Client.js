const entityNames = [
  'Habitude',
  'Programme',
  'NoteCalendrier',
  'Rappel',
  'Tache',
  'TacheEnfant',
  'User',
];

function storageKey(name) {
  return `organize_me_${name}`;
}

function getItems(name) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(name)) || '[]');
  } catch {
    return [];
  }
}

function saveItems(name, items) {
  localStorage.setItem(storageKey(name), JSON.stringify(items));
  return items;
}

function createEntity(name) {
  return {
    async list() {
      return getItems(name);
    },
    async filter(filters = {}) {
      return getItems(name).filter((item) =>
        Object.entries(filters).every(([key, value]) => item[key] === value),
      );
    },
    async create(data) {
      const item = { ...data, id: data.id || crypto.randomUUID() };
      saveItems(name, [...getItems(name), item]);
      return item;
    },
    async update(id, data) {
      const items = getItems(name).map((item) =>
        item.id === id ? { ...item, ...data } : item,
      );
      saveItems(name, items);
      return items.find((item) => item.id === id);
    },
  };
}

export const base44 = {
  auth: {
    async me() {
      return JSON.parse(localStorage.getItem(storageKey('current_user')) || 'null');
    },
    async updateMe(data) {
      const user = { ...(await this.me()), ...data };
      localStorage.setItem(storageKey('current_user'), JSON.stringify(user));
      return user;
    },
  },
  entities: Object.fromEntries(entityNames.map((name) => [name, createEntity(name)])),
  integrations: {
    Core: {
      async InvokeLLM() {
        return {};
      },
      async UploadFile() {
        return { file_url: '' };
      },
    },
  },
};

export default base44;
