import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when viewport is mobile-sized or device has touch primary.
 * Used for mobile-only UX (Info Mode, etc.). Desktop behavior unchanged.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const narrow = window.innerWidth < MOBILE_BREAKPOINT;
      const touchPrimary =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(narrow || touchPrimary);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
