# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: village-defense.spec.ts >> 真实输入通过三门，北南不触发森林任务，主角和黑猫返回，西门与两柱实际阻挡
- Location: tests/village-defense.spec.ts:16:1

# Error details

```
Error: 可到达 170,990

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic [ref=e4]:
          - img "旅行者" [ref=e5]
          - generic [ref=e6]:
            - generic [ref=e7]: 旅人 与小黑同行
            - generic [ref=e8]: 生命 100 / 100
            - generic [ref=e11]: 体力 100 / 100
        - generic [ref=e14]:
          - generic [ref=e15]: 风铃村
          - generic [ref=e16]: 第 1 日 · 09:15
          - generic "位置小地图" [ref=e17]
      - generic [ref=e18]:
        - generic [ref=e19]: 风从这里开始
        - generic [ref=e20]: 采集药草与浆果，在背包制作恢复药剂
        - button "Q 旅途手记" [ref=e21] [cursor=pointer]
      - generic:
        - generic: WASD 移动 · 空格 奔跑 · E 交互 · J/左键 三连斩 · L 风步 · 就绪
        - generic [ref=e22]:
          - button "1 恢复药剂 0" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: "1"
            - img "恢复药剂" [ref=e25]
            - strong [ref=e26]: "0"
          - button "2 浆果 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - img "浆果" [ref=e29]
            - strong [ref=e30]: "0"
          - button "3 —" [ref=e31] [cursor=pointer]:
            - generic [ref=e32]: "3"
            - generic [ref=e33]: —
            - strong
          - button "4 —" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]: "4"
            - generic [ref=e36]: —
            - strong
          - button "5 —" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]: "5"
            - generic [ref=e39]: —
            - strong
          - button "6 —" [ref=e40] [cursor=pointer]:
            - generic [ref=e41]: "6"
            - generic [ref=e42]: —
            - strong
          - button "7 —" [ref=e43] [cursor=pointer]:
            - generic [ref=e44]: "7"
            - generic [ref=e45]: —
            - strong
          - button "8 —" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: "8"
            - generic [ref=e48]: —
            - strong
        - generic [ref=e49]:
          - button "Tab 行囊" [ref=e50] [cursor=pointer]
          - button "M 地图" [ref=e51] [cursor=pointer]
          - button "Esc 暂停" [ref=e52] [cursor=pointer]
    - status: 抵达 · 风铃村
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test";
  2  | import { terrainBlocked, solidPropAt, WORLD } from "../src/data/world";
  3  | import { clearMotionLine } from "../src/game/systems/obstacles";
  4  | const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
  5  | // 只读取诊断状态，所有推进通过真实键盘输入；寻路使用正式地图碰撞。
  6  | export async function move(page: Page, tx: number, ty: number) {
  7  |   const start = (await read(page)).state.player,
  8  |     step = 10,
  9  |     cols = WORLD.width / step;
  10 |   const key = (x: number, y: number) =>
  11 |     Math.round(y / step) * cols + Math.round(x / step);
  12 |   const startKey = key(start.x, start.y),
  13 |     end = key(tx, ty),
  14 |     queue = [startKey],
  15 |     prev = new Map<number, number>([[startKey, -1]]);
  16 |   const blocked = (x: number, y: number) =>
  17 |     terrainBlocked(x, y) || solidPropAt(x, y);
  18 |   const safe = (x: number, y: number) =>
  19 |     [-6, 0, 6].every((ox) =>
  20 |       [-6, 0, 6].every((oy) => !blocked(x + ox, y + oy)),
  21 |     );
  22 |   for (let i = 0; i < queue.length && !prev.has(end); i++) {
  23 |     const n = queue[i],
  24 |       x = n % cols,
  25 |       y = Math.floor(n / cols);
  26 |     for (const [dx, dy] of [
  27 |       [1, 0],
  28 |       [-1, 0],
  29 |       [0, 1],
  30 |       [0, -1],
  31 |     ]) {
  32 |       const nx = x + dx,
  33 |         ny = y + dy,
  34 |         k = ny * cols + nx;
  35 |       if (
  36 |         nx < 3 ||
  37 |         nx >= cols - 3 ||
  38 |         ny < 8 ||
  39 |         ny >= 217 ||
  40 |         prev.has(k) ||
  41 |         !clearMotionLine(
  42 |           { x: x * step, y: y * step },
  43 |           { x: nx * step, y: ny * step },
  44 |         ) ||
  45 |         !safe(nx * step, ny * step) ||
  46 |         !safe(((x + nx) * step) / 2, ((y + ny) * step) / 2)
  47 |       )
  48 |         continue;
  49 |       prev.set(k, n);
  50 |       queue.push(k);
  51 |     }
  52 |   }
> 53 |   expect(prev.has(end), `可到达 ${tx},${ty}`).toBe(true);
     |                                            ^ Error: 可到达 170,990
  54 |   const path: number[][] = [];
  55 |   for (let n = end; n !== startKey; n = prev.get(n)!)
  56 |     path.unshift([(n % cols) * step, Math.floor(n / cols) * step]);
  57 |   const turns = path.filter(
  58 |     (p, i) =>
  59 |       i === path.length - 1 ||
  60 |       i === 0 ||
  61 |       p[0] - path[i - 1][0] !== path[i + 1][0] - p[0] ||
  62 |       p[1] - path[i - 1][1] !== path[i + 1][1] - p[1],
  63 |   );
  64 |   for (const [x, y] of turns)
  65 |     for (const [axis, target] of [
  66 |       ["x", x],
  67 |       ["y", y],
  68 |     ] as const) {
  69 |       const current = (await read(page)).state.player[axis],
  70 |         delta = target - current;
  71 |       if (Math.abs(delta) < 4) continue;
  72 |       const sign = Math.sign(delta),
  73 |         button = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
  74 |       let reached = false;
  75 |       while (!reached) {
  76 |         await page.keyboard.down(button);
  77 |         try {
  78 |           await page.waitForFunction(
  79 |             ({ axis, target, sign }) => {
  80 |               const s = (window as any).__farwind();
  81 |               return (
  82 |                 s.mode === "dialog" ||
  83 |                 sign * (s.state.player[axis] - target) > -3
  84 |               );
  85 |             },
  86 |             { axis, target, sign },
  87 |             { timeout: 12000 },
  88 |           );
  89 |         } finally {
  90 |           await page.keyboard.up(button);
  91 |         }
  92 |         const current = await read(page);
  93 |         reached = sign * (current.state.player[axis] - target) > -3;
  94 |         if (current.mode === "dialog")
  95 |           await page.getByRole("button", { name: "继续 · E" }).click();
  96 |       }
  97 |     }
  98 | }
  99 | 
```