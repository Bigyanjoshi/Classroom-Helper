let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playTone(
  freq: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  gainVal = 0.08,
  delayMs = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + durationMs / 1000 + 0.02);
}

export type FeedbackCue = 'flip' | 'confirm' | 'shuffle' | 'undo' | 'complete';

export function playSoundEffect(cue: FeedbackCue, enabled: boolean): void {
  if (!enabled) return;
  try {
    if (cue === 'flip') {
      playTone(440, 90, 'triangle', 0.06, 0);
      playTone(587.33, 110, 'sine', 0.07, 45);
    } else if (cue === 'confirm') {
      playTone(523.25, 110, 'triangle', 0.07, 0);
      playTone(659.25, 130, 'triangle', 0.07, 65);
      playTone(783.99, 180, 'sine', 0.08, 130);
    } else if (cue === 'shuffle') {
      playTone(320, 50, 'triangle', 0.04, 0);
      playTone(380, 50, 'triangle', 0.04, 60);
      playTone(350, 50, 'triangle', 0.04, 120);
    } else if (cue === 'undo') {
      playTone(493.88, 90, 'sine', 0.06, 0);
      playTone(392.0, 120, 'sine', 0.06, 60);
    } else if (cue === 'complete') {
      playTone(523.25, 140, 'triangle', 0.07, 0);
      playTone(659.25, 140, 'triangle', 0.07, 80);
      playTone(783.99, 140, 'triangle', 0.07, 160);
      playTone(1046.5, 280, 'sine', 0.08, 240);
    }
  } catch {
    // Audio playback can fail gracefully if blocked by browser autoplay policy
  }
}

export function triggerHapticFeedback(cue: FeedbackCue, enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    if (cue === 'flip') {
      navigator.vibrate(14);
    } else if (cue === 'confirm') {
      navigator.vibrate([18, 28, 24]);
    } else if (cue === 'shuffle') {
      navigator.vibrate([10, 20, 10]);
    } else if (cue === 'undo') {
      navigator.vibrate(18);
    } else if (cue === 'complete') {
      navigator.vibrate([22, 30, 28]);
    }
  } catch {
    // Haptic vibration may be unavailable or ignored by host OS
  }
}
