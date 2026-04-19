import { Book } from '../types';

const STORAGE_KEY = 'lingoreader_books';

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
  return data ? JSON.parse(data) : [];
};

export const deleteBook = (id: string): void => {
  const books = getBooks().filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
};

export const updateBookProgress = (id: string, progress: number): void => {
  const books = getBooks();
  const index = books.findIndex(b => b.id === id);
  if (index !== -1) {
    books[index].progress = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }
};