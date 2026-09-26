# 自动测试失败证据

以下保留当时的错误堆栈、页面快照与代码，便于复核首因；修复后的结果见本任务报告。

# 测试信息

- 名称： dialogue-portraits.spec.ts >> dialogue-sign-and-inscription
- 位置： tests/dialogue-portraits.spec.ts:110:1

# 错误详情

```
TimeoutError: page.waitForFunction: Timeout 12000ms exceeded.
```

# 页面快照

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic:
          - generic:
            - img "旅行者"
            - generic:
              - generic: 旅人 与小黑同行
              - generic: 生命 100 / 100
              - generic: 体力 100 / 100
          - generic: L 风步 · 就绪
          - generic:
            - generic: 木桩练习
            - generic: J / 左键：攻击；连按接三连；L：风步
            - button "迎风架剑练习" [ref=e4] [cursor=pointer]
        - generic:
          - button "展开小地图" [ref=e5] [cursor=pointer]:
            - generic [ref=e6]: 风铃村
            - generic [ref=e7]: ·
            - generic [ref=e8]: 08:31
            - generic [aria-hidden] [ref=e11]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e12] [cursor=pointer]:
            - generic [ref=e13]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e14]: ▾
      - generic: E · 练习场须知
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]: "1"
            - strong [ref=e17]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e18] [cursor=pointer]:
            - generic [ref=e19]: "2"
            - strong [ref=e20]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: "3"
            - generic [ref=e23]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: "4"
            - generic [ref=e26]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "5"
            - generic [ref=e29]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]: "6"
            - generic [ref=e32]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e33] [cursor=pointer]:
            - generic [ref=e34]: "7"
            - generic [ref=e35]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: "8"
            - generic [ref=e38]: —
            - strong
    - status: 风铃村欢迎你。向北走几步，按 E 与守风人交谈。
```

# 测试源码

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
  53 |   expect(prev.has(end), `可到达 ${tx},${ty}`).toBe(true);
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
> 78 |           await page.waitForFunction(
     |                      ^ TimeoutError: page.waitForFunction: Timeout 12000ms exceeded.
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