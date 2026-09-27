# 实机证据索引

所有画面来自实际游戏；未使用生成图、修图或遮罩演示。截图无损转为WebP，RGBA逐像素相同，原PNG按时间分目录保留在.parry-local/day-night/raw-screenshots；转换摘要见[lossless-conversion.json](lossless-conversion.json)。截帧钟点、坐标/地点、分辨率、DPR、调试条件和版本见[screenshots.json](screenshots.json)。文件更新时间不是画面钟点。

## 版本

- 基线：codex/initial-game，HEAD eac16f44dcc6c9b745dc5d6d24065ca841ba346c，结构4、地图6。
- [acceptance-runtime.json](acceptance-runtime.json)：10:27完整冻结源码；对应首次最终433/14/2与剑风11项，保留历史，不冒充后来源码。
- [final-runtime-before-water.json](final-runtime-before-water.json)：失焦/空间提示修复后的源码，重新433/14/2、活跃夜战、同档后半与性能对应此版本。
- [final-runtime.json](final-runtime.json)：最后共享源码全src SHA与水效资源摘要；水效常数集中及水滴素材变化后补73项单测、四阶段/水效生命周期和正式包复测。
- [candidate-runtime.json](candidate-runtime.json)：同档正常夜袭修复候选。该北门镜头主要显示守卫和HUD，不能单独证明敌人交战。
- 早期其他runtime文件分别记录当时源码；不将其性能资源数量混为最终数量。

## 截图

| 场景 | 实际截图 | 检查内容 |
|---|---|---|
| 原广场/门/森林 | [广场](m0-plaza.webp) · [东门](m0-gate.webp) · [森林](m0-forest.webp) | 原HEAD基线；旅馆最初误定位未入选 |
| 同机位四阶段 | [白天](m2-fixed-day.webp) · [黄昏](m2-fixed-dusk.webp) · [夜晚](m2-fixed-night.webp) · [黎明](m2-fixed-dawn.webp) | 暖冷过渡、村灯、道路和HUD分层 |
| 夜间区域 | [森林道路](m2-fixed-forest.webp) · [遗迹微光](m2-fixed-ruins.webp) · [暂停菜单](m2-night-menu.webp) | 敌人轮廓、道路、温和局部光与DOM可读性 |
| 临水夜风 | [引导点](m3-discovery-before.webp) · [文字与奖励](m3-discovery-reward.webp) | 可到达草坡、真实E交互和一次领取 |
| 夜袭/午夜 | [活跃东门](m3-east-night-live.webp) · [午夜](m3-midnight.webp) · [重新加载](m3-night-reload.webp) | 存在实际敌人、非暂停提示、日期与当夜额度 |
| 旅馆 | [住宿确认](m4-inn-before.webp) · [醒后](m4-inn-after.webp) · [写入失败](m4-save-failed.webp) · [活跃袭击拒绝](m4-active-raid-failed.webp) · [继续](m4-continue-dawn.webp) | 12币/无战斗奖励、保存后跳时、失败可退出、HUD及相机 |
| 尺寸与DPR | [1280×720/1](m5-matrix-1280-1.webp) · [1366×768/1.5](m5-matrix-1366-1.5.webp) · [1920×1080/2](m5-matrix-1920-2.webp) | 真实resize、相机移动、偏好、焦点；游戏bufferDPR上限1.5 |
| 同档与正式包 | [北门同档](m5-journey-night-raid.webp) · [实际死亡返回](m5-journey-death-return.webp) · [正式包醒后](m5-production-dawn.webp) | 主线及一次状态保留、标题继续、生产无调试面板 |
| 保存结束输入 | [成功](m5-onend-success.webp) · [失败](m5-onend-failed.webp) | 较早修后快照；最新自动化仍保松键后不续走 |

上述最新截图已实际打开检查。结算后东门截图m3-east-night-battle仅作为场景记录，活跃战斗由m3-east-night-live及录像证明，不把“截图文件存在”写成通过。

## 连续画面与音频

- [正常速率黄昏→夜晚](m5-transition.webm)：35秒，18:29起点正式隔离导入，之后按1.5分钟/秒有效模拟自然跨19点。连续帧[0](m5-transition-0.webp)、[10秒](m5-transition-1.webp)、[20秒](m5-transition-2.webp)、[30秒](m5-transition-3.webp)，[时间/灯光采样](transition.json)。已查看提取帧，未据单张宣称连续。
- [东门夜袭连续录像](m3-east-night-battle.webm)：17.72秒，1280×720、DPR1、最终5897源码；合法隔离起点、生产预警保存/出生，真实移动/K/J，午夜/保存/重载。已查看录像多个帧及活跃截图，原完整文件未改速。
- [夜间相机移动](m5-night-camera.webm)：最终性能同路线真实左右移动，1280×720、DPR1；世界锚定灯光不随屏幕漂移。
- [实际环境音旁路录音](m5-ambience.webm)：来自游戏AudioContext，能解码且无削波；没有可用监听输入，听感仍未验。文件或节点存在不等于听过。

## 状态、验证与性能

- [同档连续恢复证据链](complete-route.json)、[候选后半实际步骤](complete-path-candidate.json)、[最终后半实际步骤](complete-path-final.json)、[实际结束存档](complete-path-final-state.json)。前段失败和中断保留；并非从头单轮全过，未后台直接写结果字段。
- [真实命令与结果摘要](verification-results.json)，原日志和trace在.parry-local/day-night各独立输出目录。
- [正式包可写调试标识扫描](production-boundary.json)：还配合正式浏览器按钮/global断言；合法只读诊断允许保留。
- [四次标题继续资源检查](lifecycle.json)：416对象、153纹理、2环境循环、1覆盖层不增长，监听数量不增长；开发日历跳时，不冒充正常速率长期性能。
- [最终同条件30秒对照](performance.json)：基线、白天、夜晚都录相同尺寸录像。包含其他并行源码变化，不能将全部差异归因昼夜，不宣称稳定60FPS。
- [无录像对照](performance-without-video.json)、[20秒采样测量](performance-profile.json)、[长帧诊断结论](performance-diagnostic.json)：仍有208—250ms长帧，CPU采样未确认根因，不能假称稳定帧率。
- [早期性能](performance-early.json)、[早期生命周期](lifecycle-early.json)：仅历史对照，不替代当前版本证据。
