"""精修交替藤刺：局部根束建模、逐部位曲线、连续换手及透明母版。"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import time
from pathlib import Path
import bpy
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/east-boss-vine-refinement'
spec = importlib.util.spec_from_file_location('base', ROOT / 'tools/animate-east-boss.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def half(sign):
    def p(arm, elbow, other, other_elbow, twist, lean, crouch, sway):
        own = [-arm, sign * (14 - arm * .11), -sign * (16 - arm * .1)]
        away = [-other, -sign * 9, sign * 7]
        return base.pose(left=own if sign == 1 else away, right=away if sign == 1 else own,
                         elbowL=elbow if sign == 1 else other_elbow,
                         elbowR=other_elbow if sign == 1 else elbow,
                         twist=sign*twist, lean=lean, crouch=crouch, sway=sign*sway, head=-sign*twist*.22)
    return [(0,p(42,-28,88,18,-12,7,.10,-.045)),
            (160,p(46,-37,76,2,-16,4,.125,-.075)),
            (324,p(54,-46,60,-17,-19,2,.16,-.10)),
            (490,p(61,-50,52,-24,-14,4,.145,-.07)),
            (595,p(77,-30,47,-27,3,9,.11,.015)),
            (642,p(99,-6,44,-30,19,13,.075,.07)),
            (674,p(110,9,43,-30,25,14,.06,.095)),
            (710,p(113,13,42,-31,28,16,.065,.105)),
            (794,p(104,9,45,-32,24,12,.08,.085)),
            (890,p(96,14,43,-30,18,9,.09,.06)),
            (1000,p(88,18,42,-28,12,7,.10,.045))]

HALVES = [half(1), half(-1)]
HALVES[0][0] = (0, HALVES[1][-1][1])
HALVES[1][0] = (0, HALVES[0][-1][1])

def interpolate(keys, t, cyclic=False, offset=0):
    # 分量单调三次曲线：连续穿过中间姿势，极值处收速；没有统一缓入缓出。
    expanded = keys
    if cyclic:
        other = HALVES[1-offset]
        expanded = [(a-1000,p) for a,p in other[:-1]] + keys + [(a+1000,p) for a,p in other[1:]]
    for i in range(len(expanded)-1):
        a,p = expanded[i]; b,q = expanded[i+1]
        if a <= t <= b:
            before = expanded[max(0,i-1)]; after = expanded[min(len(expanded)-1,i+2)]
            u=(t-a)/(b-a); h=b-a
            def value(x,y,z,w):
                slope=(y-x)/h
                prev=(x-z)/(a-before[0]) if a != before[0] else slope
                nxt=(w-y)/(after[0]-b) if after[0] != b else slope
                m0=2*prev*slope/(prev+slope) if prev*slope>0 else 0
                m1=2*nxt*slope/(nxt+slope) if nxt*slope>0 else 0
                return (2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*h*m0+(-2*u**3+3*u*u)*y+(u**3-u*u)*h*m1
            return {k:[value(v,q[k][n],before[1][k][n],after[1][k][n]) for n,v in enumerate(p[k])] if isinstance(p[k],list)
                    else value(p[k],q[k],before[1][k],after[1][k]) for k in p}
    return keys[0][1] if t<0 else keys[-1][1]

def cycle(t):
    u=t%2000; side=int(u>=1000)
    return interpolate(HALVES[side],u-side*1000,True,side)

def pose_at(name,t):
    if name in ['vine-left','vine-right']:
        at=t+(1000 if name=='vine-right' else 0)
        p=cycle(at); hip=cycle(at+34); waist=cycle(at+17); arms=cycle(at-12); elbow=cycle(at-20); head=cycle(at-28)
        p.update(left=arms['left'],right=arms['right'],elbowL=elbow['elbowL'],elbowR=elbow['elbowR'],head=head['head'])
        return p,hip,waist,cycle(at-105)
    if name=='vine-enter':
        end=pose_at('vine-left',324)[0]
        keys=[(0,base.IDLE),(300,base.pose(crouch=.10,lean=4,left=[-30,10,-8],right=[-35,-10,8],elbowL=-18,elbowR=-14)),
              (760,base.pose(crouch=.14,twist=-10,sway=-.07,lean=4,left=[-43,12,-10],right=[-66,-9,7],elbowL=-35,elbowR=-4))]
        return tuple(interpolate(keys+[(1200,p)],t) for p in pose_at('vine-left',324))
    else:
        start=pose_at('vine-right',794)[0]
        keys=[(190,pose_at('vine-right',950)[0]),(480,base.pose(crouch=.08,twist=-5,lean=6,left=[-45,8,-7],right=[-55,-8,7],elbowL=-12,elbowR=3)),(900,base.IDLE)]
        return tuple(interpolate([(0,p)]+keys,t) for p in pose_at('vine-right',794))

def tube(name, centers, radii, material, collection, sides=8):
    verts=[]; faces=[]
    for i,c in enumerate(centers):
        tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
        x=tangent.cross(Vector((0,1,0)))
        if x.length<.01:x=tangent.cross(Vector((0,0,1)))
        x.normalize();y=tangent.cross(x).normalized()
        for j in range(sides):
            angle=math.tau*j/sides; ridges=1.10 if j%3==0 else .93
            verts.append(c+(x*math.cos(angle)+y*math.sin(angle))*radii[i]*ridges)
    for i in range(len(centers)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+j for j in range(sides))]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();uv=mesh.uv_layers.new(name='交付颜色坐标')
    quadrant=(.5,.5) if '生长亮棱' in material.name else (0,0) if '背阴' in material.name else (0,.5)
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            n=mesh.loops[li].vertex_index;uv.data[li].uv=(quadrant[0]+.025+.45*(n%sides/sides),quadrant[1]+.025+.45*(n//sides/(len(centers)-1)))
    # 原角色同时保留原画坐标与烘焙坐标；新网格明确使用已有四千像素手绘图。
    painted=next((n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.name=='交付颜色图集'),None)
    if painted:
        key='藤刺精修·'+material.name;m=bpy.data.materials.get(key)
        if not m:
            m=bpy.data.materials.new(key);m.use_nodes=True;n=m.node_tree.nodes;n.clear();tex=n.new('ShaderNodeTexImage');tex.image=painted;tex.interpolation='Linear';shader=n.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.90;shader.inputs['Specular IOR Level'].default_value=.12;output=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color']);m.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
        material=m
    ob=bpy.data.objects.new(name,mesh);collection.objects.link(ob);mesh.materials.append(material)
    for p in mesh.polygons:p.use_smooth=True
    return ob

def model_outlets(r,collection):
    wood=bpy.data.materials['树皮·主根暖棕·树身与根系'];light=bpy.data.materials['树皮·生长亮棱·树身与根系'];dark=bpy.data.materials['树皮·背阴深棕·树身与根系']
    objects=[];sockets={}
    for side in ['左','右']:
        bone=r.data.bones[side+'前臂'];axis=(bone.tail_local-bone.head_local).normalized();x=axis.cross(Vector((0,1,0))).normalized();y=axis.cross(x).normalized()
        end=bone.tail_local+axis*.06+Vector((0,-.10,0));sockets[side]=list(end+axis*.22)
        # 三条主根分叉包住出口，留出深槽；四条背根把根束嵌进前臂树皮。
        for n,(angle,width,reach) in enumerate([(0,.065,.30),(2.2,.056,.24),(4.3,.048,.26),(1.1,.039,.12),(3.3,.042,.14),(5.4,.035,.10)]):
            centers=[];radii=[]
            for i in range(19):
                u=i/18;a=angle+u*1.3;radial=.15*(1-u)+.075*u
                c=end+axis*(-.42+u*(.42+reach))+(x*math.cos(a)+y*math.sin(a))*radial
                centers.append(c);radii.append(width*(1-u*.5)*max(.06,min(1,(1-u)*9)))
            ob=tube(side+'臂·交织根出口'+str(n+1),centers,radii,[wood,light,dark][n%3],collection)
            group=ob.vertex_groups.new(name=bone.name);group.add(list(range(len(ob.data.vertices))),1,'REPLACE');mod=ob.modifiers.new('随前臂弯曲','ARMATURE');mod.object=r;ob.parent=r;objects.append(ob)
        ob=tube(side+'臂·出口深腔',[end-axis*.05,end+axis*.08],[.075,.045],bpy.data.materials['深腔·眼窝与胸腔'],collection)
        group=ob.vertex_groups.new(name=bone.name);group.add(list(range(len(ob.data.vertices))),1,'REPLACE');ob.modifiers.new('随前臂弯曲','ARMATURE').object=r;ob.parent=r;objects.append(ob)
    return objects,sockets

def build():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'docs/east-boss-tier-five/source/east-boss-tier-five-editable.blend'))
    s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];targets={side:bpy.data.objects[side+'脚落地控制'] for side in ['左','右']}
    collection=bpy.data.collections.new('藤刺精修·可编辑局部');s.collection.children.link(collection);objects,sockets=model_outlets(r,collection)
    definitions={name:dict(duration=duration,label=label,loop=False,markers={'lock':324,'contact':674,'active':794,'end':1000} if duration==1000 else {}) for name,duration,label in [('vine-enter',1200,'聚藤与左臂蓄力'),('vine-left',1000,'左刺借势进入右刺'),('vine-right',1000,'右刺借势进入左刺'),('vine-exit',900,'末刺回收与重整')]}
    cursor=s.frame_end+60;start=cursor
    for ob in objects:
        ob.hide_render=True;ob.keyframe_insert('hide_render',frame=1)
        ob.hide_render=False;ob.keyframe_insert('hide_render',frame=start)
    for name,c in definitions.items():
        count=round(c['duration']*.06);c.update(start=cursor,end=cursor+count);s.timeline_markers.new('精修·'+c['label'],frame=cursor)
        for i in range(count+1):
            t=min(c['duration'],i*1000/60);p,hip,waist,lag=pose_at(name,t);base.apply(r,targets,p,t,lag)
            def rotate(bone,angles):
                b=r.pose.bones[bone];rest=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=rest.inverted()@Euler(tuple(math.radians(v) for v in angles),'XYZ').to_quaternion()@rest
            rotate('骨盆',(0,0,hip['twist']*.18));rotate('腰',(waist['lean']*.45,0,waist['twist']*.36))
            r.pose.bones['骨盆'].location=r.data.bones['骨盆'].matrix_local.to_3x3().inverted()@Vector((hip['sway'],0,-hip['crouch']))
            phase=t+(1000 if name=='vine-right' else 0) if name in ['vine-left','vine-right'] else t*324/1200 if name=='vine-enter' else 1794+t
            for side,delay in [('左',.12),('右',.20)]:
                wave=math.sin((phase/2000-delay)*math.tau)
                rotate(side+'肩叶',(wave*1.8-lag['lean']*.35,0,-p['twist']*.12+(lag['twist']-p['twist'])*.25))
                rotate(side+'腰叶',(math.sin((phase/2000-.24)*math.tau)*1.4,0,-p['twist']*.08+(lag['twist']-p['twist'])*.13))
                rotate(side+'冠枝',(wave*.8,0,-p['twist']*.06+(lag['twist']-p['twist'])*.10))
            for b in r.pose.bones:b.keyframe_insert('rotation_quaternion',frame=cursor+i);b.keyframe_insert('location',frame=cursor+i)
            for ob in targets.values():ob.keyframe_insert('location',frame=cursor+i)
        cursor+=count+2
    s.frame_end=cursor-2;s.frame_set(start);s.render.fps=60
    for ob in [r,*targets.values()]:
        for layer in ob.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for k in curve.keyframe_points:
                            if k.co.x>=start:k.interpolation='LINEAR'
    note=bpy.data.texts.new('藤刺精修说明');note.write('保留已认可主体。局部新增交织根束与出口深腔；双脚原地支撑，胯、腰、胸、肩、肘独立曲线。左右动作边界连续，进入末帧衔接左刺锁向姿势，退出承接末次右刺有效期末姿势。战斗时序及伤害不改。长藤材质由同一工程的可编辑根束模型渲染，运行时延展。')
    path=OUT/'source/east-boss-vine-refined.blend';path.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(path))
    write(OUT/'source/clips.json',{'说明':'旧动作保留，精修片段追加在时间线末尾。','clips':definitions,'outlets':sockets})

def render(args):
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/east-boss-vine-refined.blend'));s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];orient=bpy.data.objects['八方向旋转根'];metadata=json.loads((OUT/'source/clips.json').read_text())
    source_hash=hashlib.sha256((OUT/'source/east-boss-vine-refined.blend').read_bytes()).hexdigest()
    old=OUT/'source'/('frames-'+args.directions.replace(',','-')+'.json')
    if old.exists() and not args.probe and not args.force:assert json.loads(old.read_text())['sourceHash']==source_hash,'源工程已变化，请使用 --force 重新渲染，禁止复用旧母版'
    s.render.resolution_x=s.render.resolution_y=1664;s.eevee.taa_render_samples=16;s.render.film_transparent=True;records=[];started=time.time()
    def project(v):
        q=world_to_camera_view(s,s.camera,v);return [q.x*1664,(1-q.y)*1664]
    for name,c in metadata['clips'].items():
        times=sorted(set(list(range(0,c['duration'],33))+([*range(585,830,16),324,674,794] if c['duration']==1000 else [])+[c['duration']]))
        if args.probe:times=[324,674,794,1000] if c['duration']==1000 else [0,c['duration']]
        for d in map(int,args.directions.split(',')):
            orient.rotation_euler.z=d*math.pi/4
            for i,t in enumerate(times):
                f=c['start']+t*.06;s.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update();path=OUT/('probe' if args.probe else 'master')/name/str(d)/f'{i:04d}.png';path.parent.mkdir(parents=True,exist_ok=True)
                if args.probe or args.force or not path.exists():s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
                sockets={}
                for label,bone in [('left','左镰臂'),('right','右镰臂'),('core','胸'),('footL','左脚'),('footR','右脚'),('vineL','左前臂'),('vineR','右前臂')]:
                    b=r.pose.bones[bone]
                    v=b.matrix@r.data.bones[bone].matrix_local.inverted()@Vector(metadata['outlets']['左' if label=='vineL' else '右']) if label.startswith('vine') else b.head.lerp(b.tail,.45) if label=='core' else b.head
                    sockets[label]=project(r.matrix_world@v)
                records.append(dict(clip=name,direction=d,time=t,file=str(path.relative_to(OUT)),root=project(orient.matrix_world@Vector((0,0,0))),sockets=sockets))
            print('已完成精修方向',name,d,'累计帧',len(records),flush=True)
    write(OUT/'source'/('probe-frames.json' if args.probe else 'frames-'+args.directions.replace(',','-')+'.json'),{'说明':'精修工程直接渲染；主体沿用固定比例。','sourceHash':hashlib.sha256((OUT/'source/east-boss-vine-refined.blend').read_bytes()).hexdigest(),'seconds':time.time()-started,'frames':records})

def assets():
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/east-boss-vine-refined.blend'));s=bpy.context.scene
    collection=bpy.data.collections.new('长藤·延展材质源');s.collection.children.link(collection)
    wood=bpy.data.materials['树皮·主根暖棕·树身与根系'];light=bpy.data.materials['树皮·生长亮棱·树身与根系'];dark=bpy.data.materials['树皮·背阴深棕·树身与根系'];ivory=bpy.data.materials['骨木·象牙主面·面具与双镰']
    # 根束按四分之三环交织，段首尾的截面与相位一致，运行时连接后没有接缝。
    pieces={}
    for name,length in [('base',1.25),('shaft',2.5),('tip',1.25)]:
        items=[]
        for n in range(3):
            centers=[];radii=[]
            for i in range(65):
                u=i/64;a=n*math.tau/3+u*math.tau
                taper=(1-u)**.55 if name=='tip' else 1+.16*math.sin(u*math.pi) if name=='base' else 1
                radius=(.045 if n==0 else .033)*taper
                centers.append(Vector((u*length-length/2,math.cos(a)*.07*taper,math.sin(a)*.07*taper)));radii.append(max(.001,radius))
            items.append(tube('长藤·'+name+'·主根'+str(n+1),centers,radii,[wood,light,dark][n],collection))
        if name=='tip':
            items.append(tube('长藤·骨木刺尖',[Vector((.08,0,0)),Vector((.28,0,.016)),Vector((.48,0,0)),Vector((.66,0,0))],[.072,.06,.033,.001],ivory,collection))
        # 不规则侧刺有明确起根方向，避免均匀噪声掩盖轮廓。
        for i,(x,side) in enumerate([(-.3,1),(.18,-1)] if name!='tip' else [(-.3,-1)]):
            items.append(tube('长藤·'+name+'·侧刺'+str(i+1),[Vector((x,0,side*.055)),Vector((x+.07,0,side*.12)),Vector((x+.14,0,side*.16))],[.039,.025,.001],dark,collection))
        pieces[name]=items
    # 在交付工程内保留源模型，日常动作渲染时隐藏。
    for group in pieces.values():
        for ob in group:ob.hide_render=True;ob.hide_viewport=True
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/east-boss-vine-refined.blend'))
    for ob in s.objects:
        if ob.type in ['MESH','ARMATURE']:ob.hide_render=True
    s.camera.parent=None;s.camera.location=(0,-6,2.4);s.camera.rotation_euler=(Vector((0,0,0))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.type='ORTHO'
    s.render.film_transparent=True;s.render.resolution_y=256;s.render.resolution_percentage=100;s.eevee.taa_render_samples=32
    for name,width,length in [('base',256,1.45),('shaft',512,2.9),('tip',256,1.45)]:
        s.render.resolution_x=width;s.camera.data.ortho_scale=length
        for ob in pieces[name]:ob.hide_render=False;ob.hide_viewport=False
        path=OUT/'source'/('vine-'+name+'.png');s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        for ob in pieces[name]:ob.hide_render=True
    print('已输出交织根束、延展段及骨木刺尖。',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description='藤刺局部造型与连续动作精修');p.add_argument('mode',choices=['build','render','assets']);p.add_argument('--directions',default='0,1,2,3,4,5,6,7');p.add_argument('--probe',action='store_true');p.add_argument('--force',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);{'build':build,'render':lambda:render(a),'assets':assets}[a.mode]()
