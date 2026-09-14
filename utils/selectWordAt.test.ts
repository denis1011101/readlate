import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectWordAt, wordRangeAt } from './selectWordAt';

const textNode = (s: string) => {
  const p = document.createElement('p');
  p.textContent = s;
  document.body.appendChild(p);
  return p.firstChild as Text;
};

afterEach(() => { document.body.innerHTML = ''; });

describe('wordRangeAt', () => {
  it('expands to the whole word from any offset inside it', () => {
    const node = textNode('Designing data-intensive applications');
    expect(wordRangeAt(node, 0)!.toString()).toBe('Designing');
    expect(wordRangeAt(node, 4)!.toString()).toBe('Designing');
    expect(wordRangeAt(node, 9)!.toString()).toBe('Designing');
    expect(wordRangeAt(node, 15)!.toString()).toBe('data-intensive');
    expect(wordRangeAt(node, 37)!.toString()).toBe('applications');
  });

  it("keeps apostrophes and handles non-Latin scripts", () => {
    expect(wordRangeAt(textNode("it doesn't work"), 6)!.toString()).toBe("doesn't");
    expect(wordRangeAt(textNode('слово ещё'), 2)!.toString()).toBe('слово');
  });

  it('returns null on whitespace or punctuation', () => {
    const node = textNode('one, two');
    expect(wordRangeAt(node, 4)).toBeNull();
    expect(wordRangeAt(node, 3)!.toString()).toBe('one');
  });
});

describe('selectWordAt', () => {
  it('selects the word under the point when it is inside root', () => {
    const node = textNode('hello brave world');
    vi.stubGlobal('document', Object.assign(document, {
      caretRangeFromPoint: () => { const r = document.createRange(); r.setStart(node, 7); r.collapse(true); return r; },
    }));
    expect(selectWordAt(10, 10, node.parentElement!)).toBe(true);
    expect(window.getSelection()!.toString()).toBe('brave');
  });

  it('ignores points outside root', () => {
    const node = textNode('hello');
    const other = document.createElement('div');
    vi.stubGlobal('document', Object.assign(document, {
      caretRangeFromPoint: () => { const r = document.createRange(); r.setStart(node, 1); r.collapse(true); return r; },
    }));
    expect(selectWordAt(10, 10, other)).toBe(false);
  });
});
