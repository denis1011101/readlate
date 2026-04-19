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

export interface TranslationResult {
  original: string;
  translated: string;
  isLoading: boolean;
  error?: string;
}
