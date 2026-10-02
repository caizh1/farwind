# 寻风瞄准镜角色佩戴显示

购买并在头部位置装备寻风瞄准镜后，角色显示对应佩戴部件；卸下后隐藏。正面显示单目镜，侧面显示镜片和铰链，背面显示皮带铜扣。装备仍不占五个符文槽。

## 实现与来源

用 imagegen 制作三向透明佩戴素材，沿用原装备外观。运行时只新增一个图片对象，按现有角色图集与动画帧查表定位，复用 Actor 的脚底锚点、缩放、镜像和场景深度。保护闪烁和归风透明度同步到佩戴层。未知动画帧隐藏配件，避免挂在错误位置。

`tools/pack-scope-wear.mjs` 离线采样九套角色图集，生成逐帧定位表和固定预览。252 个非空帧已生成坐标，空白帧不显示佩戴件。运行时不扫描像素、不增加输入监听，不改变伤害、碰撞、商店和存档规则。

## 验证

- `npm run typecheck`：通过。
- `npx vitest run --maxWorkers=1 tests/motion.test.ts tests/player-hurt.test.ts tests/aiming-scope.test.ts tests/combat-build.test.ts`：四个文件、66 项通过。
- `npm run build`：通过，仍有既有分包大小提示。
- `SCOPE_EVIDENCE_DIR=docs/aiming-scope/wear/production SCOPE_BROWSER_DIR=../docs/aiming-scope/wear/browser npx playwright test --config tools/playwright-aiming-scope.config.ts --trace off`：两条生产入口流程通过，约 1.6 分钟。
- `git diff --check`：通过。

新档真实购买、装备、四向行走、近战、架剑、风步、学习剑风、自动瞄准、持续施放、卸下、刷新均沿生产入口验证。旧档迁移流程通过。本轮没有修改金币、背包或任务结果来制造正常获得证据。

四向截图和状态见 `production-{s,a,w,d}.png`、`movement.json`；动作截图和状态见 `combat-{j,k,l,i}.png`、`combat.json`。正常流程录屏为 `browser/aiming-scope-scope-normal-flow/video.webm`，旧档流程录屏为 `browser/aiming-scope-scope-legacy-migration/video.webm`。

## 验收边界

佩戴逻辑已实现，素材仍标为临时表现。九套固定预览已检查，真实走路和战斗显示已验证；抬手、武器与配件之间的逐帧前后遮挡仍待美术验收。本轮受击只检查固定预览和既有受击单测，没有新增真实受击佩戴流程。没有重跑整个项目测试全集，也没有测跨设备性能或宣称稳定帧率。

工作区另有外部产生的大批历史证据删除；本轮保留这些已有删除，新的证据单独保存在本目录。未提交、推送或公开部署。

## 对抗式审查

VERDICT: PASS

P0/P1 BLOCKERS: 无。复查了装备判定、未知帧、左右镜像、透明度、死亡恢复、区域重建、单对象生命周期与存档调用关系，未发现满足阻塞标准的问题。

UNVERIFIED RISKS: 真实受击时的视觉遮挡、全部设备与完整游戏流程尚未验收；不影响当前结论。

NON-BLOCKING FINDINGS: 个别抬手姿态需要细化遮挡蒙版，属于临时美术问题；旧构建分包大小提示仍存在。
