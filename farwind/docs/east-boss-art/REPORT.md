# 缚枝祭主静态美术候选：交付与审查

## 当前状态

本轮交付的是新静态美术候选，工程与交付检查通过，最终美术尚待确认。没有宣称已经达到原画或《哈迪斯》的完成度。

按用户方案“静态美术确认后：更新六秒动作和 1080p／60fps 视频”，本轮保留上一版六秒动画，不把尚未确认的模型直接接入正式战斗。当前工程时间轴中的一、四十、八十和一百帧只是静态及弯曲检查姿势。

## 造型与材质

- 以项目正面、侧面和背面高清原图为参考，正面形象为主标准。背面参考仍有风核，因此保留较小的背部风核，并通过颅后根系、面具朝向和正背不同的披叶区分朝向。
- 重新构造交织躯干、肩肘过渡、分叉根足、带前后纵深的树冠、细长面具、实体镰刃、内齿与木质背脊。
- 面具后方有实体颅壳与根系支撑，肩叶有正面、背面和侧向层次；主体没有使用整张原画投影卡片。
- 风核使用嵌入根系的弧面与手绘风格旋流纹理。体积来自网格，颜色来自独立材质。
- 根系、骨木、风核分别展开绘制坐标。叶片复用颜色区域，避免将大量小叶片拆成细小图集岛后损失叶脉采样质量。
- 四张 4K 图集和四张生成源图均保留并打包。源图实际为 1254×1254；4K 指烘焙后的绘制图集，不能理解成新增的原生 4K 细节。

纹理使用内置 imagegen 工具生成，模型由显式路径及网格构造完成，不宣称人工逐笔绘制或人工笔刷雕刻。完整输入记录见 [纹理来源与提示词](TEXTURE-PROMPTS.md)。

## 可复核交付

| 交付物 | 规格 |
| --- | --- |
| [Blender 工程](source/east-boss-art.blend) | 69,307,529 字节；图片已打包 |
| [正面透明图](evidence/front.png) | 2048×2048；实际主体高 1672 像素 |
| [原画、上一版与本轮对照](evidence/art-comparison.jpg) | 同背景、同主体展示高度，旧版与新版均为静态姿势 |
| [三视图](evidence/three-views.jpg) | 同一工程的正面、侧面与背面 |
| [灰模与纯色轮廓](evidence/structure-check.jpg) | Blender 材质覆盖直接渲染 |
| [肩肘弯曲检查](evidence/bend-check.jpg) | 左右肩肘和躯干扭转 |
| [局部细节](evidence/detail-board.jpg) | 面具、风核、根系及肩肘 |
| [小尺寸识别](evidence/readability.jpg) | 主体高 256、384、512 像素的离线样本 |

原始透明 PNG 保留在证据目录中。对照板仅裁去透明留白、统一主体高度、排版并加中文标签，没有补画、锐化或遮盖模型。二维原画没有真实相机参数，因此不宣称三者相机完全一致；两个三维版本采用相近的游戏视角比较。

| 颜色图集 | 尺寸 | 文件体积 |
| --- | --- | --- |
| 树身与根系 | 4096×4096 | 14,900,882 字节 |
| 披肩与枝叶 | 4096×4096 | 16,709,761 字节 |
| 面具与双镰 | 4096×4096 | 9,320,963 字节 |
| 风核弧面 | 4096×4096 | 10,672,019 字节 |

四张图集按未压缩四通道估算共 256 MiB；这是离线源工程的纹理预算，不是游戏运行时已通过的预算。本轮不将这些源纹理装入游戏。

## 验证记录

独立重开最终 `.blend`，检查全部 76,913 个顶点、73,600 个网格面和 23 根骨骼：未绑定顶点为零，骨骼权重和最大误差约 2.98e-08。四张图集尺寸正确，源图片与图集均已打包，源 UV 和绘制 UV 都保留。

检查正面、侧面、背面及左右弯曲五个相机／姿势样本，坐标有限且角色完整处于安全画面内。三视图与局部渲染经过人工视觉检查。此检查不构成所有姿势、所有角度完全无穿插的证明。

浏览器实际点击全部七个视图按钮，图片均完整加载，实际尺寸与交付文件一致。466 像素宽视口没有横向溢出。页面的图片、工程与贴图下载目标已核对存在；未重复下载大型工程。

机器可读结果见 [工程检查](evidence/engineering-validation.json)、[图集记录](evidence/texture-bake.json) 和 [交付尺寸与体积](evidence/delivery-validation.json)。脚本语法检查通过。未运行游戏全量回归，因为本轮没有修改游戏代码或正式素材。

## 复现与编辑

在项目根目录执行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python tools/build-east-boss-art.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/bake-east-boss-art.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-east-boss-art.py -- --load --render all
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-east-boss-art.py -- --load --render clay
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/build-east-boss-art.py -- --load --render silhouette
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/check-east-boss-art.py
python3 tools/compose-east-boss-art.py
```

重新构建会覆盖本目录候选工程，手动修改前应另存版本。旧动作工程位于 `docs/east-boss-motion/source/east-boss-motion.blend`，本轮只读，不覆盖。对照排版使用本轮保留的 `previous-neutral.png`；原始上一版渲染采用旧工程第一帧、透明背景和游戏相机。

工程中的四个主要网格按根系、枝叶、面具双镰、风核分组，保留骨骼权重和以“部位”开头的选择组，方便继续局部编辑。源纹理节点、源坐标及烘焙后的绘制坐标同时保留。

## 工程审查

VERDICT: PASS

P0/P1 BLOCKERS:

无。审查范围为本轮静态资产生成、烘焙、工程保存、独立检查及审阅页。已检查源与目标 UV 分离、图集打包、生成源分辨率表述、肩部权重过渡、三维体积、透明版面边界、旧文件保护及下载路径；没有成立的 P0/P1 阻塞项。此结论不等于美术验收通过。

UNVERIFIED RISKS:

- 是否足够接近原画的细腻度、轮廓气质和整体美术完成度，仍需用户视觉确认。
- 全动作范围的肩叶遮挡、细部穿插、动态镰刃路径及连续发力尚未验证。
- 正式游戏的实际缩放、纹理预算、加载耗时、帧率及战斗手感未接入验证。

NON-BLOCKING FINDINGS:

- 当前纹理仍有复用，部分根系和面具折面较简化；该候选不宣称最终雕刻级完成度。
- 4K 图集来自较小源纹理的映射与烘焙，无法等同于原生 4K 绘制。
- 八方向及完整六秒动画迁移遵循静态确认关口，不在本轮擅自扩展。
