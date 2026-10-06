"""生成中文审阅页；原始渲染只做浏览器排版，不修图、不重绘。"""
import json
import os
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('EAST_BOSS_ART_OUT', ROOT/'docs/east-boss-art-v2')).resolve()
groups={
 '本轮结构': [('本轮修改前','evidence/final-pass/before-front.png'),('本轮修改后','evidence/front.png'),('本轮灰模','evidence/clay.png')],
 '灰模前后': [('修改前灰模','evidence/final-pass/before-clay.png'),('修改后灰模','evidence/clay.png'),('修改后轮廓','evidence/silhouette.png')],
 '对照': [('原画目标','../combat-v2/source/bound-branch-down-idle.png'),('加强前','../east-boss-art/evidence/front.png'),('第二版加强','evidence/front.png')],
 '结构': [('加强前灰模','../east-boss-art/evidence/clay.png'),('第二版灰模','evidence/clay.png'),('第二版轮廓','evidence/silhouette.png')],
 '展示姿态': [('原画目标','../combat-v2/source/bound-branch-down-idle.png'),('中立造型','evidence/front.png'),('独立展示姿态','evidence/presentation.png')],
 '中性光': [('展示灯光','evidence/front.png'),('中性灯光','evidence/neutral.png'),('灰模结构','evidence/clay.png')],
 '多视角': [('正面','evidence/front.png'),('左斜面','evidence/quarter-left.png'),('右斜面','evidence/quarter-right.png'),('侧面','evidence/side.png'),('背面','evidence/back.png')],
 '局部': [('面具与枝冠','evidence/mask.png'),('风核与主根','evidence/roots.png'),('肩肘与镰刃','evidence/joint.png'),('脚踝到根足','evidence/ankle.png'),('枝冠侧面纵深','evidence/crown-side.png')],
 '变形': [('左肩肘弯曲','evidence/bend-left.png'),('右肩肘弯曲','evidence/bend-right.png'),('双镰交叉','evidence/cross.png'),('抬肩展开','evidence/shoulders.png'),('左腿抬起','evidence/step-left.png'),('右腿抬起','evidence/step-right.png'),('躯干左扭','evidence/twist-left.png'),('躯干右扭','evidence/twist-right.png'),('左肩单独抬起','evidence/shoulder-left.png'),('右肩单独抬起','evidence/shoulder-right.png'),('落脚回到中立','evidence/landing.png')],
 '小尺寸': [('主体高二百五十六像素','evidence/front.png'),('主体高三百八十四像素','evidence/front.png'),('主体高五百一十二像素','evidence/front.png')],
}
if OUT.name=='east-boss-art-v3':
    groups['本轮结构']=[('第二版保护基线','baseline/evidence/front.png'),('第三版返修','evidence/front.png'),('第三版灰模','evidence/clay.png')]
    groups['灰模前后']=[('第二版灰模','baseline/evidence/clay.png'),('第三版灰模','evidence/clay.png'),('第三版轮廓','evidence/silhouette.png')]
    groups['对照']=[('原画目标','../combat-v2/source/bound-branch-down-idle.png'),('第二版保护基线','baseline/evidence/front.png'),('第三版返修','evidence/front.png')]
    groups['结构']=[('第二版轮廓','baseline/evidence/silhouette.png'),('第三版轮廓','evidence/silhouette.png'),('第三版灰模','evidence/clay.png')]
data={}
for group,items in groups.items():
    data[group]=[]
    for label,relative in items:
        path=(OUT/relative).resolve();im=Image.open(path).convert('RGBA')
        bbox=im.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
        assert bbox,'渲染主体为空：'+str(path)
        data[group].append({'标签':label,'路径':relative,'尺寸':list(im.size),'主体边界':bbox})
(OUT/'evidence/image-manifest.json').write_text(json.dumps({'说明':'记录原始图片尺寸和透明主体边界，仅供网页等比排版。','分组':data},ensure_ascii=False,indent=2))
html='''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>缚枝祭主 · 第二版精修</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#16201c;color:#e8e9d9;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}main{max-width:1700px;margin:auto;padding:30px 34px}header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}h1{font-size:25px;font-weight:600;margin:0 0 9px;letter-spacing:1px}p{color:#aabbad;font-size:13px;line-height:1.7;margin:0}a{color:#d2dcaa;text-decoration:none}a:hover{text-decoration:underline}.links{display:flex;gap:18px;flex-wrap:wrap;font-size:13px}nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:23px 0 16px;border-bottom:1px solid #344139}button{font:inherit;font-size:13px;color:#c9d3bd;background:transparent;border:1px solid #435044;border-radius:7px;padding:8px 17px;cursor:pointer}button[aria-pressed=true]{background:#d3dda9;color:#182219;border-color:#d3dda9}button:focus-visible,a:focus-visible{outline:2px solid #ede1a7;outline-offset:4px}.background{margin-left:auto}#gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;padding-top:20px}figure{margin:0;min-width:0}figcaption{font-size:13px;color:#c3cdb5;margin:0 0 12px;display:flex;justify-content:space-between;gap:8px}figcaption a{font-size:11px;color:#8fa48f}.art{width:100%;display:block;background:var(--paper,transparent);border-radius:8px}footer{margin-top:20px;padding:18px 0;border-top:1px solid #344139}#gallery.small{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-evenly}.small figure{max-width:100%}.small .art{max-width:100%}.light{--paper:#cdd2c1}#status{font-size:12px;margin-top:10px;color:#93a78f}@media(min-width:1300px){main{padding-left:50px;padding-right:50px}}@media(max-width:720px){main{padding:20px 16px}#gallery{grid-template-columns:1fr;gap:28px}.background{margin-left:0}h1{font-size:21px}.art{max-height:650px}header{gap:14px}}
</style>
<main><header><div><h1>缚枝祭主 · 第二版精修</h1><p>实体造型与材质加强 · 直接从交付工程渲染 · 静态交付候选 · 正式动作与游戏接入未包含</p></div><div class="links"><a href="source/east-boss-art-editable.blend" download>精修源工程</a><a href="source/east-boss-art-delivery.blend" download>交付工程</a><a href="FINAL-ACCEPTANCE.md">最终验收记录</a><a href="evidence/deformation-preview.mp4">变形检查短片</a></div></header>
<nav aria-label="审阅视图"></nav><section id="gallery" aria-label="渲染对照"></section>
<footer><p id="caption"></p><p id="status">正在读取工程检查记录。</p></footer><details><summary>连续变形检查与比例记录</summary><p>三百二十帧检查序列，包含扭转、单肩抬起、双镰交叉与落脚；不是正式六秒战斗动画。</p><video controls preload="metadata" style="display:block;width:min(100%,700px);margin:16px auto" src="evidence/deformation-preview.mp4"></video>__PROPORTIONS__</details></main>
<script>
const groups=__DATA__,gallery=document.getElementById('gallery'),nav=document.querySelector('nav'),ns='http://www.w3.org/2000/svg';
function show(group){
 gallery.replaceChildren();gallery.className=group==='小尺寸'?'small':'';
 nav.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===group)));
 groups[group].forEach((item,index)=>{
  const fig=document.createElement('figure'),cap=document.createElement('figcaption'),link=document.createElement('a');
  cap.append(document.createTextNode(item.标签));link.href=item.路径;link.textContent='原图';link.target='_blank';link.rel='noopener';cap.append(link);
  const svg=document.createElementNS(ns,'svg'),img=document.createElementNS(ns,'image');svg.classList.add('art');svg.setAttribute('viewBox','0 0 900 1000');svg.setAttribute('role','img');svg.setAttribute('aria-label',item.标签);
  const [x,y,right,bottom]=item.主体边界,[w,h]=item.尺寸,bw=right-x,bh=bottom-y,scale=Math.min(1000/bh,880/bw);
  img.setAttribute('href',item.路径);img.setAttribute('x',450-bw*scale/2-x*scale);img.setAttribute('y',1000-bh*scale-y*scale);img.setAttribute('width',w*scale);img.setAttribute('height',h*scale);svg.append(img);
  if(group==='小尺寸'){const height=[256,384,512][index];svg.style.width=(height*.9)+'px';svg.style.height=height+'px'}
  fig.append(cap,svg);gallery.append(fig);
 });
 document.getElementById('caption').textContent=group==='变形'?'关节检查姿势，不是最终攻击动画。抬肩图使用更宽相机以完整展示双镰。':group==='小尺寸'?'桌面视口按标注高度显示；窄屏可能受容器宽度限制。实际游戏背景与缩放尚未验证。':'对照图统一主体展示高度；二维原画无真实相机参数。模型图片未补画、未锐化，原图可直接查看。';
}
Object.keys(groups).forEach(group=>{const b=document.createElement('button');b.textContent=group;b.dataset.group=group;b.addEventListener('click',()=>show(group));nav.append(b)});
const bg=document.createElement('button');bg.className='background';bg.textContent='切换浅背景';bg.setAttribute('aria-pressed','false');bg.addEventListener('click',()=>{const light=document.body.classList.toggle('light');bg.textContent=light?'切换深背景':'切换浅背景';bg.setAttribute('aria-pressed',String(light))});nav.append(bg);show('本轮结构');
fetch('evidence/engineering-validation.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(r=>{const d=r.工程.at(-1);document.getElementById('status').textContent=`工程检查：${r.结论} · ${d.骨骼} 根骨骼 · ${d.顶点.toLocaleString()} 个顶点 · 旧版工程保持不变。工程通过不等于最终美术通过。`}).catch(()=>document.getElementById('status').textContent='工程验证记录尚未完成，请查看当前报告。');
</script></html>'''
proportions=json.loads((OUT/'evidence/proportions.json').read_text())
rows=''.join('<tr><td>'+v['地标']+'</td><td>'+format(v['原画距头顶高度'],'.3f')+'</td><td>'+format(v['模型距头顶高度'],'.3f')+'</td></tr>' for v in proportions['模型'][0]['地标'])
table='<p>'+proportions['方法']+'</p><div style="overflow:auto"><table style="width:100%;text-align:left;line-height:2"><thead><tr><th>地标</th><th>原画高度位置</th><th>中立模型高度位置</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
if OUT.name=='east-boss-art-v3':
    html=html.replace('第二版精修','第三版返修').replace("show('本轮结构');","show('对照');")
    html=html.replace('静态交付候选','静态返修完成 · 待美术签收')
(OUT/'index.html').write_text(html.replace('__DATA__',json.dumps(data,ensure_ascii=False)).replace('__PROPORTIONS__',table))
print('中文审阅页已生成，所有视图直接引用原始渲染。')
