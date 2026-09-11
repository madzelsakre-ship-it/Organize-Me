import { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Target, Flame, CheckCircle2, Pencil, AlertTriangle, ShieldCheck } from 'lucide-react';
import OnboardingModal from '@/components/OnboardingModal';

export default function Profil() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState([]);
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.StatJour.list('-created_date', 30),
      base44.entities.Tache.list('-created_date', 500),
    ]).then(([s, t]) => {
      setStats(s);
      setTaches(t);
      setLoading(false);
    });
  }, []);

  const streak = stats.length > 0 ? (stats[0].streak || 0) : 0;
  const totalFaites = taches.filter(t => t.faite).length;

  // Simulation vérification du respect du temps / tâches aujourd'hui
  const aujourdhui = new Date().toISOString().split('T')[0];
  const tachesAujourdhui = taches.filter(t => t.created_date?.startsWith(aujourdhui) || t.date === aujourdhui);
  const retardDetecte = tachesAujourdhui.length > 0 && tachesAujourdhui.every(t => !t.faite);

  function getNiveau() {
    if (streak >= 30) return { label: '🏆 Maître', color: '#9B59B6' };
    if (streak >= 14) return { label: '🥇 Expert', color: '#F39C12' };
    if (streak >= 7) return { label: '🥈 Intermédiaire', color: '#3498DB' };
    if (streak >= 3) return { label: '🥉 Apprenti', color: '#2ECC71' };
    return { label: '🌱 Débutant', color: '#607D8B' };
  }

  const niveau = getNiveau();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5 pb-28">
      <h1 className="text-xl font-black text-foreground mb-4">Profil</h1>

      {showOnboarding && (
        <OnboardingModal user={currentUser} onDone={() => setShowOnboarding(false)} />
      )}

      {/* Carte profil principal avec Statut */}
      <div className="rounded-2xl border border-border p-6 relative overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(circle at 80% 20%, var(--gold), transparent 60%)' }} />
        <div className="relative flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0" style={{ background: 'var(--gold-dim)', border: '2px solid var(--gold)' }}>
            {currentUser?.full_name?.[0]?.toUpperCase() || '👑'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-foreground">{currentUser?.full_name || 'Champion'}</h2>
            <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
            
            {/* Statuts du compte */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ShieldCheck size={11} />
                {currentUser?.role === 'parent' ? 'Parent Vigile' : 'Enfant suivi'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${niveau.color}20`, color: niveau.color }}>
                {niveau.label}
              </span>
            </div>
          </div>
        </div>

        {/* Encart Alarme / Respect du temps */}
        {retardDetecte && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 font-bold shrink-0 animate-pulse">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-500">Temps non respecté !</p>
              <p className="text-[10px] text-red-400/80 truncate">Alerte envoyée : aucune tâche complétée pour le moment.</p>
            </div>
          </div>
        )}

        {/* Objectif */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1">MON OBJECTIF</p>
            {currentUser?.objectif_principal ? (
              <p className="text-sm font-bold text-foreground">
                {currentUser.objectif_emoji} {currentUser.objectif_principal}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Non défini</p>
            )}
            {currentUser?.heure_reveil && (
              <p className="text-xs text-muted-foreground mt-0.5">⏰ Réveil {currentUser.heure_reveil}</p>
            )}
          </div>
          <button 
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border hover:border-gold transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--gold)' }}
          >
            <Pencil size={12} /> Modifier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, label: 'Streak', value: `${streak}j`, color: '#F39C12' },
          { icon: CheckCircle2, label: 'Tâches faites', value: totalFaites, color: '#2ECC71' },
          { icon: Target, label: 'Bilans', value: stats.length, color: '#3498DB' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl p-4 border border-border text-center" style={{ background: 'var(--surface)' }}>
            <Icon size={18} className="mx-auto mb-1.5" style={{ color }} />
            <p className="text-xl font-black text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Niveaux */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div className="p-4 border-b border-border">
          <p className="text-xs font-bold tracking-widest text-muted-foreground">PROGRESSION DES NIVEAUX</p>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: '🌱 Débutant', requis: 0, color: '#607D8B' },
            { label: '🥉 Apprenti', requis: 3, color: '#2ECC71' },
            { label: '🥈 Intermédiaire', requis: 7, color: '#3498DB' },
            { label: '🥇 Expert', requis: 14, color: '#F39C12' },
            { label: '🏆 Maître', requis: 30, color: '#9B59B6' },
          ].map(nv => {
            const atteint = streak >= nv.requis;
            return (
              <div key={nv.label} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">{nv.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: atteint ? nv.color : '#666677' }}>
                      {nv.label.split(' ').slice(1).join(' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">{nv.requis} jours de streak requis</p>
                  </div>
                </div>
                {atteint && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${nv.color}20`, color: nv.color }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
