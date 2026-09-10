import { Shield, Flame, CheckCircle2, TrendingUp } from 'lucide-react';

function MiniBars({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full rounded-sm transition-all duration-500"
            style={{
              height: `${Math.max(4, (d.value / max) * 40)}px`,
              background: d.isToday ? '#F97316' : 'rgba(249,115,22,0.3)',
            }}
          />
          <span className="text-[8px] font-bold" style={{ color: d.isToday ? '#F97316' : 'rgba(255,255,255,0.2)' }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function WeeklyStats({ scoreDiscipline, stats, habitudes, onNavigate }) {
  const score = scoreDiscipline?.score ?? null;
  const sessionsReussies = scoreDiscipline?.sessions_reussies ?? 0;
  const sessionsAbandonnees = scoreDiscipline?.sessions_abandonnees ?? 0;
  const totalSessions = sessionsReussies + sessionsAbandonnees;
  const tauxSession = totalSessions > 0 ? Math.round((sessionsReussies / totalSessions) * 100) : null;
  const scoreColor = score === null ? 'rgba(255,255,255,0.2)' : score >= 70 ? '#30D158' : score >= 40 ? '#F97316' : '#FF453A';

  // Habitudes complétées cette semaine (derniers 7 jours)
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startISO = sevenDaysAgo.toISOString().slice(0, 10);
  const endISO = today.toISOString().slice(0, 10);

  let habitudesSemaine = 0;
  habitudes.forEach(hab => {
    (hab.completions || []).forEach(dateISO => {
      if (dateISO >= startISO && dateISO <= endISO) habitudesSemaine++;
    });
  });

  // Mini bars : 7 derniers jours de complétion
  const barsData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const dateISO = d.toISOString().slice(0, 10);
    const stat = stats.find(s => s.date === dateISO);
    const faites = stat ? stat.faites : 0;
    const total = stat ? stat.total : 0;
    const value = total > 0 ? faites : 0;
    return {
      label: JOURS_COURTS[d.getDay() === 0 ? 6 : d.getDay() - 1],
      value,
      isToday: i === 6,
    };
  });

  const card = { background: '#1C1C1E', borderRadius: 30 };

  return (
    <div className="mb-3">
      <button
        onClick={() => onNavigate && onNavigate('/stats')}
        className="w-full text-left"
        style={card}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <p className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            STATISTIQUES DE LA SEMAINE
          </p>
          <TrendingUp size={12} style={{ color: '#F97316' }} />
        </div>

        {/* Mini bars */}
        <div className="px-5 pb-3">
          <MiniBars data={barsData} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 divide-x px-3 pb-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex flex-col items-center py-3 px-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={11} style={{ color: scoreColor }} />
              <span className="text-lg font-black text-white">{score !== null ? score : '—'}</span>
            </div>
            <span className="text-[9px] font-bold" style={{ color: scoreColor }}>SCORE</span>
          </div>
          <div className="flex flex-col items-center py-3 px-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={11} style={{ color: '#F97316' }} />
              <span className="text-lg font-black text-white">{sessionsReussies}</span>
            </div>
            <span className="text-[9px] font-bold" style={{ color: '#F97316' }}>
              SESSIONS
            </span>
            {tauxSession !== null && (
              <span className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {tauxSession}% réussite
              </span>
            )}
          </div>
          <div className="flex flex-col items-center py-3 px-1">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={11} style={{ color: '#2ECC71' }} />
              <span className="text-lg font-black text-white">{habitudesSemaine}</span>
            </div>
            <span className="text-[9px] font-bold" style={{ color: '#2ECC71' }}>
              HABITUDES
            </span>
            <span className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
              7 derniers jours
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}