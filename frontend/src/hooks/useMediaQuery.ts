import { useState, useEffect } from 'react';

/**
 * Custom hook that tracks whether a CSS media query matches.
 *
 * @param query - A valid CSS media query string, e.g. `'(min-width: 1024px)'`.
 * @returns `true` when the query matches, `false` otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(query);

    // Sync in case the value changed between render and effect
    setMatches(mql.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
