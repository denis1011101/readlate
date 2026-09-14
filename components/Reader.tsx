import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, SelectionState, TranslationResult, formatProgress } from '../types';
import { updateBookProgress } from '../services/storage';
import Tooltip from './Tooltip';
import { translateText, generateSpeech, browserSpeak } from '../services/geminiService';
import { pcmToAudioBuffer } from '../services/audio';
import { selectWordAt, snapSelectionToWords } from '../utils/selectWordAt';

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
  // Live progress; `book.progress` is only the value at open time
  const [progress, setProgress] = useState(book.progress);
  const progressRef = useRef(book.progress);
  const [progressSaveFailed, setProgressSaveFailed] = useState(false);
  const [leaveAnyway, setLeaveAnyway] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Layout State
  const [columnStyle, setColumnStyle] = useState({ width: '100vw', gap: '0px', padding: '0px' });
  
  // Interaction State
  const [selection, setSelection] = useState<SelectionState>({
    text: '', top: 0, left: 0, show: false
  });
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // Laying a whole book out in CSS columns can block for seconds, so paint the
  // chrome and a spinner first, mount the text after that frame, and hide the
  // spinner once the page count is known
  const [contentMounted, setContentMounted] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setContentMounted(true), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Create audio only on a user gesture, and release it when leaving the reader.
  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(console.error);
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
      setIsLayoutReady(true);
      
      // Restore progress (also keeps the place on resize / font change)
      if (progressRef.current > 0) {
        // Inverse of the formula in handleScroll: progress = (page - 1) / (pages - 1)
        const targetPage = Math.min(pages, Math.max(1, Math.round((progressRef.current / 100) * (pages - 1)) + 1));
        setCurrentPage(targetPage);
        // Instant scroll to position without animation
        containerRef.current.scrollLeft = (targetPage - 1) * clientWidth;
      }
    });
  }, []);

  // Initial load and resize handler
  useEffect(() => {
    if (!contentMounted) return;
    calculateLayout();
    const handleResize = () => {
      // Debounce slightly
      const timer = setTimeout(calculateLayout, 100);
      return () => clearTimeout(timer);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateLayout, fontSize, book.content, contentMounted]); // Recalculate when font or content changes

  const persistProgress = useCallback((value: number) => {
    setProgress(value);
    setProgressSaveFailed(!updateBookProgress(book.id, value));
  }, [book.id]);

  // Handle Scroll (Page Turn Detection). Smooth scrolling fires many events
  // mid-flight, so the page counter updates immediately but the position is
  // saved only once scrolling has settled (or on exit, see below).
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const page = Math.round(scrollLeft / clientWidth) + 1;
    if (page !== currentPage) setCurrentPage(page);

    const maxScroll = scrollWidth - clientWidth;
    progressRef.current = maxScroll > 0 ? Math.min(100, (scrollLeft / maxScroll) * 100) : 0;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistProgress(progressRef.current);
    }, 150);
  }, [currentPage, persistProgress]);

  // Flush a pending save when leaving the reader; true if nothing was lost
  const flushProgress = useCallback((): boolean => {
    if (!persistTimerRef.current) return !progressSaveFailed;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
    return updateBookProgress(book.id, progressRef.current);
  }, [book.id, progressSaveFailed]);
  useEffect(() => () => { flushProgress(); }, [flushProgress]);

  // If the position can't be saved, say so and let a second click leave anyway
  const handleBack = () => {
    if (flushProgress() || leaveAnyway) {
      onBack();
      return;
    }
    setProgressSaveFailed(true);
    setLeaveAnyway(true);
  };

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
    if (textRef.current) snapSelectionToWords(textRef.current);
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
    } catch {
      setTranslation({ original: text, translated: '', isLoading: false, error: 'Offline or Error' });
    }
  };

  const handleSpeak = async (text: string) => {
    setIsPlaying(true);
    try {
      if (navigator.onLine) {
        const AudioContextClass = window.AudioContext
          || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio is unavailable');
        const audioContext = audioContextRef.current
          ?? new AudioContextClass({ sampleRate: 24000 });
        audioContextRef.current = audioContext;
        await audioContext.resume();
        const audioBuffer = pcmToAudioBuffer(audioContext, await generateSpeech(text));
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

  // While the mouse is down inside the text, keep the growing selection snapped to words
  useEffect(() => {
    const onSelectionChange = () => {
      if (isDraggingRef.current && textRef.current) snapSelectionToWords(textRef.current);
    };
    const onMouseUp = () => { isDraggingRef.current = false; };
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Single click on a word selects it and opens the tooltip; a drag selection
  // is already handled on mouseup, and clicks on whitespace fall through to
  // the controls toggle below
  const handleTextClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.getSelection()?.toString()) return;
    if (selectWordAt(e.clientX, e.clientY, e.currentTarget)) {
      e.stopPropagation();
      handleSelection();
    }
  };

  // Toggle controls on click (unless selecting text)
  const handleContentClick = () => {
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
          <button onClick={handleBack} className="flex items-center hover:opacity-70 transition-opacity">
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
             ref={textRef}
             className="font-serif whitespace-pre-wrap"
             onClick={handleTextClick}
             onMouseDown={() => { isDraggingRef.current = true; }}
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
             {contentMounted ? book.content : null}
          </div>
        </div>

        {!isLayoutReady && (
          <div
            role="status"
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 ${isDarkModeGlobal ? 'bg-slate-900 text-slate-400' : 'bg-[#fdfbf7] text-slate-500'}`}
          >
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">Opening book…</span>
          </div>
        )}

        {/* Click zones for page turning (Desktop/Mouse) */}
        <div className="absolute inset-y-0 left-0 w-12 md:w-20 cursor-pointer hover:bg-black/5 z-0 hidden md:block" title="Previous Page" onClick={(e) => { e.stopPropagation(); turnPage('prev'); }}></div>
        <div className="absolute inset-y-0 right-0 w-12 md:w-20 cursor-pointer hover:bg-black/5 z-0 hidden md:block" title="Next Page" onClick={(e) => { e.stopPropagation(); turnPage('next'); }}></div>
      </div>

      {/* Footer / Progress */}
      <div 
        className={`absolute bottom-0 left-0 right-0 p-3 text-center text-xs z-20 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'} ${isDarkModeGlobal ? 'text-slate-500 bg-slate-900/90' : 'text-slate-400 bg-white/90'} border-t ${isDarkModeGlobal ? 'border-slate-800' : 'border-gray-100'}`}
      >
        Page {currentPage} of {totalPages} • {formatProgress(progress)}
        {progressSaveFailed && (
          <span className="ml-2 text-red-500">
            • Progress not saved: browser storage is full{leaveAnyway && ' — click Library again to leave anyway'}
          </span>
        )}
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