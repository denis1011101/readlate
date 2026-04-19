import { GoogleGenAI, Modality } from "@google/genai";

// Initialize Gemini Client
// In a real production app, ensure API key handling is secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Translates English text to Russian using Gemini Flash.
 */
export const translateText = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following English text to Russian. Provide ONLY the translation, no explanations: "${text}"`,
    });
    
    return response.text || "Could not translate.";
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate. Check internet connection.");
  }
};

/**
 * Converts text to speech using Gemini TTS.
 * Returns a Base64 audio string or Blob URL.
 */
export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // 'Puck' is a good neutral voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data received");
    }

    // Convert Base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

// Fallback to browser native TTS if Gemini is offline
export const browserSpeak = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
};
