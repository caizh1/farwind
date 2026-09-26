# 对话立绘实施与验证报告

## 交付状态

已完成三位居民的独立自然比例半身立绘与底部木框接入。原始母版、运行资源、提示词、固定预览及真实对话截图均保留在工作区。本次没有提交、推送或公开部署；没有替换场景居民图集或改动战斗规则。

本次 10 项资源与副作用测试、5 个新增浏览器用例的最新有效执行结果及三人生产交互均通过；类型检查和构建通过。整个项目回归未全通过，具体失败见下文。

素材仍标记临时：开发自检与最终用户美术验收是不同门槛，用户美术验收未登记。目标设备帧率未实测。

## 实际修改

| 文件 | 本次内容 |
| --- | --- |
| `src/data/dialoguePortraits.ts` | 三个稳定角色标识、独立路径、中文替代文字和顶部焦点；未知或原型属性不映射立绘 |
| `src/game/ui/interface.ts` | 沿用第三个来源参数，独立图片列、失败回收、旧请求隔离、正文滚动焦点 |
| `src/game/systems/interactions.ts` | 仅将原先来源三元选择改为 `p.id`；任务与保存分支原样保留 |
| `src/style.css` | 对话专属 Grid、26%／24% 人物列、顶部自然比例裁切、固定可见的姓名与按钮、正文滚动 |
| `public/assets/portraits/` | 三张 768 × 1152 透明 WebP，独立于场景图集 |
| `public/assets/manifest.json` | 追加来源、母版路径、尺寸、透明、无动画与临时验证状态 |
| `package.json` | 在当前显式测试清单末尾追加新资源与交易边界测试，保留其他工作新增的弹反测试 |
| `tests/dialogue-portraits.test.ts` | 10 项角色映射、透明、原图摘要与兑换／奖励／保存边界验证 |
| `tests/dialogue-portraits.spec.ts` | 实际居民交互、非人物对话、长台词、未知来源、缺图与旧异步请求 |
| `tests/dialogue-portraits.production.ts` | 生产构建中的三人实际移动与对话，含窄窗口截图；仅在显式生产目标中运行，避免默认开发测试误报 |
| `tools/playwright-dialogue.config.ts`、`tools/serve-dialogue-runtime.mjs`、`.gitignore` | 为本任务提供带摘要的等内容运行副本，隔离其他工作的热更新；副本不入 Git |
| `docs/dialogue-portraits/` | 本报告、设计、中文提示词、母版、固定预览与证据 |

仓库 diff 同时包含任务开始前和其他并行工作的修改，不能把整个 diff 归为本任务。HUD、地图、弹反与敌人相关变更不属于本次立绘实现。

## 素材核对

三张母版均通过内置 imagegen 独立绘制，原素材只提供身份线索，后两人依据小满统一画风。母版与输出方法详见 `DESIGN.md`，完整提示词见 `prompts.json`。

- 运行尺寸均为 768 × 1152，有真实 Alpha；顶部安全区透明，图外没有棋盘格或背景板。
- 实际深绿底和白底合成已核对边缘，未见烘焙白边或灰底；部分工具会展示透明像素的 RGB，不能据此判断不透明背景。
- 三张运行资源合计 988778 字节；只在对应居民对话中按需请求，不进入 Phaser 场景帧加载。
- 场景 `healer.png`、`elder.png`、`carpenter.png` 的 SHA-256 与修改前一致，测试直接核对原始字节。
- 桌面截图中脸、肩颈与职业道具轮廓清晰；发髻、白发和草帽顶部完整。胸像裁切会隐去部分腰边手和道具，完整双手仍保留在母版及小窗口的更完整半身构图中。

## 实际命令与结果

所有命令均在项目目录运行，未升级依赖、未删断言、未跳过关键用例。

| 命令 | 实际结果 |
| --- | --- |
| 修改前 `npm run typecheck` | 失败：缺少两个弹反导出，见 `BASELINE.md` |
| 修改前 `npm test` | 84 项中 79 通过、5 失败，属于当时敌人与战斗工作 |
| 接入后 `npm run typecheck` | 通过；其他工作期间补齐了弹反导出，不归为本任务修复 |
| 接入后 `npm test` | 初次 149 项全部通过。最终复核因其他工作新增用例变为 150 项：149 通过、1 失败，失败为 `village-defense.test.ts:134` 南门规划塔基地面碰撞断言；本次 10 项资源与副作用测试全部通过 |
| `npm run build` | 通过；保留既有大于 500 kB 的打包体积告警 |
| `npm run test:e2e -- --config=tools/playwright-dialogue.config.ts tests/dialogue-portraits.spec.ts tests/session.spec.ts --workers=1` | 中间运行 4 通过、2 失败：一次本任务测试未等待退出反馈；已有体力回归瞬时步速断言失败。同页继续／新游戏／刷新回归通过 |
| `npm run test:e2e -- --config=tools/playwright-dialogue.config.ts tests/dialogue-portraits.spec.ts --workers=1 --output=docs/dialogue-portraits/evidence/final-results` | 4 通过、1 失败：居民、固定预览／长文／缺图、延迟失败、真实缺图均通过；非人物测试退出后立即导航，其移动键被原有关闭清理消费，已补充等待退出反馈 |
| `npm run test:e2e -- --config=tools/playwright-dialogue.config.ts tests/dialogue-portraits.spec.ts --grep=dialogue-sign-and-inscription --workers=1 --output=docs/dialogue-portraits/evidence/sign-results` | 1 项通过；实际练习须知、东村口路牌与碑文均无人物列，E退出可继续移动，稳定截图已更新 |
| `npm run test:e2e -- --config=tools/playwright-dialogue.config.ts tests/dialogue-portraits.spec.ts --grep='dialogue-residents\|dialogue-fallback-and-long-text' --workers=1 --output=docs/dialogue-portraits/evidence/crop-results` | 2 项通过；岚爷爷窄屏焦点调整后木杖轮廓更完整，重新核对三居民与固定预览，页面错误为空 |
| `FARWIND_URL=http://127.0.0.1:4197 npm run test:e2e -- --config=tools/playwright-dialogue.config.ts tests/dialogue-portraits.production.ts --workers=1 --output=docs/dialogue-portraits/evidence/production-results` | 1 项通过，耗时 31.9 秒；三人实际移动与交谈、按钮关闭、窄窗口均核对，页面错误为空，开发会话诊断未暴露 |

生产验证服务命令为 `npm run preview -- --port 4197 --strictPort --outDir .dialogue-local/production`，使用本地构建的等内容副本，避免其他任务重建 `dist/` 造成版本漂移。浏览器测试不修改任务、位置、背包或敌人状态。

## 失败首因与处理

1. 首轮共享测试目录被其他运行清理，产生追踪包缺失；改用本任务独立输出目录。
2. 共享开发服务器中其他源码热更新重载页面，导航途中 `__farwind` 消失；改用等内容副本，并保存 `runtime-snapshot.json` 摘要。最终立绘、接口、样式与场景源均与副本核对相同。
3. 开始选取的练习场站位在围栏内；依据实际碰撞选择可通行位置 `1700,700`。东村口路牌使用 `1960,1210`，碑文使用 `3370,870`。
4. 立绘配置为不接收指针，语义点击立绘被面板承接，这是预期行为；测试改为在立绘区域实际鼠标点击，验证不能穿透攻击。
5. 自动化连续按键没有等待退出状态，移动键被既有 `actions.pause()` 的输入清理消费；测试等待模态层确实关闭后再进入下一次输入，未改变游戏输入规则。
6. 部分旧截图截在 180 毫秒淡入中；最终截图等待界面动画结束后采集，避免以半透明中间帧判断美术。
7. 原始生成边缘缩图后顶部有 Alpha 最大 1／9／6 的微弱像素；通过等比例导出透明安全边距修复，保留顶部透明断言。

已有会话回归不是全绿：早期 `.help` 断言与并行 HUD 改动不符，后续该断言已被其他工作更新；最新执行中步速断言预期 150、实际约 125.4，仍失败。立绘仅在对话中呈现，该用例失败发生在新游戏步行阶段，未执行立绘渲染路径；未修改其断言、运动或战斗代码。该项目层根因尚未在本任务中确认。

最终逻辑复核还观察到并行新增的南门规划塔基地面断言失败。该用例检查未来规划岗位的地面碰撞，未调用对话或立绘模块；本任务未改村庄、地形、碰撞或规划点。保留失败，不删除断言、不修改地图以取得通过。

## 实际截图与视口

- 同一 1368 × 720 视口小满前后：`evidence/healer-baseline.png` 与 `evidence/healer-desktop.png`。
- 同视口三居民实际交互：`elder-desktop.png`、`healer-desktop.png`、`carpenter-desktop.png`。
- 小满实际 1280 × 720、844 × 390、560 × 720：`healer-720.png`、`healer-short.png`、`healer-narrow.png`。
- 三人固定预览与窄窗口：`*-fixed-preview.png`、`*-fixed-narrow.png`。固定预览只验证 UI 与素材，不宣称任务交互已完成。
- 实际练习须知、路牌、碑文：`training-guide-text.png`、`village-guide-text.png`、`clue-text.png`。
- 超长正文末尾与按钮：`long-narrow.png`、`long-short.png`、`long-tiny.png`，包含 375 × 280 的额外边界检查。
- 实际立绘缺失：`missing-runtime.png`；未知与缺图固定测试图：`missing-portrait.png`。
- 生产实际三居民与各自窄窗口：`evidence/production/*.png`，数据见 `production/report.json`。
- 布局坐标与暂停／无陈旧攻击证据见 `runtime-report.json`；副本源码与资源摘要见 `runtime-snapshot.json`。

截图尺寸为浏览器内容视口，不是外框尺寸。正常缩放已由开发自检目视核对，用户未进行最终画风批准。

## 对抗式审查

VERDICT: PASS

P0/P1 BLOCKERS: 无。

审查追踪了所有对话调用、任务与保存分支、模态层点击、E／Esc／按钮退出、暂停清理、图片错误及旧请求、原型属性标识、长文滚动、窄窗口、场景帧与 HUD 样式隔离。候选问题逐一反证：现有第三参避免重写接口；文本通过 `textContent`；错误回调绑定所属 DOM 而非当前模态层；交互只改展示参数；图外点击由模态层承接；按键结束后保持现有清理。没有发现达到 P0/P1 的本任务缺陷。

UNVERIFIED RISKS:

- 用户最终画风、脸型和职业细节偏好未验收；资源继续临时登记。
- 目标设备帧率、移动浏览器触控体验及商业权利没有在本轮确认。
- 既有体力回归步速断言的项目层根因未完成定位，不能声称全部既有回归通过。
- 并行新增南门规划塔基地面断言失败，项目层验收仍需处理，未纳入立绘修复。

NON-BLOCKING FINDINGS:

- 运行三张立绘约 0.99 MB，总体按需加载；没有另建复杂动画或表情系统。
- 窄视口中游戏地图本身存在既有缩放与留边表现；本次未改地图相机或布局。
