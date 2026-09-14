import React, { useState } from 'react';
import Library from './components/Library';
import Reader from './components/Reader';
import { Book } from './types';
import { getBooks } from './services/storage';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [books, setBooks] = useState<Book[]>(getBooks);
  const { isDarkMode, toggleTheme } = useTheme();

  const refreshLibrary = () => {
    setBooks(getBooks());
  };

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
  };

  const handleBack = () => {
    // The reader flushes its reading position before calling this, so the
    // library can be re-read synchronously to show updated progress
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