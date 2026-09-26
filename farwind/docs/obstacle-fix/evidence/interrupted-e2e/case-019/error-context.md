# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> village-visual
- Location: tests/visual.spec.ts:2:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Cannot read properties of null (reading 'context')",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic:
    - generic:
      - generic:
        - generic [ref=f1e4]:
          - img "旅行者" [ref=f1e5]
          - generic [ref=f1e6]:
            - generic [ref=f1e7]: 旅人 与小黑同行
            - generic [ref=f1e8]: 生命 100 / 100
            - generic [ref=f1e11]: 体力 100 / 100
        - generic [ref=f1e14]:
          - generic [ref=f1e15]: 风铃村
          - generic [ref=f1e16]: 第 1 日 · 08:02
          - generic "位置小地图" [ref=f1e17]
      - generic [ref=f1e18]:
        - generic [ref=f1e19]: 风从这里开始
        - generic [ref=f1e20]: 与广场的守风人交谈
        - button "Q 旅途手记" [ref=f1e21] [cursor=pointer]
      - generic:
        - generic: WASD 移动 · 空格 奔跑 · E 交互 · J/左键 三连斩 · L 风步 · 就绪
        - generic [ref=f1e22]:
          - button "1 恢复药剂 0" [ref=f1e23] [cursor=pointer]:
            - generic [ref=f1e24]: "1"
            - img "恢复药剂" [ref=f1e25]
            - strong [ref=f1e26]: "0"
          - button "2 浆果 0" [ref=f1e27] [cursor=pointer]:
            - generic [ref=f1e28]: "2"
            - img "浆果" [ref=f1e29]
            - strong [ref=f1e30]: "0"
          - button "3 —" [ref=f1e31] [cursor=pointer]:
            - generic [ref=f1e32]: "3"
            - generic [ref=f1e33]: —
            - strong
          - button "4 —" [ref=f1e34] [cursor=pointer]:
            - generic [ref=f1e35]: "4"
            - generic [ref=f1e36]: —
            - strong
          - button "5 —" [ref=f1e37] [cursor=pointer]:
            - generic [ref=f1e38]: "5"
            - generic [ref=f1e39]: —
            - strong
          - button "6 —" [ref=f1e40] [cursor=pointer]:
            - generic [ref=f1e41]: "6"
            - generic [ref=f1e42]: —
            - strong
          - button "7 —" [ref=f1e43] [cursor=pointer]:
            - generic [ref=f1e44]: "7"
            - generic [ref=f1e45]: —
            - strong
          - button "8 —" [ref=f1e46] [cursor=pointer]:
            - generic [ref=f1e47]: "8"
            - generic [ref=f1e48]: —
            - strong
        - generic [ref=f1e49]:
          - button "Tab 行囊" [ref=f1e50] [cursor=pointer]
          - button "M 地图" [ref=f1e51] [cursor=pointer]
          - button "Esc 暂停" [ref=f1e52] [cursor=pointer]
    - status: 风铃村欢迎你。向北走几步，按 E 与守风人交谈。
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | test("village-visual", async ({ page }) => {
  3  |   const errors: string[] = [];
  4  |   page.on("pageerror", (e) => errors.push(e.message));
  5  |   await page.goto("/");
  6  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  7  |   await expect(page.locator("#hud")).toBeVisible();
  8  |   await page.waitForTimeout(1000);
  9  |   await page.screenshot({ path: "docs/combat/regression/village-first.png" });
> 10 |   expect(errors).toEqual([]);
     |                  ^ Error: expect(received).toEqual(expected) // deep equality
  11 | });
  12 | 
```