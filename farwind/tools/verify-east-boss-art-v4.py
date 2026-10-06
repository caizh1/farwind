"""核对第四版最终证据，生成中文三方审阅页与验收记录。"""
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/east-boss-art-v4';E=OUT/'evidence'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((E/name).read_text())
source=OUT/'source/east-boss-art-editable.blend';delivery=OUT/'source/east-boss-art-delivery.blend'
hashes={'可编辑源工程':digest(source),'交付工程':digest(delivery)}
changes=read('scythe-changes.json');projections=read('scythe-projections.json')
assert digest(OUT/'source/east-boss-art-baseline.blend')==digest(ROOT/'docs/east-boss-art-v3/source/east-boss-art-editable.blend')==changes['基线摘要'],'第三版保护基线改变'
engineering=read('engineering-validation.json')
assert engineering['结论']=='通过'
for row,label in zip(engineering['工程'],hashes):assert row['摘要']==hashes[label],'工程检查不是最终版本'
for filename,label in [('deformation-audit.json','可编辑源工程'),('deformation-delivery-audit.json','交付工程'),('scythe-audit.json','可编辑源工程'),('scythe-delivery-audit.json','交付工程')]:
    audit=read(filename)
    assert audit['结论']=='通过' and audit['帧数']==320 and audit['工程摘要']==hashes[label],'逐帧证据缺失、过期或检查未通过：'+filename
assert read('texture-bake.json')['源工程摘要']==hashes['可编辑源工程']
assert projections['工程摘要']==hashes['可编辑源工程']
for mode in ['static','source','motion']:
    for record in read('render-'+mode+'.json')['记录']:
        assert record['摘要']==digest(ROOT/record['工程']),'渲染来自旧工程'
comparisons=[]
for name,a,b in [('正面',OUT/'source-check/evidence/front.png',E/'front.png'),('左斜面',OUT/'source-check/evidence/quarter-left.png',OUT/'delivery-check/evidence/quarter-left.png')]:
    x=np.array(Image.open(a).convert('RGBA')).astype(np.int16);y=np.array(Image.open(b).convert('RGBA')).astype(np.int16)
    assert x.shape==y.shape==(2048,2048,4)
    mask=(x[:,:,3]>12)|(y[:,:,3]>12);d=np.abs(x-y);rgb=d[:,:,:3][mask]
    mean=float(rgb.mean());p99=float(np.percentile(rgb,99));alpha=int(d[:,:,3].max())
    assert mean<=1 and p99<=3 and alpha==0,'烘焙与源工程不一致：'+name
    comparisons.append({'视图':name,'主体颜色平均差':mean,'颜色差百分之九十九分位':p99,'透明度最大差':alpha})
(E/'bake-render-comparison.json').write_text(json.dumps({'说明':'同相机、灯光、姿势、尺寸；量程为二百五十五，不是原画相似度。','结论':'通过','工程摘要':hashes,'视图':comparisons},ensure_ascii=False,indent=2)+'\n')
frames=list((E/'motion-frames').glob('*.png'))
assert {p.stem for p in frames}=={f'{i:04d}' for i in range(1,321)},'连续检查渲染帧不完整'
assert (E/'deformation-preview.mp4').is_file(),'连续检查短片缺失'
shutil.copy2(ROOT/'docs/combat-v2/source/bound-branch-down-idle.png',OUT/'reference.png')
shutil.copy2(ROOT/'docs/east-boss-art-v3/source-check/evidence/front.png',E/'baseline-front.png')
shutil.copy2(ROOT/'docs/east-boss-art-v3/evidence/clay.png',E/'baseline-clay.png')
manifest={'结论':'通过','说明':'静态工程与所列几何风险通过，美术仍待用户验收；正式战斗动画和游戏接入未包含。','工程摘要':hashes,'第三版保护基线摘要':changes['基线摘要'],'静态视角与姿势数':sum(len(r['视角与姿势']) for r in engineering['工程']),'逐帧检查每工程帧数':320,'连续检查渲染帧':320,'范围外保持不变网格数':projections['未修改网格数'],'烘焙一致性':comparisons}
(E/'final-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

norm=changes['相机归一化']
data={'归一化':norm,'原画控制点':changes['原画控制点'],'第三版弧线':changes['弧线'],'第四版弧线':projections['弧线'],'地标':projections['地标']}
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>缚枝祭主 · 第四版双镰返修</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#17211c;color:#e8ecdd;font:15px/1.65 system-ui,-apple-system,sans-serif}main{max-width:1450px;margin:auto;padding:26px 32px}h1{font-size:25px;margin:0 0 6px}p{margin:6px 0;color:#b8c2b4}header{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}a{color:#d1dda9;text-decoration:none}a:hover{text-decoration:underline}.links,nav{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.links{font-size:13px}nav{border-bottom:1px solid #3b483e;margin:22px 0 16px;padding-bottom:15px}button{background:transparent;color:inherit;border:1px solid #465349;border-radius:7px;padding:9px 15px;cursor:pointer;font:inherit}button[aria-pressed=true]{background:#d3dfad;color:#17211c;border-color:#d3dfad}button:focus-visible,a:focus-visible{outline:2px solid #b3e5cf;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.card{min-width:0}.label{display:flex;justify-content:space-between;gap:12px;font-size:14px}.label a{font-size:12px;color:#aab8a4}.model{display:block;width:100%;height:clamp(380px,65vh,680px)}.raw{width:100%;height:480px;object-fit:contain}.detail{width:100%;height:540px}.note{border-top:1px solid #3b483e;margin-top:16px;padding-top:13px;font-size:13px}.pill{color:#d4dfa9}.legend{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:12px}.legend span{display:inline-flex;align-items:center;gap:7px}.swatch{display:block;width:23px;height:3px;background:var(--color)}.small{display:flex;align-items:flex-end;justify-content:center;gap:40px;flex-wrap:wrap}.small svg{display:block}.small figcaption{text-align:center}.small figure{margin:12px 0}video{display:block;width:min(100%,720px);margin:10px auto;background:#111}.light{background:#e5e7dc;color:#26372b}.light p{color:#546250}.light a{color:#496522}.light button[aria-pressed=true]{background:#334b38;color:#f0f3df}.light .label a{color:#596b4d}.light .pill{color:#4b642e}details{margin-top:20px}summary{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #53604b}#facts{overflow:auto}@media(max-width:750px){main{padding:20px 16px}.grid,.grid.two{grid-template-columns:1fr}.model{height:510px}.detail{height:470px}.links{gap:14px}.small{gap:18px}h1{font-size:22px}}
</style><main><header><div><h1>缚枝祭主 · 第四版双镰返修</h1><p>左镰横向回钩 · 右镰向下收尖 · 肩肘高低差 · 连续刃面</p></div><div class="links"><a href="source/east-boss-art-editable.blend">可编辑工程</a><a href="source/east-boss-art-delivery.blend">烘焙交付</a><a href="FINAL-ACCEPTANCE.md">验收记录</a></div></header>
<nav aria-label="审阅视图"><button data-view="compare" aria-pressed="true">三方对照</button><button data-view="overlay" aria-pressed="false">双镰局部叠线</button><button data-view="views" aria-pressed="false">多视角</button><button data-view="clay" aria-pressed="false">灰模与中性光</button><button data-view="small" aria-pressed="false">小尺寸</button><button data-view="motion" aria-pressed="false">连续变形</button><button id="theme" aria-pressed="false">切换浅背景</button></nav>
<section id="gallery" aria-live="polite"></section><div class="note"><p id="caption"></p><p class="pill">工程检查通过：两份工程各三百二十帧；双镰、刀腿、臂侧叶片切刃及镰根连接专项通过。</p><p>第三版保护基线、躯干与双腿网格保持不变。最终美术待验收；正式战斗动画和游戏接入未包含。</p></div>
<details><summary>地标、相机与验收范围</summary><p>左右均指画面左右。按第三版固定相机、头顶与脚底标尺对齐；所有模型图片为真实工程渲染，未补画、未锐化。原画描线是人工近似标注，不是自动分割，也不是美术相似度评分。</p><div id="facts"></div></details></main>
<script>const data=__DATA__;
const ns='http://www.w3.org/2000/svg',gallery=document.getElementById('gallery');
function el(name,attrs={}){const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e}
function imageSvg(path,reference=false,box='-.50 0 1 1.015'){const s=el('svg',{viewBox:box,role:'img','aria-label':reference?'原画角色':'真实工程渲染'});s.classList.add('model');const n=data.归一化;s.append(el('image',{href:path,x:reference?-627.5/1249:-n.中心/n.高度,y:reference?-1/1249:-n.顶部/n.高度,width:reference?1254/1249:1/n.高度,height:reference?1254/1249:1/n.高度}));return s}
function card(label,path,reference=false,raw=false){const c=document.createElement('article');c.className='card';const h=document.createElement('div');h.className='label';h.append(document.createTextNode(label));const a=document.createElement('a');a.href=path;a.target='_blank';a.textContent='查看原图';h.append(a);c.append(h);if(raw){const img=document.createElement('img');img.src=path;img.alt=label;img.className='raw';c.append(img)}else c.append(imageSvg(path,reference));return c}
function line(s,points,color,dash=false){s.append(el('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':'.0022','stroke-dasharray':dash?'.005 .006':'none','stroke-linejoin':'round','stroke-linecap':'round'}))}
const captions={compare:'优先比较左侧镰尖从腿前掠过的方向、右侧下垂尖端与上方肩肘高低差。统一主体高度显示。',overlay:'青色虚线：原画人工控制点；红色：第三版外弧；金色：第四版实际网格投影。根部可能被木甲遮挡，几何曲线重合不等于可见轮廓完全还原。',views:'检查镰刀厚度、木质接头与叶片前后关系；相机沿用第三版。',clay:'灰模用于检查结构，统一中性光用于检查连续刃面；不以纹理掩盖穿插。',small:'主体高度分别为二百五十六和三百八十四像素；此处不做锐化。',motion:'三百二十帧、每秒三十帧的连续变形检查。保留弯肘、交叉、抬肩、抬腿和扭转，整臂避让经过修正；不是正式战斗动画。'};
function show(view){gallery.replaceChildren();gallery.className='grid';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));document.getElementById('caption').textContent=captions[view];
if(view==='compare'){gallery.append(card('原画目标','reference.png',true),card('第三版保护基线','evidence/baseline-front.png'),card('第四版双镰返修','evidence/front.png'))}
if(view==='views'){for(const [label,path] of [['正面','front'],['左斜面','quarter-left'],['右斜面','quarter-right'],['侧面','side'],['背面','back'],['双镰交叉','cross']])gallery.append(card(label,`evidence/${path}.png`,false,true))}
if(view==='clay'){gallery.append(card('第三版灰模','evidence/baseline-clay.png'),card('第四版灰模','evidence/clay.png'),card('第四版中性光','evidence/neutral.png'))}
if(view==='small'){gallery.className='small';for(const height of [256,384]){const f=document.createElement('figure'),s=imageSvg('evidence/front.png'),caption=document.createElement('figcaption');s.classList.remove('model');s.style.height=height*1.015+'px';s.style.width=height+'px';caption.textContent=`主体高 ${height} 像素`;f.append(s,caption);gallery.append(f)}}
if(view==='motion'){gallery.className='';const v=document.createElement('video');v.src='evidence/deformation-preview.mp4';v.controls=true;v.loop=true;v.preload='metadata';gallery.append(v)}
if(view==='overlay'){gallery.className='grid two';for(const side of ['左','右']){const box=side==='左'?'-.415 .40 .385 .49':'.205 .455 .23 .46';const c=document.createElement('article'),h=document.createElement('div');h.className='label';h.textContent=side+'镰 · 第四版局部与三方轮廓';c.append(h);const s=imageSvg('evidence/front.png',false,box);s.classList.remove('model');s.classList.add('detail');line(s,data.第三版弧线[side].修改前外弧,'#f3a19a');for(const name of ['外弧','内弧'])line(s,data.第四版弧线[side][name],'#ffdb72');for(const name of ['外弧','内弧']){const points=data.原画控制点[side][name].map(([x,y])=>[(x-627.5)/1249,(y-1)/1249]);line(s,points,'#84e9dd',true);points.forEach(([x,y])=>s.append(el('circle',{cx:x,cy:y,r:'.0028',fill:'#84e9dd'})))}c.append(s);gallery.append(c)}}}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.getElementById('theme').addEventListener('click',e=>{const on=document.body.classList.toggle('light');e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.textContent=on?'切换深背景':'切换浅背景'});
const table=document.createElement('table');table.innerHTML='<thead><tr><th>第四版实际地标</th><th>横向位置／主体高</th><th>距头顶／主体高</th></tr></thead>';const body=document.createElement('tbody');for(const [name,p] of Object.entries(data.地标)){const r=document.createElement('tr');for(const x of [name,p[0].toFixed(3),p[1].toFixed(3)]){const td=document.createElement('td');td.textContent=x;r.append(td)}body.append(r)}table.append(body);document.getElementById('facts').append(table);show('compare');
</script></html>'''.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('</',r'<\/'))
(OUT/'index.html').write_text(html)

marks=projections['地标'];rows=[]
old=json.loads((ROOT/'docs/east-boss-art-v3/evidence/proportions.json').read_text())['模型'][0]['地标']
for side in ['左','右']:
    name=side+'镰尖';entry=next(v for v in old if v['地标']==name);p=marks[name]
    rows.append(f"| {name} | {entry['原画横向位置']:.4f} | {entry['模型横向位置']:.4f} | {p[0]:.4f} | {p[1]:.4f} |")
metrics='\n'.join(f"- {r['视图']}：主体颜色平均差 {r['主体颜色平均差']:.3f}/255，百分之九十九分位 {r['颜色差百分之九十九分位']:.0f}/255，透明度最大差 {r['透明度最大差']}。" for r in comparisons)
report='''# 缚枝祭主第四版双镰返修验收记录

静态返修、可编辑工程与烘焙交付副本完成。工程检查通过；最终美术签收等待用户确认。查看 [三方审阅页](index.html)。

## 实际修改

- 左镰使用独立内外弧：提高上段起势、加宽横向回钩，使末端从小腿前掠过并越过腿部轮廓。
- 右镰向外展开，下段减少内扣，保持更竖直的向下尖端；左右不再共用镜像曲线。
- 右肩与右肘降低，左肘和关联前臂局部调整；现有二十三根骨骼、名称及父级保持不变。
- 臂侧叶簇整体外移，保留叶片长宽；用十二条实体短枝连接原接点。刀背木脊、木甲和钩齿随整条弧线调整，钩齿根部重新嵌入刃面。
- 躯干、腿部、根足、面具和风核网格保留第三版；相机、灯光及材质参数沿用第三版。范围外网格经过摘要核对。

## 三方对照与地标

原画使用项目原始透明图片；模型使用工程直接渲染。固定第三版相机坐标系及主体高度，避免外移叶片改变包围盒后导致自动居中漂移。以下位置以主体高度归一化。

| 地标 | 原画横向 | 第三版横向 | 第四版横向 | 第四版距头顶 |
|---|---:|---:|---:|---:|
'''+ '\n'.join(rows)+'''

叠线图包含原画人工控制点、第三版外弧及最终工程实际网格投影。人工控制点存在约百分之一至二的主体高度标注误差；曲线对齐不等于可见轮廓完全还原，镰根仍有木甲遮挡。左镰允许在腿前重叠，实际空间穿插另行检查。

## 验证结果

- 可编辑与交付工程分别重新打开：三十四项静态视角及姿势检查通过。
- 两份工程各三百二十帧：双镰表面相交、刀腿穿插、臂侧叶片切刃及镰根连接脱离均为零。
- 保留原有根足最低高度、刚性件边长、五十三处分叉与钩齿连接检查；没有放宽阈值。
- 骨骼数、权重总和、贴图打包、纹理坐标、眼孔射线、画面边界与有限坐标检查通过。
- 正面、双斜面、侧面、背面、灰模、中性光及关键动作直接渲染；审阅页提供二百五十六和三百八十四像素主体高度。
- 三百二十帧连续检查渲染合成为十点六七秒短片；它是变形检查序列，不是正式战斗动画。

源工程与交付副本像素一致性：

'''+metrics+'''

## 检查动作修正

专项检查发现旧序列右臂向后偏移后，弯肘过渡会穿过腿根；改为整臂从前方绕行。左侧在抬腿、扭转时主动避让。左右弯肘换手过渡经过逐帧位移测量，右臂短暂向外绕行，随后回到原横向位置。原有转角、腿部动作及静态第一帧保留，修正后重新检查完整序列。

检查序列为几何压力检查。整臂位移在交叉阶段最大为一点二场景单位，需要在正式动画制作时重新设计自然的肩肘运动，不能直接作为最终攻击动作。

## 工程审查

VERDICT: PASS

P0/P1 BLOCKERS: 无。

检查了第三版快照保护、第四版覆盖保护、修改范围、骨架与坐标系、绑定、网格选择、两份工程独立验证、失败退出、源与交付摘要、渲染来源和烘焙一致性。对表面连接、测试漏选及旧证据混用进行了反证；未发现符合本轮静态离线交付范围的成立的严重阻塞问题。

UNVERIFIED RISKS:

- 没有穷举全身所有网格之间的碰撞；专项覆盖双镰、腿根、臂侧叶片及镰根连接。
- 最终艺术还原度由用户签收；身体和双腿未改，因此全身姿态仍不完全等同原画。
- 正式战斗动画、游戏导出接入与运行性能不在本轮验证范围。

NON-BLOCKING FINDINGS:

- 原画骨木刃面的笔触变化仍比现有材质丰富，本轮没有重绘纹理。
- 为规避穿插修改的检查动作不等于自然战斗动画，后续动画制作需重新适配。

## 证据

- [工程检查](evidence/engineering-validation.json)
- [源工程变形检查](evidence/deformation-audit.json) 与 [交付变形检查](evidence/deformation-delivery-audit.json)
- [源工程双镰专项](evidence/scythe-audit.json) 与 [交付双镰专项](evidence/scythe-delivery-audit.json)
- [真实投影及范围保护](evidence/scythe-projections.json)、[烘焙像素一致性](evidence/bake-render-comparison.json)、[最终摘要](evidence/final-manifest.json)

本轮未修改正式游戏素材引用和存档，未提交、推送或部署。
'''
(OUT/'FINAL-ACCEPTANCE.md').write_text(report)
(OUT/'DELIVERY-README.md').write_text('''# 缚枝祭主第四版双镰返修

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
''')
print(json.dumps({'结论':'通过','烘焙一致性':comparisons,'审阅页':str(OUT/'index.html')},ensure_ascii=False))
