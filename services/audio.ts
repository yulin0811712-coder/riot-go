

// A synthesized audio engine using Web Audio API
// No external files required.

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // BGM Sequencing State
  private isPlaying: boolean = false;
  private tempo: number = 110;
  private lookahead: number = 25.0; // ms to sleep between scheduling
  private scheduleAheadTime: number = 0.1; // seconds ahead to schedule
  private nextNoteTime: number = 0.0;
  private current16thNote: number = 0;
  private timerID: number | null = null;
  private bgmGain: GainNode | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- BGM Sequencer ---

  private nextNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += 0.25 * secondsPerBeat; // Advance 1/16th note
    this.current16thNote++;
    if (this.current16thNote === 64) { // 4 bars loop (16 * 4)
      this.current16thNote = 0;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    if (!this.ctx || !this.bgmGain) return;

    // Chord Progression (4 bars): C#m, A, E, B
    // 16 beats per bar.
    // Bar 1 (0-15): C# (277.18)
    // Bar 2 (16-31): A (220.00)
    // Bar 3 (32-47): E (164.81 or 329.63)
    // Bar 4 (48-63): B (246.94)

    let rootFreq = 277.18; // C#4
    let bassFreq = 69.30; // C#2
    
    if (beatNumber >= 16 && beatNumber < 32) {
        rootFreq = 220.00; // A3
        bassFreq = 55.00; // A1
    } else if (beatNumber >= 32 && beatNumber < 48) {
        rootFreq = 329.63; // E4
        bassFreq = 82.41; // E2
    } else if (beatNumber >= 48) {
        rootFreq = 246.94; // B3
        bassFreq = 61.74; // B1
    }

    // 1. KICK (On beats 0, 4, 8, 12 of each bar)
    if (beatNumber % 4 === 0) {
        this.playKick(time);
    }

    // 2. BASS (On 8th notes, offbeat driving)
    // Play on 0, 2, 4, 6...
    if (beatNumber % 2 === 0) {
        this.playBass(time, bassFreq);
    }

    // 3. ARP / LEAD (16th notes pattern)
    // Simple Arp Pattern: Root, Root+3rd, Root+5th, Octave
    // Using a simple interval offset based on beat position
    const interval = [0, 4, 7, 12][beatNumber % 4];
    const noteFreq = rootFreq * Math.pow(2, interval / 12);
    
    // Play slightly quieter arp
    this.playArp(time, noteFreq);
  }

  private scheduler() {
    if (!this.ctx) return;
    // While there are notes that will need to play before the next interval, schedule them
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.nextNote();
    }
    if (this.isPlaying) {
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  playBGM(volume: number = 0.05) {
    if (!this.ctx) this.init();
    if (this.isPlaying) return;

    this.isPlaying = true;
    
    // Global BGM volume - QUIETER as requested
    this.bgmGain = this.ctx!.createGain();
    this.bgmGain.gain.value = volume; // Very low volume for background
    this.bgmGain.connect(this.masterGain!);

    this.current16thNote = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  stopBGM() {
    this.isPlaying = false;
    if (this.timerID) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
    // Disconnect BGM gain to silence any trailing release
    if (this.bgmGain) {
        const t = this.ctx!.currentTime;
        this.bgmGain.gain.cancelScheduledValues(t);
        this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
        this.bgmGain.gain.linearRampToValueAtTime(0, t + 0.1);
        setTimeout(() => {
            this.bgmGain?.disconnect(); 
            this.bgmGain = null;
        }, 200);
    }
  }

  // --- Instruments ---

  private playKick(time: number) {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gain);
    gain.connect(this.bgmGain!);
    
    osc.start(time);
    osc.stop(time + 0.5);
  }

  private playBass(time: number, freq: number) {
     const osc = this.ctx!.createOscillator();
     const gain = this.ctx!.createGain();
     const filter = this.ctx!.createBiquadFilter();

     osc.type = 'sawtooth';
     osc.frequency.setValueAtTime(freq, time);

     filter.type = 'lowpass';
     filter.frequency.setValueAtTime(300, time);
     filter.frequency.linearRampToValueAtTime(100, time + 0.2); // Envelope

     gain.gain.setValueAtTime(0.8, time);
     gain.gain.linearRampToValueAtTime(0.01, time + 0.2);

     osc.connect(filter);
     filter.connect(gain);
     gain.connect(this.bgmGain!);

     osc.start(time);
     osc.stop(time + 0.25);
  }

  private playArp(time: number, freq: number) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.15, time); // Lower volume than bass
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

      osc.connect(gain);
      gain.connect(this.bgmGain!);
      
      osc.start(time);
      osc.stop(time + 0.15);
  }

  // --- SFX (Unchanged logic, just volume control) ---

  playShoot(volume: number = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.linearRampToValueAtTime(100, t + 0.15);

    gain.gain.setValueAtTime(0.2 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * volume, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playHit(volume: number = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.08);

    gain.gain.setValueAtTime(0.2 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * volume, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  playMiss(volume: number = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);

    gain.gain.setValueAtTime(0.15 * volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * volume, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.1);
  }
}

export const audio = new AudioSynthesizer();