export function startSurveillance() {
  return () => {};
}

export function aujourdISO() {
  return new Date().toISOString().slice(0, 10);
}

export function parseHeureMin(heure) {
  if (!heure || typeof heure !== 'string') return null;
  const [hours, minutes] = heure.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

export function nowMin() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function genererCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const STATUTS = {
  a_faire: { label: 'À faire', emoji: '📋', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  en_cours: { label: 'En cours', emoji: '🚀', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  validee: { label: 'Validée', emoji: '✅', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
};

export default startSurveillance;
