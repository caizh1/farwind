# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: combat-build.spec.ts >> legacy-save-backup-and-import
- Location: tests/combat-build.spec.ts:93:1

# Error details

```
Error: page.waitForFunction: TypeError: window.__farwind is not a function
    at eval (eval at predicate (eval at evaluate (:311:30)), <anonymous>:1:14)
    at predicate (eval at evaluate (:311:30), <anonymous>:7:27)
    at next (eval at evaluate (:311:30), <anonymous>:29:33)
    at eval (eval at evaluate (:311:30), <anonymous>:42:13)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic:
    - status
    - dialog [ref=e5]:
      - banner [ref=e6]:
        - text: 远 风 之 地
        - heading "远风之地" [level=1] [ref=e7]
      - paragraph [ref=e8]: 沿着风，遇见属于你的故事。
      - paragraph [ref=e9]: 第一章 · 风铃村的来信
      - generic [ref=e10]:
        - button "启程 · 新游戏" [active] [ref=e11] [cursor=pointer]
        - button "继续旅途" [disabled] [ref=e12]
        - button "设置" [ref=e13] [cursor=pointer]
      - paragraph [ref=e14]: 本地存档可能随站点数据清理而丢失，请定期导出备份。
      - button "导入存档" [ref=e15] [cursor=pointer]
      - button "导出迁移前备份" [ref=e16] [cursor=pointer]
```