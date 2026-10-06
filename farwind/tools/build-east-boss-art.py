"""制作缚枝祭主静态美术候选；所有展示均由交付工程直接渲染。"""
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/east-boss-art'
TEX = OUT / 'source/textures'
spec = importlib.util.spec_from_file_location('sample', ROOT / 'tools/build-east-boss-sample.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
PARTS = []
RIG = None


def texture_material(name, path, tint=None, emission=.10, roughness=.92, gain=.86):
    mat = base.material(name, (.3, .2, .1), roughness)
    n, l = mat.node_tree.nodes, mat.node_tree.links
    p = n.get('Principled BSDF')
    p.inputs['Specular IOR Level'].default_value = .12
    tex = n.new('ShaderNodeTexImage')
    tex.name = '手绘颜色源图'
    tex.image = bpy.data.images.load(str(path), check_existing=True)
    uv = n.new('ShaderNodeUVMap'); uv.uv_map = '手绘源坐标'
    l.new(uv.outputs['UV'], tex.inputs['Vector'])
    color = tex.outputs['Color']
    if tint:
        bw = n.new('ShaderNodeRGBToBW'); l.new(color, bw.inputs[0])
        ramp = n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .04
        ramp.color_ramp.elements[0].color = (*tint[0], 1)
        ramp.color_ramp.elements[1].position = .30
        ramp.color_ramp.elements[1].color = (*tint[1], 1)
        l.new(bw.outputs[0], ramp.inputs[0]); color = ramp.outputs[0]
    multiply=n.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
    multiply.inputs[2].default_value=(gain,gain,gain,1);l.new(color,multiply.inputs[1]);color=multiply.outputs[0]
    l.new(color, p.inputs['Base Color'])
    l.new(color, p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value = emission
    return mat


def mesh(name, vertices, faces, material, uvs, weights, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    uv = data.uv_layers.new(name='手绘源坐标')
    for poly in data.polygons:
        poly.use_smooth = smooth
        for li in poly.loop_indices:
            uv.data[li].uv = uvs[data.loops[li].vertex_index]
    groups = {}
    for i in range(len(vertices)):
        ws = weights(i) if callable(weights) else {weights: 1}
        for bone, weight in ws.items():
            if weight <= 0: continue
            if bone not in groups: groups[bone] = ob.vertex_groups.new(name=bone)
            groups[bone].add([i], weight, 'REPLACE')
    mod = ob.modifiers.new('骨骼变形', 'ARMATURE'); mod.object = RIG
    ob.parent = RIG; ob.matrix_parent_inverse = Matrix.Identity(4)
    PARTS.append(ob)
    return ob


def root(name, points, widths, bone='胸', depth=.76, twist=.25, offset=0, material=None, weights=None, sides=12):
    """定向根系：截面带棱，纹理沿生长方向，形体由显式路径决定。"""
    centers = base.path_samples(points, 7)
    verts, faces, uv = [], [], []
    for i, c in enumerate(centers):
        t = i / (len(centers)-1)
        q = t*(len(widths)-1); j = min(len(widths)-2, int(q)); f = q-j
        w = widths[j]*(1-f)+widths[j+1]*f
        tangent = (centers[min(i+1,len(centers)-1)]-centers[max(i-1,0)]).normalized()
        axis = tangent.cross(Vector((0, -1, 0))).normalized()
        if axis.length < .5: axis = tangent.cross(Vector((1, 0, 0))).normalized()
        normal = tangent.cross(axis).normalized()
        for k in range(sides+1):
            a = k/sides*math.tau + twist*t
            # 大棱面与浅凹槽，避免圆柱式截面。
            radius = w*(1+.10*math.cos(a*3+.5)+.05*math.cos(a*5))
            verts.append(c + axis*(radius*math.cos(a)) + normal*(radius*depth*math.sin(a)))
            uv.append((offset + k/sides*.28, .04+t*.91))
            if i and k < sides:
                q0=(i-1)*(sides+1)+k; q1=i*(sides+1)+k
                faces.append((q0,q0+1,q1+1,q1))
    faces.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*(sides+1)+k for k in range(sides))])
    fn = (lambda i: weights((i//(sides+1))/(len(centers)-1))) if weights else bone
    return mesh(name,verts,faces,material or BARK,uv,fn,False)


def leaf(name, start, end, width, bone, variant=0, face=-1, curl=.10, roll=0, facing=None):
    variant=[0,1,2,1][variant%4]
    a,b=Vector(start),Vector(end); direction=(b-a).normalized()
    front=Vector(facing or (0,face,.22)).normalized()
    normal=front.copy()
    side=direction.cross(normal).normalized()
    normal=side.cross(direction).normalized()
    if normal.dot(front)<0: normal=-normal
    verts=[];uv=[];faces=[]
    rows,cols=16,6
    for i in range(rows+1):
        t=i/rows
        center=a.lerp(b,t)+normal*(curl*math.sin(math.pi*t)-.045*t*t)+side*(roll*math.sin(math.pi*t))
        # 叶簇决定大轮廓，叶缘只有克制的锯齿。
        w=width*(math.sin(math.pi*t)**.82)*(1-.27*t)*(1-.035*(i%2))
        for k in range(cols+1):
            across=k/cols*2-1
            v=center+side*w*across+normal*(.045*math.sin(math.pi*t)*(1-abs(across))-.02*across*across)
            verts.append(v)
            col=variant%2; row=variant//2%2
            uv.append((col*.5+.018+(across+1)*.232,1-row*.5-.482+t*.464))
            if i and k:
                q=(i-1)*(cols+1)+k-1
                faces.append((q,q+1,q+cols+2,q+cols+1))
    ob=mesh(name,verts,faces,LEAF,uv,bone,True)
    mod=ob.modifiers.new('叶片厚度','SOLIDIFY');mod.thickness=.005
    return ob


def create_rig():
    global RIG
    data=bpy.data.armatures.new('缚枝祭主·美术骨架')
    RIG=bpy.data.objects.new('缚枝祭主·可编辑骨架',data);bpy.context.collection.objects.link(RIG)
    bpy.context.view_layer.objects.active=RIG;RIG.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    bones={}
    def add(name,head,tail,parent=None):
        b=data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=bones[parent]
        bones[name]=b
    add('根',(0,0,0),(0,0,.3))
    add('骨盆',(0,0,1.40),(0,0,1.66),'根')
    add('腰',(0,0,1.66),(0,0,2.12),'骨盆')
    add('胸',(0,0,2.12),(0,0,2.98),'腰')
    add('头',(0,0,2.98),(0,0,3.63),'胸')
    for s,side in [(-1,'左'),(1,'右')]:
        add(side+'大腿',(s*.30,0,1.48),(s*.49,-.045,.83),'骨盆')
        add(side+'小腿',(s*.49,-.045,.83),(s*.61,.03,.18),side+'大腿')
        add(side+'脚',(s*.61,.03,.18),(s*.62,-.43,.09),side+'小腿')
        add(side+'上臂',(s*.65,0,2.89),(s*1.01,-.01,2.16),'胸')
        add(side+'前臂',(s*1.01,-.01,2.16),(s*1.30,-.08,1.62),side+'上臂')
        add(side+'镰臂',(s*1.30,-.08,1.62),(s*1.50,-.10,1.08),side+'前臂')
        add(side+'肩叶',(s*.43,.12,2.99),(s*.94,.14,2.51),'胸')
        add(side+'腰叶',(s*.29,.03,1.76),(s*.56,.05,1.24),'骨盆')
        add(side+'冠枝',(s*.10,.06,3.40),(s*.48,.08,3.97),'头')
    bpy.ops.object.mode_set(mode='OBJECT');RIG.show_in_front=True
    RIG['说明']='静态候选与弯曲检查骨架；完整六秒动作待静态美术确认后迁移。'


def torso():
    # 骨盆到颈部的主根系：明确交叉关系，胸前给风核留出菱形空腔。
    paths=[
      ([(-.36,.03,1.26),(-.29,-.19,1.56),(.12,-.29,1.95),(.38,-.19,2.30),(.35,-.09,2.70),(.13,.02,3.23)],[.16,.145,.115,.13,.14,.10]),
      ([(.39,.01,1.25),(.27,-.25,1.57),(-.15,-.30,1.91),(-.36,-.21,2.25),(-.35,-.07,2.73),(-.12,.05,3.20)],[.145,.125,.10,.14,.145,.10]),
      ([(-.31,.24,1.25),(-.42,.22,1.75),(-.30,.27,2.18),(-.26,.24,2.64),(.09,.13,3.28)],[.12,.14,.12,.14,.08]),
      ([(.35,.21,1.28),(.40,.21,1.73),(.26,.28,2.15),(.30,.23,2.66),(-.08,.10,3.25)],[.12,.13,.11,.14,.08]),
      ([(-.24,.02,1.42),(.05,.07,1.74),(.27,.11,2.07),(.19,.16,2.54),(0,.09,3.22)],[.10,.11,.13,.11,.08]),
      ([(.28,.02,1.37),(.04,.22,1.81),(-.20,.16,2.15),(-.17,.11,2.59),(0,.06,3.25)],[.10,.10,.12,.10,.07]),
    ]
    for i,(points,w) in enumerate(paths):
        root('躯干主根·交织'+str(i),points,w,weights=lambda t:base.blend_weights('腰','胸',t,.48),offset=i*.09,twist=.45)
    for s in [-1,1]:
        root('腰腹浅色棱根',[(s*.38,-.10,1.33),(s*.23,-.35,1.56),(-s*.11,-.36,1.92),(-s*.34,-.22,2.22)],[.050,.064,.061,.017],weights=lambda t:base.blend_weights('腰','胸',t,.73),material=LIGHT_BARK,offset=.33)
        root('胸侧包覆根',[(s*.37,-.12,2.05),(s*.44,-.14,2.38),(s*.34,-.16,2.80),(s*.62,.00,2.94)],[.045,.06,.065,.02],material=LIGHT_BARK,offset=.50)
        root('锁骨根系',[(0,.0,3.16),(s*.23,-.05,3.04),(s*.65,.01,2.87),(s*.86,.02,2.63)],[.105,.13,.14,.04],offset=.15)
    # 背面仍有完整根系结构，避免三视图成为三张卡片。
    for s in [-1,1]:
        root('背脊交叉根',[(s*.34,.27,1.43),(-s*.24,.37,1.97),(-s*.31,.30,2.61),(s*.11,.16,3.27)],[.09,.115,.09,.025],weights=lambda t:base.blend_weights('腰','胸',t,.45),offset=.21)


def limbs():
    def arm_weights(t,side):
        if t<.27:
            u=base.ease(t/.27)
            return {'胸':1-u,side+'上臂':u}
        return base.blend_weights(side+'上臂',side+'前臂',t,.53)
    for s,side in [(-1,'左'),(1,'右')]:
        for strand,(ox,oy,w) in enumerate([(-.10,-.035,.12),(.075,-.035,.13),(0,.10,.10)]):
            arm=[(s*(.53+ox),oy,2.96),(s*(.77+ox*.6),oy-.025,2.62),(s*(1.01+ox),oy,2.16),(s*(1.18-ox*.4),oy-.03,1.87),(s*(1.31+ox*.25),oy-.08,1.59)]
            root(side+'臂缠绕根'+str(strand),arm,[w*1.1,w,w*.85,w*1.05,w*.7],weights=lambda t,side=side:arm_weights(t,side),offset=.11*strand+.12,twist=.62)
        # 叠压木甲沿外侧包住肘部，避免圆球关节。
        for j in range(3):
            root(side+'肘部叠甲'+str(j),[(s*(.90+j*.045),.035,2.33-j*.08),(s*(1.09+j*.045),-.04,2.25-j*.10),(s*(1.19+j*.03),.015,2.40-j*.1)],[.13,.09,.005],bone=side+'前臂',depth=.48,offset=.45+j*.08)
        root(side+'前臂生长脊',[(s*.82,-.135,2.64),(s*.97,-.16,2.32),(s*1.16,-.18,1.97),(s*1.33,-.18,1.56)],[.027,.053,.055,.006],weights=lambda t,side=side:base.blend_weights(side+'上臂',side+'前臂',t,.48),material=LIGHT_BARK,offset=.40)
        for strand,(ox,oy,w) in enumerate([(-.095,-.04,.115),(.082,-.025,.12),(.015,.105,.095)]):
            leg=[(s*(.30+ox),oy,1.55),(s*(.40-ox*.5),oy-.04,1.19),(s*(.49+ox),oy-.045,.83),(s*(.55-ox*.5),oy,.49),(s*(.61+ox*.3),oy+.03,.18)]
            root(side+'腿根'+str(strand),leg,[w*1.12,w,w*.8,w*.9,w*.65],weights=lambda t,side=side:base.blend_weights(side+'大腿',side+'小腿',t,.54),offset=.10+strand*.23,twist=-.50)
        root(side+'膝前延伸棱',[(s*.38,-.15,1.19),(s*.52,-.17,.89),(s*.56,-.13,.62),(s*.63,-.06,.23)],[.047,.071,.045,.008],weights=lambda t,side=side:base.blend_weights(side+'大腿',side+'小腿',t,.28),material=LIGHT_BARK,offset=.38)
        for j,(dx,dy) in enumerate([(-.32,-.42),(-.08,-.60),(.18,-.53),(.38,-.29),(.17,.35)]):
            root(side+'分叉根足'+str(j),[(s*.61,.03,.27),(s*(.62+dx*.35),dy*.35,.13),(s*(.63+dx*.75),dy*.80,.062),(s*(.66+dx),dy,.024)],[.095,.081,.041,.003],bone=side+'脚',depth=.60,offset=j*.13+.05,twist=.4)
        for j in [0,2,3]:
            dx=[-.32,-.08,.18,.38][j];dy=[-.42,-.60,-.53,-.29][j]
            root(side+'足根细分叉'+str(j),[(s*(.63+dx*.5),dy*.6,.085),(s*(.7+dx*.8),dy*.78+.08,.04),(s*(.80+dx),dy+.04,.025)],[.031,.02,.001],bone=side+'脚',offset=.27)


def blades():
    for s,side in [(-1,'左'),(1,'右')]:
        # 外缘与内缘均为定向设计的曲线，内部有实体厚度及锯齿。
        outer=base.path_samples([(s*1.27,-.10,1.87),(s*1.54,-.10,1.64),(s*1.69,-.11,1.24),(s*1.65,-.12,.91),(s*1.43,-.15,.53),(s*.84,-.20,.18)],6)
        inner=base.path_samples([(s*1.17,-.10,1.88),(s*1.31,-.10,1.61),(s*1.40,-.11,1.27),(s*1.39,-.12,.97),(s*1.22,-.15,.60),(s*.84,-.20,.18)],6)
        verts=[];uv=[];faces=[];N=len(outer)
        for i,(a,b) in enumerate(zip(outer,inner)):
            t=i/(N-1)
            for back in [False,True]:
                for k in range(5):
                    u=k/4;p=a.lerp(b,u)
                    p.y+= (.05 if back else -.04-.045*math.sin(math.pi*u))*math.sin(math.pi*(.05+.90*t))
                    verts.append(p);uv.append((.1+u*.43,.03+t*.92))
            if i:
                for k in range(4):
                    q=(i-1)*10+k;faces.append((q,q+1,q+11,q+10))
                    q+=5;faces.append((q+10,q+11,q+1,q))
                q=(i-1)*10;faces.extend([(q,q+10,q+15,q+5),(q+4,q+9,q+19,q+14)])
        faces.extend([(0,5,9,4),((N-1)*10,(N-1)*10+4,(N-1)*10+9,(N-1)*10+5)])
        mesh(side+'骨木镰刃',verts,faces,IVORY,uv,side+'镰臂',True)
        # 锯齿独立接在内缘，避免拉扯整块刃面造成周期性波纹。
        for i in range(4,N-7,3):
            a=inner[i].copy();b=inner[i+2].copy();tip=a.lerp(b,.38)+Vector((-s*.068,-.008,.04))
            vs=[]
            for yoff in [-.038,.026]:
                vs.extend([p+Vector((0,yoff,0)) for p in [a,tip,b]])
            mesh(side+'镰刃内齿'+str(i),vs,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2)],IVORY,[(.48,.03+i/(N-1)*.92),(.53,.03+(i+.6)/(N-1)*.92),(.48,.03+(i+2)/(N-1)*.92)]*2,side+'镰臂')
        root(side+'镰背主脊',[(s*1.24,.015,1.96),(s*1.50,.015,1.69),(s*1.65,.01,1.30),(s*1.62,-.01,.97),(s*1.41,-.07,.57),(s*.84,-.19,.18)],[.13,.12,.09,.055,.023,.001],bone=side+'镰臂',depth=.58,offset=.32)
        for j in range(5):
            z=1.81-j*.18;x=1.34+.20*math.sin(j/5*math.pi)
            root(side+'镰背尖甲'+str(j),[(s*(x-.06),.025,z-.1),(s*(x+.08),.015,z),(s*(x+.10),.02,z+.19)],[.06,.07,.002],bone=side+'镰臂',depth=.5,offset=.23+j*.09)


def canopy():
    # 每组叶簇有明确的生长与披挂方向；前后均有体积。
    for s,side in [(-1,'左'),(1,'右')]:
        for face in [-1,1]:
            fy=face*.16
            # 上肩展开、中肩外垂、下肩回收，打破平行排片。
            fans=[((.18,3.20),(.67,3.11),.13),((.23,3.13),(.95,2.98),.16),((.30,3.06),(1.10,2.75),.18),((.36,2.99),(1.18,2.52),.16),((.39,2.92),(1.02,2.34),.15),((.34,2.83),(.75,2.22),.15),((.27,2.73),(.53,2.14),.13)]
            for layer in [0,2]:
                for j,(a,b,w) in enumerate(fans):
                    shift=(layer-1)*.085
                    dz=[.02,-.07,.035,-.055,.04,-.09,.01][j]*(1 if s<0 else -.7)
                    start=(s*(a[0]+shift),fy+face*layer*.09,a[1]-.105*layer+dz)
                    end=(s*(b[0]+shift*.6-.06*layer),fy+face*(.12+layer*.08),b[1]-.15*layer+dz)
                    leaf(side+'披肩主叶',start,end,w*(1-.11*layer),side+'肩叶',(j+layer*2+(s==1))%4,face,curl=.065+.025*layer,roll=.04*(j%3-1))
            for j in range(8):
                start=(s*(.23+.045*j),fy+face*.32,3.12-j*.067)
                end=(s*(.45+.077*j),fy+face*.38,2.88-j*.076)
                leaf(side+'肩叶覆层',start,end,.075+.015*(j%3),side+'肩叶',(j+1)%4,face,curl=.055,roll=.025)
            for j in range(7):
                start=(s*(.18+.046*j),face*(.13+.015*j),1.86-j*.055)
                end=(s*(.37+.057*j),face*(.30+.018*j),1.40-j*.10)
                leaf(side+'腰部披叶',start,end,.11+.018*(j%3),side+'腰叶',(j+2)%4,face,curl=.075,roll=-.035)
            # 肘外侧少量叶片连接肩披叶与镰背，不遮住出手轮廓。
            for j in range(7):
                start=(s*(1.08+.067*j),face*.05,2.09-j*.12)
                end=(s*(1.40+.050*j),face*.20,1.85-j*.17)
                leaf(side+'镰背叶',start,end,.10+.012*(j%2),side+'镰臂' if j>2 else side+'前臂',(j+2)%4,face,curl=.05,roll=.018)
        for j in range(6):
            leaf(side+'腿侧细叶',(s*(.31+.025*j),.10,1.37-j*.10),(s*(.53+.045*j),.18,.99-j*.105),.07,side+'大腿' if j<3 else side+'小腿',(j+1)%4,1,curl=.04)
        for j in range(9):
            yy=[-.20,.0,.20][j%3]
            leaf(side+'披肩侧向叶',(s*.60,yy*.6,3.02-(j//3)*.17),(s*(.90+.04*(j%3)),yy*1.9,2.52-(j//3)*.20),.12,side+'肩叶',j%3,1,curl=.10,facing=(s,.1,.12))


def head():
    # 树冠使用左右不同的生长路径，主枝明确分叉，避免鹿角模板感。
    branches=[
      ([(-.12,.04,3.33),(-.34,.06,3.64),(-.47,.05,3.94),(-.42,.05,4.23)],[.105,.087,.049,.004],-1),
      ([(-.33,.06,3.65),(-.65,.07,3.79),(-.84,.05,4.03),(-.88,.04,4.21)],[.066,.052,.035,.003],-1),
      ([(-.63,.07,3.79),(-.93,.05,3.82),(-1.11,.03,3.98)],[.046,.028,.002],-1),
      ([(-.45,.05,3.96),(-.66,.04,4.13),(-.65,.03,4.33)],[.034,.023,.002],-1),
      ([(-.88,.04,4.06),(-1.01,.04,4.12),(-1.06,.04,4.26)],[.025,.016,.002],-1),
      ([(.12,.09,3.36),(.35,.08,3.63),(.55,.05,3.89),(.61,.04,4.18)],[.11,.086,.045,.003],1),
      ([(.35,.08,3.65),(.69,.07,3.72),(.94,.04,3.85),(1.08,.04,4.05)],[.067,.046,.028,.003],1),
      ([(.55,.05,3.90),(.78,.05,4.06),(.82,.02,4.29)],[.035,.024,.002],1),
      ([(.92,.04,3.84),(1.13,.04,3.84),(1.25,.03,3.98)],[.029,.021,.002],1),
      ([(.59,.04,4.14),(.46,.03,4.28),(.50,.03,4.38)],[.023,.013,.002],1),
      ([(-.45,.05,3.95),(-.29,.03,4.09),(-.31,.02,4.27)],[.033,.023,.002],-1),
      ([(-.88,.04,4.08),(-.77,.02,4.17),(-.76,.02,4.31)],[.025,.014,.002],-1),
      ([(-1.01,.04,4.12),(-1.14,.03,4.17),(-1.19,.02,4.27)],[.017,.012,.002],-1),
      ([(-.95,.05,3.85),(-.95,.03,3.98),(-1.02,.02,4.05)],[.027,.015,.002],-1),
      ([(.78,.05,4.06),(.99,.03,4.16),(.99,.02,4.32)],[.026,.019,.002],1),
      ([(1.07,.04,4.02),(.99,.02,4.15),(1.03,.01,4.23)],[.021,.014,.002],1),
      ([(1.14,.04,3.84),(1.20,.02,3.95),(1.19,.01,4.08)],[.019,.013,.002],1),
      ([(.55,.05,3.89),(.43,.15,4.04),(.35,.15,4.10)],[.033,.017,.002],1),
    ]
    for i,(p,w,s) in enumerate(branches):
        # 共用连续深度场，分叉起点与主枝保持连接，不能逐枝独立偏移。
        p=[(x*.80,y+.20*math.sin(x*3.1)+(z-3.30)*.13,z) for x,y,z in p]
        root('不对称树冠'+str(i),p,w,bone=('左' if s<0 else '右')+'冠枝',offset=.08*(i%8),material=LIGHT_BARK)
    verts=[];faces=[];uv=[]
    for row in range(15):
        t=row/14;z=3.02+t*.78;rad=.22*math.sin(math.pi*(.025+.95*t))**.55
        for col in range(25):
            a=col/24*math.tau
            verts.append((rad*math.cos(a),-.025+rad*1.12*math.sin(a),z));uv.append((.10+col/24*.36,.04+t*.90))
            if row and col:
                k=(row-1)*25+col-1;faces.append((k,k+1,k+26,k+25))
    faces.extend([tuple(reversed(range(24))),tuple(14*25+i for i in range(24))])
    mesh('面具后方实体颅壳',verts,faces,BARK,uv,'头')
    for s in [-1,1]:
        root('面具后方颅根',[(s*.11,-.03,3.06),(s*.21,.06,3.34),(s*.19,.09,3.58),(s*.06,.0,3.77)],[.085,.11,.10,.014],bone='头',offset=.3)
        root('面具侧缘包覆根',[(s*.08,-.11,3.08),(s*.22,-.18,3.31),(s*.21,-.12,3.61),(s*.04,-.07,3.77)],[.063,.075,.064,.006],bone='头',offset=.52)
        for j in range(4):
            leaf('颅后覆叶',(s*.07,.15,3.54-j*.055),(s*.26,.28,3.31-j*.075),.09,'头',j%3,1,curl=.07,facing=(s*.5,1,.1))
    for s,side in [(-1,'左'),(1,'右')]:
        for j in range(7):
            leaf(side+'颈冠叶',(s*.11,.13,3.27+j*.018),(s*(.32+.045*j),.22,3.72-j*.055),.085,side+'冠枝',j%4,1,curl=.08)
    # 按原画面具的长窄尖形制作有厚度的折面壳，外侧附属片独立。
    outline=[(-.25,3.76),(-.11,3.62),(-.085,3.91),(.025,3.70),(.18,3.88),(.19,3.60),(.28,3.65),(.20,3.40),(.10,3.18),(0,3.02),(-.10,3.23),(-.21,3.48)]
    verts=[(x,-.37+.15*abs(x)/.28,z) for x,z in outline]
    verts.extend([(0,-.52,3.63),(0,-.49,3.32),(0,-.40,3.12)])
    uv=[(.05+(x+.30)/.60*.62,.05+(z-3.0)/.95*.88) for x,y,z in verts]
    faces=[]
    for i in range(len(outline)):
        j=(i+1)%len(outline)
        c=12 if i<7 or i>10 else (13 if i in [7,10] else 14)
        faces.append((i,j,c))
    faces.extend([(6,7,13,12),(10,11,12,13),(7,8,14,13),(9,10,13,14)])
    ob=mesh('细长骨木面具',verts,faces,IVORY,uv,'头')
    mod=ob.modifiers.new('面具内壳厚度','SOLIDIFY');mod.thickness=.025
    for s in [-1,1]:
        eye=[(s*.087,-.487,3.59),(s*.12,-.458,3.58),(s*.158,-.426,3.54),(s*.169,-.409,3.49),(s*.15,-.431,3.44),(s*.108,-.475,3.36),(s*.086,-.49,3.42),(s*.078,-.501,3.48),(s*.08,-.499,3.54)]
        mesh('面具深眼窝',eye,[tuple(range(len(eye)))],DARK,[(0,0)]*len(eye),'头')
        root('面具纵向浅棱',[(s*.03,-.525,3.70),(s*.051,-.522,3.50),(s*.033,-.491,3.30),(0,-.411,3.04)],[.009,.012,.009,.001],bone='头',material=PALE,depth=.28,offset=.21,sides=6)
        root('面具侧面刻痕',[(s*.18,-.401,3.69),(s*.19,-.403,3.53),(s*.12,-.466,3.30)],[.003,.005,.001],bone='头',material=DARK,depth=.25,sides=5)


def core():
    # 胸前深色内腔、半透感旋流与包覆树根分层，而非圆盘贴在胸前。
    for face,z,scale in [(-1,2.50,1),(1,2.50,.75)]:
        y=face*.25
        bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=(0,y,z))
        ob=bpy.context.object;ob.name='风核深腔'
        ob.scale=(.282*scale,.10,.355*scale);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        ob.data.materials.append(DARK);ob.parent=RIG
        g=ob.vertex_groups.new(name='胸');g.add(list(range(len(ob.data.vertices))),1,'REPLACE')
        mod=ob.modifiers.new('骨骼变形','ARMATURE');mod.object=RIG;PARTS.append(ob)
        # 实体弧面上的手绘旋流，中心凸起、边缘收进根系内腔。
        verts=[(0,y+face*.195,z)];uv=[(.5,.5)];faces=[]
        segments,rings=64,14
        for i in range(1,rings+1):
            r=i/rings
            for j in range(segments):
                a=j/segments*math.tau
                verts.append((.272*scale*r*math.cos(a),y+face*(.058+.137*math.sqrt(max(0,1-r*r))),z+.342*scale*r*math.sin(a)))
                uv.append((.5+.47*r*math.cos(a),.5+.47*r*math.sin(a)))
                k=1+(i-1)*segments+j;next_k=1+(i-1)*segments+(j+1)%segments
                if i==1:faces.append((0,k,next_k))
                else:faces.append((k-segments,k,next_k,next_k-segments))
        mesh('风核手绘弧面',verts,faces,CORE_MATS[0],uv,'胸',True)
        for s in [-1,1]:
            root('风核外侧包覆根',[(s*.02,face*.16,2.98),(s*.23,face*.26,2.78),(s*.305,face*.25,2.49),(s*.18,face*.25,2.20),(0,face*.21,1.99)],[.055,.078,.065,.053,.009],material=LIGHT_BARK,offset=.15 if s<0 else .54)


def setup():
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1800;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.compression=25;scene.render.film_transparent=True
    scene.render.fps=60;scene.frame_start=1;scene.frame_end=100
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.49,.44,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=64
    for name,loc,energy,col,size in [('主光',(-3,-6,8),650,(1,.91,.75),5),('冷填光',(4,-2,5),280,(.65,.81,1),4),('背光',(1,4,7),650,(.82,1,.84),4)]:
        data=bpy.data.lights.new(name,'AREA');ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
        ob.location=loc;data.energy=energy;data.color=col;data.shape='DISK';data.size=size
        ob.rotation_euler=(Vector((0,0,2.1))-ob.location).to_track_quat('-Z','Y').to_euler()
    base.camera('游戏视角',(0,-10,7.6),(0,0,2.05),5.25)
    base.camera('侧面视角',(9,-1,6.3),(0,0,2.10),5.25)
    base.camera('背面视角',(0,10,7.6),(0,0,2.05),5.25)
    base.camera('面具细节',(0,-8,4.9),(0,0,3.43),2.4)
    base.camera('根系细节',(0,-8,4.4),(0,-.1,1.88),2.3)
    base.camera('关节细节',(-5,-7,4.8),(-.84,0,2.24),2.9)
    scene.camera=bpy.data.objects['游戏视角']
    # 将原画作为可切换的视口参考，禁止参与交付渲染。
    for name,file,x in [('正面参考','down',-6),('侧面参考','right',0),('背面参考','up',6)]:
        ref=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ref)
        ref.empty_display_type='IMAGE';ref.data=bpy.data.images.load(str(ROOT/f'docs/combat-v2/source/bound-branch-{file}-idle.png'),check_existing=True)
        ref.empty_display_size=4.4;ref.location=(x,3,2.2);ref.rotation_euler=(math.pi/2,0,0);ref.hide_render=True
    return scene


def pose(frame):
    # 静态弯曲检查：不作为最终动作，不覆写旧版六秒动画。
    for pb in RIG.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0)
    if frame==40:
        RIG.pose.bones['腰'].rotation_euler.y=math.radians(-12)
        RIG.pose.bones['胸'].rotation_euler.y=math.radians(22)
        RIG.pose.bones['左上臂'].rotation_euler.z=math.radians(-42)
        RIG.pose.bones['左前臂'].rotation_euler.x=math.radians(-58)
        RIG.pose.bones['左镰臂'].rotation_euler.y=math.radians(12)
    elif frame==80:
        RIG.pose.bones['腰'].rotation_euler.y=math.radians(12)
        RIG.pose.bones['胸'].rotation_euler.y=math.radians(-20)
        RIG.pose.bones['右上臂'].rotation_euler.z=math.radians(37)
        RIG.pose.bones['右前臂'].rotation_euler.x=math.radians(-62)
    for pb in RIG.pose.bones:pb.keyframe_insert('rotation_euler',frame=frame)
    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()


def save():
    scene=bpy.context.scene
    for f in [1,40,80,100]:pose(f)
    scene.timeline_markers.new('静态定妆',frame=1);scene.timeline_markers.new('左肩肘弯曲检查',frame=40);scene.timeline_markers.new('右肩肘弯曲检查',frame=80)
    scene.frame_set(1)
    for ob in bpy.context.selected_objects:ob.select_set(False)
    RIG.select_set(True);bpy.context.view_layer.objects.active=RIG
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.type='MATERIAL';area.spaces.active.shading.use_scene_world=True;area.spaces.active.shading.use_scene_lights=True
                area.spaces.active.overlay.show_overlays=False;area.spaces.active.region_3d.view_perspective='CAMERA'
    txt=bpy.data.texts.get('制作说明') or bpy.data.texts.new('制作说明')
    txt.clear();txt.write('缚枝祭主静态美术候选。实体根系、镰刃、面具与弯曲叶片；材质使用独立手绘颜色源图。静态帧一，肩肘检查帧四十与八十。此工程尚未制作最终六秒动画，也未接入游戏。展示图直接渲染，无后期修饰模型。')
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/east-boss-art.blend'))


def render(mode,percent):
    scene=bpy.context.scene;scene.render.resolution_percentage=percent
    jobs={'front':('游戏视角',1),'side':('侧面视角',1),'back':('背面视角',1),'mask':('面具细节',1),'roots':('根系细节',1),'joint':('关节细节',40),'bend-left':('游戏视角',40),'bend-right':('游戏视角',80)}
    chosen=jobs if mode=='all' else {mode:jobs.get(mode,('游戏视角',1))}
    if mode=='preview':chosen={'preview':('游戏视角',1)}
    if mode=='clay' or mode=='silhouette':
        mat=base.material('检查材质',(.46,.46,.43),1)
        if mode=='silhouette':
            n=mat.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs[0].default_value=(.025,.045,.032,1);out=n.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(em.outputs[0],out.inputs[0])
        scene.view_layers[0].material_override=mat
    for name,(cam,f) in chosen.items():
        scene.camera=bpy.data.objects[cam];scene.frame_set(f)
        scene.render.filepath=str(OUT/'evidence'/f'{name}.png');bpy.ops.render.render(write_still=True)


def main():
    global BARK,LIGHT_BARK,IVORY,PALE,DARK,LEAF,CORE_MATS,RIG
    parser=argparse.ArgumentParser(description='缚枝祭主静态美术候选')
    parser.add_argument('--load',action='store_true');parser.add_argument('--render',default='none');parser.add_argument('--percent',type=int,default=100)
    opt=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for p in [TEX,OUT/'evidence']:p.mkdir(parents=True,exist_ok=True)
    if opt.load:
        bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/east-boss-art.blend'));RIG=bpy.data.objects['缚枝祭主·可编辑骨架']
    else:
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        BARK=texture_material('树皮·手绘褐色',TEX/'bark-paint-source.png')
        LIGHT_BARK=texture_material('树皮·暖金生长棱',TEX/'bark-paint-source.png',((.09,.045,.021),(.76,.50,.24)))
        IVORY=texture_material('骨木·手绘象牙色',TEX/'ivory-paint-source.png',emission=.08,gain=.66)
        PALE=base.material('骨木·亮棱',(.82,.70,.43),.95)
        DARK=base.material('深腔·墨褐',(.019,.027,.017),1)
        LEAF=texture_material('叶片·四种手绘颜色',TEX/'leaf-paint-source.png',emission=.12)
        CORE_MATS=[texture_material('风核·手绘旋流',TEX/'core-paint-source.png',emission=.25)]
        create_rig();torso();limbs();blades();canopy();head();core();setup();save()
        stats={'说明':'图集烘焙前的静态候选统计，叶片厚度修改器尚未应用；最终工程数量见独立重开检查。数值不代表最终视觉通过。','网格对象':len(PARTS),'顶点':sum(len(o.data.vertices) for o in PARTS),'面数':sum(len(o.data.polygons) for o in PARTS),'骨骼':len(RIG.data.bones),'源图尺寸':{i.name:list(i.size) for i in bpy.data.images if i.source=='FILE'},'原版保留':'docs/east-boss-motion/source/east-boss-motion.blend'}
        (OUT/'evidence/model-statistics.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
        print(json.dumps(stats,ensure_ascii=False))
    if opt.render!='none':render(opt.render,opt.percent)


if __name__=='__main__':main()
