"""从受保护的第二版继续定向返修；只写第三版，不重建骨架、灯光或相机。"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import random
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/east-boss-art-v3'
BASELINE = ROOT / 'docs/east-boss-art-v2/source/east-boss-art-editable.blend'
SOURCE = OUT / 'source/east-boss-art-editable.blend'
os.environ['EAST_BOSS_ART_OUT'] = str(OUT)
spec = importlib.util.spec_from_file_location('refinement', ROOT / 'tools/build-east-boss-art-v2.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

OLD = [(0,0),(.20,.20),(.90,1.18),(1.50,1.72),(2.30,2.55),(2.90,3.23),(3.05,3.40),(3.70,3.94),(4.36,4.36),(5,5)]
NEW = [(0,0),(.10,.10),(.20,.40),(.90,1.34),(1.50,1.90),(2.30,2.73),(2.90,3.43),(3.05,3.60),(3.70,4.07),(4.36,4.36),(5,5)]

def mapping(z, levels):
    for (a,b),(c,d) in zip(levels, levels[1:]):
        if a <= z <= c:
            return b+(d-b)*(z-a)/(c-a)
    return z

def h(z):
    return mapping(z, NEW)

def warp(p):
    q=p.copy(); q.z=h(mapping(p.z, [(b,a) for a,b in OLD])); return q

def point(x,y,z):
    return Vector((x,y,h(z)))

def report(name, data):
    (OUT/'evidence'/name).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')

def root(name, points, widths, **kwargs):
    return art.root(name, [point(*p) for p in points], widths, **kwargs)

def remove_matching(parts):
    selected=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(p in o.name for p in parts)]
    for ob in selected:
        bpy.data.objects.remove(ob, do_unlink=True)
    return len(selected)

def leaf(name, start, end, width, bone, seed, face=-1, color=0):
    a,b=point(*start),point(*end);direction=(b-a).normalized()
    front=Vector((0,face,.22)).normalized();across=direction.cross(front).normalized()
    normal=across.cross(direction).normalized()
    if normal.dot(front)<0:normal=-normal
    vertices=[];uv=[];faces=[];rows=14
    # 折面与卷曲按叶宽缩放，避免短叶沿用大叶的固定折幅而塌成细条。
    for row in range(rows+1):
        t=row/rows;wave=math.sin(math.pi*t)
        center=a.lerp(b,t)+normal*(width*.14*wave)+across*(width*.10*math.sin(seed)*wave)
        radius=width*max(.001,wave)**(.72+.08*(seed%3))*(1-.28*t)
        for col in range(5):
            u=(col-2)/2;notch=.76 if (row+seed+(col==4))%4==0 and col in [0,4] else 1
            vertices.append(center+across*(radius*u*notch)+normal*(width*.13*wave*(1-abs(u))))
            uv.append(((seed%2)*.5+.025+(u+1)*.224,1-((seed//2)%2)*.5-.475+t*.45))
            if row and col:
                q=(row-1)*5+col-1;faces.append((q,q+1,q+6,q+5))
    ob=art.mesh(name,vertices,faces,art.M['leaf'+str(color)],uv,bone,False)
    mod=ob.modifiers.new('薄叶实体厚度','SOLIDIFY');mod.thickness=.003
    with bpy.context.temp_override(object=ob,active_object=ob):bpy.ops.object.modifier_move_up(modifier=mod.name)
    ob['结构类型']='实体叶片';ob['叶形']=seed%6
    return ob

def main():
    parser=argparse.ArgumentParser(description='从第二版保护快照制作第三版静态返修')
    parser.add_argument('--replace',action='store_true',help='明确允许重做本脚本生成的第三版；先保存上一轮快照')
    parser.add_argument('--render',default='front')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for directory in ['source','evidence','evidence/baseline','evidence/stage-structure']:
        (OUT/directory).mkdir(parents=True,exist_ok=True)
    if SOURCE.exists():
        if not args.replace:
            raise RuntimeError('第三版已经存在；禁止隐式覆盖。继续编辑应加载当前工程。')
        digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()[:12]
        shutil.copy2(SOURCE,OUT/f'source/east-boss-art-stage-{digest}.blend')
    baseline_hash=hashlib.sha256(BASELINE.read_bytes()).hexdigest()
    snapshot=OUT/'source/east-boss-art-baseline.blend'
    if not snapshot.exists():
        shutil.copy2(BASELINE,snapshot)
    assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==baseline_hash,'第二版基线改变，必须先重新核对'
    bpy.ops.wm.open_mainfile(filepath=str(snapshot))
    scene=bpy.context.scene; scene.frame_set(1)
    rig=bpy.data.objects['缚枝祭主·可编辑骨架']; art.art.RIG=rig
    names={'wood':'树皮·主根暖棕','ridge':'树皮·生长亮棱','darkwood':'树皮·背阴深棕','gold':'树皮·风核金根','ivory':'骨木·象牙主面','edge':'骨木·薄刃亮面','ivoryshade':'骨木·侧壁暖灰','dark':'深腔·眼窝与胸腔','core':'风核·翠绿旋流'}
    names.update({'leaf'+str(i):'叶片·色系'+str(i+1) for i in range(4)})
    art.M.update({key:bpy.data.materials[value] for key,value in names.items()})
    cameras={o.name:[list(r) for r in o.matrix_world] for o in scene.objects if o.type=='CAMERA'}
    before={b.name:{'头':list(b.head_local),'尾':list(b.tail_local),'父级':b.parent.name if b.parent else None} for b in rig.data.bones}
    for ob in scene.objects:
        if ob.type!='MESH':continue
        inv=ob.matrix_world.inverted()
        for v in ob.data.vertices:v.co=inv@warp(ob.matrix_world@v.co)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for b in rig.data.edit_bones:b.head=warp(b.head);b.tail=warp(b.tail)
    bpy.ops.object.mode_set(mode='OBJECT')
    after={b.name:{'头':list(b.head_local),'尾':list(b.tail_local),'父级':b.parent.name if b.parent else None} for b in rig.data.bones}
    assert len(after)==23 and all(before[n]['父级']==after[n]['父级'] for n in before)
    report('rest-pose-changes.json',{'说明':'相同连续高度映射作用于网格与骨骼；骨名和父级不变，正式动画未迁移。','修改前':before,'修改后':after,'目标高度映射':NEW})

    # 同一空间映射收拢整组树冠，父枝与子枝不分别移动。
    crown_count=0
    for ob in scene.objects:
        if ob.type!='MESH':continue
        if ob.name.startswith(('树冠承重主枝','冠枝次级分叉','冠枝三级短梢','冠枝末端不规则短梢')):
            for v in ob.data.vertices:
                v.co.x*=.80
            crown_count+=1
        if any(s in ob.name for s in ['面具开孔骨壳','眼窝凹腔','颊侧叠压骨片','面具中央生长脊']):
            for v in ob.data.vertices:v.co.x*=.90
        if '腿部扭转主根' in ob.name:
            vertices=list(ob.data.vertices);index=int(ob.name[-1]);side=-1 if ob.name.startswith('左') else 1
            for i in range(len(vertices)//12):
                ring=vertices[i*12:(i+1)*12];center=sum((v.co for v in ring),Vector())/12
                t=i/(len(vertices)//12-1);delta=Vector((side*.055*math.sin(math.pi*t)*(-1 if index==0 else 1),-.035*math.sin(math.tau*t+index),0))
                for v in ring:v.co=center+delta+(v.co-center)*(.78 if index<2 else .90)
        if '镰刃分层截面' in ob.name:
            for poly in ob.data.polygons:
                if poly.material_index==2:poly.material_index=1
            # 拓扑截面中的骨色区域扩大，整体外缘与尖端保持连续。
            verts=ob.data.vertices
            for i in range(len(verts)//10):
                for back in [0,5]:
                    a=verts[i*10+back].co.copy();b=verts[i*10+back+4].co.copy()
                    for k,u in [(1,.16),(2,.61),(3,.82)]:
                        v=verts[i*10+back+k];v.co.x=a.x+(b.x-a.x)*u
        if '深木钩齿' in ob.name:
            # 保留端部嵌合，只缩短突出的齿尖，不平移整个接头。
            vs=ob.data.vertices;a=vs[0].co.copy();b=vs[3].co.copy()
            for i in [1,2,6,7]:vs[i].co.x=vs[i].co.x*.70+(a.x+b.x)*.15
    scene['眼腔检测横坐标']=[-.116*.90,.116*.90]
    scene['眼腔检测高度']=h(3.535)

    removed=remove_matching(['肩部叶簇','肩侧翻叶','腰部散叶','臂外披叶','腰部斜向包覆主根','腹部向上缠绕细根'])
    # 胸腹主根不再使用等粗的交叉束：收细前层，在两侧保留承重体积。
    for ob in scene.objects:
        if not ob.name.startswith('躯干承重主根'):continue
        vs=ob.data.vertices;index=int(ob.name[-1]);rings=len(vs)//12
        for row in range(rings):
            ring=list(vs[row*12:(row+1)*12]);c=sum((v.co for v in ring),Vector())/12
            t=row/(rings-1);factor=.70+.22*abs(2*t-1) if index<2 else .92
            for v in ring:v.co=c+(v.co-c)*factor
    root('腹部向上缠绕细根',[(.28,-.03,1.42),(.17,-.23,1.64),(-.18,-.24,1.97),(-.23,-.10,2.24)], [.025,.051,.047,.009],weights=lambda t:art.base.blend_weights('腰','胸',t,.55),material=art.M['ridge'],twist=1.2)
    root('腰部斜向包覆主根',[(-.32,.01,1.93),(-.35,-.16,1.83),(-.04,-.29,1.62),(.31,-.06,1.26)], [.008,.058,.041,.007],weights=lambda t:art.base.blend_weights('胸','腰',t,.35),material=art.M['wood'],twist=-.7)
    for s,side in [(-1,'左'),(1,'右')]:
        root(side+'腿部回绕次根',[(s*.35,-.02,1.51),(s*.54,-.13,1.23),(s*.34,-.16,.87),(s*.43,-.10,.56),(s*.61,.01,.26)],[.016,.049,.042,.038,.012],weights=lambda t,side=side:art.base.blend_weights(side+'大腿',side+'小腿',t,.53),material=art.M['ridge'],depth=.65,twist=1.4)
    # 新的叶簇由显式枝轴控制，短叶沿枝轴交替生长，疏密来自组织而非随机散布。
    rng=random.Random(361)
    shoulder=[(.16,3.46,.68,3.43),(.25,3.33,.94,3.07),(.39,3.16,1.09,2.73),(.41,3.02,.99,2.41),(.28,2.88,.58,2.14),(.20,3.20,.47,2.69)]
    leaf_count=0
    def frond(label,s,side,start,end,bone,count,face,width=.065,palette=0):
        nonlocal leaf_count
        a=Vector(start);b=Vector(end)
        stem=root(label+'叶轴',[a,a.lerp(b,.5),b],[.025,.014,.002],bone=bone,depth=.65,sides=6,material=art.M['darkwood'])
        centers=[sum((v.co for v in list(stem.data.vertices)[i:i+6]),Vector())/6 for i in range(0,len(stem.data.vertices),6)]
        for j in range(count):
            t=.08+.82*j/max(1,count-1)
            actual=centers[round(t*(len(centers)-1))]
            c=Vector((actual.x,actual.y,mapping(actual.z,[(b,a) for a,b in NEW])))
            side_offset=(-1 if j%2 else 1)*(.07+.025*(j%3))
            length=.17+.065*((j+palette)%3)
            tip=c+Vector((s*(.18+side_offset+.055*math.sin(palette*2+j*1.7)),face*(.04+.015*(j%2)),-length))
            tip.z+=.10 if b.z>a.z else 0
            palette_choices=[0,2,1,0,2,1,0,3,2,0,1]
            ob=leaf(label+'叶片',c,tip,width*(.72+.12*((j+palette)%4)),bone,j+palette,face,color=palette_choices[(j+palette*3)%len(palette_choices)])
            ob['所属叶轴']=stem.name
            leaf_count+=1
        leaf(label+'末叶',b-Vector((s*.06,0,-.03)),b+Vector((s*.09,face*.035,-.21)),width*.72,bone,count+palette,face,color=palette%3)
        leaf_count+=1
    for s,side in [(-1,'左'),(1,'右')]:
        for face in [-1,1]:
            for i,(x,z,ex,ez) in enumerate(shoulder):
                dz=(.035 if s>0 and i%2 else -.015)
                frond(side+'肩部垂生簇'+str(face)+'-'+str(i),s,side,(s*x,face*.24,z+dz),(s*ex,face*(.29+.015*i),ez+dz),side+'肩叶',7 if face<0 else 5,face,.091,i+(s>0))
            for i in range(4):
                frond(side+'腰侧垂生簇'+str(face)+'-'+str(i),s,side,(s*(.20+i*.055),face*.18,2.02-i*.11),(s*(.50+i*.09),face*.25,1.53-i*.15),side+'腰叶',5,face,.077,i+1)
            for i in range(3):
                x=1.02+i*.18;z=2.17-i*.30
                frond(side+'臂侧覆叶簇'+str(face)+'-'+str(i),s,side,(s*x,face*.09,z),(s*(x+.18),face*.14,z-.32),side+'前臂' if i==0 else side+'镰臂',4,face,.052,i+2)
        for i in range(3):
            leaf(side+'膝侧零散叶',(s*(.44+.015*i),-.11,1.05-i*.17),(s*(.55+.04*i),-.19,.80-i*.18),.045,side+'小腿',i+2,color=i%3)
            leaf_count+=1

    # 根足在接地平面增加曲折；父根与分叉使用同一空间映射，连接不拆开。
    for ob in scene.objects:
        if not any(s in ob.name for s in ['落地主根','落地二级分叉','踝根连续']):continue
        side=-1 if ob.name.startswith('左') else 1
        for v in ob.data.vertices:
            p=v.co;ramp=max(0,min(1,(.34-p.z)/.26))
            p.x+=side*ramp*(.045*math.sin(p.y*10)+.025*math.sin(p.x*13))
            p.y+=ramp*.075*math.sin(p.x*11+p.y*5)
    extra_connections=[]
    for s,side in [(-1,'左'),(1,'右')]:
        for j,parent_index in enumerate([0,1,2]):
            parent=bpy.data.objects[side+'落地主根'+str(parent_index)]
            ring=int((len(parent.data.vertices)//12-1)*(.55+.07*j))
            start=sum((v.co for v in list(parent.data.vertices)[ring*12:(ring+1)*12]),Vector())/12
            end=start+Vector((s*[-.16,.20,.14][j],[-.22,-.17,.17][j],0));end.z=.036
            mid=start.lerp(end,.55)+Vector((s*.06,-.025,0));mid.z=max(.055,mid.z)
            ob=art.root(side+'落地细分根'+str(j),[start,mid,end],[.025,.029,.002],bone=side+'脚',depth=.48,material=art.M['wood'],twist=1.1)
            extra_connections.append({'子枝':ob.name,'父枝':parent.name})
    report('extra-connections.json',{'说明':'新增根足分叉的明确连接关系，源工程与交付工程均须检查。','连接':extra_connections})
    # 风核缩回原画的胸腔占比；保留上下连接，收拢中部包覆框。
    for ob in scene.objects:
        if ob.name.startswith(('嵌入式风核','胸腔暗底')):
            inverse=ob.matrix_world.inverted()
            for v in ob.data.vertices:
                p=ob.matrix_world@v.co;p.x*=.83;p.z=h(2.53)+(p.z-h(2.53))*.83;v.co=inverse@p
        if ob.name.startswith(('风核金根框','金根内侧生长芽')):
            for v in ob.data.vertices:
                p=v.co;ramp=max(0,1-abs(p.z-h(2.53))/.66)
                p.x*=.82;p.z=h(2.53)+(p.z-h(2.53))*(1-.17*ramp)
    # 风核金根保持连通，但粗细和走向不再像匀称饰框。
    for ob in scene.objects:
        if not ob.name.startswith('风核金根框'):continue
        vs=ob.data.vertices;rings=len(vs)//12
        for row in range(rings):
            ring=list(vs[row*12:(row+1)*12]);c=sum((v.co for v in ring),Vector())/12;t=row/(rings-1)
            factor=.85+.20*math.sin(t*math.pi*3)
            for v in ring:v.co=c+(v.co-c)*factor
    # 提高颜色纹理贡献，叶色按簇成组；灯光保持基线不变。
    for key,amount in [('wood',.63),('ridge',.46),('darkwood',.36),('gold',.42),('ivory',.38),('edge',.25),('leaf0',.48),('leaf1',.48),('leaf2',.43),('leaf3',.42)]:
        for node in art.M[key].node_tree.nodes:
            if node.type=='MIX_RGB':node.inputs[0].default_value=amount
    # 肘部单独降低，不牵动胸核高度；整条手臂及其叶片按现有权重连续修正。
    def arm_delta(p,side):
        return (.15 if side=='左' else .22)*max(0,1-abs(p.z-2.67)/.70)
    for ob in scene.objects:
        if ob.type!='MESH':continue
        groups={g.index:g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            for side in ['左','右']:
                influence=sum(g.weight for g in v.groups if groups[g.group] in [side+'上臂',side+'前臂',side+'镰臂'])
                if influence:
                    v.co.z-=arm_delta(v.co,side)*influence
                    if any(groups[g.group]==side+'镰臂' and g.weight>.9 for g in v.groups):
                        v.co.x+=(.43 if side=='左' else .14)*max(0,min(1,(1.50-v.co.z)/.93))**1.7
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for side in ['左','右']:
        for name in [side+'上臂',side+'前臂',side+'镰臂']:
            bone=rig.data.edit_bones[name]
            bone.head.z-=arm_delta(bone.head,side);bone.tail.z-=arm_delta(bone.tail,side)
    bpy.ops.object.mode_set(mode='OBJECT')
    after={b.name:{'头':list(b.head_local),'尾':list(b.tail_local),'父级':b.parent.name if b.parent else None} for b in rig.data.bones}
    report('rest-pose-changes.json',{'说明':'全身高度映射与肘部局部修正；骨名和父级不变，正式动画未迁移。','修改前':before,'修改后':after,'目标高度映射':NEW})
    # 比例与刃面改变后，重新把钩齿端部嵌入真实表面。
    for ob in scene.objects:
        if '深木钩齿' not in ob.name:continue
        blade=bpy.data.objects[ob.name[0]+'镰刃分层截面'];blade.data.calc_loop_triangles()
        vs=[v.co.copy() for v in blade.data.vertices];fs=[tuple(t.vertices) for t in blade.data.loop_triangles];tree=BVHTree.FromPolygons(vs,fs,all_triangles=True)
        for front,back in [(0,5),(3,8)]:
            loc,n,idx,_=tree.find_nearest(ob.data.vertices[front].co);mid=sum((vs[k] for k in fs[idx]),Vector())/3
            loc=loc.lerp(mid,.06);ob.data.vertices[front].co=loc+n*.006;ob.data.vertices[back].co=loc-n*.01
    assert cameras=={o.name:[list(r) for r in o.matrix_world] for o in scene.objects if o.type=='CAMERA'},'主相机意外改变'
    assert hashlib.sha256(BASELINE.read_bytes()).hexdigest()==baseline_hash,'第二版源工程意外改变'
    scene.frame_set(1);scene.camera=bpy.data.objects['游戏视角']
    scene['第三版返修说明']='整体比例、定向复叶簇、根系层级、收拢枝冠、骨色镰刃和材质返修；相机与灯光保持基线。正式动作及游戏接入未包含。'
    scene['第二版基线摘要']=baseline_hash
    note=bpy.data.texts.new('第三版编辑说明');note.write('从当前工程继续编辑；本轮生成脚本只用于复现首次返修，不应覆盖后续人工修改。叶轴与叶片独立可编辑；正式动作未迁移。')
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    report('structure-changes.json',{'说明':'实施记录不是美术通过证明。','基线摘要':baseline_hash,'新工程摘要':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'调整冠枝':crown_count,'移除旧部件':removed,'定向新叶片':leaf_count,'主相机':'保持不变','灯光':'保持不变','骨架':'骨名和层级不变，静止高度已同步调整'})
    if args.render!='none':art.render(args.render,50)

if __name__=='__main__':main()
