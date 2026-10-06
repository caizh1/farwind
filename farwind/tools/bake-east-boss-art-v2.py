"""从精修源工程制作交付副本；按材质色块烘焙，保持面具与叶片原始连续坐标。"""
import hashlib
import os
import json
import math
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('EAST_BOSS_ART_OUT', ROOT/'docs/east-boss-art-v2')).resolve()
SOURCE=OUT/'source/east-boss-art-editable.blend'
DELIVERY=OUT/'source/east-boss-art-delivery.blend'
TEX=OUT/'source/textures'
TEX.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene;scene.frame_set(1)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
scene.render.bake.margin=8;scene.render.bake.use_selected_to_active=False
records=[]
for slug,label,prefix in [('wood','树身与根系','树皮·'),('leaves','披肩与枝叶','叶片·'),('ivory','面具与双镰','骨木·'),('core','风核弧面','风核·')]:
    objects=[ob for ob in scene.objects if ob.type=='MESH' and ob.data.materials and ob.data.materials[0].name.startswith(prefix)]
    assert objects,'缺少烘焙部位：'+label
    # 每组复制材质，防止同一种木色在木身和镰刃两张图集中互相改写。
    copies={}
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True);bpy.context.view_layer.objects.active=ob
        for mod in list(ob.modifiers):
            if mod.type=='SOLIDIFY':bpy.ops.object.modifier_apply(modifier=mod.name)
        for slot in ob.material_slots:
            original=slot.material
            if original.name not in copies:
                copies[original.name]=original.copy();copies[original.name].name=original.name+'·'+label
            slot.material=copies[original.name]
        part=ob.vertex_groups.new(name='部位·'+ob.name);part.add(list(range(len(ob.data.vertices))),1,'REPLACE')
        ob.select_set(False)
    mats=list(copies.values());columns=math.ceil(math.sqrt(len(mats)));rows=math.ceil(len(mats)/columns)
    # 色块与源纹理一一映射；留出图集边距，避免过滤时串色。
    pad=.012
    def atlas_uv(original,index):
        return ((index%columns+pad+float(original[0])*(1-2*pad))/columns,
                (index//columns+pad+float(original[1])*(1-2*pad))/rows)
    for ob in objects:
        original=ob.data.uv_layers['手绘源坐标']
        target=ob.data.uv_layers.new(name='交付颜色坐标')
        for poly in ob.data.polygons:
            index=mats.index(ob.data.materials[poly.material_index])
            for li in poly.loop_indices:target.data[li].uv=atlas_uv(original.data[li].uv,index)
        ob.data.uv_layers.active=target;target.active_render=True
    image=bpy.data.images.new(slug+'-paint-4k-v2',width=4096,height=4096,alpha=False)
    image.generated_color=(.025,.025,.02,1);image.filepath_raw=str(TEX/(slug+'-paint-4k-v2.png'));image.file_format='PNG'
    changes=[]
    for mat in mats:
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        p=nodes.get('Principled BSDF');out=nodes.get('Material Output');original=out.inputs['Surface'].links[0].from_socket
        em=nodes.new('ShaderNodeEmission')
        if p.inputs['Base Color'].is_linked:links.new(p.inputs['Base Color'].links[0].from_socket,em.inputs[0])
        else:em.inputs[0].default_value=p.inputs['Base Color'].default_value
        links.new(em.outputs[0],out.inputs['Surface'])
        target=nodes.new('ShaderNodeTexImage');target.name='交付颜色图集';target.image=image;nodes.active=target
        changes.append((mat,p,out,original,em,target))
    # 一个临时网格容纳全部色块，单次烘焙不会逐对象清空已经完成的区域。
    verts=[];faces=[]
    for i in range(len(mats)):
        k=len(verts);x=i*3;verts.extend([(x,0,0),(x+2,0,0),(x+2,2,0),(x,2,0)]);faces.append((k,k+1,k+2,k+3))
    data=bpy.data.meshes.new('临时颜色平面');data.from_pydata(verts,[],faces);data.update()
    helper=bpy.data.objects.new('临时颜色平面',data);scene.collection.objects.link(helper)
    src=data.uv_layers.new(name='手绘源坐标');dst=data.uv_layers.new(name='交付颜色坐标')
    for mat in mats:data.materials.append(mat)
    for i,poly in enumerate(data.polygons):
        poly.material_index=i
        for li,uv in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):src.data[li].uv=uv;dst.data[li].uv=atlas_uv(uv,i)
    data.uv_layers.active=dst;dst.active_render=True
    bpy.ops.object.select_all(action='DESELECT');helper.select_set(True);bpy.context.view_layer.objects.active=helper
    bpy.ops.object.bake(type='EMIT',use_clear=True);image.save()
    bpy.data.objects.remove(helper,do_unlink=True)
    for mat,p,out,original,em,target in changes:
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        links.new(original,out.inputs['Surface']);nodes.remove(em)
        uv=nodes.new('ShaderNodeUVMap');uv.uv_map='交付颜色坐标';links.new(uv.outputs['UV'],target.inputs['Vector'])
        links.new(target.outputs['Color'],p.inputs['Base Color'])
        if p.inputs['Emission Color'].is_linked:links.new(target.outputs['Color'],p.inputs['Emission Color'])
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();model=bpy.context.object;model.name=label
    records.append({'部位':label,'源部件数':len(objects),'材质色块数':len(mats),'图集尺寸':[4096,4096],'顶点':len(model.data.vertices),'面':len(model.data.polygons),'策略':'原坐标映射到独立材质色块，不自动切碎面具，不改变源工程'})
    print('已完成交付图集：'+label,flush=True)
scene.render.engine='BLENDER_EEVEE';scene.frame_set(1);scene.camera=bpy.data.objects['游戏视角']
scene.view_layers[0].material_override=None
scene.render.resolution_x=2048;scene.render.resolution_y=2048;scene.render.resolution_percentage=100
scene['源工程摘要']=source_hash
bpy.ops.object.select_all(action='DESELECT');rig=bpy.data.objects['缚枝祭主·可编辑骨架'];rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(DELIVERY))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash,'烘焙不允许改写精修源工程'
(OUT/'evidence/texture-bake.json').write_text(json.dumps({'说明':'四张四千像素图集是材质颜色打包结果，不代表增加了源图绘画细节。精修源工程未修改。','源工程摘要':source_hash,'交付图集':records},ensure_ascii=False,indent=2))
