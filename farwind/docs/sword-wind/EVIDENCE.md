# 剑风证据索引

最新认可范围：上撩动作与地面切痕。此前未验收的描述保留为对应阶段历史，当前状态见末节“认可状态收尾”。

## 素材先行

阶段 A 在玩法修改前完成并汇报；自检记录见 [素材门禁](ASSET_REVIEW.md)。[生成摘要与否决原因](assets/PROMPTS.md)、[逐帧元数据](assets/metadata.json)、[固定可播放预览](assets/preview.html) 与全部透明源图保留在本目录。

| 内容 | 路径 |
| --- | --- |
| 二十四帧角色接触表 | [角色图集](evidence/hero-sword-wind-contact.png) |
| 离刃／飞行 | [离刃](evidence/sword-wind-release-contact.png)、[飞行](evidence/sword-wind-flight-contact.png) |
| 命中／自然消散 | [命中](evidence/sword-wind-hit-contact.png)、[消散](evidence/sword-wind-dissolve-contact.png) |
| 正常比例／放大检查 | [正常比例](evidence/preview-normal-browser.png)、[三倍放大](evidence/preview-enlarged-browser.png) |
| 独立素材正常速度播放 | [素材录像](evidence/asset-preview.webm)，没有游戏音轨 |

重新打包：`npm run assets:sword-wind`。预览地址：开发服务下的 `/docs/sword-wind/assets/preview.html`。图集位于 `public/assets/animation/sword-wind/`，主素材登记保留临时标志。大批否决源图未由场景加载。

## 实机画面与真实音轨

以下 MP4 均为一千二百八十乘七百二十正常游戏比例、未变速录制，含实际游戏音频总线输出。没有补配命中声音，没有改运行中血量、位置、计时器或强制生成命中。声音已确认存在非静音轨道，音色没有完成试听验收。

| 用例 | 录像与说明 |
| --- | --- |
| 完整四连与共线两敌 | [双靶四连](evidence/two-targets.mp4)。明确标识的独立固定夹具；史莱姆原生命四十八，只伤 A，B 保持四十八；不运行敌人 AI。按键使用正常固定节奏，诊断只作事后断言。 |
| 真实冒险敌人 | [冒险实机](evidence/adventure.mp4)。合法起始存档，原地图、敌人 AI 和强度；前三刀挥空，剑风将四十八生命史莱姆打到十二。 |
| 只按三次与长按 | [三刀不发射](evidence/three-only.mp4) |
| 四方向与原三连统计 | [四向木桩](evidence/four-directions.mp4)。四段合法起始存档，包含菜单导入与会话重置；画布左键接入也在本例验证。 |
| 射程终点／撞墙 | [射程与实体阻挡](evidence/range-wall.mp4)。两种结束原因均没有敌人命中确认。 |
| 取消／暂停／标题清理 | [取消与暂停](evidence/cancel-pause-title.mp4) |
| 自动反斩与停顿预约 | [反斩接第四击](evidence/parry-fourth.mp4)。只读诊断辅助输入，正式裁决，没有强制成功。 |
| 离刃后风步与旧攻击统计 | [远程木桩命中](evidence/remote-dash-training.mp4) |
| 死亡、掉落只结算一次 | [死亡掉落](evidence/death-drop.mp4)。独立固定夹具，复用正式伤害入口。 |
| 原生标签失焦、保存继续 | [真实失焦与存档](evidence/save-focus.mp4)。关闭浏览器测试的强制焦点仿真后实际切换原生标签；没有派发假失焦事件。 |
| 关闭临时授予 | [第三刀重启第一刀](evidence/grant-off-restart.mp4)、[关闭后保存继续](evidence/grant-off-save-focus.mp4) |

原生 Codex 浏览器还直接进行了自然键盘四连，画面见 [原生离刃截图](evidence/game-native-fourth.png)。该操作保留了已有本地存档，没有确认覆盖。自动化实机证据与此自然操作分别标识，不能互相替代。

媒体轨道、峰值及模拟／墙钟统计见 [媒体检查](evidence/media-check.json)。双靶连续录像的模拟／墙钟比约为零点九八五，包含三十二毫秒命中停顿；补入停顿后接近正常实时推进。多段导入／暂停录像的全段比值不能用于评估播放速度或设备性能。

最终只读状态分别为同名 JSON。冻结副本源码摘要见 [开发授予](evidence/runtime-5193.json)、[关闭授予](evidence/runtime-5194.json)。普通生产检查见 [生产状态](evidence/production.json) 与 [生产截图](evidence/production-three-chain.png)。

最终汇总见 [验证一致性](evidence/verification.json)：关键源码及五图集与已验副本没有摘要差异，四组浏览器报告均没有失败、跳过或自动重试。

## 本地重现

- `npm test`：明确枚举并执行新增逻辑与素材测试。
- `npm run test:sword-wind`：开发授予十个实机用例。
- `npm run test:sword-wind:off`：关闭授予的三个用例。
- `npm run test:sword-wind:production`：独立输出目录生产构建与默认三连检查。
- `node tools/mux-sword-wind-evidence.mjs`：用本机已有 FFmpeg 封装真实音视频。

原始录音、浏览器视频、逐帧诊断、失败现场、冻结副本和构建均在被忽略的 `.sword-wind-local/`。测试服务只绑定本机，没有公开部署。原弹反报告没有被覆盖。

## 本轮新版：从下往上挥剑与地面切痕

本节为最新状态；前面的首轮汇总保留为历史，部分同名实机录像已用本轮最终素材重新录制。

| 内容 | 路径与验证边界 |
| --- | --- |
| 三视角升斩源帧 | `assets/hero-down-rise-source.png`、`assets/hero-up-rise-source.png`、`assets/hero-side-rise-source.png`。每视角八帧，内置图像生成；旧源图保留。 |
| 地面碎裂源帧 | `assets/ground-source.png`，六帧，窄裂缝与碎土；仅呈现。 |
| 生成／打包／元数据 | `assets/PROMPTS.md`、`tools/pack-sword-wind.mjs`（仓库根目录下）、`assets/metadata.json`。源裁切、固定根、柄尖与刃面接点均可复核。 |
| 固定预览 | [正常比例](evidence/rise-preview-normal-browser.png)、[放大检查](evidence/rise-preview-enlarged-browser.png)、[正常速度素材录像](evidence/rise-asset-preview.webm)。素材录像没有游戏音轨。 |
| 原速实机与实际音轨 | [上撩及地面残痕](evidence/rise-ground.mp4)。独立合法共线夹具、只读诊断辅助键盘；含真实菜单暂停和标题清理，不运行敌人 AI。 |
| 真实录像取帧 | [上撩离刃](evidence/rise-release-game.png)、[飞行划地](evidence/rise-ground-flight-game.png)、[首目标处停止](evidence/rise-ground-first-target-game.png)。分别为同一录像约第二点九八、第三点零八、第三点二三秒，无摆拍或补画。 |
| 主游戏自然操作 | [自然四连截图](evidence/rise-native-fourth.png)。原生浏览器继续已有存档，实际键盘四连，未覆盖存档或强制发射。 |
| 正式地图真实敌人 | [正式冒险](evidence/adventure.mp4)，本轮素材重录，原敌人 AI、伤害与地图规则。 |
| 汇总与音轨检查 | [最新验证汇总](evidence/rise-verification.json)、[实际媒体信息](evidence/media-check.json)。本轮十六个浏览器检查通过，声音只验证实际轨道与信号，音色未独立主观验收。 |

`npm run test:sword-wind` 已枚举新地面视觉用例，当前共十一项；录制配置集中在 `tools/playwright-sword-wind.config.ts`，辅助操作文件不再顶层修改测试选项。本轮已测范围和曾出现的失败首因见 [实现报告](REPORT.md) 的本轮改进部分。用户美术认可、手感和设备长期性能仍未验收。

## 认可状态收尾

用户已通过上撩动作与地面切痕，认可的实际图集、范围及排除项见 [认可记录](assets/acceptance.json)。这两项取消临时标记，其余四个效果仍待最终美术验收。早期未认可的记录保留为对应阶段历史。

| 内容 | 路径与边界 |
| --- | --- |
| 素材状态与逐帧元数据 | [元数据](assets/metadata.json)，逐项记录认可与临时状态；[固定预览](assets/preview.html) 按元数据显示状态 |
| 本次固定预览 | [正常比例](evidence/acceptance-preview-normal-browser.png)、[放大检查](evidence/acceptance-preview-enlarged-browser.png)、[正常速度素材录像](evidence/acceptance-asset-preview.webm)，素材录像无游戏音轨 |
| 本次实机录像 | [认可后的四连与地面切痕](evidence/acceptance-rise-ground.mp4)，独立合法共线夹具、真实键盘与菜单、只读诊断；原速及真实游戏音轨，不运行敌人人工智能 |
| 只读状态与音轨 | [最终状态](evidence/acceptance-rise-ground.json)、[媒体检查](evidence/acceptance-media-check.json)，证明首靶停止和音轨信号，不代表音色、手感或设备性能认可 |
| 本次验证与图集一致性 | [收尾验证](evidence/acceptance-verification.json)，六图集摘要不变、关键受测文件摘要一致；类型检查、十六文件二百九十一项逻辑测试、两项浏览器检查与生产构建通过 |

复现本次浏览器检查：`FARWIND_WIND_RUN=acceptance npx playwright test tests/sword-wind-assets.spec.ts tests/sword-wind-rise.spec.ts --config tools/playwright-sword-wind.config.ts`。产物使用独立名称，不覆盖上一轮录像。原始轨道和逐帧诊断仍留在忽略目录。

## 一线斩风呼啸更新

| 内容 | 路径与验证边界 |
| --- | --- |
| 默认游戏音量试听 | [新风呼啸](assets/audio/wind-howl.wav)、[改动前释放声](assets/audio/wind-release-before.wav)；原创合成，新声音四百六十毫秒，主观音色待用户判断 |
| 制作来源与复现 | [制作元数据](assets/audio/howl-metadata.json)、[声音验收](AUDIO_REVIEW.md)；`npm run assets:sword-wind:audio` |
| 真实四连与实际游戏音轨 | [风呼啸实机演示](evidence/wind-howl-game.mp4)、[录像取帧](evidence/wind-howl-game.png)；实际本机五一七三实例，明确共线夹具，真实键盘，不运行敌人人工智能 |
| 暂停与静音 | [实际菜单操作录像](evidence/wind-howl-pause-mute.mp4)；停止尾音、恢复不补播、静音不改变正式伤害 |
| 只读诊断与释放次数 | [四连状态](evidence/wind-howl-game.json)、[声源启动](evidence/wind-howl-game-starts.json)、[暂停静音状态](evidence/wind-howl-pause-mute.json)；不强制发射或改运行中状态 |
| 实际音轨与验证汇总 | [媒体检查](evidence/wind-howl-media-check.json)、[本轮验证](evidence/wind-howl-verification.json)；音视频墙钟对齐、正常比例及速度，没有后配试听声音 |

复核：`npm run test:sword-wind:audio`。原始轨道、首次重载失败和测试追踪留在忽略目录，历史素材与弹反报告保留。隔离测试页面屏蔽并行源码编辑的热更新，实际网络和战斗逻辑未模拟；用户自然试玩保留热更新。
