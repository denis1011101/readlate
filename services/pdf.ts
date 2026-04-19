// Simple wrapper around the global pdfjsLib loaded in index.html

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore - pdfjsLib is loaded via CDN globally
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text page by page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        // @ts-ignore
        .map((item) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }

    return fullText;
  } catch (error) {
    console.error("Error reading PDF:", error);
    throw new Error("Could not parse PDF file.");
  }
};
