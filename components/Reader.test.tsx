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

it('does not leave silently when the final save fails', () => {
  vi.useFakeTimers();
  try {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const onBack = vi.fn();
    const book = { id: 'book', title: 'Book', content: 'Text', progress: 0, createdAt: 0 };
    const { container } = render(
      <Reader book={book} onBack={onBack} isDarkModeGlobal={false} toggleGlobalTheme={() => undefined} />,
    );
    const scroller = container.querySelector('.overflow-x-auto') as HTMLDivElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 1000 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 3000 });
    Object.defineProperty(scroller, 'scrollLeft', { value: 1000, writable: true });
    fireEvent.scroll(scroller);
    // Leave before the debounce fires: the flush fails, so we stay and warn
    fireEvent.click(screen.getByRole('button', { name: /Library/ }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText(/click Library again/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Library/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

const mountScroller = () => {
  const book = { id: 'book', title: 'Book', content: 'Text', progress: 0, createdAt: 0 };
  const { container } = render(
    <Reader book={book} onBack={() => undefined} isDarkModeGlobal={false} toggleGlobalTheme={() => undefined} />,
  );
  const scroller = container.querySelector('.overflow-x-auto') as HTMLDivElement;
  Object.defineProperty(scroller, 'clientWidth', { value: 1000 });
  Object.defineProperty(scroller, 'scrollWidth', { value: 5000 });
  let scrollLeft = 0;
  Object.defineProperty(scroller, 'scrollLeft', { get: () => scrollLeft, set: (v) => { scrollLeft = v; } });
  const scrollTo = vi.fn((opts: ScrollToOptions) => { scrollLeft = opts.left ?? scrollLeft; });
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
  return { scroller, scrollTo, setScrollLeft: (v: number) => { scrollLeft = v; } };
};

it('turns exactly one page per wheel gesture, ignoring trackpad inertia', () => {
  vi.useFakeTimers();
  try {
    const { scroller, scrollTo } = mountScroller();
    // A trackpad swipe: many events, decaying deltas
    for (const deltaX of [40, 30, 20, 10, 5, 2]) {
      fireEvent.wheel(scroller, { deltaX, deltaY: 0 });
      vi.advanceTimersByTime(30);
    }
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
    // After the stream goes quiet, the next gesture turns again (vertical wheel too)
    vi.advanceTimersByTime(250);
    fireEvent.wheel(scroller, { deltaX: 0, deltaY: 100 });
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 2000, behavior: 'smooth' });
    vi.advanceTimersByTime(250);
    fireEvent.wheel(scroller, { deltaX: -50, deltaY: 0 });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
  } finally {
    vi.useRealTimers();
  }
});

it('pages with the keyboard and snaps to page boundaries', () => {
  const { scrollTo, setScrollLeft } = mountScroller();
  setScrollLeft(1300); // mid-scroll: nearest page is 2 (left 1000)
  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 2000, behavior: 'smooth' });
  fireEvent.keyDown(document, { key: 'ArrowLeft' });
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
  fireEvent.keyDown(document, { key: ' ' });
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 2000, behavior: 'smooth' });
  setScrollLeft(0);
  fireEvent.keyDown(document, { key: 'PageUp' });
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
});

it('accumulates small trackpad deltas instead of locking on the first tiny event', () => {
  vi.useFakeTimers();
  try {
    const { scroller, scrollTo } = mountScroller();
    for (const deltaX of [1, 2, 12, 40, 20]) {
      fireEvent.wheel(scroller, { deltaX, deltaY: 0 });
      vi.advanceTimersByTime(20);
    }
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
  } finally {
    vi.useRealTimers();
  }
});

it('normalizes line- and page-based wheel deltas', () => {
  vi.useFakeTimers();
  try {
    const { scroller, scrollTo } = mountScroller();
    fireEvent.wheel(scroller, { deltaY: 3, deltaMode: 1 }); // three lines
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' });
    vi.advanceTimersByTime(250);
    fireEvent.wheel(scroller, { deltaY: -1, deltaMode: 2 }); // one page back
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  } finally {
    vi.useRealTimers();
  }
});

it('warns again on a later save failure after a successful save', () => {
  vi.useFakeTimers();
  try {
    let fail = true;
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (fail) throw new Error('QuotaExceededError');
      realSetItem.call(this, k, v);
    });
    const onBack = vi.fn();
    const book = { id: 'book', title: 'Book', content: 'Text', progress: 0, createdAt: 0 };
    const { container } = render(
      <Reader book={book} onBack={onBack} isDarkModeGlobal={false} toggleGlobalTheme={() => undefined} />,
    );
    const scroller = container.querySelector('.overflow-x-auto') as HTMLDivElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 1000 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 3000 });
    Object.defineProperty(scroller, 'scrollLeft', { value: 1000, writable: true });

    // First failure: warned, stays
    fireEvent.scroll(scroller);
    fireEvent.click(screen.getByRole('button', { name: /Library/ }));
    expect(onBack).not.toHaveBeenCalled();

    // Keep reading, storage recovers, save succeeds
    fail = false;
    fireEvent.scroll(scroller);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByText(/Progress not saved/)).toBeNull();

    // New failure on exit must warn again rather than leave
    fail = true;
    fireEvent.scroll(scroller);
    fireEvent.click(screen.getByRole('button', { name: /Library/ }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText(/click Library again/)).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
