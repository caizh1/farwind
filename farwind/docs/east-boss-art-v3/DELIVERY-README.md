# 缚枝祭主第三版静态返修

本目录与第二版独立。继续编辑使用 [可编辑工程](source/east-boss-art-editable.blend)，用于渲染和后续导出的副本是 [交付工程](source/east-boss-art-delivery.blend)。两份工程均打包贴图，保留二十三根骨骼。

打开 [审阅页](index.html) 查看原画、第二版保护基线与第三版返修。页面通过本地静态服务器打开时可以读取工程检查状态；直接用文件方式打开时，部分浏览器会限制读取检查记录。

完整结果及边界见 [验收记录](FINAL-ACCEPTANCE.md)。正式战斗动画、游戏导出接入和实时性能均未包含。

## 继续编辑

直接打开当前可编辑工程，另存阶段快照后继续修改。不要重跑首次返修脚本覆盖后续手工调整。第二版及本轮修改前快照保持独立。

首次返修工具 `refine-east-boss-art-v3.py` 从第二版保护基线出发，只用于复现本轮结构修改。目标工程存在时默认拒绝覆盖；明确使用覆盖选项也会先保存摘要命名快照。`finalize-east-boss-art-v3.py` 加载当前第三版，执行已记录的根端和检查动作修正，不是正式动画迁移工具。

## 渲染与验证

以下命令在游戏仓库根目录运行。环境变量只切换产物目录，既有第二版工具默认行为保持原样。

```sh
export EAST_BOSS_ART_OUT="$PWD/docs/east-boss-art-v3"
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/bake-east-boss-art-v2.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/check-east-boss-art-v2.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-east-boss-deformation.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/audit-east-boss-deformation.py -- --delivery
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/measure-east-boss-proportions.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-east-boss-art-v3.py -- --mode static
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-east-boss-art-v3.py -- --mode source
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/render-east-boss-art-v3.py -- --mode motion
ffmpeg -y -framerate 30 -i docs/east-boss-art-v3/evidence/motion-frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart docs/east-boss-art-v3/evidence/deformation-preview.mp4
python3 tools/verify-east-boss-art-v3.py
python3 tools/compose-east-boss-art-v2.py
```

像素验证需要已安装图像读取与数组计算库的 Python 环境。验证工具会拒绝摘要不匹配、检查失败或不完整的渲染证据。四张四千像素图集是颜色打包，不表示新增了四千像素级的原始绘画细节。

## 保护与限制

- 所有图片均来自真实工程渲染，没有补画或后期锐化。
- 原画是二维参考，相机和姿态不能与三维中立模型完全等同；地标记录用于检查比例，不作为自动相似度评分。
- 逐帧几何检查覆盖双镰、根足、刚性件和已列出的分叉连接，不是全部网格两两连续无穿插的证明。
- 本次未修改游戏逻辑、存档和正式素材引用，未提交、推送或部署。
