// Minimal boundary for the PDF.js browser build loaded in index.html.
interface PdfTextItem { str: string }
interface PdfMarkedContent { type: string }
interface PdfDocument {
  numPages: number;
  getPage(page: number): Promise<{
    getTextContent(): Promise<{ items: Array<PdfTextItem | PdfMarkedContent> }>;
  }>;
}
declare const pdfjsLib: {
  getDocument(data: ArrayBuffer): { promise: Promise<PdfDocument> };
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text page by page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is PdfTextItem => 'str' in item)
        .map(item => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }

    return fullText;
  } catch (error) {
    console.error("Error reading PDF:", error);
    throw new Error("Could not parse PDF file.");
  }
};
