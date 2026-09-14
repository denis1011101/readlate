/** Target languages for translation; the source language is detected by Gemini. */
export const LANGUAGES = [
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'readlate_target_language';
const DEFAULT_LANGUAGE: LanguageCode = 'ru';

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  LANGUAGES.some(l => l.code === value);

export const languageName = (code: LanguageCode): string =>
  LANGUAGES.find(l => l.code === code)?.name ?? code;

export const getTargetLanguage = (): LanguageCode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

export const setTargetLanguage = (code: LanguageCode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch (e) {
    console.error('Could not save language preference', e);
  }
};
