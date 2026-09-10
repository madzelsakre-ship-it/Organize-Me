import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { aujourdISO, parseHeureMin, STATUTS } from '@/lib/surveillance';

function dateIlYA(jours) {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function labelCourt(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()];
}

export default function ProgressionEnfant({ suiviId, delai }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!suiviId) return;
    setLoading(true);
    // Charge les 7 derniers jours de tâches
    const depuis = dateIlYA(6);
    base44.entities.TacheEnfant.filter({ suivi_id: suiviId }, '-created_date', 500).then(all => {
      setTasks(all.filter(t => t.jour >= depuis));
      setLoading(false);
    });
  }, [suiviId]);

  if (loading) {
    return (
      <div className="rounded-3xl p-5 mb-4" style={{ background: '#1C1C1E' }}>
        <div className="h-4 w-32 rounded-full bg-white/5 animate-pulse mb-4" />
        <div className="flex justify-between gap-1">
          {[...Array(7)].map((_, i) => <div key={i} className="flex-1 h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  // Grouper par jour
  const jours = [];
  for (let i = 6; i >= 0; i--) {
    const dISO = dateIlYA(i);
    const tachesJour = tasks.filter(t => t.jour === dISO);
    const validees = tachesJour.filter(t => t.statut === 'validee').length;
    const manquees = tachesJour.filter(t => t.statut === 'manquee' || t.statut === 'en_retard').length;
    const total = tachesJour.length;
    const taux = total > 0 ? Math.round((validees / total) * 100) : 0;
    jours.push({ date: dISO, label: labelCourt(dISO), validees, manquees, total, taux, isToday: dISO === aujourdISO() });
  }

  const totalValidees = tasks.filter(t => t.statut === 'validee').length;
  const totalManquees = tasks.filter(t => t.statut === 'manquee' || t.statut === 'en_retard').length;
  const totalTasks = tasks.length;
  const tauxGlobal = totalTasks > 0 ? Math.round((totalValidees / totalTasks) * 100) : 0;
  const maxTaux = Math.max(...jours.map(j => j.taux), 1);

  // Jour de pointe
  const meilleurJour = jours.reduce((best, j) => j.taux > best.taux ? j : best, jours[0] || { label: '—', taux: 0 });

  return (
    <div className="rounded-3xl p-5 mb-4" style={{ background: '#1C1C1E' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--gold)' }} />
          <p className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>PROGRESSION 7 JOURS</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black" style={{ color: tauxGlobal >= 70 ? '#30D158' : tauxGlobal >= 40 ? 'var(--gold)' : '#FF453A' }}>{tauxGlobal}<span className="text-sm">%</span></p>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>respect du programme</p>
        </div>
      </div>

      {/* Graphique barres */}
      <div className="flex items-end justify-between gap-1.5 h-24 mb-3">
        {jours.map((j, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full flex flex-col items-center justify-end h-full">
              {/* Barre manquées (rouge, en haut) */}
              {j.manquees > 0 && (
                <div className="w-full rounded-t-md" style={{ height: `${(j.manquees / Math.max(j.total, 1)) * 60}px`, background: 'rgba(239,68,68,0.5)' }} />
              )}
              {/* Barre validées (vert/or) */}
              <div className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max(3, (j.validees / Math.max(maxTaux > 0 ? maxTaux : 1, 1)) * 60)}px`,
                  background: j.isToday ? 'var(--gold)' : tauxGlobal >= 70 ? 'rgba(48,209,88,0.4)' : 'rgba(99,102,241,0.35)',
                }} />
            </div>
            <span className="text-[9px] font-bold" style={{ color: j.isToday ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }}>{j.label}</span>
          </div>
        ))}
      </div>

      {/* Stats résumé */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-2.5 text-center" style={{ background: 'rgba(48,209,88,0.08)' }}>
          <CheckCircle2 size={14} className="mx-auto mb-0.5" style={{ color: '#30D158' }} />
          <p className="text-base font-black text-white">{totalValidees}</p>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>validées</p>
        </div>
        <div className="rounded-2xl p-2.5 text-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
          <XCircle size={14} className="mx-auto mb-0.5" style={{ color: '#FF453A' }} />
          <p className="text-base font-black text-white">{totalManquees}</p>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>manquées</p>
        </div>
        <div className="rounded-2xl p-2.5 text-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <TrendingUp size={14} className="mx-auto mb-0.5" style={{ color: 'var(--gold)' }} />
          <p className="text-base font-black text-white">{meilleurDay(jours).label}</p>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>meilleur jour</p>
        </div>
      </div>

      {/* Alerte si beaucoup de manquées */}
      {totalManquees > totalValidees && totalTasks > 0 && (
        <div className="mt-3 rounded-2xl p-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={14} className="text-destructive shrink-0" />
          <p className="text-[11px] font-semibold text-destructive">Attention : plus de tâches manquées que validées cette semaine. Programme peu respecté.</p>
        </div>
      )}
    </div>
  );
}

function meilleurDay(jours) {
  return jours.reduce((best, j) => j.taux > best.taux ? j : best, jours[0] || { label: '—', taux: 0 });
}