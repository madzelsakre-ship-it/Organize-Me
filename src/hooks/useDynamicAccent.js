import { useEffect } from 'react';

export function useDynamicAccent(color) {
  useEffect(() => {
    if (color) {
      document.documentElement.style.setProperty('--accent-color', color);
    }
  }, [color]);
}

export default useDynamicAccent;
