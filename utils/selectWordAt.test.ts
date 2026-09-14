import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectWordAt, snapSelectionToWords, wordRangeAt } from './selectWordAt';

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
  // jsdom has no layout: pretend every range occupies a 100x20 box at the origin
  const withRects = () => {
    Range.prototype.getClientRects = () => [{ left: 0, right: 100, top: 0, bottom: 20 }] as unknown as DOMRectList;
  };

  it('selects the word under the point when it is inside root', () => {
    withRects();
    const node = textNode('hello brave world');
    vi.stubGlobal('document', Object.assign(document, {
      caretRangeFromPoint: () => { const r = document.createRange(); r.setStart(node, 7); r.collapse(true); return r; },
    }));
    expect(selectWordAt(10, 10, node.parentElement!)).toBe(true);
    expect(window.getSelection()!.toString()).toBe('brave');
  });

  it('does not select when the point misses the word (click on empty space)', () => {
    withRects();
    const node = textNode('hello world');
    vi.stubGlobal('document', Object.assign(document, {
      caretRangeFromPoint: () => { const r = document.createRange(); r.setStart(node, 8); r.collapse(true); return r; },
    }));
    expect(selectWordAt(500, 10, node.parentElement!)).toBe(false);
    expect(window.getSelection()!.toString()).toBe('');
  });

  it('ignores points outside root', () => {
    withRects();
    const node = textNode('hello');
    const other = document.createElement('div');
    vi.stubGlobal('document', Object.assign(document, {
      caretRangeFromPoint: () => { const r = document.createRange(); r.setStart(node, 1); r.collapse(true); return r; },
    }));
    expect(selectWordAt(10, 10, other)).toBe(false);
  });
});

describe('snapSelectionToWords', () => {
  const select = (node: Text, a: number, b: number) => {
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.setBaseAndExtent(node, a, node, b);
    return sel;
  };

  it('grows a partial selection to whole words', () => {
    const node = textNode('This book summarizes the ideas');
    const sel = select(node, 2, 12); // "is book su"
    expect(snapSelectionToWords(node.parentElement!)).toBe(true);
    expect(sel.toString()).toBe('This book summarizes');
  });

  it('drops surrounding whitespace and punctuation', () => {
    const node = textNode('one, two three');
    const sel = select(node, 3, 9); // ", two "
    expect(snapSelectionToWords(node.parentElement!)).toBe(true);
    expect(sel.toString()).toBe('two');
  });

  it('keeps a backwards drag anchored at its end', () => {
    const node = textNode('alpha beta gamma');
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.setBaseAndExtent(node, 9, node, 2); // dragged from "bet|a" back into "al|pha"
    expect(snapSelectionToWords(node.parentElement!)).toBe(true);
    expect(sel.toString()).toBe('alpha beta');
    expect(sel.anchorOffset).toBe(10);
    expect(sel.focusOffset).toBe(0);
  });

  it('leaves whole-word selections and outside selections alone', () => {
    const node = textNode('alpha beta');
    select(node, 0, 5);
    expect(snapSelectionToWords(node.parentElement!)).toBe(false);
    const other = document.createElement('div');
    select(node, 1, 4);
    expect(snapSelectionToWords(other)).toBe(false);
  });
});
