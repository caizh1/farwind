"""用本机 Blender 构建缚枝祭主模型、骨骼与六秒动作，支持关键帧和完整渲染。"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix, Euler

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/east-boss-motion'
CACHE = ROOT / '.east-boss-motion-local'
random.seed(37)
PARTS = []
RIG = None


def material(name, color, roughness=.65, metallic=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    return m


def bark_material():
    m = material('树皮·暖褐纤维', (.22, .105, .041))
    n, l = m.node_tree.nodes, m.node_tree.links
    tex = n.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 4
    tex.inputs['Detail'].default_value = 3
    coord = n.new('ShaderNodeTexCoord')
    scale = n.new('ShaderNodeVectorMath'); scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = (5, 5, .8)
    l.new(coord.outputs['Generated'], scale.inputs[0]); l.new(scale.outputs[0], tex.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .22
    ramp.color_ramp.elements[0].color = (.035, .018, .009, 1)
    ramp.color_ramp.elements[1].position = .78
    ramp.color_ramp.elements[1].color = (.25, .125, .038, 1)
    mid = ramp.color_ramp.elements.new(.49); mid.color = (.105, .044, .016, 1)
    l.new(tex.outputs['Fac'], ramp.inputs[0])
    p = n.get('Principled BSDF'); l.new(ramp.outputs['Color'], p.inputs['Base Color'])
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .25; bump.inputs['Distance'].default_value = .055
    l.new(tex.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m


def mesh(name, vertices, faces, mats, bone=None, weights=None, indices=None, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
    for m in mats: data.materials.append(m)
    for i, p in enumerate(data.polygons):
        p.use_smooth = smooth
        if indices: p.material_index = indices[i % len(indices)] % len(mats)
    if bone or weights:
        groups = {}
        for i in range(len(vertices)):
            for b, w in (weights(i) if weights else {bone: 1}).items():
                if w > 0:
                    if b not in groups: groups[b] = ob.vertex_groups.new(name=b)
                    groups[b].add([i], w, 'REPLACE')
        mod = ob.modifiers.new('骨骼蒙皮', 'ARMATURE'); mod.object = RIG
        PARTS.append(ob)
    return ob


def path_samples(points, steps=5):
    points = [Vector(p) for p in points]
    result = []
    for i in range(len(points)-1):
        p0,p1,p2,p3 = points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for j in range(steps):
            t=j/steps
            result.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    return result+[points[-1]]


def tube(name, points, radii, mat, bone=None, sides=9, steps=5, weights=None, ridge=False):
    centers = path_samples(points, steps)
    vertices=[]; faces=[]
    for i,c in enumerate(centers):
        t=i/(len(centers)-1)*(len(radii)-1); j=min(len(radii)-2,int(t)); f=t-j
        radius=radii[j]*(1-f)+radii[j+1]*f
        tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
        axis=tangent.cross(Vector((0,1,0))).normalized()
        if axis.length<.5: axis=tangent.cross(Vector((1,0,0))).normalized()
        normal=tangent.cross(axis).normalized()
        for k in range(sides):
            a=2*math.pi*k/sides
            rr=radius*(1+.11*math.sin(k*2.9+i*.38))
            vertices.append(c+rr*(axis*math.cos(a)+normal*math.sin(a)))
        if i:
            for k in range(sides):
                faces.append(((i-1)*sides+k,(i-1)*sides+(k+1)%sides,i*sides+(k+1)%sides,i*sides+k))
    faces.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+k for k in range(sides))])
    fn=(lambda idx:weights((idx//sides)/(len(centers)-1))) if weights else None
    return mesh(name,vertices,faces,[mat],bone,fn,smooth=not ridge)


def sphere(name, center, scale, mat, bone=None, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions,radius=1,location=center)
    ob=bpy.context.object; ob.name=name; ob.scale=scale
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
    if bone:
        g=ob.vertex_groups.new(name=bone);g.add(list(range(len(ob.data.vertices))),1,'REPLACE')
        mod=ob.modifiers.new('骨骼蒙皮','ARMATURE');mod.object=RIG;PARTS.append(ob)
    return ob


def leaf(name, start, end, width, bone, mat_index=0):
    a,b=Vector(start),Vector(end); direction=(b-a).normalized()
    side=direction.cross(Vector((0,-1,.2))).normalized()
    if side.length<.1:side=Vector((1,0,0))
    normal=side.cross(direction).normalized()
    verts=[];faces=[];indices=[];centers=[]
    for i in range(7):
        t=i/6;c=a.lerp(b,t)+normal*(math.sin(t*math.pi)*.075)
        centers.append(c)
        w=width*math.sin(math.pi*t)**.72*(1-.28*t)
        verts.extend([c-side*w,c+normal*.024*math.sin(t*math.pi),c+side*w])
        if i:
            j=(i-1)*3
            faces.extend([(j,j+3,j+4,j+1),(j+1,j+4,j+5,j+2)])
            indices.extend([mat_index%len(LEAVES),(mat_index+1)%len(LEAVES)])
    mesh(name,verts,faces,LEAVES,bone,indices=indices,smooth=True)
    tube('叶脉',centers[::2],[.007,.006,.003,.001],VEIN,bone,sides=4,steps=2)


def blend_weights(first,second,t,split=.5):
    u=max(0,min(1,(t-split+.16)/.32));u=u*u*(3-2*u)
    return {first:1-u,second:u}


def create_rig():
    global RIG
    data=bpy.data.armatures.new('缚枝祭主·可编辑骨架')
    RIG=bpy.data.objects.new('缚枝祭主·动作骨架',data);bpy.context.collection.objects.link(RIG)
    bpy.context.view_layer.objects.active=RIG;RIG.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    bones={}
    def bone(name,head,tail,parent=None):
        b=data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=bones[parent]
        bones[name]=b
    bone('根',(0,0,0),(0,0,.35))
    bone('骨盆',(0,0,1.27),(0,0,1.48),'根')
    bone('腰',(0,0,1.48),(0,0,1.96),'骨盆')
    bone('胸',(0,0,1.96),(0,0,2.46),'腰')
    bone('头',(0,0,2.46),(0,0,3.06),'胸')
    for s,side in [(-1,'左'),(1,'右')]:
        bone(side+'大腿',(s*.31,0,1.3),(s*.48,-.04,.70),'骨盆')
        bone(side+'小腿',(s*.48,-.04,.70),(s*.48,-.04,.16),side+'大腿')
        bone(side+'脚',(s*.48,-.04,.16),(s*.48,-.42,.12),side+'小腿')
        bone(side+'上臂',(s*.57,0,2.39),(s*.87,.02,1.97),'胸')
        bone(side+'前臂',(s*.87,.02,1.97),(s*1.06,-.06,1.53),side+'上臂')
        bone(side+'镰臂',(s*1.06,-.06,1.53),(s*1.08,-.06,1.23),side+'前臂')
        bone(side+'肩叶',(s*.52,.10,2.43),(s*.78,.20,2.07),'胸')
        bone(side+'腰叶',(s*.31,.10,1.55),(s*.48,.20,1.08),'骨盆')
    bpy.ops.object.mode_set(mode='OBJECT');RIG.show_in_front=True
    targets={}
    for s,side in [(-1,'左'),(1,'右')]:
        for label,pos in [('脚',(s*.48,-.04,.16)),('手',(s*1.06,-.06,1.53)),('膝',(s*.48,-2,.70)),('肘',(s*1.15,1.6,2.2))]:
            ob=bpy.data.objects.new(side+label+'·控制器',None);bpy.context.collection.objects.link(ob)
            ob.location=pos;ob.empty_display_type='SPHERE';ob.empty_display_size=.07
            targets[side+label]=ob
        for driven,target,pole in [(side+'小腿',side+'脚',side+'膝'),(side+'前臂',side+'手',side+'肘')]:
            c=RIG.pose.bones[driven].constraints.new('IK');c.name='双节关节求解';c.target=targets[target];c.chain_count=2;c.use_stretch=False
            c.pole_target=targets[pole];c.pole_angle=0
        for driven,target in [(side+'脚',side+'脚'),(side+'镰臂',side+'手')]:
            ob=targets[target];ob.rotation_mode='QUATERNION';ob.rotation_quaternion=data.bones[driven].matrix_local.to_quaternion()
            c=RIG.pose.bones[driven].constraints.new('COPY_ROTATION');c.name='稳定末端朝向';c.target=ob;c.target_space='WORLD';c.owner_space='WORLD'
    return targets


def create_model():
    # 树干由真实体积的缠绕木束组成，风核前方保留可见空腔。
    for i in range(9):
        angle=2*math.pi*i/9
        points=[]
        for j in range(6):
            t=j/5;a=angle+.75*t;z=1.24+t*1.24
            rx=.30+.18*math.sin(math.pi*t);ry=.21+.11*math.sin(math.pi*t)
            points.append((math.cos(a)*rx,math.sin(a)*ry+.075,z))
        tube('盘绕树干',points,[.115,.13,.105,.09,.08,.07],BARK,weights=lambda t:blend_weights('腰','胸',t,.43))
    for s,side in [(-1,'左'),(1,'右')]:
        sphere('肩部树瘤',(s*.55,0,2.38),(.18,.18,.18),BARK,'胸')
        tube('肩胸连接',[(0,.03,2.35),(s*.3,.04,2.43),(s*.60,0,2.39)],[.17,.19,.16],BARK,'胸')
        arm=[(s*.57,0,2.39),(s*.72,.02,2.20),(s*.87,.02,1.97),(s*.96,-.02,1.74),(s*1.06,-.06,1.53)]
        tube('臂部主木束',arm,[.16,.15,.12,.135,.12],BARK,weights=lambda t,side=side:blend_weights(side+'上臂',side+'前臂',t),sides=12)
        for k in range(3):
            pts=[(x+math.sin(j*.9+k*2)*.07,y-.07+math.cos(j*.9+k*2)*.04,z) for j,(x,y,z) in enumerate(arm)]
            tube('臂部纤维',pts,[.045,.04,.033,.036,.027],WOODLIGHT,weights=lambda t,side=side:blend_weights(side+'上臂',side+'前臂',t),sides=6)
        sphere('肘部树结',(s*.87,.02,1.97),(.15,.15,.15),BARK,side+'前臂')
        leg=[(s*.31,0,1.3),(s*.40,.035,1.05),(s*.48,-.04,.70),(s*.46,.015,.43),(s*.48,-.04,.16)]
        tube('腿部主木束',leg,[.20,.185,.13,.12,.14],BARK,weights=lambda t,side=side:blend_weights(side+'大腿',side+'小腿',t),sides=12)
        for k in range(3):
            pts=[(x+.07*math.sin(j+k*2),y-.085+.025*math.cos(j+k),z) for j,(x,y,z) in enumerate(leg)]
            tube('腿部外纤维',pts,[.055,.05,.045,.033,.028],WOODLIGHT,weights=lambda t,side=side:blend_weights(side+'大腿',side+'小腿',t),sides=6)
        sphere('膝部树结',(s*.48,-.06,.70),(.14,.16,.145),BARK,side+'小腿')
        for k in range(4):
            spread=(k-1.5)*.15
            tube('接地根趾',[(s*.48,-.04,.17),(s*.48+spread*.6,-.22,.095),(s*.48+spread,-.42-abs(spread)*.15,.045),(s*.48+spread*1.2,-.50,.045)],[.078,.065,.034,.008],BARK,side+'脚',sides=8)
        tube('后撑根',[(s*.48,-.04,.16),(s*.55,.14,.085),(s*.64,.25,.045)],[.085,.055,.012],BARK,side+'脚')
        # 镰刃是带厚度和刃脊的实体网格，保持树镰识别点。
        centers=path_samples([(s*1.06,-.09,1.56),(s*1.36,-.10,1.49),(s*1.52,-.14,1.19),(s*1.48,-.20,.88),(s*1.19,-.28,.62),(s*.89,-.33,.58)],5)
        vs=[];fs=[];mi=[]
        for i,p in enumerate(centers):
            t=i/(len(centers)-1);tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
            across=Vector((-tangent.z,0,tangent.x)).normalized()
            width=(.055+.14*math.sin(math.pi*t))*(1-t**6)
            vs.extend([p-across*width,p+Vector((0,-.052,0)),p+across*width,p+Vector((0,.044,0))])
            if i:
                for k in range(4):
                    a=(i-1)*4+k;b=(i-1)*4+(k+1)%4;c=i*4+(k+1)%4;d=i*4+k
                    fs.append((a,b,c,d));mi.append(k)
        mesh('象牙色树镰',vs,fs,[IVORY,GOLD,IVORYEDGE,WOODLIGHT],side+'镰臂',indices=mi)
        edge=[]
        for i,p in enumerate(centers):
            t=i/(len(centers)-1);tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
            across=Vector((-tangent.z,0,tangent.x)).normalized();width=(.055+.14*math.sin(math.pi*t))*(1-t**6)
            edge.append(p-across*width+Vector((0,-.006,0)))
        tube('镰刃细缘',edge,[.008]*(len(edge)-1)+[.001],GOLD,side+'镰臂',sides=5,steps=1)
        tube('树镰背脊',[(s*1.06,-.015,1.55),(s*1.38,-.02,1.43),(s*1.54,-.05,1.13),(s*1.43,-.12,.82)],[.13,.095,.067,.012],BARK,side+'镰臂')
        for j in range(3):
            leaf('前臂叶', (s*(1.02+j*.03),.02,1.80-j*.12),(s*(1.38+j*.025),-.02,1.63-j*.18),.105,side+'前臂',j+2)
        for row in range(3):
            for j in range(8):
                a=-.8+j*.34
                start=Vector((s*(.36+row*.06),.08+math.sin(a)*.12,2.43-row*.11))
                end=start+Vector((s*(.25+.16*math.cos(a)),.12+math.sin(a)*.20,-.28-row*.035-random.random()*.12))
                leaf('披肩羽叶',start,end,.13+random.random()*.04,side+'肩叶',(j+row)%5)
        for row in range(3):
            for j in range(5):
                start=(s*(.32+j*.07),-.13-row*.025,2.47-row*.15)
                end=(s*(.54+j*.10),-.24-row*.045,2.12-row*.17-random.random()*.06)
                leaf('肩前覆叶',start,end,.10+random.random()*.045,side+'肩叶',(j+row+1)%5)
        for j in range(5):
            leaf('胸侧覆叶',(s*.34,-.17,2.22-j*.14),(s*(.56+j*.014),-.27,1.83-j*.13),.10,side+'腰叶' if j>2 else '胸',j)
        for row in range(2):
            for j in range(5):
                a=-.5+j*.45
                start=(s*(.28+row*.05),.08+math.sin(a)*.13,1.60-row*.16)
                end=(s*(.48+row*.13),.16+math.sin(a)*.25,1.13-row*.16)
                leaf('腰部垂叶',start,end,.12,side+'腰叶',j+1)
        for j in range(4):
            leaf('前侧根叶',(s*(.29+j*.07),-.13,1.52),(s*(.43+j*.09),-.23,1.01-j*.04),.10,side+'腰叶',j+1)
    # 胸口木框与内嵌风核。
    for i in range(2):
        pts=[]
        for j in range(25):
            a=j/24*math.tau
            pts.append((math.sin(a)*(.30+i*.038),-.295-.035*math.cos(a*2),1.96+math.cos(a)*(.35+i*.035)))
        tube('风核木框',pts,[.035]*len(pts),WOODLIGHT,'胸',sides=7,steps=2)
    sphere('翠绿风核',(0,-.30,1.96),(.255,.13,.30),CORE,'胸',3)
    for offset in [0,math.pi]:
        pts=[]
        for i in range(45):
            t=i/44;a=offset+t*math.pi*2.15;r=.205*(1-t)+.02
            pts.append((r*math.cos(a),-.44-.012*math.sin(t*math.pi),1.96+r*math.sin(a)))
        tube('风核旋纹',pts,[.014]*(len(pts)-1)+[.003],CORELIGHT,'胸',sides=6,steps=1)
    tube('颈部树束',[(0,.02,2.37),(0,.005,2.61),(0,.025,2.94)],[.19,.15,.16],BARK,'头',sides=12)
    # 面具使用有折面的木质骨白壳，眼窝与鼻梁保持原有轮廓。
    outline=[(-.26,3.05),(-.17,3.25),(0,3.13),(.17,3.25),(.26,3.05),(.20,2.83),(.08,2.64),(0,2.54),(-.08,2.64),(-.20,2.83)]
    vs=[(x,-.21+.10*abs(x)/.26,z) for x,z in outline]+[(0,-.33,2.97),(0,-.28,2.73)]
    fs=[]
    for i in range(len(outline)):fs.append((i,(i+1)%len(outline),10 if i<5 or i>8 else 11))
    fs.extend([(4,5,11,10),(8,9,10,11)])
    mesh('树灵面具',vs,fs,[IVORY,IVORYEDGE,GOLD],'头',indices=[0,1,0,0,1,0,0,1,0,0,0,0])
    for s in [-1,1]:
        eye=[(s*.065,-.318,2.99),(s*.18,-.238,3.03),(s*.135,-.277,2.88),(s*.078,-.319,2.91)]
        mesh('深色眼窝',eye,[(0,1,2,3)],[DARK],'头')
        tube('微光眼瞳',[(s*.10,-.328,2.972),(s*.115,-.307,2.935)],[.012,.008],CORELIGHT,'头',sides=5)
        tube('面具刻纹',[(s*.14,-.259,3.15),(s*.075,-.316,3.04),(s*.047,-.324,2.91),(s*.028,-.299,2.77)],[.006,.005,.004,.001],GOLD,'头',sides=4)
        main=[(s*.12,.05,3.04),(s*.27,.03,3.25),(s*.32,.02,3.46),(s*.46,-.02,3.61)]
        tube('鹿枝主冠',main,[.065,.055,.035,.008],WOODLIGHT,'头',sides=9)
        tube('鹿枝侧冠',[(s*.27,.03,3.25),(s*.48,.04,3.34),(s*.57,-.01,3.49)],[.04,.026,.004],WOODLIGHT,'头')
        tube('树冠分叉',[(s*.32,.02,3.46),(s*.23,.01,3.53),(s*.19,.01,3.65)],[.026,.018,.003],WOODLIGHT,'头')
        for j in range(5):
            leaf('头冠叶',(s*.12,.10,2.93-j*.03),(s*(.38+j*.045),.13,3.17-j*.10),.09,'头',j)
    # 合并网格保留骨骼权重，降低渲染提交成本并方便继续雕刻。
    bpy.ops.object.select_all(action='DESELECT')
    for ob in PARTS:ob.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0];bpy.ops.object.join()
    model=bpy.context.object;model.name='缚枝祭主·完整蒙皮模型'
    model.parent=RIG;model.matrix_parent_inverse=Matrix.Identity(4)
    model['说明']='实体树束、双镰、面具、风核与分层枝叶；带骨骼蒙皮，可继续编辑。'
    return model


def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)


def sample(keys,t):
    if t<=keys[0][0]:return Vector(keys[0][1])
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if t<=b:return Vector(x).lerp(Vector(y),ease((t-a)/(b-a)))
    return Vector(keys[-1][1])


def animate(targets):
    # 两个正式命中时刻分别为 2.150 秒和 3.480 秒，前摇与收招读取基线。
    # 肘部极向由肩腕轴的法向构造，确保挥击过程中始终不与肩腕共线。
    right=[(0,(1.06,-.06,1.53)),(.6,(1.04,-.10,1.56)),(1.4,(1.02,-.02,1.66)),(1.95,(1.08,.18,2.54)),(2.05,(1.16,-.38,2.57)),(2.15,(.50,-.70,2.26)),(2.30,(.04,-.66,1.88)),(2.57,(.15,-.58,1.73)),(2.73,(.33,-.45,1.69)),(3.28,(.82,-.10,1.64)),(3.68,(1.00,-.20,1.61)),(3.90,(1.04,-.14,1.54)),(5.3,(1.06,-.06,1.53)),(6,(1.06,-.06,1.53))]
    left=[(0,(-1.06,-.06,1.53)),(.6,(-1.04,-.10,1.56)),(1.4,(-.94,-.13,1.70)),(1.95,(-.93,-.20,1.86)),(2.30,(-.97,-.10,2.03)),(2.57,(-1.00,.04,2.22)),(2.73,(-1.01,.08,2.38)),(3.28,(-1.05,.14,2.54)),(3.38,(-1.16,-.38,2.57)),(3.48,(-.50,-.71,2.27)),(3.63,(-.04,-.66,1.88)),(3.90,(-.22,-.55,1.70)),(4.50,(-.91,-.20,1.62)),(5.3,(-1.06,-.06,1.53)),(6,(-1.06,-.06,1.53))]
    body=[(0,(0,0,0)),(.6,(0,0,0)),(1.10,(0,-.22,-.025)),(1.40,(0,-.40,0)),(1.95,(-.05,-.35,-.035)),(2.25,(.06,-.48,-.075)),(2.73,(.01,-.44,-.035)),(3.28,(.055,-.39,-.025)),(3.60,(-.06,-.48,-.075)),(3.90,(0,-.45,-.045)),(4.60,(0,-.42,-.015)),(5.30,(0,-.40,0)),(6,(0,-.40,0))]
    twist=[(0,(0,0,0)),(.60,(0,0,0)),(1.12,(0,0,22)),(1.4,(0,0,8)),(1.95,(-3,0,-22)),(2.30,(10,-3,26)),(2.57,(5,-1,17)),(2.73,(0,0,12)),(3.28,(-3,0,23)),(3.63,(10,3,-26)),(3.90,(5,1,-12)),(4.6,(0,0,-3)),(5.3,(0,0,0)),(6,(0,0,0))]
    orient_r=[(0,(0,0,0)),(1.4,(0,0,-12)),(1.95,(-22,-35,-70)),(2.15,(15,-25,-16)),(2.30,(35,25,65)),(2.57,(15,20,55)),(2.73,(10,12,35)),(3.28,(0,0,6)),(3.9,(0,0,0)),(6,(0,0,0))]
    orient_l=[(0,(0,0,0)),(1.4,(0,0,8)),(2.30,(-8,5,18)),(2.73,(-15,30,53)),(3.28,(-22,35,70)),(3.48,(15,25,16)),(3.63,(35,-25,-65)),(3.90,(15,-20,-50)),(4.6,(0,0,-8)),(5.3,(0,0,0)),(6,(0,0,0))]
    bones=RIG.pose.bones
    for p in bones:p.rotation_mode='XYZ'
    records=[]
    for frame in range(1,361):
        bpy.context.scene.frame_set(frame)
        t=(frame-1)/60;root=sample(body,t)
        root.z-=.085*ease((t-.6)/.8)
        RIG.location=root;RIG.keyframe_insert('location',frame=frame)
        angles=sample(twist,t)
        for name,factor in [('骨盆',.22),('腰',.40),('胸',.38)]:
            bones[name].rotation_euler=tuple(math.radians(a*factor) for a in angles)
            bones[name].keyframe_insert('rotation_euler',frame=frame)
        bones['头'].rotation_euler=(math.radians(-angles.x*.30),math.radians(1.3*math.sin(t*2)),math.radians(-angles.z*.36))
        bones['头'].keyframe_insert('rotation_euler',frame=frame)
        for side,keys,rotkeys in [('右',right,orient_r),('左',left,orient_l)]:
            target=targets[side+'手'];target.location=sample(keys,t)+Vector((0,root.y,root.z))
            base=RIG.data.bones[side+'镰臂'].matrix_local.to_quaternion()
            q=Euler(tuple(math.radians(a) for a in sample(rotkeys,t)),'XYZ').to_quaternion()
            target.rotation_quaternion=q@base
            target.keyframe_insert('location',frame=frame);target.keyframe_insert('rotation_quaternion',frame=frame)
            for limb,delay in [('肩叶',.075),('腰叶',.11)]:
                past=sample(twist,max(0,t-delay));s=-1 if side=='左' else 1
                bones[side+limb].rotation_euler=(math.radians((past.x-angles.x)*1.3+2*math.sin(t*2.2+s)),math.radians((past.z-angles.z)*.3),math.radians((past.z-angles.z)*.85))
                bones[side+limb].keyframe_insert('rotation_euler',frame=frame)
        # 左脚完成一次迈步，右脚作为固定支撑；落地后控制器位置不再漂移。
        u=ease((t-.65)/.65);lift=.20*math.sin(math.pi*u)
        targets['左脚'].location=(-.48-.10*u,-.04-.60*u,.16+lift)
        targets['右脚'].location=(.48,-.04,.16)
        for side in ['左','右']:
            ob=targets[side+'脚'];ob.keyframe_insert('location',frame=frame)
            base=RIG.data.bones[side+'脚'].matrix_local.to_quaternion()
            ob.rotation_quaternion=Euler((0,0,math.radians(-8*u if side=='左' else 0))).to_quaternion()@base
            ob.keyframe_insert('rotation_quaternion',frame=frame)
        bpy.context.view_layer.update()
        for s,side in [(-1,'左'),(1,'右')]:
            shoulder=RIG.matrix_world@bones[side+'上臂'].head
            direction=(targets[side+'手'].location-shoulder).normalized()
            lateral=Vector((0,0,1)).cross(direction)*s
            downward=Vector((0,0,-1))-direction*direction.dot(Vector((0,0,-1)))
            bend=(lateral.normalized()+downward*.35).normalized()
            pole=targets[side+'肘'];pole.location=shoulder+bend*2
            pole.keyframe_insert('location',frame=frame)
        records.append({'帧':frame,'时间':t,'阶段':'警戒' if t<.6 else '转身迈步' if t<1.4 else '第一镰蓄力' if t<2.15 else '第一镰出手' if t<2.35 else '借势换手' if t<2.73 else '第二镰蓄力' if t<3.48 else '第二镰出手' if t<3.68 else '收势' if t<3.9 else '风核暴露' if t<5.3 else '恢复'})
    (OUT/'source/timeline.json').write_text(json.dumps({'说明':'原版攻击时序不变；增加身体动作与迈步编排。','采样':records},ensure_ascii=False,indent=2))
    for action in bpy.data.actions:
        # 每帧存储真实骨骼姿态；线性段避免逐帧曲线过冲。
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:key.interpolation='LINEAR'
    return records


def camera(name,location,target,scale):
    data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
    ob.location=location;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=scale;data.lens=50;return ob


def setup_scene():
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
    scene.render.fps=60;scene.frame_start=1;scene.frame_end=360
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.compression=15
    scene.render.film_transparent=False
    scene.world.color=(.23,.26,.20)
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.36,.30,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    scene.view_settings.view_transform='AgX'
    if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=32
    ground=material('巢穴地面',(.16,.20,.13),.95)
    n=ground.node_tree.nodes;tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'public/assets/camp-nests/nest-ground-east.webp'))
    coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=2
    ground.node_tree.links.new(coord.outputs['UV'],mapping.inputs[0]);ground.node_tree.links.new(mapping.outputs[0],tex.inputs['Vector'])
    shade=n.new('ShaderNodeMixRGB');shade.blend_type='MULTIPLY';shade.inputs[0].default_value=1;shade.inputs[2].default_value=(.55,.62,.52,1)
    ground.node_tree.links.new(tex.outputs['Color'],shade.inputs[1]);ground.node_tree.links.new(shade.outputs[0],n.get('Principled BSDF').inputs['Base Color'])
    bpy.ops.mesh.primitive_plane_add(size=20);plane=bpy.context.object;plane.name='东侧巢穴·地面';plane.data.materials.append(ground)
    for name,location,power,color,size in [('主光',(-4,-5,8),1100,(1,.85,.62),5),('天光',(3,-1,6),750,(.63,.79,1),4),('轮廓光',(1,4,6),1500,(.90,1,.68),3)]:
        data=bpy.data.lights.new(name,'AREA');ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
        ob.location=location;data.energy=power;data.color=color;data.shape='DISK';data.size=size;ob.rotation_euler=(Vector((0,0,1.6))-ob.location).to_track_quat('-Z','Y').to_euler()
    main=camera('游戏视角',(0,-10,7.0),(0,-.2,1.65),7.8)
    camera('侧面检查',(10,-1.8,5.0),(0,-.2,1.65),7.8)
    scene.camera=main
    return scene


def create_baseline(camera_ob):
    previous=bpy.data.objects.get('原版动作·源码重建')
    if previous:
        old_mesh=previous.data;bpy.data.objects.remove(previous,do_unlink=True)
        if old_mesh.users==0:bpy.data.meshes.remove(old_mesh)
    data=json.loads((OUT/'source/baseline-motion.json').read_text())
    m=bpy.data.materials.new('原版二维纹理·直接源码采样');m.use_nodes=True
    nodes=m.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');mix=nodes.new('ShaderNodeMixShader');tr=nodes.new('ShaderNodeBsdfTransparent');em=nodes.new('ShaderNodeEmission');tex=nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(OUT/'source/baseline-idle.png'));tex.interpolation='Linear'
    links=m.node_tree.links;links.new(tex.outputs['Color'],em.inputs['Color']);links.new(tex.outputs['Alpha'],mix.inputs[0]);links.new(tr.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs[0])
    verts=[(0,0,0)]*441;faces=[]
    for r in range(20):
        for c in range(20):
            a=r*21+c;b=a+21;faces.extend([(a,b,a+1),(b,b+1,a+1)])
    ob=mesh('原版动作·源码重建',verts,faces,[m])
    uv=ob.data.uv_layers.new(name='原图坐标')
    for poly in ob.data.polygons:
        for loop in poly.loop_indices:
            i=ob.data.loops[loop].vertex_index;uv.data[loop].uv=(i%21/20,1-i//21/20)
    ob.hide_render=True;ob.hide_viewport=True
    basis=camera_ob.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0))
    # 依据新模型真实投影上下缘匹配尺寸，而非凭人物世界高度猜测。
    bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
    model=bpy.data.objects['缚枝祭主·完整蒙皮模型'];evaluated=model.evaluated_get(bpy.context.evaluated_depsgraph_get());model_mesh=evaluated.to_mesh()
    projected=[(evaluated.matrix_world@v.co).dot(up) for v in model_mesh.vertices]
    bottom,top=min(projected),max(projected);height=top-bottom;evaluated.to_mesh_clear()
    (OUT/'evidence/baseline-match.json').write_text(json.dumps({'说明':'新旧共用相机与地面，旧版按新模型第一帧投影上下缘匹配主体尺寸。','投影下缘':bottom,'投影上缘':top,'投影高度':height},ensure_ascii=False,indent=2))
    ob.shape_key_add(name='原版基形')
    for frame,item in enumerate(data['帧'],1):
        key=ob.shape_key_add(name='原版采样%03d'%frame)
        u=ease(((frame-1)/60-.6)/.8);origin=Vector((0,-.4*u,0))+up*bottom
        for v,(x,y) in zip(key.data,item['顶点']):v.co=origin+right*x*height+up*(-y)*height
        key.value=0;key.keyframe_insert('value',frame=max(0,frame-1));key.value=1;key.keyframe_insert('value',frame=frame);key.value=0;key.keyframe_insert('value',frame=frame+1)
    ob['说明']='当前正式源码的连续网格算法离线重建；非实战录屏。'
    return ob


def verify(targets,model):
    scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();worst={'脚部目标误差':0,'相邻脚步位移':0};last={};ranges=[]
    for f in range(1,361):
        scene.frame_set(f);bpy.context.view_layer.update()
        for side in ['左','右']:
            ankle=RIG.matrix_world@RIG.pose.bones[side+'脚'].head
            target=targets[side+'脚'].matrix_world.translation
            worst['脚部目标误差']=max(worst['脚部目标误差'],(ankle-target).length)
            if side in last:worst['相邻脚步位移']=max(worst['相邻脚步位移'],(ankle-last[side]).length)
            last[side]=ankle
        if f in [1,65,130,139,202,210,219,235,300,360]:
            evaluated=model.evaluated_get(deps);me=evaluated.to_mesh()
            coords=[evaluated.matrix_world@v.co for v in me.vertices]
            ranges.append({'帧':f,'最低高度':min(v.z for v in coords),'最高高度':max(v.z for v in coords),'最左':min(v.x for v in coords),'最右':max(v.x for v in coords)})
            evaluated.to_mesh_clear()
    report={'说明':'骨骼数值检查；穿插与自然度仍需关键帧和视频视觉验收。','骨骼数量':len(RIG.data.bones),'网格顶点':len(model.data.vertices),'网格面数':len(model.data.polygons),'测量':worst,'关键帧范围':ranges}
    (OUT/'evidence/rig-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))


def main():
    global BARK,WOODLIGHT,IVORY,IVORYEDGE,GOLD,CORE,CORELIGHT,DARK,LEAVES,VEIN,RIG
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser(description='缚枝祭主动作样片')
    parser.add_argument('--render',choices=['key','main','side','baseline','detail','none'],default='none')
    parser.add_argument('--start',type=int,default=1);parser.add_argument('--end',type=int,default=360)
    parser.add_argument('--load',action='store_true');parser.add_argument('--percent',type=int,default=100)
    options=parser.parse_args(args)
    for p in [OUT/'source',OUT/'evidence',CACHE]:p.mkdir(parents=True,exist_ok=True)
    (CACHE/'.gitignore').write_text('# 样片中间渲染帧与缓存不进入版本库。\n*\n')
    blend=OUT/'source/east-boss-motion.blend'
    if options.load:
        bpy.ops.wm.open_mainfile(filepath=str(blend));scene=bpy.context.scene
    else:
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        BARK=bark_material();WOODLIGHT=material('木束·金褐脊线',(.32,.17,.06));IVORY=material('面具与镰刃·骨白',(.79,.68,.43),.4);IVORYEDGE=material('刀刃·浅骨白',(.95,.87,.64),.32);GOLD=material('树脂·暖金',(.48,.28,.07),.38,.22)
        CORE=material('风核·深翠',(.12,.47,.25),.24,.1,.2);CORELIGHT=material('风核·旋纹',(.65,1,.32),.3,0,.8);DARK=material('眼窝·深墨',(.012,.027,.017));VEIN=material('叶脉·浅金绿',(.27,.32,.095))
        LEAVES=[material('叶片·'+str(i),c,.75) for i,c in enumerate([(.025,.070,.038),(.055,.13,.055),(.13,.18,.06),(.035,.095,.057),(.17,.20,.07)])]
        targets=create_rig();model=create_model();scene=setup_scene();animate(targets);verify(targets,model);create_baseline(scene.camera)
        scene.frame_set(1)
        for ob in bpy.context.selected_objects:ob.select_set(False)
        model.select_set(True);bpy.context.view_layer.objects.active=model
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    area.spaces.active.shading.type='MATERIAL'
                    area.spaces.active.shading.use_scene_world=True
                    area.spaces.active.shading.use_scene_lights=True
                    area.spaces.active.overlay.show_overlays=False
                    area.spaces.active.region_3d.view_perspective='CAMERA'
        text=bpy.data.texts.new('样片说明');text.write('缚枝祭主六秒动作样片。时间轴一至三百六十帧，每秒六十帧。主镜头为游戏视角，另有侧面检查镜头。脚与手控制器可编辑，骨骼已逐帧烘焙。原版对照来自当前游戏源码采样。尚未接入正式游戏。')
        bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    scene.render.resolution_percentage=options.percent
    mode=options.render
    if mode=='none':return
    scene.camera=bpy.data.objects['侧面检查' if mode=='side' else '游戏视角']
    baseline=bpy.data.objects['原版动作·源码重建'];model=bpy.data.objects['缚枝祭主·完整蒙皮模型']
    baseline.hide_render=mode!='baseline'
    model.hide_render=mode=='baseline'
    if mode=='detail':
        scene.render.resolution_x=2048;scene.render.resolution_y=2048;scene.camera.data.ortho_scale=4.8
        bpy.data.objects['东侧巢穴·地面'].hide_render=True;scene.render.film_transparent=True
        scene.frame_set(85);scene.render.filepath=str(OUT/'evidence/east-boss-detail.png');bpy.ops.render.render(write_still=True)
    elif mode=='key':
        for f in [1,65,120,139,164,202,219,240]:
            scene.frame_set(f);scene.render.filepath=str(CACHE/f'key-{f:03d}.png');bpy.ops.render.render(write_still=True)
    else:
        folder=CACHE/mode;folder.mkdir(exist_ok=True)
        for f in range(options.start,options.end+1):
            scene.frame_set(f);scene.render.filepath=str(folder/f'{f:04d}.png');bpy.ops.render.render(write_still=True)


if __name__=='__main__':main()
