import type { SoundPreset } from '../types/classroom';

class ClassroomAudioEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a crisp tick sound synchronized with each step of the draw animation.
   * @param preset Sound style ('marimba' | 'wheel' | 'muted')
   * @param progress Normalized animation progress (0 = start, 1 = near stop)
   */
  public playTick(preset: SoundPreset, progress: number) {
    if (preset === 'muted') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (preset === 'marimba') {
      // Warm wooden marimba pentatonic pitch rise as draw approaches final stop
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const idx = Math.min(scale.length - 1, Math.floor(progress * scale.length));
      const baseFreq = scale[idx] * (0.98 + Math.random() * 0.04);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.065);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else {
      // Crisp mechanical peg click for prize wheel feel
      const pitch = 900 + progress * 420;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.03);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.042);
    }
  }

  /**
   * Plays a celebratory major triad fanfare when a student is selected.
   */
  public playWinnerFanfare(preset: SoundPreset) {
    if (preset === 'muted') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Bright C-major 9th arpeggio: C5 -> E5 -> G5 -> C6
    const notes =
      preset === 'marimba'
        ? [
            { freq: 523.25, delay: 0, duration: 0.32, vol: 0.18 },
            { freq: 659.25, delay: 0.08, duration: 0.34, vol: 0.18 },
            { freq: 783.99, delay: 0.16, duration: 0.38, vol: 0.2 },
            { freq: 1046.5, delay: 0.25, duration: 0.72, vol: 0.24 },
          ]
        : [
            { freq: 587.33, delay: 0, duration: 0.2, vol: 0.16 },
            { freq: 739.99, delay: 0.07, duration: 0.22, vol: 0.17 },
            { freq: 880.0, delay: 0.14, duration: 0.26, vol: 0.19 },
            { freq: 1174.66, delay: 0.22, duration: 0.65, vol: 0.23 },
          ];

    notes.forEach(({ freq, delay, duration, vol }) => {
      const start = now + delay;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const overtoneGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      overtoneGain.gain.setValueAtTime(0.001, start);
      overtoneGain.gain.linearRampToValueAtTime(vol * 0.28, start + 0.01);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, start + duration * 0.65);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(ctx.destination);
      overtoneGain.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + duration + 0.05);
      overtone.stop(start + duration + 0.05);
    });
  }

  /**
   * Plays a gentle two-note chime when groups are generated or shuffled.
   */
  public playGroupShuffle(preset: SoundPreset) {
    if (preset === 'muted') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, delay: 0, duration: 0.18 },
      { freq: 783.99, delay: 0.09, duration: 0.28 },
    ];

    notes.forEach(({ freq, delay, duration }) => {
      const start = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  }
}

export const soundEngine = new ClassroomAudioEngine();
