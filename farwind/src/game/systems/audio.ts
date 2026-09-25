export class Sound {
  context?: AudioContext;
  volume = 0.25;
  start() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  play(kind = "pick") {
    if (!this.context || !this.volume) return;
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
}
