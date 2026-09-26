# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: session.spec.ts >> session-sprint-recovery
- Location: tests/session.spec.ts:27:1

# Error details

```
Error: page.evaluate: TypeError: window.__farwind is not a function
    at eval (eval at evaluate (:311:30), <anonymous>:1:14)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic:
    - status
    - generic [ref=f1e5]:
      - generic [ref=f1e6]:
        - text: 远 风 之 地
        - heading "远风之地" [level=1] [ref=f1e7]
      - paragraph [ref=f1e8]: 沿着风，遇见属于你的故事。
      - paragraph [ref=f1e9]: 第一章 · 风铃村的来信
      - generic [ref=f1e10]:
        - button "启程 · 新游戏" [ref=f1e11] [cursor=pointer]
        - button "继续旅途" [ref=f1e12] [cursor=pointer]
        - button "设置" [ref=f1e13] [cursor=pointer]
      - paragraph [ref=f1e14]: 本地存档可能随站点数据清理而丢失，请定期导出备份。
      - button "导入存档" [ref=f1e15] [cursor=pointer]
```