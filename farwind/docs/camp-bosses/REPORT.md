# 四据点专属首领交付记录

状态：实现、本机逻辑与运行画面、八条双路径、自然夜袭联动、最终类型检查、构建与全量回归完成。主观美术、手感和其他设备性能待验收。未提交、推送或部署，其他未提交代码保留。

后续命中与表现修正见 [首领命中与远程可见度记录](ACCURACY-REVIEW.md)。起手与伤害范围不一致、祭主瞄准中央缺口和首领贴身喷口盲区已修正，弹丸改为亮橙圆弹和玫红针弹。下列八条双路径耗时对应修正前构建，作为历史证据保留；本次复测结果另存，不将旧耗时当作新构建的全量难度结论。

## 最终行为

四处据点分别拥有孢心巢母、荆冠猎王、崩岩獠王、缚枝祭主，均为专属三方向图集、四技能和半血第二阶段。驻守杂兵全灭后进入二点五秒预警；首领正式死亡才发布清除。缺少安全出生点或十二只活动预算时等待入场，不提前清除。

死亡或离开活动半径外八十像素持续三秒时，首领满血重置，已清杂兵保持死亡；本轮危险区、弹丸和小宝关联效果清理，战斗编号递增。世界与原袭村事件继续运行。

存档结构十四保存阶段、招序、攻击、危险区、弹丸和剩余时间。旧版已清据点继承历史结果，不伪造首领死亡，不补奖或回退恶意；未清据点追加首领。三个独立区域精英的位置与用途保留。满包保留掉落，不复活首领。

基础伤害二十二、重型伤害三十；护体减伤百分之六十，完整大招结束后的弱点窗口一点五秒。普通受击不能连续打断，小宝控制最多四百毫秒，随后三秒抗性。弹反、破茧和真实撞墙保留可靠反击窗口。招式锁向后不追踪；每段独立提示，地面预警与伤害共用数据，扩散环二十四像素内圈全程安全。

地图、场景残骸、委托、巡游补充、当地来袭来源和魔王恶意统一读取正式清除结果。南路委托完成清除条件后仍须采药并正常提交，不把清除误报为整张委托已经完成。

## 实际双路径结果

有窗口的 Chromium 正式构建，测试授予关闭，铁剑与零阶段剑风。从新游戏正常领取补给、购买、装备、行走、识招、弹反、风步与服药，诊断仅用于读取，没有导入完成档或修改生命、坐标、时钟和清除状态。属于自动化真实键鼠输入，不等同于人工主观试玩。

耗时是首领正式入场至死亡的有效模拟秒数，不含暂停与页面重开；药剂与受到伤害统计为该段战斗。入场时仍可能带有杂兵造成的伤势，因此零新增伤害与使用药剂可同时出现。每条路径均实际观察到四种技能、第二阶段，验证暂停冻结、保存重开生命与阶段一致、地图已清除、恶意一次和清除后读档保留。

| 首领 | 路径 | 血量 | 耗时秒 | 药剂瓶 | 新增伤害 | 成功弹反 / 输入 | 风步输入 | 证据 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 孢心巢母 | 独战 | 2300 | 139.3 | 0 | 0 | 15 / 15 | 10 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-spore-heart/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-spore-heart/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-spore-heart/phase-two.png) |
| 孢心巢母 | 带小宝 | 2300 | 30.9 | 0 | 0 | 3 / 4 | 2 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-spore-heart/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-spore-heart/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-spore-heart/phase-two.png) |
| 荆冠猎王 | 独战 | 2800 | 98.6 | 1 | 0 | 42 / 46 | 0 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-thorn-crown/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-thorn-crown/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-thorn-crown/phase-two.png) |
| 荆冠猎王 | 带小宝 | 2800 | 32.0 | 0 | 0 | 14 / 14 | 0 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-thorn-crown/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-thorn-crown/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-thorn-crown/phase-two.png) |
| 崩岩獠王 | 独战 | 2500 | 137.2 | 2 | 90 | 17 / 19 | 11 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-crag-tusk/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-crag-tusk/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-crag-tusk/phase-two.png) |
| 崩岩獠王 | 带小宝 | 2500 | 34.9 | 0 | 0 | 4 / 4 | 3 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-crag-tusk/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-crag-tusk/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-crag-tusk/phase-two.png) |
| 缚枝祭主 | 独战 | 2500 | 135.7 | 0 | 0 | 22 / 26 | 0 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-bound-branch/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-bound-branch/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/solo-bound-branch/phase-two.png) |
| 缚枝祭主 | 带小宝 | 2500 | 40.5 | 0 | 0 | 6 / 9 | 0 | [记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-bound-branch/gameplay.json) · [录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-bound-branch/gameplay.webm) · [第二阶段](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/companion-bound-branch/phase-two.png) |

八个固定样本耗时均在独战九十至一百五十秒、带小宝三十至七十五秒范围。初始血量过低，随后依据实际两条路径校准；过程、失败样本与原始追踪见 [校准记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/BALANCE.md) 和 [证据索引](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/EVIDENCE.md)。不同熟练度与装备的主观难度仍需用户验收。

复测覆盖受影响范围：狼王独战在最后半血、地图与图集版本通过；之后占地检查只避让在村内的小宝及防线活体，环形几何未用于狼王。獠王在最终环与占地版本通过。最后只增加孢母、祭主血量，重跑二者独战与同行；未变参数的狼王、獠王保留对应通过记录。没有把早期候选数据替换为最终结果。

## 联动与边界验证

自然联动样本通过，完整键鼠运行约十七点六分钟，未修改世界时间。第一次真实撤离后首领满血、战斗编号由零增加到一，已清杂兵保持死亡且危险区清空。正常旅馆住宿到第二日黎明，再于村内等待至自然来袭前进场；第二日二十点五十一分，首领处于战斗且模拟继续推进，南门原事件 `raid-1` 正式启动。撤回村后首领编号恰好增加至二、满血待入场，原袭村序号一正常结算。随后返回同一据点，首领满血重新入场，杂兵仍保持死亡，编号仍为二。

该样本的来袭为一只普通史莱姆，守军在玩家到村前已击退，未声称玩家亲自击杀。验证的是原来袭独立运行、真实撤战回村与重新挑战；大型编队峰值性能另列未测。

四百像素宽度的首领信息边界检查通过，所有可见子元素在视口内，容器为正常文档流，左右边界十至三百九十像素。但这一检查漏掉了展开小地图后卡片落入战斗区的情况，用户截图已证明该遮挡问题。血条与出场的后续修正及独立验收见 [表现修正记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/PRESENTATION-REVIEW.md)。关闭来招辅助后，实际根刺地面标记仍可见。九个节点的状态和截图均保留，无页面运行错误。

[自然联动记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/world-retreat-raid/world.json) · [完整录像](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/world-retreat-raid/gameplay.webm) · [首领与夜袭](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/world-retreat-raid/boss-and-raid.png) · [满血重挑战](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/world-retreat-raid/rechallenge.png) · [窄屏](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/world-retreat-raid/narrow-hud.png) · [关闭辅助](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/world-retreat-raid/ground-without-assistance.png)。

首领专项四十二项逻辑均通过，覆盖清杂兵不能完成、入场去重、预算等待、四技能真实命中与独立去重、阶段门槛、控制抗性、真实石障、死亡和撤离重置、暂停与恢复、旧档、满包、保存失败和重复死亡通知。最终默认全量四十七个文件、八百二十三项全部通过，耗时二百四十六点七九秒，包含首领专项；独立精英基线文件不在默认列表，另行运行并单列十五通过、一失败。最终类型检查、正式构建与差异空白检查均通过。

最终全量运行前备份原有未提交验收记录，运行后恢复其中九份由测试生成改写的文件，保留测试前的其他任务证据。首领验证结果单独保存至本目录。

首次自然夜袭样本已经实际观察到首领战与原南门事件并行、撤回村后序号一正常结算，但等待操作停在采药道史莱姆旁，玩家被击退进首领入场范围并死亡，增加了一次有效编号。原始轨迹证实死亡回村满血及首领重置，并非重复重置。保留原编号断言，改为村内安全等待后复测通过；首因见 [完整记录](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/evidence/initial-world-idle-danger/ROOT-CAUSE.md)。

## 素材与运行画面

先制作四张独立设计板，再生成十二张透明动作表，打包为四套专属图集，共六百八十四个独立姿态。固定预览与四位首领实际移动、两阶段画面均已审阅；左向运行时镜像，脚底根、显示大小和攻击范围分开配置。首轮跨格切断与孢母背面错误的证据保留并已修正。

运行画面与所有帧逐帧交互验收有不同覆盖范围，详见 [素材审阅](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/ART-REVIEW.md)。首领信息与地图状态列表采用正常文档流布局；不使用绝对定位对齐图标。

## 性能范围

本机八个样本的帧间隔中位均约八点三毫秒，百分之九十五为九点八至十点一毫秒，单个最大值一百二十五至二百零八点七毫秒。统计来自保存重开后至击败的浏览器动画帧，包含页面恢复与截图交互，不等同于独立的图形硬件压力测试或录像帧率。每条原始记录包含样本数及实际分位数。

四张首领纹理解码约七十五兆字节。现有大型分块构建警告保留。当前 Mac 的运行与帧采样已验证，其他目标设备显存压力、长时间多人袭击峰值、主观美术与手感尚未验收。

## 已知基线与审查

修改前相关测试十五项通过、一项失败，既有裂岩林豕穿石前置判定失败。根因：可选精英路径把指定石障编号传给近战射线，射线却仅接受训练底座豁免，指定石仍阻挡。没有修改断言绕过，没有拓宽全局穿透；新獠王使用真实撞墙规则。该独立精英可选机制的问题单独保留，不影响四处新首领清除闭环。

[对抗式审查](/Users/archer/Documents/ChatGPT/Game/farwind/docs/camp-bosses/REVIEW.md) 最终 VERDICT: PASS，无成立的 P0/P1 阻塞项。

最终正式构建入口摘要：`game-CkfTqRZE.js`，`d95aef9179a8a0d0a745f5ed11225df7910b3ff05ee42f87d9c6315a0fa3f1ea`。类型检查与构建通过，测试授予为关闭。

## 攻击特效后续

根据后续试玩反馈，先完成四张攻击动画分镜，再增加爪痕、镰斩、冲锋尘尾、砸地裂纹与飞石、破土根枝、扩散环及破茧风核。特效读取正式攻击和危险区数据，复用两个图形对象，沿用现有角色动作图集。设计和实现边界见 [动画设计](vfx-design/ANIMATION-DESIGN.md)。

本次固定包 `game-Dg43T7S7.js` 的四首领十六招画面，以及缚枝独战完整两阶段闭环通过；相关逻辑回归 203 项、类型检查和构建通过。全量初跑的两项超时与后续符文源码漂移单独记录，没有把历史八条难度路径算作本次重新验收。详见 [攻击特效审查](vfx-design/REVIEW.md)和[验收汇总](evidence/vfx/validation.json)。长时间混战性能与用户主观美术评价仍待验收。
