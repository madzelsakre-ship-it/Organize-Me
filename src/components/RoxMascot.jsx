import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Bling sound via Web Audio API
function playBling() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1046, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2093, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

function RoxFace({ state, score }) {
  const hasAura = score > 70;

  const eyeStyle = {
    normal: { left: '😊', right: '😊' },
    wink: { left: '😉', right: '' },
    rage: { left: '🔥', right: '🔥' },
    sad: { left: '😢', right: '😢' },
    victory: { left: '🌟', right: '🌟' },
  }[state] || { left: '😊', right: '😊' };

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      {/* Aura orange si score > 70 */}
      {hasAura && state === 'normal' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(circle, rgba(249,115,22,0.4) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
      )}

      {/* Particules si score > 70 */}
      {hasAura && state === 'normal' && [0, 60, 120, 180, 240, 300].map((deg, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: '#F97316', top: '50%', left: '50%', transformOrigin: '0 0' }}
          animate={{
            x: [0, Math.cos(deg * Math.PI / 180) * 52],
            y: [0, Math.sin(deg * Math.PI / 180) * 52],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0],
          }}
          transition={{ repeat: Infinity, duration: 2, delay: i * 0.33, ease: 'easeOut' }}
        />
      ))}

      {/* Corps du renard */}
      <motion.div
        className="relative z-10 flex items-center justify-center"
        style={{ fontSize: 72, userSelect: 'none', filter: state === 'sad' ? 'grayscale(0.6)' : 'none' }}
        animate={
          state === 'victory' ? { y: [0, -18, 0, -10, 0], rotate: [0, -10, 10, -5, 0] } :
          state === 'rage'    ? { scale: [1, 1.15, 0.95, 1.1, 1], rotate: [0, -5, 5, -3, 0] } :
          state === 'wink'    ? { rotate: [0, -8, 8, 0] } :
          state === 'sad'     ? { y: [0, 3, 0], rotate: [0, 2, 0] } :
          { scale: [1, 1.03, 1] }
        }
        transition={
          state === 'victory' ? { duration: 0.7, ease: 'easeInOut' } :
          state === 'rage'    ? { duration: 0.5, ease: 'easeInOut' } :
          state === 'normal'  ? { repeat: Infinity, duration: 3, ease: 'easeInOut' } :
          { duration: 0.4 }
        }
      >
        🦊
      </motion.div>

      {/* Overlay expression */}
      <motion.div
        className="absolute z-20 bottom-1 right-1 text-xl pointer-events-none"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        key={state}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {state === 'wink'   ? '😉' :
         state === 'rage'   ? '💢' :
         state === 'sad'    ? '💧' :
         state === 'victory'? '🏆' : ''}
      </motion.div>

      {/* Oreilles tombantes si sad */}
      {state === 'sad' && (
        <motion.div
          className="absolute top-0 text-sm pointer-events-none"
          initial={{ y: -5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ color: '#888' }}
        >
          〰️
        </motion.div>
      )}
    </div>
  );
}

export default function RoxMascot({ score = 100, streakLoss = false, ecoMode = false, showVictory = false, onVictoryEnd }) {
  const [state, setState] = useState('normal');
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const [showElite, setShowElite] = useState(false);

  // Streak loss → sad state
  useEffect(() => {
    if (streakLoss) {
      setState('sad');
    } else if (state === 'sad') {
      setState('normal');
    }
  }, [streakLoss]);

  // Victory à la fin du focus
  useEffect(() => {
    if (showVictory) {
      setState('victory');
      const t = setTimeout(() => {
        setState('normal');
        onVictoryEnd?.();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [showVictory]);

  const handleTap = useCallback(() => {
    if (state === 'sad' || state === 'rage' || state === 'victory') return;

    tapCountRef.current += 1;
    clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 3) {
      // Triple tap → Hargne
      tapCountRef.current = 0;
      setState('rage');
      navigator.vibrate?.([100, 50, 100, 50, 200]);
      setTimeout(() => setState('normal'), 1500);
    } else {
      // Simple tap → Clin d'œil
      tapTimerRef.current = setTimeout(() => {
        if (tapCountRef.current < 3) {
          tapCountRef.current = 0;
          setState('wink');
          playBling();
          setTimeout(() => setState('normal'), 800);
        }
      }, 300);
    }
  }, [state]);

  // Eco mode : affiche point rouge tournant
  if (ecoMode) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Message d'humeur */}
      <AnimatePresence mode="wait">
        <motion.p
          key={state}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-xs font-bold mb-2 tracking-wide"
          style={{
            color: state === 'rage'    ? '#F97316' :
                   state === 'sad'     ? '#888' :
                   state === 'victory' ? '#30D158' :
                   score > 70          ? '#F97316' :
                   'rgba(255,255,255,0.35)'
          }}
        >
          {state === 'rage'    ? '🔥 RIEN NE M\'ARRÊTE !' :
           state === 'sad'     ? '😢 Reviens... je crois en toi' :
           state === 'victory' ? '🏆 INCROYABLE ! Session complète !' :
           state === 'wink'    ? '😉 Tu déchires !' :
           score > 70          ? '⚡ Mode Élite activé' :
           'Aujourd\'hui c\'est ton jour 💪'}
        </motion.p>
      </AnimatePresence>

      {/* Mascotte cliquable */}
      <motion.button
        onClick={handleTap}
        whileTap={{ scale: 0.92 }}
        className="relative outline-none border-none bg-transparent cursor-pointer"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        aria-label="Rox le Renard"
      >
        <RoxFace state={state} score={score} />
      </motion.button>

      <p className="text-[9px] mt-1 tracking-widest" style={{ color: 'rgba(255,255,255,0.15)' }}>ROX</p>
    </div>
  );
}