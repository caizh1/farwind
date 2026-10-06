# 缚枝祭主第四版双镰返修

查看 [三方审阅页](index.html) 和 [验收记录](FINAL-ACCEPTANCE.md)。

- 继续编辑：[可编辑工程](source/east-boss-art-editable.blend)。
- 渲染或后续导出：[烘焙交付工程](source/east-boss-art-delivery.blend)。
- 修改前保护：[第三版源工程快照](source/east-boss-art-baseline.blend)。

两份第四版工程均打包贴图。正式动作与游戏接入未包含。继续编辑前另存阶段快照；不要运行首次返修脚本覆盖后续手工修改。返修工具默认拒绝覆盖，明确重做才使用覆盖参数。

## 复核命令

在游戏仓库根目录执行。下列烘焙只更新交付副本，不改写可编辑工程。

```sh
export EAST_BOSS_ART_OUT="$PWD/docs/east-boss-art-v4"
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/bake-east-boss-art-v2.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/check-east-boss-art-v2.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-east-boss-deformation.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-east-boss-deformation.py -- --delivery
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-east-boss-scythes-v4.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-east-boss-scythes-v4.py -- --delivery
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-east-boss-art-v4.py -- --mode static
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-east-boss-art-v4.py -- --mode source
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-east-boss-art-v4.py -- --mode motion
ffmpeg -y -framerate 30 -i docs/east-boss-art-v4/evidence/motion-frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart docs/east-boss-art-v4/evidence/deformation-preview.mp4
python3 tools/verify-east-boss-art-v4.py
```

最后一步需要可导入图像读取与数组计算库的 Python 环境。静态渲染和源／交付对照都必须在最后一次工程修改后重新生成，否则摘要验证会拒绝通过。
