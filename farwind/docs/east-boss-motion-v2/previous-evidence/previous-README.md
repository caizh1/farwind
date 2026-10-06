# 东侧首领正式逐帧动画

本目录以已认可的第四版模型为基线，保留旧版工程，新增可编辑战斗动作、真实八方向母版、压缩与兼容图集，以及正式世界验收入口。伤害、攻击几何、命中时刻、二阶段规则及存档版本沿用原系统。

## 文件与入口

- `source/east-boss-animation-editable.blend`：逐部件模型、原材质及完整动画时间线。
- `source/east-boss-animation-render.blend`：合并网格的渲染副本；时间线与源工程一致。
- `source/clips.json`：动作名称、关键姿势、时间段及战斗阶段标记。时间单位毫秒，工程每秒六十帧。
- `master/`：真实八方向透明母版，中性姿态主体高度约一千零七十四像素。
- `../../../public/assets/east-boss-animation/`：运行清单、裁切图集、原生压缩纹理与兼容图片。
- `index.html`：使用正式 Phaser 纹理加载器的动作检查页面，支持方向、速度与连续双镰。
- `game.html`：加载正式游戏世界的独立验收入口，记录器只读状态，不改变战斗结果。
- `fixtures/`：通过正式存档校验的初始测试条件，须通过游戏导入入口使用；不代表正常旅途通关。
- `evidence/`：工程审计、打包统计、动作检查视频、实战录像与验证记录。

## 制作与重建

在仓库根目录执行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/animate-east-boss.py -- build
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/animate-east-boss.py -- build --delivery
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/animate-east-boss.py -- render --force
python3 tools/pack-east-boss-animation.py
python3 tools/export-east-boss-videos.py
```

修改动画后建议带 `--force` 重渲染；导出器也会按工程修改时间刷新母版，打包器按源工程摘要排除旧记录。局部检查可指定动作和方向；使用 `--probe` 输出诊断图，不会覆盖正式母版。打包必须在完整渲染完成后进行。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/audit-east-boss-animation.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/audit-east-boss-ground.py
npx vitest run tests/east-boss-animation.test.ts tests/east-boss-atlas.test.ts --maxWorkers=1
```

## 游戏行为

运行时主体参考高度固定为五百一十二像素，游戏角色高度维持原先的二百五十世界单位。裁切偏移、地面根点和五个特效挂点都保存在清单中，不按每帧包围盒缩放。不镜像左右镰，不再叠加旧身体网格形变。

起手、锁向、命中、有效期与收势映射到现有攻击实例。持续招式拆分进入、循环、退出；双镰间隔保持换手姿势；步行按自主位移采样，停步选择最接近的支撑相。转向有边界回差，待机转身分成四十五度过渡。

纹理预算包括已驻留与正在读取的页，上限一百九十二兆字节。动作首帧复用为基础包，其他页按当前动作、相邻方向及后续片段预取，并按使用时间回收。支持的设备使用 DXT5／KTX1，其他设备使用透明图片。压缩页附带源工程摘要作为缓存版本。该上限是首领图集显存预算，不是浏览器总内存上限。

战前检查完整清单和分包可用性；不完整或基础资源加载失败时，整只首领使用旧版路径。战中单页异常保留同一新版造型的已加载帧，并记录错误，不在一场战斗中切换新旧造型。

比较参数：`?eastBossArt=legacy` 强制旧版；`?eastBossTexture=png` 强制兼容图片；`?eastBossEffects=off` 关闭新版身体攻击特效。地面危险提示继续由正式战斗几何绘制。

## 验收边界

动作检查视频用于观察姿势与关节；实战录像用于观察正式时钟、移动、命中、弹反、加载和暂停恢复。工程碰撞检查仅覆盖报告所列部位，不能替代慢放目检。最终美术和手感以实际游戏验收为准，不能从测试通过、贴图分辨率或骨骼数量推定达到参考作品完成度。

完整结果见 [验收记录](VALIDATION.md)。原生图集另附无损传输包，合计约三百七十六 MiB；加载器兼容服务器自动解包与浏览器手动解包。可编辑工程的七张来源图片均已内嵌。死亡奖励先保存，倒地动画完成后才显示胜利界面。

本机审阅入口：[动作检查](http://127.0.0.1:5365/docs/east-boss-animation/index.html)、[正式世界验收](http://127.0.0.1:5365/docs/east-boss-animation/game.html)。独立端口不覆盖原游戏端口的旅途存档。

透明边缘修复已完成，见 [白边专项验收](ALPHA-FIX.md)。压缩图集使用离线预乘颜色，PNG 保持普通透明；资源内容摘要用于缓存隔离。
