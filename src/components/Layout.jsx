import { Outlet, Link, useLocation } from 'react-router-dom';
import useTaskNotifications from '@/hooks/useTaskNotifications';
import useDynamicAccent from '@/hooks/useDynamicAccent';
import { Home, CheckSquare, Calendar, CalendarDays, BarChart2, User, Shield, Users, Target, Settings } from 'lucide-react';

// 1. Navigation complète pour la Sidebar Desktop (avec Paramètres ajouté)
const DESKTOP_NAV = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/taches', icon: CheckSquare, label: 'Tâches' },
  { path: '/concentration', icon: Shield, label: 'Focus' },
  { path: '/programmes', icon: Calendar, label: 'Programmes' },
  { path: '/calendrier', icon: CalendarDays, label: 'Calendrier' },
  { path: '/stats', icon: BarChart2, label: 'Stats' },
  { path: '/parent', icon: Users, label: 'Famille' },
  { path: '/objectifs', icon: Target, label: 'Objectifs' },
  { path: '/profil', icon: User, label: 'Profil' },
  { path: '/parametres', icon: Settings, label: 'Réglages' },
];

// 2. Navigation optimisée à 5 onglets pour le Bottom Nav Mobile
const MOBILE_NAV = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/taches', icon: CheckSquare, label: 'Tâches' },
  { path: '/concentration', icon: Shield, label: 'Focus' },
  { path: '/programmes', icon: Calendar, label: 'Programmes' },
  { path: '/parametres', icon: Settings, label: 'Réglages' },
];

export default function Layout() {
  const location = useLocation();
  useTaskNotifications();
  useDynamicAccent();

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'var(--noir)' }}>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-20 lg:w-56 border-r border-border shrink-0 sticky top-0 h-screen" style={{ background: '#0D0D18' }}>
        <div className="p-4 lg:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <span className="hidden lg:block text-sm font-black tracking-widest gold-text">COACH ELITE</span>
          </div>
        </div>
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
          {DESKTOP_NAV.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold ${
                  active
                    ? 'text-black'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                style={active ? { background: 'var(--gold)', color: '#080810' } : {}}
              >
                <Icon size={18} />
                <span className="hidden lg:block">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 pb-20 md:pb-0 min-h-screen overflow-x-hidden">
        <Outlet />
      </main>

      {/* Bottom nav mobile (Fixé à 5 onglets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border z-50 px-2 py-1" style={{ background: '#0D0D18' }}>
        <div className="flex w-full justify-around items-center">
          {MOBILE_NAV.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path} className="flex flex-col items-center justify-center py-1.5 flex-1 transition-all">
                <Icon size={20} style={{ color: active ? 'var(--gold)' : '#666677' }} />
                <span className="text-[10px] font-bold mt-0.5" style={{ color: active ? 'var(--gold)' : '#666677' }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
