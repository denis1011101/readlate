import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Reader from './Reader';

vi.mock('../services/geminiService', () => ({
  translateText: vi.fn(),
  generateSpeech: vi.fn(async () => new ArrayBuffer(0)),
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
    decodeAudioData = vi.fn(async () => ({}));
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
  range.selectNodeContents(screen.getByText(book.content));
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
