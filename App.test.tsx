import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Theme behavior must not initialize the API client or the reader's audio stack.
vi.mock('./components/Reader', () => ({ default: () => null }));

function mockSystemTheme(initial: boolean) {
  const media = new EventTarget();
  let matches = initial;
  Object.defineProperty(media, 'matches', { get: () => matches });
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  return (dark: boolean) => {
    matches = dark;
    const event = new Event('change');
    Object.defineProperty(event, 'matches', { value: dark });
    act(() => media.dispatchEvent(event));
  };
}

const isDark = () => document.documentElement.classList.contains('dark');

describe('theme preference', () => {
  it('follows system changes until the user chooses a theme', () => {
    const changeSystem = mockSystemTheme(false);
    render(<StrictMode><App /></StrictMode>);
    expect(isDark()).toBe(false);
    changeSystem(true);
    expect(isDark()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '☀' }));
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('lingoreader_theme')).toBe('light');
    changeSystem(false);
    changeSystem(true);
    expect(isDark()).toBe(false);
  });

  it.each(['dark', 'light'])('keeps saved %s preference over the system', theme => {
    localStorage.setItem('lingoreader_theme', theme);
    const changeSystem = mockSystemTheme(theme !== 'dark');
    render(<App />);
    expect(isDark()).toBe(theme === 'dark');
    changeSystem(true);
    changeSystem(false);
    expect(isDark()).toBe(theme === 'dark');
  });

  it('removes the system listener on unmount', () => {
    mockSystemTheme(false);
    const media = window.matchMedia('');
    const remove = vi.spyOn(media, 'removeEventListener');
    const { unmount } = render(<App />);
    unmount();
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
