import { describe, expect, it } from 'vitest';
import { getTargetLanguage, isLanguageCode, languageName, setTargetLanguage } from './languages';

describe('target language preference', () => {
  it('defaults to Russian and round-trips a saved choice', () => {
    expect(getTargetLanguage()).toBe('ru');
    setTargetLanguage('de');
    expect(getTargetLanguage()).toBe('de');
    expect(localStorage.getItem('readlate_target_language')).toBe('de');
  });

  it('ignores unknown saved values', () => {
    localStorage.setItem('readlate_target_language', 'klingon');
    expect(getTargetLanguage()).toBe('ru');
    expect(isLanguageCode('ja')).toBe(true);
    expect(isLanguageCode('xx')).toBe(false);
  });

  it('maps codes to English names for the prompt', () => {
    expect(languageName('fr')).toBe('French');
  });
});
