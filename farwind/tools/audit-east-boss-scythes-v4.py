"""双镰专项逐帧检查：刀腿表面穿插、臂侧叶片切刃、镰根连接。"""
import hashlib
import json
import os
import sys
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('EAST_BOSS_ART_OUT',ROOT/'docs/east-boss-art-v4')).resolve()
delivery='--delivery' in sys.argv
path=OUT/'source'/('east-boss-art-delivery.blend' if delivery else 'east-boss-art-editable.blend')
bpy.ops.wm.open_mainfile(filepath=str(path))
scene=bpy.context.scene
rig=bpy.data.objects['缚枝祭主·可编辑骨架']
def wanted(name):
    return any(v in name for v in ['镰刃分层截面','腿部扭转主根','腿部回绕次根','膝外生长甲','落地主根','踝根连续','臂侧覆叶簇','臂部主木束','镰根外覆木脊','镰背叠甲','覆叶连接短枝'])
parts={}
if delivery:
    # 按真实交付部位组还原审计对象，直接使用交付网格和权重；不保存。
    for ob in list(scene.objects):
        if ob.type!='MESH':continue
        groups={g.index:g.name for g in ob.vertex_groups}
        for group in list(ob.vertex_groups):
            if not group.name.startswith('部位·') or not wanted(group.name[3:]):continue
            name=group.name[3:]
            selected=[v for v in ob.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)]
            mapping={v.index:i for i,v in enumerate(selected)}
            faces=[tuple(mapping[i] for i in p.vertices) for p in ob.data.polygons if all(i in mapping for i in p.vertices)]
            data=bpy.data.meshes.new(name+'专项审计网格');data.from_pydata([v.co[:] for v in selected],[],faces);data.update(calc_edges=True)
            part=bpy.data.objects.new(name,data);scene.collection.objects.link(part);part.parent=rig;part.matrix_world=ob.matrix_world.copy()
            for bone in rig.data.bones:part.vertex_groups.new(name=bone.name)
            for i,v in enumerate(selected):
                for g in v.groups:
                    if groups[g.group] in rig.data.bones:part.vertex_groups[groups[g.group]].add([i],g.weight,'REPLACE')
            mod=part.modifiers.new('交付绑定专项审计','ARMATURE');mod.object=rig
            parts[name]=part
else:
    parts={o.name:o for o in scene.objects if o.type=='MESH' and wanted(o.name)}
blades=[parts[s+'镰刃分层截面'] for s in ['左','右']]
legs=[o for n,o in parts.items() if any(v in n for v in ['腿部扭转主根','腿部回绕次根','膝外生长甲','落地主根','踝根连续'])]
leaves=[o for n,o in parts.items() if '臂侧覆叶簇' in n and ('叶片' in n or '末叶' in n)]
assert len(blades)==2 and len(legs)>=20 and len(leaves)>=20,'专项检查对象不完整'
assert all(o.matrix_world==blades[0].matrix_world for o in parts.values()),'专项检查对象不在同一坐标系'
hits={'刀腿穿插':{},'叶片切刃':{},'镰根连接脱离':{}}
frames=range(1,321) if '--static' not in sys.argv else [1]
for frame in frames:
    scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    trees={n:BVHTree.FromObject(o,deps) for n,o in parts.items()}
    for blade in blades:
        tree=trees[blade.name]
        for label,candidates in [('刀腿穿插',legs),('叶片切刃',leaves)]:
            for ob in candidates:
                if tree.overlap(trees[ob.name]):hits[label].setdefault(blade.name+'／'+ob.name,[]).append(frame)
        side=blade.name[0]
        family=[n for n in parts if n.startswith(side) and any(v in n for v in ['臂部主木束','镰根外覆木脊','镰背叠甲','镰刃分层截面'])]
        reached={blade.name}
        while True:
            expanded=reached|{n for n in family if n not in reached and any(trees[n].overlap(trees[p]) for p in reached)}
            if expanded==reached:break
            reached=expanded
        if not any('臂部主木束' in n for n in reached):hits['镰根连接脱离'].setdefault(side+'镰根至手臂',[]).append(frame)
    if frame%80==0:print('双镰专项已检查帧：',frame,flush=True)
report={'说明':'刀腿与臂侧叶片使用实际变形表面三角交叉；镰根通过实体连接图验证可达手臂。不是全身所有网格的碰撞证明。','工程':'交付工程' if delivery else '可编辑源工程','工程摘要':hashlib.sha256(path.read_bytes()).hexdigest(),'帧数':len(frames),'对象数':{'镰刃':len(blades),'腿根':len(legs),'臂侧叶片':len(leaves)},'检查结果':hits,'结论':'通过' if not any(hits.values()) else '需修复'}
name='scythe-delivery-audit.json' if delivery else 'scythe-audit.json'
(OUT/'evidence'/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'结论':report['结论'],'问题组合数':{k:len(v) for k,v in hits.items()},'报告':str(OUT/'evidence'/name)},ensure_ascii=False),flush=True)
if report['结论']!='通过':raise RuntimeError('双镰专项检查未通过，必须查看具体对象和帧。')
