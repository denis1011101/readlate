import React, { useRef, useState } from 'react';
import { Book, formatProgress } from '../types';
import { deleteBook, saveBook } from '../services/storage';
import { extractTextFromPdf } from '../services/pdf';

interface LibraryProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onRefresh: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Library: React.FC<LibraryProps> = ({ books, onSelectBook, onRefresh, isDarkMode, toggleTheme }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      let content = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        content = await extractTextFromPdf(file);
      } else {
        // Fallback for text files if somehow selected
        content = await file.text();
      }

      if (content) {
        saveBook(file.name, content);
        onRefresh();
      } else {
        alert("Could not extract text from this file.");
      }
    } catch (e) {
      alert("Error processing file. Ensure it contains selectable text.");
      console.error(e);
    } finally {
      setIsProcessing(false);
      event.target.value = ''; // Reset input
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(confirm("Delete this book?")) {
      deleteBook(id);
      onRefresh();
    }
  };

  // Dynamic classes based on theme
  const bgClass = isDarkMode ? "bg-slate-950" : "bg-slate-50";
  const textMain = isDarkMode ? "text-slate-100" : "text-slate-900";
  const textSub = isDarkMode ? "text-slate-400" : "text-slate-500";
  const cardBg = isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";

  return (
    <div className={`min-h-screen p-6 md:p-12 transition-colors duration-300 ${bgClass}`}>
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className={`text-3xl font-bold mb-2 ${textMain}`}>My Library</h1>
            <p className={textSub}>Local-first reading. Upload PDF files.</p>
          </div>
          
          <div className="flex gap-3">
            <button 
               onClick={toggleTheme}
               className={`p-2.5 rounded-lg border transition-colors ${isDarkMode ? 'border-slate-700 text-yellow-400 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-white'}`}
            >
               {isDarkMode ? '☀' : '☾'}
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {isProcessing ? (
                <span className="animate-pulse">Processing...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  Upload Book
                </>
              )}
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf, application/pdf" 
            className="hidden" 
          />
        </header>

        {books.length === 0 ? (
          <div className={`${cardBg} rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[400px]`}>
            <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} p-4 rounded-full mb-4`}>
               <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h3 className={`text-lg font-medium mb-1 ${textMain}`}>No books yet</h3>
            <p className={`${textSub} max-w-xs mx-auto mb-6`}>Upload a PDF file to start reading.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map(book => (
              <div 
                key={book.id}
                onClick={() => onSelectBook(book)}
                className={`group ${cardBg} rounded-xl shadow-sm hover:shadow-md border p-6 cursor-pointer transition-all relative overflow-hidden`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-14 bg-indigo-100 border border-indigo-200 rounded shadow-inner flex items-center justify-center">
                    <span className="text-indigo-800 text-xs font-serif font-bold">PDF</span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, book.id)}
                    className="text-slate-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50/10 transition-colors"
                  >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
                
                <h3 className={`font-serif font-bold text-lg mb-2 line-clamp-2 h-14 ${textMain}`}>{book.title}</h3>
                <p className={`${textSub} text-xs mb-4`}>Added {new Date(book.createdAt).toLocaleDateString()}</p>
                
                <div className={`w-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-full h-1.5 mb-1`}>
                  <div 
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: book.progress > 0 ? `${Math.max(1, book.progress)}%` : 0 }}
                  ></div>
                </div>
                <div className="text-right text-xs text-indigo-500 font-medium">
                  {formatProgress(book.progress)} complete
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;