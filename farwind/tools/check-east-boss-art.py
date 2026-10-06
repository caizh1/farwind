"""独立重开交付工程，检查蒙皮、纹理打包、视图边界和弯曲样本。"""
import json
import math
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/east-boss-art'
path=OUT/'source/east-boss-art.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
scene=bpy.context.scene;rig=bpy.data.objects['缚枝祭主·可编辑骨架']
models=[o for o in scene.objects if o.type=='MESH']
assert len(rig.data.bones)==23,'骨架数量不符'
unweighted=[];weight_error=0
for ob in models:
    assert ob.parent==rig,'网格未挂接到骨架：'+ob.name
    assert any(m.type=='ARMATURE' and m.object==rig for m in ob.modifiers),'缺少有效骨骼修改器'
    bone_indices={g.index for g in ob.vertex_groups if g.name in rig.data.bones}
    for v in ob.data.vertices:
        total=sum(g.weight for g in v.groups if g.group in bone_indices)
        if total<.99:unweighted.append([ob.name,v.index])
        weight_error=max(weight_error,abs(total-1))
assert not unweighted,'存在未绑定或权重不足的顶点'
atlases=[]
for image in bpy.data.images:
    if image.source=='FILE':assert image.packed_file,'图片未打包：'+image.name
    if image.name.endswith('-paint-4k'):
        assert tuple(image.size)==(4096,4096),'图集尺寸不符'
        assert image.packed_file,'图集未打包'
        atlases.append(image.name)
assert len(atlases)==4,'图集数量不符'
for name in ['树身与根系','披肩与枝叶','面具与双镰','风核弧面']:
    ob=bpy.data.objects[name]
    assert '手绘源坐标' in ob.data.uv_layers and '四千像素绘制坐标' in ob.data.uv_layers,'缺少源或目标UV'
    for u in ob.data.uv_layers['四千像素绘制坐标'].data:
        assert all(math.isfinite(float(x)) and -.001<=x<=1.001 for x in u.uv),'UV越界'
views=[]
for camera,frame in [('游戏视角',1),('侧面视角',1),('背面视角',1),('游戏视角',40),('游戏视角',80)]:
    scene.frame_set(frame);bpy.context.view_layer.update()
    cam=bpy.data.objects[camera];deps=bpy.context.evaluated_depsgraph_get()
    pts=[];world=[]
    for ob in models:
        evaluated=ob.evaluated_get(deps);me=evaluated.to_mesh()
        for v in me.vertices:
            co=evaluated.matrix_world@v.co
            assert all(math.isfinite(float(x)) for x in co),'变形后坐标非有限'
            world.append(co);pts.append(world_to_camera_view(scene,cam,co))
        evaluated.to_mesh_clear()
    bounds=[min(p.x for p in pts),min(p.y for p in pts),max(p.x for p in pts),max(p.y for p in pts)]
    assert all(.025<x<.975 for x in bounds),'角色超出安全画面：'+str(bounds)
    views.append({'相机':camera,'帧':frame,'归一化画面边界':bounds,'最低世界高度':min(p.z for p in world),'前后厚度':max(p.y for p in world)-min(p.y for p in world)})
report={'说明':'工程完整性与有限姿态检查通过；不代表美术达到原画或哈迪斯水准，也不证明所有网格完全无穿插。','结论':'通过','工程字节':path.stat().st_size,'骨骼数量':len(rig.data.bones),'网格对象数量':len(models),'顶点数量':sum(len(o.data.vertices) for o in models),'面数':sum(len(o.data.polygons) for o in models),'未绑定顶点数量':len(unweighted),'骨骼权重最大误差':weight_error,'四千像素图集':atlases,'相机样本':views}
(OUT/'evidence/engineering-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
