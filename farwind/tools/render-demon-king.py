"""从保存工程直接渲染原画机位、多视角、灰模与连续待机。"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/demon-king-model-v1'
parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['quick','static','idle','delivery'],default='quick');parser.add_argument('--start',type=int,default=1);parser.add_argument('--end',type=int,default=180)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
path=OUT/'source'/('demon-king-delivery.blend' if args.mode=='delivery' else 'demon-king-editable.blend')
bpy.ops.wm.open_mainfile(filepath=str(path));s=bpy.context.scene;s.frame_set(1)

def view(angle=0, game=False, scale=6.2):
    camera=bpy.data.objects['游戏视角' if game else '原画对照'];s.camera=camera
    a=math.radians(angle);target=Vector((0,0,2.65));distance=12
    camera.location=(distance*math.sin(a),-distance*math.cos(a),9.3 if game else 3.7)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale

def render(name,size=1200):
    s.render.resolution_x=size;s.render.resolution_y=size;s.render.filepath=str(OUT/'previews'/name)
    bpy.ops.render.render(write_still=True);print('完成渲染：',name,flush=True)

if args.mode=='quick':
    s.eevee.taa_render_samples=16;view();render('front-quick.png',900)
elif args.mode=='delivery':
    view();render('front-delivery.png');view(-35);render('quarter-delivery.png')
elif args.mode=='idle':
    folder=OUT/'evidence/idle-frames';folder.mkdir(exist_ok=True);view(-12);s.eevee.taa_render_samples=12
    s.render.resolution_x=640;s.render.resolution_y=640
    for frame in range(args.start,args.end+1):
        s.frame_set(frame);s.render.filepath=str(folder/f'{frame:04d}.png');bpy.ops.render.render(write_still=True)
else:
    for name,angle in [('front',0),('quarter-left',-35),('quarter-right',35),('side',90),('back',180)]:
        view(angle);render(name+'.png')
    view(-12);render('reference-pose.png')
    view();bpy.data.collections['黑焰'].hide_render=True;render('front-no-flame.png')
    for name,angle in [('quarter-no-flame',-35),('side-no-flame',90),('back-no-flame',180)]:view(angle);render(name+'.png')
    grey=bpy.data.materials.new('中性灰模');grey.use_nodes=True
    p=next(n for n in grey.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(.32,.32,.32,1);p.inputs['Roughness'].default_value=.9
    s.view_layers[0].material_override=grey;view();render('grey-front.png');view(-35);render('grey-quarter.png');view(180);render('grey-back.png')
    s.view_layers[0].material_override=None;bpy.data.collections['黑焰'].hide_render=False
    for direction in range(8):view(direction*45,True);render(f'game-{direction}.png',960)
    # 头冠近景保持实体结构可见。
    view(-12);s.camera.location=(.8,-10,4.9);s.camera.rotation_euler=(Vector((0,0,4.0))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=2.4
    render('head-detail.png')
