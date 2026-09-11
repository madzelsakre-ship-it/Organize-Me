import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Shield, LogOut, ChevronRight, Bell, Lock, Clock, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Parametres() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // États pour les paramètres
  const [alarmesActives, setAlarmesActives] = useState(true);
  const [heureLimite, setHeureLimite] = useState('19:00');

  function handleLogout() {
    base44.auth.logout();
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-4 pb-28">
      <h1 className="text-xl font-black text-foreground mb-6">Réglages & Paramètres</h1>

      {/* 1. CONTRÔLE PARENTAL & PAIRAGE */}
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
          <p className="text-xs text-muted-foreground">Lier un compte enfant, voir les rapports</p>
        </div>
        <ChevronRight size={18} style={{ color: 'var(--gold)' }} />
      </button>

      {/* 2. RÈGLES DE DISCIPLINE & ALARMES */}
      <div className="p-4 rounded-2xl border border-border space-y-4" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Alarmes de non-respect</p>
              <p className="text-xs text-muted-foreground">Alerte rouge si les tâches sont en retard</p>
            </div>
          </div>
          {/* Interrupteur On/Off */}
          <input 
            type="checkbox" 
            checked={alarmesActives} 
            onChange={(e) => setAlarmesActives(e.target.checked)}
            className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
          />
        </div>

        {/* Option heure limite */}
        {alarmesActives && (
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={14} />
              <span>Heure limite quotidienne</span>
            </div>
            <input 
              type="time" 
              value={heureLimite}
              onChange={(e) => setHeureLimite(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            />
          </div>
        )}
      </div>

      {/* 3. SÉCURITÉ & CODE PIN */}
      <div className="p-4 rounded-2xl border border-border flex items-center justify-between" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <Lock size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Code PIN Parent</p>
            <p className="text-xs text-muted-foreground">Protéger l'accès aux réglages</p>
          </div>
        </div>
        <button className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border text-foreground hover:border-gold">
          Configurer
        </button>
      </div>

      {/* 4. DÉCONNEXION */}
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
