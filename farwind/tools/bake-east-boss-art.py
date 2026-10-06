"""将静态候选的颜色材质烘焙到独立四千像素图集，保留原始手绘源与蒙皮。"""
import json
from pathlib import Path

import bpy

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/east-boss-art'
TEX=OUT/'source/textures'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/east-boss-art.blend'))
scene=bpy.context.scene
scene.frame_set(1)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
scene.render.bake.use_selected_to_active=False
scene.render.bake.margin=12
groups=[('wood','树身与根系',('树皮·',)),('leaves','披肩与枝叶',('叶片·',)),('ivory','面具与双镰',('骨木·',)),('core','风核弧面',('风核·',))]
records=[]
for slug,name,prefixes in groups:
    objects=[o for o in scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0].name.startswith(prefixes)]
    if not objects:raise RuntimeError('缺少待烘焙部位：'+name)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True);bpy.context.view_layer.objects.active=ob
        for mod in list(ob.modifiers):
            if mod.type=='SOLIDIFY':bpy.ops.object.modifier_apply(modifier=mod.name)
        g=ob.vertex_groups.new(name='部位·'+ob.name)
        g.add(list(range(len(ob.data.vertices))),1,'REPLACE')
        ob.select_set(False)
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    model=bpy.context.object;model.name=name
    # 根系等部位使用独立绘制坐标；叶片复用四种区域，避免大量小岛损失叶脉细节。
    uv=model.data.uv_layers.new(name='四千像素绘制坐标')
    model.data.uv_layers.active=uv;uv.active_render=True
    if slug!='leaves':
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.151917,island_margin=.0035,area_weight=.15,correct_aspect=True)
        bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.new(slug+'-paint-4k',width=4096,height=4096,alpha=False)
    image.generated_color=(.03,.035,.025,1)
    image.filepath_raw=str(TEX/(slug+'-paint-4k.png'));image.file_format='PNG'
    temporary=[]
    for mat in model.data.materials:
        n,l=mat.node_tree.nodes,mat.node_tree.links
        p=n.get('Principled BSDF');out=n.get('Material Output')
        original=out.inputs['Surface'].links[0].from_socket
        emission=n.new('ShaderNodeEmission')
        color_input=p.inputs['Base Color']
        if color_input.is_linked:l.new(color_input.links[0].from_socket,emission.inputs[0])
        else:emission.inputs[0].default_value=color_input.default_value
        l.new(emission.outputs[0],out.inputs['Surface'])
        node=n.new('ShaderNodeTexImage');node.name='四千像素可绘制颜色';node.image=image
        n.active=node;node.select=True
        temporary.append((mat,p,out,original,emission,node))
    helper=None
    if slug=='leaves':
        model.select_set(False)
        bpy.ops.mesh.primitive_plane_add(size=2)
        helper=bpy.context.object;helper.name='临时叶片颜色烘焙平面'
        helper.data.uv_layers[0].name='手绘源坐标'
        target_uv=helper.data.uv_layers.new(name='四千像素绘制坐标')
        helper.data.uv_layers.active=target_uv;target_uv.active_render=True
        helper.data.materials.append(model.data.materials[0])
    bpy.ops.object.bake(type='EMIT',use_clear=True)
    if helper:
        bpy.data.objects.remove(helper,do_unlink=True)
        model.select_set(True);bpy.context.view_layer.objects.active=model
    image.save()
    for mat,p,out,original,emission,node in temporary:
        n,l=mat.node_tree.nodes,mat.node_tree.links
        l.new(original,out.inputs['Surface']);n.remove(emission)
        uvnode=n.new('ShaderNodeUVMap');uvnode.uv_map=uv.name
        l.new(uvnode.outputs['UV'],node.inputs['Vector'])
        l.new(node.outputs['Color'],p.inputs['Base Color'])
        if p.inputs['Emission Color'].is_linked:l.new(node.outputs['Color'],p.inputs['Emission Color'])
        n.active=node
    records.append({'部位':name,'文件':str(Path(image.filepath_raw).relative_to(ROOT)),'尺寸':list(image.size),'坐标策略':'叶片共用四个颜色区域' if slug=='leaves' else '独立展开与打包','顶点':len(model.data.vertices),'面数':len(model.data.polygons),'原部件数':len(objects),'图集字节':Path(image.filepath_raw).stat().st_size})
    print('已完成四千像素图集：'+name,flush=True)
scene.render.engine='BLENDER_EEVEE'
scene.frame_set(1);scene.camera=bpy.data.objects['游戏视角']
scene.render.resolution_x=2048;scene.render.resolution_y=2048
scene.render.resolution_percentage=100
bpy.ops.object.select_all(action='DESELECT')
rig=bpy.data.objects['缚枝祭主·可编辑骨架'];rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/east-boss-art.blend'))
(OUT/'evidence/texture-bake.json').write_text(json.dumps({'说明':'四千像素UV图集在Blender中由颜色材质烘焙。生成器原始纹理为1254像素，图集尺寸不意味着获得了新的原生四千像素细节。源纹理和源坐标均保留，可继续纹理绘制。','图集':records,'四图集未压缩四通道字节':4*4096*4096*4},ensure_ascii=False,indent=2))
