import { describe, expect, it, vi } from 'vitest';
import { deleteBook, getBooks, saveBook, updateBookProgress } from './storage';

describe('library persistence', () => {
  it('starts empty and persists new books first without losing their text', () => {
    expect(getBooks()).toEqual([]);
    const first = saveBook('First.PDF', 'First page\nSecond page');
    const second = saveBook('Second.txt', 'Other text');
    expect(getBooks()).toEqual([second, first]);
    expect(first.title).toBe('First');
    expect(second.title).toBe('Second');
    expect(first.progress).toBe(0);
    expect(second.id).not.toBe(first.id);
  });

  it('updates only the selected book and preserves its content', () => {
    const first = saveBook('First.pdf', 'First content');
    const second = saveBook('Second.pdf', 'Second content');
    updateBookProgress(first.id, 65);
    expect(getBooks()).toEqual([second, { ...first, progress: 65 }]);
    updateBookProgress('missing', 20);
    expect(getBooks()).toHaveLength(2);
  });

  it('writes progress separately without rewriting book text', () => {
    const book = saveBook('Large.pdf', 'Large book content');
    const originalBooks = localStorage.getItem('lingoreader_books');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    updateBookProgress(book.id, 0.3);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('lingoreader_progress', expect.any(String));
    expect(localStorage.getItem('lingoreader_books')).toBe(originalBooks);
    expect(getBooks()[0].progress).toBe(0.3);
  });

  it('preserves legacy progress until an override is saved', () => {
    const book = saveBook('Legacy.pdf', 'Text');
    localStorage.setItem('lingoreader_books', JSON.stringify([{ ...book, progress: 42 }]));
    expect(getBooks()[0].progress).toBe(42);
    updateBookProgress(book.id, 0);
    expect(getBooks()[0].progress).toBe(0);
  });

  it('falls back to legacy progress if the progress JSON is malformed', () => {
    const book = saveBook('Legacy.pdf', 'Text');
    localStorage.setItem('lingoreader_books', JSON.stringify([{ ...book, progress: 42 }]));
    localStorage.setItem('lingoreader_progress', '{broken');
    expect(getBooks()[0].progress).toBe(42);
  });

  it('deletes only the selected book', () => {
    const first = saveBook('First.pdf', 'First');
    const second = saveBook('Second.pdf', 'Second');
    updateBookProgress(first.id, 12);
    updateBookProgress(second.id, 34);
    deleteBook(first.id);
    expect(JSON.parse(localStorage.getItem('lingoreader_progress')!)).toEqual({ [second.id]: 34 });
    expect(getBooks()).toEqual([{ ...second, progress: 34 }]);
    deleteBook('missing');
    expect(getBooks()).toEqual([{ ...second, progress: 34 }]);
  });
});
