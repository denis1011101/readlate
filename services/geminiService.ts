import { GoogleGenAI, Modality } from "@google/genai";
import { parsePcmMimeType, PcmAudio } from "./audio";

// Initialize Gemini Client
// In a real production app, ensure API key handling is secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Translates text into the given language using Gemini Flash; the source
 * language is detected by the model.
 */
export const translateText = async (text: string, targetLanguage: string = 'Russian'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following text to ${targetLanguage}. Provide ONLY the translation, no explanations: "${text}"`,
    });
    
    return response.text || "Could not translate.";
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate. Check internet connection.");
  }
};

/**
 * Converts text to speech using Gemini TTS.
 * Returns raw 16-bit PCM plus its sample rate (see pcmToAudioBuffer).
 */
export const generateSpeech = async (text: string): Promise<PcmAudio> => {
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

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const base64Audio = inlineData?.data;
    
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
    return { data: bytes.buffer, ...parsePcmMimeType(inlineData?.mimeType) };

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
