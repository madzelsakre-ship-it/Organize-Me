import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, PRIORITES, JOURS } from '@/lib/coachData';
import { CheckCircle2, Circle, Flame, ChevronRight, Zap } from 'lucide-react';
import CoachMessage from '@/components/CoachMessage';
import RoxMascot from '@/components/RoxMascot';
import NotificationBanner from '@/components/NotificationBanner';
import OnboardingModal from '@/components/OnboardingModal';
import MantraBanner from '@/components/objectifs/MantraBanner';
import DailyBriefing from '@/components/DailyBriefing';
import InstallPWA from '@/components/InstallPWA';
import WeeklyStats from '@/components/WeeklyStats';
import Badges from '@/components/Badges';

function parseHeure(h) {
  if (!h) return null;
  const match = h.match(/(\d+)h(\d*)/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
}

function CircularProgress({ pct, streak }) {
  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center pt-8 pb-4">
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="110" cy="110" r={r} fill="none" stroke="#2A2A2A" strokeWidth="14" />
          {/* Progress */}
          <circle
            cx="110" cy="110" r={r}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.8s ease', filter: 'drop-shadow(0 0 10px var(--gold-line))' }}
          />
        </svg>
        {/* Centre */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-5xl font-black text-white">{pct}<span className="text-2xl font-bold text-white/40">%</span></p>
          <p className="text-xs tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>OBJECTIF DU JOUR</p>
          <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full" style={{ background: 'var(--gold-dim)' }}>
            <Flame size={12} style={{ color: 'var(--gold)' }} />
            <span className="text-xs font-black" style={{ color: 'var(--gold)' }}>{streak} jours</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [taches, setTaches] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoreDiscipline, setScoreDiscipline] = useState(null);
  const [habitudes, setHabitudes] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const todayName = JOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayISO = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      base44.entities.Tache.list('-created_date', 100),
      base44.entities.Programme.list('-created_date', 20),
      base44.entities.StatJour.list('-created_date', 30),
      base44.entities.Habitude.list('-created_date', 100),
      base44.entities.ScoreDiscipline.list('-created_date', 1),
    ]).then(([t, p, s, h, d]) => {
      setTaches(t);
      setProgrammes(p);
      setStats(s);
      setHabitudes(h.filter(hb => !hb.archivee));
      if (d.length > 0) setScoreDiscipline(d[0]);
      setLoading(false);
    });
    // Onboarding : uniquement si objectif_principal pas encore défini ET jamais complété
    const onboardingDone = localStorage.getItem('onboarding-done');
    if (!currentUser?.objectif_principal && !onboardingDone) {
      setShowOnboarding(true);
    }
  }, []);

  const tachesAujourd = useMemo(
    () => taches.filter(t => t.jour === todayName || t.jour === todayISO),
    [taches, todayName, todayISO]
  );
  const faites = useMemo(() => tachesAujourd.filter(t => t.faite).length, [tachesAujourd]);
  const total = tachesAujourd.length;
  const pct = total > 0 ? Math.round((faites / total) * 100) : 0;
  const streak = stats.length > 0 ? (stats[0].streak || 0) : 0;

  const prochaine = useMemo(() => {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return tachesAujourd
      .filter(t => !t.faite && t.heure)
      .map(t => ({ ...t, min: parseHeure(t.heure) }))
      .filter(t => t.min !== null && t.min > nowMin)
      .sort((a, b) => a.min - b.min)[0] || null;
  }, [tachesAujourd]);
  const diffMin = prochaine ? prochaine.min - (new Date().getHours() * 60 + new Date().getMinutes()) : null;

  async function toggleTache(e, id, faite) {
    e.stopPropagation();
    await base44.entities.Tache.update(id, { faite: !faite, date_faite: !faite ? new Date().toISOString() : null });
    setTaches(prev => prev.map(t => t.id === id ? { ...t, faite: !faite } : t));
  }

  const card = { background: '#1C1C1E', borderRadius: 30, transition: 'transform 0.12s ease' };

  if (loading) return (
    <div className="min-h-screen pb-28 md:pb-10" style={{ background: '#000000' }}>
      <div className="max-w-lg mx-auto px-4">
        <div className="pt-8 pb-2 space-y-2">
          <div className="h-3 w-40 rounded-full bg-white/5 animate-pulse" />
          <div className="h-7 w-64 rounded-full bg-white/5 animate-pulse" />
        </div>
        <div className="flex flex-col items-center pt-10 pb-6">
          <div className="w-[220px] h-[220px] rounded-full bg-white/5 animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-16 rounded-3xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
          </div>
          <div className="h-40 rounded-3xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-20 rounded-3xl bg-white/5 animate-pulse" />
            <div className="h-20 rounded-3xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-28 md:pb-10" style={{ background: '#000000' }}>
      {showOnboarding && (
        <OnboardingModal
          user={currentUser}
          onDone={(data) => { setShowOnboarding(false); }}
        />
      )}
      <div className="max-w-lg mx-auto px-4 stagger">

        {/* Header */}
        <div className="pt-8 pb-2">
          <p className="text-xs tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </p>
          <h1 className="text-2xl font-black text-white">
            Bonjour {currentUser?.full_name?.split(' ')[0] || 'Champion'} 👑
          </h1>
          {/* Objectif principal */}
          {currentUser?.objectif_principal && (
            <button
              onClick={() => navigate('/profil')}
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-line)' }}>
              {currentUser.objectif_emoji || '🎯'} {currentUser.objectif_principal}
            </button>
          )}
          {!currentUser?.objectif_principal && (
            <button
              onClick={() => setShowOnboarding(true)}
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
              + Définir mon objectif
            </button>
          )}
        </div>

        {/* Mantra du jour */}
        <MantraBanner />

        {/* Bannière installation PWA */}
        <InstallPWA />

        {/* Bannière notifications / prochaine tâche */}
        <NotificationBanner
          tachesAujourd={tachesAujourd}
          onTacheUpdate={() => base44.entities.Tache.list('-created_date', 100).then(setTaches)}
        />

        {/* Rox la mascotte */}
        <div className="flex justify-center pt-4 pb-2">
          <RoxMascot
            score={scoreDiscipline?.score || 100}
            streakLoss={streak === 0 && stats.length > 1}
          />
        </div>

        {/* Anneau circulaire */}
        <CircularProgress pct={pct} streak={streak} />

        {/* Prochaine tâche */}
        {prochaine && (
          <div className="mb-3 px-5 py-4 flex items-center gap-3" style={{ ...card }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
              <Zap size={16} style={{ color: 'var(--gold)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>PROCHAINE ÉTAPE</p>
              <p className="text-sm font-bold text-white truncate">{prochaine.titre}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black" style={{ color: diffMin <= 15 ? '#FF453A' : 'var(--gold)' }}>
                {diffMin < 60 ? `${diffMin}min` : `${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? diffMin % 60 : ''}`}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>à {prochaine.heure}</p>
            </div>
          </div>
        )}

        {/* Briefing du jour */}
        <DailyBriefing
          userName={currentUser?.full_name?.split(' ')[0]}
          objectif={currentUser?.objectif_principal}
          tachesAujourd={tachesAujourd}
          streak={streak}
        />

        {/* Coach IA */}
        <div className="mb-3">
          <CoachMessage
            userName={currentUser?.full_name?.split(' ')[0]}
            tachesAujourd={tachesAujourd}
            streak={streak}
            stats={stats}
          />
        </div>

        {/* Grille stats rapides */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Tâches', value: `${faites}/${total}`, sub: 'aujourd\'hui', color: '#30D158', path: '/taches' },
            { label: 'Streak', value: `${streak}🔥`, sub: 'jours', color: 'var(--gold)', path: '/stats' },
            { label: 'Score', value: scoreDiscipline ? `${scoreDiscipline.score}` : '—', sub: '/100', color: scoreDiscipline?.score >= 70 ? '#30D158' : scoreDiscipline?.score >= 40 ? 'var(--gold)' : '#FF453A', path: '/stats' },
          ].map(({ label, value, sub, color, path }) => (
            <button key={label} onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center py-5 transition-transform active:scale-[0.97]"
              style={card}
            >
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-[10px] font-bold mt-0.5" style={{ color }}>{label}</p>
              <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{sub}</p>
            </button>
          ))}
        </div>

        {/* Trophées */}
        <Badges
          streak={streak}
          totalFaites={taches.filter(t => t.faite).length}
          score={scoreDiscipline?.score || 100}
          habitudes={habitudes.length}
          stats={stats}
        />

        {/* Statistiques semaine */}
        <WeeklyStats
          scoreDiscipline={scoreDiscipline}
          stats={stats}
          habitudes={habitudes}
          onNavigate={(path) => navigate(path)}
        />

        {/* Bloc Tâches du jour */}
        <button onClick={() => navigate('/taches')} className="w-full text-left mb-3 transition-transform active:scale-[0.99]" style={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-[10px] font-bold tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>TÂCHES DU JOUR</p>
              <p className="text-sm font-black text-white">{todayName}</p>
            </div>
            <div className="flex items-center gap-1" style={{ color: 'var(--gold)' }}>
              <span className="text-xs font-bold">Voir tout</span>
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {tachesAujourd.length === 0 ? (
              <p className="px-5 pb-5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune tâche pour aujourd'hui</p>
            ) : (
              tachesAujourd.slice(0, 5).map(t => {
                const cat = CATEGORIES[t.categorie] || CATEGORIES.autre;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <button onClick={(e) => toggleTache(e, t.id, t.faite)} className="shrink-0">
                      {t.faite
                        ? <CheckCircle2 size={20} style={{ color: '#30D158' }} />
                        : <Circle size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
                      }
                    </button>
                    <span className="text-base">{cat.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${t.faite ? 'line-through' : 'text-white'}`}
                        style={t.faite ? { color: 'rgba(255,255,255,0.25)' } : {}}>
                        {t.titre}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{t.heure}</p>
                    </div>
                  </div>
                );
              })
            )}
            {tachesAujourd.length > 5 && (
              <p className="px-5 py-3 text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                +{tachesAujourd.length - 5} autres tâches
              </p>
            )}
          </div>
        </button>

        {/* Programmes + Stats en grille 2 colonnes */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => navigate('/programmes')} className="text-left px-4 py-3.5 transition-transform active:scale-[0.98]" style={card}>
            <p className="text-[9px] font-bold tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>PROGRAMMES</p>
            <p className="text-sm font-black text-white">{programmes.length} prog.</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {programmes.filter(p => p.est_favori).length} favori
            </p>
          </button>
          <button onClick={() => navigate('/stats')} className="text-left px-4 py-3.5 transition-transform active:scale-[0.98]" style={card}>
            <p className="text-[9px] font-bold tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>STATISTIQUES</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex items-end gap-0.5 h-6">
                {stats.slice(0, 7).reverse().map((s, i) => {
                  const h = s.total > 0 ? Math.max(3, Math.round((s.faites / s.total) * 24)) : 3;
                  return <div key={i} className="w-1.5 rounded-sm" style={{ height: h, background: i === 6 ? 'var(--gold)' : 'var(--gold-line)' }} />;
                })}
              </div>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{stats.length} bilans</p>
            </div>
          </button>
        </div>

        {/* Bloc Focus compact */}
        <Link to="/concentration" className="flex items-center gap-3 mb-3 px-4 py-3.5" style={card}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
            <span className="text-xl">🛡️</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Mode Focus</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Concentration profonde · Bloquez les distractions</p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--gold)' }} />
        </Link>

      </div>
    </div>
  );
}