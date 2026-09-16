import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/App.jsx';
import '@/index.css';


/*
 * Enregistrement du Service Worker
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration =
        await navigator.serviceWorker.register(
          '/sw.js'
        );

      console.log(
        '✅ Service Worker enregistré :',
        registration.scope
      );

      /*
       * Demande au navigateur de vérifier
       * s'il existe une nouvelle version.
       */
      registration.update().catch(() => {});

    } catch (error) {
      console.error(
        '❌ Échec de l’enregistrement du Service Worker :',
        error
      );
    }
  });
}


ReactDOM
  .createRoot(
    document.getElementById('root')
  )
  .render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );