# 第二轮证据索引

## 验收性质

A类是精确判定自动化，可以读取内部预测与模拟时间，通过真实键鼠验证边界、输入和状态。B类是画面驱动操作，起按只依据截图中的宽容区、精准菱形或怪物压低至蹬起的轮廓变化；内部诊断只用于事后记录。B类仍是开发者自动化核查，不能代替玩家主观手感认可，也不代表所有冒险背景下的视觉识别率。

另用原生界面工具检查正常比例架剑、练习菜单、暂停及系统菜单阻塞。一次跨工具观察后按K没有取得成功，只核查动作启动，不写成手感通过。原生失焦测试实际切换浏览器标签，未伪造blur事件。

## 主要正常速度录像

| 文件 | 内容与证据性质 |
|---|---|
| evidence/visual-perfect-combo.mp4 | B类。看菱形架剑、接触剑闪、自动30伤害反斩，成功停顿中J预约，再接二、三刀，共80伤害；带实际游戏音轨 |
| evidence/visual-auto-only.mp4 | B类。看宽容区普通成功，未按J仍有24伤害；只出首刀，机会过期后HUD与结果区无过期J提示；带实际游戏音轨 |
| evidence/visual-motion-muted.mp4 | B类。关闭指示器并明确静音，只看史莱姆压低至蹬起，成功并自动反斩。静音片不作为带音轨完整示例 |
| evidence/visual-dash-cancel.mp4 | B类。看提示成功，停顿中L取消尚未执行的自动反斩；没有补放或偷扣伤害，带实际游戏音轨 |
| evidence/success-combo.mp4 | A类。普通、精准、停顿J与后续三连；带实际游戏音轨 |
| evidence/failure-rescue.mp4 | A类。按早、按晚、背向失败、空弹后风步补救；带实际游戏音轨 |
| evidence/adventure.mp4 | A类。正式史莱姆真实出手与普通成功，未按J也有自动24伤害；带实际游戏音轨 |
| evidence/two-enemies.mp4 | A类。两个原出生点敌人紧邻接触，只退款一次、只自动反斩一次及前方余势；带实际游戏音轨 |
| evidence/input-directions.mp4 | 原生四方向、长按、暂停、实际切标签和恢复的辅助画面；没有录制音轨，不作为带音轨战斗示例 |

视频1280×720、25帧、正常速度。音轨旁路采集实际AudioContext输出，合成只同步偏移并裁去加载片段，没有替换声音、改速度或增益。media-summary.json记录编码、时长、峰值和静音性质；normal-speed.json只核查接触前短段的模拟／墙钟推进，不是目标设备长期帧率结论。

## 截图与动作设计

- assets/hero-design.png：内置图像生成的十八姿态设计图；assets/PROMPTS.md记录生成与固定根处理。
- assets/enemy-design.png、assets/enemy-design.md：正常75像素尺寸的史莱姆／叶灵阶段设计示意，不替代实机验证。
- assets/manifest.json、evidence/fixed-preview.png：统一460裁切、160帧、145显示、80／154固定脚根，继续保留临时美术标记。
- evidence/success-impact.png、success-counter.png：从正常速度带音轨录像直接取帧，受力首帧及正式反斩有效段；索引为presentation-frames.json。
- evidence/guard-down.png、guard-up.png、guard-left.png、guard-right.png：四方向真实键盘架剑，左向由Actor镜像。
- evidence/normal.png、perfect.png、early.png、late.png、back-failure.png、two-enemies.png：A类结果画面。
- evidence/visual-*-cue.png：实际起按的局部观察区；只证明输入依据，完整比例以对应视频为准。
- evidence/production.png：实际生产包画面。
- evidence/png-integrity.json：最终截图的解码像素摘要，不重绘、不放大。

## 只读日志与结果

对应的*-summary.json记录真实接触时间、输入与启动时间、攻击阶段、预计接触、朝向、结果、拒绝原因、体力与正式攻击统计。visual-*-cue.json记录逐张截图的亮度／形状依据；大逐帧记录留在忽略目录的recording/traces/。

| 索引 | 核查内容 |
|---|---|
| evidence/success-combo-summary.json | 退款、成功停顿内J及正式二三刀 |
| evidence/failure-rescue-summary.json | 失败分类与风步补救，不修改运行状态 |
| evidence/adventure-summary.json、two-enemies-summary.json | 正式敌人、稳定主目标、多敌人去重 |
| evidence/training-modes-summary.json | 叶灵650毫秒与轻击收手链，正式采样和训练隔离 |
| evidence/input-directions-summary.json、contextmenu-summary.json | 四方向、长按、暂停、原生失焦、标题续玩及画布／界面右键边界 |
| evidence/visual-*-summary.json | B类事后判定及正式攻击伤害，起按不用内部接触时间 |
| evidence/production-summary.json | 实际生产构建，真实K／右键，按画面起按，无J仍有24伤害，战斗调试信息未暴露 |
| evidence/logic-and-build.json、tests-summary.json | 实际基线、测试枚举、最终265项当前工作区逻辑、22项完整浏览器及末轮复核，保留中途失败 |
| evidence/corner-regression.md | 斜向墙角首次接触插值的实际失败、修复及预测一致反例 |

第一批画面驱动用例0／4，记录见visual-first-failures.json和*-cue-first.*；原因、修复及重验写在REPORT.md。完整回归中三次原生菜单持有窗口导致销毁超时，最终根因见native-menu-diagnosis.md；没有删断言或用自动重试隐藏失败。

## 版本、夹具及未验证范围

夹具通过正式标题导入，只设置合法初始站位、任务和装备等存档条件，文件在evidence/fixtures/。不改运行中生命、敌人位置、计时器或判定。训练投影是游戏主动选择的练习角色，正式敌人安全规则保持。

完整回归副本为runtime-regression-final.json；安全资格及结果文案复核副本为runtime-parry-final.json；并行功能共存副本为runtime-coexistence.json；最终碰撞角修复副本为runtime-snapshot.json。完整回归后保留并行剑风接入，再做当前三连弹反定向检查与生产构建。副本用于隔离热更新，不发布；并行任务后续改动及剑风解锁第四刀本身不能引用本报告作为验收结论。

大原始录像、追踪包、首因快照和完整自动化报告留在忽略目录.parry-local/v2/，不作为主要交付。测试工具误写到旧证据路径的本轮产物已归档回本轮或本地目录，历史docs/parry/与其他旧报告保持。

主角图集与怪物高帧数美术、实际音色舒适度、用户主观反应和目标设备长期性能仍待验收。没有宣称手感已经获用户认可。
