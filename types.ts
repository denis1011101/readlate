export interface Book {
  id: string;
  title: string;
  content: string;
  progress: number; // 0 to 100 representing scroll percentage
  createdAt: number;
}

export interface SelectionState {
  text: string;
  top: number;
  left: number;
  show: boolean;
}

/** Human-readable percent: long books move slowly, so keep tenths below 10% */
export const formatProgress = (progress: number): string => {
  if (progress <= 0) return '0%';
  if (progress >= 99.5) return '100%';
  if (progress < 10) return `${Math.max(0.1, Math.round(progress * 10) / 10)}%`;
  return `${Math.round(progress)}%`;
};

export interface TranslationResult {
  original: string;
  translated: string;
  isLoading: boolean;
  error?: string;
}
