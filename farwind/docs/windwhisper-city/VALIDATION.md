# 风语城与商路验证记录

日期：2026年10月3日。固定正式构建在本机5307端口运行；游戏主体构建文件为`game-Rn0PzwvT.js`。验证不增加依赖，也未提交、推送或部署。三张设计图、源素材、生成与校核记录见[设计](DESIGN.md)。

## 逻辑、类型与构建

相关专项共213个不同检查已通过，覆盖17个文件。最终统一执行16个文件、189项通过，包括22项城市／商路测试、实际碰撞路径规划，以及原野地图、经济、战斗、首领奖励保存、遭遇、村庄集成、小宝导航与生活、村庄守备及追击。

村庄安全守备另有23项快速回归通过；本轮先前执行的40场共同调度重回归已通过。该长项在最后快速复验中明确跳过，不能表述为同一命令213项一次通过。原始报告保留，副本见[原野四十场](evidence/plains-forty-events.json)。类型检查和正式构建通过；构建仍有既有大资源块提示。没有宣称全项目所有测试已通过。

```sh
npx vitest run --maxWorkers=1 tests/windwhisper-city.test.ts tests/wilderness-map.test.ts tests/first-map.test.ts tests/obstacles.test.ts tests/boss-reward-save.test.ts tests/encounters.test.ts tests/economy.test.ts tests/enemy-combat-v1.test.ts tests/slime-animation.test.ts tests/village-integration.test.ts tests/xiaobao-navigation.test.ts tests/xiaobao.test.ts tests/east-defense.test.ts tests/village-defense.test.ts tests/enemy-pursuit.test.ts tests/city-route-path.test.ts
npx vitest run --maxWorkers=1 tests/safety-defense.test.ts -t '^(?!.*共同调度40场).*'
npx tsc --noEmit
npm run build
```

城市专项覆盖108只固定种子与三波、800毫秒出生提示、玩家距离220、12名额、六射击口、普通墙树阻箭、混合敌群30秒、800毫秒击退节流、十个补员岗位、低血后撤、攻击身份恢复、追击者跨原野保存、远处挂起、旧21档迁移、库存原子失败回滚、8／9名参与边界、纯守军无奖励、守军收尾共同奖励、重复领取与小宝旧引用清理。

最终五个浏览器场景均已分别通过；完整正常往返约3分42秒。验证没有自动重试，出现失败后保留原因、修正路线或断言，再执行对应场景。

## 实际浏览器流程

正式构建专项使用实际键盘与鼠标事件，观察接口只读，不提供生命、能力、坐标或进度授予。以下场景分别保存录像与记录：

| 流程 | 验证边界与结果 | 证据 |
| --- | --- | --- |
| 新档连续往返 | 村庄新档用初始金币购买6份药剂后启程，沿原野、林间支路、溪谷桥、西门到广场，正式保存刷新，再沿原路回村；不切场景或传送 | [运行记录](evidence/real-walk.json)、[完整录像](evidence/continuous-walk.webm) |
| 城市服务与保存 | 正式文件导入合法服务夹具，真实购买、四角色交谈、休整、倒地弓卫20秒后步行登墙、保存刷新；独立库存和待领候选回读 | [记录](evidence/city-services.json)、[录像](evidence/city-services.webm) |
| 门前混合敌群 | 正式导入含三种怪物与斧卫精英的12只合法追击者，真实键盘进城；守军实际击杀，观察30秒，十名守军存活、活动峰值≤12，金币和待领风赐不增长；刷新保留清除和轮换身份 | [记录](evidence/city-defense-runtime.json)、[录像](evidence/gate-defense.webm)、[真实放箭截图](evidence/gate-arrow-runtime.png) |
| 旧档与事务中止 | 21／地图8旧档通过正式导入保留坐标与77金币；让真实购买事务在请求成功后中止一次，运行及刷新均无扣款、无新增物品、库存不变 | [记录](evidence/save-failure-runtime.json)、[录像](evidence/save-recovery.webm) |
| 撤退追击者 | 正式导入合法单追击者，实际键盘退回原野，保存当前伤势与坐标；刷新后身体恢复，不因出生区域约束拒绝保存 | [记录](evidence/retreat-chaser-runtime.json)、[录像](evidence/retreat-chaser.webm) |

城市服务、城防、事务中止与撤退使用正式导入夹具建立可达前提，与新档正常往返分别记录；不把夹具冒充自然通关。共同战斗奖励与重复领取由逻辑专项验证，服务实机验证的是合法待领候选保存回读。

复验保留首因处理：服务行走脚本曾撞到接待员，改由街道接近；保存刷新曾读取到观察接口首帧，改等待种子回读；撤退身体断言曾错误读取英文字段，改用观察接口真实中文身份字段。新档无补给直穿原野的复验曾阵亡，这是可达战斗结果；后续按正常玩法先在当前村庄杂货铺用初始金币采购药剂，不修改游戏状态。路线规划读取当前商店门口坐标，未使用旧测试过时的服务位置。桥西岸原测试线只留310单位节点距离，真实行走误差导致返程触发猎兽群并阵亡；核对碰撞网格后改为所有节点340距离、桥头24单位通行余量、八方向路径与桥头10单位键盘到点精度。地图、战斗强度与出生规则均未因此改变。

## 设计对照与截图

- [林间疏密变化](evidence/forest-runtime.png)、[桥面与河谷](evidence/bridge-runtime.png)：连续可行走道路、河水阻挡与跨桥路径。
- [怪群抵达门前](evidence/gate-crowd-arrival.png)、[四近卫六弓卫](evidence/gate-interior-runtime.png)、[真实城墙放箭](evidence/gate-arrow-runtime.png)：人数、岗位和实际战斗。
- [风塔与议事街区](evidence/wind-tower-runtime.png)、[城市区域图](evidence/city-map-runtime.png)、[补给交易](evidence/shop-runtime.png)：布局、真实占地和服务入口。
- [大陆图](evidence/atlas.png)：风铃原野混合地貌、风语城部分开放，以及海上黑紫色“？？？”。

## 性能与未验证边界

12只混合敌群的记录包含真实运行帧统计、活动峰值、纹理峰值和对象数。环境为桌面浏览器软件渲染并开启录像，当前宽视口截图包含完整城门。相关平均帧耗时约37.3毫秒、结束累计P95约49毫秒，初段P95约60毫秒；活动峰值12、纹理峰值319。此记录包含载入后战斗和清理后的观察时间，不能当作纯密集战斗稳定帧率，也不能外推为用户真实显卡性能或60帧保证。机器可复核数据以[最新原始记录](evidence/city-defense-runtime.json)为准。

最终美术、全部怪物动作帧、长时间平衡、其他设备与真实显卡性能仍待验。怪物图集保持临时标记，概念图不替代实机验收。已完成相关专项，完整项目发布验收未进行。

[审查结论](REVIEW.md)：VERDICT: PASS；P0/P1 BLOCKERS：无。

## 2026年10月4日石桥更新

石桥新增真实栏杆和柱脚碰撞，历史340单位避敌路线当前规划未通过；旧往返录像不代表本次石桥验收。当前桥面与碰撞、运行截图及浏览器控制中断边界见[石桥修复记录](../stone-bridge/VALIDATION.md)。
