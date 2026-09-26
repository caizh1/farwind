export class Sound {
  context?: AudioContext;
  volume = 0.25;
  start() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  play(kind = "pick") {
    if (!this.context || !this.volume) return;
    if (["attack", "attack-heavy", "hit", "finish"].includes(kind)) {
      this.combatSound(kind);
      return;
    }
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = kind === "hit" || kind === "finish" ? "triangle" : "sine";
    o.frequency.setValueAtTime(
      (
        {
          pick: 650,
          talk: 420,
          hit: 140,
          finish: 100,
          attack: 230,
          dash: 720,
          success: 880,
        } as Record<string, number>
      )[kind] ?? 520,
      c.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "hit" ? 60 : 900,
      c.currentTime + 0.15,
    );
    g.gain.setValueAtTime(this.volume * 0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.21);
  }
  private combatSound(kind: string) {
    const c = this.context!;
    const swing = kind.startsWith("attack"),
      heavy = kind === "finish" || kind === "attack-heavy";
    const duration = swing ? (heavy ? 0.19 : 0.13) : heavy ? 0.22 : 0.12;
    const at = c.currentTime;
    // 短噪声带通塑造破风／接触，避免用同一个上升纯音代替所有反馈。
    const noise = c.createBuffer(
      1,
      Math.ceil(c.sampleRate * duration),
      c.sampleRate,
    );
    const samples = noise.getChannelData(0);
    let seed = 137;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 16807) % 2147483647;
      samples[i] = seed / 1073741824 - 1;
    }
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = noise;
    filter.type = swing ? "bandpass" : "lowpass";
    filter.Q.value = swing ? 0.7 : 0.5;
    filter.frequency.setValueAtTime(swing ? 4200 : heavy ? 2300 : 3600, at);
    filter.frequency.exponentialRampToValueAtTime(
      swing ? 650 : 350,
      at + duration,
    );
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.linearRampToValueAtTime(
      this.volume * (swing ? 0.9 : heavy ? 1.25 : 0.9),
      at + (swing ? 0.024 : 0.003),
    );
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start(at);
    source.stop(at + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (!swing) {
      const body = c.createOscillator(),
        envelope = c.createGain();
      body.type = "triangle";
      body.frequency.setValueAtTime(heavy ? 105 : 185, at);
      body.frequency.exponentialRampToValueAtTime(
        heavy ? 42 : 75,
        at + duration * 0.8,
      );
      envelope.gain.setValueAtTime(this.volume * (heavy ? 0.65 : 0.38), at);
      envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
      body.connect(envelope);
      envelope.connect(c.destination);
      body.start(at);
      body.stop(at + duration);
      body.onended = () => {
        body.disconnect();
        envelope.disconnect();
      };
    }
  }
}
