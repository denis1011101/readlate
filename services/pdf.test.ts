import { describe, expect, it, vi } from 'vitest';
import { extractTextFromPdf } from './pdf';

function pdfFile() {
  const file = new File(['pdf bytes'], 'book.pdf', { type: 'application/pdf' });
  const bytes = new ArrayBuffer(8);
  // jsdom does not implement Blob.arrayBuffer.
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
  return { file, bytes };
}

describe('PDF text extraction', () => {
  it('keeps page order and skips non-text marked-content records', async () => {
    const { file, bytes } = pdfFile();
    const getPage = vi.fn(async (page: number) => ({
      getTextContent: async () => ({
        items: [{ type: 'beginMarkedContent' }, { str: `Page ${page}` }, { str: 'text' }],
      }),
    }));
    const getDocument = vi.fn(() => ({ promise: Promise.resolve({ numPages: 2, getPage }) }));
    vi.stubGlobal('pdfjsLib', { getDocument });
    expect(await extractTextFromPdf(file)).toBe('Page 1 text\n\nPage 2 text\n\n');
    expect(getDocument).toHaveBeenCalledWith(bytes);
    expect(getPage.mock.calls).toEqual([[1], [2]]);
  });

  it('reports an unreadable PDF as a parsing error', async () => {
    const { file } = pdfFile();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('pdfjsLib', {
      getDocument: () => ({ promise: Promise.reject(new Error('Invalid PDF')) }),
    });
    await expect(extractTextFromPdf(file)).rejects.toThrow('Could not parse PDF file.');
  });
});
