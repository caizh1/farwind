# 实战证据索引

首轮、流程修正、地面锁定修正与最终数值复测分别保存，不把失败样本覆盖为通过。每个目录包含中文玩法记录、实际运行截图与键鼠录像。

三份体积较大的首因追踪完整保留在项目本地目录 `.camp-boss-local/retained/`，该目录被版本控制忽略，避免把两千兆字节的调试数据混入后续代码提交。文件分别为 `initial-spore-save-failure-trace.zip`、`initial-ground-solo-spore-heart-trace.zip`、`initial-ground-companion-spore-heart-trace.zip`。原始截图、录像、命中记录与原因仍在对应的本证据目录内。

正式构建实际键鼠使用独立端口与新游戏存档，不导入完成档，不修改运行状态。浏览器为有窗口的 Chromium，属于自动化真实输入；主观操作手感、美术喜好和其他目标设备性能需单独验收。

## 保留的阶段与首因

`candidate-one-*` 是第一轮校准，`before-phase-*` 是半血时机修正前的第二轮校准。`candidate-two-solo-wolf` 保留了领取委托后过早关闭界面的操作失败；随后改为等待保存反馈并点击正常关闭按钮。`candidate-two-solo-branch` 保留了贴在齐射喷口之间耗尽药剂的失败；随后调整真实识招操作与站位，没有修改伤害或药剂规则。

`before-ring-solo-*` 保留扩散环内圈修正前的独战通过样本，`before-occupancy-companion-*` 保留加入小宝占地检查前的带小宝样本。其中狼王在复测中被主动中断，用于等待确定的入场占地与环形几何修正；中断不记作游戏运行失败。对应完整追踪为本地忽略目录中的 `before-occupancy-companion-thorn-interrupted.zip`。另外保留 `candidate-two-solo-thorn-crown-trace.zip` 与 `candidate-two-solo-bound-branch-trace.zip`。

最终采用 `solo-*` 与 `companion-*` 八个目录。每个目录的 `gameplay.json` 列出模拟耗时、药剂、弹反、风步、帧间隔、存档恢复和地图联动，`gameplay.webm` 保留完整键鼠录像。狼王和祭主独战在最终半血、地图及图集版本上通过，最后占地修正只增加远处小宝及袭村单位的出生避让，扩散环修正只影响孢母与獠王；后两位独战与四条带小宝路径针对受影响部分重新执行。

自然昼夜、关闭辅助、窄屏、撤战守村再挑战的证据保存至 `world-retreat-raid`；最终状态以交付报告及对应中文记录为准。

`before-final-health-*` 保存最后一次血量调整前的孢母与祭主样本。该版流程通过，但带小宝耗时低于目标，因此提高对应血量并重测两条路径；不把流程通过直接当作难度通过。狼王和獠王参数及技能在这次调整中均未变化。

`initial-world-idle-danger` 保留首轮自然夜袭样本的失败、死亡回村、并行夜袭和原序号结算。首因是等待操作停在未清的采药道史莱姆旁，被攻击、击退进首领入场范围并死亡；由此多了一次有效战斗编号递增。精确编号断言未改，改为村内安全等待后重新运行。完整追踪保存在本地忽略目录 `initial-world-idle-danger-trace.zip`，首因与编号首次变化详见对应目录记录。
