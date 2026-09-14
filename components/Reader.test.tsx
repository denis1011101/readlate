import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Reader from './Reader';

vi.mock('../services/geminiService', () => ({
  translateText: vi.fn(),
  generateSpeech: vi.fn(async () => ({ data: new Int16Array([0, 16384, -16384]).buffer, sampleRate: 24000, channels: 1 })),
  browserSpeak: vi.fn(),
}));

it('creates audio on Listen and releases the context when leaving the reader', async () => {
  const resume = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  const start = vi.fn();
  const AudioContextMock = vi.fn(class {
    resume = resume;
    close = close;
    destination = {};
    createBuffer = vi.fn(() => ({ copyToChannel: vi.fn() }));
    createBufferSource = () => ({ buffer: null, connect: vi.fn(), start, onended: null });
  });
  vi.stubGlobal('AudioContext', AudioContextMock);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const book = { id: 'book', title: 'Book', content: 'Select these words', progress: 0, createdAt: 0 };
  const { unmount } = render(
    <StrictMode>
      <Reader book={book} onBack={() => undefined} isDarkModeGlobal={false} toggleGlobalTheme={() => undefined} />
    </StrictMode>,
  );
  expect(AudioContextMock).not.toHaveBeenCalled();
  const range = document.createRange();
  range.selectNodeContents(await screen.findByText(book.content));
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({ top: 100, left: 100, width: 100 }),
  });
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  fireEvent.mouseUp(screen.getByText(book.content));
  fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  expect(AudioContextMock).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledTimes(1);
  unmount();
  expect(close).toHaveBeenCalledTimes(1);
});

it('saves the position where scrolling settles, not a mid-flight one', () => {
  vi.useFakeTimers();
  try {
    localStorage.setItem('lingoreader_books', JSON.stringify([
      { id: 'book', title: 'Book', content: 'Text', progress: 0, createdAt: 0 },
    ]));
    const book = { id: 'book', title: 'Book', content: 'Text', progress: 0, createdAt: 0 };
    const { container, unmount } = render(
      <Reader book={book} onBack={() => undefined} isDarkModeGlobal={false} toggleGlobalTheme={() => undefined} />,
    );
    const scroller = container.querySelector('.overflow-x-auto') as HTMLDivElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 1000 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 10000 });
    let scrollLeft = 0;
    Object.defineProperty(scroller, 'scrollLeft', { get: () => scrollLeft, set: (v) => { scrollLeft = v; } });

    // Smooth scroll from page 9 to the last page: several intermediate events
    for (const left of [8000, 8300, 8600, 8900, 9000]) {
      scrollLeft = left;
      fireEvent.scroll(scroller);
    }
    act(() => { vi.advanceTimersByTime(200); });

    const saved = JSON.parse(localStorage.getItem('lingoreader_progress')!);
    expect(saved.book).toBe(100);
    expect(screen.getByText(/100%/)).toBeTruthy();

    // A save still pending on exit is flushed
    scrollLeft = 4500;
    fireEvent.scroll(scroller);
    unmount();
    expect(JSON.parse(localStorage.getItem('lingoreader_progress')!).book).toBe(50);
  } finally {
    vi.useRealTimers();
  }
});

it('tells the reader when progress could not be saved', () => {
  vi.useFakeTimers();
  try {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const book = { id: 'book', title: 'Book', content: 'Text', progress: 0, createdAt: 0 };
    const { container } = render(
      <Reader book={book} onBack={() => undefined} isDarkModeGlobal={false} toggleGlobalTheme={() => undefined} />,
    );
    const scroller = container.querySelector('.overflow-x-auto') as HTMLDivElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 1000 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 3000 });
    Object.defineProperty(scroller, 'scrollLeft', { value: 1000, writable: true });
    fireEvent.scroll(scroller);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText(/Progress not saved/)).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
