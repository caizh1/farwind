"""检查死亡接地、两份可编辑时间线的一致性；不替代全身穿插目检。"""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/east-boss-animation';clips=json.loads((BASE/'source/clips.json').read_text())['clips']
results=[];poses=[]
for file in ['east-boss-animation-render.blend','east-boss-animation-editable.blend']:
 p=BASE/'source'/file;bpy.ops.wm.open_mainfile(filepath=str(p));s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];matrix=[]
 for clip in clips.values():
  for f in [clip['start'],round((clip['start']+clip['end'])/2),clip['end']]:
   s.frame_set(f);bpy.context.view_layer.update();matrix.extend(v for b in r.pose.bones for row in b.matrix for v in row)
 poses.append(matrix)
 minimum=100;worst=None
 for f in range(clips['death']['start'],clips['death']['end']+1):
  s.frame_set(f);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  low=min((ob.matrix_world@v.co).z for ob in s.objects if ob.type=='MESH' for v in ob.evaluated_get(deps).data.vertices)
  if low<minimum:minimum=low;worst=f
 results.append({'工程':file,'摘要':hashlib.sha256(p.read_bytes()).hexdigest(),'死亡最低点':minimum,'最低帧':worst})
diff=max(abs(a-b) for a,b in zip(*poses));report={'说明':'两份工程每个动作起中末帧比较全部骨骼变形矩阵；死亡全帧检查实际网格最低点。','工程':results,'最大矩阵差':diff,'结论':'通过' if diff<.001 and all(v['死亡最低点']>=-.001 for v in results) else '需检查'}
(BASE/'evidence/ground-and-source.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
