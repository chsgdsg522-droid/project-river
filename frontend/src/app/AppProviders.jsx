import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadLocalState, recordMatch, savePreferences, saveProfile } from '../lib/storage.js';

const AppContext = createContext(null);

export function AppProviders({ children, storage }) {
  const [localState, setLocalState] = useState(() => loadLocalState(storage));
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const update = () => setSystemReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const reduceMotion = localState.preferences.reducedMotion || systemReducedMotion;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = localState.preferences.theme;
    root.dataset.deck = localState.preferences.deck;
    root.dataset.reducedMotion = String(reduceMotion);
  }, [localState.preferences, reduceMotion]);

  const value = useMemo(() => ({
    ...localState,
    reduceMotion,
    updateProfile(profile) {
      const next = saveProfile(profile, storage);
      setLocalState(current => ({ ...current, profile: next }));
    },
    updatePreferences(preferences) {
      const next = savePreferences(preferences, storage);
      setLocalState(current => ({ ...current, preferences: next }));
    },
    addMatch(summary) {
      const statistics = recordMatch(summary, storage);
      setLocalState(current => ({ ...current, statistics }));
    },
  }), [localState, reduceMotion, storage]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('APP_PROVIDER_REQUIRED');
  return value;
}
