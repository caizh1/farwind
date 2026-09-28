# 木匣签页委托簿视觉检查

final result: passed

日期：2026年9月28日。用户已选方案2并授权实现。原提示框审查另存 `docs/commission-design/prior-design-qa.md`。

## 最终发现

没有剩余需要修复的 P0/P1/P2 视觉或交互问题。实际游戏中的木匣和页面已经打开检查，设计与实现已经组合为同一张图比较。正文可滚动，底部操作完整可见。

P3：页面挂铃、风纹小徽记、装饰线末端未逐项复制；场景木匣保留黄铜铃。目标使用原生方形勾选状态，地点标签移到图下图例。这些属于后续美术细节，不影响任务状态或办理路径。

## 依据、尺寸与状态

- 源图：`docs/commission-design/commission-folio.png`，1591×988像素，是同时包含场景、物件放大和页面的设计板，不是固定游戏视口。
- 正式构建：`http://127.0.0.1:4187/`；开发游戏：`http://127.0.0.1:5173/`。
- 最终截图：`docs/commission-design/evidence/page-wide-final.png`，实际像素与 CSS 视口均1400×930，设备像素比1。
- 低高度桌面：`docs/commission-design/evidence/page-production.png`，1280×720像素与视口。
- 世界木匣：`docs/commission-design/evidence/world-production.png`，1280×720。
- 对照状态：南路补给可领取、旧道待调查、目标未完成、启程补给未领取。领取及重开后的进行中状态另外记录，不混入同状态比较。

## 同屏对照与归一

完整面板：`docs/commission-design/evidence/comparison-wide-final.png`。左侧源图裁取(521,57)，1043×890；右侧最终运行图裁取(140,16)，1120×898。两侧分别等比放入1100×940区域，保持纵横比，不拉伸，不声称逐像素复制。游戏页面居中，设计板页面安排在场景右侧，展示位置差异不作为缺陷。

正文细节：`docs/commission-design/evidence/comparison-detail-final.png`，比较标题、正文、目标、路线和奖励。场景局部：`docs/commission-design/evidence/comparison-world.png`，左设计、右实际世界，物件按游戏尺度显示。

低高度对比另存 `evidence/comparison-page.png`，实际采用紧凑字号与插画高度，按内容层级和完整操作判断。早期1591×988和1440×960截图请求超出部分内置浏览器截图范围，实际返回1497×988或1440×950；这些过程截图保留，不用于一比一结论。最终使用已核对像素的1400×930截图。

## 五项视觉检查

| 检查面 | 结论 |
| --- | --- |
| 字体 | 原生宋体类标题、签页与操作，系统中文无衬线正文。宽屏标题40px、正文18px、分段标题23px；低高度桌面标题32px、正文16px。窄屏和短屏单独适配。真实中文自然换行，无省略。 |
| 间距与布局 | 保留签页、索引、左文右图、底部操作的阅读顺序；正文内部滚动。图标全用正常 flex/grid 文档流，无绝对定位。宽屏目标、奖励与操作完整可见。 |
| 色彩 | 墨绿文字和布纹按钮、奶油旧纸、胡桃木框、旧黄铜延续方案2；状态有明确文字。背景村庄适度模糊，保持地点上下文。 |
| 图片 | 木匣、路线、木框、按钮、铜币均为真实位图。木框和按钮九宫格保留材质；透明边缘清晰，压缩后无明显光晕。路线保留南门、桥、药草和孢根关系。 |
| 文案 | 采用正式名称“孢根巢地”；启程补给与完成奖励分开，数量与原业务一致；修路必须先调查。主线7步、木匠支线和技艺记录保留。 |

## 迭代记录

1. P2：初版1280×720奖励落到较低位置。证据 `evidence/page-before-spacing.png`。收紧低高度内边距、分段间距、字号和插画高度；同尺寸复验 `evidence/page-desktop.png`、`evidence/page-production.png`，奖励与操作完整可见。
2. P2：初版740×360仍为单列及两排操作，阅读区过小。证据 `evidence/page-short-before.png`。增加横向短屏的紧凑签页、双列索引、左右正文和并排操作；同一进行中状态复验 `evidence/page-short.png`、`evidence/page-short-scroll.png`。最终正式构建可领取状态再验 `evidence/page-short-final.png`、`evidence/page-short-scroll-final.png`。
3. P2：宽屏正文和奖励字体比概念图偏小。证据 `evidence/comparison-tall-before-fonts.png`、`evidence/comparison-detail-tall-before-fonts.png`。增大宽屏标题、正文、奖励及道具图标，明确保留低高度字号；最终并列复验 `evidence/comparison-wide-final.png`、`evidence/comparison-detail-final.png`，并重验窄屏和短屏。概念图与游戏的纸页比例不同，不以宽度归一后的文字面积推断像素相等。

最终完整面板、正文细节和场景组合图均已实际打开查看；无剩余需修复的 P0/P1/P2，保留上述 P3 差异。

## 真实交互与响应式

- E打开，鼠标切换两份委托和旅途手记，Esc关闭后HUD恢复；未调查的旧道按钮禁用且说明原因。
- 鼠标领取后提示获得恢复药剂两瓶，关闭后快捷栏数量2。证据 `evidence/production-receipt.png`。
- 重新载入正式存档后仍为进行中、补给已领取。证据 `evidence/production-reloaded.png`。
- 焦点进入委托索引，Tab/Shift+Tab在页内循环，选中和焦点可见；反馈使用状态播报。
- 390×844：`evidence/page-narrow-final.png`、`evidence/page-narrow-scroll-final.png`，奖励和插画可滚动读全，领取与关闭常显。
- 740×360：`evidence/page-short-final.png`、`evidence/page-short-scroll-final.png`，操作并排，目标和奖励可滚动阅读。
- 最终正式构建未出现控制台错误或警告。定位样本只调整初始站位，领取、关闭、保存和重开均通过真实界面。

## 工程验证与边界

本轮正式构建快照的类型检查和构建通过；4个相关测试文件的26项测试通过，当前共享目录后续变化见增补。最终字体修改后重新构建通过。完整对抗审查见 `docs/commission-design/implementation.md`：VERDICT: PASS，P0/P1 BLOCKERS为空。

本轮未重新真实通关清营、交付和修路旅程，相关结算由正式快照和保存锁测试覆盖；未测其他浏览器和长时间设备性能。美术最终接受由用户查看实际截图确认。

## 实现检查单

- 已接入广场物件及正式入口。
- 已保留委托、主线、支线、技艺与存档逻辑。
- 已保存源图、生产素材、并列对照和真实运行证据。
- 已修复本轮三项 P2 并复验。
- 已完成桌面、窄屏、短屏及正式构建检查。

## 交付前增补

共享目录随后出现荒野遭遇与石阵状态扩展。当前初始样本已实际打开新委托簿并领取，截图另存 `evidence/page-current-dev.png`、`evidence/receipt-current-dev.png`；视觉结果仍为 passed。

最新相关回归为25/26，委托簿四项全部通过，一项荒野出生断言因新增单位失败。当前旧存档兼容另有成立的P1，已在 `docs/commission-design/implementation.md` 单列完整因果链与反证，当前共享目录发布审查为 FAIL。视觉检查通过不代表整个共享目录可以发布。
