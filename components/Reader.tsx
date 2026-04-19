import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, SelectionState, TranslationResult } from '../types';
import { updateBookProgress } from '../services/storage';
import Tooltip from './Tooltip';
import { translateText, generateSpeech, browserSpeak } from '../services/geminiService';

interface ReaderProps {
  book: Book;
  onBack: () => void;
  isDarkModeGlobal: boolean;
  toggleGlobalTheme: () => void;
}

const Reader: React.FC<ReaderProps> = ({ book, onBack, isDarkModeGlobal, toggleGlobalTheme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Settings
  const [fontSize, setFontSize] = useState(18);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Layout State
  const [columnStyle, setColumnStyle] = useState({ width: '100vw', gap: '0px', padding: '0px' });
  
  // Interaction State
  const [selection, setSelection] = useState<SelectionState>({
    text: '', top: 0, left: 0, show: false
  });
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Initialize Audio Context
  useEffect(() => {
    setAudioContext(new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }));
  }, []);

  // Calculate Layout (Pages & Margins)
  const calculateLayout = useCallback(() => {
    if (!containerRef.current) return;
    
    const clientWidth = containerRef.current.clientWidth;
    // const scrollWidth = containerRef.current.scrollWidth; // Don't use this for page count yet, as it changes with styles
    
    // Define Margins based on screen width
    // Mobile: 20px sides, Desktop: 80px sides (max-width constrained)
    const isMobile = clientWidth < 768;
    const margin = isMobile ? 24 : 80; // px
    
    const colWidth = clientWidth - (margin * 2);
    const gap = margin * 2;
    
    setColumnStyle({
      width: `${colWidth}px`,
      gap: `${gap}px`,
      padding: `0 ${margin}px` // Apply horizontal padding to container to align first page
    });

    // We need to wait for the DOM to update with new column styles before calculating total pages
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const newScrollWidth = containerRef.current.scrollWidth;
      // Rounding is important here
      const pages = Math.round(newScrollWidth / clientWidth);
      setTotalPages(Math.max(1, pages));
      
      // Restore progress
      if (book.progress > 0) {
        const targetPage = Math.max(1, Math.round((book.progress / 100) * pages));
        setCurrentPage(targetPage);
        // Instant scroll to position without animation
        containerRef.current.scrollLeft = (targetPage - 1) * clientWidth;
      }
    });
  }, [book.progress]);

  // Initial load and resize handler
  useEffect(() => {
    calculateLayout();
    const handleResize = () => {
      // Debounce slightly
      const timer = setTimeout(calculateLayout, 100);
      return () => clearTimeout(timer);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateLayout, fontSize, book.content]); // Recalculate when font or content changes

  // Handle Scroll (Page Turn Detection)
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      
      // Use clientWidth to determine page index directly
      const page = Math.round(scrollLeft / clientWidth) + 1;
      
      if (page !== currentPage) {
        setCurrentPage(page);
        
        // Calculate progress percentage
        // Avoid division by zero
        const maxScroll = scrollWidth - clientWidth;
        const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
        updateBookProgress(book.id, progress);
      }
    }
  }, [book.id, currentPage]);

  const turnPage = (direction: 'next' | 'prev') => {
    if (!containerRef.current) return;
    const clientWidth = containerRef.current.clientWidth;
    const newScrollLeft = containerRef.current.scrollLeft + (direction === 'next' ? clientWidth : -clientWidth);
    
    containerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  const handleSelection = useCallback(() => {
    const winSelection = window.getSelection();
    if (!winSelection || winSelection.isCollapsed || !containerRef.current) {
      return; 
    }

    const text = winSelection.toString().trim();
    if (text.length === 0) return;

    const range = winSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate relative position within the container
    setSelection({
      text,
      top: rect.top, // Use viewport coordinates directly for fixed/absolute positioning
      left: rect.left + (rect.width / 2),
      show: true
    });
    setTranslation(null); 
  }, []);

  const clearSelection = () => {
    const winSelection = window.getSelection();
    if (winSelection) winSelection.removeAllRanges();
    setSelection(prev => ({ ...prev, show: false }));
  };

  const handleTranslate = async (text: string) => {
    setTranslation({ original: text, translated: '', isLoading: true });
    try {
      const result = await translateText(text);
      setTranslation({ original: text, translated: result, isLoading: false });
    } catch (e) {
      setTranslation({ original: text, translated: '', isLoading: false, error: 'Offline or Error' });
    }
  };

  const handleSpeak = async (text: string) => {
    setIsPlaying(true);
    try {
      if (navigator.onLine && audioContext) {
        const audioBufferData = await generateSpeech(text);
        const audioBuffer = await audioContext.decodeAudioData(audioBufferData);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        source.onended = () => setIsPlaying(false);
      } else {
        browserSpeak(text);
        setIsPlaying(false);
      }
    } catch (e) {
      console.error("Speech failed", e);
      browserSpeak(text);
      setIsPlaying(false);
    }
  };

  // Toggle controls on click (unless selecting text)
  const handleContentClick = (e: React.MouseEvent) => {
    if (window.getSelection()?.toString()) return;
    setShowControls(!showControls);
  };

  // Theme Styles
  const themeClasses = isDarkModeGlobal 
    ? "bg-slate-900 text-slate-300" 
    : "bg-[#fdfbf7] text-slate-800";
    
  const headerClasses = isDarkModeGlobal
    ? "bg-slate-900/95 border-slate-700 text-slate-200"
    : "bg-white/95 border-gray-200 text-slate-800";

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${themeClasses} transition-colors duration-300`}>
      
      {/* Controls / Header */}
      <div 
        className={`absolute top-0 left-0 right-0 z-20 transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <header className={`flex items-center justify-between p-4 backdrop-blur-sm border-b shadow-sm ${headerClasses}`}>
          <button onClick={onBack} className="flex items-center hover:opacity-70 transition-opacity">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            <span className="hidden sm:inline">Library</span>
          </button>
          
          <div className="flex items-center gap-4">
             {/* Font Size Controls */}
             <div className="flex items-center gap-2 border rounded-lg px-2 py-1 border-current opacity-60">
                <button onClick={() => setFontSize(s => Math.max(14, s - 2))} className="text-xs font-bold px-2">A-</button>
                <span className="text-xs w-5 text-center">{fontSize}</span>
                <button onClick={() => setFontSize(s => Math.min(36, s + 2))} className="text-sm font-bold px-2">A+</button>
             </div>

             {/* Theme Toggle */}
             <button onClick={toggleGlobalTheme} className="p-2 rounded-full hover:bg-black/10 transition-colors">
               {isDarkModeGlobal ? (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
               )}
             </button>
          </div>
        </header>
      </div>

      {/* Reader Area (Paged View) */}
      <div 
        className="flex-1 relative h-full w-full flex flex-col justify-center"
        onClick={handleContentClick}
      >
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          onMouseUp={handleSelection}
          className="h-full w-full overflow-x-auto overflow-y-hidden no-scrollbar flex items-center"
          style={{
             scrollBehavior: 'smooth',
          }}
        >
          {/* 
            Paged Layout Logic:
            - The container scrolls horizontally.
            - We create columns equal to the page width (minus margins).
            - The Gap is set to exactly 2x Margin. 
              This effectively creates: [Margin][Text][Margin] | [Margin][Text][Margin]
            - Padding on this div aligns the *first* page correctly.
          */}
          <div 
             className="font-serif whitespace-pre-wrap"
             style={{
               columnWidth: columnStyle.width,
               columnGap: columnStyle.gap,
               padding: columnStyle.padding,
               columnFill: 'auto',
               // Calc height to account for header/footer (approx 160px total buffer)
               // This ensures text doesn't flow under the UI elements
               height: 'calc(100% - 160px)', 
               width: 'max-content',
               fontSize: `${fontSize}px`,
               lineHeight: '1.7',
               textAlign: 'justify'
             }}
          >
             {book.content}
          </div>
        </div>

        {/* Click zones for page turning (Desktop/Mouse) */}
        <div className="absolute inset-y-0 left-0 w-12 md:w-20 cursor-pointer hover:bg-black/5 z-0 hidden md:block" title="Previous Page" onClick={(e) => { e.stopPropagation(); turnPage('prev'); }}></div>
        <div className="absolute inset-y-0 right-0 w-12 md:w-20 cursor-pointer hover:bg-black/5 z-0 hidden md:block" title="Next Page" onClick={(e) => { e.stopPropagation(); turnPage('next'); }}></div>
      </div>

      {/* Footer / Progress */}
      <div 
        className={`absolute bottom-0 left-0 right-0 p-3 text-center text-xs z-20 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'} ${isDarkModeGlobal ? 'text-slate-500 bg-slate-900/90' : 'text-slate-400 bg-white/90'} border-t ${isDarkModeGlobal ? 'border-slate-800' : 'border-gray-100'}`}
      >
        Page {currentPage} of {totalPages} • {Math.round(book.progress)}%
      </div>

      <Tooltip 
        selection={selection}
        onTranslate={handleTranslate}
        onSpeak={handleSpeak}
        onClose={clearSelection}
        translation={translation}
        isPlaying={isPlaying}
      />
    </div>
  );
};

export default Reader;