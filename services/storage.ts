import { Book } from '../types';

const STORAGE_KEY = 'lingoreader_books';
// Progress lives in its own small key so page turns don't rewrite book contents
const PROGRESS_KEY = 'lingoreader_progress';

const getProgressMap = (): Record<string, number> => {
  try {
    const data = localStorage.getItem(PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

export const saveBook = (title: string, content: string): Book => {
  const books = getBooks();
  // Clean file extension (pdf or txt)
  const cleanTitle = title.replace(/\.(txt|pdf)$/i, '');
  
  const newBook: Book = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    content,
    progress: 0,
    createdAt: Date.now(),
  };
  
  const updatedBooks = [newBook, ...books];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBooks));
  } catch (e) {
    console.error("Storage quota exceeded", e);
    alert("Local storage full. Delete some books.");
  }
  return newBook;
};

export const getBooks = (): Book[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  const books: Book[] = data ? JSON.parse(data) : [];
  const progress = getProgressMap();
  return books.map(b => ({ ...b, progress: progress[b.id] ?? b.progress ?? 0 }));
};

export const deleteBook = (id: string): void => {
  const books = getBooks().filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  const progress = getProgressMap();
  delete progress[id];
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
};

export const updateBookProgress = (id: string, progress: number): void => {
  const map = getProgressMap();
  map[id] = progress;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Could not save reading progress", e);
  }
};