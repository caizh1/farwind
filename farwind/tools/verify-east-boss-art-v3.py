"""核对第三版最终摘要与源／交付像素一致性，禁止混用不同轮次证据。"""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/east-boss-art-v3';EVIDENCE=OUT/'evidence'
def read(name):return json.loads((EVIDENCE/name).read_text())
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
source=OUT/'source/east-boss-art-editable.blend';delivery=OUT/'source/east-boss-art-delivery.blend'
hashes={'可编辑源工程':digest(source),'交付工程':digest(delivery)}
assert digest(OUT/'source/east-boss-art-baseline.blend')==digest(ROOT/'docs/east-boss-art-v2/source/east-boss-art-editable.blend')==read('structure-changes.json')['基线摘要'],'第二版保护基线改变'
engineering=read('engineering-validation.json')
assert engineering['结论']=='通过'
for record,label in zip(engineering['工程'],hashes):assert record['摘要']==hashes[label],'工程检查摘要不是最终版本'
for file,label in [('deformation-audit.json','可编辑源工程'),('deformation-delivery-audit.json','交付工程')]:
    audit=read(file)
    assert audit['结论']=='通过' and audit['工程摘要']==hashes[label]
    assert audit['帧数']==320 and not audit['双镰相交帧'] and audit['根足最低高度']>=0
assert read('texture-bake.json')['源工程摘要']==hashes['可编辑源工程']
for mode in ['static','source','motion']:
    for record in read('render-'+mode+'.json')['记录']:
        assert record['摘要']==digest(ROOT/record['工程']),'渲染证据来自旧工程'
comparisons=[]
for name,a,b in [('正面',OUT/'source-check/evidence/front.png',EVIDENCE/'front.png'),('左斜面',OUT/'source-check/evidence/quarter-left.png',OUT/'delivery-check/evidence/quarter-left.png')]:
    source_pixels=np.array(Image.open(a).convert('RGBA')).astype(np.int16)
    delivery_pixels=np.array(Image.open(b).convert('RGBA')).astype(np.int16)
    assert source_pixels.shape==delivery_pixels.shape==(2048,2048,4)
    mask=(source_pixels[:,:,3]>12)|(delivery_pixels[:,:,3]>12)
    delta=np.abs(source_pixels-delivery_pixels);colors=delta[:,:,:3][mask]
    mean=float(colors.mean());percentile=float(np.percentile(colors,99));alpha=int(delta[:,:,3].max())
    comparisons.append({'视图':name,'主体颜色平均差':mean,'颜色差百分之九十九分位':percentile,'透明度最大差':alpha})
    assert mean<=1 and percentile<=3 and alpha==0,'烘焙一致性不达标：'+name
comparison={'说明':'相同相机、灯光、姿态和尺寸，数值量程为255；不代表原画相似度。','源工程摘要':hashes['可编辑源工程'],'交付工程摘要':hashes['交付工程'],'视图':comparisons,'结论':'通过'}
(EVIDENCE/'bake-render-comparison.json').write_text(json.dumps(comparison,ensure_ascii=False,indent=2)+'\n')
frames=list((EVIDENCE/'motion-frames').glob('*.png'))
assert {p.stem for p in frames}=={f'{i:04d}' for i in range(1,321)},'连续检查帧缺失或有旧帧'
manifest={'结论':'通过','说明':'摘要、工程、指定变形风险和烘焙一致性通过；美术等待用户签收，不包含正式动画或实机验收。','工程摘要':hashes,'静态视角姿势检查':sum(len(r['视角与姿势']) for r in engineering['工程']),'逐帧检查总数':640,'原始连续渲染帧':len(frames),'基线':'第二版摘要保持不变','烘焙一致性':comparisons}
(EVIDENCE/'final-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
proportions=read('proportions.json')
old=json.loads((ROOT/'docs/east-boss-art-v2/evidence/proportions.json').read_text())
old_marks={v['地标']:v for v in old['模型'][0]['地标']}
rows=[]
for v in proportions['模型'][0]['地标']:
    if v['地标'] in ['面具下缘','左肩连接','左肘转折','左膝','左踝','左镰尖','右镰尖']:
        rows.append(f"| {v['地标']} | {v['原画距头顶高度']:.3f} | {old_marks[v['地标']]['模型距头顶高度']:.3f} | {v['模型距头顶高度']:.3f} |")
stats='\n'.join(f"| {'可编辑源' if i==0 else '交付副本'} | {r['网格数']} | {r['顶点']:,} | {r['面']:,} | {r['字节']/1024/1024:.2f} |" for i,r in enumerate(engineering['工程']))
metrics='\n'.join(f"- {r['视图']}：主体颜色平均差 {r['主体颜色平均差']:.3f}/255，百分之九十九分位 {r['颜色差百分之九十九分位']:.0f}/255，透明度最大差 {r['透明度最大差']}。" for r in comparisons)
doc='''# 缚枝祭主第三版：静态返修验收记录

静态返修、可编辑工程和烘焙交付已完成，工程检查通过。最终美术签收等待用户确认。正式战斗动画和游戏实机不在本轮范围内。

## 对照与修改

原画使用项目内原始透明图片。第二版保护基线独立重新打开并渲染；主相机与灯光保持不变。所有对照直接引用原始渲染，未补画、未锐化。查看 [三方审阅页](index.html) 和 [浏览器对照证据](evidence/browser-comparison.jpg)。

| 问题 | 本轮实际修改 | 视觉结论与边界 |
|---|---|---|
| 叶簇放射、叶片过大 | 改为有叶轴的短叶簇，补齐肩、腰、臂、膝部覆盖；叶根连接到真实叶轴；局部绕叶轴翻转增加侧面可见体积。 | 羽毛肩甲观感减弱；部分簇的规律性仍比原画明显。 |
| 躯干交叉带、木柱腿 | 收细前层主根、替换腹部次根，腿根分股并增加回绕；背侧根端渐细收进连接处。 | 根股与空隙增加；仍比原画概括，并非所有交汇处都焊接为连续拓扑。 |
| 枝冠横向过宽 | 三十四段冠枝共同横向收拢，保留父子枝连接和纵深。 | 相对肩叶的跨度缩小；末梢复杂度仍低于原画。 |
| 双镰骨色不突出 | 扩大骨色刃面，减少齿尖突出，修正左右不同的尖端弧线和高度。 | 左侧内收长弧、右侧向下尖端更明确；保留有厚度的刃面。 |
| 根足像放射爪 | 调整贴地路径的曲折，提高踝部过渡，新增六条细分根。 | 支撑轮廓与分叉增加；细小根须密度仍低于原画。 |
| 面具和风核比例 | 收窄面具并提高头肩；风核缩小，根框收拢并改变粗细，保留真实眼孔。 | 焦点尺寸改善；风核笔触和原画旋流风格仍有差异。 |
| 材质过于概括 | 提高既有绘画纹理贡献，叶色按簇分配，区分骨木与树皮。 | 材质层次改善；没有宣称重画全部原画笔触，也没有完成真实绿色间接光照烘焙。 |

首轮短叶沿用了大叶固定折幅，出现过度卷曲，已改为按叶宽计算截面。新镰尖使检查动作第126帧出现互穿，已通过整臂前后错位修复并重新验证全序列。背侧露出的根端和侧面叶片过薄也经过补修。阶段快照保留，不以失败初稿作为最终效果。

## 比例证据

头顶为零、脚底为一。表中是中立姿态的投影位置；原画地标人工标注误差约为主体高度的百分之一至二。只作比例诊断，不作美术相似度评分。

| 地标 | 原画 | 第二版 | 第三版 |
|---|---:|---:|---:|
'''+ '\n'.join(rows)+'''

中立姿态右肩高度仍比原画高约主体高度的百分之三点二，原画左右肩本身不等高；独立展示姿态使该差异缩小到约百分之二点五。横向地标仍有差异，尤其肩部和展示姿态的身体中心，不能据此宣称逐点还原。两个姿态均在审阅页保留。

## 工程与回归结果

- 两份工程独立重开，三十四项静态视角／关键姿势通过。
- 两份工程各检查三百二十帧，共六百四十帧；双镰表面互穿帧为零，根足最低高度约为零点零零四个场景单位，无穿地。
- 面具、风核和双镰的刚性件边长误差满足原有阈值；未通过放宽阈值绕过失败。
- 五十三处分叉及钩齿接点存在表面连接；新增细分根也参与源工程和交付工程检测。
- 骨架二十三根，名称与父级不变；静止位置已调整，后续正式动画需要重新适配。
- 权重、有限坐标、纹理坐标、贴图打包、眼孔射线和画面边界检查通过。
- 原始连续片段三百二十帧，每秒三十帧，约十点六七秒；它是变形检查序列，不是正式攻击动画。

源工程与交付工程像素一致性：

'''+metrics+'''

| 工程 | 网格 | 顶点 | 多边形面 | 大小（兆字节） |
|---|---:|---:|---:|---:|
'''+stats+'''

以上是多边形面，不是三角面预算。顶点增加来自新的叶簇、叶轴和交付叶片厚度，不代表已满足实时性能要求。

## 方案和工具审查

VERDICT: PASS

P0/P1 BLOCKERS: 无。审查覆盖快照保护、输出目录隔离、绑定和权重、检测对象选择与坐标系、失败退出、摘要一致性、烘焙副本、原始渲染和旧版保护。未发现有可达触发链和充分证据成立的严重工程阻塞问题。结论仅适用于本次静态离线交付，不是最终美术批准或游戏发布批准。

UNVERIFIED RISKS:

- 全部网格之间的连续碰撞尚未穷举；枝叶与根系存在设计性的嵌合，不能把所有相交都判为错误。
- 正式战斗动画、游戏镜头、战斗遮挡、导出兼容性和实际运行性能未验证。
- 最终原画还原度等待用户根据实际图像签收。

NON-BLOCKING FINDINGS:

- 叶簇重复节奏、树皮细笔触、根足复杂度和风核风格仍有差距，见上方逐项记录。
- 现有素材仍用于离线渲染；四张四千像素颜色图集不能作为实时资源预算依据。

## 文件与最终摘要

- [可编辑工程](source/east-boss-art-editable.blend)
- [烘焙交付工程](source/east-boss-art-delivery.blend)
- [使用与复现说明](DELIVERY-README.md)
- [最终验证记录](evidence/final-manifest.json)
- [工程检查](evidence/engineering-validation.json)、[源工程逐帧检查](evidence/deformation-audit.json)、[交付逐帧检查](evidence/deformation-delivery-audit.json)
- [像素一致性](evidence/bake-render-comparison.json)、[比例数据](evidence/proportions.json)、[静止位置变化](evidence/rest-pose-changes.json)

可编辑源工程摘要：`'''+hashes['可编辑源工程']+'''`。

交付工程摘要：`'''+hashes['交付工程']+'''`。

第二版源工程摘要保持不变。未修改正式游戏、存档或运行时素材，未提交、推送或部署。
'''
(OUT/'FINAL-ACCEPTANCE.md').write_text(doc)
print(json.dumps(manifest,ensure_ascii=False,indent=2))
