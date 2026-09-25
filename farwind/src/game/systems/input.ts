export class Input {
  held = new Set<string>();
  pressed = new Set<string>();
  constructor() {
    window.addEventListener("keydown", (e) => {
      if (
        [
          "Tab",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          " ",
        ].includes(e.key)
      )
        e.preventDefault();
      const k = e.key.toLowerCase();
      if (!e.repeat && !this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
    });
    window.addEventListener("keyup", (e) =>
      this.held.delete(e.key.toLowerCase()),
    );
    window.addEventListener("blur", () => this.clear());
  }
  clear() {
    this.held.clear();
    this.pressed.clear();
  }
  take(k: string) {
    const yes = this.pressed.has(k);
    this.pressed.delete(k);
    return yes;
  }
  axis() {
    return {
      x:
        Number(this.held.has("d") || this.held.has("arrowright")) -
        Number(this.held.has("a") || this.held.has("arrowleft")),
      y:
        Number(this.held.has("s") || this.held.has("arrowdown")) -
        Number(this.held.has("w") || this.held.has("arrowup")),
    };
  }
}
