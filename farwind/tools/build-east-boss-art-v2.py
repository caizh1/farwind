"""缚枝祭主第二版：独立源工程、定向生长结构与直接渲染。"""
import argparse
import os
import hashlib
import importlib.util
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('EAST_BOSS_ART_OUT', ROOT / 'docs/east-boss-art-v2')).resolve()
SOURCE = OUT / 'source/east-boss-art-editable.blend'
DELIVERY = OUT / 'source/east-boss-art-delivery.blend'
TEX = ROOT / 'docs/east-boss-art/source/textures'
spec = importlib.util.spec_from_file_location('art_base', ROOT / 'tools/build-east-boss-art.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)
base = art.base
M = {}


def mesh(name, vertices, faces, material, uvs, weights, smooth=False):
    ob = art.mesh(name, vertices, faces, material, uvs, weights, smooth)
    ob['部位'] = name
    return ob


def painted(name, texture, color, amount=.35, roughness=.88, emission=0):
    """保留已有笔触，使用大色块抑制碎纹；不生成或伪造新的纹理细节。"""
    mat = base.material(name, color, roughness)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    p = nodes.get('Principled BSDF')
    p.inputs['Specular IOR Level'].default_value = .18
    uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = '手绘源坐标'
    tex = nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(str(TEX / texture), check_existing=True)
    tex.name = '保留的绘画纹理'
    links.new(uv.outputs['UV'], tex.inputs['Vector'])
    mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MIX'
    mix.inputs[0].default_value = amount; mix.inputs[1].default_value = (*color, 1)
    links.new(tex.outputs['Color'], mix.inputs[2]); links.new(mix.outputs[0], p.inputs['Base Color'])
    if emission:
        links.new(mix.outputs[0], p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = emission
    return mat


def materials():
    M['wood'] = painted('树皮·主根暖棕', 'bark-paint-source.png', (.145, .070, .030), .48)
    M['darkwood'] = painted('树皮·背阴深棕', 'bark-paint-source.png', (.075, .043, .027), .20)
    M['ridge'] = painted('树皮·生长亮棱', 'bark-paint-source.png', (.32, .185, .075), .28)
    M['gold'] = painted('树皮·风核金根', 'bark-paint-source.png', (.60, .345, .105), .16)
    M['ivory'] = painted('骨木·象牙主面', 'ivory-paint-source.png', (.76, .66, .47), .18)
    M['edge'] = painted('骨木·薄刃亮面', 'ivory-paint-source.png', (.88, .79, .60), .10)
    M['ivoryshade'] = painted('骨木·侧壁暖灰', 'ivory-paint-source.png', (.34, .26, .15), .15)
    M['dark'] = base.material('深腔·眼窝与胸腔', (.014, .021, .014), .95)
    colors = [(.075, .145, .102), (.18, .215, .085), (.043, .103, .082), (.30, .285, .103)]
    for i, c in enumerate(colors):
        M['leaf'+str(i)] = painted('叶片·色系'+str(i+1), 'leaf-paint-source.png', c, .27)
    M['core'] = painted('风核·翠绿旋流', str(OUT/'source/textures/core-paint-source-v2.png'), (.065, .28, .15), .82, emission=.15)
    art.BARK = M['wood']; art.LIGHT_BARK = M['ridge']; art.IVORY = M['ivory']
    art.PALE = M['edge']; art.DARK = M['dark']; art.LEAF = M['leaf0']; art.CORE_MATS = [M['core']]


def root(name, points, widths, bone='胸', depth=.76, twist=.25, offset=0, material=None, weights=None, sides=12):
    """闭合截面使用共享顶点，主根平滑转折，纹理沿弧长而非索引拉伸。"""
    centers = base.path_samples(points, 8)
    distances = [0.]
    for a, b in zip(centers, centers[1:]): distances.append(distances[-1] + (b-a).length)
    verts, faces, uv = [], [], []
    for i, c in enumerate(centers):
        t = i / (len(centers)-1)
        q = t*(len(widths)-1); j = min(len(widths)-2, int(q)); f = q-j
        w = widths[j]*(1-f) + widths[j+1]*f
        tangent = (centers[min(i+1, len(centers)-1)] - centers[max(0, i-1)]).normalized()
        axis = tangent.cross(Vector((0, -1, 0)))
        if axis.length < .05: axis = tangent.cross(Vector((1, 0, 0)))
        axis.normalize(); normal = tangent.cross(axis).normalized()
        for k in range(sides):
            a = k/sides*math.tau + twist*t
            radius = w*(1 + .14*math.cos(3*a+.7) + .055*math.cos(5*a+.5))
            verts.append(c + axis*(radius*math.cos(a)) + normal*(radius*depth*math.sin(a)))
            uv.append(((offset+k/sides*.35) % .98, .025+.95*distances[i]/distances[-1]))
        if i:
            for k in range(sides):
                a=(i-1)*sides+k; b=(i-1)*sides+(k+1)%sides
                faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(centers)-1)*sides+k for k in range(sides))])
    fn = (lambda i: weights((i//sides)/(len(centers)-1))) if weights else bone
    ob=mesh(name,verts,faces,material or M['wood'],uv,fn,True)
    ob['结构类型']='实体根系'
    return ob


def leaf(name, start, end, width, bone, variant=0, face=-1, curl=.10, roll=0, facing=None, shape=0, color=None):
    """六种叶缘，折起、偏弯及缺口由几何实现，减少整齐羽片感。"""
    a,b=Vector(start),Vector(end); direction=(b-a).normalized()
    front=Vector(facing or (0,face,.22)).normalized()
    side=direction.cross(front).normalized(); normal=side.cross(direction).normalized()
    if normal.dot(front)<0:normal=-normal
    rows,cols=14,4; verts=[];uv=[];faces=[]
    col=variant%2;row=(variant//2)%2
    for i in range(rows+1):
        t=i/rows; wave=math.sin(math.pi*t)
        bend=[.02,-.015,.10,-.10,.025,.065][shape%6]
        center=a.lerp(b,t)+normal*(curl*wave-.075*t*t)+side*((roll+bend)*wave)
        w=width*(max(.002,wave)**[.9,.65,.8,.85,.95,.72][shape%6])*(1-.35*t)
        for k in range(cols+1):
            across=k/cols*2-1
            edge=1-(.12 if i%3==1 else 0)*abs(across)**3
            if shape==5 and i in [8,9] and across>0:edge*=.55
            fold=(.025+.055*(shape==4))*wave*(1-abs(across))
            v=center+side*(w*across*edge)+normal*(fold-.035*across*across*wave)
            verts.append(v);uv.append((col*.5+.025+(across+1)*.224,1-row*.5-.475+t*.45))
            if i and k:
                q=(i-1)*(cols+1)+k-1;faces.append((q,q+1,q+cols+2,q+cols+1))
    ob=mesh(name,verts,faces,M['leaf'+str(variant%4 if color is None else color)],uv,bone,True)
    thick=ob.modifiers.new('薄叶实体厚度','SOLIDIFY');thick.thickness=.004
    with bpy.context.temp_override(object=ob,active_object=ob):
        bpy.ops.object.modifier_move_up(modifier=thick.name)
    ob['叶形']=shape%6;ob['结构类型']='实体叶片'
    return ob


def torso():
    paths=[
      ([(-.34,.04,1.27),(-.31,-.12,1.54),(-.04,-.24,1.84),(.31,-.08,2.12),(.37,.00,2.62),(.15,.10,3.24)],[.17,.18,.13,.13,.15,.095]),
      ([(.39,.08,1.28),(.26,-.01,1.62),(.02,.06,1.96),(-.31,.0,2.26),(-.35,.08,2.70),(-.14,.10,3.22)],[.15,.14,.11,.13,.14,.08]),
      ([(-.31,.23,1.26),(-.43,.24,1.66),(-.26,.31,2.08),(-.27,.27,2.67),(.10,.17,3.27)],[.12,.15,.105,.13,.07]),
      ([(.35,.20,1.29),(.39,.29,1.72),(.23,.31,2.14),(.27,.24,2.67),(-.08,.12,3.22)],[.12,.13,.11,.14,.075]),
    ]
    for i,(p,w) in enumerate(paths):
        root('躯干承重主根'+str(i),p,w,weights=lambda t:base.blend_weights('腰','胸',t,.48),offset=i*.12,twist=.7)
    root('腰部斜向包覆主根',[(-.40,-.04,1.99),(-.29,-.20,1.82),(.00,-.25,1.68),(.27,-.10,1.53),(.44,-.01,1.27)],[.008,.058,.056,.043,.008],weights=lambda t:base.blend_weights('胸','腰',t,.25),material=M['ridge'],twist=-.6)
    root('腹部向上缠绕细根',[(.12,-.20,1.38),(-.10,-.25,1.69),(-.24,-.19,1.98),(-.16,-.06,2.23)],[.045,.05,.035,.003],weights=lambda t:base.blend_weights('腰','胸',t,.7),material=M['darkwood'])
    root('腹腔内层暗根',[(.07,.10,1.36),(-.09,.08,1.66),(-.045,.11,1.97),(.12,.09,2.24),(.07,.10,2.50)],[.085,.105,.09,.07,.045],weights=lambda t:base.blend_weights('腰','胸',t,.5),material=M['darkwood'],twist=.8)
    for s in [-1,1]:
        root('胸肩连续根'+str(s),[(s*.13,.08,3.25),(s*.28,-.035,3.04),(s*.60,.0,2.90),(s*.82,.02,2.66)],[.10,.14,.15,.09])
        root('胸侧外缘根'+str(s),[(s*.30,.02,2.10),(s*.44,.04,2.40),(s*.40,.02,2.76),(s*.61,.01,2.93)],[.04,.075,.08,.035],material=M['ridge'])


def limbs():
    def aw(t,side):
        if t<.22:
            u=base.ease(t/.22);return {'胸':1-u,side+'上臂':u}
        return base.blend_weights(side+'上臂',side+'前臂',t,.56)
    for s,side in [(-1,'左'),(1,'右')]:
        for k,(ox,oy,w) in enumerate([(-.07,-.04,.115),(.085,.005,.125),(0,.12,.07)]):
            p=[(s*(.53+ox),oy,2.98),(s*(.77+ox),oy-.025,2.67),(s*(1.01-ox*.2),oy,2.17),(s*(1.20-ox*.6),oy-.07,1.89),(s*(1.31+ox*.3),oy-.10,1.64)]
            root(side+'臂部主木束'+str(k),p,[w*1.2,w,w*.85,w*1.1,w*.6],weights=lambda t,side=side:aw(t,side),offset=.1+k*.18,twist=.85)
        for j in range(3):
            root(side+'肘外翻木甲'+str(j),[(s*(.94+j*.04),.035,2.17-j*.10),(s*(1.12+j*.05),-.05,2.26-j*.10),(s*(1.19+j*.03),.005,2.48-j*.1)],[.09,.085,.002],bone=side+'前臂',depth=.38,material=M['ridge'],twist=.4,sides=9)
        root(side+'上臂生长棱',[(s*.61,-.12,2.93),(s*.80,-.16,2.65),(s*.99,-.12,2.23),(s*1.16,-.18,1.96)],[.005,.04,.035,.003],weights=lambda t,side=side:aw(t,side),material=M['ridge'],depth=.4)
        for k,(ox,oy,w) in enumerate([(-.075,-.025,.125),(.075,.03,.10),(0,.13,.075)]):
            bend=.035 if s<0 else -.035
            p=[(s*(.30+ox),oy,1.53),(s*(.46-ox*.7+bend),oy-.03,1.20),(s*(.49+ox),oy-.075,.85),(s*(.45+ox*.7-bend),oy+.025,.51),(s*(.61+ox*.3),oy+.02,.20)]
            root(side+'腿部扭转主根'+str(k),p,[w*1.18,w,w*.78,w*.85,w*.6],weights=lambda t,side=side:base.blend_weights(side+'大腿',side+'小腿',t,.53),offset=.13+k*.18,twist=-.8)
        root(side+'膝外生长甲',[(s*.42,-.04,1.02),(s*.57,-.10,.90),(s*.64,-.04,1.11)],[.09,.095,.002],bone=side+'小腿',material=M['ridge'],depth=.5)
        feet=[(-.35,-.49),(-.05,-.72),(.30,-.58),(.54,-.18),(.19,.39)]
        for j,(dx,dy) in enumerate(feet):
            dx*=1.08 if s<0 else .97
            end=(s*(.64+dx),dy,.035)
            p=[(s*.61,.03,.27),(s*(.61+dx*.30),dy*.27,.16),(s*(.62+dx*.63),dy*.65,.083),end]
            root(side+'落地主根'+str(j),p,[.10,.084,.039,.0025],bone=side+'脚',depth=.56,offset=.10+j*.1,twist=.8)
            if j in [0,1,3]:
                start=p[2];fork=(end[0]+s*(.16 if j!=0 else -.13),end[1]+.14,.031)
                root(side+'落地二级分叉'+str(j),[start,(start[0]+(fork[0]-start[0])*.6,start[1]+(fork[1]-start[1])*.5,.06),fork],[.031,.023,.002],bone=side+'脚',depth=.6,material=M['ridge'],offset=.25)


def canopy():
    rng=random.Random(271)
    # 每簇指定生长方向；局部变化只打散重复，不决定整件披肩结构。
    for s,side in [(-1,'左'),(1,'右')]:
        clusters=[(.22,3.27,.62,3.40,5),(.36,3.17,1.02,3.13,7),(.51,3.03,1.15,2.65,7),(.49,2.91,.96,2.35,6),(.28,2.80,.52,2.19,5)]
        if s>0:clusters=[(.20,3.25,.55,3.39,4),(.38,3.16,1.04,3.00,6),(.55,2.99,1.15,2.59,6),(.40,2.83,.79,2.24,6),(.26,2.71,.40,2.16,4)]
        for face in [-1,1]:
            for ci,(x,z,ex,ez,count) in enumerate(clusters):
                for j in range(count):
                    u=j/max(1,count-1)-.5
                    start=(s*(x+u*.13),face*(.12+.08*ci/4+rng.uniform(0,.06)),z+u*.11)
                    end=(s*(ex+u*.22+rng.uniform(-.08,.08)),face*(.24+rng.uniform(.0,.18)),ez+u*.24+rng.uniform(-.09,.07))
                    leaf(side+'肩部叶簇'+str(ci),start,end,rng.uniform(.060,.100),side+'肩叶',(j+ci*2+(s>0))%4,face,curl=rng.uniform(.035,.10),roll=rng.uniform(-.07,.07),shape=(j+ci)%6,color=(j+ci)%3)
            for j in range(11):
                t=j/10; x=.22+.22*t;z=1.98-.35*t
                end=(s*(.44+.30*t+rng.uniform(-.06,.07)),face*(.23+rng.uniform(0,.12)),1.37-.48*t+rng.uniform(-.05,.06))
                leaf(side+'腰部散叶',(s*x,face*.13,z),end,.057+.02*(j%3),side+'腰叶',j%4,face,curl=.055,shape=j%6,color=j%3)
            for j in range(10):
                t=j/9; x=1.06+.51*t;z=2.18-.94*t
                leaf(side+'臂外披叶',(s*x,face*.08,z),(s*(x+.13+.06*(j%2)),face*.19,z-.31-.10*(j%3)),.048+.018*(j%3),side+'前臂' if j<3 else side+'镰臂',j%4,face,curl=.055,shape=(j+2)%6,color=j%3)
        for j in range(6):
            leaf(side+'肩侧翻叶',(s*(.43+j*.05),.06,3.04-j*.055),(s*(.81+j*.04),(-.23 if j%2 else .32),2.74-j*.07),.07,side+'肩叶',j%4,facing=(s,.15,.12),shape=j%6,curl=.09)


def ellipsoid(name, center, scale, material, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=center)
    ob=bpy.context.object;ob.name=name;ob.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(material);ob.parent=art.RIG
    g=ob.vertex_groups.new(name=bone);g.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('骨骼变形','ARMATURE');mod.object=art.RIG
    ob.data.uv_layers[0].name='手绘源坐标'
    for p in ob.data.polygons:p.use_smooth=True
    ob['部位']=name;art.PARTS.append(ob)
    return ob


def shell_plate(name, outline, material, bone, thickness=.018):
    """窄木甲使用封闭的起脊截面，不用悬浮描线替代骨片。"""
    pts=[Vector(p) for p in outline];center=sum(pts,Vector())/len(pts)
    center.y-=.027
    verts=pts+[center]+[p+Vector((0,thickness,0)) for p in pts]
    n=len(pts);faces=[]
    for i in range(n):faces.extend([(i,(i+1)%n,n),(i,n+1+i,n+1+(i+1)%n,(i+1)%n)])
    faces.append(tuple(n+1+i for i in reversed(range(n))))
    xmin=min(p.x for p in verts);xmax=max(p.x for p in verts)
    zmin=min(p.z for p in verts);zmax=max(p.z for p in verts)
    uv=[(.035+.93*(p.x-xmin)/max(.001,xmax-xmin),.035+.93*(p.z-zmin)/max(.001,zmax-zmin)) for p in verts]
    return mesh(name,verts,faces,material,uv,bone)


def head():
    ellipsoid('颅后木质支撑',(0,.015,3.46),(.195,.205,.34),M['darkwood'],'头')
    trunks=[
      ([(-.13,.10,3.30),(-.28,.14,3.61),(-.43,.22,3.88),(-.46,.26,4.15),(-.56,.21,4.34)],[.12,.10,.075,.044,.002],-1),
      ([(-.29,.14,3.63),(-.61,.14,3.80),(-.84,.10,3.98),(-.91,.17,4.19)],[.075,.061,.043,.002],-1),
      ([(.03,.15,3.40),(.08,.20,3.74),(-.02,.25,4.00),(.10,.30,4.20),(.045,.35,4.36)],[.11,.092,.066,.04,.002],1),
      ([(.13,.10,3.32),(.30,.04,3.61),(.49,.12,3.81),(.66,.17,4.02),(.63,.25,4.24)],[.115,.092,.068,.04,.002],1),
      ([(.30,.04,3.61),(.63,.09,3.66),(.88,.16,3.81),(1.09,.18,3.85),(1.22,.24,4.00)],[.074,.059,.041,.027,.002],1),
    ]
    for i,(p,w,s) in enumerate(trunks):
        side='左' if s<0 else '右'
        w=[r*(1-.24*j/(len(w)-1)) for j,r in enumerate(w)]
        root('树冠承重主枝'+str(i),p,w,bone=side+'冠枝',material=M['wood'],twist=.65,offset=i*.1)
        for j in range(1,len(p)-1):
            start=Vector(p[j]); direction=-1 if (j+i)%2 else 1
            end=start+Vector((direction*(.15+.03*(i%2)),.10*(1 if j%2 else -1),.21+.025*j))
            mid=start.lerp(end,.63)+Vector((direction*.025,0,-.03))
            root('冠枝次级分叉'+str(i)+'-'+str(j),[start,mid,end],[w[j]*.62,w[j]*.35,.002],bone=side+'冠枝',material=M['ridge'],twist=.4)
            if j>=2 or i==1:
                fork=mid;delta=Vector((-direction*.095,.045,.10+.015*(i%3)))
                root('冠枝三级短梢'+str(i)+'-'+str(j),[fork,fork+delta*.55+Vector((0,0,.025)),fork+delta],[w[j]*.26,w[j]*.14,.0015],bone=side+'冠枝',material=M['wood'])
        end_start=base.path_samples(p,8)[-5]
        offset=Vector(((-1 if i%2 else 1)*.075,-.06,.08))
        root('冠枝末端不规则短梢'+str(i),[end_start,end_start+offset*.65,end_start+offset],[.016,.012,.0015],bone=side+'冠枝',material=M['wood'])
        # 分枝来自主枝中心，根部加厚；不使用逐枝独立的空间偏移。
    for s,side in [(-1,'左'),(1,'右')]:
        root(side+'头肩连续根',[(s*.12,.06,3.18),(s*.22,.09,3.42),(s*.20,.13,3.64),(s*.09,.18,3.78)],[.07,.085,.065,.006],bone='头')
        root(side+'面具颞侧支撑',[(s*.15,.005,3.38),(s*.22,-.10,3.45),(s*.21,-.265,3.46)],[.070,.075,.045],bone='头',material=M['darkwood'])
        root(side+'面具侧缘连接根',[(s*.07,-.045,3.16),(s*.17,-.22,3.27),(s*.225,-.29,3.52),(s*.18,-.22,3.74),(s*.075,-.05,3.80)],[.045,.063,.063,.065,.026],bone='头')
        for j in range(9):
            leaf(side+'冠根覆叶',(s*(.08+.025*j),.13,3.42-j*.026),(s*(.24+.040*j),.24,3.86-j*.06),.052+.008*(j%3),'头',j%4,face=1,shape=j%6,curl=.07,color=j%3)
    # 每半张面具是带眼孔、内壁和背面的闭合壳，深眼腔单独位于孔后。
    outline=[(-.018,3.94),(-.11,3.76),(-.25,3.88),(-.23,3.66),(-.29,3.67),(-.205,3.42),(-.11,3.23),(0,3.045),(0,3.31),(0,3.57)]
    def front_y(x,z):return -.49+.67*abs(x)+.12*(z-3.54)**2
    for s,side in [(1,'左'),(-1,'右')]:
        out=[Vector((x*s,front_y(x,z),z)) for x,z in outline]
        center=Vector((-.116,3.535));up=Vector((-.36,.933));cross=Vector((.933,.36))
        inner=[]
        for x,z in outline:
            d=Vector((x,z))-center
            u=d.dot(cross);v=d.dot(up);t=1/math.sqrt((u/.030)**2+(v/.128)**2)
            q=center+d*t
            inner.append(Vector((q.x*s,front_y(q.x,q.y)-.003,q.y)))
        n=len(out);back_in=[p+Vector((0,.060,0)) for p in inner];back_out=[p+Vector((0,.028,0)) for p in out]
        verts=out+inner+back_in+back_out;faces=[];mi=[]
        for i in range(n):
            j=(i+1)%n
            faces.extend([(i,j,n+j,n+i),(n+i,n+j,2*n+j,2*n+i),(2*n+i,2*n+j,3*n+j,3*n+i),(i,3*n+i,3*n+j,j)])
            mi.extend([0,1,1,1])
        uv=[(.08+(p.x+.30)/.60*.82,.06+(p.z-3.0)/1.0*.88) for p in verts]
        ob=mesh(side+'面具开孔骨壳',verts,faces,M['ivory'],uv,'头')
        ob.data.materials.append(M['ivoryshade'])
        for p,m in zip(ob.data.polygons,mi):p.material_index=m
        cup=[p+Vector((0,.004,0)) for p in back_in]
        cup.append(sum(cup,Vector())/n+Vector((0,.065,0)))
        mesh(side+'眼窝凹腔',cup,[(i,(i+1)%n,n) for i in range(n)],M['dark'],[(.5,.5)]*(n+1),'头',True)
        shell_plate(side+'颊侧叠压骨片',[(s*-.24,-.30,3.63),(s*-.20,-.35,3.36),(s*-.07,-.445,3.16),(s*-.135,-.425,3.43)],M['ivory'],'头')
    shell_plate('面具中央生长脊',[(0,-.488,3.965),(-.042,-.478,3.64),(-.030,-.48,3.30),(0,-.465,3.045),(.03,-.48,3.30),(.042,-.478,3.64)],M['edge'],'头',.015)
    root('面具额部背撑',[(0,.0,3.75),(0,-.19,3.77),(0,-.42,3.76)],[.09,.085,.035],bone='头',material=M['darkwood'])
    root('面具下颌背撑',[(0,.015,3.18),(.025,-.19,3.19),(0,-.425,3.18)],[.065,.061,.026],bone='头',material=M['darkwood'])


def blades():
    for s,side in [(-1,'左'),(1,'右')]:
        outer=base.path_samples([(s*1.27,-.08,1.99),(s*1.52,-.10,1.75),(s*1.70,-.12,1.35),(s*1.66,-.13,1.00),(s*1.44,-.15,.64),(s*.99,-.19,.36)],9)
        inner=base.path_samples([(s*1.15,-.08,1.97),(s*1.25,-.10,1.72),(s*1.38,-.12,1.35),(s*1.39,-.13,1.06),(s*1.27,-.15,.73),(s*.99,-.19,.36)],9)
        sections=[0,.12,.42,.67,1];verts=[];uv=[];faces=[];mi=[];n=len(outer)
        for i,(a,b) in enumerate(zip(outer,inner)):
            t=i/(n-1)
            for back in [False,True]:
                for u in sections:
                    p=a.lerp(b,u)
                    p.y+=(.025+.018*u if back else -(.008+.06*math.sin(math.pi*u*.85)))*(1-.8*t**5)
                    verts.append(p);uv.append((.05+.8*u,.035+.92*t))
            if i:
                for k in range(4):
                    q=(i-1)*10+k;faces.append((q,q+1,q+11,q+10));mi.append([0,1,2,3][k])
                    q+=5;faces.append((q+10,q+11,q+1,q));mi.append(3 if k>1 else 2)
                q=(i-1)*10;faces.extend([(q,q+10,q+15,q+5),(q+4,q+9,q+19,q+14)]);mi.extend([0,3])
        faces.extend([(0,5,9,4),((n-1)*10,(n-1)*10+4,(n-1)*10+9,(n-1)*10+5)]);mi.extend([3,0])
        ob=mesh(side+'镰刃分层截面',verts,faces,M['edge'],uv,side+'镰臂',True)
        for mat in [M['ivory'],M['ridge'],M['darkwood']]:ob.data.materials.append(mat)
        for p,m in zip(ob.data.polygons,mi):p.material_index=m
        for j,idx in enumerate([6,13,21,28,34]):
            a=inner[idx];b=inner[idx+4];length=[.12,.145,.13,.10,.075][j]
            mid=a.lerp(b,.46);tip=mid+Vector((-s*length,-.016,-.075))
            hook=mid+Vector((-s*length*.63,-.023,.026))
            shell_plate(side+'深木钩齿'+str(j),[a+Vector((0,-.035,.014)),hook,tip,b+Vector((0,-.035,0))],M['darkwood'],side+'镰臂',.065)
        root(side+'镰根外覆木脊',[(s*1.18,.015,2.02),(s*1.43,.005,1.79),(s*1.55,-.005,1.42),(s*1.52,-.025,1.11)],[.13,.14,.083,.003],bone=side+'镰臂',depth=.62)
        for j in range(4):
            z=1.91-j*.15;x=1.26+.065*j
            root(side+'镰背叠甲'+str(j),[(s*(x-.04),-.035,z-.10),(s*(x+.08),-.04,z),(s*(x+.13),-.015,z+.14)],[.05,.073,.002],bone=side+'镰臂',depth=.43,material=M['ridge'],sides=9)


def core():
    for face,scale in [(-1,1),(1,.7)]:
        y=face*.24;z=2.53
        ellipsoid('胸腔暗底'+str(face),(0,y,z),(.31*scale,.095,.34*scale),M['dark'],'胸')
        verts=[(0,y+face*.13,z)];uv=[(.5,.5)];faces=[];rings=12;segments=56
        def surface(x,zz,lift=0):
            r2=(x/(.283*scale))**2+((zz-z)/(.316*scale))**2
            return Vector((x,y+face*(.055+.075*math.sqrt(max(0,1-r2))+lift),zz))
        for i in range(1,rings+1):
            r=i/rings
            for j in range(segments):
                a=j/segments*math.tau;x=.283*scale*r*math.cos(a);zz=z+.316*scale*r*math.sin(a)
                verts.append(surface(x,zz));uv.append((.5+.46*r*math.cos(a),.5+.46*r*math.sin(a)))
                k=1+(i-1)*segments+j;n=1+(i-1)*segments+(j+1)%segments
                faces.append((0,k,n) if i==1 else (k-segments,k,n,n-segments))
        mesh('嵌入式风核'+str(face),verts,faces,M['core'],uv,'胸',True)
        for s in [-1,1]:
            p=[(s*.015,face*.19,2.99),(s*.24*scale,face*.33,2.80),(s*.33*scale,face*.34,2.53),(s*.25*scale,face*.31,2.23),(s*.025,face*.18,2.05)]
            root('风核金根框'+str(face)+'-'+str(s),p,[.024,.049,.04,.045,.007],material=M['gold'],twist=.6)
            root('金根内侧生长芽'+str(face)+'-'+str(s),[p[1],(s*.18*scale,face*.36,2.84),(s*.11*scale,face*.34,2.86)],[.024,.021,.002],material=M['gold'])


def bark_accents():
    """少量尖甲只放在主要转折上，保留根系的大块安静表面。"""
    for s,side in [(-1,'左'),(1,'右')]:
        for j,(x,z,bone) in enumerate([(.73,2.73,'上臂'),(.89,2.43,'上臂'),(1.13,1.96,'前臂'),(.38,1.26,'大腿'),(.49,.77,'小腿'),(.54,.46,'小腿')]):
            shell_plate(side+'树皮转折甲'+str(j),[(s*(x-.045),-.135,z+.14),(s*(x+.052),-.16,z+.05),(s*(x+.018),-.175,z-.14),(s*(x-.06),-.13,z-.035)],M['ridge'],side+bone,.023)


def setup():
    scene=art.setup()
    scene.render.resolution_x=2048;scene.render.resolution_y=2048
    base.camera('左四分之三',(-7,-8,7.3),(0,0,2.05),5.25)
    base.camera('右四分之三',(7,-8,7.3),(0,0,2.05),5.25)
    base.camera('动作检查',(0,-10,7.6),(0,0,2.05),7.50)
    scene['说明']='第二版静态精修；相机与基线沿用同一游戏视角；完整动作和实机待验证。'
    return scene


def save_source():
    scene=bpy.context.scene
    for f in [1,40,80,100]:art.pose(f)
    poses={
      120:('双镰交叉',{'左上臂':(0,0,-34),'左前臂':(-65,0,0),'右上臂':(0,0,30),'右前臂':(-59,0,0),'胸':(0,8,0)}),
      140:('双肩抬起',{'左上臂':(0,0,-65),'右上臂':(0,0,65),'左前臂':(-22,0,0),'右前臂':(-22,0,0)}),
      160:('左腿抬起',{'左大腿':(32,0,0),'左小腿':(-65,0,0),'左脚':(22,0,0)}),
      180:('右腿抬起',{'右大腿':(32,0,0),'右小腿':(-65,0,0),'右脚':(22,0,0)}),
      200:('回到中立',{}),
    }
    for frame,(label,rotations) in poses.items():
        for pb in art.RIG.pose.bones:
            pb.rotation_euler=tuple(math.radians(v) for v in rotations.get(pb.name,(0,0,0)))
            if frame==140 and pb.name in ['左上臂','右上臂','左肩叶','右肩叶']:
                sign=1 if pb.name.startswith('左') else -1
                angle=60 if pb.name.endswith('上臂') else 24
                axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((0,1,0))
                pb.rotation_euler=Quaternion(axis,math.radians(sign*angle)).to_euler('XYZ')
            pb.keyframe_insert('rotation_euler',frame=frame)
        scene.timeline_markers.new(label,frame=frame)
    scene.frame_end=200
    scene.frame_set(1)
    for ob in scene.objects:ob.select_set(False)
    art.RIG.select_set(True);bpy.context.view_layer.objects.active=art.RIG
    note=bpy.data.texts.new('精修说明')
    note.write('第二版精修源工程。各部位保留独立网格、叶片厚度与骨骼修改器。渲染请加载此工程；禁止通过旧生成脚本覆盖人工精修。交付工程从副本制作。')
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.type='MATERIAL';area.spaces.active.overlay.show_overlays=False
                area.spaces.active.region_3d.view_perspective='CAMERA'
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))


def render(mode,percent):
    scene=bpy.context.scene;scene.render.resolution_percentage=percent
    # 局部检查相机只在渲染进程增加，保留源工程既有主相机数据。
    if mode in ['all','ankle']:
        base.camera('踝根局部检查',(3,-6,2.4),(.60,-.15,.35),1.65)
    if mode in ['all','crown-side']:
        base.camera('冠枝纵深检查',(7,-3,5.0),(0,.18,3.88),2.65)
    if mode=='motion':
        folder=OUT/'evidence/motion-frames';folder.mkdir(exist_ok=True)
        scene.camera=bpy.data.objects['动作检查'];scene.render.film_transparent=False
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.011,.018,.013,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=1
        for frame in range(scene.frame_start,scene.frame_end+1):
            scene.frame_set(frame);scene.render.filepath=str(folder/f'{frame:04d}.png')
            bpy.ops.render.render(write_still=True)
        return
    if mode=='neutral':
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.2
        for name,energy,size in [('主光',550,2.5),('冷填光',130,3),('背光',300,3)]:
            light=bpy.data.objects[name].data;light.energy=energy;light.color=(1,1,1);light.size=size
    jobs={'front':('游戏视角',1),'side':('侧面视角',1),'back':('背面视角',1),'quarter-left':('左四分之三',1),'quarter-right':('右四分之三',1),'mask':('面具细节',1),'roots':('根系细节',1),'joint':('关节细节',40),'bend-left':('游戏视角',40),'bend-right':('游戏视角',80),'cross':('游戏视角',120),'shoulders':('游戏视角',140),'step-left':('游戏视角',160),'step-right':('游戏视角',180)}
    jobs.update({'ankle':('踝根局部检查',1),'crown-side':('冠枝纵深检查',1)})
    if scene.frame_end>=320:
        jobs.update({'twist-left':('游戏视角',220),'twist-right':('游戏视角',240),'presentation':('游戏视角',260),'shoulder-left':('动作检查',280),'shoulder-right':('动作检查',300),'landing':('游戏视角',320)})
    selected=jobs if mode=='all' else {mode:jobs.get(mode,('游戏视角',1))}
    if 'shoulders' in selected:selected['shoulders']=('动作检查',140)
    if mode in ['clay','silhouette']:
        mat=base.material('检查材质',(.46,.46,.43),1)
        if mode=='silhouette':
            n=mat.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs[0].default_value=(.025,.045,.032,1)
            out=n.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(em.outputs[0],out.inputs[0])
        scene.view_layers[0].material_override=mat
    for name,(cam,frame) in selected.items():
        scene.camera=bpy.data.objects[cam];scene.frame_set(frame)
        scene.render.filepath=str(OUT/'evidence'/f'{name}.png');bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser(description='生成或加载独立第二版工程')
    parser.add_argument('--load',action='store_true');parser.add_argument('--rebuild',action='store_true')
    parser.add_argument('--input',type=Path);parser.add_argument('--render',default='none');parser.add_argument('--percent',type=int,default=100)
    opt=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for p in [OUT/'source',OUT/'evidence']:p.mkdir(parents=True,exist_ok=True)
    if opt.load:
        bpy.ops.wm.open_mainfile(filepath=str(opt.input or SOURCE));art.RIG=bpy.data.objects['缚枝祭主·可编辑骨架']
    else:
        if SOURCE.exists() and not opt.rebuild:raise RuntimeError('源工程已存在；继续精修请加载，重建须明确提供重建参数。')
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        materials();art.create_rig();art.root=root;art.leaf=leaf
        torso();limbs();blades();canopy();head();core();bark_accents();setup();save_source()
    if opt.render!='none':render(opt.render,opt.percent)


if __name__=='__main__':main()
