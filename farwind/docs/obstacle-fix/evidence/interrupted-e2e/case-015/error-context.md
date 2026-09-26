# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: session.spec.ts >> session-title-continue-new-refresh
- Location: tests/session.spec.ts:103:1

# Error details

```
Error: page.waitForFunction: TypeError: window.__farwind is not a function
    at eval (eval at predicate (eval at evaluate (:311:30)), <anonymous>:6:28)
    at predicate (eval at evaluate (:311:30), <anonymous>:7:27)
    at next (eval at evaluate (:311:30), <anonymous>:29:33)
    at eval (eval at evaluate (:311:30), <anonymous>:42:13)
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
        - heading "风正在捎来故事" [level=1] [ref=f1e7]
      - paragraph [ref=f1e8]: 正在装载风铃村素材……
```