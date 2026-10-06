"""检查交付工程的换手边界、支撑脚与纹理完整性。"""
import json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];DOC=ROOT/'docs/east-boss-vine-refinement'
bpy.ops.wm.open_mainfile(filepath=str(DOC/'source/east-boss-vine-refined.blend'));s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];defs=json.loads((DOC/'source/clips.json').read_text())['clips']
def at(name,t):
    f=defs[name]['start']+t*.06;s.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
    return {b.name:b.matrix.copy() for b in r.pose.bones}
boundaries=[]
for a,ta,b,tb in [('vine-enter',1200,'vine-left',324),('vine-left',1000,'vine-right',0),('vine-right',1000,'vine-left',0),('vine-right',794,'vine-exit',0)]:
    p=at(a,ta);q=at(b,tb);delta=max(abs(p[k][i][j]-q[k][i][j]) for k in p for i in range(4) for j in range(4));boundaries.append({'入口':a,'出口':b,'矩阵最大差':delta});assert delta<.008,(a,b,delta)
feet=[]
for name,c in defs.items():
    first=at(name,0);drift=0
    for t in range(0,c['duration']+1,16):
        p=at(name,t)
        drift=max(drift,*[(p[side+'脚'].translation-first[side+'脚'].translation).length for side in ['左','右']])
    feet.append({'动作':name,'支撑脚最大漂移':drift});assert drift<.012,(name,drift)
missing=[i.name for i in bpy.data.images if i.type=='IMAGE' and not i.has_data and not i.packed_file]
assert not missing,missing
report={'说明':'骨架矩阵检查证明边界及脚部位置连续；最终观感仍需实战与慢放检查。','换手边界':boundaries,'脚部支撑':feet,'新增根束网格':len([o for o in s.objects if '臂·交织根出口' in o.name]),'长藤源网格':len([o for o in s.objects if o.name.startswith('长藤·')]),'缺失纹理':missing,'源帧率':s.render.fps}
path=DOC/'evidence/source-audit.json';path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
