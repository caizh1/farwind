"""第四版首领正式动画：保留造型，建立可编辑时间线和八方向透明渲染。"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/east-boss-motion-v2'
SOURCE = ROOT / 'docs/east-boss-art-v4/source'
FPS = 60


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def pose(**kwargs):
    p = dict(twist=0, lean=0, crouch=0, sway=0, left=[-5, 0, -3], right=[-7, 0, 3], elbowL=0, elbowR=0, head=0, liftL=0, liftR=0, strideL=0, strideR=0, rootTilt=0)
    p.update(kwargs)
    return p


IDLE = pose()
LOAD_L = pose(twist=-18, crouch=.10, sway=-.09, left=[-67, 14, -18], right=[-24, -8, 12], elbowL=-12, lean=5, head=8)
CUT_L = pose(twist=23, crouch=.04, sway=.08, left=[-55, -54, 18], right=[-44, -16, 12], elbowL=10, lean=10, head=-8)
LINK = pose(twist=18, crouch=.08, sway=.07, left=[-45, -22, 9], right=[-65, -12, 22], elbowL=-8, elbowR=-12, head=-6)
LOAD_R = pose(twist=23, crouch=.10, sway=.10, left=[-35, 3, -6], right=[-72, -17, 20], elbowR=-14, head=-8)
CUT_R = pose(twist=-24, crouch=.05, sway=-.08, left=[-34, 12, -10], right=[-59, 49, -18], elbowR=8, lean=9, head=8)
OPEN = pose(crouch=.10, lean=9, left=[-17, 24, -6], right=[-21, -25, 6], head=10)
CAST = pose(twist=-5, crouch=.06, left=[-62, 18, -8], right=[-66, -19, 8], elbowL=-8, elbowR=-10, lean=-5)
COCOON = pose(crouch=.18, lean=8, left=[-67, -25, 8], right=[-72, 22, -8], elbowL=-14, elbowR=-15, head=10)
RAISE = pose(crouch=.04, left=[-108, 16, -12], right=[-104, -18, 12], elbowL=-8, elbowR=-10, lean=-5, head=-8)
BRACE = pose(crouch=.17, lean=-12, twist=-9, left=[-35, 16, -12], right=[-40, -18, 12], head=14)


def make_clips():
    clips = {}
    def add(name, label, duration, keys, loop=False, attack=False, markers=None):
        clips[name] = dict(label=label, duration=duration, keys=keys, loop=loop, attack=attack, markers=markers or {})
    add('idle', '警戒呼吸', 1200, [(0, IDLE), (600, pose(crouch=.015, left=[-7, 1, -3], right=[-5, -1, 3], head=-2)), (1200, IDLE)], True)
    # 支撑相匀速后移、摆动相抬脚前送；运行时由自主里程驱动。
    walk=[]
    for i in range(61):
        u=i/60; params=dict(twist=3*math.sin(u*math.tau), crouch=.035+.025*math.cos(u*math.tau*2), sway=.045*math.cos(u*math.tau), left=[-14-4*math.sin(u*math.tau),5,-3],right=[-14+4*math.sin(u*math.tau),-5,3])
        for side,phase in [('L',u%1),('R',(u+.5)%1)]:
            if phase<.6: stride=-.32+phase/.6*.64; lift=0
            else:
                v=(phase-.6)/.4; stride=.32-.64*(v*v*(3-2*v)); lift=.16*math.sin(v*math.pi)**2
            params['stride'+side]=stride;params['lift'+side]=lift
        walk.append((round(u*1000),pose(**params)))
    add('walk','连续步行',1000,walk,True)
    add('start','起步',200,[(0,IDLE),(100,pose(liftL=.14,strideL=-.16,strideR=.10)),(200,walk[0][1])])
    for phase in range(8):
        add('stop' if phase==0 else 'stop-'+str(phase),'停步支撑相'+str(phase+1),240,[(0,sample(walk,phase*125)),(240,IDLE)])
    add('turn-left','左转支撑',240,[(0,IDLE),(110,pose(twist=-8,crouch=.04,liftL=.05)),(240,IDLE)])
    add('turn-right','右转支撑',240,[(0,IDLE),(110,pose(twist=8,crouch=.04,liftR=.05)),(240,IDLE)])
    add('entry','现身舒展',1800,[(0,COCOON),(800,RAISE),(1400,OPEN),(1800,IDLE)])
    add('cross-left','十字镰斩第一击',1170,[(0,IDLE),(450,LOAD_L),(650,LOAD_L),(750,CUT_L),(850,pose(**{**CUT_L,'twist':29})),(950,LINK),(1170,LINK)],attack=True,markers=dict(lock=400,contact=750,active=950,end=1170))
    add('cross-link','借势换镰',160,[(0,LINK),(160,LINK)])
    add('cross-right','十字镰斩第二击',1170,[(0,LINK),(450,LOAD_R),(660,LOAD_R),(750,CUT_R),(850,pose(**{**CUT_R,'twist':-29})),(950,pose(twist=-13,left=[-23,14,-8],right=[-38,12,-9],crouch=.07)),(1170,OPEN)],attack=True,markers=dict(lock=400,contact=750,active=950,end=1170))
    for name,label,windup,release,sustain,exit_pose in [
        ('needles','棘针齐射',900,CAST,pose(**{**CAST,'lean':9,'left':[-80,16,-4],'right':[-83,-16,4]}),OPEN),
        ('roots','缠根封路',1100,RAISE,pose(crouch=.18,lean=13,left=[-35,22,-10],right=[-37,-24,10]),OPEN),
        ('cocoon','护心结茧',900,COCOON,COCOON,OPEN),
        ('ritual','缚枝仪式',1100,CAST,RAISE,OPEN),
        ('laser','赤环灭光',1200,COCOON,CAST,OPEN),
    ]:
        add(name+'-enter',label+'起手',windup,[(0,IDLE),(windup*.60,release),(windup*.85,release),(windup,sustain)],markers=dict(contact=windup))
        add(name+'-hold',label+'持续',600,[(0,sustain),(300,pose(**{**sustain,'crouch':sustain['crouch']+.025,'head':sustain['head']+3})),(600,sustain)],True)
        add(name+'-exit',label+'收势',220 if name!='laser' else 900,[(0,sustain),(220 if name!='laser' else 900,exit_pose)])
    add('shift','移步换阵',1370,[(0,IDLE),(550,pose(crouch=.13,lean=-8,left=[-25,15,-10],right=[-28,-18,10])),(850,pose(left=[-35,12,-8],right=[-35,-12,8],crouch=.11,lean=12,liftL=.12,strideL=-.30,strideR=.30)),(1000,pose(left=[-35,12,-8],right=[-35,-12,8],crouch=.08,lean=9,liftR=.10,strideL=.30,strideR=-.30)),(1150,pose(left=[-28,10,-8],right=[-28,-10,8],crouch=.13,lean=4)),(1370,OPEN)],markers=dict(lock=500,contact=850,active=1150,end=1370))
    add('exposed','风核暴露',1000,[(0,OPEN),(500,pose(**{**OPEN,'crouch':.125,'head':13})),(1000,OPEN)],True)
    add('recover','重整警戒',300,[(0,OPEN),(300,IDLE)])
    add('hurt','受击回震',320,[(0,IDLE),(70,BRACE),(180,pose(crouch=.06,lean=5)),(320,IDLE)])
    add('parry','弹反失衡',1000,[(0,BRACE),(160,pose(**{**BRACE,'lean':-17})),(780,BRACE),(1000,OPEN)])
    add('perfect','完美弹反失衡',1000,[(0,BRACE),(140,pose(**{**BRACE,'lean':-22,'crouch':.24})),(780,pose(**{**BRACE,'crouch':.20})),(1000,OPEN)])
    add('transform','双印仪式转换',800,[(0,OPEN),(320,COCOON),(560,RAISE),(800,OPEN)])
    add('death','失去风核倒下',1700,[(0,OPEN),(300,BRACE),(700,pose(crouch=.3,lean=20,left=[-10,28,-12],right=[-12,-30,12])),(1100,pose(rootTilt=66,crouch=.25,left=[-20,32,-14],right=[-22,-34,14])),(1450,pose(rootTilt=77,crouch=.22,left=[-16,30,-12],right=[-18,-30,12])),(1700,pose(rootTilt=77,crouch=.22,left=[-16,30,-12],right=[-18,-30,12]))])
    refine_clips(clips)
    return clips


class RefinedKeys(list):
    pass


def refine_clips(clips):
    def put(name,label,duration,keys,**extra):
        clips[name]=dict(label=label,duration=duration,keys=RefinedKeys(keys),loop=False,attack=False,markers={},**extra)
    ready=pose(twist=-8,crouch=.06,left=[-18,4,-5],right=[-22,-5,7],strideL=-.06,strideR=.06)
    load=pose(twist=-34,crouch=.18,sway=-.13,lean=7,left=[-81,20,-22],right=[-38,-14,18],elbowL=-18,liftL=.05,strideL=-.22,strideR=.18,head=9)
    hit=pose(twist=39,crouch=.09,sway=.12,lean=16,left=[-57,-65,25],right=[-68,-20,25],elbowL=12,elbowR=-12,strideL=-.28,strideR=.20,head=-11)
    chain=pose(twist=27,crouch=.12,sway=.08,lean=8,left=[-36,-8,12],right=[-83,-19,27],elbowL=2,elbowR=-17,strideL=-.18,strideR=.18,head=-8)
    hit_r=pose(twist=-40,crouch=.08,sway=-.12,lean=14,left=[-39,16,-16],right=[-58,61,-26],elbowR=12,strideL=.16,strideR=-.25,head=12)
    put('cross-left','重心带动第一镰',1030,[(0,ready),(190,pose(**{**ready,'crouch':.12,'twist':-19})),(430,load),(640,pose(**{**load,'twist':-28,'crouch':.20,'left':[-87,12,-18]})),(750,hit),(825,pose(**{**hit,'twist':46,'left':[-49,-55,18],'liftR':.06})),(950,pose(**{**chain,'twist':34,'right':[-77,-22,25],'liftR':.03})),(1030,chain)])
    clips['cross-left'].update(attack=True,markers=dict(lock=400,contact=750,active=950,end=1030),support='left',step=24)
    put('cross-link','换手延续',80,[(0,pose(**{**chain,'twist':34,'right':[-77,-22,25]})),(80,chain)])
    put('cross-right','借势第二镰',820,[(0,chain),(110,pose(**{**chain,'twist':32,'crouch':.16,'right':[-90,-9,20]})),(270,pose(**{**chain,'twist':22,'lean':12,'right':[-83,8,11],'liftR':.07})),(400,hit_r),(480,pose(**{**hit_r,'twist':-46,'right':[-45,45,-18]})),(600,pose(twist=-24,lean=12,crouch=.13,left=[-25,24,-10],right=[-35,20,-12],strideL=.12,strideR=-.12)),(820,OPEN)])
    clips['cross-right'].update(attack=True,markers=dict(lock=50,contact=400,active=600,end=820),support='right',step=18)
    for name in ['idle','start','walk','stop',*['stop-'+str(i) for i in range(1,8)],'turn-left','turn-right','recover']:
        clips[name]['keys']=RefinedKeys(clips[name]['keys']);clips[name]['refined']=True
    clips['start']['keys']=RefinedKeys([(0,IDLE),(80,pose(crouch=.09,lean=6,left=[-26,5,-5],right=[-24,-5,5],liftL=.06,strideL=-.12,strideR=.08)),(200,clips['walk']['keys'][0][1])])
    for side,phase in [('left',0),('right',.5)]:
        for turn,sign in [('left',-1),('right',1)]:
            name='walk-turn-'+turn+'-'+side
            keys=[]
            for t in [0,50,100,150,200]:
                p=sample(clips['walk']['keys'],((phase+t/900)%1)*1000);p.update(lean=7,twist=sign*7*math.sin(math.pi*t/200),sway=p['sway']+sign*.025)
                keys.append((t,p))
            put(name,('左' if turn=='left' else '右')+'转弯·'+('左' if side=='left' else '右')+'脚支撑',200,keys)
            clips[name].update(turnDegrees=sign*45,support=side,startPhase=phase,endPhase=(phase+200/900)%1)
    for prefix in ['parry','perfect']:
        for side,first in [('left',hit),('right',hit_r)]:
            sign=1 if side=='left' else -1
            impact=pose(**{**BRACE,'twist':sign*14,'lean':-18 if prefix=='parry' else -24,'crouch':.18 if prefix=='parry' else .24,'left':[-48,12,-12],'right':[-53,-13,15]})
            put(prefix+'-'+side,('完美' if prefix=='perfect' else '普通')+'弹反·'+('左' if side=='left' else '右')+'镰失衡',1000,[(0,first),(100,impact),(240,pose(**{**impact,'lean':impact['lean']+5})),(720,pose(**{**impact,'crouch':impact['crouch']-.03})),(1000,OPEN)])
    for name in ['cross-left','cross-right']:
        c=clips[name];clips[name+'-planted']={**c,'label':c['label']+'·受阻稳足','step':0,'keys':RefinedKeys([(t,{**p,'strideL':0,'strideR':0,'liftL':0,'liftR':0}) for t,p in c['keys']])}
    for c in clips.values():
        if isinstance(c['keys'],RefinedKeys):c['refined']=True


def sample(keys,t):
    if isinstance(keys,RefinedKeys):
        if t<=keys[0][0]:return keys[0][1]
        if t>=keys[-1][0]:return keys[-1][1]
        for i,((a,p),(b,q)) in enumerate(zip(keys,keys[1:])):
            if t<=b:
                u=(t-a)/(b-a);prev=keys[max(0,i-1)];nxt=keys[min(len(keys)-1,i+2)]
                def cubic(k,idx=None):
                    def v(item):return item[k][idx] if idx is not None else item[k]
                    va,vb=v(p),v(q)
                    ma=0 if i==0 else (v(q)-v(prev[1]))/(b-prev[0])
                    mb=0 if i+2==len(keys) else (v(nxt[1])-v(p))/(nxt[0]-a)
                    if va==vb:ma=mb=0
                    result=(2*u**3-3*u*u+1)*va+(u**3-2*u*u+u)*ma*(b-a)+(-2*u**3+3*u*u)*vb+(u**3-u*u)*mb*(b-a)
                    return max(0,result) if k.startswith('lift') else result
                return {k:[cubic(k,j) for j in range(len(v))] if isinstance(v,list) else cubic(k) for k,v in p.items()}
    for (a,p),(b,q) in zip(keys,keys[1:]):
        if t<=b:
            u=max(0,min(1,(t-a)/(b-a)));u=u*u*(3-2*u)
            return {k:[v+(q[k][i]-v)*u for i,v in enumerate(p[k])] if isinstance(p[k],list) else p[k]+(q[k]-p[k])*u for k in p}
    return keys[-1][1]


def setup(path):
    bpy.ops.wm.open_mainfile(filepath=str(path));s=bpy.context.scene;s.frame_set(1)
    r=bpy.data.objects['缚枝祭主·可编辑骨架'];r.animation_data_clear()
    for b in r.pose.bones:
        b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
        for c in list(b.constraints):b.constraints.remove(c)
    orient=bpy.data.objects.new('八方向旋转根',None);s.collection.objects.link(orient)
    for ob in list(s.objects):
        if ob!=orient and ob.parent is None and ob.type in ['MESH','ARMATURE']:
            world=ob.matrix_world.copy();ob.parent=orient;ob.matrix_world=world
    targets={}
    for side in ['左','右']:
        foot=r.data.bones[side+'脚']
        ob=bpy.data.objects.new(side+'脚落地控制',None);s.collection.objects.link(ob);ob.parent=orient;ob.location=foot.head_local;ob.empty_display_size=.08
        ob.rotation_mode='QUATERNION';ob.rotation_quaternion=foot.matrix_local.to_quaternion();targets[side]=ob
        c=r.pose.bones[side+'小腿'].constraints.new('IK');c.name='支撑脚双节求解';c.target=ob;c.chain_count=2;c.use_stretch=False;c.iterations=64
        c=r.pose.bones[side+'脚'].constraints.new('COPY_ROTATION');c.name='根足接地朝向';c.target=ob
    s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1664;s.render.resolution_y=1664;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.compression=15;s.render.film_transparent=True
    s.render.fps=60;s.render.use_file_extension=True
    s.eevee.taa_render_samples=8
    s.camera=bpy.data.objects['游戏视角'];s.camera.data.ortho_scale=7.0
    s.camera.location=(0,-10,7.6);s.camera.rotation_euler=(Vector((0,0,2.05))-s.camera.location).to_track_quat('-Z','Y').to_euler()
    return s,r,orient,targets


def apply(r,targets,p,t,lag=None):
    lag=lag or p
    def rotate(name,angles):
        b=r.pose.bones[name];rest=b.bone.matrix_local.to_quaternion();delta=Euler(tuple(math.radians(a) for a in angles),'XYZ').to_quaternion()
        b.rotation_quaternion=rest.inverted()@delta@rest
    r.pose.bones['根'].location=(0,0,0)
    rotate('根',(p['rootTilt'],0,0));rotate('骨盆',(0,0,p['twist']*.18));rotate('腰',(p['lean']*.45,0,p['twist']*.36));rotate('胸',(p['lean']*.55,0,p['twist']*.46));rotate('头',(p['head'],0,-p['twist']*.32))
    pelvis=r.pose.bones['骨盆'];pelvis.location=pelvis.bone.matrix_local.to_3x3().inverted()@Vector((p['sway'],0,-p['crouch']))
    for side,key in [('左','L'),('右','R')]:
        rotate(side+'上臂',p['left' if key=='L' else 'right']);rotate(side+'前臂',(p['elbow'+key],0,0));rotate(side+'镰臂',(0,0,0))
        delay=.12 if key=='L' else .20;wave=math.sin((t/1000-delay)*math.tau/1.2)
        rotate(side+'肩叶',(wave*1.8-lag['lean']*.35,0,-p['twist']*.12+(lag['twist']-p['twist'])*.25))
        rotate(side+'腰叶',(math.sin((t/1000-.24)*math.tau/1.2)*1.4,0,-p['twist']*.08+(lag['twist']-p['twist'])*.13))
        rotate(side+'冠枝',(wave*.8,0,-p['twist']*.06+(lag['twist']-p['twist'])*.10))
        targets[side].location=r.data.bones[side+'脚'].head_local+Vector((0,p['stride'+key],p['lift'+key]))


def articulated(r,targets,c,t):
    keys=c['keys'];duration=c['duration']
    def delayed(delay):return sample(keys,max(0,min(duration,t-delay*math.sin(math.pi*t/duration))))
    p=delayed(0);apply(r,targets,p,t,delayed(95))
    def rotate(name,angles):
        b=r.pose.bones[name];rest=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=rest.inverted()@Euler(tuple(math.radians(a) for a in angles),'XYZ').to_quaternion()@rest
    for name,delay,lean,twist in [('骨盆',0,0,.24),('腰',24,.42,.35),('胸',47,.58,.41)]:
        q=delayed(delay);rotate(name,(q['lean']*lean,0,q['twist']*twist))
    for side,delay,key in [('左',62,'left'),('右',86,'right')]:
        q=delayed(delay if c.get('attack') else 0);rotate(side+'上臂',q[key]);rotate(side+'前臂',(q['elbowL' if side=='左' else 'elbowR'],0,0))
    q=delayed(115);rotate('头',(q['head'],0,-q['twist']*.32))


def build(delivery):
    source=SOURCE/('east-boss-art-delivery.blend' if delivery else 'east-boss-art-editable.blend')
    s,r,orient,targets=setup(source);clips=make_clips();cursor=1
    s.timeline_markers.clear()
    for name,c in clips.items():
        count=round(c['duration']*FPS/1000);c['start']=cursor;c['end']=cursor+count
        s.timeline_markers.new(c['label'],frame=cursor)
        times=sorted(set([0,c['duration'],*[k[0] for k in c['keys']],*[min(c['duration'],k[0]+d) for k in c['keys'] for d in [24,47,86,115]]])) if c.get('refined') else [min(c['duration'],i*1000/FPS) for i in range(count+1)]
        if name=='walk':times=list(range(0,1001,100))
        for t in times:
            i=t*FPS/1000;p=sample(c['keys'],t)
            if c.get('refined'):articulated(r,targets,c,t)
            else:apply(r,targets,p,t*1200/c['duration'],sample(c['keys'],(t-100)%c['duration'] if c['loop'] else max(0,t-100)))
            if name=='death':
                bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
                lowest=min((ob.matrix_world@v.co).z for ob in s.objects if ob.type=='MESH' for v in ob.evaluated_get(deps).data.vertices)
                lift=max(0,.004-lowest)
                r.pose.bones['根'].location=r.data.bones['根'].matrix_local.to_3x3().inverted()@Vector((0,0,lift))
                for target in targets.values():target.location.z+=lift

            for b in r.pose.bones:
                b.keyframe_insert('rotation_quaternion',frame=cursor+i);b.keyframe_insert('location',frame=cursor+i)
            for ob in targets.values():ob.keyframe_insert('location',frame=cursor+i)
        cursor+=count+2
    s.frame_start=1;s.frame_end=cursor-2;s.frame_set(1)
    for ob in [r,*targets.values()]:
        action=ob.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for k in curve.keyframe_points:
                            refined=any(c.get('refined') and c['start']<=k.co.x<=c['end'] for c in clips.values())
                            k.interpolation='BEZIER' if refined else 'LINEAR';k.handle_left_type='AUTO_CLAMPED';k.handle_right_type='AUTO_CLAMPED'
    note=bpy.data.texts.new('正式动作说明');note.write('第四版造型的正式战斗动作。时间线标记对应各动作；六十帧制作，双脚通过逆向运动约束落地。旋转根用于八方向导出。伤害和位移由游戏决定。原第四版工程保持不变。')
    out=OUT/'source'/('east-boss-animation-render.blend' if delivery else 'east-boss-animation-editable.blend');out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out))
    write(OUT/'source/clips.json',{'说明':'正式动作时间线；时长单位毫秒，帧号对应六十帧源工程。','sourceHash':hashlib.sha256(source.read_bytes()).hexdigest(),'clips':clips})


def render(args):
    source_path=OUT/'source/east-boss-animation-render.blend';source_hash=hashlib.sha256(source_path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];orient=bpy.data.objects['八方向旋转根'];clips=json.loads((OUT/'source/clips.json').read_text())['clips']
    wanted=args.clips.split(',') if args.clips else list(clips);directions=[int(d) for d in args.directions.split(',')]
    records=[];start=time.time();tips={}
    for side in ['左','右']:
        for ob in s.objects:
            if ob.type!='MESH':continue
            group=ob.vertex_groups.get('部位·'+side+'镰刃分层截面')
            if group:
                ids=[v.index for v in ob.data.vertices if any(g.group==group.index for g in v.groups)]
                tips[side]=ob.matrix_world@ob.data.vertices[ids[-10]].co
                break
        assert side in tips,'缺少真实镰尖部位组'

    def project(v):
        q=world_to_camera_view(s,s.camera,v);return [q.x*1664,(1-q.y)*1664]
    for name in wanted:
        c=clips[name];times=list(range(0,math.ceil(c['duration']),1000//30))
        if c['attack']:times+=list(range(max(0,c['markers']['contact']-120),c['markers']['active']+1,1000//60))
        times=sorted(set([min(c['duration'],t) for t in times]+[c['duration'],*c['markers'].values()]))
        if args.probe:times=[0,c['markers']['lock'],c['markers']['contact'],c['markers']['active'],c['duration']] if c['attack'] else [0,c['duration']/2]
        for d in directions:
            orient.rotation_euler.z=d*math.pi/4
            for i,t in enumerate(times):
                turn=math.radians(c['turnDegrees'])*t/c['duration'] if 'turnDegrees' in c else (1-t/c['duration'])*math.pi/4*(1 if name=='turn-left' else -1) if name.startswith('turn-') else 0
                orient.rotation_euler.z=d*math.pi/4+turn
                frame=c['start']+t*FPS/1000;s.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
                path=OUT/('probe' if args.probe else 'master')/name/str(d)/f'{i:04d}.png';path.parent.mkdir(parents=True,exist_ok=True)
                if not path.exists() or args.force or path.stat().st_mtime_ns<source_path.stat().st_mtime_ns:
                    s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
                sockets={}
                for label,bone in [('left','左镰臂'),('right','右镰臂'),('core','胸'),('footL','左脚'),('footR','右脚')]:
                    b=r.pose.bones[bone];v=b.head if label!='core' else b.head.lerp(b.tail,.45)
                    if label in ['left','right']:
                        # 刃尖从真实部位组末端读取；绑定骨变换保持与渲染一致。
                        side='左' if label=='left' else '右';point=tips[side]
                        v=b.matrix@b.bone.matrix_local.inverted()@point
                    sockets[label]=project(r.matrix_world@v)
                records.append(dict(clip=name,direction=d,time=t,file=str(path.relative_to(OUT)),root=project(orient.matrix_world@Vector((0,0,0))),sockets=sockets))
    write(OUT/'source'/('probe-frames.json' if args.probe else 'frames-'+('selected-'+hashlib.sha256(','.join(wanted).encode()).hexdigest()[:12] if args.clips else 'all')+'-'+args.directions.replace(',','-')+'.json'),dict(说明='直接由交付动画工程渲染，未做单帧补画。',sourceHash=source_hash,seconds=time.time()-start,frames=records))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='东侧首领正式动作制作与渲染')
    parser.add_argument('mode',choices=['build','render']);parser.add_argument('--delivery',action='store_true');parser.add_argument('--clips');parser.add_argument('--directions',default='0,1,2,3,4,5,6,7');parser.add_argument('--probe',action='store_true');parser.add_argument('--force',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    build(args.delivery) if args.mode=='build' else render(args)
