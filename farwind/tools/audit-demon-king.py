"""独立重开工程，检查绑定、刚性、循环与明确列出的穿插风险。"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/demon-king-model-v1'
spec=importlib.util.spec_from_file_location('demon_model',ROOT/'tools/build-demon-king.py');model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)
parser=argparse.ArgumentParser();parser.add_argument('--delivery',action='store_true');parser.add_argument('--bake',action='store_true');parser.add_argument('--pressure-render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
path=OUT/'source'/('demon-king-delivery.blend' if args.delivery else 'demon-king-editable.blend')
bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene;scene.frame_set(1);rig=bpy.data.objects['寂冠之王·基础绑定']
meshes=[o for o in scene.objects if o.type=='MESH']
if args.bake:
    for ob in meshes:
        bpy.context.view_layer.objects.active=ob
        armatures=[m for m in ob.modifiers if m.type=='ARMATURE']
        for mod in armatures:mod.show_viewport=False
        for mod in list(ob.modifiers):
            if mod.type in ['BEVEL','SOLIDIFY']:
                bpy.ops.object.modifier_apply(modifier=mod.name)
        for mod in armatures:mod.show_viewport=True
    for im in bpy.data.images:
        if im.source=='FILE':im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/demon-king-delivery.blend'))
    print('交付副本已烘焙几何修改器，骨架、形态键与动作均保留。');sys.exit(0)

assert meshes and len(rig.data.bones)>40,'检查对象或骨架为空'
failures=[]
def check(ok,message):
    if not ok:failures.append(message)

def coords(ob,deps):
    ev=ob.evaluated_get(deps);me=ev.to_mesh();a=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',a)
    a=a.reshape(-1,3);m=np.asarray(ev.matrix_world);result=a@m[:3,:3].T+m[:3,3];ev.to_mesh_clear();return result

for ob in meshes:
    check(all(math.isfinite(c) for v in ob.data.vertices for c in v.co),ob.name+'存在非有限坐标')
    check(bool(ob.data.uv_layers),ob.name+'缺少纹理坐标')
    check(any(m.type=='ARMATURE' and m.object==rig for m in ob.modifiers),ob.name+'缺少正式骨架绑定')
    groups={g.index:g.name for g in ob.vertex_groups}
    for v in ob.data.vertices:
        ws=[g.weight for g in v.groups if groups[g.group] in rig.data.bones]
        if abs(sum(ws)-1)>1e-5:failures.append(ob.name+'权重未归一化');break
check(all(im.packed_file for im in bpy.data.images if im.source=='FILE'),'存在未打包文件纹理')
crown=[o for o in meshes if o.name.startswith('悬冠·第')];check(len(crown)==7,'冠片数量不是七枚')
flames=[o for o in meshes if o.data.shape_keys];check(len(flames)>=40,'火舌漏建')
rigids=[o for o in meshes if o.get('刚性') and not o.data.shape_keys]
feet=[o for o in meshes if '靴·' in o.name]
clothes=[o for o in meshes if o.users_collection[0].name=='布料']
legs=[o for o in meshes if o.name.endswith(('大腿·连续内衬','小腿·连续内衬'))]
sword=bpy.data.objects['王剑·缺刃实体'];hand=bpy.data.objects['右掌甲'];face=bpy.data.objects['无面·封闭空相']
scene.frame_set(1);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
base={};first={o.name:coords(o,deps) for o in meshes}
for ob in rigids:
    co=first[ob.name];ev=ob.evaluated_get(deps);me=ev.to_mesh()
    edges=np.asarray([e.vertices[:] for e in me.edges],dtype=int);ev.to_mesh_clear()
    base[ob.name]=(edges,np.linalg.norm(co[edges[:,0]]-co[edges[:,1]],axis=1))
grip_start=(rig.matrix_world@rig.pose.bones['王剑'].head)-(rig.matrix_world@rig.pose.bones['右手'].head)
max_rigid=0.;min_floor=1e9;min_gap=1e9;loop_error=0.;max_grip=0.;collisions=[];frames=0;max_hover=0.;max_root=0.
base_hip=(rig.matrix_world@rig.pose.bones['骨盆'].head).z;ground_root=rig.pose.bones['地面根'].matrix.copy()

def inspect(label,frame,collision=False):
    global max_rigid,min_floor,min_gap,max_grip,frames,max_hover,max_root
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();frames+=1
    for ob in rigids:
        co=coords(ob,deps);edges,length=base[ob.name];now=np.linalg.norm(co[edges[:,0]]-co[edges[:,1]],axis=1)
        max_rigid=max(max_rigid,float(np.abs(now-length).max()))
    min_floor=min(min_floor,min(float(coords(o,deps)[:,2].min()) for o in feet))
    gap=min(float(coords(o,deps)[:,2].min()) for o in crown)-float(coords(face,deps)[:,2].max());min_gap=min(min_gap,gap)
    grip=(rig.matrix_world@rig.pose.bones['王剑'].head)-(rig.matrix_world@rig.pose.bones['右手'].head)
    max_grip=max(max_grip,abs(grip.length-grip_start.length))
    max_root=max(max_root,max(abs(rig.pose.bones['地面根'].matrix[i][j]-ground_root[i][j]) for i in range(4) for j in range(4)))
    if label=='待机':max_hover=max(max_hover,(rig.matrix_world@rig.pose.bones['骨盆'].head).z-base_hip)
    if collision:
        sb=BVHTree.FromObject(sword,deps)
        lb=[(o.name,BVHTree.FromObject(o,deps)) for o in legs]
        cb=[(o.name,BVHTree.FromObject(o,deps)) for o in clothes]
        for lname,l in lb:
            if sb.overlap(l):collisions.append({'序列':label,'帧':frame,'对象':[sword.name,lname]})
            for cname,c in cb:
                if c.overlap(l):collisions.append({'序列':label,'帧':frame,'对象':[cname,lname]})

for frame in range(1,182):
    scene.frame_set(frame);inspect('待机',frame,True)
scene.frame_set(181);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
for ob in meshes:loop_error=max(loop_error,float(np.abs(coords(ob,deps)-first[ob.name]).max()))

saved_action=rig.animation_data.action
pressure_action=bpy.data.actions.get('寂冠之王·变形压力检查');check(pressure_action is not None,'压力动作未保存在工程中')
pressure_action_error=0.
if pressure_action:
    rig.animation_data.action=pressure_action;scene.frame_set(31);bpy.context.view_layer.update()
    recorded={pb.name:pb.matrix.copy() for pb in rig.pose.bones}
    rig.animation_data.action=None;model.pressure_pose(rig,30/119);bpy.context.view_layer.update()
    pressure_action_error=max(abs(recorded[pb.name][i][j]-pb.matrix[i][j]) for pb in rig.pose.bones for i in range(4) for j in range(4))
    check(pressure_action_error<1e-5,'保存的压力动作与审计动作不一致')
rig.animation_data.action=None
stress_samples=[]
folder=OUT/'evidence/pressure-frames'
if args.pressure_render:
    folder.mkdir(exist_ok=True);bpy.data.collections['黑焰'].hide_render=True
for frame in range(1,121):
    scene.frame_set(1)
    t=(frame-1)/119;pose=math.sin(t*math.tau)
    model.pressure_pose(rig,t)
    inspect('变形压力',frame,True)
    if frame in [1,31,61,91,120]:
        stress_samples.append({'帧':frame,'外展角度':24*abs(pose),'弯肘角度':35*abs(pose),'迈步角度':12*pose})
    if args.pressure_render:
        scene.camera=bpy.data.objects['原画对照'];scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.filepath=str(folder/f'{frame:04d}.png');bpy.ops.render.render(write_still=True)
check(max_rigid<2e-5,'刚性件长度发生变化')
check(min_floor>=-.003,'靴底穿过地面')
check(min_gap>.07,'悬冠与头部间距不足')
check(max_grip<1e-5,'握剑绑定发生漂移')
check(loop_error<2e-5,'待机首尾存在不连续')
check(max_hover>=.06 and max_root<1e-6,'悬浮没有实际抬升身体，或地面根发生漂移')
check(not collisions,'明确检查的剑腿或袍腿表面发生穿插')
report={'工程':'交付工程' if args.delivery else '可编辑工程','工程摘要':hashlib.sha256(path.read_bytes()).hexdigest(),'说明':'逐帧覆盖待机与所列压力姿势；表面穿插检测覆盖缺刃王剑、全部布料与双腿内衬，不是全身所有网格的穷举证明。','网格数':len(meshes),'骨骼数':len(rig.data.bones),'纹理数':sum(im.source=='FILE' for im in bpy.data.images),'七枚冠片':len(crown),'火舌数':len(flames),'逐帧检查数':frames,'待机循环坐标最大误差':loop_error,'已保存压力动作矩阵最大差':pressure_action_error,'刚性件全部边长最大绝对变化':max_rigid,'靴底最低高度':min_floor,'待机实际悬浮抬升高度':max_hover,'地面根矩阵最大变化':max_root,'悬冠与头最小垂直间距':min_gap,'握剑连接最大漂移':max_grip,'压力姿势样本':stress_samples,'穿插记录':collisions,'失败项':failures,'结论':'通过' if not failures else '需修复'}
(OUT/'evidence'/('audit-delivery.json' if args.delivery else 'audit-source.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='穿插记录'},ensure_ascii=False),flush=True)
if failures:raise RuntimeError('工程检查未通过，详见中文报告。')
