import { base44 } from '@/api/supabaseClient';
import { Shield, LogOut, ChevronRight, Bell, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Parametres() {
  const navigate = useNavigate();

  function handleLogout() {
    base44.auth.logout();
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-4 pb-28">
      <h1 className="text-xl font-black text-foreground mb-6">Réglages & Paramètres</h1>

      {/* Contrôle parental */}
      <button 
        onClick={() => navigate('/parent')}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border transition-all hover:border-gold text-left"
        style={{ background: 'var(--surface)' }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
          <Shield size={20} style={{ color: 'var(--gold)' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-foreground">Contrôle parental & Famille</p>
          <p className="text-xs text-muted-foreground">Suivez en temps réel le parcours de votre enfant</p>
        </div>
        <ChevronRight size={18} style={{ color: 'var(--gold)' }} />
      </button>

      {/* Section Alarmes et notifications */}
      <div className="p-4 rounded-2xl border border-border space-y-3" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <Bell size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Alarmes de non-respect</p>
            <p className="text-xs text-muted-foreground">Alerte le parent si les objectifs quotidiens ne sont pas validés</p>
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className="p-4 rounded-2xl border border-border flex items-center gap-3" style={{ background: 'var(--surface)' }}>
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
          <Lock size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Sécurité du compte</p>
          <p className="text-xs text-muted-foreground">Code PIN parent et verrouillage</p>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="pt-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/40 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
