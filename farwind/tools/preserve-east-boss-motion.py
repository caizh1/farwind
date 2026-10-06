"""验证未精修动作的骨骼姿态不变，再复用它们的原始母版记录。"""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OLD=ROOT/'docs/east-boss-animation';NEW=ROOT/'docs/east-boss-motion-v2'
old=json.loads((OLD/'source/clips.json').read_text())['clips'];new=json.loads((NEW/'source/clips.json').read_text())['clips'];names=[n for n,c in new.items() if not c.get('refined')]
matrices=[]
for base,clips in [(OLD,old),(NEW,new)]:
 bpy.ops.wm.open_mainfile(filepath=str(base/'source/east-boss-animation-render.blend'));s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];values=[]
 for name in names:
  for fraction in [0,.25,.5,.75,1]:
   f=clips[name]['start']+clips[name]['duration']*fraction*60/1000;s.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update();values.extend(v for b in r.pose.bones for row in b.matrix for v in row)
 matrices.append(values)
diff=max(abs(a-b) for a,b in zip(*matrices));assert diff<.001,('未修改动作发生变形差异',diff)
metadata=json.loads((OLD/'source/frames-all-0-1-2-3-4-5-6-7.json').read_text());metadata['frames']=[f for f in metadata['frames'] if f['clip'] in names];metadata['sourceHash']=hashlib.sha256((NEW/'source/east-boss-animation-render.blend').read_bytes()).hexdigest();metadata['说明']='未精修片段经起中末与四分位骨骼矩阵比对后复用原始母版；几何、材质、相机未修改。'
(NEW/'source/frames-preserved.json').write_text(json.dumps(metadata,ensure_ascii=False)+'\n');(NEW/'evidence/preserved-clips.json').write_text(json.dumps({'说明':metadata['说明'],'动作':names,'最大矩阵差':diff,'复用帧数':len(metadata['frames'])},ensure_ascii=False,indent=2)+'\n');print('未精修动作验证通过',diff)
