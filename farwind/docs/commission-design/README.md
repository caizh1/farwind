# 风铃村公共委托簿设计与实现

日期：2026年9月28日。用户已选择第2张“木匣签页委托簿”，并授权实现。场景木匣和打开页面已接入游戏；概念设计与真实运行证据分别保留。

## 候选设计与依据

| 显示顺序 | 设计图 | 阅读方式 |
| --- | --- | --- |
| 第1张 | [双页委托簿](commission-book.png) | 左页选择委托，右页详情。 |
| 第2张，已选 | [木匣签页委托簿](commission-folio.png) | 顶部签页、宽纸面与路线插画。 |
| 第3张 | [风纹叠页委托簿](commission-sheet.png) | 单份委托集中阅读。 |

原参考：[广场](reference-world.png)、[打开页面](reference-page.png)。南路补给领取时提供药剂两瓶，清理孢根巢地并交付药草两份后，奖励药剂两瓶、铜币二十四枚。西侧旧道须先调查，再交付木材四份、石材两份。实现复用原规则，没有新增委托或奖励。

## 实际运行证据

- [宽屏页面](evidence/page-wide-final.png)、[广场木匣](evidence/world-production.png)。
- [设计与实现并列](evidence/comparison-wide-final.png)、[正文细节](evidence/comparison-detail-final.png)。
- [领取反馈](evidence/production-receipt.png)、[保存重开](evidence/production-reloaded.png)。
- [窄屏首屏](evidence/page-narrow-final.png)、[窄屏滚动](evidence/page-narrow-scroll-final.png)。
- [横向短屏](evidence/page-short-final.png)、[短屏滚动](evidence/page-short-scroll-final.png)。
- [实现与审查](implementation.md)、[完整视觉检查](../../design-qa.md)。

本地开发入口为 `http://127.0.0.1:5173/`。广场委托簿前按 E 打开，按 Esc 合上；两份委托与旅途手记在同一纸页内切换。

## 素材与验证边界

生产素材位于 `public/assets/commission/*.webp`，五张合计约737 KiB，包含木框纸面、场景木匣、南路插画、墨绿按钮和铜币。原始透明 PNG 移至本目录 `asset-source/`，生成记录里的旧 PNG 路径为生成当时位置；提示词和原图保留。

定位样本 `evidence/ledger-location.json` 从正式初始状态生成，只调整旅人位置到委托簿前。样本通过游戏导入界面载入专用测试浏览器，任务、材料、营地和奖励均为初始状态，不作为步行或通关证据。

本轮正式构建快照的类型检查、构建和26项相关测试通过；共享目录后续变更的最新结果见末尾。真实浏览器验证打开、切页、领取、反馈、关闭、保存重开与响应式阅读。完成交付、扣料修路、保存失败和重复结算由正式快照与保存锁的逻辑测试覆盖。本轮未重新完整走通营地和修路路线，未测长时间性能；美术效果供用户查看实际截图确认。

交付前增补：共享目录又发生荒野遭遇与存档结构扩展。最新相关回归为25/26，委托簿四项均通过；旧存档兼容问题和出生断言变化见实现审查末尾。当前开发页面已经以仅调整站位的正式初始样本恢复，截图为 `evidence/page-current-dev.png`；未用覆盖初始样本冒充修复旧进度，也未改动正在变化的荒野系统。
