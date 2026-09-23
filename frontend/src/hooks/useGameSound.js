import { useCallback, useEffect, useRef } from 'react';

const CUES = Object.freeze({
  deal: [440, 0.045],
  chip: [660, 0.04],
  turn: [520, 0.08],
  win: [784, 0.14],
});

export function useGameSound({ muted = false } = {}) {
  const contextRef = useRef(null);

  useEffect(() => () => contextRef.current?.close?.(), []);

  return useCallback(cue => {
    if (muted || !CUES[cue]) return;
    const AudioContextImpl = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextImpl) return;
    try {
      const context = contextRef.current ?? new AudioContextImpl();
      contextRef.current = context;
      const [frequency, duration] = CUES[cue];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Sound is optional and browser autoplay rules can reject it.
    }
  }, [muted]);
}
