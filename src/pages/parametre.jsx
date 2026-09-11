import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { 
  Shield, LogOut, ChevronRight, Bell, Lock, Clock, 
  Smartphone, Moon, Volume2, UserCheck, HelpCircle, Info, RefreshCw 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Parametre() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // États pour les différents réglages
  const [alarmesActives, setAlarmesActives] = useState(true);
  const [heureLimite, setHeureLimite] = useState('19:00');
  const [modeSombre, setModeSombre] = useState(true);
  const [sonsActifs, setSonsActifs] = useState(true);
  const [notificationsPush, setNotificationsPush] = useState(true);

  function handleLogout() {
    base44.auth.logout();
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-5 pb-28">
      <div>
        <h1 className="text-xl font-black text-foreground">Réglages & Paramètres</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Personnalisez votre expérience et gérez votre sécurité</p>
      </div>

      {/* 1. CONTRÔLE PARENTAL & FAMILLE */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">FAMILLE & SÉCURITÉ</p>
        <button 
          onClick={() => navigate('/parent')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border transition-all hover:border-gold text-left"
          style={{ background: 'var(--surface)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
            <Shield size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-foreground">Contrôle parental</p>
            <p className="text-xs text-muted-foreground">Suivi en temps réel et liaison de compte</p>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--gold)' }} />
        </button>

        <div className="p-4 rounded-2xl border border-border flex items-center justify-between" style={{ background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Code PIN Parent</p>
              <p className="text-xs text-muted-foreground">Protéger l'accès aux modifications</p>
            </div>
          </div>
          <button className="text-xs font-bold px-3 py-1.5 rounded-xl border border-border text-foreground hover:border-gold transition-colors">
            Configurer
          </button>
        </div>
      </div>

      {/* 2. RÈGLES DE DISCIPLINE & ALARMES */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">DISCIPLINE & RAPPELS</p>
        <div className="p-4 rounded-2xl border border-border space-y-4" style={{ background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Alarmes de non-respect</p>
                <p className="text-xs text-muted-foreground">Alerte rouge si les tâches ne sont pas faites</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={alarmesActives} 
              onChange={(e) => setAlarmesActives(e.target.checked)}
              className="w-5 h-5 accent-[var(--gold)] rounded cursor-pointer"
            />
          </div>

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
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-bold"
              />
            </div>
          )}

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Smartphone size={16} />
              </div>
              <p className="text-xs font-medium text-foreground">Notifications Push sur l'appareil</p>
            </div>
            <input 
              type="checkbox" 
              checked={notificationsPush} 
              onChange={(e) => setNotificationsPush(e.target.checked)}
              className="w-4 h-4 accent-[var(--gold)] rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. PRÉFÉRENCES DE L'APPLICATION */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">PRÉFÉRENCES</p>
        <div className="p-4 rounded-2xl border border-border space-y-4" style={{ background: 'var(--surface)' }}>
          
          {/* Mode Sombre */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                <Moon size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Thème Sombre Intégral</p>
                <p className="text-[10px] text-muted-foreground">Optimisé pour l'économie d'énergie</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={modeSombre} 
              onChange={(e) => setModeSombre(e.target.checked)}
              className="w-4 h-4 accent-[var(--gold)] rounded cursor-pointer"
            />
          </div>

          {/* Effets sonores */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                <Volume2 size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Sons & Vibrations (Focus)</p>
                <p className="text-[10px] text-muted-foreground">Effets audios lors des minuteries</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={sonsActifs} 
              onChange={(e) => setSonsActifs(e.target.checked)}
              className="w-4 h-4 accent-[var(--gold)] rounded cursor-pointer"
            />
          </div>

        </div>
      </div>

      {/* 4. AIDE & À PROPOS */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground px-1">SUPPORT & INFORMATIONS</p>
        <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden" style={{ background: 'var(--surface)' }}>
          <button className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <HelpCircle size={18} className="text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Guide d'utilisation & FAQ</span>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Info size={18} className="text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Version de l'application</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">v2.4.0 Elite</span>
          </div>
        </div>
      </div>

      {/* 5. DÉCONNEXION */}
      <div className="pt-2">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-destructive/40 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={16} /> Se déconnecter de la session
        </button>
      </div>
    </div>
  );
}
