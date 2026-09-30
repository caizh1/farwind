# 战斗专项验证记录

## 来源与验收范围

起点为 `codex/initial-game`、`13b8542c62edc789dcf9497dc3a86c980552b20e`。原脏树、原始源码与首轮失败保留在 `.enemy-local/combat-feel/initial` 和 `baseline`。没有切分支、提交、推送、部署、停止其他进程或覆盖他人业务代码。另一个首图任务已在独立工作树，本轮只读核对。

首轮 `npm test` 重写了原已修改的三份 NPC 统计证据：`facility-combat-unit.json`、`navigation-performance.json`、`simulation-performance.json`。启动时没有保存其原始字节，不能声称这些统计完全未触及，也没有用 Git 恢复去覆盖原脏树。后续回归通过 `preserve-combat-evidence.cjs` 将文档证据写入本轮独立目录；原业务代码和其他任务文件保留。

最终游戏源码摘要为 `00dc5a7241af80d8c7e7e7094403ab9d009ef8e2d19e58f36dfbde9820c18580`，主包 `game-COGG0V_8.js`。摘要按排序后的全部 `src` 文件路径、空格、各文件 SHA-256、换行拼接再计算；逐文件、构建和录像摘要见 `delivery-manifest.json`。最终正常速度实录、十分钟长测、定向逻辑与正式构建专项使用这一份游戏源码。后续仅完善测试工具和文档。

隔离样板只设置合法初始位置、无装备加成、成长和敌人；实际键盘、正式控制器、AI、碰撞、伤害、死亡和保存产生结果。正式世界要求玩家真实命中后小宝介入或守卫补刀；不将只有 AI 出手登记为玩家战斗通过。

## 实际命令与结果

工作目录均为 `/Users/archer/Documents/ChatGPT/Game/farwind`。下表日志位于 `.enemy-local/combat-feel/`；工具原始输出保留，中文解释如下。

| 检查 | 实际命令 | 结果与日志 |
| --- | --- | --- |
| 起点全量单测 | `npm test` | 734 项，733 通过、1 超时；169.33 秒；`initial/baseline-test.log` |
| 起点构建 | `npm run build -- --outDir .enemy-local/combat-feel/initial/baseline-production` | 通过，包含 TypeScript；`initial/baseline-build.log` |
| 最终定向逻辑 | `NODE_OPTIONS='--require /Users/archer/Documents/ChatGPT/Game/farwind/tools/preserve-combat-evidence.cjs' FARWIND_EVIDENCE_ROOT=.enemy-local/combat-feel/e2e-evidence npx vitest run tests/combat-feel.test.ts tests/parry.test.ts tests/enemy-combat-v1.test.ts tests/sword-wind.test.ts tests/village-integration.test.ts` | 188 项、5 文件通过；1.89 秒；`targeted-counter-final.log` |
| 最后独立类型检查 | `npm run typecheck` | 最后游戏源码与测试修改之后通过；`typecheck-delivery-last.log` |
| 最终正式构建 | `npm run build -- --outDir .enemy-local/combat-feel/production` | TypeScript 与构建通过；Vite 945ms；`build-counter-final.log`；仅既有大包提示 |
| 最终专项开发浏览器整轮 | `npx playwright test --config tools/playwright-combat-feel.config.ts` | 11 项中 10 通过、1 总时限超时；6.9 分钟；`browser-complete.log` |
| 保存用例总时限复核 | `npx playwright test --config tools/playwright-combat-feel.config.ts --grep save-delay-300` | 修正完整流程总时限后 1/1 通过；21.6 秒；`save-300-wall-gate.log` |
| 最后保存窗口复核 | `npm run test:e2e -- --config tools/playwright-combat-feel.config.ts --grep save-delay` | 修正只读采样竞态后 300/1000ms 两项通过；44.4 秒；`save-probe-final.log`；故障时长与存档断言不变 |
| 最终正式构建浏览器 | `COMBAT_PRODUCTION=1 npx playwright test --config tools/playwright-combat-feel.config.ts` | 玩家与小宝、守卫补刀、真实致死回城三项通过；1.0 分钟；`production-counter-final.log`；生产无 `__combatFeel` |
| 当前地图正式交易 | `npx playwright test --config tools/playwright-combat-feel.config.ts --grep complete-world-economy`；生产加 `COMBAT_PRODUCTION=1` | 开发 1/1，42.1 秒；生产 1/1，41.0 秒；`economy-open-boundary-{development,production}.log`；实际钱物库存、交易暂停和刷新一致 |
| 最后声库保护 | `npm run test:e2e -- tests/parry-feedback-v3.spec.ts --workers=1 --grep 'V3-AB-B-normal\|V3-AUDIO-real-context-cache-release-mute' --output=.enemy-local/combat-feel/audio-bank-isolated-tests --reporter=list,json` | 最后同轮 2/2 通过，12.4 秒；`audio-bank-isolated.log`；独立接口不加载世界，正式弹反 B 在实际游戏内；环境变量见下方完整命令 |
| 最终全量逻辑 | `NODE_OPTIONS='--require /Users/archer/Documents/ChatGPT/Game/farwind/tools/preserve-combat-evidence.cjs' FARWIND_EVIDENCE_ROOT=.enemy-local/combat-feel/e2e-evidence npm test -- --maxWorkers=2` | 781 项，771 通过、10 超时；46 文件中 41 通过；587.55 秒；`unit-complete.log` |
| 常规全量浏览器 | `NODE_OPTIONS='--require ./tools/preserve-combat-evidence.cjs' FARWIND_EVIDENCE_ROOT=.enemy-local/combat-feel/e2e-evidence PLAYWRIGHT_JSON_OUTPUT_NAME=.enemy-local/combat-feel/e2e-results.json npm run test:e2e -- --workers=1 --output=.enemy-local/combat-feel/e2e-output --reporter=list,json` | 227 项运行结果在最后一节记录；跨实现过程运行，早期用例不作为最后游戏源码证据；`e2e-final.log` |
| 正常速度录像 | `COMBAT_FEEL_VERSION=candidate-complete node tools/record-combat-feel-suite.mjs`；`COMBAT_FEEL_VERSION=baseline-complete node tools/record-combat-feel-suite.mjs` | 候选 13 场景、基线 12 场景，页面错误均为 0；`record-*-complete.log` |
| 单怪同条件对照 | `node tools/measure-combat-feel.mjs`；`COMBAT_FEEL_VERSION=baseline node tools/measure-combat-feel.mjs` | 四种敌人均实际击杀；`enemy-metrics-{candidate,baseline}.log` |
| 十分钟检查 | `COMBAT_FEEL_VERSION=candidate-complete node tools/soak-combat-feel.mjs` | 600.095 秒、56 轮重置、133 次正式击杀、页面错误 0；`soak-complete.log` |
| 补丁与撤销预检 | `git diff --check`；`node tools/revert-combat-feel.mjs` | 通过；30 个本轮文件、全部原始副本摘要核对；撤销工具只执行只读预检，没有执行 `--apply` |

新增 47 个逻辑用例已被常规 `npm test` 实际执行。默认 `npm run test:e2e -- --list tests/combat-feel-world.spec.ts` 最后发现 12 项。追加交易前，从该 npm 入口执行 11 项专项：10 通过、1000ms 晚采样断言失败，原始输出为 `browser-package-final.log`；最后从同入口重跑两个受影响保存用例通过，并追加真实交易开发/生产通过。累计覆盖 12 项开发、4 项生产，不宣称一次整轮全绿。专项覆盖输入有限寿命/边界/优先级/体力/清理、第四段单次发射、弹反反斩、正式多目标、反馈唯一及回收、击退碰撞、护甲与有限破防、许可释放及作用域、自动保存与事务顺序/合并确认/失败/会话屏障、交易原子提交。输入逻辑使用 5、16.667、33.333、50ms 与不规则步长，不能只靠固定单步通过。

最后声库命令的完整环境（仅为排版换行）：

```sh
NODE_OPTIONS='--require /Users/archer/Documents/ChatGPT/Game/farwind/tools/preserve-combat-evidence.cjs' \
FARWIND_EVIDENCE_ROOT=.enemy-local/combat-feel/e2e-evidence \
FARWIND_V3_EVIDENCE_ROOT=docs/combat-feel/demo/validation/audio-bank-isolated \
FARWIND_V3_RAW_ROOT=.enemy-local/combat-feel/audio-bank-isolated \
PLAYWRIGHT_JSON_OUTPUT_NAME=.enemy-local/combat-feel/audio-bank-isolated-results.json \
npm run test:e2e -- tests/parry-feedback-v3.spec.ts --workers=1 \
  --grep 'V3-AB-B-normal|V3-AUDIO-real-context-cache-release-mute' \
  --output=.enemy-local/combat-feel/audio-bank-isolated-tests --reporter=list,json \
  > .enemy-local/combat-feel/audio-bank-isolated.log 2>&1
```

## 原失败、本轮回归与脚本首因

- 首轮旧失败是 NPC 救护闭环超过原 5000ms。原源码三文件对照为 69 项中 66 通过、3 超时，223.15 秒，复现救护、村门袭扰、五日运行，见 `baseline-timeout-attribution-fixed.log`。不能将其它后续超时都归为已确认旧问题。
- 最终全量 10 项全为超时，无新的逻辑断言失败：东门离屏普通组、弓手死亡（各 5000ms）；松岚新游戏 30Hz 朝向（5000ms）；NPC 救护、轻伤、村门袭扰（各 5000ms）；三居民一日（30000ms）、五日（60000ms）、失败防线救护（30000ms）；历史四怪事件恢复（20000ms）。未改这些保护门槛，未归因项保持未验证。软件渲染与同时运行多套回归带来负载，但负载关联不能单独证明根因。
- 中间全量抓到本轮真实回归：旧风步预约抢占新弹反，体力 80 而保护断言要求 88。已修复新弹反替换旧预约，保留原断言并增加反例。零时长裁决更新曾漏接群战许可，已接入与正常更新相同的判断；实际取样所有成员均有出手，没有永久占用。
- 原源码对照旧 `adventure/combat-action/combat-feel/combat-followup/combat` 八项为 2 通过、6 失败，16.2 分钟，见 `baseline-browser-comparison.log`。探险的旧目标、森林导入回安全点与当前首因匹配；四方向动作原版失败于第一段未采到，当前失败于帧集合不完整，不能归为同一根因。河岸、多目标、显示衔接在两版均超时，只证明原版也未通过，仍保留当前首因未归因。
- 对常规回归中新出现的旧接触与 NPC 用例追加原源码对照：`npx playwright test --config tools/playwright-combat-baseline.config.ts --grep '隔离森林夹具：侧向|居民真实日常'`。两项均失败，49.12 秒；NPC 共用启动助手在第 15 行要求 `schema_version === 8`，起点实际已是 13，首因一致。接触用例表面错误不同：原源码在第 64 行未采到预期命中，当前在第 62 行读取不存在敌人的 `hp`。进一步解码原始 trace 的只读采样：当前 108 条、原源码 136 条均从未包含夹具要求的 `leaf-1`，首次敌人标识完全相同；当前采到六次第二刀有效姿态，原源码没有采到，因此更早暴露了同一无目标前置条件。证据为 `demo/validation/contact-failure-analysis.json`、`baseline-object-attribution.log` 和对应 JSON。不修改旧断言，不把完整接触或 NPC 旅程登记为通过。
- 上述无目标前置条件的代码链已定位：`leaf-1` 属于 `east-brook-reapers`，静态出生会过滤遭遇成员；`initialState` 的遭遇尚未激活，`WildernessEncounters.update` 为避免眼前突然刷怪，拒绝在视野内或距离玩家不足 350px 的首次激活。旧夹具直接导入目标旁约 65px，既没有沿正式探索接近，也没有设置合法的已激活遭遇，因此目标不出生。该调度和地图定义在原源码中已存在，本轮没有改这条生成门禁。
- 夜袭恢复两项在原源码同样等待 `pending → started` 40 秒、`pending → cancelled` 15 秒失败；故障后的不出生、暂停、旧计划保留断言达到。恢复未登记通过，见 `baseline-night-failure.log`。
- 第四段多目标脚本首轮误用只有单穿的一阶段。改用现有二阶段“双穿”的合法初始成长，生产参数不变；正式发射和双目标命中通过，不代表学习任务通过。
- 完整世界首轮脚本没有先输入面向目标方向，玩家挥空；改为真实 `D` 确认朝向并要求正式玩家命中与 AI 介入。生产脚本曾误读开发专用 `session.combat`，现改查真实位移及正式驻防历史。
- 死亡回城脚本曾误查不记录玩家接触的驻防历史，再误查会被同帧“抵达”覆盖的最后提示。保留首因；现在用真实 DOM 变更观察、正式回城位置/生命/行囊/保存，开发版另要求正式致死接触，不改死亡权威。同帧提示替换为原有显示问题。
- 300ms 保存用例在第二次标题装载耗尽 45 秒整流程门槛，trace 中击杀、显式保存已完成；专项总时限改为 90 秒后该用例通过。动作边界、模拟时间、队列和存档断言不变，旧常规 240 秒及单测门槛不变。录像/长测冷启动首因也保留，仅冷装载等待扩大，战斗等待不扩大。
- 最后反证发现非致命反斩遗漏实际伤害字段；已由正式结果补齐来源、阶段、实际伤害、防护、打断和死亡。新增真实 `K` 测试要求一次反斩、目标生命差与实际伤害一致、玩家没有受伤。旧录像一段只有架剑，保留为中间证据；最终两版实录都等待正式弹反接触及反斩命中。
- 常规 npm 入口检查发现 1000ms 写入已完成后，跨进程的晚采样仍要求它在写入，失败快照已确认模拟推进和持久化。现在在故障窗口内观察有界只读样本，保留 >80ms 模拟推进和真实 J 输入断言。最后 1000ms 用例在真实写入窗口内记录 53 条样本、292.195ms 模拟推进；真实 J/L/K 采集均发生在队列仍忙时。风步实际执行另有正式记录；该 K 的执行仍受原窗口限制，不将采集冒充成功弹反，成功弹反由独立真实键盘用例证明。故障仍是 1000ms，不注入更长延迟来美化结果，原首因在 `browser-package-final.log`。
- 追加当前地图商店测试时，脚本在真实 E 交互被下一帧处理前取了暂停时间，开发版首轮因此失败，生产版首轮通过。现在先等待真实店铺标题可见，再取暂停边界；交易时钟严格相等断言不变。两版最后都通过，旧失败保留在 `economy-development-final.log`，没有修改交易或世界时间代码。
- 证据保护工具的相对预加载路径被素材子进程继承，临时目录无法加载。改用绝对路径，并限定写入映射到本工程；原素材三项通过，4.72 秒，断言未改。
- 常规浏览器旧 V3 反馈用例期间，Node 测试工作进程出现 `Reached heap limit`，日志 GC 堆约 4.1GB；执行器随后另起工作进程继续。A/C 失败诊断分别约 252/256MB，原采样每帧含完整反馈历史，外部最多保留 1800 帧，跨进程重复展开规模很大。具体内存热点仍未完全归因；没有提高堆上限、删原记录或将工作进程崩溃直接归为浏览器游戏崩溃，也没有据此宣称游戏零泄漏。证据为 `e2e-final.log` 和 `.parry-local/v3/failures` 对应当次记录。
- V3 的 C 普通弹反视觉用例在第 44 行等待 `normal` 超时；原始失败状态中练习控制器保存 `parried.perfect === true`，木桩第一段反斩伤害为 30，玩家生命 100。输入已发动，但实际质量没有满足该脚本期望。截图采集、处理和实际起按的窗口偏移尚未完成设备对照，不将该失败归为已确认旧问题或输入丢失；小型提取记录在 `demo/validation/legacy-feedback-first-cause.json`。
- 原 `water-lifecycle` 的真实场景 stop/start 触发小宝在 shutdown 中渲染已销毁精灵。追加起点源码对照 `npx playwright test --config tools/playwright-combat-baseline.config.ts --grep water-lifecycle`，同一调用链失败，15.38 秒，日志 `baseline-water-attribution-executed.log`。首次精确标题正则没有匹配测试，只产生 `No tests found`，原输出保留。正式菜单保存/标题/继续已有通过证据，不把直接场景重启失败登记为通过，也不扩展修复原有小宝生命周期问题。
- 两项 V3 声库断言要求 33、实际 96，属于本轮扩展声库导致的保护测试契约变化。原 33 声保留，护甲反斩增加 3 个，五类命中四材质三变体增加 60 个；更新固定总数，并加强旧声完整性、重复预热不增长、最大 16 并发、自然释放及销毁清空。原发声次数、威胁总线、静音、重置断言均保留。
- 声库复核首轮暴露测试观察对象共享事件数组，新增发声把较早重置观察变为 96 条；改用当时独立副本。随后墙钟 15ms 观察错过原 150ms 音频窗口；通过真实菜单暂停后曾通过，但再次测到实际回调延迟 304.5ms、音频时钟推进 304ms，窗口已结束。原始观察和失败分别保留在 `audio-bank-{final,complete,verified,paused,delivery}.log` 与对应结果；没有延长音频效果或放松增益断言。
- 最后独立音频接口不加载世界，使用测试文档中的真实按钮取得用户交互，再导入正式 `Sound` 和真实 `AudioContext`。正式弹反 B 仍在实际游戏内，通过相同原发声、唯一接触、伤害与连段断言。最后两项同轮 **2/2 通过，12.4 秒**（`audio-bank-isolated.log`）；原 33 声完整、固定缓存 96、最高并发 16、播放结束声音 0、销毁缓存 0。最终记录为 `demo/validation/audio-bank-final.json`。实际墙钟等待 16.1ms、音频时钟推进 16ms，各自同钟计算，非关键总线增益约 0.664；保留原 15ms 观察并在原音频窗口内有界取样。测试文档不是战斗演示，接口通过不作为正式击杀或玩家听感证明；游戏源码、音频时长和混音代码没有因这些测试修正而改变。

## 保存故障与一致性

通过正式三段普攻击杀后继续攻击、风步和弹反；没有直接写死死亡或生命结果。

| 条件 | 已验证结果 | 证据 |
| --- | --- | --- |
| 300ms 写入 | 击杀后模拟和输入继续；显式保存、刷新恢复唯一死亡与遭遇成员状态 | `demo/validation/save-300-final.json` |
| 1000ms 写入 | 真实写入窗口内模拟推进 292.195ms、J/L/K 被采集；风步实际执行、最终刷新一致 | `demo/validation/save-1000-final.json` |
| 写入失败 | 旧有效磁盘档未击杀，内存已击杀；战斗继续，下一次显式保存成功 | `demo/validation/failure.json` |
| 写入中切会话 | 等真实旧写入结束再建新样板；切换按键不补放，新档没有旧敌人死亡 | `demo/validation/session-switch.json` |
| 合并、满队列、交易交错 | 合并调用者等实际写入；关键请求独立确认、FIFO；失败不发布/扣款；队列有界 | `tests/combat-feel.test.ts` 定向与常规结果 |
| 正式商店交易 | 金币 120→102、药剂 0→1、库存 8→7、交易版本 0→1；开店后世界时钟不变，刷新钱物库存一致 | `demo/validation/world-economy-final.json`；两版原始快照和命令日志保留 |

普通周期为 5000ms **模拟时间**，击杀沿原进度入口即时请求。正常保存并返回标题等待关键写入。强制终止可能丢失尚未捕获或未写完的进度，未承诺异步写入必定完成。失败保留内存及旧有效磁盘档，提示限频；关键事务继续使用锁及原失败行为。自动快照完成只确认持久化副本，不重新发布到活世界。

## 正常速度、声音与实际操作

最终对照为 `demo/baseline-complete/normal-speed.mp4`（46.30 秒，12 场景）与 `demo/candidate-complete/normal-speed.mp4`（63.42 秒，13 场景）。均为 1280×720、25fps 编码、H.264/AAC，未变速；25fps 是录像编码率。

两版包含单史莱姆连续攻击、击杀后继续、风步尾部攻击、真实弹反及正式反斩、守卫正面防护/第三刀破防、孢卫弹道/弹反/接近、林豕真实树障撞墙/追打、第四段双穿、四只群战与切换目标、玩家与小宝/守卫的完整世界。候选多出一段 1000ms 保存中继续输入。合法输入策略相同，实际结果、受伤和场景时间不同，不剪成虚假等长对照。逐场景正式历史在各自 `diagnostic.json`。

实际 `AudioContext` 旁路音轨及同步墙钟保留在 `audio.webm`、`audio-sync.json`。最终基线均值 -32.5dB、峰值 -5.8dB；候选均值 -35.4dB、峰值 -7.0dB。证明有真实音轨且无数字削顶，不能证明设备听感与扬声器平衡。

已查看正常速度片段取帧和场景截图。在原生内置浏览器通过鼠标重置/收起样板并真实按 `J/K/L`，观察攻击衔接提示与空弹实际扣除 12 体力；原生操作未获得足够证据确认一次成功弹反，成功弹反由专项真实键盘和实录证明。操作后的实际受伤画面保留在 `demo/validation/native-final-preview.png`；随后真实点击隔离重置，最终待试玩画面为 `demo/validation/native-reset-preview.png`，预览保留在暂停状态。原生下拉框的自动操作接口无法完成切换，未据此登记原生全部样板或硬件帧率通过；自动化专项已分别覆盖。关闭数字/震屏的场景图为 `demo/validation/no-numbers-no-shake.png`。玩家主观反馈辨认、听感与爽快感均未验收。

## 四种敌人：同条件动作与时间

无装备加成、剑风关闭、无伙伴或驻防。两版使用同一真实按键策略；每种各一段固定样本，不能作为统计显著性或玩家效率结论。模拟击杀时间从场景开始观测到正式死亡；不与工具墙钟相减。有效伤害动作按发生真实生命差的攻击序号去重，空等是相邻采样均无动作/预约/移动的模拟间隔，可能漏计，零值不等于完全无空等。

| 样板（生命） | 基线有效动作 / 起手数 | 候选有效动作 / 起手数 | 基线 / 候选击杀模拟毫秒 | 基线 / 候选采样空等毫秒 |
| --- | ---: | ---: | ---: | ---: |
| 史莱姆（48） | 3 / 3 | 3 / 3 | 881.74 / 715.33 | 33.32 / 33.33 |
| 守卫（84） | 6 / 6 | 6 / 6 | 1698.67 / 1709.49 | 0 / 0 |
| 孢卫（60） | 4 / 5 | 4 / 4 | 1356.00 / 1259.29 | 0 / 0 |
| 林豕（90） | 5 / 5 | 5 / 5 | 2569.05 / 1796.26 | 0 / 0 |

原始生命变化与采样见 `demo/validation/enemy-metrics-{baseline,candidate}.json`。没有降低所有生命或提高攻击力；守卫仍需破防后继续输出，孢卫/林豕也没有统一改成三刀死。

## 原始帧、输入时钟与回收

设备为 Mac17,9、arm64、48GiB、18 逻辑核；Chromium 153.0.8010.12、1280×720、ANGLE SwiftShader。同期存在常规浏览器、全量单测及独立首图任务，软件渲染负载变化。原生窗口约 394×640，与自动化录像尺寸不同。没有登记硬件加速目标设备 60FPS 或性能提升。

| 最终正常速度共同场景，毫秒 | 帧数 | 中位数 | P95 | P99 | 最大 | >50 / >100 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 基线 | 722 | 49.9 | 83.3 | 116.6 | 1866.6 | 184 / 11 |
| 候选 | 638 | 66.7 | 100.1 | 183.3 | 2449.9 | 471 / 34 |

`demo/comparison-final.json` 按同页面墙钟帧标识去除重复观察计数，慢帧不删除，包含主动命中停顿。基线没有新动作字段，明确为空。候选 38 条已执行攻击记录中，扣除真实权限等待后没有额外模拟等待；姿态准备与渲染提交在同一引擎帧。风步尾部样本采集到渲染提交约 185.2ms，包含设计等待与软件慢帧，不能当作物理显示器延迟。

诊断采集合法字段漏计空弹恢复锁，也可能早于迟到输入。分析保留原字段并按真实 `guard-start + 320ms` 与输入到达时刻校正；群战两次 159.49/76.86ms 均等于空弹剩余恢复，不是存储冻结。读档重置模拟时间，匹配姿态还要求墙钟不早于该输入，避免旧会话误配。墙钟和模拟各自在同钟统计，不直接相减。

最终长测为 600.095 秒、56 轮、133 次正式击杀，剑风开/关交替，五轮群战后轮转四种单怪。6284 个原始帧：中位数 83.3ms、P95 199.9ms、P99 283.4ms、最大 6583.1ms；4751 帧 >50ms、1840 帧 >100ms。页面错误 0；仅覆盖这十分钟和当前负载环境。原始数据为 `demo/candidate-complete/raw-frames.json` 与 `soak.json`。

轮初对象 587～601、轮末 586～611，随样板变化，没有逐轮单调上涨；轮末最大反馈对象 1、待分发 0、音频并发 2、保存等待 0。代码上限为效果 32、反馈历史 96、声音 16、等待保存 8 加运行 1。`performance.memory` 恒为 131MB，精度有限，不证明零泄漏。

## 审查与玩家验收

VERDICT: PASS

P0/P1 BLOCKERS: 无。

审查涵盖全部 StateCommit 调用者、FIFO 与会话屏障、自动回调不发布旧状态、同帧更新收齐、唯一奖励/死亡、请求所有权及消费费用、正式伤害与表现去重、已释放弹体、真实地形位移、群战许可范围与自然释放、资源回收及生产门禁。候选问题先核对已有保护与真实路径；没有满足用户六项条件的 P0/P1。此项结论的范围为本轮阻塞问题审查。

UNVERIFIED RISKS:

- 全量逻辑的未归因超时与常规浏览器尚未完成首因对照的失败，不登记通过。
- 旧 V3 反馈测试的 Node 工作进程堆耗尽，以及大量重复诊断采集时的内存热点。
- 实际硬件加速目标设备帧率、长于十分钟的稳定性、真实设备听感和玩家手感。
- 原生短操作只有架剑/攻击响应证据，未据此宣布成功弹反或主观辨认通过。

NON-BLOCKING FINDINGS:

- P2：新动作诊断的采集合法字段漏含空弹锁；原记录与正式恢复校正在对照文件中保留，不能直接用原字段推导额外延迟。
- P2：程序重置不刷新下拉框选项，实际输出标签正确；手动样板路径正常。
- P2：重复风步预约的诊断未单列细分原因，不影响一次消费、费用、过期及权限。
- P3：回城提示同帧被抵达提示替换，原有显示行为；死亡结果由正式状态与完整 DOM 变更验证。

140ms 风步尾接、110ms 第三刀取消、1200ms 破防、一近战加一远程许可均为候选参数。玩家需要分别判断输入衔接、隐藏数字后的反馈、正确读招后的主动权、群战强度和音色响度。无玩家实际反馈，最终爽快感为**未验收**。

## 常规全量浏览器最终记录

原进程自然结束，227 项：**88 通过、137 失败、2 跳过、0 重跑不稳定项**。耗时 11655853.379ms（194.26 分钟），退出码 1。原始结果 `e2e-results.json`、日志 `e2e-final.log`、逐项完整错误 `failure-index.json` 均在 `.enemy-local/combat-feel/`；没有停止进程、改写原计数或删除失败。

| 首因证据分类 | 项数 | 边界 |
| --- | ---: | --- |
| 本轮保存晚采样/固定声库契约 | 3 | 保存最后两项通过；声库最后同轮两项通过；原全量失败不改 |
| 起点源码复现同根因 | 6 | 包含无目标生成前置条件、夜袭恢复、直接场景重启；完整旧用例仍失败 |
| 过期结构版本断言 | 7 | 期待 8，起点与当前均为 13；未登记后续旅程通过 |
| 起点已有文字契约失配 | 5 | 已核对原始文案；不自动改旧断言 |
| 原版同用例也失败，当前首因未归因 | 4 | 原版与当前缺帧位置不同或只有超时证据 |
| 默认配置未启用录像 | 11 | `page.video()` 为 null；保存录像失败不能算完整流程通过 |
| 未启动旧预览端口 | 5 | 4188/4195/5204 拒绝连接；未登记生产验证 |
| 生产门禁用例使用开发服务 | 4 | 默认 5173 的 DEV 调试存在；5214 真正生产专项另列 |
| 默认开发授予与未解锁前置条件冲突 | 2 | 起点即有默认授予；未登记完整学习通过 |
| Node 测试工作进程堆耗尽 | 1 | 约 4.1GB，具体热点未完全归因 |
| 其余未完成首因归因 | 89 | 不统称旧问题，不登记通过 |

紧凑逐项索引为 `demo/validation/regression-summary.json`。分类总计 137，分类不是通过。全量跨本轮实现过程，早期加载 6 项新增专项，不能将早期堆栈按最后磁盘上的测试行号解释；最后 12 项开发/4 项生产由前述固定游戏源码的专项与分次复核证明。

本轮新证据 84 个非英文路径组件改为英文，映射为 `demo/validation/english-path-map.json`，原始日志和 JSON 保留旧引用。可直接查附件的副本为 `.enemy-local/combat-feel/e2e-results-english-paths.json` 与 `failure-index-english-paths.json`；原始错误、事件、视频、trace 未改内容。原源码副本、起点记录及其他历史目录没有重命名。旧 V3 超大失败记录继续保留，不重新打包。
