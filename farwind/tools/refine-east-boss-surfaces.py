"""第四轮：将木甲贴合承重根表面，改善细枝根部并疏解肩叶重叠。"""
import importlib.util
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('surface_refinement',ROOT/'tools/build-east-boss-art-v2.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
snapshot=art.OUT/'source/east-boss-art-before-structure-round-four.blend'
assert snapshot.exists(),'先保留修改前快照'
bpy.ops.wm.open_mainfile(filepath=str(snapshot));scene=bpy.context.scene;scene.frame_set(1)
counts={'贴合木甲':0,'调整次枝根部':0,'移除重复内层叶':0,'改变垂叶轮廓':0}
def rings(ob):
    vs=list(ob.data.vertices)
    assert len(vs)%12==0,'枝条截面不符'
    return [vs[i:i+12] for i in range(0,len(vs),12)]
def center(ring):return sum((v.co for v in ring),Vector())/len(ring)
for ob in list(scene.objects):
    if ob.type!='MESH':continue
    if '树皮转折甲' in ob.name:
        side=ob.name[0];number=int(ob.name.split('树皮转折甲')[1])
        prefix=side+('臂部主木束' if number<3 else '腿部扭转主根')
        verts=[];faces=[]
        for root in scene.objects:
            if root.type=='MESH' and root.name.startswith(prefix):
                offset=len(verts);verts.extend(v.co.copy() for v in root.data.vertices)
                faces.extend(tuple(offset+i for i in p.vertices) for p in root.data.polygons)
        assert verts,'找不到木甲下的主根'
        tree=BVHTree.FromPolygons(verts,faces)
        assert len(ob.data.vertices)==9,'木甲拓扑变化'
        for i in range(5):
            v=ob.data.vertices[i];loc,normal,_,distance=tree.find_nearest(v.co)
            assert loc is not None and distance<.3,'木甲离主根过远'
            # 外缘贴近表面，中央保留生长脊；背面嵌入主根，避免悬空。
            v.co=loc+normal*(.016 if i==4 else .002)
            if i<4:ob.data.vertices[i+5].co=loc-normal*.004
        counts['贴合木甲']+=1
    if ob.name.startswith('冠枝次级分叉'):
        index=int(ob.name.split('冠枝次级分叉')[1].split('-')[0])
        parent=bpy.data.objects['树冠承重主枝'+str(index)]
        rr=rings(ob);pr=rings(parent);origin=center(rr[0]);pc=[center(r) for r in pr]
        nearest=min(range(len(pc)),key=lambda i:(pc[i]-origin).length)
        tangent=(pc[min(nearest+1,len(pc)-1)]-pc[max(0,nearest-1)]).normalized()
        end=center(rr[-1]);length=(end-origin).length
        if tangent.dot(end-origin)<0:tangent=-tangent
        for j,ring in enumerate(rr):
            t=j/(len(rr)-1);old=center(ring)
            influence=max(0,1-t/.48)
            shift=tangent*(.13*length*math.sin(math.pi*min(1,t/.48))*influence)
            flare=1+.28*max(0,1-t/.28)
            for v in ring:v.co=old+shift+(v.co-old)*flare
        counts['调整次枝根部']+=1
    if '肩部叶簇' in ob.name:
        cluster=int(ob.name.split('肩部叶簇')[1].split('.')[0])
        suffix=int(ob.name.rsplit('.',1)[1]) if '.' in ob.name else 0
        if cluster in [1,2] and suffix in [3,9]:
            bpy.data.objects.remove(ob,do_unlink=True);counts['移除重复内层叶']+=1;continue
        if cluster in [2,3,4] and suffix%3==1:
            vs=list(ob.data.vertices);anchor=sum((v.co for v in vs[:5]),Vector())/5
            for row in range(15):
                t=row/14
                for v in vs[row*5:(row+1)*5]:
                    v.co.x=anchor.x+(v.co.x-anchor.x)*.88
                    v.co.z-=.095*t*t
                    v.co.y+=(-.035 if anchor.y<0 else .035)*math.sin(math.pi*t)
            counts['改变垂叶轮廓']+=1
assert counts['贴合木甲']==12 and counts['调整次枝根部']>=12 and counts['移除重复内层叶']==8
scene['第四轮精修']='木甲表面贴合、次枝基部过渡、肩叶疏密；主相机灯光与骨架不变。'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(art.SOURCE))
(art.OUT/'evidence/structure-round-four/changes.json').write_text(json.dumps({'改动':counts,'说明':'范围统计不代替美术验收，枝条相交不等于焊接拓扑。'},ensure_ascii=False,indent=2))
print(json.dumps(counts,ensure_ascii=False))
