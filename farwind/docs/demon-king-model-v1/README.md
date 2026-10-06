# 寂冠之王建模交付

先打开 [审阅页](index.html) 或本机 `http://127.0.0.1:5368/`，查看原画对照、多视角、连续待机与无黑焰压力视频。

本轮交付角色模型、材质、基础绑定、六秒黑焰待机及离线检查。最终美术签收待确认；正式战斗动作、游戏接入与运行性能另行验收。

## 正式工程

- [可编辑工程](source/demon-king-editable.blend)：保留倒角、布料厚度、骨骼、形态键、手绘贴图与两段骨架动作。
- [渲染交付工程](source/demon-king-delivery.blend)：烘焙倒角和布料厚度，保留骨架、权重、形态键与动作；贴图已打包。
- `source/demon-king-stage-a.blend`、`source/demon-king-stage-b.blend` 是中间候选，供回看比例调整，不作为最终工程。
- `source/textures/` 保存四张材质纹理；原画参考也已打包到工程。

使用 Blender 5.2.2 LTS 打开。工程分为控制、身体、硬甲、布料、王冠、王剑、黑焰、展示和参考九个集合。黑焰集合可单独关闭；相机和灯光位于展示集合。

## 动作与控制

- 默认动作“寂冠之王·六秒待机”：每秒三十帧，正式播放第一至第一百八十帧；第一百八十一帧只用于接缝检查。
- 动作编辑器中另存“寂冠之王·变形压力检查”：第一至第一百二十帧。切换该动作后把时间线末帧改为一百二十，并关闭黑焰集合检查身体；它不代表正式战斗动画。
- 地面根始终固定；悬浮控制沿骨骼局部纵轴抬升身体。悬冠、王剑与十一组袍链分别控制，硬甲使用单骨骼刚性权重。
- 火舌卷动保留为形态键及时间线关键帧，没有烟雾流体缓存。骨架动作切换不会自动切换火舌动画；压力视频为关闭黑焰的身体检查。
- 已检查的压力范围：双臂外展约二十四度、弯肘三十五度、腰胸合计扭转十五度、迈步十二度。正式招式超过这些范围时须重新检查。

## 审阅资料

- [原画同高度对照](previews/comparison.png)、[分件检查板](previews/model-board.png)、[八方向总览](previews/directions.png)。
- [六秒待机](evidence/idle.mp4)、[四秒压力检查](evidence/pressure.mp4)；逐帧透明母版保留在证据目录。
- [二百五十六像素预览](previews/scale-256.png)、[三百八十四像素预览](previews/scale-384.png)、[离线场景比例合成](previews/scene-scale.png)。
- [验收记录](FINAL-ACCEPTANCE.md)、[可编辑工程检查](evidence/audit-source.json)、[交付检查](evidence/audit-delivery.json)、[渲染一致性](evidence/render-consistency.json)。

## 重建与复核

在项目根目录使用本机 Blender 和已配置的图像处理 Python 环境：

```sh
/Users/archer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/prepare-demon-king-assets.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/build-demon-king.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-demon-king.py -- --bake
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-demon-king.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-demon-king.py -- --delivery
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-demon-king.py -- --mode static
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-demon-king.py -- --mode delivery
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-demon-king.py -- --mode idle
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-demon-king.py -- --pressure-render
```

建模脚本默认拒绝覆盖已存在的可编辑工程。开始手工精修前另存快照；只有明确放弃后续手工改动、完整重建时才添加覆盖参数 `--force`。烘焙命令只更新交付副本。

完整合成和清单复核使用 `tools/review-demon-king.py`，需要 Pillow 与 NumPy；它会验证两份检查报告的工程摘要，拒绝把旧检查结果用于新工程。

本轮没有修改游戏素材引用、战斗规则或存档，也没有提交、推送或部署。
