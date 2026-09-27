# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: east-defense-recovery.spec.ts >> 保留新剑风与弹反入口，真实第四刀和K可命中动态来袭怪
- Location: tests/east-defense-recovery.spec.ts:66:1

# Error details

```
Error: page.waitForFunction: TypeError: Cannot read properties of undefined (reading 'hero')
    at eval (eval at predicate (eval at evaluate (:311:30)), <anonymous>:1:35)
    at predicate (eval at evaluate (:311:30), <anonymous>:7:27)
    at next (eval at evaluate (:311:30), <anonymous>:29:33)
    at eval (eval at evaluate (:311:30), <anonymous>:42:13)
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
          - status: K 架剑就绪
          - generic: 剑风：正式学习
        - generic:
          - button "展开小地图" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 翡翠森林
            - generic [ref=e16]: ·
            - generic [ref=e17]: 第1日 08:02 · 白天
            - generic [aria-hidden] [ref=e20]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e23]: ▾
      - generic: E · 药草
      - status: Esc 打开菜单 / 查看操作
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: "1"
            - strong [ref=e26]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - strong [ref=e29]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]: "3"
            - generic [ref=e32]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e33] [cursor=pointer]:
            - generic [ref=e34]: "4"
            - generic [ref=e35]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: "5"
            - generic [ref=e38]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e39] [cursor=pointer]:
            - generic [ref=e40]: "6"
            - generic [ref=e41]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: "7"
            - generic [ref=e44]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e45] [cursor=pointer]:
            - generic [ref=e46]: "8"
            - generic [ref=e47]: —
            - strong
    - status: 抵达 · 翡翠森林
  - complementary [ref=e48]:
    - button "居民笔记 · N" [ref=e49] [cursor=pointer]
```