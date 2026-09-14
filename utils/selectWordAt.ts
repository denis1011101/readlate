// Letters, digits and in-word apostrophes/hyphens ("don't", "e-book"); Unicode-aware
const WORD_CHAR = /[\p{L}\p{N}\p{M}'’-]/u;

/** Expands a caret position inside a text node to the surrounding word. */
export const wordRangeAt = (node: Text, offset: number): Range | null => {
  const text = node.data;
  let start = offset;
  let end = offset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;
  // Trim punctuation-only "words" like a lone hyphen or apostrophe
  if (!/[\p{L}\p{N}]/u.test(text.slice(start, end))) return null;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
};

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** Finds the text node and offset under a viewport point, across browsers. */
export const caretAt = (x: number, y: number): { node: Text; offset: number } | null => {
  const doc = document as CaretDocument;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) return { node: pos.offsetNode as Text, offset: pos.offset };
    return null;
  }
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      return { node: range.startContainer as Text, offset: range.startOffset };
    }
  }
  return null;
};

/**
 * Selects the word under the point if it lies inside `root`.
 * Returns true when a selection was made.
 */
export const selectWordAt = (x: number, y: number, root: Node): boolean => {
  const caret = caretAt(x, y);
  if (!caret || !root.contains(caret.node)) return false;
  const range = wordRangeAt(caret.node, caret.offset);
  if (!range) return false;
  // caretAt returns the nearest caret even for clicks on empty space, so make
  // sure the point actually lands on the word's glyphs
  const hit = Array.from(range.getClientRects())
    .some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  if (!hit) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const isText = (n: Node | null): n is Text => !!n && n.nodeType === Node.TEXT_NODE;

/**
 * Snaps the current selection outward to word boundaries (like a double-click
 * drag) and drops whitespace at either end. Returns true if it changed.
 */
export const snapSelectionToWords = (root: Node): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const { startContainer, endContainer } = range;
  if (!isText(startContainer) || !isText(endContainer)) return false;
  if (!root.contains(startContainer) || !root.contains(endContainer)) return false;

  let start = range.startOffset;
  let end = range.endOffset;
  const startText = startContainer.data;
  const endText = endContainer.data;
  const sameNode = startContainer === endContainer;

  // Shed leading/trailing whitespace & punctuation, then grow to word edges
  while (start < startText.length && !WORD_CHAR.test(startText[start]) && (!sameNode || start < end)) start++;
  while (end > 0 && !WORD_CHAR.test(endText[end - 1]) && (!sameNode || end > start)) end--;
  if (sameNode && start >= end) return false;
  while (start > 0 && WORD_CHAR.test(startText[start - 1])) start--;
  while (end < endText.length && WORD_CHAR.test(endText[end])) end++;

  if (start === range.startOffset && end === range.endOffset) return false;

  // Keep the drag direction so the browser continues extending from the right end
  const backwards = selection.anchorNode === endContainer && selection.anchorOffset === range.endOffset
    && !(selection.focusNode === endContainer && selection.focusOffset === range.endOffset);
  if (backwards) {
    selection.setBaseAndExtent(endContainer, end, startContainer, start);
  } else {
    selection.setBaseAndExtent(startContainer, start, endContainer, end);
  }
  return true;
};
