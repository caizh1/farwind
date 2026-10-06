"""独立重开精修与交付工程，检查权重、眼腔深度、贴图、视界和姿态几何。"""
import hashlib
import os
import json
import math
from pathlib import Path

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('EAST_BOSS_ART_OUT', ROOT/'docs/east-boss-art-v2')).resolve()
SOURCE=OUT/'source/east-boss-art-editable.blend'
DELIVERY=OUT/'source/east-boss-art-delivery.blend'
reports=[]
for path in [SOURCE,DELIVERY]:
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene=bpy.context.scene;rig=bpy.data.objects['缚枝祭主·可编辑骨架']
    models=[o for o in scene.objects if o.type=='MESH']
    assert len(rig.data.bones)==23,'骨架数量变化'
    assert all(o.parent==rig for o in models),'存在未挂接的网格'
    max_weight_error=0;uv_out=[]
    for ob in models:
        assert any(m.type=='ARMATURE' and m.object==rig for m in ob.modifiers),'缺少骨骼修改器：'+ob.name
        bone_indices={g.index for g in ob.vertex_groups if g.name in rig.data.bones}
        for v in ob.data.vertices:
            total=sum(g.weight for g in v.groups if g.group in bone_indices)
            max_weight_error=max(max_weight_error,abs(total-1))
        for layer in ob.data.uv_layers:
            for uv in layer.data:
                if not all(math.isfinite(float(v)) and -.001<=v<=1.001 for v in uv.uv):uv_out.append([ob.name,layer.name])
    assert max_weight_error<1e-5,'存在权重不足或重复绑定'
    assert not uv_out,'纹理坐标越界：'+str(uv_out[:4])
    images=[]
    for im in bpy.data.images:
        if im.source=='FILE':
            assert im.packed_file,'外部图片未打包：'+im.name
            images.append({'名称':im.name,'尺寸':list(im.size)})
    scene.frame_set(1);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    sockets=[]
    for x in scene.get('眼腔检测横坐标',[-.116,.116]):
        hit,loc,normal,index,ob,matrix=scene.ray_cast(deps,Vector((x,-2,scene.get('眼腔检测高度',3.535))),Vector((0,1,0)))
        assert hit and '眼窝凹腔' in ob.name,'眼孔被面具或支撑挡住：'+str(ob.name if hit else '没有命中')
        depth=loc.y-(-.49+.67*abs(x)+.12*(3.535-3.54)**2)
        assert depth>.06,'眼腔深度不足'
        sockets.append({'横坐标':x,'命中部位':ob.name,'表面至眼腔深度':depth})
    views=[]
    samples=[('游戏视角',1),('左四分之三',1),('右四分之三',1),('侧面视角',1),('背面视角',1),('游戏视角',40),('游戏视角',80),('游戏视角',120),('动作检查',140),('游戏视角',160),('游戏视角',180)]
    if scene.frame_end>=320:samples.extend([('游戏视角',220),('游戏视角',240),('游戏视角',260),('动作检查',280),('动作检查',300),('游戏视角',320)])
    for cam_name,frame in samples:
        scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();cam=bpy.data.objects[cam_name]
        minx=miny=minz=math.inf;maxx=maxy=-math.inf
        inv=np.array(cam.matrix_world.normalized().inverted(),dtype=np.float64)
        for ob in models:
            evaluated=ob.evaluated_get(deps);me=evaluated.to_mesh()
            flat=np.empty(len(me.vertices)*3,dtype=np.float32);me.vertices.foreach_get('co',flat)
            local=flat.reshape((-1,3));matrix=np.array(evaluated.matrix_world,dtype=np.float64)
            world=local@matrix[:3,:3].T+matrix[:3,3]
            assert np.isfinite(world).all(),'变形后坐标非有限'
            camera=world@inv[:3,:3].T+inv[:3,3];xy=.5+camera[:,:2]/cam.data.ortho_scale
            reference=world_to_camera_view(scene,cam,Vector(world[0]))
            assert max(abs(reference.x-xy[0,0]),abs(reference.y-xy[0,1]))<1e-5,'批量投影与相机投影不一致'
            minx=min(minx,float(xy[:,0].min()));maxx=max(maxx,float(xy[:,0].max()))
            miny=min(miny,float(xy[:,1].min()));maxy=max(maxy,float(xy[:,1].max()));minz=min(minz,float(world[:,2].min()))
            evaluated.to_mesh_clear()
        bounds=[minx,miny,maxx,maxy]
        assert all(.02<v<.98 for v in bounds),'画面裁切：'+str((cam_name,frame,bounds))
        assert minz>-.015,'检查姿势明显穿地：'+str((frame,minz))
        views.append({'相机':cam_name,'帧':frame,'画面边界':bounds,'最低高度':minz})
    if path==DELIVERY:
        assert scene['源工程摘要']==hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'交付工程不是最新源工程'
        atlases=[im for im in bpy.data.images if im.name.endswith('-paint-4k-v2')]
        assert len(atlases)==4 and all(tuple(im.size)==(4096,4096) for im in atlases),'交付图集缺失'
        for name in ['树身与根系','披肩与枝叶','面具与双镰','风核弧面']:
            assert '交付颜色坐标' in bpy.data.objects[name].data.uv_layers,'缺少交付坐标'
    reports.append({'工程':str(path.relative_to(ROOT)),'摘要':hashlib.sha256(path.read_bytes()).hexdigest(),'字节':path.stat().st_size,'网格数':len(models),'顶点':sum(len(o.data.vertices) for o in models),'面':sum(len(o.data.polygons) for o in models),'骨骼':len(rig.data.bones),'权重最大误差':max_weight_error,'眼腔射线检查':sockets,'图片':images,'视角与姿势':views})
baseline=ROOT/'docs/east-boss-art/source/east-boss-art.blend'
assert hashlib.sha256(baseline.read_bytes()).hexdigest()=='b30f8e6143ee6d74e45c1e21fd5fbefd25643d9d19e01eae0614f0b0acff09ca','旧版工程发生变化'
report={'结论':'通过','范围':'源工程与交付工程分别覆盖记录内全部视角姿势；不等于完整动画无穿插，不代表正式游戏性能或最终美术验收。','旧版工程':'摘要保持不变','工程':reports}
(OUT/'evidence/engineering-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
