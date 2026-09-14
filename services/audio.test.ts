import { describe, expect, it, vi } from 'vitest';
import { parsePcmMimeType, pcmToAudioBuffer } from './audio';

describe('parsePcmMimeType', () => {
  it('reads the sample rate Gemini reports', () => {
    expect(parsePcmMimeType('audio/L16;codec=pcm;rate=24000')).toEqual({ sampleRate: 24000, channels: 1 });
    expect(parsePcmMimeType('audio/L16;rate=16000;channels=2')).toEqual({ sampleRate: 16000, channels: 2 });
  });

  it('falls back to 24 kHz mono', () => {
    expect(parsePcmMimeType(undefined)).toEqual({ sampleRate: 24000, channels: 1 });
  });
});

describe('pcmToAudioBuffer', () => {
  it('converts 16-bit PCM to float samples at the reported rate', () => {
    const copyToChannel = vi.fn();
    const createBuffer = vi.fn(() => ({ copyToChannel }));
    const context = { createBuffer } as unknown as BaseAudioContext;
    const data = new Int16Array([0, 16384, -32768, 32767]).buffer;

    pcmToAudioBuffer(context, { data, sampleRate: 24000, channels: 1 });

    expect(createBuffer).toHaveBeenCalledWith(1, 4, 24000);
    const samples = copyToChannel.mock.calls[0][0] as Float32Array;
    expect(Array.from(samples)).toEqual([0, 0.5, -1, 32767 / 32768]);
    expect(copyToChannel.mock.calls[0][1]).toBe(0);
  });

  it('ignores a trailing odd byte', () => {
    const createBuffer = vi.fn(() => ({ copyToChannel: vi.fn() }));
    const context = { createBuffer } as unknown as BaseAudioContext;
    pcmToAudioBuffer(context, { data: new Uint8Array(5).buffer, sampleRate: 24000, channels: 1 });
    expect(createBuffer).toHaveBeenCalledWith(1, 2, 24000);
  });
});
