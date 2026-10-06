"""直接渲染第三版交付、源工程和保护基线；各组独立加载，避免灯光或灰模污染。"""
import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/east-boss-art-v3'
os.environ['EAST_BOSS_ART_OUT']=str(OUT)
spec=importlib.util.spec_from_file_location('art_v3',ROOT/'tools/build-east-boss-art-v2.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
parser=argparse.ArgumentParser(description='第三版原始渲染包')
parser.add_argument('--mode',choices=['static','motion','baseline','source'],required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source=OUT/'source/east-boss-art-editable.blend';delivery=OUT/'source/east-boss-art-delivery.blend'
records=[]

def render(path,mode,percent=100,folder=OUT):
    (folder/'evidence').mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(path));art.OUT=folder
    art.art.RIG=bpy.data.objects['缚枝祭主·可编辑骨架']
    art.render(mode,percent)
    records.append({'工程':str(path.relative_to(ROOT)),'摘要':hashlib.sha256(path.read_bytes()).hexdigest(),'视图':mode,'分辨率比例':percent,'目录':str(folder.relative_to(ROOT))})

if args.mode=='static':
    render(delivery,'all')
    for mode in ['clay','silhouette','neutral']:render(delivery,mode,50 if mode!='neutral' else 100)
elif args.mode=='motion':render(delivery,'motion',50)
elif args.mode=='baseline':
    for mode in ['front','clay','silhouette','neutral']:render(OUT/'source/east-boss-art-baseline.blend',mode,100 if mode in ['front','neutral'] else 50,OUT/'baseline')
elif args.mode=='source':
    render(source,'front',100,OUT/'source-check')
    render(source,'quarter-left',100,OUT/'source-check')
    render(delivery,'quarter-left',100,OUT/'delivery-check')
(OUT/'evidence'/f'render-{args.mode}.json').write_text(json.dumps({'说明':'直接从记录的工程渲染，不补画、不锐化。','记录':records},ensure_ascii=False,indent=2))
