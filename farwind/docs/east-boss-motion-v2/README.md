# 东侧首领动作精修交付

先打开 `review.html` 查看同机位新旧对照、慢放、侧面及无特效实战录像。`index.html` 可切换全部动作与八方向；`game.html` 运行正式战斗系统，使用独立样本前请留意当前端口。

## 本轮改动

追赶加减速、逐方向转弯、两次镰击连续换手、真实步进与受阻稳足、左右镰弹反入口。第四版造型及其他招式保留。完整工程、实战、预算与未验证项见 `VALIDATION.md`。

## 文件

- `source/east-boss-animation-editable.blend`：可编辑模型、绑定与动作时间线。
- `source/east-boss-animation-render.blend`：同动作的渲染交付工程。
- `source/clips.json`：动作阶段、支撑相、转弯角度、时间线标记。
- `master/`：透明高清母版；`public/assets/east-boss-motion-v2/`：正式运行图集。
- `evidence/`：实战录像、对照视频、几何与资源检查。
- `fixtures/`：经过正式存档校验的独立初始样本；只用于独立端口，不导入用户的正常旅途。
- `previous-evidence/`：前版记录与工作区基线；前版正式工程和资源仍在原目录。

## 重建顺序

在项目根目录执行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/refine-east-boss.py -- build
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/refine-east-boss.py -- build --delivery
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/refine-east-boss.py -- render
python3 tools/pack-east-boss-motion.py
python3 tools/export-east-boss-motion-videos.py
python3 tools/audit-east-boss-motion-alpha.py
```

本轮为减少重复渲染，未改招式经过 `tools/preserve-east-boss-motion.py` 验证后复用了母版。重新全量渲染时不需要该步骤。两个 Blender 专项检查脚本为 `tools/audit-east-boss-motion.py` 和 `tools/audit-east-boss-motion-ground.py`。

独立验收服务：`node tools/serve-east-boss-motion.mjs`，固定 5366，只允许本页把两个固定录像／报告文件保存到验收目录。普通 5173 服务不开放这个写入接口。存档格式未改版，游戏动画直接读取正式战斗时钟。
