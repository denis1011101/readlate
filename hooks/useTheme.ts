import { useEffect, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lingoreader_theme';
const SYSTEM_QUERY = '(prefers-color-scheme: dark)';
type Theme = 'dark' | 'light';

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(SYSTEM_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSystemTheme() {
  return window.matchMedia(SYSTEM_QUERY).matches;
}

export function useTheme() {
  const [preference, setPreference] = useState<Theme | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  });
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme);
  const isDarkMode = preference === null ? systemDark : preference === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDarkMode ? '#020617' : '#f8fafc');
  }, [isDarkMode]);

  const toggleTheme = () => {
    const next: Theme = isDarkMode ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    setPreference(next);
  };

  return { isDarkMode, toggleTheme };
}
