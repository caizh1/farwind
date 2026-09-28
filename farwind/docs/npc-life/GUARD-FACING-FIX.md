# 松岚开局朝向抖动修复

本次处理玩家录屏中的松岚开局抽搐。分支为 `codex/initial-game`，保留共享工作区的其他开发改动。本次没有提交、推送或发布。以下结果仅对应本次朝向修复，不代表其他正在开发的功能已经通过验收。

## 原因与范围

松岚的稳定身份为 `north-watch`。八点的检查装备安排需要先到营房取自己的巡逻手册。他在北门沿约四十五度路线向右下方移动，目标与行动阶段没有反复切换。

驻防的轮休和普通值守移动分别用严格的横纵位移大小比较决定朝向。到达网格路点时，两个分量不足万亿分之一像素的差异足以改变比较结果。表现层立即根据朝向选择正面或侧面整行动画，造成视觉抽搐。修复前自然新游戏浏览器九十九次读取中，约一点六五秒模拟时间出现十四次朝向切换。[修复前证据](evidence/guard-facing-before.json)保留实际采样。

这与此前青禾被同伴挡路的返岗问题有不同的执行路径。本次没有改寻路、同伴占位、移动速度或生活目标。

## 实际实现

在 `src/game/systems/locomotion.ts` 提取既有主角规则为共用的 `movementFacing`，主角与黑猫继续使用原来的规则。横纵分量接近时保留之前的朝向轴；一个轴的分量超过另一轴一点二倍时立即转向。正反方向始终跟随实际位移，停步或数值残差保留原朝向，不添加等待计时器。

驻防的两处移动朝向更新调用共用规则，覆盖轮休、生活返岗、巡逻、普通返岗、拦截和后撤。攻击发起时仍直接面向实际目标，其方向向量、射界、距离、命中和伤害均沿用原逻辑。显示镜像继续由 `Actor` 负责，角色脚底、排序与素材没有改变。

朝向属于驻防临时表现状态。当前共享源码的主存档版本为八、生活子版本为四；八是工作区已有的小宝开发变更，本次没有新增保存字段、迁移、补血或重置人物。此前版本七的返岗报告属于当时批次记录。浏览器通过正常保存、刷新和继续旅途验证中途位置连续性与暂停冻结。

## 运行过的验证

| 命令或场景 | 实际结果 |
| --- | --- |
| 修复前 `npx vitest run tests/guard-facing.test.ts --maxWorkers=1` | 六项中五项失败，明确捕获三个帧率、值守返岗与读档的旧抖动；原攻击命中一项通过 |
| 修复后 `npx vitest run tests/guard-facing.test.ts tests/motion.test.ts --maxWorkers=1` | 二十二项全部通过 |
| 修改前动作、东门、安全驻防和导航四文件回归 | 五十三项，五十通过、三失败；三项均为旧测试期望存档七、当前源码返回八 |
| 修复后上述四文件加 `guard-facing.test.ts` | 六十项，五十七通过、同样三项版本断言失败；未改动这些旧断言 |
| 开发浏览器 `GUARD-FACING-01`、`GUARD-RETURN-01`、`GUARD-REST-02` | 三项全部通过；包括自然新游戏、暂停、中途保存加载、旧卡住档实际返岗和三名弓卫轮休返岗 |
| `npm run typecheck` | 通过 |
| `npm run build -- --outDir .npc-life-local/guard-facing-production` | 通过，保留既有大包体提示 |
| 正式构建浏览器 `GUARD-FACING-01` | 一项通过，六十六个开局斜向样本朝向稳定、十九个读档后有效样本、暂停和实际转弯通过 |

单元测试按每帧共享两份寻路预算与五毫秒模拟分段推进，分别验证三十、六十、一百二十赫兹。正常值守通过实际移动到岗，战斗通过实际发起攻击并扣除敌人十八生命验证，不靠隐藏角色、写位置或关闭碰撞获得通过。

开发浏览器从正常新游戏按钮开始，没有开发快进或导入摆位。第一段六十五个有效斜向样本只有侧向朝向；读档后的二十个有效斜向样本保持朝向轴，实际向下拐弯后切为正面。[浏览器证据](evidence/guard-facing-browser.json)、[斜向截图](evidence/guard-facing-diagonal.png)、[真实转弯截图](evidence/guard-facing-turn.png)与[录像](evidence/guard-facing.webm)保留完整操作。录像已逐帧抽样检查。

正式包 `game-a2AP6ntJ.js` 已在独立预览端口重新运行同一按钮流程，[正式采样](evidence/guard-facing-production-browser.json)、[正式斜向截图](evidence/guard-facing-production-diagonal.png)、[正式转弯截图](evidence/guard-facing-production-turn.png)和[正式录像](evidence/guard-facing-production.webm)保留结果。正式验证同样未注入运行状态；页面异常为空，已有小宝资源错误仍单独记在下方边界。

开发浏览器实际命令：`npx playwright test tests/guard-facing.spec.ts tests/npc-life.spec.ts --config tools/playwright-npc-life.config.ts --grep 'GUARD-FACING-01|GUARD-RETURN-01|GUARD-REST-02' --workers=1 --output .npc-life-local/guard-facing-regression-results --reporter=list`，三项通过，约一点二分钟。修复后相关单元命令为 `npx vitest run tests/guard-facing.test.ts tests/motion.test.ts tests/east-defense.test.ts tests/safety-defense.test.ts tests/npc-navigation.test.ts --maxWorkers=1 --reporter=json --outputFile .npc-life-local/songlan-start-diagnosis/regression-after.json`。

正式浏览器实际命令为 `FARWIND_FACING_PRODUCTION=1 npx playwright test tests/guard-facing.spec.ts --config .npc-life-local/guard-facing-production.config.ts --workers=1 --reporter=list`，一项通过，二十五点五秒。初次隔离配置已等价整理为受版本管理的 `tools/playwright-guard-facing-production.config.ts`，可用 `FARWIND_FACING_PRODUCTION=1 npx playwright test --config tools/playwright-guard-facing-production.config.ts --workers=1` 重复验证；先执行上表构建命令。

[收尾摘要](evidence/guard-facing-validation.json)保存本次源文件与正式包的摘要、实际通过数和基线失败项。类型检查与差异空白检查再次通过；受版本管理的正式配置已用 `--list` 验证只选中本场景。本地原游戏端口也已核对实际提供新的共用朝向规则，刷新页面即可使用。

## 首次失败记录

浏览器首轮朝向检查通过，但测试错误要求开局所有样本都已进入取物阶段；实际第零毫秒是站岗、未领取行动，等待错峰决策。已改为要求真正移动的样本处于取物阶段。第二轮暂停、保存和位置连续性均通过，但测试错误要求读档重建路径时正反方向也不能变化。追踪显示人物先真实走回临近网格点，再向前走，向左切向右属于合法反向。已改为保持朝向轴并允许跟随真实位移反向，仍会拒绝正面与侧面的数值抖动。

两轮的原始追踪、截图与录像分别保留在 `.npc-life-local/guard-facing-browser-results`、`.npc-life-local/guard-facing-browser-final-results`。首次样本与二次样本另存于 `.npc-life-local/songlan-start-diagnosis`。最终三项开发回归保留于 `.npc-life-local/guard-facing-regression-results`。没有删掉业务断言或隐藏运行错误。

## 审查与未验证边界

VERDICT: PASS（本次朝向修复）。

P0/P1 BLOCKERS: 无。已检查两条控制路径、停止与反向、实际攻击、暂停、加载、身体状态归属和表现消费者；朝向不参与路径选择或生命结算，移动与攻击的权威状态没有新副本。主角规则提取保持既有语义。

UNVERIFIED RISKS: 当前工作区三处存档版本断言仍失败，完整默认测试没有在本次重跑。开发浏览器另有小宝前、侧、背战斗图集加载失败，源文件属于其他既有开发，本次没有将小宝资源验收标记为完成。页面异常监听与控制台资源错误是不同渠道，页面异常为空不表示资源加载全部成功。本次未重新测目标设备长时帧率或人工操作节省比例。

NON-BLOCKING FINDINGS: 真实拐弯和反向仍切换朝向；存档加载后导航可能先回到临近网格点，该真实移动不应被朝向锁定掩盖。卫兵仍使用现有两帧行走素材，没有把本次规则修复描述为新增完整动画。
