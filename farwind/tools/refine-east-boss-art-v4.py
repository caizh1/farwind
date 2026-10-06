"""从第三版保护基线返修双镰和关联肩肘；不重建身体、骨架或材质。"""
import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/east-boss-art-v3'
OUT = ROOT / 'docs/east-boss-art-v4'
SOURCE = OUT / 'source/east-boss-art-editable.blend'
spec = importlib.util.spec_from_file_location('existing_art', ROOT / 'tools/build-east-boss-art-v2.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

# 原画内外弧人工控制点；左右独立。坐标取自项目原始透明图，不是生成图片。
TARGETS = {
    '左': {
        '外弧': [(338,543),(239,620),(183,767),(238,921),(369,1021),(514,1055)],
        '内弧': [(371,560),(291,642),(260,773),(297,886),(395,998),(514,1055)],
    },
    '右': {
        '外弧': [(940,629),(1033,704),(1080,814),(1084,923),(1049,1019),(991,1078)],
        '内弧': [(914,642),(978,723),(1015,823),(1028,925),(1012,1022),(991,1078)],
    },
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def geometry(ob):
    return hashlib.sha256(repr(([tuple(v.co) for v in ob.data.vertices], [tuple(p.vertices) for p in ob.data.polygons])).encode()).hexdigest()

def interpolate(keys, value):
    if value <= keys[0][0]:
        return Vector(keys[0][1])
    for (a, x), (b, y) in zip(keys, keys[1:]):
        if value <= b:
            t = (value-a)/(b-a)
            t = t*t*(3-2*t)
            return Vector(x).lerp(Vector(y), t)
    return Vector(keys[-1][1])

def main():
    parser = argparse.ArgumentParser(description='第四版双镰位置和轮廓返修')
    parser.add_argument('--replace', action='store_true', help='明确重做本脚本结果，先保留已有第四版快照')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for folder in ['source', 'evidence']:
        (OUT/folder).mkdir(parents=True, exist_ok=True)
    baseline = OUT/'source/east-boss-art-baseline.blend'
    base_hash = digest(BASE/'source/east-boss-art-editable.blend')
    if not baseline.exists():
        shutil.copy2(BASE/'source/east-boss-art-editable.blend', baseline)
    assert digest(baseline) == base_hash, '保护基线与当前第三版不一致'
    if SOURCE.exists():
        assert args.replace, '第四版已存在，继续编辑应直接加载；重做必须明确指定'
        shutil.copy2(SOURCE, OUT/f'source/east-boss-art-stage-{digest(SOURCE)[:12]}.blend')
    shutil.copy2(BASE/'evidence/extra-connections.json', OUT/'evidence/extra-connections.json')
    bpy.ops.wm.open_mainfile(filepath=str(baseline))
    scene = bpy.context.scene
    scene.frame_set(1)
    rig = bpy.data.objects['缚枝祭主·可编辑骨架']
    art.art.RIG = rig
    cam = bpy.data.objects['游戏视角']
    cm = cam.matrix_world.to_3x3()
    right, up = cm@Vector((1,0,0)), cm@Vector((0,1,0))
    height, top, center = .8603389636, .0497891307, .4999907464
    scale = cam.data.ortho_scale*height
    def project(p):
        q = world_to_camera_view(scene, cam, p)
        return Vector(((q.x-center)/height, (1-q.y-top)/height))
    def move(p, delta):
        return p + right*(delta.x*scale) - up*(delta.y*scale)
    def target(p, pixel):
        normalized = Vector(((pixel[0]-627.5)/1249, (pixel[1]-1)/1249))
        return move(p, normalized-project(p))
    original_meshes = {o.name:geometry(o) for o in scene.objects if o.type=='MESH'}
    original_bones = {b.name:(b.parent.name if b.parent else None,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones}
    camera_lights = {o.name:(tuple(tuple(r) for r in o.matrix_world),o.data.type, getattr(o.data,'energy',None),getattr(o.data,'ortho_scale',None)) for o in scene.objects if o.type in ['CAMERA','LIGHT']}
    changed = set()
    curves = {}
    for side in ['左','右']:
        ob = bpy.data.objects[side+'镰刃分层截面']
        old = [v.co.copy() for v in ob.data.vertices]
        rows = len(old)//10
        assert rows == 46 and len(old)%10 == 0, '镰刃截面已改变，禁止套用旧拓扑'
        outer_pixels = art.base.path_samples(TARGETS[side]['外弧'], 9)
        inner_pixels = art.base.path_samples(TARGETS[side]['内弧'], 9)
        outer = [target(old[i*10], p) for i,p in enumerate(outer_pixels)]
        inner = [target(old[i*10+4], p) for i,p in enumerate(inner_pixels)]
        old_centers = [(old[i*10]+old[i*10+4])*.5 for i in range(rows)]
        new_centers = [(outer[i]+inner[i])*.5 for i in range(rows)]
        def warp_attachment(p):
            # 在原弧线寻找最近截面，连同截面方向一起搬运附着木甲。
            screen = project(p)
            best = None
            for i in range(rows-1):
                a,b = project(old_centers[i]),project(old_centers[i+1])
                d=b-a
                t=max(0,min(1,(screen-a).dot(d)/max(d.length_squared,1e-12)))
                distance=(screen-a.lerp(b,t)).length_squared
                if best is None or distance<best[0]:best=(distance,i,t)
            _,i,t=best
            a=old_centers[i].lerp(old_centers[i+1],t)
            b=new_centers[i].lerp(new_centers[i+1],t)
            old_dir=(project(old_centers[min(rows-1,i+1)])-project(old_centers[max(0,i)])).normalized()
            new_dir=(project(new_centers[min(rows-1,i+1)])-project(new_centers[max(0,i)])).normalized()
            relative=screen-project(a)
            tangent=relative.dot(old_dir)
            lateral=relative.dot(Vector((-old_dir.y,old_dir.x)))
            return move(p,project(b)+new_dir*tangent+Vector((-new_dir.y,new_dir.x))*lateral-screen)
        for i in range(rows):
            a,b=old[i*10],old[i*10+4]
            span=b-a
            for k in range(10):
                p=old[i*10+k]
                u=max(0,min(1,(p-a).dot(span)/max(span.length_squared,1e-12)))
                ob.data.vertices[i*10+k].co=outer[i].lerp(inner[i],u)+(p-a.lerp(b,u))
        changed.add(ob.name)
        for part in scene.objects:
            if part.type!='MESH' or not part.name.startswith(side):continue
            if any(label in part.name for label in ['深木钩齿','镰根外覆木脊','镰背叠甲']):
                for v in part.data.vertices:v.co=warp_attachment(v.co)
                changed.add(part.name)
        curves[side]={'修改前外弧':[list(project(old[i*10])) for i in range(rows)],'修改后外弧':[list(project(p)) for p in outer],'修改后内弧':[list(project(p)) for p in inner]}

    # 肩肘以同一位置场移动网格与静止骨骼，胸部权重保留在原位。
    arm_keys = {
        '左':[(.25,(0,0)),(.4464,(-.009,.004)),(.54,(.020,-.035)),(.68,(.020,-.035))],
        '右':[(.2584,(0,.0322)),(.4583,(.014,.0269)),(.56,(.024,.010)),(.70,(.024,.010))],
    }
    for ob in scene.objects:
        if ob.type!='MESH' or ob.name in changed:continue
        groups={g.index:g.name for g in ob.vertex_groups}
        touched=False
        for v in ob.data.vertices:
            p=ob.matrix_world@v.co
            delta=Vector((0,0))
            for side in ['左','右']:
                influence=sum(g.weight for g in v.groups if groups[g.group] in [side+'上臂',side+'前臂',side+'镰臂'])
                delta+=interpolate(arm_keys[side],project(p).y)*influence
                if side=='右':
                    leaf_weight=sum(g.weight for g in v.groups if groups[g.group]==side+'肩叶')
                    delta+=Vector((0,.0322))*leaf_weight
            if delta.length_squared>0:
                v.co=ob.matrix_world.inverted()@move(p,delta);touched=True
        if touched:changed.add(ob.name)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for side in ['左','右']:
        for suffix in ['上臂','前臂','镰臂']:
            b=rig.data.edit_bones[side+suffix]
            b.head=move(b.head,interpolate(arm_keys[side],project(b.head).y))
            b.tail=move(b.tail,interpolate(arm_keys[side],project(b.tail).y))
        if side=='右':
            b=rig.data.edit_bones[side+'肩叶']
            b.head=move(b.head,Vector((0,.0322)));b.tail=move(b.tail,Vector((0,.0322)))
    bpy.ops.object.mode_set(mode='OBJECT')

    # 整簇外移以保持叶片原有长宽；用真实短枝补足到原接点的连接。
    art.M['wood']=bpy.data.materials['树皮·主根暖棕']
    for stem in list(scene.objects):
        if stem.type!='MESH' or '臂侧覆叶簇' not in stem.name or not stem.name.endswith('叶轴'):continue
        prefix=stem.name[:-2];side=stem.name[0];sign=-1 if side=='左' else 1
        start=sum((v.co for v in list(stem.data.vertices)[:6]),Vector())/6
        offset=right*(sign*.058*scale)
        for ob in scene.objects:
            if ob.type!='MESH' or not ob.name.startswith(prefix):continue
            for v in ob.data.vertices:
                v.co+=offset
            changed.add(ob.name)
        bone=next(g.name for g in stem.vertex_groups if g.name in rig.data.bones)
        connector=art.root(prefix+'覆叶连接短枝',[start,start+offset*.5,start+offset],[.024,.019,.015],bone=bone,material=art.M['wood'],sides=6)
        changed.add(connector.name)
    # 钩齿根部重新嵌入修改后的刃面，保持真实连接。
    for ob in scene.objects:
        if ob.type!='MESH' or '深木钩齿' not in ob.name:continue
        blade=bpy.data.objects[ob.name[0]+'镰刃分层截面']
        blade.data.calc_loop_triangles()
        points=[v.co.copy() for v in blade.data.vertices]
        faces=[tuple(t.vertices) for t in blade.data.loop_triangles]
        tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
        for front,back in [(0,5),(3,8)]:
            loc,n,idx,_=tree.find_nearest(ob.data.vertices[front].co)
            mid=sum((points[k] for k in faces[idx]),Vector())/3
            loc=loc.lerp(mid,.06)
            ob.data.vertices[front].co=loc+n*.006
            ob.data.vertices[back].co=loc-n*.01

    untouched={n:h for n,h in original_meshes.items() if n not in changed}
    assert all(geometry(bpy.data.objects[n])==h for n,h in untouched.items()), '范围外网格改变'
    assert len(rig.data.bones)==23 and all((b.parent.name if b.parent else None)==original_bones[b.name][0] for b in rig.data.bones), '骨骼数量或层级改变'
    for b in rig.data.bones:
        if b.name not in ['左上臂','左前臂','左镰臂','右上臂','右前臂','右镰臂','右肩叶']:
            assert (tuple(b.head_local),tuple(b.tail_local))==original_bones[b.name][1:], '范围外骨骼改变'
    assert camera_lights=={o.name:(tuple(tuple(r) for r in o.matrix_world),o.data.type,getattr(o.data,'energy',None),getattr(o.data,'ortho_scale',None)) for o in scene.objects if o.type in ['CAMERA','LIGHT']}, '相机或灯光改变'
    scene.frame_set(1);scene.camera=cam
    scene['第四版返修说明']='双镰分别重排内外弧，恢复肩肘高低差，臂侧叶簇外移；身体与腿部网格保持第三版。'
    note=bpy.data.texts.new('第四版编辑说明')
    note.write('从当前第四版继续编辑；返修脚本只用于重做本轮操作。第三版已保留为保护基线。正式动画和游戏接入未包含。')
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    assert digest(BASE/'source/east-boss-art-editable.blend')==base_hash, '第三版源工程改变'
    report={'说明':'原画控制点为人工标注；这是工程返修记录，不代表最终美术验收。','基线摘要':base_hash,'工程摘要':digest(SOURCE),'修改物体':sorted(changed),'未修改网格摘要':untouched,'原画控制点':TARGETS,'弧线':curves,'相机归一化':{'中心':center,'顶部':top,'高度':height},'骨骼数':23,'原骨骼':original_bones}
    (OUT/'evidence/scythe-changes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('第四版源工程已保存；双镰、肩肘与覆叶已调整，等待真实渲染和变形检查。',flush=True)

if __name__=='__main__':main()
