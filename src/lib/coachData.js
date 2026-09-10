export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const CATEGORIES = {
  sport: { label: 'Sport', color: '#22c55e', icon: '🏃' },
  sante: { label: 'Santé', color: '#ef4444', icon: '❤️' },
  etude: { label: 'Étude', color: '#3b82f6', icon: '📚' },
  spiritual: { label: 'Spiritualité', color: '#8b5cf6', icon: '✨' },
  social: { label: 'Social', color: '#ec4899', icon: '👥' },
  travail: { label: 'Travail', color: '#f59e0b', icon: '💼' },
  autre: { label: 'Autre', color: '#64748b', icon: '📌' },
};

export const PRIORITES = {
  haute: { label: 'Haute', color: '#ef4444' },
  normale: { label: 'Normale', color: '#f59e0b' },
  basse: { label: 'Basse', color: '#22c55e' },
};

export const TEMPLATES = [];

export function genererProgramme({ nom = 'Nouveau programme', description = '' } = {}) {
  return { nom, description, cellules: [] };
}

export const coachData = { messages: [] };

export default coachData;
