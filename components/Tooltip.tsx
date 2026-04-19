import React, { useEffect, useRef } from 'react';
import { SelectionState, TranslationResult } from '../types';

interface TooltipProps {
  selection: SelectionState;
  onTranslate: (text: string) => void;
  onSpeak: (text: string) => void;
  onClose: () => void;
  translation: TranslationResult | null;
  isPlaying: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ 
  selection, 
  onTranslate, 
  onSpeak, 
  onClose,
  translation,
  isPlaying
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!selection.show) return null;

  // Calculate position to keep inside viewport
  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${selection.top}px`,
    left: `${selection.left}px`,
    transform: 'translate(-50%, -100%) translateY(-10px)',
    zIndex: 50,
  };

  return (
    <div 
      ref={tooltipRef}
      style={style} 
      className="bg-gray-900 text-white rounded-lg shadow-xl p-3 w-64 flex flex-col gap-2 animate-fade-in border border-gray-700"
    >
      <div className="text-sm font-medium border-b border-gray-700 pb-2 mb-1 line-clamp-2 italic text-gray-300">
        "{selection.text}"
      </div>

      {translation ? (
        <div className="bg-gray-800 rounded p-2 text-sm">
          {translation.isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Translating...
            </div>
          ) : translation.error ? (
            <span className="text-red-400">{translation.error}</span>
          ) : (
            <span className="text-green-300 font-serif">{translation.translated}</span>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button 
            onClick={() => onTranslate(selection.text)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 px-3 rounded transition-colors"
          >
            Translate
          </button>
          <button 
            onClick={() => onSpeak(selection.text)}
            disabled={isPlaying}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-xs py-1.5 px-3 rounded transition-colors flex items-center justify-center gap-1"
          >
             {isPlaying ? 'Playing...' : 'Listen'}
          </button>
        </div>
      )}
      
      {/* Down Arrow */}
      <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900"></div>
    </div>
  );
};

export default Tooltip;