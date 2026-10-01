import type { ActionKind } from "./combat";
export type InputEvent = {
  kind: ActionKind | "axis";
  at: number;
  sequence: number;
  axis: { x: number; y: number };
  running?: boolean;
  windHeld?: boolean;
};
export class Input {
  held = new Set<string>();
  pressed = new Set<string>();
  events: InputEvent[] = [];
  sequence = 0;
  private lifetime=new AbortController();
  destroy(){this.clear();this.lifetime.abort();}
  enabled = () => true;
  uiKey = (_event: KeyboardEvent) => false;
  focusCanvas = () => {};
  constructor(
    target: Window | null = typeof window === "undefined" ? null : window,
    private clock = () => performance.now(),
  ) {
    target?.addEventListener("keydown", (e) => {
      if (!this.uiKey(e))
        this.keyDown(e.key, e.repeat, () => e.preventDefault());
    },{signal:this.lifetime.signal});
    target?.addEventListener("keyup", (e) => this.keyUp(e.key),{signal:this.lifetime.signal});
    target?.addEventListener("blur", () => this.clear(),{signal:this.lifetime.signal});
  }
  windHeld(){return this.held.has('i')||this.held.has('mouse-wind');}
  cancelWind(){this.held.delete('i');this.held.delete('mouse-wind');}
  keyDown(key: string, repeat = false, prevent = () => {}) {
    if (
      ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
        key,
      )
    )
      prevent();
    const k = key.toLowerCase();
    if (repeat || this.held.has(k)) return;
    this.pressed.add(k);
    this.held.add(k);
    if (this.enabled()) {
      if (k === "j" || k === "k" || k === "l" || k === "i")
        this.request(k === "j" ? "attack" : k === "k" ? "parry" : k === "i" ? "wind" : "dash");
      else if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
        ].includes(k)
      )
        this.record("axis");
    }
  }
  keyUp(key: string) {
    this.held.delete(key.toLowerCase());
    if (this.enabled()) this.record("axis");
  }
  request(kind: ActionKind) {
    if (this.enabled()) this.record(kind);
  }
  private record(kind: InputEvent["kind"]) {
    // 统一单调墙钟，不使用浏览器事件时间戳与模拟时间直接相减。
    this.events.push({
      kind,
      at: Math.round(this.clock() * 1000) / 1000,
      sequence: ++this.sequence,
      axis: this.axis(),
      running: this.held.has(" "),
      windHeld:this.windHeld(),
    });
  }
  bindCanvas(canvas: HTMLCanvasElement) {
    const pointer = (e: PointerEvent) => {
      this.focusCanvas();
      if (e.button === 0) this.request("attack");
      if (e.button === 2) this.request("parry");
      if(e.button===1&&this.enabled()){e.preventDefault();this.held.add('mouse-wind');this.request('wind');}
    };
    const menu = (e: MouseEvent) => e.preventDefault();
    const release=(e:PointerEvent)=>{if(e.button===1){this.held.delete('mouse-wind');this.record('axis');}};
    const cancel=()=>{this.cancelWind();this.record('axis');};
    window.addEventListener('pointerup',release);
    canvas.addEventListener('pointercancel',cancel);
    canvas.addEventListener("pointerdown", pointer);
    canvas.addEventListener("contextmenu", menu);
    return () => {
      window.removeEventListener('pointerup',release);
      canvas.removeEventListener('pointercancel',cancel);
      canvas.removeEventListener("pointerdown", pointer);
      canvas.removeEventListener("contextmenu", menu);
    };
  }
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }
  clear() {
    this.held.clear();
    this.pressed.clear();
    this.events = [];
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
