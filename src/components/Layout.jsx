import { Outlet, Link, useLocation } from 'react-router-dom';
import useTaskNotifications from '@/hooks/useTaskNotifications';
import useDynamicAccent from '@/hooks/useDynamicAccent';
import { LayoutDashboard, CheckSquare, Calendar, CalendarDays, BarChart2, User, Shield, Users, Target } from 'lucide-react';

const NAV = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/taches', icon: CheckSquare, label: 'Tâches' },
  { path: '/calendrier', icon: CalendarDays, label: 'Calendrier' },
  { path: '/programmes', icon: Calendar, label: 'Programmes' },
  { path: '/concentration', icon: Shield, label: 'Focus' },
  { path: '/stats', icon: BarChart2, label: 'Stats' },
  { path: '/parent', icon: Users, label: 'Famille' },
  { path: '/objectifs', icon: Target, label: 'Objectifs' },
  { path: '/profil', icon: User, label: 'Profil' },
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
        <nav className="flex-1 p-3 lg:p-4 space-y-1">
          {NAV.map(({ path, icon: Icon, label }) => {
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

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border z-50 overflow-x-auto no-scrollbar" style={{ background: '#0D0D18' }}>
        <div className="flex min-w-max">
          {NAV.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path} className="flex flex-col items-center justify-center py-2 gap-0.5 min-w-[62px] shrink-0 px-1">
                <Icon size={20} style={{ color: active ? 'var(--gold)' : '#666677' }} />
                <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: active ? 'var(--gold)' : '#666677' }}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}