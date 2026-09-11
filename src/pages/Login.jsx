import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();

  const {
    login,
    signUp,
    loginWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setMessage('');

    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (password.length < 6) {
      setError(
        'Le mot de passe doit contenir au moins 6 caractères.'
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else {
        const result = await signUp(email, password);

        if (result.session) {
          navigate('/');
        } else {
          setMessage(
            'Compte créé. Vérifiez votre adresse e-mail pour confirmer votre compte.'
          );
        }
      }
    } catch (err) {
      setError(
        err?.message ||
        'Une erreur est survenue.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      setError(
        err?.message ||
        'Connexion Google impossible.'
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: '#080810',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 border"
        style={{
          background: '#0D0D18',
          borderColor: '#29293A',
        }}
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white">
            Organize-Me
          </h1>

          <p className="text-gray-400 mt-2">
            Organisez votre temps. Disciplinez votre quotidien.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setMode('login');
              setError('');
              setMessage('');
            }}
            className="flex-1 py-3 rounded-xl font-bold"
            style={{
              background:
                mode === 'login'
                  ? 'var(--gold)'
                  : '#1A1A27',
              color:
                mode === 'login'
                  ? '#080810'
                  : '#999',
            }}
          >
            Connexion
          </button>

          <button
            onClick={() => {
              setMode('signup');
              setError('');
              setMessage('');
            }}
            className="flex-1 py-3 rounded-xl font-bold"
            style={{
              background:
                mode === 'signup'
                  ? 'var(--gold)'
                  : '#1A1A27',
              color:
                mode === 'signup'
                  ? '#080810'
                  : '#999',
            }}
          >
            Inscription
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              Adresse e-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="exemple@email.com"
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{
                background: '#181824',
                color: 'white',
                border: '1px solid #303044',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">
              Mot de passe
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{
                background: '#181824',
                color: 'white',
                border: '1px solid #303044',
              }}
            />
          </div>

          {error && (
            <div className="rounded-xl p-3 text-sm text-red-300 bg-red-950/40">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl p-3 text-sm text-green-300 bg-green-950/40">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-black disabled:opacity-50"
            style={{
              background: 'var(--gold)',
              color: '#080810',
            }}
          >
            {loading
              ? 'Chargement...'
              : mode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-gray-700" />
          <span className="text-xs text-gray-500">
            OU
          </span>
          <div className="h-px flex-1 bg-gray-700" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold border border-gray-700 text-white disabled:opacity-50"
        >
          Continuer avec Google
        </button>
      </div>
    </div>
  );
}