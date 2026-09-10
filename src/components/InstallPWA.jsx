import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPWA() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-install-dismissed') === 'true'
  );
  const [isIOS, setIsIOS] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Détecte iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone;
    setIsIOS(ios);
    if (standalone) setInstalled(true);

    // Android / Chrome : capture l'event beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Déjà installée ou banière rejetée
  if (installed || dismissed) return null;
  // Android sans prompt pas encore déclenché
  if (!prompt && !isIOS) return null;

  async function installer() {
    if (isIOS) {
      setShowIOS(true);
      return;
    }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  return (
    <>
      {/* Bannière principale */}
      <div
        className="mx-4 mb-3 rounded-2xl border flex items-center gap-3 px-4 py-3 animate-fade-in"
        style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.3)' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(249,115,22,0.15)' }}>
          <Smartphone size={18} style={{ color: '#F97316' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Installer Coach Elite</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Accède à l'app depuis ton écran d'accueil
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={installer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black"
            style={{ background: '#F97316', color: '#000' }}
          >
            <Download size={12} />
            Installer
          </button>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-white/10">
            <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>
      </div>

      {/* Modal iOS */}
      {showIOS && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setShowIOS(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6 animate-fade-in"
            style={{ background: '#1C1C1E', border: '1px solid rgba(249,115,22,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">📲</div>
              <h3 className="text-lg font-black text-white mb-1">Installer Coach Elite</h3>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Ajoute l'app à ton écran d'accueil en 2 étapes
              </p>
            </div>
            <div className="space-y-3">
              {[
                { num: '1', text: 'Appuie sur le bouton Partager', icon: '⬆️' },
                { num: '2', text: 'Sélectionne "Sur l\'écran d\'accueil"', icon: '➕' },
              ].map(s => (
                <div key={s.num} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(249,115,22,0.08)' }}>
                  <span className="text-xl">{s.icon}</span>
                  <p className="text-sm font-semibold text-white">{s.text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowIOS(false); dismiss(); }}
              className="w-full mt-4 py-3 rounded-xl text-sm font-black"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}