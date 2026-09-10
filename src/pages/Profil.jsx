import { useState, useEffect } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Target, Flame, CheckCircle2, LogOut, Pencil, Shield, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OnboardingModal from '@/components/OnboardingModal';

export default function Profil() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  function getNiveau() {
    if (streak >= 30) return { label: '🏆 Maître', color: '#9B59B6' };
    if (streak >= 14) return { label: '🥇 Expert', color: '#F39C12' };
    if (streak >= 7) return { label: '🥈 Intermédiaire', color: '#3498DB' };
    if (streak >= 3) return { label: '🥉 Apprenti', color: '#2ECC71' };
    return { label: '🌱 Débutant', color: '#607D8B' };
  }

  const niveau = getNiveau();

  function handleLogout() {
    base44.auth.logout();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-black text-foreground mb-6">Profil</h1>

      {showOnboarding && (
        <OnboardingModal user={currentUser} onDone={() => setShowOnboarding(false)} />
      )}

      {/* Carte profil */}
      <div className="rounded-2xl border border-border p-6 mb-6 relative overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(circle at 80% 20%, var(--gold), transparent 60%)' }} />
        <div className="relative flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0" style={{ background: 'var(--gold-dim)', border: '2px solid var(--gold)' }}>
            {currentUser?.full_name?.[0]?.toUpperCase() || '👑'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-foreground">{currentUser?.full_name || 'Champion'}</h2>
            <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg text-xs font-bold" style={{ background: `${niveau.color}20`, color: niveau.color }}>
              {niveau.label}
            </div>
          </div>
        </div>

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
          <button onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border hover:border-gold transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--gold)' }}>
            <Pencil size={12} /> Modifier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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
      <div className="rounded-2xl border border-border overflow-hidden mb-6" style={{ background: 'var(--surface)' }}>
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
                    <p className="text-sm font-semibold" style={{ color: atteint ? nv.color : '#666677' }}>{nv.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">{nv.requis} jours de streak requis</p>
                  </div>
                </div>
                {atteint && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${nv.color}20`, color: nv.color }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contrôle parental */}
      <button onClick={() => navigate('/parent')}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border mb-6 transition-all hover:border-gold"
        style={{ background: 'var(--surface)' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
          <Shield size={20} style={{ color: 'var(--gold)' }} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-black text-foreground">Contrôle parental</p>
          <p className="text-xs text-muted-foreground">Suivez en temps réel le parcours de votre enfant</p>
        </div>
        <ChevronRight size={18} style={{ color: 'var(--gold)' }} />
      </button>

      {/* Déconnexion */}
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/40 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
      >
        <LogOut size={16} /> Se déconnecter
      </button>
    </div>
  );
}