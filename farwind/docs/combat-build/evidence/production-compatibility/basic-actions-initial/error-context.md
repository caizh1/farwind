# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: skill-growth.spec.ts >> 生产回归：未学三连、架剑自动反斩与风步仍可使用
- Location: tests/skill-growth.spec.ts:734:1

# Error details

```
Error: page.evaluate: TypeError: window.__combatRegression is not a function
    at eval (eval at evaluate (:311:30), <anonymous>:1:14)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic:
          - generic [ref=e4]:
            - img "旅行者" [ref=e5]
            - generic [ref=e6]:
              - generic [ref=e7]: 旅人 与小黑同行
              - generic [ref=e8]: 生命 100 / 100
              - generic [ref=e11]: 体力 100 / 100
          - generic: L 风步 · 就绪
          - status: 当前动作不可取消
          - button "小宝 · 自由 · 640/640" [ref=e14] [cursor=pointer]
          - generic:
            - generic: 木桩练习
            - generic: J / 左键：攻击；连按接三／四连；I／中键：剑风；L：风步
            - generic: 第3段 · 30伤害；本组命中3/3；累计68 · 三连完成
            - button "迎风架剑练习" [ref=e15] [cursor=pointer]
            - button "本领与构筑训练" [ref=e16] [cursor=pointer]
        - generic:
          - button "展开小地图" [ref=e17] [cursor=pointer]:
            - generic [ref=e18]: 风铃村
            - generic [ref=e19]: ·
            - generic [ref=e20]: 第1日 08:03 · 白天
            - generic [aria-hidden] [ref=e23]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e26]: ▾
      - generic: E · 小宝 · 听风小宗师
      - status: Esc 打开菜单 / 查看操作
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "1"
            - strong [ref=e29]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]: "2"
            - strong [ref=e32]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e33] [cursor=pointer]:
            - generic [ref=e34]: "3"
            - generic [ref=e35]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: "4"
            - generic [ref=e38]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e39] [cursor=pointer]:
            - generic [ref=e40]: "5"
            - generic [ref=e41]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: "6"
            - generic [ref=e44]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e45] [cursor=pointer]:
            - generic [ref=e46]: "7"
            - generic [ref=e47]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e48] [cursor=pointer]:
            - generic [ref=e49]: "8"
            - generic [ref=e50]: —
            - strong
        - generic "已装备符文与冷却" [ref=e51]:
          - button "◇ ·" [ref=e52] [cursor=pointer]:
            - generic [ref=e53]: ◇
            - generic [ref=e54]: ·
          - button "◇ ·" [ref=e55] [cursor=pointer]:
            - generic [ref=e56]: ◇
            - generic [ref=e57]: ·
          - button "◇ ·" [ref=e58] [cursor=pointer]:
            - generic [ref=e59]: ◇
            - generic [ref=e60]: ·
          - button "◇ ·" [ref=e61] [cursor=pointer]:
            - generic [ref=e62]: ◇
            - generic [ref=e63]: ·
          - button "◇ ·" [ref=e64] [cursor=pointer]:
            - generic [ref=e65]: ◇
            - generic [ref=e66]: ·
          - button "归风 · 固定归风 G" [ref=e67] [cursor=pointer]:
            - img "归风 · 固定归风" [ref=e68]
            - generic [ref=e70]: G
    - status: 风铃村欢迎你。向北走几步，按 E 与守风人交谈。
  - complementary [ref=e71]:
    - button "居民笔记 · N" [ref=e72] [cursor=pointer]
```