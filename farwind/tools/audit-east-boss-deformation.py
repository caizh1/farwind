"""逐帧检查指定风险：根足穿地、双镰表面互穿、刚性件长度和冠枝接点。"""
import json
import os
import sys
import hashlib
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1];OUT=Path(os.environ.get('EAST_BOSS_ART_OUT', ROOT/'docs/east-boss-art-v2')).resolve()
delivery='--delivery' in sys.argv
path=OUT/'source'/('east-boss-art-delivery.blend' if delivery else 'east-boss-art-editable.blend')
extra_path=OUT/'evidence/extra-connections.json'
extra_connections=json.loads(extra_path.read_text())['连接'] if extra_path.exists() else []
bpy.ops.wm.open_mainfile(filepath=str(path))
scene=bpy.context.scene;scene.frame_set(1)
if delivery:
    # 按交付时保留的部位组临时拆出审计网格，复制实际交付权重；不保存这些临时对象。
    rig=bpy.data.objects['缚枝祭主·可编辑骨架']
    for ob in list(scene.objects):
        if ob.type!='MESH':continue
        groups={g.index:g.name for g in ob.vertex_groups}
        for group in list(ob.vertex_groups):
            if not group.name.startswith('部位·'):continue
            name=group.name[3:]
            if not any(s in name for s in ['镰刃分层截面','嵌入式风核','面具开孔骨壳','落地主根','落地二级分叉','落地细分根','踝根连续','树冠承重主枝','冠枝次级分叉','冠枝三级短梢','冠枝末端不规则短梢','深木钩齿']):continue
            selected=[v for v in ob.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)];mapping={v.index:i for i,v in enumerate(selected)}
            faces=[tuple(mapping[i] for i in p.vertices) for p in ob.data.polygons if all(i in mapping for i in p.vertices)]
            data=bpy.data.meshes.new(name+'审计网格');data.from_pydata([v.co[:] for v in selected],[],faces);data.update(calc_edges=True)
            part=bpy.data.objects.new(name,data);scene.collection.objects.link(part);part.parent=rig;part.matrix_world=ob.matrix_world.copy()
            for bone in rig.data.bones:part.vertex_groups.new(name=bone.name)
            for i,v in enumerate(selected):
                for g in v.groups:
                    if groups[g.group] in rig.data.bones:part.vertex_groups[groups[g.group]].add([i],g.weight,'REPLACE')
            mod=part.modifiers.new('交付绑定审计','ARMATURE');mod.object=rig
rigids=[o for o in scene.objects if o.type=='MESH' and ('镰刃分层截面' in o.name or '嵌入式风核' in o.name or '面具开孔骨壳' in o.name)]
feet=[o for o in scene.objects if o.type=='MESH' and ('落地主根' in o.name or '落地二级分叉' in o.name or '落地细分根' in o.name or '踝根连续' in o.name)]
lengths={}
assert rigids and feet, '检查对象为空，禁止将漏检视为通过'
assert all(o.matrix_world == bpy.data.objects['左镰刃分层截面'].matrix_world for o in scene.objects if o.type=='MESH' and ('镰刃分层截面' in o.name or '冠枝' in o.name or '落地' in o.name or '深木钩齿' in o.name)), '交叉检测对象坐标系不一致'
for ob in rigids:
    edges=np.array([e.vertices[:] for e in ob.data.edges]);co=np.array([v.co[:] for v in ob.data.vertices]);base=np.linalg.norm(co[edges[:,0]]-co[edges[:,1]],axis=1)
    lengths[ob.name]=(edges,base)
def coords(ob,deps):
    ev=ob.evaluated_get(deps);me=ev.to_mesh();flat=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',flat)
    local=flat.reshape(-1,3);m=np.array(ev.matrix_world);world=local@m[:3,:3].T+m[:3,3];ev.to_mesh_clear();return world
intersections=[];floor=[];max_error=0;max_absolute=0
for frame in range(scene.frame_start,scene.frame_end+1):
    scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    low=min(float(coords(o,deps)[:,2].min()) for o in feet)
    floor.append(low)
    for ob in rigids:
        co=coords(ob,deps);edges,base=lengths[ob.name];now=np.linalg.norm(co[edges[:,0]]-co[edges[:,1]],axis=1);valid=base>1e-3
        max_error=max(max_error,float(np.abs(now[valid]/base[valid]-1).max()))
        max_absolute=max(max_absolute,float(np.abs(now-base).max()))
    left=BVHTree.FromObject(bpy.data.objects['左镰刃分层截面'],deps)
    right=BVHTree.FromObject(bpy.data.objects['右镰刃分层截面'],deps)
    if left.overlap(right):intersections.append(frame)
    if frame%80==0:print('已检查帧：',frame,flush=True)
scene.frame_set(1);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();junctions=[]
for item in extra_connections:
    child=bpy.data.objects[item['子枝']];parent=bpy.data.objects[item['父枝']]
    assert child.matrix_world==parent.matrix_world,'新增连接坐标系不一致'
    overlap=BVHTree.FromObject(child,deps).overlap(BVHTree.FromObject(parent,deps))
    junctions.append({**item,'表面交叉三角对':len(overlap)})
for ob in scene.objects:
    name=ob.name
    if name.startswith('冠枝次级分叉'):
        i=int(name.split('冠枝次级分叉')[1].split('-')[0]);parent=bpy.data.objects['树冠承重主枝'+str(i)]
    elif name.startswith('冠枝三级短梢'):
        parent=bpy.data.objects[name.replace('冠枝三级短梢','冠枝次级分叉')]
    elif name.startswith('冠枝末端不规则短梢'):
        parent=bpy.data.objects[name.replace('冠枝末端不规则短梢','树冠承重主枝')]
    elif '落地二级分叉' in name:
        parent=bpy.data.objects[name.replace('落地二级分叉','落地主根')]
    elif '深木钩齿' in name:
        parent=bpy.data.objects[name[0]+'镰刃分层截面']
    else:continue
    overlap=BVHTree.FromObject(ob,deps).overlap(BVHTree.FromObject(parent,deps))
    junctions.append({'子枝':ob.name,'父枝':parent.name,'表面交叉三角对':len(overlap)})
report={'范围':'源工程全部检查帧；仅覆盖所列几何风险，不是所有网格之间的穿插证明。','帧数':len(floor),'根足最低高度':min(floor),'最低帧':floor.index(min(floor))+1,'双镰相交帧':intersections,'刚性件最大相对边长变化':max_error,'刚性件最大绝对边长变化':max_absolute,'数值精度说明':'相对误差统计长度大于零点零零一的边，避免短边放大单精度舍入误差；所有边另检绝对误差。','次枝接点':junctions,'结论':'通过' if min(floor)>=0 and not intersections and max_error<1e-3 and max_absolute<3e-6 and all(x['表面交叉三角对'] for x in junctions) else '需修复'}
report['工程']='交付工程' if delivery else '可编辑源工程';report['工程摘要']=hashlib.sha256(path.read_bytes()).hexdigest()
(OUT/'evidence'/('deformation-delivery-audit.json' if delivery else 'deformation-audit.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
if report['结论']!='通过':
    raise RuntimeError('变形检查未通过；详细失败项已写入中文报告。')
