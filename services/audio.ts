export interface PcmAudio {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
}

/** Parses "audio/L16;codec=pcm;rate=24000" style MIME types from Gemini TTS. */
export const parsePcmMimeType = (mimeType: string | undefined): { sampleRate: number; channels: number } => {
  const rate = /rate=(\d+)/.exec(mimeType ?? '')?.[1];
  const channels = /channels=(\d+)/.exec(mimeType ?? '')?.[1];
  return { sampleRate: rate ? Number(rate) : 24000, channels: channels ? Number(channels) : 1 };
};

/**
 * Gemini returns raw 16-bit little-endian PCM, which decodeAudioData cannot
 * read (it expects a container like WAV/MP3), so build the AudioBuffer by hand.
 */
export const pcmToAudioBuffer = (context: BaseAudioContext, audio: PcmAudio): AudioBuffer => {
  const { data, sampleRate, channels } = audio;
  const samples = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
  const frames = Math.floor(samples.length / channels);
  const buffer = context.createBuffer(channels, Math.max(1, frames), sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const channel = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      channel[i] = samples[i * channels + ch] / 32768;
    }
    buffer.copyToChannel(channel, ch);
  }
  return buffer;
};
