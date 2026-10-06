"""制作寂冠之王：分层实体甲片、袍片骨链与可烘焙黑焰；禁止覆盖后续手工工程。"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/demon-king-model-v1'
SOURCE = OUT / 'source'
random.seed(206)
RIG = None
PARTS = []
COL = {}
M = {}
BONES = {}
FPS = 30
END = 181


def material(name, color, texture=None, roughness=.9, metal=0, emission=0):
    mat = bpy.data.materials.new(name); mat.use_nodes = True; mat.diffuse_color = (*color, 1)
    n, links = mat.node_tree.nodes, mat.node_tree.links
    p = next(n for n in n if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    p.inputs['Specular IOR Level'].default_value = .18
    if texture:
        t = n.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(str(SOURCE / 'textures' / texture), check_existing=True)
        links.new(t.outputs['Color'], p.inputs['Base Color'])
        bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .07; bump.inputs['Distance'].default_value = .008
        links.new(t.outputs['Color'], bump.inputs['Height']); links.new(bump.outputs['Normal'], p.inputs['Normal'])
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1); p.inputs['Emission Strength'].default_value = emission
    return mat


def move_collection(ob, category):
    for c in list(ob.users_collection): c.objects.unlink(ob)
    COL[category].objects.link(ob)


def bind(ob, weights):
    for i in range(len(ob.data.vertices)):
        values = weights(i) if callable(weights) else {weights: 1.0}
        for b, w in values.items():
            if w > 0:
                g = ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b); g.add([i], w, 'REPLACE')
    mod = ob.modifiers.new('骨骼绑定', 'ARMATURE'); mod.object = RIG
    ob.parent = RIG; ob.matrix_parent_inverse = Matrix.Identity(4)
    ob['刚性'] = isinstance(weights, str)
    PARTS.append(ob)


def mesh(name, vertices, faces, mat, weights, category='硬甲', smooth=False, uv=None):
    data = bpy.data.meshes.new(name); data.from_pydata(vertices, [], faces); data.update()
    ob = bpy.data.objects.new(name, data); COL[category].objects.link(ob); data.materials.append(mat)
    coords = [Vector(v) for v in vertices]
    layer = data.uv_layers.new(name='手绘坐标')
    lo = Vector(tuple(min(v[k] for v in coords) for k in range(3)))
    hi = Vector(tuple(max(v[k] for v in coords) for k in range(3)))
    for poly in data.polygons:
        poly.use_smooth = smooth
        for li in poly.loop_indices:
            vi = data.loops[li].vertex_index; v = coords[vi]
            layer.data[li].uv = uv[vi] if uv else ((v.x-lo.x)/max(.01,hi.x-lo.x), (v.z-lo.z)/max(.01,hi.z-lo.z))
    if weights: bind(ob, weights)
    return ob


def bevel(ob, width=.014):
    mod = ob.modifiers.new('实体倒角', 'BEVEL'); mod.width = width; mod.segments = 2
    return ob


def tube(name, points, radii, mat, bone, category='硬甲', sides=10):
    centers = [Vector(p) for p in points]; vertices=[]; faces=[]; uv=[]
    for i, c in enumerate(centers):
        tangent=(centers[min(len(centers)-1,i+1)]-centers[max(0,i-1)]).normalized()
        ref=Vector((0,1,0)) if abs(tangent.y)<.85 else Vector((1,0,0))
        axis=tangent.cross(ref).normalized(); normal=tangent.cross(axis).normalized()
        r=radii[i] if isinstance(radii,list) else radii
        for k in range(sides):
            a=k/sides*math.tau
            vertices.append(c+r*(axis*math.cos(a)+normal*math.sin(a))); uv.append((k/sides,i/max(1,len(centers)-1)))
            if i:
                j=(i-1)*sides+k; faces.append((j,(i-1)*sides+(k+1)%sides,i*sides+(k+1)%sides,i*sides+k))
    faces.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+k for k in range(sides))])
    return mesh(name,vertices,faces,mat,bone,category,True,uv)


def ellipsoid(name, center, scale, mat, bone, category='身体', segments=24, rings=16):
    verts=[]; faces=[]; uv=[]
    for j in range(rings+1):
        a=.001+(math.pi-.002)*j/rings
        for k in range(segments):
            b=math.tau*k/segments
            verts.append((center[0]+scale[0]*math.sin(a)*math.cos(b),center[1]+scale[1]*math.sin(a)*math.sin(b),center[2]+scale[2]*math.cos(a)))
            uv.append((k/segments,j/rings))
            if j:
                q=(j-1)*segments+k;faces.append((q,(j-1)*segments+(k+1)%segments,j*segments+(k+1)%segments,j*segments+k))
    return mesh(name,verts,faces,mat,bone,category,True,uv)


def plate(name, outline, y, mat, bone, thickness=.07, ridge=.05, bronze=False, category='硬甲'):
    # 前后实体壳与中心棱面；甲片通过叠压形成轮廓，避免贴片假厚度。
    n=len(outline); cx=sum(p[0] for p in outline)/n; cz=sum(p[1] for p in outline)/n
    verts=[(x,y,z) for x,z in outline]+[(x,y+thickness,z) for x,z in outline]+[(cx,y-ridge,cz)]
    faces=[(n*2,i,(i+1)%n) for i in range(n)]+[tuple(reversed(range(n,n*2)))]
    faces.extend((i,n+i,n+(i+1)%n,(i+1)%n) for i in range(n))
    ob=bevel(mesh(name,verts,faces,mat,bone,category),.009)
    if bronze:
        tube(name+'·古铜镶边',[(x,y-.01,z) for x,z in outline]+[(outline[0][0],y-.01,outline[0][1])],.008,M['铜'],bone,category,6)
    if mat==M['石'] and category=='硬甲' and '指' not in name:
        # 裂纹嵌在甲片棱面上，路径沿边到中心，不用材质噪点冒充实体裂口。
        index=random.randrange(n);a=Vector((outline[index][0],y,outline[index][1]));b=Vector((outline[(index+1)%n][0],y,outline[(index+1)%n][1]));c=Vector((cx,y-ridge,cz))
        start=a.lerp(b,.35);middle=start.lerp(c,.52);tip=start.lerp(c,.87)
        for p in [start,middle,tip]:p.y-=.004
        tube(name+'·风蚀裂纹',[start,middle,tip],[.0035,.004,.001],M['裂缝'],bone,category,5)
    return ob


def ring(name, center, rx, rz, mat, bone, category='硬甲', radius=.018):
    points=[(center[0]+rx*math.cos(i/40*math.tau),center[1],center[2]+rz*math.sin(i/40*math.tau)) for i in range(41)]
    return tube(name,points,radius,mat,bone,category,8)


def add_bone(name, head, tail, parent=None):
    b=RIG.data.edit_bones.new(name); b.head=head; b.tail=tail
    if parent:b.parent=RIG.data.edit_bones[parent]
    BONES[name]=(head,tail)


def create_rig():
    global RIG
    data=bpy.data.armatures.new('寂冠之王骨架');RIG=bpy.data.objects.new('寂冠之王·基础绑定',data);COL['控制'].objects.link(RIG)
    bpy.context.view_layer.objects.active=RIG;RIG.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    add_bone('地面根',(0,0,0),(0,0,.3))
    add_bone('悬浮',(0,0,.3),(0,0,.6),'地面根')
    add_bone('骨盆',(0,0,2.05),(0,0,2.4),'悬浮')
    add_bone('腰',(0,0,2.4),(0,0,2.93),'骨盆')
    add_bone('胸',(0,0,2.93),(0,0,3.68),'腰')
    add_bone('头',(0,0,3.68),(0,0,4.42),'胸')
    add_bone('悬冠',(0,0,4.53),(0,0,5.15),'头')
    for sign,side in [(-1,'右'),(1,'左')]:
        add_bone(side+'肩',(sign*.32,0,3.60),(sign*.78,0,3.53),'胸')
        add_bone(side+'上臂',(sign*.78,0,3.53),(sign*.99,-.025,2.91),side+'肩')
        wrist=(sign*(1.02 if side=='右' else .97),-.65 if side=='右' else -.36,2.46 if side=='右' else 2.36)
        add_bone(side+'前臂',(sign*.99,-.025,2.91),wrist,side+'上臂')
        add_bone(side+'手',wrist,(wrist[0],wrist[1],wrist[2]-.23),side+'前臂')
        add_bone(side+'大腿',(sign*.30,0,2.09),(sign*.41,0,1.20),'骨盆')
        add_bone(side+'小腿',(sign*.41,0,1.20),(sign*.46,0,.30),side+'大腿')
        add_bone(side+'脚',(sign*.46,0,.30),(sign*.46,-.42,.12),side+'小腿')
    add_bone('王剑',(-1.02,-.65,2.42),(-1.02,-.65,.12),'右手')
    for i in range(11):
        x=-1.0+i*.2
        category='前袍' if i<3 else '披袍'
        # 骨链专用控制，无需物理缓存；关节从腰以下连续。
        for j,(z0,z1) in enumerate([(2.45,1.78),(1.78,1.08),(1.08,.38)]):
            y=-.43 if i<3 else .4
            px=[-.54,0,.54][i] if i<3 else math.sin((i-3)/7*4.3-2.15)*1.0
            add_bone(category+str(i)+'·'+str(j),(px,y,z0),(px,y,z1),'骨盆' if j==0 else category+str(i)+'·'+str(j-1))
    bpy.ops.object.mode_set(mode='OBJECT');RIG.show_in_front=True;RIG.display_type='WIRE'
    RIG['说明']='地面根保持固定；悬浮、悬冠、王剑与袍链分别控制。待机是一百八十帧循环，第一百八十一帧仅用于接缝检查。'


def chain_weights(index, t):
    prefix=('前袍' if index<3 else '披袍')+str(index)+'·'
    q=max(0,min(2,t*3-.35));a=int(q);b=min(2,a+1);f=q-a
    return {prefix+str(a):1-f,prefix+str(b):f} if a!=b else {prefix+str(a):1}


def build_body():
    ellipsoid('内衬躯干',(0,.03,2.98),(.53,.30,.78),M['布'],'胸')
    ellipsoid('腰腹内衬',(0,.02,2.48),(.37,.24,.48),M['布'],'腰')
    ellipsoid('骨盆内衬',(0,.05,2.1),(.40,.25,.28),M['布'],'骨盆')
    ellipsoid('无面·封闭空相',(0,-.015,4.075),(.235,.245,.365),M['空面'],'头')
    # 极细裂纹，没有眼孔、鼻梁和嘴；红纹沿空面贴合，不改头部轮廓。
    tube('无面·细红裂隙',[(0,-.253,4.31),(.012,-.262,4.20),(.004,-.262,4.08),(.016,-.245,3.95)], [.002,.0045,.003,.001],M['暗红'],'头','身体',6)
    for s,side in [(-1,'右'),(1,'左')]:
        for bone in ['上臂','前臂','大腿','小腿']:
            head,tail=BONES[side+bone]
            radius={'上臂':.16,'前臂':.13,'大腿':.20,'小腿':.13}[bone]
            tube(side+bone+'·连续内衬',[head,Vector(head).lerp(Vector(tail),.5),tail],[radius*.9,radius,radius*.75],M['布'],side+bone,'身体',16)
        x=s*.46
        ellipsoid(side+'靴·底层',(x,-.16,.22),(.20,.36,.15),M['石'],side+'脚','身体')
        plate(side+'靴·尖面',[(x-.20,.26),(x-.18,.10),(x+.17,.09),(x+.22,.28),(x,.41)],-.44,M['石'],side+'脚',.25,.05,True)


def build_armor():
    # 胸口 V 形硬甲分左右叠压，留出裂晶纵向开口。
    for s,side in [(-1,'右'),(1,'左')]:
        p=lambda a:[(s*x,z) for x,z in a]
        plate(side+'锁骨高领',p([(.03,3.68),(.13,3.99),(.39,3.74),(.57,3.57),(.28,3.47)]),-.20,M['石'],'胸',.13,.08,True)
        plate(side+'胸甲·上',p([(.12,3.58),(.48,3.66),(.69,3.48),(.45,3.30),(.19,3.35)]),-.33,M['石'],'胸',.09,.07,True)
        plate(side+'胸甲·中',p([(.18,3.32),(.48,3.41),(.55,3.13),(.35,2.97),(.13,3.10)]),-.36,M['石'],'胸',.09,.07)
        plate(side+'胸甲·下',p([(.12,3.10),(.35,3.04),(.42,2.84),(.20,2.72),(.07,2.91)]),-.33,M['石'],'胸',.07,.06,True)
        plate(side+'腰甲·鱼鳞上',p([(.06,2.85),(.40,2.80),(.43,2.59),(.19,2.50),(.02,2.64)]),-.32,M['石'],'腰',.08,.05,True)
        plate(side+'腰甲·鱼鳞下',p([(.02,2.64),(.39,2.60),(.41,2.38),(.18,2.30),(.03,2.46)]),-.34,M['石'],'腰',.08,.05,True)
        for j in range(3):
            z=3.81-j*.18
            plate(side+'肩甲·'+str(j),p([(.44+j*.06,z-.03),(.69+j*.08,z+.07),(1.02+j*.035,z-.09),(1.08+j*.03,z-.32),(.73+j*.04,z-.25)]),-.07-j*.08,M['石'],side+'肩',.18,.11,True)
        plate(side+'肩披·外刃',p([(.82,3.52),(1.11,3.34),(1.20,3.07),(.91,3.19)]),-.19,M['石'],side+'上臂',.12,.04,True)
        for j in range(3):
            z=3.30-j*.16
            plate(side+'上臂叠甲'+str(j),p([(.89,z+.1),(1.10,z+.07),(1.15,z-.12),(.96,z-.18)]),-.15,M['石'],side+'上臂',.13,.04,True)
        for j in range(3):
            z=2.86-j*.13
            yy=-.21-j*(.18 if side=='右' else .09)
            plate(side+'护腕叠甲'+str(j),p([(.87,z+.10),(1.09,z+.06),(1.12,z-.11),(.98,z-.18),(.85,z-.05)]),yy,M['石'],side+'前臂',.14,.05,True)
        plate(side+'髋侧护片',p([(.24,2.45),(.50,2.48),(.63,2.13),(.43,1.92),(.24,2.15)]),-.12,M['石'],'骨盆',.16,.04,True)
        for j in range(3):
            z=2.49-j*.18
            plate(side+'腰侧垂甲'+str(j),p([(.26,z+.08),(.48,z+.12),(.59,z-.10),(.43,z-.30),(.28,z-.20)]),-.51-j*.009,M['石'],'前袍'+('0' if side=='右' else '2')+'·0',.055,.045,True)
        for j in range(3):
            z=1.12-j*.24;x=s*.45
            plate(side+'胫甲'+str(j),[(x-.12,z+.17),(x+.13,z+.17),(x+.15,z-.06),(x,z-.18),(x-.14,z-.06)],-.14,M['石'],side+'小腿',.15,.07,True)
        # 肩部圆扣、古铜带和垂落封印。
        ring(side+'肩扣',(s*.64,-.38,3.50),.105,.135,M['铜'],side+'肩',radius=.023)
        ring(side+'肩扣内环',(s*.64,-.40,3.50),.066,.088,M['石'],side+'肩',radius=.014)
        tube(side+'胸斜铜带',[(s*.56,-.41,3.58),(s*.47,-.46,3.33),(s*.40,-.45,3.01),(s*.36,-.39,2.81)],.024,M['铜'],'胸')
        tube(side+'垂链',[(s*.59,-.35,2.91),(s*.66,-.36,2.64),(s*.59,-.36,2.42)],.012,M['铜'],'腰',sides=6)
        for j in range(8):
            ring(side+'链扣'+str(j),(s*(.58+.04*math.sin(j*.6)),-.39,2.89-j*.052),.024,.035,M['铜'],'腰',radius=.006)
    # 背面沿用同源分层甲片，袍面从背肩连到下摆。
    for j in range(3):
        z=3.55-j*.27
        plate('背甲'+str(j),[(-.44,z),(-.36,z-.25),(0,z-.37),(.36,z-.25),(.44,z),(0,z+.10)],.30,M['石'],'胸',.10,-.04,True)
    plate('腰带中心徽记',[(-.24,2.51),(0,2.63),(.24,2.51),(0,2.28)],-.48,M['铜'],'腰',.065,.025)
    plate('腰带中心石嵌',[(-.15,2.50),(0,2.56),(.15,2.50),(0,2.37)],-.53,M['石'],'腰',.04,.015)
    # 分裂结晶：三个独立不规则体保留间隙，后方暗芯不透空。
    plate('胸晶·暗色容腔',[(-.20,3.46),(0,3.64),(.21,3.34),(.14,3.00),(0,2.90),(-.15,3.12)],-.42,M['空面'],'胸',.035,.01,category='身体')
    crystals=[ [(-.13,3.43),(-.035,3.55),(-.01,3.32),(-.12,3.24)],[(.015,3.51),(.15,3.33),(.05,3.20),(.015,3.31)],[(-.105,3.21),(.028,3.18),(.09,3.02),(0,2.96),(-.04,3.07)] ]
    for i,p in enumerate(crystals):plate('胸晶·碎片'+str(i),p,-.47,M['晶'],'胸',.05,.065,category='身体')
    tube('胸晶细裂光',[(-.016,-.545,3.51),(-.024,-.53,3.32),(.023,-.53,3.21),(-.017,-.52,3.08)],.004,M['暗红'],'胸','身体',6)


def build_hands_sword():
    for s,side in [(-1,'右'),(1,'左')]:
        head,tail=BONES[side+'手'];head=Vector(head);tail=Vector(tail)
        ellipsoid(side+'掌甲',head.lerp(tail,.40),(.14,.105,.16),M['石'],side+'手','硬甲',16,10)
        for j in range(4):
            x=head.x+(j-1.5)*.055
            if side=='右':
                points=[(x,head.y-.075,head.z-.10),(x,head.y-.13,head.z-.17),(x,head.y-.07,head.z-.21)]
            else:
                points=[(x,head.y-.05,head.z-.12),(x+s*.025,head.y-.07,head.z-.25),(x+s*.02,head.y-.025,head.z-.34)]
            tube(side+'覆甲指'+str(j),points,[.032,.029,.018],M['石'],side+'手',sides=8)
            for k in [0,1]:ellipsoid(side+'指节'+str(j)+'·'+str(k),points[k],(.034,.040,.035),M['铜'],side+'手','硬甲',10,6)
        tube(side+'拇指',[(head.x+s*.13,head.y,head.z-.01),(head.x+s*.18,head.y-.07,head.z-.12),(head.x+s*.09,head.y-.13,head.z-.18)],[.042,.035,.023],M['石'],side+'手')
    x=-1.02;y=-.65
    tube('王剑·握柄',[(x,y,2.29),(x,y,2.69)],.048,M['铜'],'王剑','王剑',12)
    for j in range(7):ring('王剑·柄箍'+str(j),(x,y-.045,2.32+j*.05),.048,.017,M['石'],'王剑','王剑',.008)
    ellipsoid('王剑·柄首',(x,y,2.73),(.075,.070,.09),M['铜'],'王剑','王剑',12,8)
    plate('王剑·护手',[(x-.27,2.30),(x-.18,2.38),(x-.08,2.39),(x,2.48),(x+.08,2.39),(x+.19,2.37),(x+.25,2.29),(x+.09,2.28),(x,2.19),(x-.09,2.28)],y-.07,M['铜'],'王剑',.14,.025,category='王剑')
    ring('王剑·护手环',(x,y-.12,2.33),.072,.081,M['石'],'王剑','王剑',.019)
    # 有厚度的缺刃，刃口缺口由实际轮廓产生。
    outline=[(x-.077,2.24),(x-.097,1.91),(x-.075,1.68),(x-.084,1.40),(x-.063,1.16),(x-.075,.81),(x-.038,.35),(x,.09),(x+.043,.39),(x+.064,.77),(x+.082,.97),(x+.050,1.02),(x+.084,1.07),(x+.10,1.53),(x+.069,1.60),(x+.10,1.65),(x+.085,2.24)]
    plate('王剑·缺刃实体',outline,y-.029,M['石'],'王剑',.06,.018,category='王剑')
    tube('王剑·细红裂隙',[(x-.006,y-.054,2.19),(x+.014,y-.056,1.95),(x-.018,y-.058,1.69),(x+.023,y-.057,1.41),(x+.003,y-.05,1.18),(x+.014,y-.05,.91),(x-.008,y-.051,.57),(x,y-.05,.30)],[.004,.006,.005,.005,.004,.005,.003,.001],M['暗红'],'王剑','王剑',6)


def build_crown():
    # 冠环真实断开，七个独立不等高冠片；前方留缺口。
    points=[(.35*math.sin(a),.30*math.cos(a),4.56+.012*math.sin(a*3)) for a in [(-2.77+i*5.32/60) for i in range(61)]]
    tube('悬冠·断环',points,.036,M['铜'],'悬冠','王冠',8)
    angles=[-2.67,-1.86,-1.00,-.15,.64,1.48,2.35]
    heights=[.27,.42,.33,.60,.37,.29,.44]
    for i,(a,h) in enumerate(zip(angles,heights)):
        center=Vector((.35*math.sin(a),.30*math.cos(a),4.56)); tangent=Vector((math.cos(a),-math.sin(a),0)); normal=Vector((math.sin(a),math.cos(a),0))
        profile=[(-.06,0),(-.062,h*.64),(-.015,h),(.053,h*.86),(.062,.02)]
        verts=[]
        for depth in [-.028,.028]:
            for u,z in profile:verts.append(center+tangent*u+Vector((0,0,z))+normal*depth)
        faces=[tuple(reversed(range(5))),tuple(range(5,10))]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)]
        bevel(mesh('悬冠·第'+str(i+1)+'冠片',verts,faces,M['铜'] if i in [1,5] else M['石'],'悬冠','王冠'),.008)
        tube('悬冠·铜脊'+str(i),[center+tangent*(-.06)+normal*.035,center+tangent*(-.052)+Vector((0,0,h*.66))+normal*.035,center+tangent*(-.015)+Vector((0,0,h))+normal*.035],.011,M['铜'],'悬冠','王冠',6)


def cloth_panel(name, index, width, top, bottom, mat, center_x=0, y=-.40, rows=25, cols=16, seal=False):
    verts=[];faces=[];uv=[]
    for j in range(rows+1):
        t=j/rows
        for k in range(cols+1):
            u=k/cols*2-1
            w=width*(.65+.35*t);x=center_x*(1+.35*t)+u*w+.035*math.sin(t*5+index)*t
            hem=.035*math.sin(k*2.7)+(.15 if k%5==0 else 0)+.10*math.sin(u*4+index)**2
            z=top+(bottom-top)*t+hem*t**10+(.10*abs(u)-.07*(1-u*u))*(1-t)**4
            yy=y-.10*t+.048*math.cos(u*math.pi*3)*(1-.20*t)+.018*math.sin(t*7+u*2)
            verts.append((x,yy,z));uv.append((k/cols,t))
            if j and k:
                q=(j-1)*(cols+1)+k-1;faces.append((q,q+1,q+cols+2,q+cols+1))
    ob=mesh(name,verts,faces,mat,lambda i:chain_weights(index,(i//(cols+1))/rows),'布料',True,uv)
    mod=ob.modifiers.new('布料实体厚度','SOLIDIFY');mod.thickness=.010
    ob['布料控制']=index
    if seal:
        # 古封印纹样有几何厚度，使用同一袍链权重而非悬空刚性贴片。
        paths=[ [(-.11,2.18),(-.11,.84),(0,.68),(.11,.84),(.11,2.18)], [(-.13,1.06),(0,.91),(.13,1.06)], [(-.12,.80),(0,.65),(.12,.80)], [(-.10,1.96),(0,2.12),(.10,1.96)], [(0,2.20),(0,.80)] ]
        for idx,p in enumerate(paths):
            ob2=tube('中央封印·纹'+str(idx),[(x,y-.075-(2.42-z)*.045,z) for x,z in p],.011,M['铜'],'骨盆','布料',6)
            for g in list(ob2.vertex_groups):ob2.vertex_groups.remove(g)
            for vi,v in enumerate(ob2.data.vertices):
                for b,w in chain_weights(1,(top-v.co.z)/(top-bottom)).items():
                    (ob2.vertex_groups.get(b) or ob2.vertex_groups.new(name=b)).add([vi],w,'REPLACE')
            ob2['刚性']=False
        ob2=ring('中央封印·圆印',(0,y-.11,1.61),.082,.092,M['铜'],'骨盆','布料',.012)
        for g in list(ob2.vertex_groups):ob2.vertex_groups.remove(g)
        for vi,v in enumerate(ob2.data.vertices):
            for b,w in chain_weights(1,(top-v.co.z)/(top-bottom)).items():(ob2.vertex_groups.get(b) or ob2.vertex_groups.new(name=b)).add([vi],w,'REPLACE')
        ob2['刚性']=False
    return ob


def build_cloth():
    cloth_panel('前袍·右侧大布片',0,.35,2.43,.33,M['布'],-.44,-.38)
    cloth_panel('前袍·中央大布片',1,.31,2.42,.23,M['布'],0,-.40)
    cloth_panel('前袍·左侧大布片',2,.35,2.43,.31,M['布'],.44,-.38)
    cloth_panel('中央旧封印带',1,.20,2.40,.43,M['封印'],0,-.48,seal=True)
    # 披袍为八段连贯曲面，侧背包覆；只在下摆形成破损，而非整片裂缝。
    segments=8;rows=30;cols=16
    for seg in range(segments):
        verts=[];faces=[];uv=[]
        for j in range(rows+1):
            t=j/rows;radius=.81+.67*t;ry=.30+.33*t
            for k in range(cols+1):
                phi=-2.15+(seg+k/cols)/segments*4.30
                pleat=.022*math.cos(phi*17)*(t*.5+.5)
                x=math.sin(phi)*(radius+pleat);y=math.cos(phi)*(ry+pleat)+.17
                hem=.04+.18*(.5+.5*math.sin(phi*23))+.15*(.5+.5*math.sin(phi*39))
                z=3.63-3.30*t+hem*t**9-.13*abs(math.sin(phi))*(1-t)**4
                verts.append((x,y,z));uv.append(((seg+k/cols)/segments,t))
                if j and k:
                    q=(j-1)*(cols+1)+k-1;faces.append((q,q+1,q+cols+2,q+cols+1))
        def weights(i,seg=seg):
            z=verts[i].z if isinstance(verts[i],Vector) else verts[i][2]
            if z>2.5:return {'胸':1}
            # 相邻分件在共同边界使用完全相同的权重，防止动态裂缝。
            position=seg+(i%(cols+1))/cols-.5
            lo=max(0,min(7,int(math.floor(position))));hi=max(0,min(7,lo+1));f=max(0,min(1,position-lo))
            result={}
            for index,ratio in [(lo+3,1-f),(hi+3,f)]:
                for bone,w in chain_weights(index,(2.5-z)/2.1).items():result[bone]=result.get(bone,0)+w*ratio
            return result
        ob=mesh('披袍·侧背连续片'+str(seg),verts,faces,M['布'],weights,'布料',True,uv)
        mod=ob.modifiers.new('披袍实体厚度','SOLIDIFY');mod.thickness=.013
        ob['布料控制']=seg+3
    # 外侧披袍碎层呈斜向下落，打破直筒裙轮廓；每片与相邻底袍保持连续叠压。
    for sign,side in [(-1,'右'),(1,'左')]:
        for layer in range(5):
            verts=[];faces=[];uv=[];rows=22;cols=8
            top=3.49-layer*.22;bottom=.51+layer*.09
            for j in range(rows+1):
                t=j/rows
                for k in range(cols+1):
                    u=k/cols;spread=.13+.13*t
                    x=sign*(.65+layer*.025+.70*t+.17*math.sin(t*math.pi)+(u-.5)*spread)
                    y=-.21-layer*.014+.055*math.sin(u*math.pi*4)+.035*math.sin(t*4)
                    z=top+(bottom-top)*t+(.16*math.sin(u*11+layer)**2+.08*u)*t**7
                    verts.append((x,y,z));uv.append((u,t))
                    if j and k:
                        q=(j-1)*(cols+1)+k-1;faces.append((q,q+1,q+cols+2,q+cols+1))
            index=3 if sign<0 else 10
            def weights(i,index=index,top=top,bottom=bottom):
                z=verts[i][2]
                return {'胸':1} if z>2.5 else chain_weights(index,(2.5-z)/2.1)
            ob=mesh(side+'斜向破袍层'+str(layer),verts,faces,M['布'],weights,'布料',True,uv)
            mod=ob.modifiers.new('破袍实体厚度','SOLIDIFY');mod.thickness=.009
    for s,side in [(-1,'右'),(1,'左')]:
        cloth_panel(side+'肩部旧封印',0 if side=='右' else 2,.072,3.48,2.41,M['封印'],s*.68,-.36,rows=15,cols=6)
        # 上肩条带归胸部，避免腰链把整条带移离锁扣。
        ob=PARTS[-1]
        for g in list(ob.vertex_groups):ob.vertex_groups.remove(g)
        g=ob.vertex_groups.new(name='胸');g.add(list(range(len(ob.data.vertices))),1,'REPLACE');ob['刚性']=True


def flame(name, origin, height, width, bone, phase, direction=(0,0,1)):
    # 三维扁曲面火舌有前后厚度；两种不同侧向弯曲避免单张相机卡片。
    origin=Vector(origin);axis=Vector(direction).normalized();side=Vector((math.cos(phase),math.sin(phase),0));normal=axis.cross(side).normalized()
    if normal.length<.1:normal=Vector((0,1,0))
    rows=14;sides=8;verts=[];faces=[];uv=[];delta=[]
    for j in range(rows+1):
        t=j/rows
        curl=width*(math.sin(t*math.pi*2+phase)-math.sin(phase))*(t**.8)
        center=origin+axis*height*t+side*curl+normal*(width*.35*math.sin(t*math.pi))
        radius=width*(math.sin(math.pi*(.10+.90*t))**.8)*(1-.55*t)+.001
        for k in range(sides):
            a=k/sides*math.tau
            v=center+side*radius*math.cos(a)+normal*radius*.30*math.sin(a);verts.append(v);uv.append((k/sides,t))
            delta.append(side*(width*.34*t*t*math.sin(t*8+phase))+normal*(width*.30*t*t*math.sin(t*5+phase))+axis*(height*.10*t*t))
            if j:
                q=(j-1)*sides+k;faces.append((q,(j-1)*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k))
    faces.extend([tuple(reversed(range(sides))),tuple(rows*sides+k for k in range(sides))])
    ob=mesh(name,verts,faces,M['焰芯'],bone,'黑焰',True,uv);ob.data.materials.append(M['焰边']);ob.data.materials.append(M['焰紫'])
    for p in ob.data.polygons:
        # 薄边光分布在窄侧，而不是把整片火焰照亮。
        p.material_index=1 if p.index%sides in [2,6] else 2 if p.index%sides==3 else 0
    ob.shape_key_add(name='基础');key=ob.shape_key_add(name='火舌卷动')
    for i,d in enumerate(delta):key.data[i].co+=d
    for frame in range(1,END+1,5):
        key.value=.5+.5*math.sin((frame-1)/180*math.tau*2+phase);key.keyframe_insert('value',frame=frame)
    key.value=.5+.5*math.sin(phase);key.keyframe_insert('value',frame=END)
    ob['火舌根点']=tuple(origin);ob['说明']='形态关键帧可编辑；无流体缓存。'
    return ob


def build_flames():
    for s,side in [(-1,'右'),(1,'左')]:
        for j in range(5):
            flame(side+'肩焰'+str(j),(s*(.62+j*.10),.08+.08*math.sin(j),3.64-j*.08),.68+.16*math.sin(j+1),.09,side+'肩',j*.85+s*.7)
        for j in range(4):
            flame(side+'臂焰'+str(j),(s*(1.09+.035*math.sin(j)),.04,3.17-j*.19),.35+.12*math.sin(j),.075,side+'上臂' if j<2 else side+'前臂',j+.7)
        for j in range(10):
            z=2.47-j*.22; x=s*(1.02+(2.47-z)*.31)
            index=3 if s<0 else 10;bone='披袍'+str(index)+'·'+str(min(2,max(0,int((2.45-z)/.7))))
            flame(side+'袍缘焰'+str(j),(x,-.17,z),.30+.19*(.5+.5*math.sin(j*2)),.060+.010*j,bone,j*.89+s)
        for j in range(4):
            x=s*(.35+j*.22)
            flame(side+'下摆焰'+str(j),(x,.23,.45+.03*j),.29+.04*j,.07,'披袍'+str(4 if s<0 else 9)+'·2',j+2.4)
    for j in range(9):
        a=-1.7+j*.41
        flame('背肩焰'+str(j),(.80*math.sin(a),.38+.10*math.cos(a),3.53),.36+.08*math.sin(j),.065,'胸',j*.55)
    # 少量暗红火星，尺度与亮度均克制。
    for j in range(12):
        s=-1 if j%2 else 1;z=.65+j*.29
        ob=ellipsoid('暗红火星'+str(j),(s*(1.05+.20*math.sin(j)),.04,z),(.008,.008,.024),M['暗红'],'悬浮','黑焰',8,6)
        for f in range(1,END+1,10):
            t=(f-1)/180*math.tau
            ob.location=(.035*math.sin(t*2+j),0,.055*math.sin(t*2+j));ob.keyframe_insert('location',frame=f)
        ob.location=(.035*math.sin(j),0,.055*math.sin(j));ob.keyframe_insert('location',frame=END)


def animate():
    for pb in RIG.pose.bones:pb.rotation_mode='XYZ'
    for frame in range(1,END+1):
        t=(frame-1)/180*math.tau
        for pb in RIG.pose.bones:
            pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
        RIG.pose.bones['悬浮'].location.y=.032*(1-math.cos(t))
        RIG.pose.bones['胸'].rotation_euler.y=.006*math.sin(t)
        RIG.pose.bones['头'].rotation_euler.z=.009*math.sin(t)
        RIG.pose.bones['悬冠'].rotation_euler.z=.085*math.sin(t)
        RIG.pose.bones['悬冠'].location.y=.011*(1-math.cos(t))
        for i in range(11):
            for j in range(3):
                pb=RIG.pose.bones[('前袍' if i<3 else '披袍')+str(i)+'·'+str(j)]
                pb.rotation_euler.x=.007*(j+1)*(math.sin(t+i*.31)-math.sin(i*.31))
                pb.rotation_euler.y=.004*(j+1)*(math.sin(t+i*.43)-math.sin(i*.43))
        for pb in RIG.pose.bones:
            pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name);pb.keyframe_insert('location',frame=frame,group=pb.name)
    RIG.animation_data.action.name='寂冠之王·六秒待机'
    scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=180;scene.render.fps=FPS;scene.frame_set(1)
    for frame,name in [(1,'待机循环起点'),(46,'黑焰抬升'),(91,'悬浮顶点'),(136,'黑焰回落'),(181,'循环接缝检查')]:scene.timeline_markers.new(name,frame=frame)
    idle=RIG.animation_data.action;idle.use_fake_user=True;RIG.animation_data.action=None
    for frame in range(1,121):
        pressure_pose(RIG,(frame-1)/119)
        for pb in RIG.pose.bones:
            pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name);pb.keyframe_insert('location',frame=frame,group=pb.name)
    RIG.animation_data.action.name='寂冠之王·变形压力检查';RIG.animation_data.action.use_fake_user=True
    RIG.animation_data.action=idle;bpy.context.scene.frame_set(1)


def pressure_pose(rig,t):
    """检查范围明确的外展、弯肘、扭腰与迈步；建模工程与审计使用同一动作定义。"""
    for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
    pose=math.sin(t*math.tau)
    def rotate(name,axis,angle):
        pb=rig.pose.bones[name];local=pb.bone.matrix_local.to_3x3().inverted()@Vector(axis)
        pb.rotation_euler=Quaternion(local,math.radians(angle)).to_euler('XYZ')
    rotate('右上臂',(0,1,0),24*abs(pose));rotate('左上臂',(0,1,0),-24*abs(pose))
    rotate('右前臂',(1,0,0),-35*abs(pose));rotate('左前臂',(1,0,0),-35*abs(pose))
    rotate('胸',(0,0,1),10*pose);rotate('腰',(0,0,1),5*pose)
    rotate('右大腿',(1,0,0),12*pose);rotate('左大腿',(1,0,0),-12*pose)
    rotate('右小腿',(1,0,0),-8*max(0,pose));rotate('左小腿',(1,0,0),-8*max(0,-pose))
    for index in range(3):
        for joint in range(3):rotate('前袍'+str(index)+'·'+str(joint),(1,0,0),-4*abs(pose))
    rig.pose.bones['悬浮'].location.y=.10*abs(pose)


def camera(name, position, target, scale):
    d=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,d);COL['展示'].objects.link(ob);ob.location=position
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=scale
    return ob


def setup_scene():
    s=bpy.context.scene;s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1200;s.render.resolution_y=1200;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True
    s.eevee.taa_render_samples=32;s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
    s.world=bpy.data.worlds.new('中性展示环境');s.world.color=(.09,.09,.09);s.world.use_nodes=True
    bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.22,.24,.29,1);bg.inputs[1].default_value=.65
    for name,pos,energy,color,size in [('主光',(-3,-5,8),850,(1,.94,.84),5),('补光',(4,-3,5),650,(.76,.83,1),4),('轮廓光',(0,4,7),1000,(.72,.81,1),4)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.color=color;d.shape='DISK';d.size=size
        ob=bpy.data.objects.new(name,d);COL['展示'].objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,2.8))-ob.location).to_track_quat('-Z','Y').to_euler()
    s.camera=camera('原画对照',(0,-12,3.7),(0,0,2.65),6.20)
    camera('游戏视角',(0,-12,9.3),(0,0,2.65),6.3)
    # 原画只用作参考面，保存并打包，但不进入角色渲染。
    im=bpy.data.images.load(str(ROOT/'docs/demon-king-design/demon-king-black-flame-v2.png'))
    ob=bpy.data.objects.new('已确认黑焰版·原画参考',None);COL['参考'].objects.link(ob);ob.empty_display_type='IMAGE';ob.data=im;ob.empty_display_size=8.5;ob.location=(5,2,3);ob.rotation_euler=(math.pi/2,0,0);ob.hide_render=True
    s['说明']='离线角色建模工程；游戏接入与战斗验收尚未执行。';s['旅人参考高度']=5.07/2.5


def main():
    args=argparse.ArgumentParser();args.add_argument('--force',action='store_true');options=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    path=SOURCE/'demon-king-editable.blend'
    if path.exists() and not options.force:raise RuntimeError('工程已存在；禁止覆盖后续手工修改。明确重建时才使用覆盖参数。')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name in ['控制','身体','硬甲','布料','王冠','王剑','黑焰','展示','参考']:
        c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);COL[name]=c
    create_rig()
    M['石']=material('风蚀青黑石甲',(.08,.09,.11),'stone-paint.png')
    M['裂缝']=material('石甲·实体暗裂',(.008,.009,.012),roughness=1)
    M['铜']=material('古铜·氧化与磨边',(.24,.19,.12),'bronze-paint.png',.78,.22)
    M['布']=material('墨青·手绘长袍',(.025,.034,.050),'cloth-paint.png',.98)
    M['封印']=material('灰白旧封印',(.38,.35,.29),'seal-paint.png',.97)
    M['空面']=material('无面·近黑空相',(.0025,.0035,.005),roughness=1)
    M['晶']=material('暗红裂晶',(.13,.024,.018),roughness=.82,emission=.08)
    M['暗红']=material('克制暗红裂隙',(.20,.034,.019),roughness=.95,emission=.24)
    M['焰芯']=material('黑焰·近黑实体',(.004,.005,.011),roughness=1)
    M['焰边']=material('黑焰·冷灰蓝薄边',(.035,.045,.079),roughness=.95,emission=.10)
    M['焰紫']=material('黑焰·暗紫转折',(.037,.024,.056),roughness=.98,emission=.08)
    build_body();build_armor();build_hands_sword();build_crown();build_cloth();build_flames()
    # 原画地标重分配纵向比例：提高腰线与肩线，缩短头部和冠片，恢复修长下身。
    landmarks=[(0,0),(.30,.30),(1.20,1.43),(2.09,2.56),(2.43,2.94),(2.91,3.42),(3.63,4.10),(3.71,4.16),(4.075,4.40),(4.44,4.66),(4.56,4.76),(5.16,5.16),(6,6)]
    def map_z(z):
        for (a,x),(b,y) in zip(landmarks,landmarks[1:]):
            if a<=z<=b:return x+(z-a)/(b-a)*(y-x)
        return z
    # 上身按原画收窄，袍摆保留较宽轮廓。骨骼与实体同步，绑定空间保持一致。
    for ob in PARTS:
        category=ob.users_collection[0].name
        shrink=category not in ['布料','黑焰'] or category=='黑焰' and ('肩' in ob.name or '臂' in ob.name)
        for v in ob.data.vertices:
            if shrink:v.co.x*=.85
            v.co.z=map_z(v.co.z)
        if ob.data.shape_keys:
            for block in ob.data.shape_keys.key_blocks:
                for point in block.data:
                    if shrink:point.co.x*=.85
                    point.co.z=map_z(point.co.z)
    bpy.context.view_layer.objects.active=RIG;bpy.ops.object.mode_set(mode='EDIT')
    for bone in RIG.data.edit_bones:
        bone.head.x*=.85;bone.tail.x*=.85;bone.head.z=map_z(bone.head.z);bone.tail.z=map_z(bone.tail.z)
    bpy.ops.object.mode_set(mode='OBJECT')
    # 几何修改器先求值，再由骨架移动；不在变形后的坐标上重新计算倒角。
    for ob in PARTS:
        bpy.context.view_layer.objects.active=ob
        for mod in list(ob.modifiers):
            if mod.type in ['BEVEL','SOLIDIFY']:
                while list(ob.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
    animate();setup_scene()
    for im in bpy.data.images:
        if im.source=='FILE':im.pack()
    bpy.context.scene.frame_set(1)
    for ob in bpy.context.selected_objects:ob.select_set(False)
    RIG.select_set(True);bpy.context.view_layer.objects.active=RIG
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    manifest={'说明':'可编辑工程；一百八十帧待机与第一百八十一帧接缝。压力动作由验收工具临时生成，不冒充正式战斗动作。','网格数':len(PARTS),'骨骼数':len(RIG.data.bones),'火舌数':sum(o.data.shape_keys is not None for o in PARTS),'分组':{n:len(c.objects) for n,c in COL.items()},'动作长度秒':6,'动作帧率':FPS}
    (SOURCE/'model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('可编辑工程已保存：',path,flush=True)


if __name__=='__main__':main()
