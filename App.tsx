import React, { useState, useEffect } from 'react';
import Library from './components/Library';
import Reader from './components/Reader';
import { Book } from './types';
import { getBooks } from './services/storage';

const App: React.FC = () => {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme preference: saved choice wins, otherwise follow the system
  useEffect(() => {
    const savedTheme = localStorage.getItem('lingoreader_theme');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setIsDarkMode(savedTheme === 'dark');
      return;
    }
    setIsDarkMode(media.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Keep the document itself in sync so body background, scrollbars and
  // native controls match the theme (avoids a white flash around the app)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDarkMode ? '#020617' : '#f8fafc');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('lingoreader_theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  const refreshLibrary = () => {
    setBooks(getBooks());
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
  };

  const handleBack = () => {
    // Refresh library to show updated progress for the book we just closed
    refreshLibrary();
    setCurrentBook(null);
  };

  return (
    <div className={`antialiased ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} min-h-screen`}>
      {currentBook ? (
        <Reader 
          book={currentBook} 
          onBack={handleBack} 
          isDarkModeGlobal={isDarkMode}
          toggleGlobalTheme={toggleTheme}
        />
      ) : (
        <Library 
          books={books} 
          onSelectBook={handleSelectBook} 
          onRefresh={refreshLibrary} 
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  );
};

export default App;