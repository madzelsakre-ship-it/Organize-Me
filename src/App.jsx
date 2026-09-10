import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Taches from './pages/Taches';
import Programmes from './pages/Programmes';
import Stats from './pages/Stats';
import Rappels from './pages/Rappels';
import Profil from './pages/Profil';
import Concentration from './pages/Concentration';
import Habitudes from './pages/Habitudes';
import Calendrier from './pages/Calendrier';
import Parent from './pages/Parent';
import Enfant from './pages/Enfant';
import Objectifs from './pages/Objectifs';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/taches" element={<Taches />} />
        <Route path="/programmes" element={<Programmes />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/rappels" element={<Rappels />} />
        <Route path="/concentration" element={<Concentration />} />
        <Route path="/habitudes" element={<Habitudes />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/parent" element={<Parent />} />
        <Route path="/objectifs" element={<Objectifs />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
      <Route path="/enfant" element={<Enfant />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App