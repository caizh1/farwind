export type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export class Follower {
  readonly startDistance = 104;
  readonly personalSpace = 52;
  readonly trailDistance = 76;
  following = false;
  path: Point[] = [];
  target?: Point;
  speed = 0;
  stationary = 0;
  parking?: Point;
  reset(player: Point) {
    this.path = [{ ...player }];
    this.following = false;
    this.target = undefined;
    this.speed = 0;
    this.stationary = 0;
    this.parking = undefined;
  }
  update(
    player: Point,
    cat: Point,
    dt: number,
    clear: (a: Point, b: Point) => boolean,
    blocked: (x: number, y: number) => boolean,
  ): Point {
    if (dt <= 0) return { ...cat };
    const last = this.path.at(-1);
    const moved = last ? distance(last, player) : 0;
    this.stationary = moved > 0.001 ? 0 : this.stationary + dt;
    if (moved > 0.001) this.parking = undefined;
    if (!last) this.reset(player);
    else if (distance(last, player) > 0.001) this.path.push({ ...player });
    if (this.path.length > 1400) this.path.splice(0, this.path.length - 1400);
    let remaining = this.trailDistance,
      goal = { ...this.path[0] },
      end = 0;
    for (let i = this.path.length - 1; i > 0; i--) {
      const a = this.path[i],
        b = this.path[i - 1],
        len = distance(a, b);
      if (len >= remaining) {
        const t = remaining / len;
        goal = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        end = i;
        break;
      }
      remaining -= len;
    }
    const gap = distance(player, cat);
    // 玩家站定后只选一次停靠点；路径不可通时不挤人、不穿墙。
    if (!this.parking && this.stationary > 0.25 && gap < this.personalSpace) {
      const base =
        gap > 8
          ? Math.atan2(cat.y - player.y, cat.x - player.x)
          : Math.atan2(goal.y - player.y, goal.x - player.x);
      for (const offset of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, Math.PI]) {
        const candidate = {
          x: player.x + Math.cos(base + offset) * 72,
          y: player.y + Math.sin(base + offset) * 72,
        };
        if (!blocked(candidate.x, candidate.y) && clear(cat, candidate)) {
          this.parking = candidate;
          break;
        }
      }
    }
    if (this.parking) {
      goal = this.parking;
      this.following = distance(goal, cat) >= 2;
      if (!this.following) this.parking = undefined;
    } else if (gap < this.personalSpace || distance(goal, cat) < 2)
      this.following = false;
    else if (!this.following && gap > this.startDistance) this.following = true;
    this.target = goal;
    if (!this.following || dt <= 0) {
      this.speed = 0;
      return { ...cat };
    }
    if (!clear(cat, goal)) {
      let reachable: Point | undefined;
      for (let i = end; i >= 0; i--) {
        const p = this.path[i];
        if (distance(cat, p) > 4 && distance(cat, p) < 260 && clear(cat, p)) {
          reachable = p;
          break;
        }
      }
      if (!reachable) {
        this.speed = 0;
        return { ...cat };
      }
      goal = reachable;
      this.target = goal;
    }
    const len = distance(goal, cat);
    if (len < 0.001) {
      this.speed = 0;
      return { ...cat };
    }
    // 解析指数减速避免以帧数插值；追赶上限260，不推挤玩家，也不瞬移。
    const step = Math.min(len, 260 * dt, len * (1 - Math.exp(-6 * dt)));
    let next = {
      x: cat.x + ((goal.x - cat.x) / len) * step,
      y: cat.y + ((goal.y - cat.y) / len) * step,
    };
    if (blocked(next.x, next.y) || !clear(cat, next)) {
      // 视线采样可能漏过很薄的转角；与玩家相同按轴滑动，防止贴边永久卡住。
      const candidates = [
        { x: next.x, y: cat.y },
        { x: cat.x, y: next.y },
      ]
        .filter(
          (p) =>
            distance(p, cat) > 0.0001 && !blocked(p.x, p.y) && clear(cat, p),
        )
        .sort((a, b) => distance(a, goal) - distance(b, goal));
      if (!candidates.length) {
        this.speed = 0;
        return { ...cat };
      }
      next = candidates[0];
    }
    this.speed = distance(next, cat) / dt;
    return next;
  }
}
